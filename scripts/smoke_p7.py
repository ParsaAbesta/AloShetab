# -*- coding: utf-8 -*-
"""
آزمون دود یکپارچهٔ پیام ۷ — تست، اشکال‌زدایی و استقرار Production سامانه الو شتاب
پوشش: سلامت، کاتالوگ، سفارش/معرف، پرداخت، پیگیری، ادمین، رضایت، تسویه محرمانه،
      ممیزی کامل محرمانگی سهم‌ها (۴/۷–۱/۷–۲/۷) روی همهٔ پاسخ‌های API و رابط کاربری،
      احراز هویت ادمین، و سرویس‌های جانبی (محصول، سرمایه‌گذار، صندوق، تماس، متفرقه).
"""
import json
import re
import sqlite3
import urllib.request
import urllib.error

BASE = 'http://localhost:3000'
ADMIN_COOKIE = {'Cookie': 'as_admin=AloShetab1404'}
DB = 'db/custom.db'

PASS = 0
FAIL = 0
LEAK_KEYS = {'workershare', 'companyshare', 'worker_share', 'company_share',
             'earnedtotal', 'totalunpaid', 'totalpaid', 'unpaidreferrals'}


def ck(cond, label):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'PASS: {label}')
    else:
        FAIL += 1
        print(f'FAIL: {label}')


def req(path, method='GET', body=None, admin=False):
    headers = {'Content-Type': 'application/json'}
    if admin:
        headers.update(ADMIN_COOKIE)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def leak_scan(obj, path='$'):
    """بازگشتی: هر کلیدی با نام سهم در هر سطح از پاسخ = نشت (تطبیق دقیق نام کلید)"""
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in LEAK_KEYS:
                hits.append(f'{path}.{k}')
            hits += leak_scan(v, f'{path}.{k}')
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += leak_scan(v, f'{path}[{i}]')
    return hits


print('══ ۱) سلامت و کاتالوگ رسمی ══')
st, health = req('/api')
ck(st == 200, f'سلامت سرویس — {health.get("system", health)}')
st, svc = req('/api/services')
svcs = svc.get('services', [])
ck(st == 200 and len(svcs) == 105, f'۱۰۵ خدمت فعال (۱۰۴ رسمی + متفرقه) — دریافتی: {len(svcs)}')
cats = set(s.get('category', '') for s in svcs)
ck(len(cats) == 20, f'۲۰ دستهٔ رسمی — دریافتی: {len(cats)}')
ck(len([s for s in svcs if s.get('percentValue') is not None]) == 4, '۴ خدمت کارمزد درصدی')
hits = leak_scan(svc)
ck(not hits, f'کاتالوگ بدون فیلد سهم — {hits or "پاک"}')

print('══ ۲) سفارش: بدون و با کد معرف (تخفیف ۵٪) ══')
st, o0 = req('/api/orders', 'POST', {
    'items': [{'key': 'c2-0', 'qty': 1}],
    'customer': {'fullName': 'مینا رضایی', 'nationalId': '0069988771', 'mobile': '09125556677', 'address': 'تهران، پیروزی، پلاک ۷۷'},
    'mode': 'ONSITE'})
CODE0 = o0.get('code', '')
ck(st == 200 and bool(CODE0), f'ثبت سفارش مبنای معرف — {CODE0}')
st, o1 = req('/api/orders', 'POST', {
    'items': [{'key': 'c2-0', 'qty': 2}],
    'customer': {'fullName': 'علی صادقی', 'nationalId': '0031122334', 'mobile': '09124445566', 'address': 'کرج، عظیمیه، بلوار طالقانی، پلاک ۱۵'},
    'mode': 'ONSITE', 'referralCode': '0069988771'})
CODE = o1.get('code', '')
ck(st == 200 and bool(CODE), f'ثبت سفارش با کد معرف — {CODE}')
ck(o1.get('quote', {}).get('discount', 0) > 0, f'تخفیف معرف ۵٪ اعمال شد ({o1.get("quote", {}).get("discount", 0):,} تومان)')
hits = leak_scan(o1)
ck(not hits, f'پاسخ ثبت سفارش بدون فیلد سهم — {hits or "پاک"}')

