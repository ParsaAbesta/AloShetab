#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build_apk_v5.sh — APK نهایی الو شتاب V5.0 (پیام ۱۸: پلن مالی V5.0)
#  استفاده: build_apk_v5.sh <EDITION:IR|WORLD>
#  خروجی:
#    download/AloShetab-V5.0-IR.apk     → https://www.aloshetab.ir/?lang=fa&edition=IRAN
#    download/AloShetab-V5.0-World.apk  → https://www.aloshetab.ir/?lang=en&edition=WORLD
# ─────────────────────────────────────────────────────────────
set -euo pipefail
EDITION="${1:-IR}"
SRC=/home/z/my-project/app-build/android-src
SDK=/home/z/my-project/app-build/sdk
BT="$SDK/bt/android-14"
PLAT="$SDK/plat/android-13/android.jar"
ECJ=/home/z/my-project/app-build/ecj.jar
KS="$SRC/aloshetab.keystore"
KS_PASS=aloshetab1405
W=/tmp/apkbuild-v5-$EDITION

if [ "$EDITION" = "WORLD" ]; then
  OUT=/home/z/my-project/download/AloShetab-V5.0-World.apk
  APP_URL="https://www.aloshetab.ir/?lang=en&edition=WORLD"
else
  OUT=/home/z/my-project/download/AloShetab-V5.0-IR.apk
  APP_URL="https://www.aloshetab.ir/?lang=fa&edition=IRAN"
fi

rm -rf "$W" && mkdir -p "$W/classes" "$W/dexout"
cd "$SRC"

# config.json مخصوص نسخه — V5.0 (پیام ۱۸)
mkdir -p "$W/assets"
cat > "$W/assets/config.json" <<EOF
{
  "url": "$APP_URL",
  "name": "الو شتاب",
  "edition": "$EDITION",
  "version": "5.0.0",
  "note": "نسخهٔ نهایی V5.0 — پلن مالی پیام ۱۸ + پاداش دوره‌ای پیام ۲۰ (هر ۵ فاکتور → ۵۰۰ هزار تومان — انتقال لحظه‌ای از ملی به مهر). در صورت عدم فعال بودن DNS دامنه، مقدار url را با آدرس پیش‌نمایش جایگزین و بازسازی کنید. فقط https مجاز است."
}
EOF

echo "── ۱) aapt2 compile ($EDITION)"
"$BT/aapt2" compile --dir res -o "$W/res.zip"

echo "── ۲) aapt2 link"
"$BT/aapt2" link -o "$W/base.apk" -I "$PLAT" \
  --manifest AndroidManifest.xml -A "$W/assets" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 5 --version-name 5.0.0 \
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
