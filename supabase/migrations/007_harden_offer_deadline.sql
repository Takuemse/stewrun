BEGIN;

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

    -- Lock the request first.
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

    -- Early deadline check avoids waiting for an offer lock
    -- when the deadline has already passed.
    v_checked_at := clock_timestamp();

    IF v_offers_close_at IS NOT NULL
       AND v_offers_close_at <= v_checked_at THEN
        RAISE EXCEPTION
            'The offer submission deadline has passed';
    END IF;

    -- Lock the offer second and verify its state.
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

    -- Critical second check: both locks are now held.
    -- A submission cannot proceed if it waited until
    -- after the deadline to acquire the offer lock.
    v_checked_at := clock_timestamp();

    IF v_offers_close_at IS NOT NULL
       AND v_offers_close_at <= v_checked_at THEN
        RAISE EXCEPTION
            'The offer submission deadline has passed';
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

COMMIT;