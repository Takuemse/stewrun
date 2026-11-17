BEGIN;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS cash_payment_status text;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_cash_payment_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_cash_payment_status_check
    CHECK (
        (
            cash_payment_status IS NULL
            AND payment_provider IS DISTINCT FROM 'cash'
        )
        OR (
            payment_provider = 'cash'
            AND (
                (
                    cash_payment_status = 'due'
                    AND payment_status = 'pending'
                )
                OR (
                    cash_payment_status = 'paid'
                    AND payment_status = 'paid'
                    AND paid_at IS NOT NULL
                )
            )
        )
    );

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_paid_reservation_metadata_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_paid_reservation_metadata_check
    CHECK (
        meal_request_id IS NULL
        OR payment_status <> 'paid'
        OR (
            paid_at IS NOT NULL
            AND payment_provider IS NOT NULL
            AND btrim(payment_provider) <> ''
            AND (
                (
                    payment_provider = 'cash'
                    AND cash_payment_status = 'paid'
                    AND payment_reference IS NULL
                )
                OR (
                    payment_provider <> 'cash'
                    AND payment_reference IS NOT NULL
                    AND btrim(payment_reference) <> ''
                )
            )
        )
    );

CREATE OR REPLACE FUNCTION public.create_cash_order(
    p_offer_id uuid
)
RETURNS TABLE (
    order_id uuid,
    amount_due numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid;
    v_existing_order_id uuid;
    v_order_id uuid;
    v_amount_due numeric;
    v_pickup_code text;
    v_updated_rows integer := 0;
    v_attempt integer;
BEGIN
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = v_user_id
          AND u.role = 'customer'
    ) THEN
        RAISE EXCEPTION 'Customer account required';
    END IF;

    SELECT o.id, o.total
    INTO v_existing_order_id, v_amount_due
    FROM public.orders AS o
    WHERE o.offer_id = p_offer_id
      AND o.customer_id = v_user_id
      AND o.payment_provider = 'cash'
      AND o.status IN ('confirmed', 'ready', 'collected')
    FOR UPDATE;

    IF FOUND THEN
        RETURN QUERY
        SELECT v_existing_order_id, v_amount_due;
        RETURN;
    END IF;

    SELECT reservation.order_id, reservation.amount_due
    INTO v_order_id, v_amount_due
    FROM public.create_order_reservation(p_offer_id) AS reservation;

    FOR v_attempt IN 1..10 LOOP
        v_pickup_code := pg_catalog.upper(
            pg_catalog.substr(
                pg_catalog.replace(
                    pg_catalog.gen_random_uuid()::text,
                    '-',
                    ''
                ),
                1,
                10
            )
        );

        BEGIN
            UPDATE public.orders AS o
            SET
                status = 'confirmed',
                payment_provider = 'cash',
                cash_payment_status = 'due',
                pickup_code = v_pickup_code
            WHERE o.id = v_order_id
              AND o.customer_id = v_user_id
              AND o.status = 'pending'
              AND o.payment_status = 'pending'
              AND o.reservation_expires_at > pg_catalog.clock_timestamp();

            GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
        EXCEPTION
            WHEN unique_violation THEN
                v_updated_rows := 0;
                IF v_attempt = 10 THEN
                    RAISE;
                END IF;
        END;

        EXIT WHEN v_updated_rows = 1;
    END LOOP;

    IF v_updated_rows <> 1 THEN
        RAISE EXCEPTION 'Cash order could not be confirmed';
    END IF;

    RETURN QUERY
    SELECT v_order_id, v_amount_due;
END;
$function$;

