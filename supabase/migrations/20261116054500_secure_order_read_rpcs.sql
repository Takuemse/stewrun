BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_orders()
RETURNS TABLE (
    id uuid,
    total numeric,
    status text,
    payment_status text,
    hub text,
    pickup_date date,
    pickup_time text,
    reservation_expires_at timestamptz
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
        o.reservation_expires_at
    FROM public.orders AS o
    WHERE o.customer_id = v_user_id
    ORDER BY o.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_order(
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
    reservation_expires_at timestamptz
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
        o.reservation_expires_at
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.customer_id = v_user_id;
END;
$function$;

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
        JOIN public.cook_profiles AS cp
          ON cp.user_id = u.id
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
      AND o.payment_status = 'paid'
      AND o.status IN ('confirmed', 'ready', 'collected')
    ORDER BY o.created_at DESC;
END;
$function$;

ALTER FUNCTION public.get_customer_orders()
    OWNER TO postgres;

ALTER FUNCTION public.get_customer_order(uuid)
    OWNER TO postgres;

ALTER FUNCTION public.get_cook_orders()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_customer_orders()
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_customer_order(uuid)
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_cook_orders()
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_customer_orders()
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_customer_order(uuid)
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_cook_orders()
    TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.orders
    FROM PUBLIC, anon, authenticated;

REVOKE SELECT (
    id,
    customer_id,
    items,
    total,
    hub,
    pickup_time,
    status,
    payment_status,
    pickup_code,
    created_at,
    collected_at,
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
    paid_at,
    payment_provider,
    payment_reference
)
ON TABLE public.orders
FROM PUBLIC, anon, authenticated;

COMMIT;
