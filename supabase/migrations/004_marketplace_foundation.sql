
BEGIN;

-- =========================================================
-- 0. SAFETY CHECK
-- Existing menu_items table was confirmed empty during audit.
-- Abort rather than assign incorrect owners if that changes.
-- =========================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.menu_items) THEN
        RAISE EXCEPTION
            'Migration stopped: menu_items contains records. Review ownership before migrating.';
    END IF;
END;
$$;


-- =========================================================
-- 1. COOK PROFILES
-- A profile can be pending without granting cook permissions.
-- Only a trusted approval process can approve an application.
-- =========================================================

CREATE TABLE public.cook_profiles (
    user_id uuid PRIMARY KEY
        REFERENCES public.users(id) ON DELETE CASCADE,

    display_name text NOT NULL
        CHECK (length(trim(display_name)) BETWEEN 2 AND 100),

    bio text,

    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),

    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cook_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cook profiles read"
ON public.cook_profiles
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR status = 'approved'
);

CREATE POLICY "cook profiles apply"
ON public.cook_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'customer'
    )
);

GRANT SELECT, INSERT ON public.cook_profiles TO authenticated;
REVOKE ALL ON public.cook_profiles FROM anon;


-- =========================================================
-- 2. MENU OWNERSHIP
-- Existing menu_items is empty, so ownership can be required.
-- =========================================================

ALTER TABLE public.menu_items
ADD COLUMN cook_id uuid NOT NULL
REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX menu_items_cook_idx
ON public.menu_items(cook_id);

DROP POLICY IF EXISTS "menu write" ON public.menu_items;

CREATE POLICY "menu insert own"
ON public.menu_items
FOR INSERT
TO authenticated
WITH CHECK (
    cook_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "menu update own"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (
    cook_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
)
WITH CHECK (
    cook_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "menu delete own"
ON public.menu_items
FOR DELETE
TO authenticated
USING (
    cook_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);


-- =========================================================
-- 3. MEAL REQUESTS
-- Pickup date and time represent Africa/Harare local time.
-- The backend will enforce the 10 AM ordering cutoff.
-- =========================================================

CREATE TABLE public.meal_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,

    items jsonb NOT NULL
        CHECK (
            jsonb_typeof(items) = 'array'
            AND jsonb_array_length(items) > 0
        ),

    budget numeric(10,2)
        CHECK (budget IS NULL OR budget > 0),

    hub text NOT NULL
        CHECK (hub IN ('Eastgate', 'Joina City', 'Avondale')),

    pickup_date date NOT NULL,

    pickup_time time NOT NULL,

    notes text,

    status text NOT NULL DEFAULT 'open'
        CHECK (
            status IN (
                'open',
                'offer_selected',
                'cancelled',
                'expired'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),

    offers_close_at timestamptz
);

CREATE INDEX meal_requests_customer_idx
ON public.meal_requests(customer_id, created_at DESC);

CREATE INDEX meal_requests_open_idx
ON public.meal_requests(status, pickup_date, hub);

ALTER TABLE public.meal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal requests customer read"
ON public.meal_requests
FOR SELECT
TO authenticated
USING (
    customer_id = (SELECT auth.uid())
);

CREATE POLICY "meal requests cook read"
ON public.meal_requests
FOR SELECT
TO authenticated
USING (
    status = 'open'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "meal requests customer insert"
ON public.meal_requests
FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND status = 'open'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'customer'
    )
);

GRANT SELECT, INSERT ON public.meal_requests TO authenticated;
REVOKE ALL ON public.meal_requests FROM anon;


-- =========================================================
-- 4. COOK OFFERS
-- One offer per cook per customer request.
-- Offers start as drafts and are not visible to customers.
-- =========================================================

CREATE TABLE public.cook_offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id uuid NOT NULL
        REFERENCES public.meal_requests(id) ON DELETE RESTRICT,

    cook_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,

    message text,

    total_price numeric(10,2) NOT NULL DEFAULT 0
        CHECK (total_price >= 0),

    status text NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'submitted',
                'accepted',
                'rejected',
                'withdrawn',
                'expired'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),

    submitted_at timestamptz,

    UNIQUE (request_id, cook_id),

    CHECK (
        status = 'draft'
        OR total_price > 0
    )
);

CREATE INDEX cook_offers_request_idx
ON public.cook_offers(request_id, status);

CREATE INDEX cook_offers_cook_idx
ON public.cook_offers(cook_id, created_at DESC);

ALTER TABLE public.cook_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cook offers read"
ON public.cook_offers
FOR SELECT
TO authenticated
USING (
    cook_id = (SELECT auth.uid())
    OR (
        status <> 'draft'
        AND EXISTS (
            SELECT 1
            FROM public.meal_requests mr
            WHERE mr.id = request_id
              AND mr.customer_id = (SELECT auth.uid())
        )
    )
);

CREATE POLICY "cook offers create"
ON public.cook_offers
FOR INSERT
TO authenticated
WITH CHECK (
    cook_id = (SELECT auth.uid())
    AND status = 'draft'
    AND total_price = 0
    AND EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
    AND EXISTS (
        SELECT 1
        FROM public.meal_requests mr
        WHERE mr.id = request_id
          AND mr.status = 'open'
    )
);

