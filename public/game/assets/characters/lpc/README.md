# مكان ملفات Universal LPC Spritesheet

ضع هنا ملفات PNG لحزمة LPC. كل ملف صفيحة قياسية: إطار 64×64، 4 صفوف اتجاه
(أعلى/يسار/أسفل/يمين بهذا الترتيب)، وحتى 9 أعمدة لحركة المشي (العمود 0 = وقوف/idle).

| المجلد | الملفات المتوقعة |
|---|---|
| body/ | m_light.png m_tan.png m_amber.png m_brown.png m_dark.png<br>f_light.png f_tan.png f_amber.png f_brown.png f_dark.png |
| hair/ | m_short.png m_curly.png m_bald.png<br>f_long.png f_bun.png f_short.png f_hijab.png |
| outfit/groom/ | m_suit.png m_jellaba.png m_kaftan.png |
| outfit/bride/ | f_gown.png f_mermaid.png f_kaftan.png |
| outfit/guest/ | نفس ملفات groom و bride (الضيوف يستخدمون نفس الأزياء) |
| accessory/ | bowtie.png tarbouche.png beard.png shades.png flower.png<br>veil.png tiara.png bouquet.png necklace.png |

اختلفت أبعاد الإطار أو ترتيب الصفوف عن هذا؟ عدّل `DEFAULT_LPC_SHEET_META` في
`lib/lpc/types.ts` فقط — لا حاجة لتعديل أي كود رسم أو حركة.

اختلفت أسماء الملفات الفعلية؟ عدّل الدوال `bodyUrl` / `hairUrl` / `outfitUrl` /
`accessoryUrl` في `lib/lpc/manifest.ts` فقط.

إلى أن تُرفع الملفات الحقيقية، يعرض النظام صفائح مؤقتة (placeholder) مولَّدة تلقائيًا
بنفس الشبكة، بحيث يعمل كل شيء آخر (الحركة، التصادم، الكاميرا، الحفل) من الآن.
