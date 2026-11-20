#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build_win_v4.sh — بسته‌های ویندوز V4.0 (مشتری + ادمین) از روی پک v3
#  خروجی:
#    download/AloShetab-Windows-V4.0-x64.zip
#    download/AloShetab-Admin-Windows-V4.0-x64.zip
# ─────────────────────────────────────────────────────────────
set -euo pipefail
DL=/home/z/my-project/download
APP=/home/z/my-project/app-build

build_one() {
  SRCZIP="$1"; SRCDIR="$2"; OUT="$3"
  W=/tmp/win-v4-$(basename "$SRCDIR")
  rm -rf "$W" && mkdir -p "$W"
  unzip -q "$SRCZIP" -d "$W"
  # جایگزینی فایل‌های اپ در resources/app با نسخهٔ V4.0
  APPDIR="$W/win-portable/resources/app"
  rm -rf "$APPDIR"
  mkdir -p "$APPDIR"
  cp "$SRCDIR/main.js" "$SRCDIR/config.json" "$SRCDIR/package.json" \
     "$SRCDIR/icon.ico" "$SRCDIR/icon.png" "$APPDIR/"
  (cd "$W" && zip -q -r -9 "$OUT" win-portable)
  echo "OK — $OUT"
}

build_one "$DL/AloShetab-Windows-v3.0-x64.zip"        "$APP/win-app"        "$DL/AloShetab-Windows-V4.0-x64.zip"
build_one "$DL/AloShetab-Admin-Windows-v3.0-x64.zip"  "$APP/win-app-admin"  "$DL/AloShetab-Admin-Windows-V4.0-x64.zip"

# تأیید محتوای resources/app
for z in "$DL/AloShetab-Windows-V4.0-x64.zip" "$DL/AloShetab-Admin-Windows-V4.0-x64.zip"; do
  echo "── $z"
  unzip -p "$z" win-portable/resources/app/package.json | grep '"version"'
  unzip -p "$z" win-portable/resources/app/config.json  | grep '"version"'
done
