-- Migration: add partial unique index on pickup_code for active orders
-- This ensures no two active orders have the same pickup code
-- Active orders are: pending, confirmed, ready
-- Collected and cancelled orders release their pickup codes
--
-- Up:
CREATE INDEX idx_orders_pickup_code_active ON public.orders (pickup_code)
WHERE status IN ('pending', 'confirmed', 'ready');

-- Down:
DROP INDEX idx_orders_pickup_code_active ON public.orders;