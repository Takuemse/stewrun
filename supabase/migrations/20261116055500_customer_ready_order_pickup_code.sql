BEGIN;

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
    pickup_code text
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
        o.reservation_expires_at,
        CASE
            WHEN o.payment_status = 'paid'
             AND o.status = 'ready'
                THEN o.pickup_code
            ELSE NULL::text
        END
    FROM public.orders AS o
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
    pickup_code text
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
        o.reservation_expires_at,
        CASE
            WHEN o.payment_status = 'paid'
             AND o.status = 'ready'
                THEN o.pickup_code
            ELSE NULL::text
        END
    FROM public.orders AS o
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
