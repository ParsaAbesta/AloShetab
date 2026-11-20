#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build_release_v42.sh — بستهٔ انتشار کامل v4.2 (پیام ۲۰)
#  خروجی: download/alo_shetab_release_v4.2.zip
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd /home/z/my-project
OUT=/home/z/my-project/download/alo_shetab_release_v4.2.zip
rm -f "$OUT"
zip -q -r -9 "$OUT" \
  Caddyfile DEPLOYMENT.md bun.lock components.json docker-compose.yml \
  eslint.config.mjs next.config.ts package.json postcss.config.mjs \
  tailwind.config.ts tsconfig.json \
  prisma/schema.prisma alo_shetab_migration.sql \
  public src scripts docs app-build/android-src app-build/admin-src \
  -x "src/**/*.log" "*.log" "scripts/__pycache__/*" "scripts/tool-results/*"
unzip -l "$OUT" | tail -2
unzip -p "$OUT" package.json | grep '"version"'
unzip -p "$OUT" src/lib/constants.ts | grep "VERSION:"
unzip -p "$OUT" src/lib/bonus.ts | head -1
echo "OK — $OUT"
