BEGIN;

ALTER TABLE public.cook_offers
    ADD COLUMN is_alternative boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.mark_alternative_cook_offer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    v_marker constant text := '{{STEURUN_ALTERNATIVE}}';
BEGIN
    IF left(COALESCE(NEW.message, ''), length(v_marker)) = v_marker THEN
        NEW.is_alternative := true;
        NEW.message := NULLIF(
            btrim(substr(NEW.message, length(v_marker) + 1)),
            ''
        );
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_alternative_cook_offer()
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER mark_alternative_cook_offer_trigger
BEFORE INSERT ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.mark_alternative_cook_offer();

CREATE FUNCTION public.enforce_cook_offer_requested_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_requested_plates integer;
BEGIN
    IF NEW.status <> 'submitted'
       OR OLD.status = 'submitted'
       OR NEW.is_alternative THEN
        RETURN NEW;
    END IF;

    SELECT max((request_item.value ->> 'quantity')::integer)
    INTO v_requested_plates
    FROM public.meal_requests AS request_row
    CROSS JOIN LATERAL jsonb_array_elements(request_row.items) AS request_item(value)
    WHERE request_row.id = NEW.request_id;

    IF v_requested_plates IS NULL THEN
        RAISE EXCEPTION 'The requested plate quantity could not be verified';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.cook_offer_items AS offer_item
        WHERE offer_item.offer_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'An offer must contain at least one meal item';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.cook_offer_items AS offer_item
        WHERE offer_item.offer_id = NEW.id
          AND offer_item.quantity <> v_requested_plates
    ) THEN
        RAISE EXCEPTION
            'Standard offer items must match the requested plate quantity of %',
            v_requested_plates;
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enforce_cook_offer_requested_quantity()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enforce_cook_offer_requested_quantity()
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER enforce_cook_offer_requested_quantity_trigger
BEFORE UPDATE OF status ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cook_offer_requested_quantity();

-- Counteroffers are paused for new MVP requests. Historical negotiations
-- remain available to cooks so already-pending offers can be resolved.
REVOKE ALL ON FUNCTION public.create_customer_counteroffer(uuid, numeric, text)
    FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_customer_request_order_states()
RETURNS TABLE (
    meal_request_id uuid,
    order_status text,
    cash_payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS user_row
        WHERE user_row.id = v_user_id
          AND user_row.role = 'customer'
    ) THEN
        RAISE EXCEPTION 'Customer account required';
    END IF;

    RETURN QUERY
    SELECT
        order_row.meal_request_id,
        order_row.status::text,
        order_row.cash_payment_status::text
    FROM public.orders AS order_row
    WHERE order_row.customer_id = v_user_id
      AND order_row.meal_request_id IS NOT NULL
    ORDER BY order_row.created_at DESC;
END;
$function$;

ALTER FUNCTION public.get_customer_request_order_states()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_customer_request_order_states()
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_customer_request_order_states()
    TO authenticated;

COMMIT;
