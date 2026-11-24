
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

    -- Every standard offer item must have a description.
    IF EXISTS (
        SELECT 1
        FROM public.cook_offer_items AS coi
        WHERE coi.offer_id = NEW.id
          AND length(btrim(COALESCE(coi.description, ''))) = 0
    ) THEN
        RAISE EXCEPTION
            'Each standard offer line must include a description';
    END IF;

    -- Compare grouped combinations in both directions.
    -- EXCEPT ALL handles duplicate lines and NULL values correctly.
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
        ),
        requested_only AS (
            SELECT normalized_name, quantity, line_count
            FROM requested_counts

            EXCEPT ALL

            SELECT normalized_name, quantity, line_count
            FROM offered_counts
        ),
        offered_only AS (
            SELECT normalized_name, quantity, line_count
            FROM offered_counts

            EXCEPT ALL

            SELECT normalized_name, quantity, line_count
            FROM requested_counts
        )
        SELECT 1
        FROM (
            SELECT * FROM requested_only
            UNION ALL
            SELECT * FROM offered_only
        ) AS differences
    ) THEN
        RAISE EXCEPTION
            'Each standard offer line must match a requested meal and plate quantity';
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enforce_cook_offer_requested_quantity()
    OWNER TO postgres;
