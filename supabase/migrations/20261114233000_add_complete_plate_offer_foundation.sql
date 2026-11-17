BEGIN;

-- Existing requests retain their JSONB representation for compatibility.
-- This normalized table adds stable line identities for future offer quotes.
CREATE TABLE public.meal_request_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL
        REFERENCES public.meal_requests(id) ON DELETE CASCADE,
    position integer NOT NULL
        CHECK (position >= 1),
    name text NOT NULL
        CHECK (length(trim(name)) BETWEEN 2 AND 150),
    quantity integer NOT NULL
        CHECK (quantity BETWEEN 1 AND 20),
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT meal_request_lines_request_position_key
        UNIQUE (request_id, position),
    CONSTRAINT meal_request_lines_id_request_key
        UNIQUE (id, request_id)
);

-- Copy names and quantities exactly as stored. No cook offer data is inferred.
INSERT INTO public.meal_request_lines (
    request_id,
    position,
    name,
    quantity
)
SELECT
    mr.id,
    item.ordinality::integer,
    item.value ->> 'name',
    (item.value ->> 'quantity')::integer
FROM public.meal_requests mr
CROSS JOIN LATERAL jsonb_array_elements(mr.items)
    WITH ORDINALITY AS item(value, ordinality);

CREATE FUNCTION public.create_meal_request_lines_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.meal_request_lines (
        request_id,
        position,
        name,
        quantity
    )
    SELECT
        NEW.id,
        item.ordinality::integer,
        item.value ->> 'name',
        (item.value ->> 'quantity')::integer
    FROM jsonb_array_elements(NEW.items)
        WITH ORDINALITY AS item(value, ordinality);

    RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.create_meal_request_lines_from_items()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER create_meal_request_lines_after_insert
AFTER INSERT ON public.meal_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_meal_request_lines_from_items();

ALTER TABLE public.meal_request_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal request lines read"
ON public.meal_request_lines
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.meal_requests mr
        WHERE mr.id = request_id
          AND mr.customer_id = (SELECT auth.uid())
    )
    OR EXISTS (
        SELECT 1
        FROM public.meal_requests mr
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE mr.id = request_id
          AND mr.status = 'open'
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

REVOKE ALL PRIVILEGES
ON TABLE public.meal_request_lines
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.meal_request_lines
TO authenticated;

COMMENT ON TABLE public.meal_request_lines IS
'Normalized, stable identities for customer-requested meal lines; names and quantities mirror meal_requests.items.';

-- Existing cook_offers remain legacy itemized offers by default. New complete
-- plate offers must opt into the new version and use the quote tables below.
ALTER TABLE public.cook_offers
ADD COLUMN pricing_model text NOT NULL DEFAULT 'legacy_items';

ALTER TABLE public.cook_offers
ADD CONSTRAINT cook_offers_pricing_model_check
CHECK (pricing_model IN ('legacy_items', 'complete_plates_v1'));

ALTER TABLE public.cook_offers
ADD CONSTRAINT cook_offers_id_request_id_key
UNIQUE (id, request_id);

COMMENT ON COLUMN public.cook_offers.pricing_model IS
'Offer representation version: legacy_items preserves historical cook_offer_items; complete_plates_v1 uses one complete-plate quote per requested meal line. Complete-plate submission remains disabled until reservation supports quote snapshots.';

-- Direct client inserts remain on the existing legacy path. A future,
-- explicitly authorized server-side RPC can create complete_plates_v1 offers.
CREATE POLICY "cook offers client insert legacy only"
ON public.cook_offers
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (pricing_model = 'legacy_items');

CREATE POLICY "cook offers client update legacy only"
ON public.cook_offers
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (pricing_model = 'legacy_items')
WITH CHECK (pricing_model = 'legacy_items');

CREATE TABLE public.cook_offer_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id uuid NOT NULL,
    request_id uuid NOT NULL,
    request_line_id uuid NOT NULL,
    position integer NOT NULL
        CHECK (position >= 1),
    complete_meal_name text NOT NULL
        CHECK (length(trim(complete_meal_name)) BETWEEN 2 AND 150),
    description text NOT NULL
        CHECK (length(trim(description)) BETWEEN 1 AND 1000),
    price_per_plate numeric NOT NULL
        CHECK (
            price_per_plate > 0
            AND price_per_plate < 'Infinity'::numeric
            AND price_per_plate = round(price_per_plate, 2)
        ),
    covered_plate_quantity integer NOT NULL
        CHECK (covered_plate_quantity BETWEEN 1 AND 20),
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT cook_offer_quotes_offer_request_fk
        FOREIGN KEY (offer_id, request_id)
        REFERENCES public.cook_offers(id, request_id)
        ON DELETE RESTRICT,
    CONSTRAINT cook_offer_quotes_line_request_fk
        FOREIGN KEY (request_line_id, request_id)
        REFERENCES public.meal_request_lines(id, request_id)
        ON DELETE RESTRICT,
    CONSTRAINT cook_offer_quotes_offer_line_key
        UNIQUE (offer_id, request_line_id),
    CONSTRAINT cook_offer_quotes_offer_position_key
        UNIQUE (offer_id, position)
);

