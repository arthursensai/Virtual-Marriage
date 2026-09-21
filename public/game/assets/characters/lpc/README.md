# Universal LPC Spritesheet — الأصول الحقيقية المستخدمة هنا

هذا المجلد يحتوي عيّنة حقيقية مختارة (108 ملف، ~4.5MB) من حزمة
Universal LPC Spritesheet Character Generator — وليس الحزمة الكاملة
(~388MB). البنية والأسماء أدناه مطابقة تمامًا لما تم فحصه فعليًا في
الحزمة، وليست افتراضات.

## الحقائق الفنية المؤكَّدة
- كل حركة (`idle`, `walk`, ...) ملف PNG **منفصل تمامًا**، وليست صفوفًا
  داخل صفيحة واحدة كبيرة.
- كل إطار **64×64** بكسل.
- كل ملف حركة يحتوي **4 صفوف اتجاه** بالترتيب: `up, left, down, right`.
- `idle.png` = عمودان (إطاران) × 4 صفوف (128×256).
- `walk.png` = 9 أعمدة × 4 صفوف (576×256).

## البنية الفعلية المنسوخة
```
body/bodies/{male,female}/{idle,walk}.png
hair/{bangs,curly_short,balding,bangs_bun,bob}/adult/{idle,walk}.png
torso/aprons/{suspenders,overalls}/male/{idle,walk}/{9 ألوان}.png
dress/kimono/{normal,sleeves_oversize}/universal/female/{idle,walk}/{9 ألوان}.png
dress/bodice/female/{idle,walk}/{9 ألوان}.png
feet/boots/basic/male/{idle,walk}.png
feet/shoes/basic/thin/{idle,walk}.png
```
الألوان التسعة المتوفرة: `black, blue, maroon, navy, pink, purple, teal, white, yellow`.

خريطة `Look → هذه الملفات` موجودة بالكامل في `lib/lpc/manifest.ts`
(دوال `bodyUrls` / `hairUrls` / `outfitUrls` / `feetUrls` + `nearestLPCColorName`).

## حدود معروفة (انظر التعليق أعلى `lib/lpc/manifest.ts` للتفاصيل)
- لا توجد ملفات إكسسوار حقيقية بعد (veil/tiara/bowtie/...) — تُعرض كصفيحة
  وهمية (mock) تلقائيًا حتى تُضاف ملفات حقيقية تحت `accessory/<key>/`.
- لا توجد فئة `legs/` (تنانير/سراويل) — الأزياء تغطي الجزء العلوي فقط حاليًا.
- لا توجد نُسخ تفاوت في لون البشرة — جسد واحد لكل جنس.
- لا يوجد نمط شعر مخصص لحجاب — يُستخدم `bangs_bun` كبديل مؤقت.

## لإضافة المزيد لاحقًا
1. انسخ الملفات الحقيقية بنفس بنية المسارات أعلاه إلى هذا المجلد.
2. حدّث الخرائط في `lib/lpc/manifest.ts` (لا حاجة لتعديل `renderer.ts` أو
   `assetLoader.ts` أو `scene2d.ts` طالما الإطار 64×64 والاتجاهات بنفس الترتيب).
3. إن اختلفت أبعاد الإطار أو ترتيب الصفوف لملفات جديدة، عدّل
   `DEFAULT_LPC_SHEET_META` في `lib/lpc/types.ts` (أو أنشئ `LPCSheetMeta`
   مخصصًا لتلك الطبقة فقط).

راجع أيضًا `CREDITS.md` (ملخص) و`CREDITS.csv` + `LICENSE` (الترخيص الكامل
الإلزامي) — لا تحذفها.
