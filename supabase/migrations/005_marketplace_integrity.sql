BEGIN;

-- =========================================================
-- 1. STRICT CUSTOMER MEAL ITEM VALIDATION
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_valid_meal_request_items(
    p_items jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $function$
DECLARE
    item jsonb;
    item_name text;
    item_quantity numeric;
BEGIN
    IF jsonb_typeof(p_items) <> 'array' THEN
        RETURN false;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RETURN false;
    END IF;

    FOR item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP
        IF jsonb_typeof(item) <> 'object' THEN
            RETURN false;
        END IF;

        IF NOT (item ? 'name') OR NOT (item ? 'quantity') THEN
            RETURN false;
        END IF;

        IF (
            SELECT COUNT(*)
            FROM jsonb_object_keys(item)
        ) <> 2 THEN
            RETURN false;
        END IF;

        IF jsonb_typeof(item->'name') <> 'string' THEN
            RETURN false;
        END IF;

        item_name := trim(item->>'name');

        IF length(item_name) < 2 OR length(item_name) > 150 THEN
            RETURN false;
        END IF;

        IF jsonb_typeof(item->'quantity') <> 'number' THEN
            RETURN false;
        END IF;

        item_quantity := (item->>'quantity')::numeric;

        IF item_quantity <> trunc(item_quantity)
           OR item_quantity < 1
           OR item_quantity > 20 THEN
            RETURN false;
        END IF;
    END LOOP;

    RETURN true;

EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$function$;


-- Replace the basic array check created in migration 004
-- with the stricter item validation function.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.meal_requests
        WHERE NOT public.is_valid_meal_request_items(items)
    ) THEN
        RAISE EXCEPTION
            'Migration stopped: existing meal requests contain invalid meal items.';
    END IF;
END;
$$;

ALTER TABLE public.meal_requests
DROP CONSTRAINT IF EXISTS meal_requests_items_check;

ALTER TABLE public.meal_requests
ADD CONSTRAINT meal_requests_items_check
CHECK (public.is_valid_meal_request_items(items));


