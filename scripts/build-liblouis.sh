#!/usr/bin/env bash
# Builds liblouis to WebAssembly with only the UEB tables, into public/liblouis/.
# Runs inside the emscripten/emsdk container (see .github/workflows/build-liblouis.yml).
# liblouis is LGPL-2.1; its license is copied next to the build output.
set -euo pipefail

VERSION="${LIBLOUIS_VERSION:-3.39.0}"
OUT="$(pwd)/public/liblouis"
WORK="$(mktemp -d)"

curl -fsSL "https://github.com/liblouis/liblouis/releases/download/v${VERSION}/liblouis-${VERSION}.tar.gz" \
  | tar -xz -C "$WORK"
SRC="$WORK/liblouis-${VERSION}"

cd "$SRC"
grep -nE 'noContractions|dotsIO|ucBrl' liblouis/liblouis.h.in || true
# 32-bit widechar so JS strings map to UTF-32 code points without surrogate handling.
emconfigure ./configure --disable-shared --enable-ucs4 --without-yaml
emmake make -C gnulib
emmake make -C liblouis

# Collect en-ueb-g1/g2 and every table they include.
TABLES="$WORK/tables"
mkdir -p "$TABLES"
queue=(en-ueb-g1.ctb en-ueb-g2.ctb)
while [ ${#queue[@]} -gt 0 ]; do
  t="${queue[0]}"
  queue=("${queue[@]:1}")
  [ -f "$TABLES/$t" ] && continue
  cp "tables/$t" "$TABLES/$t"
  for inc in $(grep -E '^\s*include\s' "tables/$t" | awk '{print $2}'); do
    queue+=("$inc")
  done
done
ls -la "$TABLES"

mkdir -p "$OUT"
emcc liblouis/.libs/liblouis.a -O2 \
  -o "$OUT/liblouis.mjs" \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createLiblouis \
  -s ENVIRONMENT=web,node \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_lou_translate","_lou_version","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["UTF8ToString","stringToUTF8","lengthBytesUTF8","HEAP32","HEAPU32","HEAPU8"]' \
  --preload-file "$TABLES@/tables"

cp COPYING.LESSER "$OUT/COPYING.LESSER"
cat > "$OUT/README.md" <<EOF
# liblouis ${VERSION} (WebAssembly build)

Built by \`scripts/build-liblouis.sh\` from the official release:
https://github.com/liblouis/liblouis/releases/tag/v${VERSION}

liblouis is free software under the GNU Lesser General Public License v2.1 or later (see
COPYING.LESSER). Source code: https://github.com/liblouis/liblouis

Tables included: $(ls "$TABLES" | tr '\n' ' ')
EOF
ls -la "$OUT"