CREATE INDEX cook_offer_quotes_request_line_idx
ON public.cook_offer_quotes(request_line_id);

CREATE TABLE public.cook_offer_quote_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid NOT NULL
        REFERENCES public.cook_offer_quotes(id) ON DELETE CASCADE,
    position integer NOT NULL
        CHECK (position >= 1),
    name text NOT NULL
        CHECK (length(trim(name)) BETWEEN 1 AND 150),
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT cook_offer_quote_components_quote_position_key
        UNIQUE (quote_id, position),
    CONSTRAINT cook_offer_quote_components_description_check
        CHECK (
            description IS NULL
            OR length(trim(description)) <= 500
        )
);

COMMENT ON TABLE public.cook_offer_quotes IS
'Versioned complete-plate quotes. Each quote covers one requested meal line and its full requested plate quantity; the price is per plate.';

COMMENT ON COLUMN public.cook_offer_quotes.price_per_plate IS
'USD price for one complete plate. Included components are descriptive and do not add to this price.';

COMMENT ON TABLE public.cook_offer_quote_components IS
'Descriptive components included in a complete plate. This table has no price field; future mutually exclusive alternatives and optional priced extras must use separate structures.';

-- Keep quoted plate coverage equal to the customer's requested quantity.
CREATE FUNCTION public.validate_cook_offer_quote_coverage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    v_requested_quantity integer;
    v_requested_position integer;
BEGIN
    SELECT mrl.quantity, mrl.position
    INTO v_requested_quantity, v_requested_position
    FROM public.meal_request_lines mrl
    WHERE mrl.id = NEW.request_line_id
      AND mrl.request_id = NEW.request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The quote must reference a meal line from its request.';
    END IF;

    IF NEW.covered_plate_quantity <> v_requested_quantity THEN
        RAISE EXCEPTION
            'The quote must cover the requested plate quantity.';
    END IF;

    IF NEW.position <> v_requested_position THEN
        RAISE EXCEPTION
            'The quote position must match the requested meal line position.';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.validate_cook_offer_quote_coverage()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_cook_offer_quote_coverage_trigger
BEFORE INSERT OR UPDATE
ON public.cook_offer_quotes
FOR EACH ROW
EXECUTE FUNCTION public.validate_cook_offer_quote_coverage();

-- Draft quote data is mutable only while its parent offer is a draft.
-- The same guard protects against privileged direct SQL updates after submit.
CREATE FUNCTION public.guard_complete_plate_quote_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_offer_id uuid;
    v_offer_status text;
    v_pricing_model text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'cook_offer_quotes'
           AND (
               NEW.offer_id IS DISTINCT FROM OLD.offer_id
               OR NEW.request_id IS DISTINCT FROM OLD.request_id
               OR NEW.request_line_id IS DISTINCT FROM OLD.request_line_id
           ) THEN
            RAISE EXCEPTION 'Quote associations cannot be changed.';
        END IF;

        IF TG_TABLE_NAME = 'cook_offer_quote_components'
           AND NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
            RAISE EXCEPTION 'Included component quote associations cannot be changed.';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'cook_offer_quotes' THEN
        IF TG_OP = 'DELETE' THEN
            v_offer_id := OLD.offer_id;
        ELSE
            v_offer_id := NEW.offer_id;
        END IF;
    ELSE
        IF TG_OP = 'DELETE' THEN
            SELECT q.offer_id
            INTO v_offer_id
            FROM public.cook_offer_quotes q
            WHERE q.id = OLD.quote_id;
        ELSE
            SELECT q.offer_id
            INTO v_offer_id
            FROM public.cook_offer_quotes q
            WHERE q.id = NEW.quote_id;
        END IF;

        IF NOT FOUND AND TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
    END IF;

    IF v_offer_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'The quote offer could not be found.';
    END IF;

    SELECT co.status, co.pricing_model
    INTO v_offer_status, v_pricing_model
    FROM public.cook_offers co
    WHERE co.id = v_offer_id
    FOR UPDATE;

    IF NOT FOUND AND TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    IF NOT FOUND OR v_pricing_model <> 'complete_plates_v1' THEN
        RAISE EXCEPTION 'Quote data requires a complete-plate offer.';
    END IF;

    IF v_offer_status <> 'draft' THEN
        RAISE EXCEPTION
            'Submitted complete-plate quote data is immutable.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.guard_complete_plate_quote_mutation()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_complete_plate_quote_mutation_trigger
