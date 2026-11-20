#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build.sh — ساخت APK پوستهٔ اندروید سامانهٔ الو شتاب (نسخهٔ 1.1.0)
# پیش‌نیاز: JDK 17+ (فقط java) و Android SDK شامل build-tools;34.0.0 و platforms;android-34
# مصرف:  ANDROID_HOME=/path/to/android-sdk ./build.sh [فایل خروجی]
# متغیرها: VERSION_CODE (پیش‌فرض 2) ، VERSION_NAME (پیش‌فرض 1.1.0)
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:?متغیر ANDROID_HOME تنظیم نشده است}"
BT="$SDK/build-tools/34.0.0"
PLAT="$SDK/platforms/android-34/android.jar"
OUT="${1:-AloShetab.apk}"
KS="${KS:-aloshetab.keystore}"
KS_PASS="${KS_PASS:-aloshetab1405}"
VC="${VERSION_CODE:-2}"
VN="${VERSION_NAME:-1.1.0}"

echo "── ۱) کامپایل منابع (aapt2 compile)"
$BT/aapt2 compile --dir res -o /tmp/as_res.zip

echo "── ۲) پیوند (aapt2 link) + دارایی‌ها"
$BT/aapt2 link -o /tmp/as_base.apk -I "$PLAT" \
  --manifest AndroidManifest.xml -A assets \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VC" --version-name "$VN" \
  --auto-add-overlay /tmp/as_res.zip

echo "── ۳) کامپایل جاوا (ecj با encoding=UTF-8) + d8"
rm -rf classes dexout && mkdir -p classes dexout
ECJ="$(ls ../ecj.jar 2>/dev/null || ls ./ecj.jar 2>/dev/null || true)"
if [ -z "$ECJ" ]; then
  curl -fsS -o ./ecj.jar https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar
  ECJ=./ecj.jar
fi
java -jar "$ECJ" -encoding UTF-8 -source 8 -target 8 -proc:none -nowarn \
  -cp "$PLAT" -d classes $(find java -name '*.java')
$BT/d8 --release --min-api 24 --lib "$PLAT" --output dexout $(find classes -name '*.class')

echo "── ۴) افزودن classes.dex به بسته"
(cd dexout && zip -q ../as_base.apk classes.dex) || (cd dexout && zip -q /tmp/as_base.apk classes.dex)

echo "── ۵) zipalign (با -p برای تراز صفحهٔ کتابخانه‌های بومی)"
$BT/zipalign -f -p 4 /tmp/as_base.apk /tmp/as_aligned.apk

echo "── ۶) امضا (apksigner) — کلید: $KS"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias aloshetab -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=AloShetab,O=AloShetab,L=Tehran,C=IR"
fi
$BT/apksigner sign --ks "$KS" --ks-pass pass:"$KS_PASS" --key-pass pass:"$KS_PASS" \
  --out "$OUT" /tmp/as_aligned.apk
$BT/apksigner verify "$OUT" && echo "OK — APK نسخهٔ $VN ساخته و امضا شد: $OUT"
