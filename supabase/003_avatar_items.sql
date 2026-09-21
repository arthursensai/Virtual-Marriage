-- يُولَّد تلقائيًا من tools/gen_lpc_catalog.py — لا تعدّله يدويًا.
-- أصناف الشخصية المقيّدة بالدور (allowed_roles) والتحقق منها في الخادم.
create table if not exists public.avatar_items (id text primary key, allowed_roles text[] not null);
alter table public.avatar_items enable row level security;
drop policy if exists avatar_items_read on public.avatar_items;
create policy avatar_items_read on public.avatar_items for select using (true);
grant select on public.avatar_items to authenticated;
truncate public.avatar_items;
insert into public.avatar_items values ('outfit.f_gown_belle', array['wife']);
insert into public.avatar_items values ('outfit.f_gown_slit', array['wife']);
insert into public.avatar_items values ('outfit.m_suit', array['husband','guest']);
insert into public.avatar_items values ('outfit.m_tuxedo', array['husband']);
insert into public.avatar_items values ('hat.tiara', array['wife']);
insert into public.avatar_items values ('hat.crown', array['husband','wife']);
insert into public.avatar_items values ('proc.veil', array['wife']);
insert into public.avatar_items values ('proc.bouquet', array['wife']);
insert into public.avatar_items values ('proc.fez', array['husband','guest']);

create or replace function public.check_look_allowed() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; v text; allowed text[];
begin
  if NEW.look is null or NEW.look->'lpc' is null then return NEW; end if;
  for k, v in select * from jsonb_each_text(coalesce(NEW.look->'lpc'->'sel', '{}'::jsonb)) loop
    select allowed_roles into allowed from public.avatar_items where id = v;
    if found and not (NEW.role = any(allowed)) then
      raise exception 'item % is not allowed for role %', v, NEW.role;
    end if;
  end loop;
  for k, v in select key, value from jsonb_each_text(coalesce(NEW.look->'lpc'->'proc', '{}'::jsonb)) loop
    if v = 'true' then
      select allowed_roles into allowed from public.avatar_items where id = 'proc.' || k;
      if found and not (NEW.role = any(allowed)) then
        raise exception 'item proc.% is not allowed for role %', k, NEW.role;
      end if;
    end if;
  end loop;
  return NEW;
end $$;

drop trigger if exists participants_check_look on public.participants;
create trigger participants_check_look before insert or update of look on public.participants
  for each row execute function public.check_look_allowed();
