
CREATE OR REPLACE FUNCTION public.create_ecocash_payment_attempt(
    p_order_id uuid,
    p_customer_id uuid,
    p_end_user_id text,
    p_client_correlator text,
    p_reference_code text
)
RETURNS TABLE (
    payment_transaction_id uuid,
    client_correlator text,
    reference_code text,
    end_user_id text,
    amount numeric(12, 2),
    currency text,
    expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_meal_request_id uuid;
    v_order public.orders%ROWTYPE;
    v_now timestamptz;
    v_attempt_expires_at timestamptz;
    v_payment_id uuid;
BEGIN
    -- Only trusted server-side service-role calls are permitted.
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Service role access required'
            USING ERRCODE = '42501';
    END IF;

    -- Validate required identifiers and provider-facing values.
    IF p_order_id IS NULL OR p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Order and customer identifiers are required';
    END IF;

    IF p_end_user_id IS NULL OR length(trim(p_end_user_id)) = 0
       OR p_client_correlator IS NULL OR length(trim(p_client_correlator)) = 0
       OR p_reference_code IS NULL OR length(trim(p_reference_code)) = 0 THEN
        RAISE EXCEPTION 'Payment initiation details are required';
    END IF;

    -- Discover the request so locks follow the established order:
    -- meal request -> order -> payment transaction.
    SELECT o.meal_request_id
    INTO v_meal_request_id
    FROM public.orders AS o
    WHERE o.id = p_order_id;

    IF NOT FOUND OR v_meal_request_id IS NULL THEN
        RAISE EXCEPTION 'Order or associated meal request not found';
    END IF;

    PERFORM 1
    FROM public.meal_requests AS mr
    WHERE mr.id = v_meal_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated meal request not found';
    END IF;

    -- Block payment initiation if any order under this request
    -- has a verified payment requiring manual review.
    IF EXISTS (
        SELECT 1
        FROM public.payment_transactions AS pt
        JOIN public.orders AS o
          ON o.id = pt.order_id
        WHERE o.meal_request_id = v_meal_request_id
          AND pt.status = 'manual_review_required'
    ) THEN
        RAISE EXCEPTION
            'This meal request has a verified payment requiring manual review. No new payment is permitted.';
    END IF;

    -- Lock and re-check the order after acquiring the request lock.
    SELECT o.*
    INTO v_order
    FROM public.orders AS o
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.meal_request_id IS DISTINCT FROM v_meal_request_id THEN
        RAISE EXCEPTION 'Order association changed; retry payment initiation';
    END IF;

    IF v_order.customer_id IS DISTINCT FROM p_customer_id THEN
        RAISE EXCEPTION 'Order does not belong to this customer'
            USING ERRCODE = '42501';
    END IF;

    IF v_order.status <> 'pending'
       OR v_order.payment_status <> 'pending' THEN
        RAISE EXCEPTION 'Order is not eligible for payment';
    END IF;

    v_now := clock_timestamp();

    IF v_order.reservation_expires_at IS NULL
       OR v_order.reservation_expires_at <= v_now THEN
        RAISE EXCEPTION 'Order reservation has expired';
    END IF;

    -- An unresolved attempt must never be bypassed by starting another.
    PERFORM 1
    FROM public.payment_transactions AS pt
    WHERE pt.order_id = p_order_id
      AND pt.status IN (
          'initiated',
          'pending',
          'reconciliation_required',
          'manual_review_required'
      )
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'An unresolved payment attempt already exists';
    END IF;

    -- Keep the provider attempt inside the reservation window.
    v_attempt_expires_at :=
        LEAST(v_now + interval '5 minutes', v_order.reservation_expires_at);

    IF v_attempt_expires_at <= v_now THEN
        RAISE EXCEPTION 'Insufficient reservation time remaining';
    END IF;

    INSERT INTO public.payment_transactions (
        order_id,
        customer_id,
        provider,
        client_correlator,
        reference_code,
        end_user_id,
        amount,
        currency,
        status,
        expires_at
    )
    VALUES (
        p_order_id,
        p_customer_id,
        'ecocash',
        trim(p_client_correlator),
        trim(p_reference_code),
        trim(p_end_user_id),
        v_order.total,
        'USD',
        'initiated',
        v_attempt_expires_at
    )
    RETURNING id INTO v_payment_id;

    RETURN QUERY
    SELECT
        v_payment_id,
        trim(p_client_correlator),
        trim(p_reference_code),
        trim(p_end_user_id),
        v_order.total,
        'USD'::text,
        v_attempt_expires_at;
END;
$function$;

ALTER FUNCTION public.create_ecocash_payment_attempt(
    uuid, uuid, text, text, text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_ecocash_payment_attempt(
    uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_ecocash_payment_attempt(
    uuid, uuid, text, text, text
) TO service_role;