BEFORE INSERT OR UPDATE OR DELETE
ON public.cook_offer_quotes
FOR EACH ROW
EXECUTE FUNCTION public.guard_complete_plate_quote_mutation();

CREATE TRIGGER guard_complete_plate_component_mutation_trigger
BEFORE INSERT OR UPDATE OR DELETE
ON public.cook_offer_quote_components
FOR EACH ROW
EXECUTE FUNCTION public.guard_complete_plate_quote_mutation();

-- Do not allow legacy independently-priced rows to be mixed with a
-- complete-plate quote. Legacy rows remain unchanged for legacy offers.
CREATE FUNCTION public.prevent_legacy_items_on_complete_plate_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_offer_id uuid;
    v_pricing_model text;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        v_offer_id := OLD.offer_id;
        SELECT co.pricing_model
        INTO v_pricing_model
        FROM public.cook_offers co
        WHERE co.id = v_offer_id
        FOR UPDATE;

        IF v_pricing_model = 'complete_plates_v1' THEN
            RAISE EXCEPTION
                'Legacy offer items cannot be used with complete-plate offers.';
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        v_offer_id := NEW.offer_id;
        SELECT co.pricing_model
        INTO v_pricing_model
        FROM public.cook_offers co
        WHERE co.id = v_offer_id
        FOR UPDATE;

        IF v_pricing_model = 'complete_plates_v1' THEN
            RAISE EXCEPTION
                'Legacy offer items cannot be used with complete-plate offers.';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.prevent_legacy_items_on_complete_plate_offer()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_legacy_items_on_complete_plate_offer_trigger
BEFORE INSERT OR UPDATE OR DELETE
ON public.cook_offer_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_legacy_items_on_complete_plate_offer();

-- Validate complete quote sets and calculate their authoritative aggregate.
-- A separate guard keeps this model unsubmitted until reservations can snapshot it.
CREATE FUNCTION public.validate_complete_plate_offer_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_request_line_count integer;
    v_quote_total numeric;
BEGIN
    IF NEW.status = 'submitted'
       AND NEW.pricing_model = 'complete_plates_v1' THEN
        IF TG_OP = 'UPDATE' THEN
            IF OLD.status <> 'draft' THEN
                RETURN NEW;
            END IF;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.cook_offer_items coi
            WHERE coi.offer_id = NEW.id
        ) THEN
            RAISE EXCEPTION
                'Complete-plate offers cannot contain legacy offer items.';
        END IF;

        SELECT count(*)
        INTO v_request_line_count
        FROM public.meal_request_lines mrl
        WHERE mrl.request_id = NEW.request_id;

        IF v_request_line_count = 0
           OR EXISTS (
               SELECT 1
               FROM public.meal_request_lines mrl
               WHERE mrl.request_id = NEW.request_id
                 AND NOT EXISTS (
                     SELECT 1
                     FROM public.cook_offer_quotes q
                     WHERE q.offer_id = NEW.id
                       AND q.request_id = NEW.request_id
                       AND q.request_line_id = mrl.id
                       AND q.covered_plate_quantity = mrl.quantity
                 )
           )
           OR (
               SELECT count(*)
               FROM public.cook_offer_quotes q
               WHERE q.offer_id = NEW.id
                 AND q.request_id = NEW.request_id
           ) <> v_request_line_count THEN
            RAISE EXCEPTION
                'A complete-plate offer requires exactly one quote for every requested meal line.';
        END IF;

        SELECT sum(q.price_per_plate * q.covered_plate_quantity)
        INTO v_quote_total
        FROM public.cook_offer_quotes q
        WHERE q.offer_id = NEW.id
          AND q.request_id = NEW.request_id;

        IF v_quote_total IS NULL OR v_quote_total <= 0 THEN
            RAISE EXCEPTION
                'A complete-plate offer must have a positive calculated total.';
        END IF;

        IF v_quote_total > 99999999.99 THEN
            RAISE EXCEPTION
                'The complete-plate offer total exceeds the existing cook_offers.total_price limit of 99999999.99.';
        END IF;

        NEW.total_price := v_quote_total;
        NEW.submitted_at := COALESCE(NEW.submitted_at, clock_timestamp());
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.validate_complete_plate_offer_submission()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_complete_plate_offer_submission_trigger
BEFORE INSERT OR UPDATE
ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.validate_complete_plate_offer_submission();

-- Complete-plate quotes are schema-only until the reservation RPC snapshots
-- them. Keep offers un-submittable rather than exposing unreservable offers.
CREATE FUNCTION public.prevent_complete_plate_offer_submission_until_reservations_support_quotes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF NEW.status = 'submitted'
       AND NEW.pricing_model = 'complete_plates_v1' THEN
        RAISE EXCEPTION
            'Complete-plate offers cannot be submitted until order reservations support quote snapshots.';
    END IF;

    RETURN NULL;
