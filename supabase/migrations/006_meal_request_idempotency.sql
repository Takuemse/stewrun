BEGIN;

ALTER TABLE public.meal_requests
ADD COLUMN submission_key uuid;

CREATE UNIQUE INDEX meal_requests_customer_submission_key_unique
ON public.meal_requests (customer_id, submission_key)
WHERE submission_key IS NOT NULL;

COMMIT;
