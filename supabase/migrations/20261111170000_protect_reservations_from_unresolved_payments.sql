
CREATE OR REPLACE FUNCTION public.create_order_reservation(
    p_offer_id uuid
)
RETURNS TABLE (
    order_id uuid,
    reservation_expires_at timestamptz,
    amount_due numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_user_id uuid;
    v_request_id uuid;

    v_customer_id uuid;
    v_request_status text;
    v_pickup_date date;
    v_pickup_time time;
    v_hub text;

    v_cook_id uuid;
    v_offer_status text;
    v_offer_total numeric;

    v_negotiation_offer_id uuid;
    v_negotiation_customer_id uuid;
    v_negotiation_status text;
    v_agreed_total numeric;

    v_meal_subtotal numeric(10,2);
    v_negotiated_discount numeric(10,2);
    v_platform_fee numeric(10,2) := 0.10;
    v_platform_commission numeric(10,2);
    v_cook_share numeric(10,2);
    v_total numeric(10,2);

    v_items jsonb;

    v_existing_order_id uuid;
    v_existing_offer_id uuid;
    v_existing_customer_id uuid;
    v_existing_expires_at timestamptz;
    v_existing_payment_status text;
    v_existing_total numeric;

    v_now timestamptz;
    v_local_now timestamp without time zone;
    v_expires_at timestamptz;
    v_new_order_id uuid;

BEGIN

    -- A. Authentication.

    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;


    -- B. Only customer accounts may reserve orders.

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = v_user_id
          AND u.role = 'customer'
    ) THEN

        RAISE EXCEPTION 'Customer account required.';

    END IF;


    -- C. Find the request belonging to the selected offer.

    SELECT co.request_id
    INTO v_request_id
    FROM public.cook_offers co
    WHERE co.id = p_offer_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cook offer not found.';
    END IF;


    -- D. Lock 1: meal request.

    SELECT
        mr.customer_id,
        mr.status,
        mr.pickup_date,
        mr.pickup_time,
        mr.hub
    INTO
        v_customer_id,
        v_request_status,
        v_pickup_date,
        v_pickup_time,
        v_hub
    FROM public.meal_requests mr
    WHERE mr.id = v_request_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meal request not found.';
    END IF;


    IF v_customer_id <> v_user_id THEN
        RAISE EXCEPTION
            'You cannot reserve another customer''s request.';
    END IF;


    -- Block all new reservations when this request has a verified
    -- payment requiring manual review, regardless of which order
    -- received that payment.
    IF EXISTS (
        SELECT 1
        FROM public.payment_transactions pt
        JOIN public.orders o
          ON o.id = pt.order_id
        WHERE o.meal_request_id = v_request_id
          AND pt.status = 'manual_review_required'
    ) THEN
        RAISE EXCEPTION
            'This meal request has a verified payment requiring manual review. No new reservation is permitted.';
    END IF;


    -- E. Lock 2: selected cook offer.

    SELECT
        co.cook_id,
        co.status,
        co.total_price
    INTO
        v_cook_id,
        v_offer_status,
        v_offer_total
    FROM public.cook_offers co
    WHERE co.id = p_offer_id
      AND co.request_id = v_request_id
    FOR UPDATE;


    IF NOT FOUND OR v_offer_status <> 'submitted' THEN
        RAISE EXCEPTION
            'Only submitted offers can be reserved.';
    END IF;


    IF v_cook_id = v_user_id THEN
        RAISE EXCEPTION
            'You cannot reserve your own offer.';
    END IF;


    -- Confirm that the cook is still approved.

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp
            ON cp.user_id = u.id
        WHERE u.id = v_cook_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN

        RAISE EXCEPTION
            'This cook is not currently approved.';

    END IF;


    -- F. Lock 3: request-level negotiation, if one exists.

    SELECT
        n.offer_id,
        n.customer_id,
        n.status,
        n.agreed_total
    INTO
        v_negotiation_offer_id,
        v_negotiation_customer_id,
        v_negotiation_status,
        v_agreed_total
    FROM public.negotiations n
    WHERE n.request_id = v_request_id
    FOR UPDATE;


    IF FOUND THEN

        IF v_negotiation_customer_id <> v_customer_id THEN
            RAISE EXCEPTION
                'Negotiation does not belong to the request customer.';
        END IF;


        -- A pending negotiation blocks all offer selections.

        IF v_negotiation_status = 'pending' THEN
            RAISE EXCEPTION
                'A counteroffer is awaiting the cook''s response.';
        END IF;


        -- An accepted negotiation must contain a valid agreed price.

        IF v_negotiation_status = 'accepted'
           AND (
               v_agreed_total IS NULL
               OR v_agreed_total <= 0
           ) THEN

            RAISE EXCEPTION
                'Accepted negotiation has an invalid agreed price.';

        END IF;

    END IF;


    -- G. Lock 4: existing active reservation.

    SELECT
        o.id,
        o.offer_id,
        o.customer_id,
        o.reservation_expires_at,
        o.total
    INTO
        v_existing_order_id,
        v_existing_offer_id,
        v_existing_customer_id,
        v_existing_expires_at,
        v_existing_total
    FROM public.orders o
    WHERE o.meal_request_id = v_request_id
      AND o.status = 'pending'
      AND o.payment_status = 'pending'
    FOR UPDATE;


    IF FOUND THEN

        -- A malformed active reservation must not be silently
        -- treated as expired.

        IF v_existing_expires_at IS NULL THEN
            RAISE EXCEPTION
                'Existing reservation has no expiration timestamp.';
        END IF;

        -- Prevent releasing a reservation with an unresolved payment.

        SELECT pt.status
        INTO v_existing_payment_status
        FROM public.payment_transactions pt
        WHERE pt.order_id = v_existing_order_id
          AND pt.status IN (
              'initiated',
              'pending',
              'reconciliation_required',
              'manual_review_required'
          )
        FOR UPDATE;

        IF FOUND THEN
            RAISE EXCEPTION
                'This reservation has an unresolved payment attempt. Payment reconciliation or manual review is required before another reservation can be created.';
        END IF;

        -- Return the existing reservation for a repeated selection.

        IF v_existing_expires_at > clock_timestamp() THEN

            IF v_existing_offer_id = p_offer_id
               AND v_existing_customer_id = v_user_id THEN

                RETURN QUERY
                SELECT
                    v_existing_order_id,
                    v_existing_expires_at,
                    v_existing_total;

                RETURN;

            END IF;


            RAISE EXCEPTION
                'This meal request already has an active reservation.';

        END IF;


        -- Expire the old reservation.

        UPDATE public.orders
        SET
            status = 'cancelled',
            payment_status = 'expired'
        WHERE id = v_existing_order_id
          AND meal_request_id = v_request_id
          AND status = 'pending'
          AND payment_status = 'pending'
          AND reservation_expires_at <= clock_timestamp();


        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Previous reservation could not be expired.';
        END IF;


        -- Reopen the request only after the previous reservation
        -- has been cancelled AND no other active unpaid reservation
        -- or unresolved payment remains for this request.

        IF v_request_status = 'offer_selected'
           AND NOT EXISTS (
               SELECT 1
               FROM public.orders o
               WHERE o.meal_request_id = v_request_id
                 AND o.status = 'pending'
                 AND o.payment_status = 'pending'
           )
           AND NOT EXISTS (
               SELECT 1
               FROM public.payment_transactions pt
               JOIN public.orders o ON o.id = pt.order_id
               WHERE o.meal_request_id = v_request_id
                 AND pt.status IN (
                     'initiated',
                     'pending',
                     'reconciliation_required',
                     'manual_review_required'
                 )
           ) THEN

            UPDATE public.meal_requests
            SET status = 'open'
            WHERE id = v_request_id
              AND status = 'offer_selected';

            IF FOUND THEN
                v_request_status := 'open';
            END IF;

        END IF;

    END IF;


    -- H. The request must now be open.

    IF v_request_status <> 'open' THEN
        RAISE EXCEPTION
            'This meal request is no longer open.';
    END IF;


    -- I. Validate pickup date using Harare local time.

    v_now := clock_timestamp();
    v_local_now := timezone('Africa/Harare', v_now);


    IF v_pickup_date < v_local_now::date THEN
        RAISE EXCEPTION
            'The pickup date has already passed.';
    END IF;


    IF v_pickup_date = v_local_now::date
       AND v_local_now::time >= TIME '10:00' THEN

        RAISE EXCEPTION
            'Same-day pickup reservations close at 10:00 AM.';

    END IF;


    -- J. Determine the correct meal subtotal.
    --
    -- If an accepted counteroffer belongs to the selected offer,
    -- use the negotiated amount.
    --
    -- If another offer is selected, use its original price.
    --
    -- Rejected, withdrawn and expired negotiations do not
    -- change the original offer price.

    IF v_negotiation_status = 'accepted'
       AND v_negotiation_offer_id = p_offer_id THEN

        IF v_agreed_total >= v_offer_total THEN
            RAISE EXCEPTION
                'Negotiated price must remain lower than the original offer.';
        END IF;

        v_meal_subtotal := v_agreed_total;

    ELSE

        v_meal_subtotal := v_offer_total;

    END IF;


    IF v_meal_subtotal IS NULL
       OR v_meal_subtotal <= 0 THEN

        RAISE EXCEPTION 'Invalid meal subtotal.';

    END IF;


    -- K. Snapshot submitted offer items.

    SELECT jsonb_agg(
        jsonb_build_object(
            'menu_item_id', coi.menu_item_id,
            'name', coi.name,
            'description', coi.description,
            'quantity', coi.quantity,
            'unit_price', coi.unit_price,
            'line_total', coi.line_total
        )
        ORDER BY coi.id
    )
    INTO v_items
    FROM public.cook_offer_items coi
    WHERE coi.offer_id = p_offer_id;


    IF v_items IS NULL
       OR jsonb_array_length(v_items) = 0 THEN

        RAISE EXCEPTION
            'The selected offer has no items.';

    END IF;


    -- L. Calculate financial breakdown.

    -- Keep the original offer item prices unchanged in the snapshot.
    -- Store the negotiated reduction as a separate order-level amount.
    v_negotiated_discount :=
        v_offer_total - v_meal_subtotal;

    v_platform_commission :=
        ROUND(v_meal_subtotal * 0.05, 2);

    v_cook_share :=
        v_meal_subtotal - v_platform_commission;

    v_total :=
        v_meal_subtotal + v_platform_fee;


    -- M. Create the 15-minute reservation.

    v_expires_at := v_now + INTERVAL '15 minutes';


    INSERT INTO public.orders (
        customer_id,
        items,
        total,
        hub,
        pickup_time,
        status,
        payment_status,
        meal_request_id,
        offer_id,
        cook_id,
        pickup_date,
        meal_subtotal,
        original_offer_total,
        negotiated_discount,
        platform_fee,
        platform_commission,
        cook_share,
        reservation_expires_at,
        payout_status,
        pickup_code
    )
    VALUES (
        v_customer_id,
        v_items,
        v_total,
        v_hub,
        v_pickup_time::text,
        'pending',
        'pending',
        v_request_id,
        p_offer_id,
        v_cook_id,
        v_pickup_date,
        v_meal_subtotal,
        v_offer_total,
        v_negotiated_discount,
        v_platform_fee,
        v_platform_commission,
        v_cook_share,
        v_expires_at,
        'not_due',
        NULL
    )
    RETURNING id INTO v_new_order_id;


    -- N. Mark the request as temporarily selected.

    UPDATE public.meal_requests
    SET status = 'offer_selected'
    WHERE id = v_request_id
      AND status = 'open';


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Could not reserve the meal request.';
    END IF;


    RETURN QUERY
    SELECT
        v_new_order_id,
        v_expires_at,
        v_total;

END;

$function$;
