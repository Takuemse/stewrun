
-- StewRun: Secure cook order status transitions.
-- Only approved, assigned cooks can mark paid orders ready
-- or confirm collection using the order's pickup code.

BEGIN;

-- ============================================================
-- 1. MARK ORDER READY
-- ============================================================

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
    v_now timestamptz;
BEGIN
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

    -- Find the associated request before acquiring locks.
    SELECT o.meal_request_id
    INTO v_meal_request_id
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.cook_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    -- Preserve the established lock order.
    PERFORM 1
    FROM public.meal_requests mr
    WHERE mr.id = v_meal_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated meal request not found';
    END IF;

    SELECT o.*
    INTO v_order
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.meal_request_id = v_meal_request_id
      AND o.cook_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
        RAISE EXCEPTION 'Order payment has not been confirmed';
    END IF;

    IF v_order.pickup_code IS NULL
       OR v_order.pickup_code = '' THEN
        RAISE EXCEPTION 'Order pickup code is missing';
    END IF;

    -- Idempotent response for an already-ready order.
    IF v_order.status = 'ready' THEN
        RETURN 'already_ready';
    END IF;

    IF v_order.status IS DISTINCT FROM 'confirmed' THEN
        RAISE EXCEPTION 'Order is not eligible to be marked ready';
    END IF;

    v_now := pg_catalog.clock_timestamp();

    UPDATE public.orders
    SET status = 'ready'
    WHERE id = v_order.id
      AND cook_id = v_user_id
      AND status = 'confirmed'
      AND payment_status = 'paid';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order could not be marked ready';
    END IF;

    RETURN 'order_marked_ready';
END;
$function$;


-- ============================================================
-- 2. CONFIRM ORDER COLLECTION
-- ============================================================

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
BEGIN
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

    IF p_pickup_code IS NULL
       OR pg_catalog.btrim(p_pickup_code) = '' THEN
        RAISE EXCEPTION 'Pickup code is required';
    END IF;

    -- Find the associated request before acquiring locks.
    SELECT o.meal_request_id
    INTO v_meal_request_id
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.cook_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    -- Preserve the established lock order.
    PERFORM 1
    FROM public.meal_requests mr
    WHERE mr.id = v_meal_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated meal request not found';
    END IF;

    SELECT o.*
    INTO v_order
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.meal_request_id = v_meal_request_id
      AND o.cook_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned order not found';
    END IF;

    IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
        RAISE EXCEPTION 'Order payment has not been confirmed';
    END IF;

    IF pg_catalog.upper(pg_catalog.btrim(p_pickup_code))
       IS DISTINCT FROM v_order.pickup_code THEN
        RAISE EXCEPTION 'Invalid pickup code';
    END IF;

    -- Idempotent response for an already-collected order.
    IF v_order.status = 'collected'
       AND v_order.collected_at IS NOT NULL THEN
        RETURN 'already_collected';
    END IF;

    IF v_order.status IS DISTINCT FROM 'ready' THEN
        RAISE EXCEPTION 'Order is not ready for collection';
    END IF;

    v_now := pg_catalog.clock_timestamp();

    UPDATE public.orders
    SET
        status = 'collected',
        collected_at = v_now
    WHERE id = v_order.id
      AND cook_id = v_user_id
      AND status = 'ready'
      AND payment_status = 'paid'
      AND collected_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order collection could not be confirmed';
    END IF;

    RETURN 'order_collected';
END;
$function$;


-- ============================================================
-- 3. RESTRICT FUNCTION EXECUTION PERMISSIONS
-- ============================================================

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

COMMIT;
