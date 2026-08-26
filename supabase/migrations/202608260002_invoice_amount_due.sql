-- Preserve the immutable invoice total and track the unpaid balance separately.

alter table public.invoices
  add column if not exists amount_due numeric(14, 2);

update public.invoices
set amount_due = case
  when payment_status in ('Pagado', 'Anulada') then 0
  else greatest(
    total - coalesce(wallet_paid_amount, 0),
    0
  )
end
where amount_due is null;

alter table public.invoices
  alter column amount_due set default 0;

alter table public.invoices
  alter column amount_due set not null;

alter table public.invoices
  drop constraint if exists invoices_amount_due_nonnegative;

alter table public.invoices
  add constraint invoices_amount_due_nonnegative
  check (amount_due >= 0);

comment on column public.invoices.amount_due is
  'Outstanding balance. Invoice total remains immutable when payments are registered.';