
BEGIN;

DROP FUNCTION public.get_customer_orders();
DROP FUNCTION public.get_customer_order(uuid);

CREATE FUNCTION public.get_customer_orders()
RETURNS TABLE (
    id uuid,
    total numeric,
    meal_subtotal numeric,
    original_offer_total numeric,
    negotiated_discount numeric,
    platform_fee numeric,
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
        o.meal_subtotal,
        o.original_offer_total,
        o.negotiated_discount,
        o.platform_fee,
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
    meal_subtotal numeric,
    original_offer_total numeric,
    negotiated_discount numeric,
    platform_fee numeric,
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
        o.meal_subtotal,
        o.original_offer_total,
        o.negotiated_discount,
        o.platform_fee,
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

COMMIT;
