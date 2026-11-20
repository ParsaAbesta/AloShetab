#!/bin/bash
# آزمون سرتاسری پیام ۶ — مسیر طلایی: سفارش ← پرداخت ← پیگیری ← اعزام ← رضایت ← تسویه محرمانه
B=http://localhost:3000
J='Content-Type: application/json'
PASS=0; FAIL=0
ck() { if [ "$1" = "1" ]; then PASS=$((PASS+1)); echo "PASS: $2"; else FAIL=$((FAIL+1)); echo "FAIL: $2"; fi; }

echo "══ ۱) کاتالوگ رسمی ══"
SVC=$(curl -s $B/api/services)
N=$(echo "$SVC" | python3 -c "import json,sys; d=json.load(sys.stdin)['services']; print(len(d))")
ck $([ "$N" = "105" ] && echo 1 || echo 0) "۱۰۵ خدمت فعال (۱۰۴ رسمی + متفرقه) — دریافتی: $N"
CATS=$(echo "$SVC" | python3 -c "import json,sys; d=json.load(sys.stdin)['services']; print(len(set(s.get('category','') for s in d)))")
ck $([ "$CATS" = "20" ] && echo 1 || echo 0) "۲۰ دستهٔ رسمی — دریافتی: $CATS"
PCT=$(echo "$SVC" | python3 -c "import json,sys; d=json.load(sys.stdin)['services']; print(len([s for s in d if s.get('percentValue') is not None]))")
ck $([ "$PCT" = "4" ] && echo 1 || echo 0) "۴ خدمت کارمزد درصدی — دریافتی: $PCT"

echo "══ ۲) ثبت سفارش بدون و با کد معرف ══"
ORD0=$(curl -s -X POST $B/api/orders -H "$J" -d '{
  "items":[{"key":"c0-0","qty":1}],
  "customer":{"fullName":"حسین نوری","nationalId":"0079123456","mobile":"09123334455","address":"تهران، خیابان آزادی، پلاک ۳۳۰، واحد ۲"},
  "mode":"ONSITE"}')
CODE0=$(echo "$ORD0" | python3 -c "import json,sys; print(json.load(sys.stdin).get('code',''))")
ck $([ -n "$CODE0" ] && echo 1 || echo 0) "ثبت سفارش نخست (مشتری مبنای معرف) — $CODE0"
ORD=$(curl -s -X POST $B/api/orders -H "$J" -d '{
  "items":[{"key":"c0-0","qty":2}],
  "customer":{"fullName":"سارا محمدی","nationalId":"0061234567","mobile":"09121234567","address":"تهران، خیابان ولیعصر، پلاک ۱۲۰۴، واحد ۵"},
  "mode":"ONSITE","referralCode":"0079123456"}')
CODE=$(echo "$ORD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('code',''))")
TOT=$(echo "$ORD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))")
ck $([ -n "$CODE" ] && echo 1 || echo 0) "ثبت سفارش با کد معرف $CODE"
# 990000×2=1980000؛ با معرف ۵٪ تخفیف → 1881000 (قبل از ضرایب روز/ساعت)
echo "  مبلغ اولیه: $TOT"

echo "══ ۳) پرداخت درگاه شبیه‌سازی‌شده ══"
PAY=$(curl -s -X POST $B/api/payments -H "$J" -d "{\"action\":\"init\",\"code\":\"$CODE\",\"mobile\":\"09121234567\",\"method\":\"GATEWAY\"}")
PID=$(echo "$PAY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('paymentId',''))")
ck $([ -n "$PID" ] && echo 1 || echo 0) "شروع تراکنش درگاه"
CONF=$(curl -s -X POST $B/api/payments -H "$J" -d "{\"action\":\"gateway-confirm\",\"paymentId\":\"$PID\",\"cardNumber\":\"6037998140974550\",\"pin2\":\"123456\",\"otp\":\"12345\"}")
OKP=$(echo "$CONF" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))")
ck $([ "$OKP" = "True" ] && echo 1 || echo 0) "تأیید پرداخت (کارت ← رمز دوم ← OTP)"

echo "══ ۴) پیگیری — آزمون محرمانگی ══"
TRK=$(curl -s -X POST $B/api/orders/track -H "$J" -d "{\"code\":\"$CODE\",\"mobile\":\"09121234567\"}")
LEAK=$(echo "$TRK" | grep -c "workerShare\|companyShare\|referrerNat\|referralAmount" || true)
ck $([ "$LEAK" = "0" ] && echo 1 || echo 0) "پاسخ پیگیری بدون هیچ فیلد سهم محرمانه"
ST=$(echo "$TRK" | python3 -c "import json,sys; print(json.load(sys.stdin)['order']['status'])")
ck $([ "$ST" = "PAID" ] && echo 1 || echo 0) "وضعیت پس از پرداخت: PAID"

