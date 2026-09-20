-- Virtual Wedding: الجداول + RLS + الدوال. الصقه كاملًا في Supabase → SQL Editor ثم Run.
-- الأدوار تُحدَّد في الخادم فقط (دوال security definer)، والعميل لا يستطيع تغيير دوره أو دور غيره.

create extension if not exists pgcrypto;

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ weddings ============
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  wife_code text not null unique,          -- سرّي: يراه العريس فقط عبر get_wife_code()
  husband_id uuid not null references auth.users(id),
  wife_id uuid references auth.users(id),
  status text not null default 'lobby' check (status in ('lobby','ceremony','celebration','ended')),
  theme text not null default 'classic',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- ============ participants ============
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('husband','wife','guest')),
  display_name text not null default '',
  look jsonb not null default '{}'::jsonb,   -- شكل الشخصية (نفس نوع Look في الواجهة)
  joined_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);
create unique index if not exists one_husband_per_wedding on public.participants(wedding_id) where role = 'husband';
create unique index if not exists one_wife_per_wedding on public.participants(wedding_id) where role = 'wife';

-- ============ messages / events ============
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists messages_wedding_created on public.messages(wedding_id, created_at);

create table if not exists public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  type text not null,
  triggered_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ helper ============
create or replace function public.is_member(w uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participants p where p.wedding_id = w and p.user_id = auth.uid());
$$;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.weddings enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;
alter table public.wedding_events enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists weddings_select on public.weddings;
create policy weddings_select on public.weddings for select using (public.is_member(id));

drop policy if exists participants_select on public.participants;
create policy participants_select on public.participants for select using (public.is_member(wedding_id));
drop policy if exists participants_update_own on public.participants;
create policy participants_update_own on public.participants for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select using (public.is_member(wedding_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  exists (select 1 from public.participants p
          where p.id = participant_id and p.user_id = auth.uid() and p.wedding_id = messages.wedding_id)
);

drop policy if exists events_select on public.wedding_events;
create policy events_select on public.wedding_events for select using (public.is_member(wedding_id));

-- صلاحيات الأعمدة: لا كتابة مباشرة إلا على الاسم والمظهر، ولا قراءة لـ wife_code
revoke all on public.weddings, public.participants, public.messages, public.wedding_events, public.profiles from anon, authenticated;
grant select (id, code, husband_id, wife_id, status, theme, created_at, started_at, ended_at) on public.weddings to authenticated;
grant select on public.participants to authenticated;
grant update (display_name, look) on public.participants to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.wedding_events to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ============ RPC ============
create or replace function public._rand_code(len int) returns text
language plpgsql as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; out text := ''; i int;
begin
  for i in 1..len loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end $$;

create or replace function public.create_wedding(p_display_name text, p_look jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare w public.weddings; c text; wc text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  loop
    c := public._rand_code(6);
    exit when not exists (select 1 from public.weddings where code = c or wife_code = c);
  end loop;
  loop
    wc := public._rand_code(8);
    exit when wc <> c and not exists (select 1 from public.weddings where code = wc or wife_code = wc);
  end loop;
  insert into public.weddings (code, wife_code, husband_id) values (c, wc, auth.uid()) returning * into w;
  insert into public.participants (wedding_id, user_id, role, display_name, look)
    values (w.id, auth.uid(), 'husband', left(coalesce(p_display_name, ''), 24), coalesce(p_look, '{}'::jsonb));
  return json_build_object('id', w.id, 'code', w.code, 'role', 'husband');
end $$;

-- الرمز العادي => ضيف. رمز العروس السرّي => زوجة (مرة واحدة فقط).
create or replace function public.join_wedding(p_code text, p_display_name text, p_look jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare w public.weddings; c text := upper(trim(p_code)); r text; ex public.participants;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into w from public.weddings where code = c or wife_code = c;
  if not found then raise exception 'wedding not found'; end if;
  if w.status = 'ended' then raise exception 'wedding ended'; end if;

  select * into ex from public.participants where wedding_id = w.id and user_id = auth.uid();
  if found then
    return json_build_object('id', w.id, 'code', w.code, 'role', ex.role);
  end if;

  if c = w.wife_code then
    if w.wife_id is not null then raise exception 'wife already joined'; end if;
    r := 'wife';
    update public.weddings set wife_id = auth.uid() where id = w.id;
  else
    r := 'guest';
  end if;

  insert into public.participants (wedding_id, user_id, role, display_name, look)
    values (w.id, auth.uid(), r, left(coalesce(p_display_name, ''), 24), coalesce(p_look, '{}'::jsonb));
  return json_build_object('id', w.id, 'code', w.code, 'role', r);
end $$;

create or replace function public.get_wife_code(p_wedding uuid)
returns text language sql stable security definer set search_path = public as $$
  select wife_code from public.weddings where id = p_wedding and husband_id = auth.uid();
$$;

create or replace function public.set_wedding_status(p_wedding uuid, p_status text)
returns public.weddings language plpgsql security definer set search_path = public as $$
declare w public.weddings;
begin
  if p_status not in ('lobby','ceremony','celebration','ended') then raise exception 'bad status'; end if;
  update public.weddings set
    status = p_status,
    started_at = case when p_status = 'ceremony' and started_at is null then now() else started_at end,
    ended_at = case when p_status = 'ended' then now() else ended_at end
  where id = p_wedding and husband_id = auth.uid()
  returning * into w;
  if not found then raise exception 'only the husband can change status'; end if;
  insert into public.wedding_events (wedding_id, type, triggered_by, metadata)
    values (p_wedding, 'STATUS_' || upper(p_status), auth.uid(), '{}'::jsonb);
  return w;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_wedding(text, jsonb), public.join_wedding(text, text, jsonb),
  public.get_wife_code(uuid), public.set_wedding_status(uuid, text), public.is_member(uuid) to authenticated;

-- Realtime لتغيّر الحالة والأحداث (الدردشة الدائمة)
alter publication supabase_realtime add table public.weddings, public.wedding_events, public.messages;
