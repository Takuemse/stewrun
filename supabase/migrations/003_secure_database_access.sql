
BEGIN;

-- 1. Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Revoke existing table privileges
REVOKE ALL PRIVILEGES ON TABLE
    public.users,
    public.menu_items,
    public.orders
FROM anon, authenticated;

-- 3. USERS: authenticated users can read their own profile only
DROP POLICY IF EXISTS "users self" ON public.users;

CREATE POLICY "users self"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

GRANT SELECT ON public.users TO authenticated;

-- 4. MENU: public read, cook-only management
DROP POLICY IF EXISTS "menu read" ON public.menu_items;
DROP POLICY IF EXISTS "menu write" ON public.menu_items;

CREATE POLICY "menu read"
ON public.menu_items
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "menu write"
ON public.menu_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid()
          AND users.role = 'cook'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid()
          AND users.role = 'cook'
    )
);

GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;

-- 5. ORDERS: customers and cooks can read permitted orders
DROP POLICY IF EXISTS "orders customer" ON public.orders;
DROP POLICY IF EXISTS "orders cook" ON public.orders;
DROP POLICY IF EXISTS "orders insert" ON public.orders;

CREATE POLICY "orders customer"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

CREATE POLICY "orders cook"
ON public.orders
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid()
          AND users.role = 'cook'
    )
);

GRANT SELECT ON public.orders TO authenticated;

-- No direct INSERT, UPDATE or DELETE privileges on orders.
-- Order creation will use a validated database function.

-- 6. Harden the new-user registration trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, 'customer');

    RETURN NEW;
END;
$function$;

-- 7. Enforce unique active pickup codes
DROP INDEX IF EXISTS public.idx_orders_pickup_code_active;

CREATE UNIQUE INDEX idx_orders_pickup_code_active
ON public.orders (pickup_code)
WHERE status IN ('pending', 'confirmed', 'ready')
  AND pickup_code IS NOT NULL;

COMMIT;
