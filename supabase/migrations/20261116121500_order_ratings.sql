BEGIN;

ALTER TABLE public.ratings
    ADD COLUMN IF NOT EXISTS cook_id uuid
    REFERENCES public.users(id) ON DELETE CASCADE;

UPDATE public.ratings AS rating
SET cook_id = orders.cook_id
FROM public.orders AS orders
WHERE rating.order_id = orders.id
  AND rating.cook_id IS NULL;

ALTER TABLE public.ratings
    ALTER COLUMN cook_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ratings_cook_created_idx
    ON public.ratings(cook_id, created_at DESC);

DROP POLICY IF EXISTS "ratings insert" ON public.ratings;
DROP POLICY IF EXISTS "ratings read" ON public.ratings;
DROP POLICY IF EXISTS "ratings owner read" ON public.ratings;
DROP POLICY IF EXISTS "ratings eligible insert" ON public.ratings;

REVOKE ALL ON TABLE public.ratings FROM anon, authenticated;
GRANT SELECT ON TABLE public.ratings TO authenticated;
GRANT INSERT (order_id, customer_id, stars, comment)
    ON TABLE public.ratings TO authenticated;

CREATE POLICY "ratings owner read"
ON public.ratings
FOR SELECT
TO authenticated
USING (
    customer_id = (SELECT auth.uid())
    OR cook_id = (SELECT auth.uid())
);

CREATE POLICY "ratings eligible insert"
ON public.ratings
FOR INSERT
TO authenticated
WITH CHECK (customer_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.assign_order_rating_cook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_order public.orders%ROWTYPE;
BEGIN
    SELECT orders.*
    INTO v_order
    FROM public.orders AS orders
    WHERE orders.id = NEW.order_id
      AND orders.customer_id = NEW.customer_id;

    IF NOT FOUND
       OR v_order.status <> 'collected'
       OR v_order.payment_provider <> 'cash'
       OR v_order.cash_payment_status <> 'paid' THEN
        RAISE EXCEPTION 'Only collected, cash-paid orders can be rated.';
    END IF;

    NEW.cook_id := v_order.cook_id;
    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.assign_order_rating_cook()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.assign_order_rating_cook()
    FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS assign_order_rating_cook_trigger
    ON public.ratings;

CREATE TRIGGER assign_order_rating_cook_trigger
BEFORE INSERT ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_rating_cook();

CREATE OR REPLACE FUNCTION public.get_public_cook_rating_summaries()
RETURNS TABLE (
    cook_id uuid,
    average_stars numeric,
    rating_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        rating.cook_id,
        round(avg(rating.stars)::numeric, 1),
        count(*)
    FROM public.ratings AS rating
    JOIN public.cook_profiles AS cook
      ON cook.user_id = rating.cook_id
     AND cook.status = 'approved'
    GROUP BY rating.cook_id;
$function$;

ALTER FUNCTION public.get_public_cook_rating_summaries()
    OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_public_cook_rating_summaries()
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_public_cook_rating_summaries()
    TO anon, authenticated;

COMMIT;
