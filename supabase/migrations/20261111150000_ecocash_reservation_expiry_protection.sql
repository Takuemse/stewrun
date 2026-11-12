
-- StewRun: Protect active EcoCash payments from reservation expiry.
-- Preserve the existing request -> order lock order.

CREATE OR REPLACE FUNCTION public.expire_order_reservation(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_request_id uuid;
    v_request_status text;

    v_order_status text;
    v_payment_status text;
    v_expires_at timestamptz;

    v_transaction_id uuid;
    v_transaction_status text;
    v_transaction_expires_at timestamptz;
BEGIN
    -- 1. Find the meal request without locking.
    SELECT o.meal_request_id
    INTO v_request_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Lock 1: meal request.
    SELECT mr.status
    INTO v_request_status
    FROM public.meal_requests mr
    WHERE mr.id = v_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 3. Lock 2: order.
    SELECT
        o.status,
        o.payment_status,
        o.reservation_expires_at
    INTO
        v_order_status,
        v_payment_status,
        v_expires_at
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.meal_request_id = v_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Only pending unpaid reservations can expire.
    IF v_order_status <> 'pending'
       OR v_payment_status <> 'pending'
       OR v_expires_at IS NULL
       OR v_expires_at > clock_timestamp() THEN
        RETURN FALSE;
    END IF;

    -- 4. Lock any active or unresolved EcoCash attempt.
    SELECT
        pt.id,
        pt.status,
        pt.expires_at
    INTO
        v_transaction_id,
        v_transaction_status,
        v_transaction_expires_at
    FROM public.payment_transactions pt
    WHERE pt.order_id = p_order_id
      AND pt.status IN (
          'initiated',
          'pending',
          'reconciliation_required',
          'manual_review_required'
      )
    FOR UPDATE;

    IF FOUND THEN
        -- A payment attempt still has time to complete.
        IF v_transaction_expires_at > clock_timestamp() THEN
            RETURN FALSE;
        END IF;

        -- A timed-out attempt has an uncertain provider outcome.
        -- Do not release it for another charge.
        IF v_transaction_status IN ('initiated', 'pending') THEN
            UPDATE public.payment_transactions
            SET
                status = 'reconciliation_required',
                failure_reason =
                    'Payment attempt timed out; provider status requires reconciliation.',
                updated_at = clock_timestamp()
            WHERE id = v_transaction_id;
        END IF;
    END IF;

    -- 5. Cancel the expired reservation.
    UPDATE public.orders
    SET
        status = 'cancelled',
        payment_status = 'expired'
    WHERE id = p_order_id
      AND meal_request_id = v_request_id
      AND status = 'pending'
      AND payment_status = 'pending'
      AND reservation_expires_at <= clock_timestamp();

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 6. Reopen only when no unpaid reservation or unresolved
    -- payment attempt remains for this meal request.
    IF v_request_status = 'offer_selected'
       AND NOT EXISTS (
           SELECT 1
           FROM public.orders o
           WHERE o.meal_request_id = v_request_id
             AND o.status = 'pending'
             AND o.payment_status = 'pending'
       )
       AND NOT EXISTS (
           SELECT 1
           FROM public.orders o
           JOIN public.payment_transactions pt
             ON pt.order_id = o.id
           WHERE o.meal_request_id = v_request_id
             AND pt.status IN (
                 'reconciliation_required',
                 'manual_review_required'
             )
       ) THEN

        UPDATE public.meal_requests
        SET status = 'open'
        WHERE id = v_request_id
          AND status = 'offer_selected';
    END IF;

    RETURN TRUE;
END;
$function$;