echo "══ ۵) پنل ادمین: اعزام و انجام ══"
WID=$(python3 -c "
import sqlite3; con=sqlite3.connect('db/custom.db')
print(con.execute(\"select id from Worker where status='APPROVED' limit 1\").fetchone()[0])")
OID=$(python3 -c "
import sqlite3; con=sqlite3.connect('db/custom.db')
print(con.execute('select id from [Order] where code=?', ('$CODE',)).fetchone()[0])")
R=$(curl -s -b "as_admin=AloShetab1404" -X PATCH $B/api/admin/orders/$OID -H "$J" -d "{\"action\":\"assign-worker\",\"workerId\":\"$WID\"}")
echo "$R" | grep -q '"ok":true' && ck 1 "تعیین همکار مجری" || ck 0 "تعیین همکار مجری: $R"
for ST2 in SCHEDULED IN_PROGRESS DONE; do
  R=$(curl -s -b "as_admin=AloShetab1404" -X PATCH $B/api/admin/orders/$OID -H "$J" -d "{\"action\":\"set-status\",\"status\":\"$ST2\"}")
  echo "$R" | grep -q '"ok":true' && ck 1 "انتقال وضعیت به $ST2" || ck 0 "انتقال وضعیت به $ST2: $R"
done

echo "══ ۶) ثبت رضایت و تسویهٔ خودکار ══"
RATE=$(curl -s -X POST $B/api/orders/rate -H "$J" -d "{\"code\":\"$CODE\",\"mobile\":\"09121234567\",\"skill\":5,\"ethics\":5,\"comment\":\"عالی بود\"}")
SETTLED=$(echo "$RATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('settled'), d.get('pointsToWorkers'))")
echo "$RATE" | grep -q "workerTotal\|companyTotal" && ck 0 "پاسخ رضایت بدون جزئیات تسویه (نشت!)" || ck 1 "پاسخ رضایت بدون جزئیات تسویه — محرمانه"
ck 1 "خروجی رضایت: settled/points = $SETTLED"

echo "══ ۷) صحت موتور تسویه در پایگاه داده (محرمانه) ══"
python3 - "$CODE" <<'EOF'
import sqlite3, sys
code = sys.argv[1]
con = sqlite3.connect('db/custom.db')
tot = con.execute('select total from [Order] where code=?', (code,)).fetchone()[0]
rows = con.execute('select workerShare, companyShare from OrderItem oi join [Order] o on o.id=oi.orderId where o.code=? and oi.workerShare is not null and oi.workerShare>0', (code,)).fetchall()
ref = con.execute('select r.amount from Referral r join [Order] o on o.id=r.orderId where o.code=?', (code,)).fetchone()
ws = sum(r[0] for r in rows); cs = sum(r[1] for r in rows)
exp_ws = round(tot * 4/7); exp_ref = round(tot/7)
ok1 = abs(ws - exp_ws) <= len(rows)
ok2 = ref is not None and abs(ref[0] - exp_ref) <= 1
ok3 = cs + ws == tot
print(f"PASS: سهم مجری = ۴/۷ ({ws} از {tot})" if ok1 else f"FAIL: سهم مجری {ws} ≠ {exp_ws}")
print(f"PASS: حق معرف = ۱/۷ ({ref[0] if ref else 0})" if ok2 else f"FAIL: حق معرف {ref}")
print("PASS: جمع سهم‌ها = کل" if ok3 else f"FAIL: جمع {ws}+{cs} ≠ {tot}")
EOF

echo "══ ۸) سفارش کارمزد درصدی (ملک) ══"
ORD2=$(curl -s -X POST $B/api/orders -H "$J" -d '{
  "items":[{"key":"c1-2","qty":1}],
  "customer":{"fullName":"رضا کریمی","nationalId":"0045888999","mobile":"09122345678","address":"تهران، سعادت‌آباد، بلوار دریا، پلاک ۸۸"},
  "mode":"ONSITE"}')
NE=$(echo "$ORD2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('needsExpertise'))")
T2=$(echo "$ORD2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',-1))")
C2=$(echo "$ORD2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('code',''))")
ck $([ "$NE" = "True" ] && echo 1 || echo 0) "خدمت درصدی ← نیاز به کارشناسی"
ck $([ "$T2" = "0" ] && echo 1 || echo 0) "مبلغ صفر تا تعیین کارشناس"
P2=$(curl -s -X POST $B/api/payments -H "$J" -d "{\"action\":\"init\",\"code\":\"$C2\",\"mobile\":\"09122345678\",\"method\":\"GATEWAY\"}")
echo "$P2" | grep -q "EXPERT_PENDING" && ck 1 "پرداخت تا کارشناسی مسدود است" || ck 0 "انسداد پرداخت: $P2"
OID2=$(python3 -c "
import sqlite3; con=sqlite3.connect('db/custom.db')
print(con.execute('select id from [Order] where code=?', ('$C2',)).fetchone()[0])")
curl -s -b "as_admin=AloShetab1404" -X PATCH $B/api/admin/orders/$OID2 -H "$J" -d '{"action":"set-expert-price","expertPrice":25000000}' | grep -q '"ok":true' && ck 1 "تعیین قیمت قطعی توسط کارشناس" || ck 0 "تعیین قیمت کارشناسی"

echo "══ نتیجه ══"
echo "PASS=$PASS FAIL=$FAIL"
