
BEGIN;

-- Standard offers must contain exactly the requested meal lines and
-- quantities. Alternative offers retain their existing behavior.
CREATE OR REPLACE FUNCTION public.enforce_cook_offer_requested_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_request_items jsonb;
    v_request_item_count integer;
    v_offer_item_count integer;
BEGIN
    IF NEW.status <> 'submitted'
       OR OLD.status = 'submitted'
       OR NEW.is_alternative THEN
        RETURN NEW;
    END IF;

    SELECT mr.items, jsonb_array_length(mr.items)
    INTO v_request_items, v_request_item_count
    FROM public.meal_requests AS mr
    WHERE mr.id = NEW.request_id;

    IF v_request_item_count IS NULL OR v_request_item_count = 0 THEN
        RAISE EXCEPTION
            'A standard offer needs one meal for every requested meal line';
    END IF;

    SELECT count(*)
    INTO v_offer_item_count
    FROM public.cook_offer_items AS coi
    WHERE coi.offer_id = NEW.id;

    IF v_offer_item_count <> v_request_item_count THEN
        RAISE EXCEPTION
            'A standard offer needs one meal for every requested meal line';
    END IF;

    -- Standard offer descriptions are mandatory, including when
    -- the legacy RPC is called directly.
    IF EXISTS (
        SELECT 1
        FROM public.cook_offer_items AS coi
        WHERE coi.offer_id = NEW.id
          AND length(btrim(COALESCE(coi.description, ''))) = 0
    ) THEN
        RAISE EXCEPTION
            'Each standard offer line must include a description';
    END IF;

    -- Compare grouped combinations rather than using EXISTS.
    -- This prevents one offer row from satisfying multiple identical
    -- requested lines.
    IF EXISTS (
        WITH requested_lines AS (
            SELECT
                lower(btrim(item.value ->> 'name')) AS normalized_name,
                (item.value ->> 'quantity')::integer AS quantity
            FROM jsonb_array_elements(v_request_items) AS item(value)
        ),
        requested_counts AS (
            SELECT
                normalized_name,
                quantity,
                count(*) AS line_count
            FROM requested_lines
            GROUP BY normalized_name, quantity
        ),
        offered_counts AS (
            SELECT
                lower(btrim(coi.name)) AS normalized_name,
                coi.quantity,
                count(*) AS line_count
            FROM public.cook_offer_items AS coi
            WHERE coi.offer_id = NEW.id
            GROUP BY lower(btrim(coi.name)), coi.quantity
        )
        SELECT 1
        FROM requested_counts AS requested
        FULL JOIN offered_counts AS offered
            ON requested.normalized_name
                IS NOT DISTINCT FROM offered.normalized_name
           AND requested.quantity
                IS NOT DISTINCT FROM offered.quantity
        WHERE requested.line_count IS DISTINCT FROM offered.line_count
    ) THEN
        RAISE EXCEPTION
            'Each standard offer line must match a requested meal and plate quantity';
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enforce_cook_offer_requested_quantity()
    OWNER TO postgres;


CREATE OR REPLACE FUNCTION public.create_and_submit_standard_cook_offer(
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
    v_request_items jsonb;
    v_item jsonb;
    v_requested jsonb;
    v_count integer;
    v_position integer := 0;
BEGIN
    IF p_request_id IS NULL
       OR p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION
            'A meal request and offer items are required';
    END IF;

    SELECT mr.items
    INTO v_request_items
    FROM public.meal_requests AS mr
    WHERE mr.id = p_request_id
      AND mr.status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Meal request not found or no longer open';
    END IF;

    v_count := jsonb_array_length(v_request_items);

    IF v_count = 0 OR jsonb_array_length(p_items) <> v_count THEN
        RAISE EXCEPTION
            'Add a price for every requested meal';
    END IF;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP
        v_position := v_position + 1;
        v_requested := v_request_items -> (v_position - 1);

        IF jsonb_typeof(v_item) <> 'object'
           OR lower(btrim(v_item ->> 'name'))
                <> lower(btrim(v_requested ->> 'name'))
           OR (v_item ->> 'quantity')::integer
                <> (v_requested ->> 'quantity')::integer
           OR length(btrim(COALESCE(v_item ->> 'description', ''))) = 0
        THEN
            RAISE EXCEPTION
                'Each offer line must match the requested meal and plate count and include a description';
        END IF;
    END LOOP;

    RETURN public.create_and_submit_cook_offer(
        p_request_id,
        p_message,
        p_items
    );
END;
$function$;

ALTER FUNCTION public.create_and_submit_standard_cook_offer(
    uuid, text, jsonb
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_and_submit_standard_cook_offer(
    uuid, text, jsonb
)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_and_submit_standard_cook_offer(
    uuid, text, jsonb
)
TO authenticated;

COMMIT;
