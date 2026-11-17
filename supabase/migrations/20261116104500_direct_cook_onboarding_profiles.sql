BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_full_name_length_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_full_name_length_check
    CHECK (
        full_name IS NULL
        OR length(btrim(full_name)) BETWEEN 2 AND 100
    );

ALTER TABLE public.cook_profiles
    ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

UPDATE public.cook_profiles
SET status = 'approved'
WHERE status = 'pending';

REVOKE UPDATE ON TABLE public.users FROM authenticated;
GRANT UPDATE (full_name) ON TABLE public.users TO authenticated;

DROP POLICY IF EXISTS "users update own profile"
ON public.users;

CREATE POLICY "users update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

REVOKE UPDATE ON TABLE public.cook_profiles FROM authenticated;
GRANT UPDATE (display_name, bio, is_available)
ON TABLE public.cook_profiles
TO authenticated;
GRANT SELECT (
    user_id,
    display_name,
    bio,
    status
)
ON TABLE public.cook_profiles
TO anon;

CREATE POLICY "public read approved cook profiles"
ON public.cook_profiles
FOR SELECT
TO anon
USING (status = 'approved');

DROP POLICY IF EXISTS "cook profiles update own"
ON public.cook_profiles;

CREATE POLICY "cook profiles update own"
ON public.cook_profiles
FOR UPDATE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND status = 'approved'
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'approved'
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_role text;
    v_full_name text;
BEGIN
    v_role := COALESCE(
        NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'role'), ''),
        'customer'
    );

    IF v_role NOT IN ('customer', 'cook') THEN
        RAISE EXCEPTION 'Unsupported account role';
    END IF;

    v_full_name := NULLIF(
        BTRIM(NEW.raw_user_meta_data ->> 'full_name'),
        ''
    );

    IF v_role = 'cook'
       AND (
           v_full_name IS NULL
           OR length(v_full_name) < 2
           OR length(v_full_name) > 100
       ) THEN
        RAISE EXCEPTION 'Cook display name is required';
    END IF;

    INSERT INTO public.users (id, email, role, full_name)
    VALUES (NEW.id, NEW.email, v_role, v_full_name);

    IF v_role = 'cook' THEN
        INSERT INTO public.cook_profiles (
            user_id,
            display_name,
            status,
            is_available
        )
        VALUES (
            NEW.id,
            v_full_name,
            'approved',
            true
        );
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.handle_new_user()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.handle_new_user()
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.require_available_cook_for_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.cook_profiles AS cp
        WHERE cp.user_id = NEW.cook_id
          AND cp.status = 'approved'
          AND cp.is_available
    ) THEN
        RAISE EXCEPTION 'Cook is not accepting new requests';
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.require_available_cook_for_offer()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.require_available_cook_for_offer()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER require_available_cook_for_offer_trigger
BEFORE INSERT ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.require_available_cook_for_offer();

COMMIT;
