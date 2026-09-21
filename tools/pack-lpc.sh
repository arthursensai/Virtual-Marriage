#!/usr/bin/env bash
# يضغط الملفات المطلوبة فقط في lpc-needed.zip (للرفع أو للنقل بين الأجهزة).
# الاستعمال: bash tools/pack-lpc.sh /مسار/lpc-bundle/spritesheets
# داخل الأرشيف نفس المسارات النسبية؛ فكّه داخل public/game/assets/characters/lpc
set -e
SRC="${1:?مرّر مسار مجلد spritesheets}"
OUT="$(pwd)/lpc-needed.zip"
LIST="$(pwd)/tools/lpc-needed.txt"
rm -f "$OUT"
( cd "$SRC" && zip -q "$OUT" -@ < "$LIST" )
echo "تم: $OUT ($(du -h "$OUT" | cut -f1))"