-- =========================================================
-- 2. PICKUP DATE VALIDATION
-- Same-day requests close at 10:00 AM Africa/Harare time.
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_valid_meal_request_pickup_date(
    p_pickup_date date,
    p_harare_now timestamp without time zone
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $function$
BEGIN
    IF p_pickup_date < p_harare_now::date THEN
        RETURN false;
    END IF;

    IF p_pickup_date = p_harare_now::date
       AND p_harare_now::time >= time '10:00:00' THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$function$;


CREATE OR REPLACE FUNCTION public.enforce_meal_request_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    harare_now timestamp without time zone;
BEGIN
    harare_now := timezone(
        'Africa/Harare',
        clock_timestamp()
    );

    IF NOT public.is_valid_meal_request_pickup_date(
        NEW.pickup_date,
        harare_now
    ) THEN

        IF NEW.pickup_date < harare_now::date THEN
            RAISE EXCEPTION
                'Pickup date cannot be in the past.';
        ELSE
            RAISE EXCEPTION
                'Same-day meal requests close at 10:00 AM Africa/Harare time. Please select a future date.';
        END IF;

    END IF;

    RETURN NEW;
END;
$function$;


-- Recreate the trigger so the migration works both on a fresh
-- database and on the existing database where it already exists.

DROP TRIGGER IF EXISTS enforce_meal_request_cutoff_trigger
ON public.meal_requests;

CREATE TRIGGER enforce_meal_request_cutoff_trigger
BEFORE INSERT ON public.meal_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_meal_request_cutoff();


-- =========================================================
-- 3. PREVENT EDITING OFFER ITEMS AFTER SUBMISSION
-- =========================================================

CREATE OR REPLACE FUNCTION public.enforce_draft_offer_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_offer_id uuid;
    v_offer_status text;
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.offer_id <> OLD.offer_id THEN
        RAISE EXCEPTION
            'An offer item cannot be moved to another offer.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_offer_id := OLD.offer_id;
    ELSE
        v_offer_id := NEW.offer_id;
    END IF;

    SELECT co.status
    INTO v_offer_status
    FROM public.cook_offers co
    WHERE co.id = v_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent offer not found.';
    END IF;

    IF v_offer_status <> 'draft' THEN
        RAISE EXCEPTION
            'Offer items can only be changed while the offer is a draft.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;


DROP TRIGGER IF EXISTS enforce_draft_offer_items_trigger
ON public.cook_offer_items;

CREATE TRIGGER enforce_draft_offer_items_trigger
BEFORE INSERT OR DELETE OR UPDATE
ON public.cook_offer_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_draft_offer_items();


-- =========================================================
-- 4. SAFE COOK OFFER SUBMISSION
-- Locks the request first, then the offer.
-- Enforces the offer deadline using the database clock.
-- =========================================================

CREATE OR REPLACE FUNCTION public.submit_cook_offer(
    p_offer_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid;
    v_request_id uuid;
    v_locked_request_id uuid;
    v_request_status text;
    v_offers_close_at timestamptz;
    v_total numeric(12,2);
    v_item_count integer;
    v_checked_at timestamptz;
BEGIN
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Only approved cooks may submit offers.
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

    -- Find this cook's draft offer.
    SELECT co.request_id
    INTO v_request_id
    FROM public.cook_offers co
    WHERE co.id = p_offer_id
      AND co.cook_id = v_user_id
      AND co.status = 'draft';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft offer not found';
    END IF;

    -- Lock the request first to serialize submissions
    -- against request changes and other offer submissions.
    SELECT mr.status, mr.offers_close_at
    INTO v_request_status, v_offers_close_at
    FROM public.meal_requests mr
    WHERE mr.id = v_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meal request not found';
    END IF;

    IF v_request_status <> 'open' THEN
        RAISE EXCEPTION
            'This meal request is no longer open';
    END IF;

    v_checked_at := clock_timestamp();

    IF v_offers_close_at IS NOT NULL
       AND v_offers_close_at <= v_checked_at THEN
        RAISE EXCEPTION
            'The offer submission deadline has passed';
    END IF;

    -- Lock the offer second and verify it is still the
    -- same cook's draft for the same request.
    SELECT co.request_id
    INTO v_locked_request_id
    FROM public.cook_offers co
    WHERE co.id = p_offer_id
      AND co.cook_id = v_user_id
      AND co.status = 'draft'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Draft offer is no longer available';
    END IF;

    IF v_locked_request_id <> v_request_id THEN
        RAISE EXCEPTION
            'Offer request association changed';
    END IF;

    -- Calculate the total from the actual offer item lines.
    SELECT
        COUNT(*),
        COALESCE(SUM(coi.line_total), 0)
    INTO v_item_count, v_total
    FROM public.cook_offer_items coi
    WHERE coi.offer_id = p_offer_id;

    IF v_item_count = 0 OR v_total <= 0 THEN
        RAISE EXCEPTION
            'Add at least one valid offer item';
    END IF;

    -- Submit atomically.
    UPDATE public.cook_offers
    SET
        total_price = v_total,
        status = 'submitted',
        submitted_at = clock_timestamp()
    WHERE id = p_offer_id
      AND cook_id = v_user_id
      AND status = 'draft';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offer submission failed';
    END IF;

    RETURN v_total;
END;
$function$;


REVOKE ALL
ON FUNCTION public.submit_cook_offer(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.submit_cook_offer(uuid)
TO authenticated;


-- =========================================================
-- 5. COMPOSITE UNIQUE CONSTRAINTS
-- These support the existing order foreign keys.
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.meal_requests'::regclass
          AND conname = 'meal_requests_id_customer_unique'
    ) THEN
        ALTER TABLE public.meal_requests
        ADD CONSTRAINT meal_requests_id_customer_unique
        UNIQUE (id, customer_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.cook_offers'::regclass
          AND conname = 'cook_offers_id_request_cook_unique'
    ) THEN
        ALTER TABLE public.cook_offers
        ADD CONSTRAINT cook_offers_id_request_cook_unique
        UNIQUE (id, request_id, cook_id);
    END IF;
END;
$$;


COMMIT;
