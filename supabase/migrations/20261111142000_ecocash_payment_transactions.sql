-- StewRun: EcoCash payment transaction records
-- Payment records are accessible only to trusted server-side code.

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id) on delete restrict,

  customer_id uuid not null
    references auth.users(id) on delete restrict,

  provider text not null default 'ecocash'
    check (length(trim(provider)) > 0),

  client_correlator text not null unique,
  reference_code text not null unique,

  -- Normalized EcoCash subscriber number.
  -- This is private transaction data, not public profile data.
  end_user_id text not null,

  amount numeric(12, 2) not null
    check (amount > 0),

  currency text not null default 'USD'
    check (currency = 'USD'),

  status text not null default 'initiated'
    check (
      status in (
        'initiated',
        'pending',
        'succeeded',
        'failed',
        'expired',
        'reconciliation_required'
      )
    ),

  provider_reference text,
  provider_status text,
  response_code text,
  failure_reason text,

  expires_at timestamptz not null,
  initiated_at timestamptz not null default now(),
  last_checked_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_transaction_expiry_after_creation
    check (expires_at > initiated_at)
);

-- An order may have only one active or unresolved payment attempt.
-- Reconciliation-required attempts must block another charge.
create unique index if not exists
  payment_transactions_one_active_per_order
on public.payment_transactions(order_id)
where status in (
  'initiated',
  'pending',
  'reconciliation_required'
);

create index if not exists
  payment_transactions_order_created_idx
on public.payment_transactions(order_id, created_at desc);

create index if not exists
  payment_transactions_expiry_idx
on public.payment_transactions(expires_at)
where status in ('initiated', 'pending');

-- No direct access from browser sessions.
alter table public.payment_transactions enable row level security;

revoke all on table public.payment_transactions
from public, anon, authenticated, service_role;

grant select, insert, update on table public.payment_transactions
to service_role;

comment on table public.payment_transactions is
  'Private payment attempt records. Access is restricted to trusted server-side operations.';


