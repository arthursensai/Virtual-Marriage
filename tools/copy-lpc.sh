#!/usr/bin/env bash
# ينسخ ملفات LPC المطلوبة فقط (tools/lpc-needed.txt) إلى public/game/assets/characters/lpc
# الاستعمال (من جذر المشروع):
#   bash tools/copy-lpc.sh /مسار/lpc-bundle/spritesheets
# مثال Termux:
#   bash tools/copy-lpc.sh ~/storage/downloads/lpc-bundle/spritesheets
set -e
SRC="${1:?مرّر مسار مجلد spritesheets}"
DST="${2:-public/game/assets/characters/lpc}"
n=0; miss=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if [ -f "$SRC/$f" ]; then
    mkdir -p "$DST/$(dirname "$f")"
    cp "$SRC/$f" "$DST/$f"
    n=$((n+1))
  else
    echo "مفقود: $f"; miss=$((miss+1))
  fi
done < tools/lpc-needed.txt
echo "نُسخ $n ملفًا، المفقود $miss. الحجم: $(du -sh "$DST" | cut -f1)"
