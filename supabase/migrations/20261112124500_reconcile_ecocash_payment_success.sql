
CREATE OR REPLACE FUNCTION public.reconcile_ecocash_payment_success(
    p_payment_transaction_id uuid,
    p_provider_status text,
    p_response_code text,
    p_provider_reference text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order_id uuid;
    v_meal_request_id uuid;
    v_order public.orders%ROWTYPE;
    v_payment public.payment_transactions%ROWTYPE;
    v_now timestamptz := pg_catalog.now();
    v_pickup_code text;
    v_updated_rows integer;
    v_attempt integer;
BEGIN
    -- Only the server-side service role may confirm payments.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized payment reconciliation';
    END IF;

    -- Never accept an unverified provider result.
    IF p_provider_status IS DISTINCT FROM 'Charged'
       OR p_response_code IS DISTINCT FROM '00' THEN
        RAISE EXCEPTION 'Provider result is not a verified successful charge';
    END IF;

    -- Obtain the order ID without locking yet.
    SELECT pt.order_id
    INTO v_order_id
    FROM public.payment_transactions AS pt
    WHERE pt.id = p_payment_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment transaction not found';
    END IF;

    -- Determine the meal request associated with the order.
    SELECT o.meal_request_id
    INTO v_meal_request_id
    FROM public.orders AS o
    WHERE o.id = v_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated order not found';
    END IF;

    -- Follow the reservation functions' lock order.
    PERFORM 1
    FROM public.meal_requests AS mr
    WHERE mr.id = v_meal_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated meal request not found';
    END IF;

    SELECT o.*
    INTO v_order
    FROM public.orders AS o
    WHERE o.id = v_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    SELECT pt.*
    INTO v_payment
    FROM public.payment_transactions AS pt
    WHERE pt.id = p_payment_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment transaction not found';
    END IF;

    -- Idempotency: never process an already completed attempt again.
    IF v_payment.status = 'succeeded' THEN
        RETURN 'already_processed';
    END IF;

    IF v_payment.status NOT IN (
        'initiated',
        'pending',
        'reconciliation_required'
    ) THEN
        RAISE EXCEPTION 'Payment transaction is not eligible for reconciliation';
    END IF;

    -- Verify that the payment belongs to this order and its customer.
    IF v_payment.provider IS DISTINCT FROM 'ecocash'
       OR v_payment.order_id IS DISTINCT FROM v_order.id
       OR v_payment.customer_id IS DISTINCT FROM v_order.customer_id THEN
        RAISE EXCEPTION 'Payment and order identity mismatch';
    END IF;

    IF v_payment.currency IS DISTINCT FROM 'USD'
       OR v_payment.amount IS DISTINCT FROM v_order.total THEN
        RAISE EXCEPTION 'Payment amount or currency mismatch';
    END IF;

    -- Record the verified provider payment first.
    -- The transaction and order changes remain atomic.
    UPDATE public.payment_transactions
    SET
        status = 'succeeded',
        provider_status = p_provider_status,
        response_code = p_response_code,
        provider_reference = p_provider_reference,
        failure_reason = NULL,
        last_checked_at = v_now,
        completed_at = v_now,
        updated_at = v_now
    WHERE id = v_payment.id;

    -- Only a pending order with an unexpired reservation can be confirmed.
    IF v_order.status = 'pending'
       AND v_order.payment_status = 'pending'
       AND v_order.reservation_expires_at > v_now THEN

        -- Generate a random pickup code and retry if the active-code
        -- partial unique index detects a collision.
        FOR v_attempt IN 1..10 LOOP
            v_pickup_code := pg_catalog.upper(
                pg_catalog.substr(
                    pg_catalog.replace(
                        pg_catalog.gen_random_uuid()::text,
                        '-',
                        ''
                    ),
                    1,
                    10
                )
            );

            BEGIN
                UPDATE public.orders
                SET
                    status = 'confirmed',
                    payment_status = 'paid',
                    paid_at = v_now,
                    payment_provider = 'ecocash',
                    payment_reference = COALESCE(
                        p_provider_reference,
                        v_payment.reference_code
                    ),
                    pickup_code = v_pickup_code
                WHERE id = v_order.id
                  AND status = 'pending'
                  AND payment_status = 'pending'
                  AND reservation_expires_at > v_now;

                GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

                IF v_updated_rows = 1 THEN
                    RETURN 'order_confirmed';
                END IF;

                EXIT;

            EXCEPTION
                WHEN unique_violation THEN
                    IF v_attempt = 10 THEN
                        RAISE;
                    END IF;
            END;
        END LOOP;
    END IF;

    -- Money was received, but the order cannot safely be confirmed.
    -- Keep the order unchanged and flag the payment for manual review.
    UPDATE public.payment_transactions
    SET
        failure_reason = CASE
            WHEN v_order.payment_status = 'paid'
                THEN 'duplicate_verified_payment_requires_manual_review'
            WHEN v_order.status = 'cancelled'
                 OR v_order.payment_status IN ('expired', 'failed')
                 OR v_order.reservation_expires_at <= v_now
                THEN 'verified_payment_after_order_expiry_requires_manual_review'
            ELSE 'verified_payment_requires_manual_review'
        END,
        updated_at = v_now
    WHERE id = v_payment.id;

    RETURN 'manual_review_required';
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_ecocash_payment_success(
    uuid, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reconcile_ecocash_payment_success(
    uuid, text, text, text
) TO service_role;

COMMENT ON FUNCTION public.reconcile_ecocash_payment_success(
    uuid, text, text, text
) IS
'Atomically records a verified EcoCash charge and confirms an eligible order. Late or otherwise ineligible payments are recorded for manual review without reviving the order.';
