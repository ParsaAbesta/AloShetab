// ─── صحت‌سنجی پیام ۱۸: پلن مالی V4.0 — پورسانت معرف فقط فاکتور اول ──
// اجرا پس از بالا آمدن سرور production روی 3010
const BASE = process.env.BASE || 'http://127.0.0.1:3010';
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  cond ? pass++ : fail++;
};

async function j(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let d = null;
  try { d = await res.json(); } catch {}
  return { status: res.status, d };
}

async function main() {
  // پاکسازی داده‌های آزمون قبلی (تکرارپذیری)
  const oldCust = await db.customer.findUnique({ where: { nationalId: '0034567890' } });
  if (oldCust) {
    const olds = await db.order.findMany({ where: { customerId: oldCust.id } });
    for (const o of olds) await db.order.delete({ where: { id: o.id } }).catch(() => {});
  }
  await db.productOrder.deleteMany({ where: { mobile: '09120000300' } });

  const settings = await db.setting.findMany();
  const smap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const firstDisc = parseFloat(smap.FIRST_INVOICE_DISCOUNT_PCT || '10') / 100;
  const svcRefFirst = parseFloat(smap.SERVICES_REFERRER_PCT_FIRST || '10') / 100;

  // یک معرف معتبر بساز (مشتریِ از قبل ثبت‌شده)
  const refNat = '0023456789';
  await db.customer.upsert({
    where: { nationalId: refNat },
    update: {},
    create: { fullName: 'معرف آزمون پلن ۱۸', nationalId: refNat, mobile: '09120000200', address: 'تهران، خیابان آزمون معرف، پلاک ۱' },
  });

  // ۱) کوت خدمات بدون معرف: total = gross (بدون افزودنی) | serviceMarkup = ۳۳٪ اجرت (درون اجرت)
  const q0 = await j('/api/quote', { method: 'POST', body: JSON.stringify({ items: [{ key: 'c0-0', qty: 1 }], mode: 'ONSITE' }) });
  if (q0.status !== 200 || !q0.d?.quote) {
    ok(false, 'کوت خدمات', `status=${q0.status} ${JSON.stringify(q0.d).slice(0, 200)}`);
  } else {
    const qt = q0.d.quote;
    ok(qt.total === qt.grossTotal, 'بدون افزودنی — total = grossTotal', `gross=${qt.grossTotal} total=${qt.total}`);
    ok(qt.serviceMarkup === Math.round(qt.grossTotal * 0.33), 'سود میز خدمات = ۳۳٪ اجرت (درون اجرت)', `markup=${qt.serviceMarkup}`);
    ok(qt.discount === 0, 'بدون معرف — بدون تخفیف');
  }

  // ۲) کوت با معرف — فاکتور اول: تخفیف ۱۰٪ روی خدمات
  const custNat = '0034567890';
  const q1 = await j('/api/quote', {
    method: 'POST',
    body: JSON.stringify({ items: [{ key: 'c0-0', qty: 1 }], mode: 'ONSITE', referralCode: refNat, customerNationalId: custNat }),
  });
  const gross1 = q1.d?.quote?.grossTotal;
  ok(q1.status === 200 && q1.d?.isFirstInvoice === true, 'تشخیص فاکتور اول مشتری معرفی‌شده', `isFirst=${q1.d?.isFirstInvoice}`);
  ok(q1.d?.quote?.discount === Math.round(gross1 * firstDisc), 'تخفیف ۱۰٪ فاکتور اول (خدمات)', `gross=${gross1} disc=${q1.d?.quote?.discount}`);
  ok(q1.d?.quote?.total === gross1 - Math.round(gross1 * firstDisc), 'total = gross − تخفیف');

  // ۳) گارد سلف-رفرال: معرف = مشتری → ۴۰۰ REFERRAL_SELF (V4.0)
  const selfRef = await j('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ key: 'c0-0', qty: 1 }],
      customer: { fullName: 'سلف-رفرال آزمون', nationalId: custNat, mobile: '09120000009', address: 'تهران، خیابان آزمون، پلاک ۹، طبقه ۱، واحد ۱' },
      mode: 'ONSITE',
      referralCode: custNat,
    }),
  });
  ok(selfRef.status === 400 && selfRef.d?.error === 'REFERRAL_SELF', 'گارد سلف-رفرال (معرف ≠ معرفی‌شده)', `status=${selfRef.status} error=${selfRef.d?.error}`);

  // ۴) ثبت سفارش خدمات (فاکتور اول معرفی‌شده) — پورسانت معرف ۱۰٪ اجرت
  const ord = await j('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ key: 'c0-0', qty: 1 }],
      customer: {
        fullName: 'مشتری آزمون پلن ۱۸',
        nationalId: custNat,
        mobile: '09120000001',
        address: 'تهران، خیابان آزمون، پلاک ۲، طبقه ۱، واحد ۲',
      },
      mode: 'ONSITE',
      referralCode: refNat,
    }),
  });
  ok(ord.status === 200, 'ثبت سفارش خدمات معرف‌دار', `status=${ord.status}`);
  const grossOrd = ord.d?.quote?.grossTotal ?? 0;
  const expDisc = Math.round(grossOrd * firstDisc);
  const expTotal = Math.max(5_000_000, grossOrd - expDisc); // حداقل فاکتور پیام ۱۲
  ok(ord.d?.total === expTotal, 'مبلغ نهایی فاکتور اول (تخفیف + حداقل ۵م)', `total=${ord.d?.total} exp=${expTotal}`);
  const firstOrder = ord.d?.code ? await db.order.findUnique({ where: { code: ord.d.code } }) : null;
  const refRow = firstOrder ? await db.referral.findUnique({ where: { orderId: firstOrder.id } }) : null;
  ok(refRow && refRow.amount === Math.round(grossOrd * svcRefFirst), 'پورسانت معرف فاکتور اول = ۱۰٪ اجرت (محرمانه)', `amount=${refRow?.amount} exp=${Math.round(grossOrd * svcRefFirst)}`);

  // ۵) فاکتور دوم مشتری — V4.0: بدون تخفیف و بدون هیچ پورسانتی برای معرف
  const ord2 = await j('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ key: 'c0-0', qty: 1 }],
      customer: {
        fullName: 'مشتری آزمون پلن ۱۸',
        nationalId: custNat,
        mobile: '09120000001',
        address: 'تهران، خیابان آزمون، پلاک ۲، طبقه ۱، واحد ۲',
      },
      mode: 'ONSITE',
      referralCode: refNat,
    }),
  });
  const secondOrder = ord2.d?.code ? await db.order.findUnique({ where: { code: ord2.d.code } }) : null;
  const refRow2 = secondOrder ? await db.referral.findUnique({ where: { orderId: secondOrder.id } }) : null;
  ok(ord2.status === 200 && ord2.d?.quote?.discount === 0, 'فاکتور دوم — بدون تخفیف', `disc=${ord2.d?.quote?.discount}`);
  ok(!refRow2, 'فاکتور دوم — هیچ پورسانتی برای معرف ثبت نشد (V4.0)', `refRow=${!!refRow2} کد معرف فقط برای رهگیری: ${secondOrder?.referralCode ?? '—'}`);

  // ۶) میز کالا — سفارش اول با معرف: بدون افزودنی، خرید انبار، تخفیف فاکتور اول
  const pr = await j('/api/products');
  ok(pr.status === 200, 'API میز کالا پاسخ می‌دهد');
  const products = pr.d?.products ?? pr.d ?? [];
  const p0 = (Array.isArray(products) ? products : []).find((p) => p && p.price > 0 && p.priceStatus !== 'FROZEN');
  if (!p0) {
    ok(false, 'یافتن کالای قابل سفارش', 'هیچ کالای تازه‌ای نیست');
  } else {
    const mk = (n) => JSON.stringify({
      productKey: p0.key,
      qty: 1,
      fullName: 'خریدار آزمون پلن ۱۸',
      mobile: '09120000300',
      address: `تهران، خیابان آزمون کالا، پلاک ۳${n ? ` — سفارش ${n}` : ''}`,
      plaque: '۳', floor: '۱', unit: '۲',
      referralCode: refNat,
    });
    const po1 = await j('/api/products/order', { method: 'POST', body: mk('') });
    ok(po1.status === 200, 'ثبت سفارش کالا معرف‌دار (فاکتور اول)', `status=${po1.status} ${po1.status !== 200 ? JSON.stringify(po1.d).slice(0, 150) : ''}`);
    if (po1.status === 200) {
      const bd = po1.d;
      const list = bd.goodsTotal;
      const expDiscG = Math.round(list * firstDisc);
      const expPay = Math.max(5_000_000, list - expDiscG);
      ok(bd.discount === expDiscG, 'تخفیف ۱۰٪ فاکتور اول کالا', `disc=${bd.discount} exp=${expDiscG}`);
      ok(bd.total === expPay, 'پرداخت کالا = فروش − تخفیف (بدون افزودنی) با تعدیل حداقل', `total=${bd.total} exp=${expPay}`);
      const poRow1 = await db.productOrder.findUnique({ where: { code: bd.code } });
      ok(poRow1 && poRow1.firstInvoice === true, 'firstInvoice=true ثبت شد');
      ok(poRow1 && poRow1.referrerCode === refNat, 'referrerCode ثبت شد');
      ok(poRow1 && poRow1.purchaseAmount === Math.min(p0.basePrice || 0, p0.price) * 1, 'خرید انبار ثبت شد', `purchase=${poRow1?.purchaseAmount} base=${p0.basePrice}`);
      ok(bd.goodsProfit === list - (poRow1?.purchaseAmount ?? 0) - bd.courierFee, 'سود کالا = فروش − خرید − پیک', `profit=${bd.goodsProfit}`);

      // ۷) تسویهٔ کالا سفارش اول — معرف ۲۰٪ سود (فقط فاکتور اول)؛ مسیر بانکی
      const loginRes = await fetch(`${BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'AloShetab1404' }),
      });
      ok(loginRes.status === 200, 'ورود ادمین برای تسویه', `status=${loginRes.status}`);
      const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
      const negotiatedPurchase = Math.round(list * 0.7); // خرید توافقی نهایی — حاشیه ۳۰٪
      const res1 = await fetch(`${BASE}/api/admin/product-orders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ id: poRow1.id, status: 'DELIVERED', purchaseAmount: negotiatedPurchase }),
      });
      const sd1 = await res1.json().catch(() => null);
      const stt1 = sd1?.settlement;
      const profit1 = list - negotiatedPurchase - bd.courierFee;
      const expRef1 = profit1 > 0 ? Math.round(profit1 * 0.20) : 0;
      ok(res1.status === 200 && stt1, 'تسویهٔ کالا در تحویل (سفارش اول)', `status=${res1.status}`);
      if (stt1) {
        ok(stt1.profit === profit1, 'سود کالا محاسبه شد', `profit=${stt1.profit}`);
        ok(stt1.referrer === expRef1, 'پورسانت معرف کالا = ۲۰٪ سود (فقط فاکتور اول)', `ref=${stt1.referrer} exp=${expRef1}`);
        ok(stt1.company === profit1 - expRef1, 'سود شرکت کالا = باقیمانده (۸۰٪ فاکتور اول)', `company=${stt1.company}`);
        ok(stt1.banks?.melli?.card === '6037998140974550' && stt1.banks?.melli?.amount === stt1.company, 'مسیر بانک ملی ← سود شرکت', `melli=${stt1.banks?.melli?.amount}`);
        ok(stt1.banks?.mehr?.card === '6063731121468624' && stt1.banks?.mehr?.amount === negotiatedPurchase + bd.courierFee + expRef1, 'مسیر بانک مهر ← خرید+پیک+معرف', `mehr=${stt1.banks?.mehr?.amount}`);
      }

      // ۸) سفارش دوم همان خریدار با معرف — V4.0: firstInvoice=false و بدون پورسانت
      const po2 = await j('/api/products/order', { method: 'POST', body: mk('2') });
      ok(po2.status === 200 && po2.d?.isFirstInvoice === false, 'سفارش دوم کالا — firstInvoice=false', `isFirst=${po2.d?.isFirstInvoice}`);
      if (po2.status === 200) {
        const poRow2 = await db.productOrder.findUnique({ where: { code: po2.d.code } });
        const res2 = await fetch(`${BASE}/api/admin/product-orders`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ id: poRow2.id, status: 'DELIVERED', purchaseAmount: negotiatedPurchase }),
        });
        const sd2 = await res2.json().catch(() => null);
        const stt2 = sd2?.settlement;
        const profit2 = list - negotiatedPurchase - bd.courierFee;
        ok(res2.status === 200 && stt2 && stt2.referrer === 0, 'سفارش دوم کالا — پورسانت معرف صفر (V4.0)', `ref=${stt2?.referrer}`);
        ok(stt2 && stt2.company === profit2, 'سفارش دوم کالا — شرکت کل سود (۱۰۰٪)', `company=${stt2?.company} exp=${profit2}`);
        // پاکسازی سفارش‌های آزمون کالا
        await db.productOrder.delete({ where: { id: poRow2.id } }).catch(() => {});
      }
      await db.productOrder.delete({ where: { id: poRow1.id } }).catch(() => {});
    }
  }

  await db.$disconnect();
  console.log(`\n== پیام ۱۸ (V4.0): ${pass} موفق / ${fail} ناموفق ==`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
