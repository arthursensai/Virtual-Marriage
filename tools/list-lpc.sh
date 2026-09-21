#!/usr/bin/env bash
# يبني tools/lpc-all-paths.txt (كل ملفات PNG نسبةً إلى مجلد spritesheets) — يلزم فقط عند إعادة توليد الكتالوج.
# الاستعمال: bash tools/list-lpc.sh /مسار/lpc-bundle/spritesheets
set -e
SRC="${1:?مرّر مسار مجلد spritesheets}"
cd "$SRC"
find . -type f -name '*.png' | sed 's#^\./##' > "$OLDPWD/tools/lpc-all-paths.txt"
echo "تم: $(wc -l < "$OLDPWD/tools/lpc-all-paths.txt") ملفًا"
