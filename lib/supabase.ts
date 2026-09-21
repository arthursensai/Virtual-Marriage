import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** يعيد null إذا لم تُضبط متغيرات البيئة */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    realtime: { params: { eventsPerSecond: 20 } },
    auth: {
      // Google/OAuth logins must return `?code=...` (PKCE), not the
      // `#access_token=...` fragment the implicit flow uses — our
      // /auth/callback page expects a code to exchange for a session.
      flowType: 'pkce',
      // We exchange the code ourselves in /auth/callback, so the client
      // shouldn't also try to auto-consume it on page load — that would
      // race with (and break) our manual exchangeCodeForSession call.
      detectSessionInUrl: false,
    },
  });
  return client;
}