print('══ ۳) پرداخت درگاه شبیه‌سازی‌شده ══')
st, pay = req('/api/payments', 'POST', {'action': 'init', 'code': CODE, 'mobile': '09124445566', 'method': 'GATEWAY'})
PID = pay.get('paymentId', '')
ck(st == 200 and bool(PID), 'شروع تراکنش درگاه')
st, conf = req('/api/payments', 'POST', {'action': 'gateway-confirm', 'paymentId': PID, 'cardNumber': '6037998140974550', 'pin2': '123456', 'otp': '12345'})
ck(st == 200 and conf.get('ok') is True, 'تأیید پرداخت (کارت ← رمز دوم ← OTP)')

print('══ ۴) پیگیری — ممیزی محرمانگی مشتری ══')
st, trk = req('/api/orders/track', 'POST', {'code': CODE, 'mobile': '09124445566'})
hits = leak_scan(trk)
ck(st == 200 and not hits, f'پاسخ پیگیری بدون هیچ فیلد سهم — {hits or "پاک"}')
ck(trk.get('order', {}).get('status') == 'PAID', 'وضعیت پس از پرداخت: PAID')

print('══ ۵) پنل ادمین — اعزام و انجام ══')
con = sqlite3.connect(DB)
WID = con.execute("select id from Worker where status='APPROVED' limit 1").fetchone()[0]
OID = con.execute('select id from [Order] where code=?', (CODE,)).fetchone()[0]
st, r = req(f'/api/admin/orders/{OID}', 'PATCH', {'action': 'assign-worker', 'workerId': WID}, admin=True)
ck(st == 200 and r.get('ok'), 'تعیین همکار مجری')
for s2 in ('SCHEDULED', 'IN_PROGRESS', 'DONE'):
    st, r = req(f'/api/admin/orders/{OID}', 'PATCH', {'action': 'set-status', 'status': s2}, admin=True)
    ck(st == 200 and r.get('ok'), f'انتقال وضعیت به {s2}')

print('══ ۶) ممیزی محرمانگی پاسخ‌های ادمین (مهم‌ترین آزمون پیام ۷) ══')
st, al = req('/api/admin/orders?take=50', admin=True)
hits = leak_scan(al)
ck(st == 200 and not hits, f'فهرست سفارش ادمین بدون workerShare/companyShare/earnedTotal — {hits or "پاک"}')
if st == 200 and al.get('orders'):
    sample = al['orders'][0]['items'][0]
    ck('settled' in sample, 'اقلام ادمین دارای نشانگر وضعیت تسویه (settled) بدون مبلغ')
st, ws = req('/api/admin/workers', admin=True)
hits = leak_scan(ws)
ck(st == 200 and not hits, f'فهرست همکاران بدون earnedTotal/سهم — {hits or "پاک"}')
ck('settledJobsCount' in (ws.get('workers') or [{}])[0], 'همکاران: فقط شمارش تسویه‌شده')
st, rf = req('/api/admin/referrals', admin=True)
hits = leak_scan(rf)
ck(st == 200 and not hits, f'فهرست معرفی‌ها بدون مبلغ حق معرف — {hits or "پاک"}')
ck('unpaidCount' in rf and 'paidCount' in rf, 'معرفی‌ها: فقط شمارش پرداخت‌نشده/واریزشده')
st, stats = req('/api/admin/stats', admin=True)
hits = leak_scan(stats)
ck(st == 200 and not hits, f'داشبورد آماری بدون مبلغ حق معرف — {hits or "پاک"}')

print('══ ۷) رضایت مشتری ← تسویهٔ خودکار محرمانه ══')
st, rate = req('/api/orders/rate', 'POST', {'code': CODE, 'mobile': '09124445566', 'skill': 5, 'ethics': 5, 'comment': 'تست پیام ۷'})
ck(st == 200 and rate.get('settled') is True, 'تسویهٔ خودکار پس از ثبت رضایت اجرا شد')
hits = leak_scan(rate)
ck(not hits, f'پاسخ رضایت بدون جزئیات تسویه — {hits or "پاک"}')
ck('workerTotal' not in json.dumps(rate) and 'companyTotal' not in json.dumps(rate), 'بدون workerTotal/companyTotal در پاسخ')

