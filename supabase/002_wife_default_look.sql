-- تحديث لمن شغّل migration.sql سابقًا: العروس تبدأ بالمظهر الافتراضي للعروس.
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
    values (w.id, auth.uid(), r, left(coalesce(p_display_name, ''), 24),
            case when r = 'wife' then '{}'::jsonb else coalesce(p_look, '{}'::jsonb) end);
  return json_build_object('id', w.id, 'code', w.code, 'role', r);
end $$;

grant execute on function public.join_wedding(text, text, jsonb) to authenticated;