ALTER FUNCTION public.create_cash_order(uuid)
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_cash_order(uuid)
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_cash_order(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_order_ready(
    p_order_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_meal_request_id uuid;
    v_order public.orders%ROWTYPE;
BEGIN
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        JOIN public.cook_profiles AS cp ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Approved cook account required';
    END IF;

    SELECT o.meal_request_id
    INTO v_meal_request_id
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.cook_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    PERFORM 1
    FROM public.meal_requests AS mr
    WHERE mr.id = v_meal_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated meal request not found';
    END IF;

    SELECT o.*
    INTO v_order
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.meal_request_id = v_meal_request_id
      AND o.cook_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    IF v_order.payment_status IS DISTINCT FROM 'paid'
       AND NOT (
           v_order.payment_provider = 'cash'
           AND v_order.cash_payment_status = 'due'
           AND v_order.payment_status = 'pending'
       ) THEN
        RAISE EXCEPTION 'Order payment has not been confirmed';
    END IF;

    IF v_order.pickup_code IS NULL
       OR v_order.pickup_code = '' THEN
        RAISE EXCEPTION 'Order pickup code is missing';
    END IF;

    IF v_order.status = 'ready' THEN
        RETURN 'already_ready';
    END IF;

    IF v_order.status IS DISTINCT FROM 'confirmed' THEN
        RAISE EXCEPTION 'Order is not eligible to be marked ready';
    END IF;

    UPDATE public.orders AS o
    SET status = 'ready'
    WHERE o.id = v_order.id
      AND o.cook_id = v_user_id
      AND o.status = 'confirmed'
      AND (
          o.payment_status = 'paid'
          OR (
              o.payment_provider = 'cash'
              AND o.cash_payment_status = 'due'
              AND o.payment_status = 'pending'
          )
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order could not be marked ready';
    END IF;

    RETURN 'order_marked_ready';
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_order_collection(
    p_order_id uuid,
    p_pickup_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_meal_request_id uuid;
    v_order public.orders%ROWTYPE;
    v_now timestamptz;
    v_cash_order boolean;
BEGIN
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        JOIN public.cook_profiles AS cp ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Approved cook account required';
    END IF;

    IF p_pickup_code IS NULL
       OR pg_catalog.btrim(p_pickup_code) = '' THEN
        RAISE EXCEPTION 'Pickup code is required';
    END IF;

    SELECT o.meal_request_id
    INTO v_meal_request_id
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.cook_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    PERFORM 1
    FROM public.meal_requests AS mr
    WHERE mr.id = v_meal_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated meal request not found';
    END IF;

    SELECT o.*
    INTO v_order
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.meal_request_id = v_meal_request_id
      AND o.cook_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    v_cash_order :=
        v_order.payment_provider = 'cash'
        AND v_order.cash_payment_status = 'due'
        AND v_order.payment_status = 'pending';

    IF v_order.payment_status IS DISTINCT FROM 'paid'
       AND NOT v_cash_order THEN
        RAISE EXCEPTION 'Order payment has not been confirmed';
    END IF;

    IF pg_catalog.upper(pg_catalog.btrim(p_pickup_code))
       IS DISTINCT FROM v_order.pickup_code THEN
        RAISE EXCEPTION 'Invalid pickup code';
    END IF;

    IF v_order.status = 'collected'
       AND v_order.collected_at IS NOT NULL THEN
        RETURN 'already_collected';
    END IF;

    IF v_order.status IS DISTINCT FROM 'ready' THEN
        RAISE EXCEPTION 'Order is not ready for collection';
    END IF;

    v_now := pg_catalog.clock_timestamp();

    UPDATE public.orders AS o
    SET
        status = 'collected',
        collected_at = v_now,
        payment_status = CASE
            WHEN v_cash_order THEN 'paid'
            ELSE o.payment_status
        END,
        cash_payment_status = CASE
            WHEN v_cash_order THEN 'paid'
            ELSE o.cash_payment_status
        END,
        paid_at = CASE
            WHEN v_cash_order THEN v_now
            ELSE o.paid_at
        END
    WHERE o.id = v_order.id
      AND o.cook_id = v_user_id
      AND o.status = 'ready'
      AND o.collected_at IS NULL
      AND (
          o.payment_status = 'paid'
          OR (
              o.payment_provider = 'cash'
              AND o.cash_payment_status = 'due'
              AND o.payment_status = 'pending'
          )
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order collection could not be confirmed';
    END IF;

    RETURN 'order_collected';
END;
$function$;

ALTER FUNCTION public.mark_order_ready(uuid)
    OWNER TO postgres;

ALTER FUNCTION public.confirm_order_collection(uuid, text)
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.mark_order_ready(uuid)
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.confirm_order_collection(uuid, text)
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mark_order_ready(uuid)
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_order_collection(uuid, text)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.get_cook_orders()
RETURNS TABLE (
    id uuid,
    items jsonb,
    status text,
    payment_status text,
    hub text,
    pickup_date date,
    pickup_time text,
    meal_subtotal numeric,
    created_at timestamptz,
    collected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        JOIN public.cook_profiles AS cp ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Approved cook account required';
    END IF;

    RETURN QUERY
    SELECT
        o.id,
        o.items,
        o.status,
        o.payment_status,
        o.hub,
        o.pickup_date,
        o.pickup_time,
        o.meal_subtotal,
        o.created_at,
        o.collected_at
    FROM public.orders AS o
    WHERE o.cook_id = v_user_id
      AND (
          o.payment_status = 'paid'
          OR (
              o.payment_provider = 'cash'
              AND o.cash_payment_status = 'due'
              AND o.payment_status = 'pending'
          )
      )
      AND o.status IN ('confirmed', 'ready', 'collected')
    ORDER BY o.created_at DESC;
END;
$function$;

ALTER FUNCTION public.get_cook_orders()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_cook_orders()
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_cook_orders()
    TO authenticated;

DROP FUNCTION public.get_customer_orders();
DROP FUNCTION public.get_customer_order(uuid);

CREATE FUNCTION public.get_customer_orders()
RETURNS TABLE (
    id uuid,
    total numeric,
    status text,
    payment_status text,
    hub text,
    pickup_date date,
    pickup_time text,
    reservation_expires_at timestamptz,
    pickup_code text,
    cash_payment_status text,
    items jsonb,
    cook_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = v_user_id
          AND u.role = 'customer'
    ) THEN
        RAISE EXCEPTION 'Customer account required';
    END IF;

    RETURN QUERY
    SELECT
        o.id,
        o.total,
        o.status,
        o.payment_status,
        o.hub,
        o.pickup_date,
        o.pickup_time,
        CASE
            WHEN o.payment_provider = 'cash' THEN NULL::timestamptz
            ELSE o.reservation_expires_at
        END,
        CASE
            WHEN o.status = 'ready'
             AND (
                 o.payment_status = 'paid'
                 OR (
                     o.payment_provider = 'cash'
                     AND o.cash_payment_status = 'due'
                 )
             )
                THEN o.pickup_code
            ELSE NULL::text
        END,
        CASE
            WHEN o.payment_provider = 'cash'
                THEN o.cash_payment_status
            ELSE NULL::text
        END,
        o.items,
        cp.display_name
    FROM public.orders AS o
    LEFT JOIN public.cook_profiles AS cp
      ON cp.user_id = o.cook_id
    WHERE o.customer_id = v_user_id
    ORDER BY o.created_at DESC;
END;
$function$;

CREATE FUNCTION public.get_customer_order(
    p_order_id uuid
)
RETURNS TABLE (
    id uuid,
    total numeric,
    status text,
    payment_status text,
    hub text,
    pickup_date date,
    pickup_time text,
    reservation_expires_at timestamptz,
    pickup_code text,
    cash_payment_status text,
    items jsonb,
    cook_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = v_user_id
          AND u.role = 'customer'
    ) THEN
        RAISE EXCEPTION 'Customer account required';
    END IF;

    RETURN QUERY
    SELECT
        o.id,
        o.total,
        o.status,
        o.payment_status,
        o.hub,
        o.pickup_date,
        o.pickup_time,
        CASE
            WHEN o.payment_provider = 'cash' THEN NULL::timestamptz
            ELSE o.reservation_expires_at
        END,
        CASE
            WHEN o.status = 'ready'
             AND (
                 o.payment_status = 'paid'
                 OR (
                     o.payment_provider = 'cash'
                     AND o.cash_payment_status = 'due'
                 )
             )
                THEN o.pickup_code
            ELSE NULL::text
        END,
        CASE
            WHEN o.payment_provider = 'cash'
                THEN o.cash_payment_status
            ELSE NULL::text
        END,
        o.items,
        cp.display_name
    FROM public.orders AS o
    LEFT JOIN public.cook_profiles AS cp
      ON cp.user_id = o.cook_id
    WHERE o.id = p_order_id
      AND o.customer_id = v_user_id;
END;
$function$;

ALTER FUNCTION public.get_customer_orders()
    OWNER TO postgres;

ALTER FUNCTION public.get_customer_order(uuid)
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_customer_orders()
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_customer_order(uuid)
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_customer_orders()
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_customer_order(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_ecocash_for_cash_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF NEW.provider = 'ecocash'
       AND EXISTS (
           SELECT 1
           FROM public.orders AS o
           WHERE o.id = NEW.order_id
             AND o.payment_provider = 'cash'
       ) THEN
        RAISE EXCEPTION 'Online payment is disabled for cash orders';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_ecocash_for_cash_orders()
    FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS prevent_ecocash_for_cash_orders_trigger
ON public.payment_transactions;

CREATE TRIGGER prevent_ecocash_for_cash_orders_trigger
BEFORE INSERT ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_ecocash_for_cash_orders();

COMMIT;
