#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build_apk_admin.sh — اپلیکیشن مجزای پنل مدیریت الو شتاب v3.0 (پیام ۱۴)
#  خروجی: download/AloShetab-Admin-v3.0.apk → https://www.aloshetab.ir/admin
#  دسترسی دو سطحی مالک (OWNER) / ادمین (ADMIN) در سروِیس وب کنترل می‌شود.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
SRC=/home/z/my-project/app-build/admin-src
SDK=/home/z/my-project/app-build/sdk
BT="$SDK/bt/android-14"
PLAT="$SDK/plat/android-13/android.jar"
ECJ=/home/z/my-project/app-build/ecj.jar
KS="$SRC/aloshetab.keystore"
KS_PASS=aloshetab1405
W=/tmp/apkbuild-admin-v3
OUT=/home/z/my-project/download/AloShetab-Admin-v3.0.apk
APP_URL="https://www.aloshetab.ir/admin"

rm -rf "$W" && mkdir -p "$W/classes" "$W/dexout" "$W/assets"
cd "$SRC"

# config.json — url پنل مدیریت
cp assets/config.json "$W/assets/config.json"

echo "── ۱) aapt2 compile"
"$BT/aapt2" compile --dir res -o "$W/res.zip"

echo "── ۲) aapt2 link"
"$BT/aapt2" link -o "$W/base.apk" -I "$PLAT" \
  --manifest AndroidManifest.xml -A "$W/assets" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 3 --version-name 3.0.0 \
  --auto-add-overlay "$W/res.zip"

echo "── ۳) ecj compile (UTF-8) + d8"
java -jar "$ECJ" -encoding UTF-8 -source 8 -target 8 -proc:none -nowarn \
  -cp "$PLAT" -d "$W/classes" $(find java -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$PLAT" --output "$W/dexout" \
  $(find "$W/classes" -name '*.class')

echo "── ۴) افزودن classes.dex"
(cd "$W/dexout" && zip -q "$W/base.apk" classes.dex)

echo "── ۵) zipalign"
"$BT/zipalign" -f -p 4 "$W/base.apk" "$W/aligned.apk"

echo "── ۶) امضا (v1+v2+v3)"
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:"$KS_PASS" --key-pass pass:"$KS_PASS" \
  --out "$OUT" "$W/aligned.apk"

echo "── ۷) تأیید"
"$BT/apksigner" verify --verbose "$OUT" | head -8
"$BT/zipalign" -c -p 4 "$OUT" && echo "zipalign: OK"
"$BT/aapt2" dump badging "$OUT" | head -6
echo "OK — $OUT (url: $APP_URL)"