END;
$function$;

REVOKE ALL
ON FUNCTION public.prevent_complete_plate_offer_submission_until_reservations_support_quotes()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_unreservable_complete_plate_offer_submission_trigger
AFTER INSERT OR UPDATE
ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_complete_plate_offer_submission_until_reservations_support_quotes();

CREATE FUNCTION public.prevent_submitted_offer_pricing_model_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF OLD.status <> 'draft'
       AND NEW.pricing_model IS DISTINCT FROM OLD.pricing_model THEN
        RAISE EXCEPTION
            'The pricing model of a submitted offer cannot be changed.';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.prevent_submitted_offer_pricing_model_change()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_submitted_offer_pricing_model_change_trigger
BEFORE UPDATE OF pricing_model
ON public.cook_offers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_submitted_offer_pricing_model_change();

ALTER TABLE public.cook_offer_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cook_offer_quote_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complete plate quotes read"
ON public.cook_offer_quotes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        JOIN public.meal_requests mr
          ON mr.id = co.request_id
        WHERE co.id = offer_id
          AND co.request_id = cook_offer_quotes.request_id
          AND (
              co.cook_id = (SELECT auth.uid())
              OR (
                  co.status = 'submitted'
                  AND mr.customer_id = (SELECT auth.uid())
              )
          )
    )
);

CREATE POLICY "complete plate quotes insert own draft"
ON public.cook_offer_quotes
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        JOIN public.meal_requests mr
          ON mr.id = co.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE co.id = offer_id
          AND co.request_id = cook_offer_quotes.request_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "complete plate quotes update own draft"
ON public.cook_offer_quotes
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        JOIN public.meal_requests mr
          ON mr.id = co.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        JOIN public.meal_requests mr
          ON mr.id = co.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE co.id = offer_id
          AND co.request_id = cook_offer_quotes.request_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "complete plate quotes delete own draft"
ON public.cook_offer_quotes
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offers co
        JOIN public.meal_requests mr
          ON mr.id = co.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE co.id = offer_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "complete plate components read"
ON public.cook_offer_quote_components
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offer_quotes q
        JOIN public.cook_offers co
          ON co.id = q.offer_id
         AND co.request_id = q.request_id
        JOIN public.meal_requests mr
          ON mr.id = q.request_id
        WHERE q.id = quote_id
          AND (
              co.cook_id = (SELECT auth.uid())
              OR (
                  co.status = 'submitted'
                  AND mr.customer_id = (SELECT auth.uid())
              )
          )
    )
);

CREATE POLICY "complete plate components insert own draft"
ON public.cook_offer_quote_components
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.cook_offer_quotes q
        JOIN public.cook_offers co
          ON co.id = q.offer_id
         AND co.request_id = q.request_id
        JOIN public.meal_requests mr
          ON mr.id = q.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE q.id = quote_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "complete plate components update own draft"
ON public.cook_offer_quote_components
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offer_quotes q
        JOIN public.cook_offers co
          ON co.id = q.offer_id
         AND co.request_id = q.request_id
        JOIN public.meal_requests mr
          ON mr.id = q.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE q.id = quote_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.cook_offer_quotes q
        JOIN public.cook_offers co
          ON co.id = q.offer_id
         AND co.request_id = q.request_id
        JOIN public.meal_requests mr
          ON mr.id = q.request_id
        JOIN public.users u
          ON u.id = (SELECT auth.uid())
        JOIN public.cook_profiles cp
          ON cp.user_id = u.id
        WHERE q.id = quote_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
          AND u.role = 'cook'
          AND cp.status = 'approved'
    )
);

CREATE POLICY "complete plate components delete own draft"
ON public.cook_offer_quote_components
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cook_offer_quotes q
        JOIN public.cook_offers co
          ON co.id = q.offer_id
         AND co.request_id = q.request_id
        JOIN public.meal_requests mr
          ON mr.id = q.request_id
        WHERE q.id = quote_id
          AND co.cook_id = (SELECT auth.uid())
          AND co.status = 'draft'
          AND co.pricing_model = 'complete_plates_v1'
          AND mr.status = 'open'
          AND (
              mr.offers_close_at IS NULL
              OR mr.offers_close_at > now()
          )
    )
);

REVOKE ALL PRIVILEGES
ON TABLE public.cook_offer_quotes, public.cook_offer_quote_components
FROM PUBLIC, anon, authenticated;

-- The foundation is read-only to browser roles until a later phase adds an
-- authenticated, server-authorized quote creation/submission operation.
GRANT SELECT
ON TABLE public.cook_offer_quotes, public.cook_offer_quote_components
TO authenticated;

COMMIT;