print('══ ۸) صحت موتور تسویه در پایگاه داده (محرمانه — فقط بک‌اند) ══')
tot = con.execute('select total from [Order] where code=?', (CODE,)).fetchone()[0]
rows = con.execute('select workerShare, companyShare from OrderItem oi join [Order] o on o.id=oi.orderId where o.code=? and oi.workerShare>0', (CODE,)).fetchall()
ref = con.execute('select r.amount from Referral r join [Order] o on o.id=r.orderId where o.code=?', (CODE,)).fetchone()
ws_sum = sum(r[0] for r in rows)
cs_sum = sum(r[1] for r in rows)
ck(rows and abs(ws_sum - round(tot * 4 / 7)) <= len(rows), f'سهم مجری = ۴/۷ ({ws_sum:,} از {tot:,})')
ck(ref is not None and abs(ref[0] - round(tot / 7)) <= 1, f'حق معرف = ۱/۷ ({ref[0] if ref else 0:,})')
ck(ws_sum + cs_sum == tot, 'جمع سهم‌ها = مبلغ کل (بدون کسری)')
con.close()

print('══ ۹) ماسک مبالغ سهم در گزارش‌ها و لاگ‌های UI ══')
st, rep = req('/api/admin/reports', admin=True)
digit_re = re.compile(r'[\d۰-۹٠-٩][\d۰-۹٠-٩٬,.\u066C]*')
bad = []
for rpt in rep.get('reports', []):
    body = rpt.get('body', '')
    for line in body.split('\n'):
        if any(p in line for p in ('سهم انجام‌دهنده', 'حق معرف', 'سهم خالص ألو شتاب', 'انجام‌دهنده:', 'ألو شتاب:')):
            if digit_re.search(line):
                bad.append(line[:60])
ck(st == 200 and not bad, f'گزارش‌های UI: خطوط سهم فاقد رقم — {bad[:2] or "پاک"}')
bad_act = [a.get('detail', '')[:60] for a in rep.get('activities', [])
           if any(p in (a.get('detail') or '') for p in ('انجام‌دهنده:', 'ألو شتاب:')) and digit_re.search(a.get('detail') or '')]
ck(not bad_act, f'لاگ فعالیت‌های UI: مبالغ سهم ماسک شده — {bad_act[:2] or "پاک"}')

print('══ ۱۰) احراز هویت ادمین ══')
st, r = req('/api/admin/orders')
ck(st == 401, 'دسترسی ادمین بدون کوکی ← 401')
st, r = req('/api/admin/stats')
ck(st == 401, 'آمار ادمین بدون کوکی ← 401')

print('══ ۱۱) سرویس‌های جانبی هلدینگ ══')
st, r = req('/api/products')
ck(st == 200 and len(r.get('products', [])) > 0, f'میز محصولات — {len(r.get("products", []))} قلم')
st, r = req('/api/invest', 'POST', {'fullName': 'سرمایه‌گذار تست', 'mobile': '09120000001', 'amountRange': 'M_50_200', 'message': 'تست پیام ۷'})
ck(st == 200 and r.get('ok'), 'ثبت درخواست سرمایه‌گذاری')
st, r = req('/api/fund', 'POST', {'kind': 'SUPPORT', 'fullName': 'متقاضی حمایت', 'mobile': '09120000002', 'message': 'تست پیام ۷'})
ck(st == 200 and r.get('ok'), 'ثبت درخواست صندوق حمایت')
st, r = req('/api/contact', 'POST', {'name': 'تماس تست', 'phone': '09120000003', 'subject': 'پیام ۷', 'message': 'آزمون تماس'})
ck(st == 200 and r.get('ok'), 'ثبت پیام تماس با ما')
st, r = req('/api/misc/estimate', 'POST', {'description': 'نصب پرده و لوستر در آپارتمان ۹۰ متری در تهران، کار ساده و استاندارد'})
ck(st == 200 and ('price' in r or 'aiPrice' in r or 'estimate' in r), f'پیش‌قیمت‌گذاری هوش مصنوعی متفرقه — {str(r)[:60]}')
st, r = req('/api/workers', 'POST', {'fullName': 'همکار تست', 'nationalId': '0045566778', 'mobile': '09121112233', 'city': 'تهران', 'field': 'تأسیسات', 'resume': '۱۰ سال سابقه'})
ck(st == 200 and r.get('ok'), 'ثبت‌نام همکار جدید')

print('══ نتیجهٔ نهایی ══')
print(f'PASS={PASS} FAIL={FAIL}')
print('SMOKE7_OK' if FAIL == 0 else 'SMOKE7_FAILED')
