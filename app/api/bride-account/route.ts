import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: '' }));

  const password = String(code ?? '')
    .trim()
    .toUpperCase();

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: 'كلمة السر غير صحيحة.' },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[bride-account] Missing Supabase environment variables');

    return NextResponse.json(
      { error: 'الخادم غير مُهيّأ.' },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: wedding, error: findErr } = await admin
    .from('weddings')
    .select('id, wife_auth_id')
    .eq('wife_code', password)
    .maybeSingle();

  if (findErr) {
    console.error('[bride-account] wedding lookup failed:', {
      message: findErr.message,
      code: findErr.code,
      details: findErr.details,
      hint: findErr.hint,
    });

    return NextResponse.json(
      { error: `تعذّر التحقق من كلمة السر: ${findErr.message}` },
      { status: 500 }
    );
  }

  if (!wedding) {
    console.error('[bride-account] No wedding found for supplied wife code');

    return NextResponse.json(
      { error: 'كلمة السر غير صحيحة.' },
      { status: 404 }
    );
  }

  const email = `bride.${wedding.id}@virtual-wedding.internal`;

  /*
   * The bride account already exists.
   * Keep the password synchronized with the current wife_code.
   */
  if (wedding.wife_auth_id) {
    const { error: updateErr } =
      await admin.auth.admin.updateUserById(wedding.wife_auth_id, {
        password,
      });

    if (updateErr) {
      console.error('[bride-account] update error:', {
        message: updateErr.message,
        status: updateErr.status,
      });

      return NextResponse.json(
        { error: `تعذّر تحديث الحساب: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ email });
  }

  /*
   * First login:
   * Create a real Supabase Auth account for the bride.
   */
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createErr || !created.user) {
    console.error('[bride-account] create error:', {
      message: createErr?.message,
      status: createErr?.status,
    });

    return NextResponse.json(
      {
        error: `تعذّر إنشاء الحساب: ${
          createErr?.message ?? 'unknown'
        }`,
      },
      { status: 500 }
    );
  }

  /*
   * Link the Auth user to the wedding.
   */
  const { error: linkErr } = await admin
    .from('weddings')
    .update({
      wife_auth_id: created.user.id,
    })
    .eq('id', wedding.id);

  if (linkErr) {
    console.error('[bride-account] link error:', {
      message: linkErr.message,
      code: linkErr.code,
      details: linkErr.details,
      hint: linkErr.hint,
    });

    return NextResponse.json(
      { error: `تعذّر ربط الحساب: ${linkErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ email });
}
