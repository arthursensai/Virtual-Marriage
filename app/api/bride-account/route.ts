mport { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 *  * تُستدعى من شاشة العروسة قبل تسجيل الدخول مباشرة.
 *   * تُنشئ (أو تُحدّث) حسابًا حقيقيًا وليس مجهولًا لها، بحيث كلمة السر
 *    * تعمل من أي جهاز أو متصفح، وليست مرتبطة بجلسة واحدة فقط كما في الدخول المجهول.
 *     *
 *      * الأمان: الوصول هنا يعتمد فقط على معرفة كلمة السر (رمز العروس السرّي ذو 8
 *       * خانات) تمامًا كما يعمل join_wedding في قاعدة البيانات، فلا حاجة لمصادقة
 *        * مسبقة لأن هذا هو ما يُنشئ الحساب أصلًا. يتطلب متغيّر بيئة
 *         * SUPABASE_SERVICE_ROLE_KEY على الخادم (Vercel) فقط — لا تضعيه أبدًا كمتغيّر
*          * NEXT_PUBLIC_.
*           */
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: '' }));
    const password = String(code ?? '')
	        .trim()
		    .toUpperCase();

      if (!password || password.length < 6) {
	          return NextResponse.json({ error: 'كلمة السر غير صحيحة.' }, { status: 400 });
		    }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	    if (!url || !serviceKey) {
		        return NextResponse.json({ error: 'الخادم غير مُهيّأ (SUPABASE_SERVICE_ROLE_KEY مفقود).' }, { status: 500 });
			  }

			    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

			      const { data: wedding, error: findErr } = await admin
			          .from('weddings')
				      .select('id, wife_auth_id')
				          .eq('wife_code', password)
					      .maybeSingle();

					        if (findErr) {
							    console.error('[bride-account] find error:', findErr);
							        return NextResponse.json({ error: `تعذّر التحقق من كلمة السر: ${findErr.message}` }, { status: 500 });
								  }
								    if (!wedding) return NextResponse.json({ error: 'كلمة السر غير صحيحة.' }, { status: 404 });

								      const email = `bride.${wedding.id}@virtual-wedding.internal`;

								        if (wedding.wife_auth_id) {
										    // الحساب موجود مسبقًا — حدّثي كلمة السر لتطابق الرمز الحالي (يدعم تغييره لاحقًا)
										//     const { error } = await admin.auth.admin.updateUserById(wedding.wife_auth_id, { password });
										//         if (error) {
										//               console.error('[bride-account] update error:', error);
										//                     return NextResponse.json({ error: `تعذّر تحديث الحساب: ${error.message}` }, { status: 500 });
										//                         }
										//                             return NextResponse.json({ email });
										//                               }
										//
										//                                 // أول مرة: أنشئي الحساب واربطيه بغرفة الحفل
										//                                   const { data: created, error: createErr } = await admin.auth.admin.createUser({
										//                                       email,
										//                                           password,
										//                                               email_confirm: true,
										//                                                 });
										//                                                   if (createErr || !created.user) {
										//                                                       console.error('[bride-account] create error:', createErr);
										//                                                           return NextResponse.json({ error: `تعذّر إنشاء الحساب: ${createErr?.message ?? 'unknown'}` }, { status: 500 });
										//                                                             }
										//
										//                                                               const { error: linkErr } = await admin.from('weddings').update({ wife_auth_id: created.user.id }).eq('id', wedding.id);
										//                                                                 if (linkErr) {
										//                                                                     console.error('[bride-account] link error:', linkErr);
										//                                                                         return NextResponse.json({ error: `تعذّر ربط الحساب: ${linkErr.message}` }, { status: 500 });
										//                                                                           }
										//
										//                                                                             return NextResponse.json({ email });
										//                                                                             }
										//
