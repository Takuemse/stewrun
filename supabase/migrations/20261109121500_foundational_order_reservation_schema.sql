-- Foundational order reservation schema.
-- Adds the schema required by negotiation, reservation and EcoCash workflows.
-- Historical orders remain valid without fabricated reservation or payment data.

BEGIN;

-- 1. Negotiation pricing agreed by the customer and cook.
ALTER TABLE public.negotiations
ADD COLUMN agreed_total numeric(10,2);

ALTER TABLE public.negotiations
ADD CONSTRAINT negotiations_agreed_total_consistency_check
CHECK (
    agreed_total IS NULL
    OR (
        status = 'accepted'
        AND agreed_total > 0
    )
);

-- 2. Reservation and financial fields on orders.
ALTER TABLE public.orders
    ADD COLUMN meal_request_id uuid,
    ADD COLUMN offer_id uuid,
    ADD COLUMN cook_id uuid,
    ADD COLUMN pickup_date date,
    ADD COLUMN meal_subtotal numeric(10,2),
    ADD COLUMN original_offer_total numeric(10,2),
    ADD COLUMN negotiated_discount numeric(10,2),
    ADD COLUMN platform_fee numeric(10,2),
    ADD COLUMN platform_commission numeric(10,2),
    ADD COLUMN cook_share numeric(10,2),
    ADD COLUMN reservation_expires_at timestamptz,
    ADD COLUMN payout_status text,
    ADD COLUMN paid_at timestamptz,
    ADD COLUMN payment_provider text,
    ADD COLUMN payment_reference text;

-- Reservations begin without a pickup code.
-- The code is generated after successful payment.
ALTER TABLE public.orders
ALTER COLUMN pickup_code DROP NOT NULL;

-- 3. Enforce that the customer owns the meal request.
ALTER TABLE public.orders
ADD CONSTRAINT orders_meal_request_customer_fkey
FOREIGN KEY (meal_request_id, customer_id)
REFERENCES public.meal_requests (id, customer_id)
ON DELETE RESTRICT;

-- 4. Enforce that the selected offer belongs to the
-- associated request and cook.
ALTER TABLE public.orders
ADD CONSTRAINT orders_offer_request_cook_fkey
FOREIGN KEY (offer_id, meal_request_id, cook_id)
REFERENCES public.cook_offers (id, request_id, cook_id)
ON DELETE RESTRICT;

-- 5. Preserve legacy payment statuses and allow the
-- reservation/payment lifecycle statuses.
ALTER TABLE public.orders
DROP CONSTRAINT orders_payment_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check
CHECK (
    payment_status IN (
        'held',
        'released',
        'refunded',
        'pending',
        'paid',
        'expired',
        'failed'
    )
);

-- 6. Reservation records must contain complete and
-- internally consistent reservation/pricing information.
-- Legacy orders (meal_request_id IS NULL) are unaffected.
ALTER TABLE public.orders
ADD CONSTRAINT orders_reservation_data_consistency_check
CHECK (
    meal_request_id IS NULL
    OR (
        offer_id IS NOT NULL
        AND cook_id IS NOT NULL
        AND pickup_date IS NOT NULL

        AND meal_subtotal IS NOT NULL
        AND meal_subtotal > 0

        AND original_offer_total IS NOT NULL
        AND original_offer_total > 0

        AND negotiated_discount IS NOT NULL
        AND negotiated_discount >= 0

        AND platform_fee IS NOT NULL
        AND platform_fee >= 0

        AND platform_commission IS NOT NULL
        AND platform_commission >= 0

        AND cook_share IS NOT NULL
        AND cook_share >= 0

        AND reservation_expires_at IS NOT NULL
        AND payout_status IS NOT NULL

        AND original_offer_total - negotiated_discount = meal_subtotal
        AND total = meal_subtotal + platform_fee
        AND platform_commission + cook_share = meal_subtotal
    )
);

-- 7. A paid reservation must retain its payment evidence.
-- Legacy orders are not forced to have new payment metadata.
ALTER TABLE public.orders
ADD CONSTRAINT orders_paid_reservation_metadata_check
CHECK (
    meal_request_id IS NULL
    OR payment_status <> 'paid'
    OR (
        paid_at IS NOT NULL
        AND payment_provider IS NOT NULL
        AND btrim(payment_provider) <> ''
        AND payment_reference IS NOT NULL
        AND btrim(payment_reference) <> ''
    )
);

-- 8. A reservation that has progressed beyond pending
-- must have a pickup code before collection.
ALTER TABLE public.orders
ADD CONSTRAINT orders_reservation_pickup_code_check
CHECK (
    meal_request_id IS NULL
    OR status NOT IN ('confirmed', 'ready', 'collected')
    OR pickup_code IS NOT NULL
);

-- 9. Index reservation relationships for lookups and joins.
CREATE INDEX orders_meal_request_id_idx
ON public.orders (meal_request_id)
WHERE meal_request_id IS NOT NULL;

CREATE INDEX orders_offer_id_idx
ON public.orders (offer_id)
WHERE offer_id IS NOT NULL;

CREATE INDEX orders_cook_id_idx
ON public.orders (cook_id)
WHERE cook_id IS NOT NULL;

COMMIT;
