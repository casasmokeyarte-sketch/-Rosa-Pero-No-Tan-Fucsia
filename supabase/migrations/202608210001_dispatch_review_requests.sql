-- Secure product dispatch review workflow.
-- Operators may request review, but cannot approve or forge audit metadata.

alter table public.products
  add column if not exists dispatch_eligibility_status text
    not null default 'unreviewed',
  add column if not exists dispatch_reviewed_at timestamptz,
  add column if not exists dispatch_reviewed_by text,
  add column if not exists dispatch_review_requested_at timestamptz,
  add column if not exists dispatch_review_requested_by text;

alter table public.products
  drop constraint if exists products_dispatch_eligibility_status_check;

alter table public.products
  add constraint products_dispatch_eligibility_status_check
  check (
    dispatch_eligibility_status in (
      'unreviewed',
      'allowed',
      'restricted'
    )
  );

create or replace function public.protect_product_dispatch_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_trusted_role boolean;
begin
  v_trusted_role :=
    current_user in ('postgres', 'service_role', 'supabase_admin');

  if tg_op = 'INSERT' and not v_trusted_role then
    new.dispatch_eligibility_status := 'unreviewed';
    new.dispatch_reviewed_at := null;
    new.dispatch_reviewed_by := null;
  end if;

  if tg_op = 'UPDATE' and not v_trusted_role then
    if new.dispatch_eligibility_status
       is distinct from old.dispatch_eligibility_status then
      raise exception
        'Dispatch approval requires a trusted server role';
    end if;

    if new.dispatch_reviewed_at
         is distinct from old.dispatch_reviewed_at
       or new.dispatch_reviewed_by
         is distinct from old.dispatch_reviewed_by then
      raise exception
        'Dispatch review audit metadata is server controlled';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_protect_dispatch_review
  on public.products;

create trigger trg_products_protect_dispatch_review
before insert or update of
  dispatch_eligibility_status,
  dispatch_reviewed_at,
  dispatch_reviewed_by,
  dispatch_review_requested_at,
  dispatch_review_requested_by
on public.products
for each row
execute function public.protect_product_dispatch_review();

update public.products
set dispatch_eligibility_status = 'unreviewed'
where dispatch_eligibility_status is null
   or dispatch_eligibility_status not in (
     'unreviewed',
     'allowed',
     'restricted'
   );

revoke all on function public.protect_product_dispatch_review()
  from public, anon, authenticated;

grant execute on function public.protect_product_dispatch_review()
  to service_role;

comment on function public.protect_product_dispatch_review() is
  'Allows review requests while preventing browser/API approval or forged audit metadata.';