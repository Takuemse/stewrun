BEGIN;

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    recipient_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,
    event_key text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    href text NOT NULL
        CHECK (href LIKE '/%' AND href NOT LIKE '//%'),
    created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    read_at timestamptz,
    CONSTRAINT notifications_recipient_event_key
        UNIQUE (recipient_id, event_key)
);

CREATE INDEX notifications_recipient_created_idx
ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX notifications_unread_recipient_idx
ON public.notifications (recipient_id, created_at DESC)
WHERE read_at IS NULL;

ALTER TABLE public.negotiations
    ADD COLUMN IF NOT EXISTS response_message text;

ALTER TABLE public.negotiations
    DROP CONSTRAINT IF EXISTS negotiations_response_message_length_check;

ALTER TABLE public.negotiations
    ADD CONSTRAINT negotiations_response_message_length_check
    CHECK (
        response_message IS NULL
        OR char_length(response_message) <= 500
    );

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications read own"
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_id = (SELECT auth.uid()));

CREATE POLICY "notifications mark own read"
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_id = (SELECT auth.uid()))
WITH CHECK (recipient_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.notifications
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;

CREATE FUNCTION public.enqueue_notification(
    p_recipient_id uuid,
    p_event_key text,
    p_title text,
    p_message text,
    p_href text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.notifications (
        recipient_id,
        event_key,
        title,
        message,
        href
    )
    VALUES (
        p_recipient_id,
        p_event_key,
        p_title,
        p_message,
        p_href
    )
    ON CONFLICT (recipient_id, event_key) DO NOTHING;
END;
$function$;

CREATE FUNCTION public.notify_available_cooks_of_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_now timestamp without time zone;
    v_pickup_time time without time zone;
BEGIN
    v_now := pg_catalog.timezone(
        'Africa/Harare',
        pg_catalog.clock_timestamp()
    );
    v_pickup_time := NEW.pickup_time;

    IF NEW.status <> 'open'
       OR (
           NEW.offers_close_at IS NOT NULL
           AND NEW.offers_close_at <= pg_catalog.clock_timestamp()
       )
       OR NEW.pickup_date < v_now::date
       OR (
           NEW.pickup_date = v_now::date
           AND v_pickup_time <= v_now::time
       ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notifications (
        recipient_id,
        event_key,
        title,
        message,
        href
    )
    SELECT
        cp.user_id,
        'request:' || NEW.id::text || ':available',
        'New meal request',
        'A customer has shared a meal request for '
            || NEW.pickup_date::text || ' at ' || NEW.hub || '.',
        '/cook'
    FROM public.cook_profiles AS cp
    JOIN public.users AS u ON u.id = cp.user_id
    WHERE cp.status = 'approved'
      AND cp.is_available
      AND u.role = 'cook'
    ON CONFLICT (recipient_id, event_key) DO NOTHING;

    RETURN NEW;
END;
$function$;

CREATE FUNCTION public.notify_customer_of_cook_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_customer_id uuid;
BEGIN
    IF NEW.status <> 'submitted'
       OR (
           TG_OP = 'UPDATE'
           AND OLD.status = 'submitted'
       ) THEN
        RETURN NEW;
    END IF;

    SELECT mr.customer_id
    INTO v_customer_id
    FROM public.meal_requests AS mr
    WHERE mr.id = NEW.request_id;

    IF v_customer_id IS NOT NULL THEN
        PERFORM public.enqueue_notification(
            v_customer_id,
            'offer:' || NEW.id::text || ':submitted',
            'A cook has responded',
            'A cook submitted an offer for your meal request.',
            '/my-requests'
        );
    END IF;

    RETURN NEW;
END;
$function$;

CREATE FUNCTION public.notify_negotiation_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.enqueue_notification(
            NEW.cook_id,
            'negotiation:' || NEW.id::text || ':created',
            'Customer counter-offer',
            'A customer proposed revised terms for your offer.',
            '/cook'
        );
    ELSIF OLD.status = 'pending'
       AND NEW.status IN ('accepted', 'rejected')
       AND (
           NEW.status <> 'rejected'
           OR NEW.response_message IS NOT NULL
       ) THEN
        PERFORM public.enqueue_notification(
            NEW.customer_id,
            'negotiation:' || NEW.id::text || ':' || NEW.status,
            CASE
                WHEN NEW.status = 'accepted'
                    THEN 'Your counter-offer was accepted'
                ELSE 'Your counter-offer was declined'
            END,
            CASE
                WHEN NEW.status = 'accepted'
                    THEN 'The cook accepted your revised terms. Review the request to continue.'
                ELSE 'The cook declined your revised terms. Review the request for other offers.'
            END,
            '/my-requests'
        );
    ELSIF NEW.status = 'rejected'
       AND NEW.response_message IS NOT NULL
       AND OLD.response_message IS DISTINCT FROM NEW.response_message THEN
        PERFORM public.enqueue_notification(
            NEW.customer_id,
            'negotiation:' || NEW.id::text || ':rejected',
            'Your counter-offer was declined',
            'The cook declined your revised terms. Reason: '
                || NEW.response_message,
            '/my-requests'
        );
    END IF;

    RETURN NEW;
END;
$function$;

CREATE FUNCTION public.notify_order_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_status_changed boolean;
    v_event text;
    v_title text;
    v_message text;
    v_customer_message text;
    v_cook_message text;
BEGIN
    v_status_changed :=
        TG_OP = 'INSERT'
        OR OLD.status IS DISTINCT FROM NEW.status;

    IF NOT v_status_changed THEN
        RETURN NEW;
    END IF;

    CASE NEW.status
        WHEN 'confirmed' THEN
            v_event := 'confirmed';
            v_title := 'Order confirmed';
            v_customer_message :=
                'Your order is confirmed. Pay the cook in cash when collecting at '
                || NEW.hub || '.';
            v_cook_message :=
                'A customer confirmed your offer. Collect the agreed cash payment at '
                || NEW.hub || '.';
        WHEN 'ready' THEN
            v_event := 'ready';
            v_title := 'Meal ready for collection';
            v_customer_message :=
                CASE
                    WHEN NEW.payment_provider = 'cash'
                        THEN 'Your meal is ready. Show your pickup code and pay cash at '
                             || NEW.hub || '.'
                    ELSE 'Your meal is ready for collection at ' || NEW.hub || '.'
                END;
            v_cook_message := 'The order is ready for collection at ' || NEW.hub || '.';
        WHEN 'collected' THEN
            v_event := 'collected';
            v_title := 'Order completed';
            v_customer_message :=
                CASE
                    WHEN NEW.payment_provider = 'cash'
                        THEN 'Collection is confirmed and the cash payment was recorded.'
                    ELSE 'Collection is confirmed. Thank you for using StewRun.'
                END;
            v_cook_message := 'Collection has been confirmed for this order.';
        WHEN 'cancelled' THEN
            v_event := 'cancelled';
            v_title := 'Order cancelled';
            v_customer_message := 'This order has been cancelled.';
            v_cook_message := 'An order assigned to you has been cancelled.';
        ELSE
            RETURN NEW;
    END CASE;

    PERFORM public.enqueue_notification(
        NEW.customer_id,
        'order:' || NEW.id::text || ':' || v_event,
        v_title,
        v_customer_message,
        '/orders'
    );

    IF NEW.cook_id IS NOT NULL THEN
        PERFORM public.enqueue_notification(
            NEW.cook_id,
            'order:' || NEW.id::text || ':' || v_event,
            v_title,
            v_cook_message,
            '/cook/orders'
        );
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enqueue_notification(uuid, text, text, text, text)
    OWNER TO postgres;

ALTER FUNCTION public.notify_available_cooks_of_request()
    OWNER TO postgres;

ALTER FUNCTION public.notify_customer_of_cook_offer()
    OWNER TO postgres;

ALTER FUNCTION public.notify_negotiation_participants()
    OWNER TO postgres;

ALTER FUNCTION public.notify_order_participants()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, text, text, text, text)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.notify_available_cooks_of_request()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.notify_customer_of_cook_offer()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.notify_negotiation_participants()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.notify_order_participants()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER notify_available_cooks_of_request_trigger
AFTER INSERT ON public.meal_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_available_cooks_of_request();

CREATE TRIGGER notify_customer_of_cook_offer_trigger
AFTER INSERT OR UPDATE OF status ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_of_cook_offer();

CREATE TRIGGER notify_negotiation_participants_trigger
AFTER INSERT OR UPDATE OF status, response_message ON public.negotiations
FOR EACH ROW
EXECUTE FUNCTION public.notify_negotiation_participants();

CREATE TRIGGER notify_order_participants_trigger
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_participants();

COMMIT;
