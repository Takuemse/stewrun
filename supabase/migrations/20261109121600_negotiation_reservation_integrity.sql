
-- ============================================================
-- STEWRUN
-- NEGOTIATION AND RESERVATION INTEGRITY
--
-- Draft migration
--
-- IMPORTANT:
-- Review before production execution.
-- Do not use db push or migration repair.
--
-- Preserves:
--   - Existing offer submission workflow
--   - Existing customer/cook authorization
--   - Request -> offer -> negotiation lock ordering
--   - 5% platform commission
--   - $0.10 platform fee
--   - 15-minute reservation
--   - Africa/Harare pickup rules
-- ============================================================


BEGIN;


-- ============================================================
-- SECTION 1: NEGOTIATION SCHEMA
-- ============================================================

-- Add the request and cook references.
-- Initially nullable so existing rows can be backfilled.

ALTER TABLE public.negotiations
    ADD COLUMN request_id uuid,
    ADD COLUMN cook_id uuid;


-- Backfill from the existing cook offer.

UPDATE public.negotiations n
SET
    request_id = co.request_id,
    cook_id = co.cook_id
FROM public.cook_offers co
WHERE co.id = n.offer_id;


-- Verify that every negotiation was backfilled.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.negotiations
        WHERE request_id IS NULL
           OR cook_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: negotiation backfill incomplete.';
    END IF;

    IF EXISTS (
        SELECT request_id
        FROM public.negotiations
        GROUP BY request_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: multiple negotiations already exist for a request.';
    END IF;
END;
$$;


-- Enforce required references.

ALTER TABLE public.negotiations
    ALTER COLUMN request_id SET NOT NULL,
    ALTER COLUMN cook_id SET NOT NULL;


-- Ensure offer, request and cook belong together.
-- cook_offers already has UNIQUE(id, request_id, cook_id).

ALTER TABLE public.negotiations
    ADD CONSTRAINT negotiations_offer_request_cook_fkey
    FOREIGN KEY (offer_id, request_id, cook_id)
    REFERENCES public.cook_offers (id, request_id, cook_id)
    ON DELETE RESTRICT;


-- Ensure the negotiation customer owns the request.
-- meal_requests already has UNIQUE(id, customer_id).

ALTER TABLE public.negotiations
    ADD CONSTRAINT negotiations_request_customer_fkey
    FOREIGN KEY (request_id, customer_id)
    REFERENCES public.meal_requests (id, customer_id)
    ON DELETE RESTRICT;


-- A request may have only one negotiation permanently.
-- Rejected, withdrawn and expired negotiations still consume
-- the customer's one-counteroffer allowance.

ALTER TABLE public.negotiations
    ADD CONSTRAINT negotiations_one_per_request_unique
    UNIQUE (request_id);


-- ============================================================
-- SECTION 1A: ORDER PRICE RECONCILIATION
-- ============================================================

-- Preserve original item prices in orders.items.
-- Record any negotiated reduction separately at order level.
-- Existing orders are backfilled with no negotiated adjustment.

ALTER TABLE public.orders
    ADD COLUMN original_offer_total numeric(10,2),
    ADD COLUMN negotiated_discount numeric(10,2) NOT NULL DEFAULT 0;

UPDATE public.orders
SET
    original_offer_total = meal_subtotal,
    negotiated_discount = 0
WHERE original_offer_total IS NULL;

ALTER TABLE public.orders
    ALTER COLUMN original_offer_total SET NOT NULL,
    ADD CONSTRAINT orders_original_offer_total_positive_check
        CHECK (original_offer_total > 0),
    ADD CONSTRAINT orders_negotiated_discount_nonnegative_check
        CHECK (negotiated_discount >= 0),
    ADD CONSTRAINT orders_negotiated_pricing_reconciliation_check
        CHECK (original_offer_total - negotiated_discount = meal_subtotal);


-- ============================================================
-- SECTION 2: CUSTOMER COUNTEROFFER RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_customer_counteroffer(
    p_offer_id uuid,
    p_proposed_total numeric,
    p_message text DEFAULT NULL
)
RETURNS TABLE (
    negotiation_id uuid,
    request_id uuid,
    offer_id uuid,
    proposed_total numeric,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_user_id uuid;

    v_request_id uuid;
    v_cook_id uuid;

    v_request_customer_id uuid;
    v_request_status text;

    v_offer_status text;
    v_offer_total numeric;

    v_message text;
    v_negotiation_id uuid;

BEGIN

    -- 1. Authentication.

    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;


    -- 2. Customer authorization.

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = v_user_id
          AND u.role = 'customer'
    ) THEN
        RAISE EXCEPTION 'Customer account required.';
    END IF;


    -- 3. Validate the proposed amount.

    IF p_proposed_total IS NULL
       OR p_proposed_total <= 0
       OR p_proposed_total > 99999999.99
       OR p_proposed_total <> ROUND(p_proposed_total, 2) THEN

        RAISE EXCEPTION 'Invalid counteroffer amount.';

    END IF;


    -- 4. Validate the message.

    v_message := NULLIF(BTRIM(p_message), '');

    IF v_message IS NOT NULL
       AND CHAR_LENGTH(v_message) > 1000 THEN

        RAISE EXCEPTION
            'Counteroffer message cannot exceed 1000 characters.';

    END IF;


    -- 5. Find the request and cook associated with the offer.

    SELECT
        co.request_id,
        co.cook_id
    INTO
        v_request_id,
        v_cook_id
    FROM public.cook_offers co
    WHERE co.id = p_offer_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cook offer not found.';
    END IF;


    -- 6. Lock 1: meal request.

    SELECT
        mr.customer_id,
        mr.status
    INTO
        v_request_customer_id,
        v_request_status
    FROM public.meal_requests mr
    WHERE mr.id = v_request_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meal request not found.';
    END IF;


    IF v_request_customer_id <> v_user_id THEN
        RAISE EXCEPTION
            'You cannot negotiate another customer''s request.';
    END IF;


    IF v_request_status <> 'open' THEN
        RAISE EXCEPTION
            'This meal request is no longer open.';
    END IF;


    -- 7. Lock 2: selected cook offer.

    SELECT
        co.status,
        co.total_price
    INTO
        v_offer_status,
        v_offer_total
    FROM public.cook_offers co
    WHERE co.id = p_offer_id
      AND co.request_id = v_request_id
      AND co.cook_id = v_cook_id
    FOR UPDATE;


    IF NOT FOUND OR v_offer_status <> 'submitted' THEN
        RAISE EXCEPTION
            'This cook offer is no longer available.';
    END IF;


    -- 8. Verify cook approval.

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


    -- 9. A counteroffer must be lower than the original total.

    IF p_proposed_total >= v_offer_total THEN
        RAISE EXCEPTION
            'Counteroffer must be lower than the original offer total.';
    END IF;


    -- 10. Enforce one counteroffer per request.

    -- The request lock serializes concurrent submissions.
    -- The UNIQUE constraint is the database-level backstop.

    IF EXISTS (
        SELECT 1
        FROM public.negotiations n
        WHERE n.request_id = v_request_id
    ) THEN

        RAISE EXCEPTION
            'This meal request has already used its counteroffer.';

    END IF;


    -- 11. Create the counteroffer.

    INSERT INTO public.negotiations (
        offer_id,
        request_id,
        cook_id,
        customer_id,
        proposed_total,
        message,
        status
    )
    VALUES (
        p_offer_id,
        v_request_id,
        v_cook_id,
        v_user_id,
        p_proposed_total,
        v_message,
        'pending'
    )
    RETURNING id INTO v_negotiation_id;


    RETURN QUERY
    SELECT
        v_negotiation_id,
        v_request_id,
        p_offer_id,
        p_proposed_total,
        'pending'::text;

END;

$function$;


-- ============================================================
-- SECTION 3: COOK NEGOTIATION RESPONSE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.respond_to_negotiation(
    p_negotiation_id uuid,
    p_decision text
)
RETURNS TABLE (
    result_status text,
    result_agreed_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_user_id uuid;

    v_request_id uuid;
    v_request_customer_id uuid;
    v_request_status text;

    v_offer_status text;
    v_offer_total numeric;

    v_customer_id uuid;
    v_proposed_total numeric;
    v_negotiation_status text;

    v_agreed_total numeric;

BEGIN

    -- 1. Authentication.

    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;


    -- 2. Validate decision.

    IF p_decision IS NULL
       OR p_decision NOT IN ('accepted', 'rejected') THEN

        RAISE EXCEPTION
            'Decision must be accepted or rejected.';

    END IF;


    -- 3. Confirm approved cook.

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp
            ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN

        RAISE EXCEPTION
            'Approved cook account required.';

    END IF;


    -- 4. Find the request associated with this cook's negotiation.

    SELECT
        n.request_id
    INTO
        v_request_id
    FROM public.negotiations n
    WHERE n.id = p_negotiation_id
      AND n.cook_id = v_user_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Negotiation not found for this cook.';
    END IF;


    -- 5. Lock 1: meal request.

    SELECT
        mr.customer_id,
        mr.status
    INTO
        v_request_customer_id,
        v_request_status
    FROM public.meal_requests mr
    WHERE mr.id = v_request_id
    FOR UPDATE;


    IF NOT FOUND OR v_request_status <> 'open' THEN
        RAISE EXCEPTION
            'This meal request is no longer open.';
    END IF;


    -- 6. Lock 2: cook offer.

    SELECT
        co.status,
        co.total_price
    INTO
        v_offer_status,
        v_offer_total
    FROM public.cook_offers co
    WHERE co.id = (
        SELECT n.offer_id
        FROM public.negotiations n
        WHERE n.id = p_negotiation_id
          AND n.request_id = v_request_id
          AND n.cook_id = v_user_id
    )
      AND co.request_id = v_request_id
      AND co.cook_id = v_user_id
    FOR UPDATE;


    IF NOT FOUND OR v_offer_status <> 'submitted' THEN
        RAISE EXCEPTION
            'This cook offer is no longer available.';
    END IF;


    -- 7. Lock 3: negotiation.

    SELECT
        n.customer_id,
        n.proposed_total,
        n.status
    INTO
        v_customer_id,
        v_proposed_total,
        v_negotiation_status
    FROM public.negotiations n
    WHERE n.id = p_negotiation_id
      AND n.request_id = v_request_id
      AND n.cook_id = v_user_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negotiation not found.';
    END IF;


    IF v_negotiation_status <> 'pending' THEN
        RAISE EXCEPTION
            'This negotiation has already been answered.';
    END IF;


    -- 8. Confirm customer ownership.

    IF v_customer_id <> v_request_customer_id THEN
        RAISE EXCEPTION
            'Negotiation customer does not own this request.';
    END IF;


    -- 9. Revalidate negotiated amount.

    IF v_proposed_total IS NULL
       OR v_proposed_total <= 0
       OR v_proposed_total >= v_offer_total THEN

        RAISE EXCEPTION
            'Negotiated amount is no longer valid.';

    END IF;


    -- 10. Calculate agreed amount.

    IF p_decision = 'accepted' THEN
        v_agreed_total := v_proposed_total;
    ELSE
        v_agreed_total := NULL;
    END IF;


    -- 11. Update only a pending negotiation.

    UPDATE public.negotiations
    SET
        status = p_decision,
        agreed_total = v_agreed_total,
        responded_at = clock_timestamp()
    WHERE id = p_negotiation_id
      AND status = 'pending';


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Negotiation response could not be saved.';
    END IF;


    RETURN QUERY
    SELECT
        p_decision,
        v_agreed_total;

END;

$function$;


-- ============================================================
-- SECTION 4: ORDER RESERVATION RPC
-- ============================================================

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
        -- remains for this request. Keep the in-memory status aligned
        -- with the database update so Section H rejects the request
        -- if it could not safely be reopened.

        IF v_request_status = 'offer_selected'
           AND NOT EXISTS (
               SELECT 1
               FROM public.orders o
               WHERE o.meal_request_id = v_request_id
                 AND o.status = 'pending'
                 AND o.payment_status = 'pending'
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


-- ============================================================
-- SECTION 5: RESERVATION EXPIRY RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_order_reservation(
    p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$

DECLARE
    v_request_id uuid;
    v_request_status text;

    v_order_status text;
    v_payment_status text;
    v_expires_at timestamptz;

BEGIN

    -- 1. Find request. No row lock yet.

    SELECT o.meal_request_id
    INTO v_request_id
    FROM public.orders o
    WHERE o.id = p_order_id;


    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;


    -- 2. Lock 1: meal request.

    SELECT mr.status
    INTO v_request_status
    FROM public.meal_requests mr
    WHERE mr.id = v_request_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;


    -- 3. Lock 2: order.

    SELECT
        o.status,
        o.payment_status,
        o.reservation_expires_at
    INTO
        v_order_status,
        v_payment_status,
        v_expires_at
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.meal_request_id = v_request_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;


    -- 4. Only expire a pending unpaid reservation
    -- whose non-null expiration deadline has passed.

    IF v_order_status <> 'pending'
       OR v_payment_status <> 'pending'
       OR v_expires_at IS NULL
       OR v_expires_at > clock_timestamp() THEN

        RETURN FALSE;

    END IF;


    -- 5. Cancel the expired reservation.

    UPDATE public.orders
    SET
        status = 'cancelled',
        payment_status = 'expired'
    WHERE id = p_order_id
      AND meal_request_id = v_request_id
      AND status = 'pending'
      AND payment_status = 'pending'
      AND reservation_expires_at <= clock_timestamp();


    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;


    -- 6. Reopen only if no active unpaid reservation remains.

    IF v_request_status = 'offer_selected'
       AND NOT EXISTS (
           SELECT 1
           FROM public.orders o
           WHERE o.meal_request_id = v_request_id
             AND o.status = 'pending'
             AND o.payment_status = 'pending'
       ) THEN

        UPDATE public.meal_requests
        SET status = 'open'
        WHERE id = v_request_id
          AND status = 'offer_selected';

    END IF;


    RETURN TRUE;

END;

$function$;


-- ============================================================
-- SECTION 6: NEGOTIATION TABLE PERMISSIONS
-- ============================================================

-- Remove the old direct customer INSERT policy.

DROP POLICY IF EXISTS
    "negotiations customer insert"
ON public.negotiations;


-- Customer counteroffers must use the controlled RPC.

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.negotiations
FROM PUBLIC, anon, authenticated, service_role;


-- Preserve authenticated reads and the existing read policy.

GRANT SELECT ON TABLE public.negotiations
TO authenticated;


-- No UPDATE or DELETE permissions are introduced.


-- ============================================================
-- SECTION 7: FUNCTION OWNERSHIP AND EXECUTION PERMISSIONS
-- ============================================================

ALTER FUNCTION public.create_customer_counteroffer(
    uuid,
    numeric,
    text
) OWNER TO postgres;


ALTER FUNCTION public.respond_to_negotiation(
    uuid,
    text
) OWNER TO postgres;


ALTER FUNCTION public.create_order_reservation(
    uuid
) OWNER TO postgres;


ALTER FUNCTION public.expire_order_reservation(
    uuid
) OWNER TO postgres;


-- Revoke all existing execution permissions.

REVOKE ALL ON FUNCTION
    public.create_customer_counteroffer(uuid, numeric, text)
FROM PUBLIC, anon, authenticated, service_role;


REVOKE ALL ON FUNCTION
    public.respond_to_negotiation(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;


REVOKE ALL ON FUNCTION
    public.create_order_reservation(uuid)
FROM PUBLIC, anon, authenticated, service_role;


REVOKE ALL ON FUNCTION
    public.expire_order_reservation(uuid)
FROM PUBLIC, anon, authenticated, service_role;


-- Grant only intended execution permissions.

GRANT EXECUTE ON FUNCTION
    public.create_customer_counteroffer(uuid, numeric, text)
TO authenticated;


GRANT EXECUTE ON FUNCTION
    public.respond_to_negotiation(uuid, text)
TO authenticated;


GRANT EXECUTE ON FUNCTION
    public.create_order_reservation(uuid)
TO authenticated;


GRANT EXECUTE ON FUNCTION
    public.expire_order_reservation(uuid)
TO service_role;


COMMIT;


-- ============================================================
-- END OF MIGRATION
-- ============================================================
