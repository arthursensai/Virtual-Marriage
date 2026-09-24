-- يضيف عمودًا لتتبّع حساب العروسة الحقيقي (غير المجهول) المرتبط بكلمة السر.
-- شغّليه مرة واحدة في SQL editor على مشروع Supabase.
alter table public.weddings
  add column if not exists wife_auth_id uuid references auth.users(id);
