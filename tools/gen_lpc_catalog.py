#!/usr/bin/env python3
"""
يولّد كتالوج تخصيص الشخصيات (lib/avatar/catalog.json) وقائمة الملفات المطلوبة فقط من حزمة LPC.

الاستعمال:
  bash tools/list-lpc.sh /مسار/lpc-bundle/spritesheets   # مرة واحدة
  python3 tools/gen_lpc_catalog.py
النواتج:
  lib/avatar/catalog.json      كتالوج الأصناف والألوان والملفات
  tools/lpc-needed.txt         قائمة الملفات (نسبية لمجلد spritesheets) التي يجب نسخها
  supabase/003_avatar_items.sql  أصناف مقيّدة بالدور (allowed_roles) + trigger تحقق
لإضافة صنف جديد: أضف سطرًا في قسم ITEMS أدناه ثم أعد التشغيل.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'lpc-all-paths.txt')
if not os.path.exists(SRC):
    sys.exit('ينقص tools/lpc-all-paths.txt — أنشئه بـ: bash tools/list-lpc.sh /مسار/lpc-bundle/spritesheets')
S = set(l.strip() for l in open(SRC, encoding='utf-8') if l.strip())

PREF = ['white', 'base', 'light_gray', 'gray', 'lavender', 'silver', 'gold', 'brass', 'steel', 'black']

def find(dirp, anim):
    """أفضل ملف لحركة معيّنة داخل مجلد: anim.png مباشرة أو anim/<لون فاتح>.png"""
    d = f'{dirp}/{anim}.png'
    if d in S:
        return d
    for c in PREF:
        f = f'{dirp}/{anim}/{c}.png'
        if f in S:
            return f
    # أي متغيّر لوني موجود
    pre = f'{dirp}/{anim}/'
    cands = sorted(p for p in S if p.startswith(pre) and p.count('/') == pre.count('/'))
    return cands[0] if cands else None

def layer(z, paths, recolor=None, variant=None):
    """paths: str (نفس المسار للجنسين) أو {male:..., female:...}"""
    return {'z': z, 'paths': paths, 'recolor': recolor, 'variant': variant}

BODIES = ['male', 'female']
SEX_TORSO = {'male': 'male', 'female': 'female'}
SEX_THIN = {'male': 'male', 'female': 'thin'}

def sx(tpl, mapping):
    return {b: tpl.replace('{s}', mapping[b]) for b in BODIES}

# ---------------- الأصناف ----------------
# z: shadow 0 | hair bg 5 | body 10 | head 11 | face 12 | eyes 13 | brows 14 | feet 20 | legs 30 | torso 40 | dress 45 | jacket 50
#    neck 60 | beard 65 | facial 70 | hair 80 | hat 90
CATS = [
    ('hair', 'الشعر', 'hair'),
    ('outfit', 'اللباس', 'top'),
    ('shoes', 'الأحذية', 'shoes'),
    ('hat', 'غطاء الرأس', 'hat'),
    ('neck', 'الرقبة', 'neck'),
    ('glasses', 'النظارات', 'metal'),
    ('earrings', 'الأقراط', 'metal'),
    ('necklace', 'العقد', 'metal'),
    ('beard', 'اللحية', 'hair'),
    ('mustache', 'الشارب', 'hair'),
    ('brows', 'الحواجب', 'hair'),
]

ITEMS = []
def item(id, cat, label, layers, roles=None, bodies=None, slots=None, hides=None):
    ITEMS.append({'id': id, 'cat': cat, 'label': label, 'layers': layers, 'roles': roles, 'bodies': bodies or BODIES, 'slots': slots or [], 'hides': hides or []})

# ---- الشعر (تلوين hair) ----
HAIR = [
    ('buzzcut', 'حليق قصير'), ('plain', 'قصير عادي'), ('parted', 'مفروق'), ('parted2', 'مفروق ٢'), ('messy1', 'مبعثر'),
    ('curly_short', 'مجعّد قصير'), ('afro', 'أفرو'), ('spiked', 'شوكي'), ('high_and_tight', 'عسكري'), ('flat_top_fade', 'مسطّح'),
    ('bangs', 'غرّة'), ('swoop', 'مائل'), ('cornrows', 'ضفائر ملاصقة'), ('balding', 'أصلع جزئيًا'), ('mop', 'كثيف'),
    ('long', 'طويل'), ('long_straight', 'طويل ناعم'), ('bob', 'بوب'), ('bob_side_part', 'بوب جانبي'), ('pixie', 'بيكسي'),
    ('pigtails', 'ضفيرتان'), ('bangslong', 'غرّة طويلة'), ('curly_long', 'مجعّد طويل'), ('page', 'صفحة'), ('lob', 'لوب'),
    ('loose', 'منسدل'), ('half_up', 'نصف مرفوع'), ('idol', 'آيدول'), ('bangs_bun', 'كعكة'), ('natural', 'طبيعي'),
]
HAIR_BG = [
    ('wavy', 'مموّج طويل'), ('long_tied', 'طويل مربوط'), ('high_ponytail', 'ذيل حصان عالٍ'), ('ponytail', 'ذيل حصان'),
    ('braid', 'ضفيرة'), ('princess', 'أميرة'), ('xlong', 'طويل جدًا'), ('long_center_part', 'مفروق من المنتصف'),
]
for k, lab in HAIR:
    item(f'hair.{k}', 'hair', lab, [layer(80, f'hair/{k}/adult', 'hair')])
for k, lab in HAIR_BG:
    item(f'hair.{k}', 'hair', lab, [layer(5, f'hair/{k}/adult/bg', 'hair'), layer(80, f'hair/{k}/adult/fg', 'hair')])

# ---- الأحذية (تلوين shoes) ----
for k, lab, t in [('shoes_basic', 'حذاء عادي', 'feet/shoes/basic/{s}'), ('boots', 'بوت', 'feet/boots/basic/{s}'), ('boots_fold', 'بوت مطوي', 'feet/boots/fold/{s}'),
                  ('sandals', 'صندل', 'feet/sandals/{s}'), ('slippers', 'بلغة/شبشب', 'feet/slippers/{s}'), ('shoes_rev', 'حذاء كلاسيكي', 'feet/shoes/revised/{s}')]:
    item(f'shoes.{k}', 'shoes', lab, [layer(20, sx(t, SEX_THIN), 'shoes')])

# ---- الملابس ----
def legs(tpl, slot='bottom'):
    return layer(30, sx(tpl, SEX_THIN), slot)

# نسائي
item('outfit.f_gown_belle', 'outfit', 'فستان زفاف أميري', [
    layer(40, {'male': 'torso/clothes/corset/female', 'female': 'torso/clothes/corset/female'}, 'top'),
    layer(46, {'male': 'legs/skirts/belle/thin', 'female': 'legs/skirts/belle/thin'}, 'top')], roles=['bride'], bodies=['female'], slots=['top'])
item('outfit.f_gown_slit', 'outfit', 'فستان زفاف انسيابي', [
    layer(45, 'dress/slit/female', 'top'), layer(47, 'dress/sash/female', 'top2'), legs('legs/leggings/{s}')], roles=['bride'], bodies=['female'], slots=['top', 'top2'])
item('outfit.f_kimono', 'outfit', 'فستان مطرّز طويل', [
    layer(45, 'dress/kimono/normal/universal/female', 'top'), layer(46, 'dress/kimono/normal/trim/universal/female', 'top2'), legs('legs/leggings/{s}')], bodies=['female'], slots=['top', 'top2'])
item('outfit.f_kaftan', 'outfit', 'قفطان', [
    layer(45, 'torso/clothes/robe/female', 'top'), legs('legs/skirts/straight/{s}', 'top')], bodies=['female'], slots=['top'])
item('outfit.f_blouse_skirt', 'outfit', 'بلوزة وتنورة', [
    layer(40, 'torso/clothes/blouse/female', 'top'), legs('legs/skirts/plain/{s}')], bodies=['female'], slots=['top', 'bottom'])
item('outfit.f_tunic', 'outfit', 'تونيك وبنطلون', [
    layer(40, 'torso/clothes/tunic/female', 'top'), legs('legs/leggings/{s}')], bodies=['female'], slots=['top', 'bottom'])
item('outfit.f_longsleeve', 'outfit', 'بلوزة كمّ طويل وبنطلون', [
    layer(40, 'torso/clothes/blouse_longsleeve/female', 'top'), legs('legs/pants/{s}')], bodies=['female'], slots=['top', 'bottom'])
# رجالي
item('outfit.m_suit', 'outfit', 'بدلة رسمية', [
    layer(40, 'torso/clothes/longsleeve/formal/male', 'top2'), layer(50, 'torso/jacket/collared/male', 'top'), legs('legs/formal/{s}')], roles=['groom', 'guest'], bodies=['male'], slots=['top', 'top2', 'bottom'])
item('outfit.m_tuxedo', 'outfit', 'بدلة العريس الفاخرة', [
    layer(40, 'torso/clothes/longsleeve/formal_striped/male', 'top2'), layer(50, 'torso/jacket/frock/male', 'top'), legs('legs/formal_striped/{s}')], roles=['groom'], bodies=['male'], slots=['top', 'top2', 'bottom'])
item('outfit.m_vest', 'outfit', 'صدرية وقميص', [
    layer(40, 'torso/clothes/longsleeve/longsleeves/male', 'top2'), layer(50, 'torso/clothes/vest/male', 'top'), legs('legs/pants/{s}')], bodies=['male'], slots=['top', 'top2', 'bottom'])
item('outfit.m_shirt', 'outfit', 'قميص وبنطلون', [
    layer(40, 'torso/clothes/longsleeve/longsleeve/male', 'top'), legs('legs/pants/{s}')], bodies=['male'], slots=['top', 'bottom'])
item('outfit.m_tshirt', 'outfit', 'تيشيرت وبنطلون', [
    layer(40, 'torso/clothes/shortsleeve/tshirt/male', 'top'), legs('legs/pants/{s}')], bodies=['male'], slots=['top', 'bottom'])

# ---- غطاء الرأس ----
item('hat.tiara', 'hat', 'تاج العروس', [layer(90, 'hat/formal/tiara/adult', 'metal')], roles=['bride'], slots=['metal'])
item('hat.crown', 'hat', 'تاج ملكي', [layer(90, 'hat/formal/crown/adult', 'metal')], roles=['groom', 'bride'], slots=['metal'])
item('hat.hijab', 'hat', 'حجاب', [layer(92, {'male': 'hat/cloth/hijab/male', 'female': 'hat/cloth/hijab/thin'}, 'hat')], bodies=['female'], slots=['hat'], hides=['hair'])
item('hat.tophat', 'hat', 'قبعة رسمية', [layer(90, 'hat/formal/tophat/adult', 'hat')], bodies=['male'], slots=['hat'])
item('hat.bowler', 'hat', 'قبعة بولر', [layer(90, 'hat/formal/bowler/adult', 'hat')], bodies=['male'], slots=['hat'])
item('hat.headband', 'hat', 'عصابة رأس', [layer(90, 'hat/headband/tied/adult', 'hat')], slots=['hat'])

# ---- الرقبة ----
item('neck.bowtie', 'neck', 'ببيون', [layer(60, 'neck/tie/bowtie/adult', 'neck')], slots=['neck'])
item('neck.bowtie2', 'neck', 'ببيون كبير', [layer(60, 'neck/tie/bowtie2/adult', 'neck')], slots=['neck'])
item('neck.necktie', 'neck', 'رباط عنق', [layer(60, {'male': 'neck/tie/necktie/male', 'female': 'neck/tie/necktie/female'}, 'neck')], slots=['neck'])
item('neck.scarf', 'neck', 'وشاح', [layer(61, 'neck/scarf', 'neck')], slots=['neck'])

# ---- نظارات وأقراط وعقد ----
for k, lab in [('round', 'نظارة دائرية'), ('shades', 'نظارة شمسية'), ('secretary', 'نظارة أنيقة'), ('nerd', 'نظارة سميكة')]:
    item(f'glasses.{k}', 'glasses', lab, [layer(70, f'facial/glasses/{k}/adult', 'metal')], slots=['metal'])
item('earrings.simple', 'earrings', 'أقراط بسيطة', [layer(71, {'male': 'facial/earrings/simple/male', 'female': 'facial/earrings/simple/female'}, 'metal')], slots=['metal'])
item('necklace.simple', 'necklace', 'عقد بسيط', [layer(62, {'male': 'neck/necklace/simple/male', 'female': 'neck/necklace/simple/female'}, 'metal')], slots=['metal'])
item('necklace.chain', 'necklace', 'سلسلة', [layer(62, {'male': 'neck/necklace/chain/male', 'female': 'neck/necklace/chain/female'}, 'metal')], slots=['metal'])

# ---- لحية وشارب وحواجب ----
for k, lab in [('basic', 'لحية عادية'), ('medium', 'لحية متوسطة'), ('trimmed', 'لحية مهذّبة'), ('5oclock_shadow', 'ذقن خفيفة'), ('winter', 'لحية كثيفة')]:
    item(f'beard.{k}', 'beard', lab, [layer(65, f'beards/beard/{k}', 'hair')], bodies=['male'])
for k, lab in [('basic', 'شارب عادي'), ('handlebar', 'شارب مفتول'), ('chevron', 'شارب عريض'), ('french', 'شارب فرنسي')]:
    item(f'mustache.{k}', 'mustache', lab, [layer(66, f'beards/mustache/{k}', 'hair')], bodies=['male'])
item('brows.thin', 'brows', 'رفيعة', [layer(14, 'eyes/eyebrows/thin/adult', 'hair')])
item('brows.thick', 'brows', 'كثيفة', [layer(14, 'eyes/eyebrows/thick/adult', 'hair')])

# ---- عناصر مرسومة برمجيًا (غير موجودة في LPC) ----
PROC = [
    {'id': 'veil', 'label': 'طرحة الزفاف', 'roles': ['bride']},
    {'id': 'bouquet', 'label': 'باقة ورد', 'roles': ['bride']},
    {'id': 'fez', 'label': 'طربوش', 'roles': ['groom', 'guest'], 'bodies': ['male'], 'hides': ['hair']},
]

# ---- الطبقات الأساسية (دائمة) ----
BASE_LAYERS = [
    layer(0, 'shadow/adult', None),
    layer(10, {'male': 'body/bodies/male', 'female': 'body/bodies/female'}, 'skin'),
    layer(11, {'male': 'head/heads/human/male', 'female': 'head/heads/human/female'}, 'skin'),
    layer(12, {'male': 'head/faces/male/neutral', 'female': 'head/faces/female/neutral'}, None),
]
EYES = ['blue', 'brown', 'gray', 'green', 'orange']

# ---------------- التوليد ----------------
needed = set()
def resolve_layer(l):
    out = {'z': l['z'], 'recolor': l['recolor'], 'files': {}}
    for b in BODIES:
        p = l['paths'] if isinstance(l['paths'], str) else l['paths'].get(b)
        if p is None:
            continue
        w = find(p, 'walk')
        i = find(p, 'idle')
        if not w:
            return None if b in ('male', 'female') and False else out  # سيُتحقق لاحقًا
        out['files'][b] = {'walk': w[:], 'idle': i}
        needed.add(w)
        if i:
            needed.add(i)
    return out

def build_item(it):
    layers = []
    bodies = []
    for b in it['bodies']:
        ok = True
        for l in it['layers']:
            p = l['paths'] if isinstance(l['paths'], str) else l['paths'].get(b)
            if p is None or not find(p, 'walk'):
                ok = False
        if ok:
            bodies.append(b)
    if not bodies:
        return None
    for l in it['layers']:
        r = {'z': l['z'], 'recolor': l['recolor'], 'files': {}}
        for b in bodies:
            p = l['paths'] if isinstance(l['paths'], str) else l['paths'][b]
            w, i = find(p, 'walk'), find(p, 'idle')
            r['files'][b] = {'walk': w, 'idle': i}
            needed.add(w)
            if i:
                needed.add(i)
        layers.append(r)
    return {'id': it['id'], 'cat': it['cat'], 'label': it['label'], 'roles': it['roles'], 'bodies': bodies, 'slots': it['slots'], 'hides': it['hides'], 'layers': layers}

items = []
skipped = []
for it in ITEMS:
    r = build_item(it)
    (items.append(r) if r else skipped.append(it['id']))

base = []
for l in BASE_LAYERS:
    r = {'z': l['z'], 'recolor': l['recolor'], 'files': {}}
    for b in BODIES:
        p = l['paths'] if isinstance(l['paths'], str) else l['paths'][b]
        w, i = find(p, 'walk'), find(p, 'idle')
        if w:
            r['files'][b] = {'walk': w, 'idle': i}
            needed.add(w)
            if i:
                needed.add(i)
    if r['files']:
        base.append(r)
    else:
        skipped.append('base:' + str(l['paths']))

# العيون: ملفات ملوّنة بالاسم
eyes = {'z': 13, 'files': {}}
for b in BODIES:
    eyes['files'][b] = {}
    for c in EYES:
        w = f'eyes/human/adult/neutral/default/walk/{c}.png'
        i = f'eyes/human/adult/neutral/default/idle/{c}.png'
        if w in S:
            eyes['files'][b][c] = {'walk': w, 'idle': i if i in S else None}
            needed.add(w)
            if i in S:
                needed.add(i)

cats = []
for cid, label, slot in CATS:
    cats.append({'id': cid, 'label': label, 'slot': slot})

catalog = {
    'version': 1,
    'base': '/game/assets/characters/lpc',
    'frame': 64,
    'categories': cats,
    'baseLayers': base,
    'eyes': eyes,
    'items': items,
    'proc': PROC,
    'palettes': {
        'skin': ['#fbe3cf', '#f6d5b8', '#e8b48a', '#d9a06f', '#c68a5b', '#a8683f', '#8d5a3b', '#5a3825'],
        'hair': ['#0f0b0a', '#1a1410', '#3b2417', '#4a2f1d', '#6b4423', '#8a5a2b', '#b07a3a', '#c9a24a', '#e6c78a', '#b53a2a', '#d9d9d9', '#e58fb0', '#7a4dff', '#2f5fa8'],
        'cloth': ['#ffffff', '#f4e9d3', '#e9cfc0', '#e58fb0', '#c22f4b', '#8f1d31', '#9b1c1c', '#f2a65a', '#ffd166', '#c9a24a', '#0f6b5c', '#2e8b57', '#2f5fa8', '#1b2a49', '#6a2c91', '#c9b6f2', '#8a8f98', '#111111'],
        'shoes': ['#111111', '#3b2417', '#6b4423', '#b08a5a', '#ffffff', '#c9a24a', '#c22f4b', '#ffd166', '#1b2a49'],
        'metal': ['#d8b55a', '#cfd6df', '#e0a690', '#2b2b30', '#ffffff'],
    },
    'slots': {
        'top': {'label': 'اللون الأساسي', 'palette': 'cloth'},
        'top2': {'label': 'اللون الثانوي', 'palette': 'cloth'},
        'bottom': {'label': 'لون السفلي', 'palette': 'cloth'},
        'shoes': {'label': 'لون الحذاء', 'palette': 'shoes'},
        'hat': {'label': 'اللون', 'palette': 'cloth'},
        'neck': {'label': 'اللون', 'palette': 'cloth'},
        'metal': {'label': 'المعدن', 'palette': 'metal'},
        'hair': {'label': 'لون الشعر', 'palette': 'hair'},
        'skin': {'label': 'لون البشرة', 'palette': 'skin'},
    },
    'defaults': {
        'groom': {'body': 'male', 'skin': '#e8b48a', 'eyes': 'brown',
                  'sel': {'hair': 'hair.plain', 'brows': 'brows.thick', 'outfit': 'outfit.m_suit', 'shoes': 'shoes.shoes_basic', 'neck': 'neck.bowtie'},
                  'col': {'hair': '#1a1410', 'top': '#1b2a49', 'top2': '#ffffff', 'bottom': '#1b2a49', 'shoes': '#111111', 'neck': '#9b1c1c'}, 'proc': {}},
        'bride': {'body': 'female', 'skin': '#e8b48a', 'eyes': 'brown',
                  'sel': {'hair': 'hair.long', 'brows': 'brows.thin', 'outfit': 'outfit.f_gown_belle', 'hat': 'hat.tiara', 'earrings': 'earrings.simple'},
                  'col': {'hair': '#4a2f1d', 'top': '#ffffff', 'metal': '#d8b55a'}, 'proc': {'veil': True, 'bouquet': True}},
        'guest_male': {'body': 'male', 'skin': '#e8b48a', 'eyes': 'brown',
                       'sel': {'hair': 'hair.parted', 'brows': 'brows.thin', 'outfit': 'outfit.m_shirt', 'shoes': 'shoes.shoes_basic'},
                       'col': {'hair': '#4a2f1d', 'top': '#2f5fa8', 'bottom': '#1b2a49', 'shoes': '#3b2417'}, 'proc': {}},
        'guest_female': {'body': 'female', 'skin': '#e8b48a', 'eyes': 'brown',
                         'sel': {'hair': 'hair.bob', 'brows': 'brows.thin', 'outfit': 'outfit.f_kimono', 'shoes': 'shoes.sandals'},
                         'col': {'hair': '#4a2f1d', 'top': '#6a2c91', 'top2': '#c9a24a', 'bottom': '#111111', 'shoes': '#3b2417'}, 'proc': {}},
    },
}

out_cat = os.path.join(ROOT, 'lib', 'avatar', 'catalog.json')
os.makedirs(os.path.dirname(out_cat), exist_ok=True)
json.dump(catalog, open(out_cat, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(ROOT, 'tools', 'lpc-needed.txt'), 'w').write('\n'.join(sorted(needed)) + '\n')

# SQL: الأصناف المقيّدة بالدور
rows = [(i['id'], i['roles']) for i in items if i['roles']] + [(f"proc.{p['id']}", p['roles']) for p in PROC if p.get('roles')]
sql = ['-- يُولَّد تلقائيًا من tools/gen_lpc_catalog.py — لا تعدّله يدويًا.',
       '-- أصناف الشخصية المقيّدة بالدور (allowed_roles) والتحقق منها في الخادم.',
       'create table if not exists public.avatar_items (id text primary key, allowed_roles text[] not null);',
       'alter table public.avatar_items enable row level security;',
       'drop policy if exists avatar_items_read on public.avatar_items;',
       'create policy avatar_items_read on public.avatar_items for select using (true);',
       'grant select on public.avatar_items to authenticated;',
       'truncate public.avatar_items;']
DBROLE = {'groom': 'husband', 'bride': 'wife', 'guest': 'guest'}
for id_, roles in rows:
    r = ','.join("'%s'" % DBROLE[x] for x in roles)
    sql.append(f"insert into public.avatar_items values ('{id_}', array[{r}]);")
sql.append('''
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
''')
open(os.path.join(ROOT, 'supabase', '003_avatar_items.sql'), 'w', encoding='utf-8').write('\n'.join(sql))

print('items:', len(items), '| skipped:', skipped)
print('files needed:', len(needed))
print('by top folder:')
from collections import Counter
c = Counter(p.split('/')[0] for p in needed)
for k, v in c.most_common():
    print('  ', k, v)
