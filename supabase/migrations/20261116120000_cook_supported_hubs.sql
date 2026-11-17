BEGIN;

ALTER TABLE public.cook_profiles
    ADD COLUMN IF NOT EXISTS supported_hubs text[] NOT NULL
    DEFAULT ARRAY['Eastgate', 'Joina City', 'Avondale']::text[];

ALTER TABLE public.cook_profiles
    DROP CONSTRAINT IF EXISTS cook_profiles_supported_hubs_check;

ALTER TABLE public.cook_profiles
    ADD CONSTRAINT cook_profiles_supported_hubs_check
    CHECK (
        cardinality(supported_hubs) BETWEEN 1 AND 3
        AND supported_hubs <@
            ARRAY['Eastgate', 'Joina City', 'Avondale']::text[]
    );

REVOKE UPDATE ON TABLE public.cook_profiles FROM authenticated;
GRANT UPDATE (display_name, bio, is_available, supported_hubs)
    ON TABLE public.cook_profiles TO authenticated;
GRANT SELECT (supported_hubs)
    ON TABLE public.cook_profiles TO authenticated;
GRANT SELECT (supported_hubs)
    ON TABLE public.cook_profiles TO anon;

CREATE OR REPLACE FUNCTION public.notify_available_cooks_of_request()
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
        cook_profile.user_id,
        'request:' || NEW.id::text || ':available',
        'New meal request',
        'A customer has shared a meal request for '
            || NEW.pickup_date::text || ' at ' || NEW.hub || '.',
        '/cook'
    FROM public.cook_profiles AS cook_profile
    JOIN public.users AS app_user ON app_user.id = cook_profile.user_id
    WHERE cook_profile.status = 'approved'
      AND cook_profile.is_available
      AND NEW.hub = ANY(cook_profile.supported_hubs)
      AND app_user.role = 'cook'
    ON CONFLICT (recipient_id, event_key) DO NOTHING;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.notify_available_cooks_of_request()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.notify_available_cooks_of_request()
    FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
