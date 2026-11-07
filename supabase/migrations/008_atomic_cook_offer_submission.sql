BEGIN;

-- =========================================================
-- 008. ATOMIC COOK OFFER CREATION AND SUBMISSION
--
-- Creates a complete offer and submits it in one transaction.
-- Existing submit_cook_offer(uuid) remains the authority for
-- final offer validation, total calculation and submission.
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_and_submit_cook_offer(
    p_request_id uuid,
    p_message text,
    p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid;
    v_request_status text;
    v_offers_close_at timestamptz;

    v_item jsonb;
    v_menu_item_id uuid;
    v_name text;
    v_description text;
    v_menu_available boolean;

    v_quantity_numeric numeric;
    v_quantity integer;
    v_unit_price numeric;

    v_item_count integer := 0;
    v_estimated_total numeric := 0;
    v_total numeric(12,2);

    v_offer_id uuid;
    v_message text;
BEGIN
    -- -----------------------------------------------------
    -- 1. Authenticate and verify the approved cook.
    -- -----------------------------------------------------

    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp
            ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Approved cook account required';
    END IF;

    -- -----------------------------------------------------
    -- 2. Validate the request and optional message.
    -- -----------------------------------------------------

    IF p_request_id IS NULL THEN
        RAISE EXCEPTION 'A meal request is required';
    END IF;

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'Offer items must be an array';
    END IF;

    v_item_count := jsonb_array_length(p_items);

    IF v_item_count < 1 OR v_item_count > 20 THEN
        RAISE EXCEPTION
            'An offer must contain between 1 and 20 items';
    END IF;

    v_item_count := 0;

    v_message := NULLIF(trim(COALESCE(p_message, '')), '');

    IF v_message IS NOT NULL
       AND length(v_message) > 1000 THEN
        RAISE EXCEPTION
            'Offer message cannot exceed 1000 characters';
    END IF;

    -- -----------------------------------------------------
    -- 3. Lock the request before creating the offer.
    -- This follows the existing submission lock order.
    -- -----------------------------------------------------

    SELECT mr.status, mr.offers_close_at
    INTO v_request_status, v_offers_close_at
    FROM public.meal_requests mr
    WHERE mr.id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meal request not found';
    END IF;

    IF v_request_status <> 'open' THEN
        RAISE EXCEPTION
            'This meal request is no longer open';
    END IF;

    IF v_offers_close_at IS NOT NULL
       AND v_offers_close_at <= clock_timestamp() THEN
        RAISE EXCEPTION
            'The offer submission deadline has passed';
    END IF;

    -- -----------------------------------------------------
    -- 4. Prevent a second offer from the same cook.
    -- The unique database constraint remains the final guard.
    -- -----------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.request_id = p_request_id
          AND co.cook_id = v_user_id
    ) THEN
        RAISE EXCEPTION
            'You have already created an offer for this request';
    END IF;

    -- -----------------------------------------------------
    -- 5. Validate every item and calculate an upper bound.
    -- No client-supplied total or line_total is trusted.
    -- -----------------------------------------------------

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP
        IF jsonb_typeof(v_item) <> 'object' THEN
            RAISE EXCEPTION
                'Each offer item must be an object';
        END IF;

        -- Quantity must be a JSON number, a whole number,
        -- and between 1 and 20.
        IF jsonb_typeof(v_item -> 'quantity') <> 'number' THEN
            RAISE EXCEPTION
                'Each item requires a numeric quantity';
        END IF;

        BEGIN
            v_quantity_numeric :=
                (v_item ->> 'quantity')::numeric;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid item quantity';
        END;

        IF v_quantity_numeric < 1
           OR v_quantity_numeric > 20
           OR v_quantity_numeric <> trunc(v_quantity_numeric) THEN
            RAISE EXCEPTION
                'Item quantities must be whole numbers between 1 and 20';
        END IF;

        v_quantity := v_quantity_numeric::integer;

        -- Cook-defined price per plate.
        IF jsonb_typeof(v_item -> 'unit_price') <> 'number' THEN
            RAISE EXCEPTION
                'Each item requires a numeric unit price';
        END IF;

        BEGIN
            v_unit_price :=
                (v_item ->> 'unit_price')::numeric;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid item unit price';
        END;

        IF v_unit_price <= 0
           OR v_unit_price > 99999999.99
           OR v_unit_price <> round(v_unit_price, 2) THEN
            RAISE EXCEPTION
                'Unit prices must be positive and have no more than two decimal places';
        END IF;

        -- An existing menu item is an optional reference.
        -- Its name and description come from the database,
        -- not from the client.
        v_menu_item_id := NULLIF(
            v_item ->> 'menu_item_id',
            ''
        )::uuid;

        IF v_menu_item_id IS NOT NULL THEN

            SELECT
                mi.name,
                mi.description,
                mi.available
            INTO
                v_name,
                v_description,
                v_menu_available
            FROM public.menu_items mi
            WHERE mi.id = v_menu_item_id
              AND mi.cook_id = v_user_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'A selected menu item does not belong to your account';
            END IF;

            IF v_menu_available IS DISTINCT FROM true THEN
                RAISE EXCEPTION
                    'A selected menu item is no longer available';
            END IF;

        ELSE
            -- Custom meals require their own name.
            IF jsonb_typeof(v_item -> 'name') <> 'string' THEN
                RAISE EXCEPTION
                    'Custom meals require a name';
            END IF;

            v_name := trim(v_item ->> 'name');

            IF length(v_name) < 2
               OR length(v_name) > 150 THEN
                RAISE EXCEPTION
                    'Meal names must contain between 2 and 150 characters';
            END IF;

            -- Description is optional.
            IF v_item ? 'description'
               AND jsonb_typeof(v_item -> 'description')
                   NOT IN ('string', 'null') THEN
                RAISE EXCEPTION
                    'Meal descriptions must be text';
            END IF;

            v_description := NULLIF(
                trim(v_item ->> 'description'),
                ''
            );

            IF v_description IS NOT NULL
               AND length(v_description) > 500 THEN
                RAISE EXCEPTION
                    'Meal descriptions cannot exceed 500 characters';
            END IF;
        END IF;

        v_estimated_total :=
            v_estimated_total + (v_quantity * v_unit_price);

        IF v_estimated_total > 99999999.99 THEN
            RAISE EXCEPTION
                'The offer total exceeds the permitted amount';
        END IF;

        v_item_count := v_item_count + 1;
    END LOOP;

    -- -----------------------------------------------------
    -- 6. Create the draft offer.
    -- -----------------------------------------------------

    INSERT INTO public.cook_offers (
        request_id,
        cook_id,
        message,
        total_price,
        status
    )
    VALUES (
        p_request_id,
        v_user_id,
        v_message,
        0,
        'draft'
    )
    RETURNING id INTO v_offer_id;

    -- -----------------------------------------------------
    -- 7. Insert all offer items.
    -- line_total is generated by PostgreSQL.
    -- -----------------------------------------------------

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := NULLIF(
            v_item ->> 'menu_item_id',
            ''
        )::uuid;

        v_quantity := (v_item ->> 'quantity')::integer;
        v_unit_price := (v_item ->> 'unit_price')::numeric;

        IF v_menu_item_id IS NOT NULL THEN
            SELECT mi.name, mi.description
            INTO v_name, v_description
            FROM public.menu_items mi
            WHERE mi.id = v_menu_item_id
              AND mi.cook_id = v_user_id;
        ELSE
            v_name := trim(v_item ->> 'name');
            v_description := NULLIF(
                trim(v_item ->> 'description'),
                ''
            );
        END IF;

        INSERT INTO public.cook_offer_items (
            offer_id,
            menu_item_id,
            name,
            description,
            quantity,
            unit_price
        )
        VALUES (
            v_offer_id,
            v_menu_item_id,
            v_name,
            v_description,
            v_quantity,
            v_unit_price
        );
    END LOOP;

    -- -----------------------------------------------------
    -- 8. Submit through the existing hardened function.
    -- It recalculates the total and checks the deadline
    -- again while holding the required locks.
    -- -----------------------------------------------------

    v_total := public.submit_cook_offer(v_offer_id);

    -- -----------------------------------------------------
    -- 9. Return the result.
    -- Any failure above rolls back the entire operation.
    -- -----------------------------------------------------

    RETURN jsonb_build_object(
        'offer_id', v_offer_id,
        'request_id', p_request_id,
        'status', 'submitted',
        'total_price', v_total
    );
END;
$function$;


-- Only authenticated users may call this function.
REVOKE ALL
ON FUNCTION public.create_and_submit_cook_offer(uuid, text, jsonb)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.create_and_submit_cook_offer(uuid, text, jsonb)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.create_and_submit_cook_offer(uuid, text, jsonb)
TO authenticated;

COMMIT;