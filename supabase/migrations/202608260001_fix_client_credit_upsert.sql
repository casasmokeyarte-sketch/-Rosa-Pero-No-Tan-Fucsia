-- Keep new clients without credit while allowing authorized updates
-- to existing clients through the administrative module.

create or replace function public.force_new_client_without_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- An UPSERT first attempts an INSERT. If the client already exists,
  -- preserve the values authorized by administration.
  if exists (
    select 1
    from public.clients
    where id = new.id
  ) then
    return new;
  end if;

  -- Truly new clients always begin without credit.
  new.credit_limit := 0;
  new.has_credit := false;

  return new;
end;
$function$;

revoke all
on function public.force_new_client_without_credit()
from public, anon, authenticated;

comment on function public.force_new_client_without_credit()
is
  'Forces truly new clients to start without credit while preserving authorized credit values during an UPSERT of an existing client.';