BEGIN;

CREATE FUNCTION public.cancel_customer_meal_request(
    p_request_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
    v_status text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = v_user_id
          AND u.role = 'customer'
    ) THEN
        RAISE EXCEPTION 'Customer account required.';
    END IF;

    SELECT request.status
    INTO v_status
    FROM public.meal_requests AS request
    WHERE request.id = p_request_id
      AND request.customer_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meal request not found.';
    END IF;

    IF v_status = 'cancelled' THEN
        RETURN 'already_cancelled';
    END IF;

    IF v_status <> 'open' THEN
        RETURN 'not_cancellable';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.orders AS order_row
        WHERE order_row.meal_request_id = p_request_id
          AND order_row.status IN ('confirmed', 'ready', 'collected')
    ) THEN
        RETURN 'not_cancellable';
    END IF;

    UPDATE public.meal_requests
    SET status = 'cancelled'
    WHERE id = p_request_id
      AND customer_id = v_user_id
      AND status = 'open';

    IF NOT FOUND THEN
        RETURN 'not_cancellable';
    END IF;

    RETURN 'cancelled';
END;
$function$;

ALTER FUNCTION public.cancel_customer_meal_request(uuid)
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.cancel_customer_meal_request(uuid)
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.cancel_customer_meal_request(uuid)
    TO authenticated;

CREATE FUNCTION public.notify_cooks_of_cancelled_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF OLD.status <> 'open' OR NEW.status <> 'cancelled' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notifications (
        recipient_id,
        event_key,
        title,
        message,
        href
    )
    SELECT DISTINCT
        offer.cook_id,
        'request:' || NEW.id::text || ':cancelled',
        'Meal request cancelled',
        'A customer cancelled a meal request you responded to.',
        '/cook'
    FROM public.cook_offers AS offer
    WHERE offer.request_id = NEW.id
      AND offer.status = 'submitted'
    ON CONFLICT (recipient_id, event_key) DO NOTHING;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.notify_cooks_of_cancelled_request()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.notify_cooks_of_cancelled_request()
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER notify_cooks_of_cancelled_request_trigger
AFTER UPDATE OF status ON public.meal_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_cooks_of_cancelled_request();

COMMIT;
