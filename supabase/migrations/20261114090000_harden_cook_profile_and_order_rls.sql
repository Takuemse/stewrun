BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.cook_profiles
FROM authenticated;

GRANT SELECT, INSERT
ON TABLE public.cook_profiles
TO authenticated;

DROP POLICY IF EXISTS "orders cook"
ON public.orders;

CREATE POLICY "orders cook"
ON public.orders
FOR SELECT
TO authenticated
USING (
    cook_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

COMMIT;
