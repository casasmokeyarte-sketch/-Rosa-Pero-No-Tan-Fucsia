-- ============================================================
-- Wallet operator controls and shift reporting
-- ============================================================

-- Prevent an operator from having more than one open shift. The current data
-- was checked before installing this index.
create unique index if not exists uq_shifts_one_open_per_user
  on public.shifts ((lower(btrim("user"))))
  where status = 'Abierta' and "user" is not null;

-- Office top-ups must always identify an active operator and that operator's
-- open shift. The generic posting function remains private and atomic.
create or replace function public.wallet_post_operator_topup(
  p_client_id text,
  p_amount numeric,
  p_payment_method text,
  p_idempotency_key text,
  p_operator_user_id text,
  p_shift_id text,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operator public.users%rowtype;
  v_shift public.shifts%rowtype;
  v_kind text;
  v_source text;
begin
  select * into v_operator
  from public.users
  where id = p_operator_user_id;

  if not found or v_operator.status <> 'Activo' then
    raise exception 'Active operator not found';
  end if;

  select * into v_shift
  from public.shifts
  where id = p_shift_id
  for update;

  if not found or v_shift.status <> 'Abierta' then
    raise exception 'An open shift is required';
  end if;

  if lower(btrim(coalesce(v_shift."user", ''))) <>
     lower(btrim(coalesce(v_operator.full_name, ''))) then
    raise exception 'The shift does not belong to the operator';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 50000000 then
    raise exception 'Office top-up amount is outside the allowed range';
  end if;

  case lower(btrim(p_payment_method))
    when 'cash' then
      v_kind := 'topup_cash';
      v_source := 'cash';
    when 'transfer' then
      v_kind := 'topup_transfer';
      v_source := 'transfer';
    when 'card' then
      v_kind := 'topup_card';
      v_source := 'card';
    else
      raise exception 'Unsupported office top-up payment method';
  end case;

  return public.wallet_post_transaction(
    p_client_id => p_client_id,
    p_kind => v_kind,
    p_amount => p_amount,
    p_source => v_source,
    p_idempotency_key => p_idempotency_key,
    p_operator_user_id => p_operator_user_id,
    p_shift_id => p_shift_id,
    p_notes => p_notes,
    p_metadata => jsonb_build_object(
      'channel', 'office',
      'payment_method', lower(btrim(p_payment_method))
    ) || coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Only an active administrator with their own open shift may reverse a wallet
-- movement. The original ledger row remains immutable.
create or replace function public.wallet_reverse_operator_transaction(
  p_transaction_id uuid,
  p_idempotency_key text,
  p_operator_user_id text,
  p_shift_id text,
  p_notes text default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operator public.users%rowtype;
  v_shift public.shifts%rowtype;
begin
  select * into v_operator
  from public.users
  where id = p_operator_user_id;

  if not found
     or v_operator.status <> 'Activo'
     or lower(btrim(coalesce(v_operator.role, ''))) <> 'administrador' then
    raise exception 'An active administrator is required';
  end if;

  select * into v_shift
  from public.shifts
  where id = p_shift_id
  for update;

  if not found or v_shift.status <> 'Abierta' then
    raise exception 'An open administrator shift is required';
  end if;

  if lower(btrim(coalesce(v_shift."user", ''))) <>
     lower(btrim(coalesce(v_operator.full_name, ''))) then
    raise exception 'The shift does not belong to the administrator';
  end if;

  if p_notes is null or btrim(p_notes) = '' then
    raise exception 'A reversal reason is required';
  end if;

  return public.wallet_reverse_transaction(
    p_transaction_id => p_transaction_id,
    p_idempotency_key => p_idempotency_key,
    p_operator_user_id => p_operator_user_id,
    p_shift_id => p_shift_id,
    p_notes => p_notes
  );
end;
$$;

-- Derived, auditable wallet totals for each cash closure. Reversals reduce the
-- category of their original movement instead of being counted as new income.
create or replace view public.wallet_shift_closure_summary as
select
  s.id as shift_id,
  s."user" as operator_name,
  s.status as shift_status,
  count(wt.id) as movement_count,
  coalesce(sum(
    case
      when wt.kind = 'topup_cash' then wt.amount
      when wt.kind = 'reversal_debit' and original.kind = 'topup_cash' then -wt.amount
      else 0
    end
  ), 0)::numeric(14,2) as cash_topups,
  coalesce(sum(
    case
      when wt.kind = 'topup_transfer' then wt.amount
      when wt.kind = 'reversal_debit' and original.kind = 'topup_transfer' then -wt.amount
      else 0
    end
  ), 0)::numeric(14,2) as transfer_topups,
  coalesce(sum(
    case
      when wt.kind = 'topup_card' then wt.amount
      when wt.kind = 'reversal_debit' and original.kind = 'topup_card' then -wt.amount
      else 0
    end
  ), 0)::numeric(14,2) as card_topups,
  coalesce(sum(
    case
      when wt.kind = 'purchase' then wt.amount
      when wt.kind = 'reversal_credit' and original.kind = 'purchase' then -wt.amount
      else 0
    end
  ), 0)::numeric(14,2) as wallet_purchases,
  coalesce(sum(case when wt.direction = 'credit' then wt.amount else 0 end), 0)
    ::numeric(14,2) as ledger_credits,
  coalesce(sum(case when wt.direction = 'debit' then wt.amount else 0 end), 0)
    ::numeric(14,2) as ledger_debits
from public.shifts s
left join public.wallet_transactions wt on wt.shift_id = s.id
left join public.wallet_transactions original on original.id = wt.reversal_of
group by s.id, s."user", s.status;

revoke all on function public.wallet_post_operator_topup(
  text, numeric, text, text, text, text, text, jsonb
) from public, anon, authenticated;

revoke all on function public.wallet_reverse_operator_transaction(
  uuid, text, text, text, text
) from public, anon, authenticated;

revoke all on public.wallet_shift_closure_summary from anon, authenticated;

grant execute on function public.wallet_post_operator_topup(
  text, numeric, text, text, text, text, text, jsonb
) to service_role;

grant execute on function public.wallet_reverse_operator_transaction(
  uuid, text, text, text, text
) to service_role;

grant select on public.wallet_shift_closure_summary to service_role;

comment on function public.wallet_post_operator_topup(
  text, numeric, text, text, text, text, text, jsonb
) is 'Posts an office wallet top-up only for an active operator with their open shift.';

comment on view public.wallet_shift_closure_summary is
  'Derived wallet totals for operator cash closures, including linked reversals.';
