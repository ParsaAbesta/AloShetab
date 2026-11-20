#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build_apk.sh — ساخت APK الو شتاب با SDK دانلودشده در sandbox
# خروجی: /home/z/my-project/download/AloShetab.apk  (v1.1.0, versionCode 2)
# ─────────────────────────────────────────────────────────────
set -euo pipefail
SRC=/home/z/my-project/app-build/android-src
SDK=/home/z/my-project/app-build/sdk
BT="$SDK/bt/android-14"
PLAT="$SDK/plat/android-13/android.jar"
ECJ=/home/z/my-project/app-build/ecj.jar
OUT=/home/z/my-project/download/AloShetab.apk
KS="$SRC/aloshetab.keystore"
KS_PASS=aloshetab1405
W=/tmp/apkbuild

rm -rf "$W" && mkdir -p "$W/classes" "$W/dexout"
cd "$SRC"

echo "── ۱) aapt2 compile"
"$BT/aapt2" compile --dir res -o "$W/res.zip"

echo "── ۲) aapt2 link"
"$BT/aapt2" link -o "$W/base.apk" -I "$PLAT" \
  --manifest AndroidManifest.xml -A assets \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 2 --version-name 1.1.0 \
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
"$BT/apksigner" verify --verbose "$OUT"
"$BT/zipalign" -c -p 4 "$OUT" && echo "zipalign: OK"
"$BT/aapt2" dump badging "$OUT"
echo "OK — $OUT"