CREATE POLICY "cook offers update draft status"
ON public.cook_offers
FOR UPDATE
TO authenticated
USING (
    cook_id = (SELECT auth.uid())
    AND status = 'draft'
)
WITH CHECK (
    cook_id = (SELECT auth.uid())
    AND status IN ('draft', 'submitted')
);

CREATE POLICY "cook offers delete draft"
ON public.cook_offers
FOR DELETE
TO authenticated
USING (
    cook_id = (SELECT auth.uid())
    AND status = 'draft'
);

GRANT SELECT, INSERT, DELETE ON public.cook_offers TO authenticated;

REVOKE UPDATE ON public.cook_offers FROM authenticated;
GRANT UPDATE (status) ON public.cook_offers TO authenticated;

REVOKE ALL ON public.cook_offers FROM anon;


-- =========================================================
-- 5. OFFER ITEMS
-- menu_item_id NULL means this is a custom meal.
-- Names and prices are snapshots, not live menu references.
-- =========================================================

CREATE TABLE public.cook_offer_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    offer_id uuid NOT NULL
        REFERENCES public.cook_offers(id) ON DELETE CASCADE,

    menu_item_id uuid
        REFERENCES public.menu_items(id) ON DELETE RESTRICT,

    name text NOT NULL
        CHECK (length(trim(name)) BETWEEN 2 AND 150),

    description text,

    quantity integer NOT NULL
        CHECK (quantity BETWEEN 1 AND 20),

    unit_price numeric(10,2) NOT NULL
        CHECK (unit_price > 0),

    line_total numeric(12,2)
        GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX cook_offer_items_offer_idx
ON public.cook_offer_items(offer_id);

ALTER TABLE public.cook_offer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offer items read"
ON public.cook_offer_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.id = offer_id
          AND (
              co.cook_id = (SELECT auth.uid())
              OR (
                  co.status <> 'draft'
                  AND EXISTS (
                      SELECT 1
                      FROM public.meal_requests mr
                      WHERE mr.id = co.request_id
                        AND mr.customer_id = (SELECT auth.uid())
                  )
              )
          )
    )
);

CREATE POLICY "offer items insert draft"
ON public.cook_offer_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
    )
    AND (
        menu_item_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.menu_items mi
            WHERE mi.id = menu_item_id
              AND mi.cook_id = (SELECT auth.uid())
        )
    )
);

CREATE POLICY "offer items update draft"
ON public.cook_offer_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
    )
    AND (
        menu_item_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.menu_items mi
            WHERE mi.id = menu_item_id
              AND mi.cook_id = (SELECT auth.uid())
        )
    )
);

CREATE POLICY "offer items delete draft"
ON public.cook_offer_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.cook_offer_items TO authenticated;

REVOKE ALL ON public.cook_offer_items FROM anon;


-- =========================================================
-- 6. OFFER SUBMISSION FUNCTION
-- Calculates the total from offer items on the server.
-- A cook cannot submit a zero-value or empty offer.
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
    v_total numeric(12,2);
    v_item_count integer;
BEGIN
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.cook_profiles cp ON cp.user_id = u.id
        WHERE u.id = v_user_id
          AND u.role = 'cook'
          AND cp.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Approved cook account required';
    END IF;

    SELECT request_id
    INTO v_request_id
    FROM public.cook_offers
    WHERE id = p_offer_id
      AND cook_id = v_user_id
      AND status = 'draft'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft offer not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.meal_requests
        WHERE id = v_request_id
          AND status = 'open'
    ) THEN
        RAISE EXCEPTION 'This meal request is no longer open';
    END IF;

    SELECT COUNT(*), COALESCE(SUM(line_total), 0)
    INTO v_item_count, v_total
    FROM public.cook_offer_items
    WHERE offer_id = p_offer_id;

    IF v_item_count = 0 OR v_total <= 0 THEN
        RAISE EXCEPTION 'Add at least one valid offer item';
    END IF;

    UPDATE public.cook_offers
    SET
        total_price = v_total,
        status = 'submitted',
        submitted_at = now()
    WHERE id = p_offer_id
      AND cook_id = v_user_id
      AND status = 'draft';

    RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_cook_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_cook_offer(uuid)
TO authenticated;


-- =========================================================
-- 7. NEGOTIATIONS
-- UNIQUE offer_id enforces one counteroffer per cook offer.
-- =========================================================

CREATE TABLE public.negotiations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    offer_id uuid NOT NULL UNIQUE
        REFERENCES public.cook_offers(id) ON DELETE RESTRICT,

    customer_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,

    proposed_total numeric(10,2) NOT NULL
        CHECK (proposed_total > 0),

    message text,

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected',
                'withdrawn',
                'expired'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),

    responded_at timestamptz
);

CREATE INDEX negotiations_customer_idx
ON public.negotiations(customer_id, created_at DESC);

ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "negotiations read"
ON public.negotiations
FOR SELECT
TO authenticated
USING (
    customer_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.cook_offers co
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
    )
);

CREATE POLICY "negotiations customer insert"
ON public.negotiations
FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = 'customer'
    )
    AND EXISTS (
        SELECT 1
        FROM public.cook_offers co
        JOIN public.meal_requests mr
          ON mr.id = co.request_id
        WHERE co.id = offer_id
          AND co.status = 'submitted'
          AND mr.customer_id = (SELECT auth.uid())
    )
);

GRANT SELECT, INSERT ON public.negotiations TO authenticated;
REVOKE ALL ON public.negotiations FROM anon;


COMMIT;
