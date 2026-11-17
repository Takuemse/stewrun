BEGIN;

CREATE FUNCTION public.respond_to_negotiation(
    p_negotiation_id uuid,
    p_decision text,
    p_response_message text
)
RETURNS TABLE (
    result_status text,
    result_agreed_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
    v_message text;
    v_result record;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users AS u
        JOIN public.cook_profiles AS cp ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Approved cook account required.';
    END IF;

    IF p_decision IS NULL
       OR p_decision NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be accepted or rejected.';
    END IF;

    v_message := NULLIF(pg_catalog.btrim(p_response_message), '');

    IF p_decision = 'rejected'
       AND (
           v_message IS NULL
           OR pg_catalog.char_length(v_message) < 3
           OR pg_catalog.char_length(v_message) > 500
       ) THEN
        RAISE EXCEPTION 'A rejection reason between 3 and 500 characters is required.';
    END IF;

    IF p_decision = 'accepted' AND v_message IS NOT NULL THEN
        RAISE EXCEPTION 'An acceptance response cannot include a rejection reason.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.negotiations AS n
        WHERE n.id = p_negotiation_id
          AND n.cook_id = v_user_id
          AND n.status = 'pending'
    ) THEN
        RAISE EXCEPTION 'Negotiation not found for this cook.';
    END IF;

    SELECT response.result_status, response.result_agreed_total
    INTO v_result
    FROM public.respond_to_negotiation(
        p_negotiation_id,
        p_decision
    ) AS response;

    UPDATE public.negotiations AS n
    SET response_message = v_message
    WHERE n.id = p_negotiation_id
      AND n.cook_id = v_user_id
      AND n.status = p_decision;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negotiation response could not be saved.';
    END IF;

    RETURN QUERY
    SELECT v_result.result_status, v_result.result_agreed_total;
END;
$function$;

ALTER FUNCTION public.respond_to_negotiation(uuid, text, text)
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.respond_to_negotiation(uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.respond_to_negotiation(uuid, text, text)
TO authenticated;

COMMIT;
