BEGIN;

REVOKE SELECT ON TABLE public.orders
FROM authenticated;

GRANT SELECT (
    id,
    customer_id,
    total,
    status,
    payment_status,
    hub,
    pickup_date,
    pickup_time,
    reservation_expires_at,
    created_at,
    items,
    meal_subtotal,
    collected_at,
    cook_id
)
ON TABLE public.orders
TO authenticated;

COMMIT;
