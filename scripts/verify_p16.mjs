// ─── صحت‌سنجی پیام ۱۶: پلن ۳۳٪ فقط در میز خدمات ──────────────
// اجرا پس از بالا آمدن سرور production روی 3010
const BASE = process.env.BASE || 'http://127.0.0.1:3010';
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
  // ۱) کوت خدمات: افزودنی پلن ۳۳٪ باید روی جمع خدمات (بعد از ضرایب) اعمال شود
  const q = await j('/api/quote', {
    method: 'POST',
    body: JSON.stringify({ items: [{ key: 'c0-0', qty: 1 }], mode: 'ONSITE' }),
  });
  if (q.status !== 200 || !q.d?.quote) {
    ok(false, 'کوت خدمات', `status=${q.status} ${JSON.stringify(q.d).slice(0, 200)}`);
  } else {
    const qt = q.d.quote;
    const expectedMarkup = Math.round(qt.grossTotal * 0.33);
    ok(qt.serviceMarkup === expectedMarkup, 'پلن ۳۳٪ روی جمع خدمات', `gross=${qt.grossTotal} markup=${qt.serviceMarkup}`);
    ok(qt.serviceMarkupPct === 0.33, 'درصد پلن = ۰٫۳۳');
    ok(qt.total === qt.grossTotal + qt.serviceMarkup - qt.discount, 'total = gross + markup − discount', `total=${qt.total}`);
    const svc = await j('/api/services');
    const list = svc.d?.services ?? svc.d ?? [];
    const s0 = Array.isArray(list) ? list.find((s) => s.key === 'c0-0') : null;
    if (s0?.baseRate) ok(qt.subtotal === s0.baseRate, 'جمع پایه برابر نرخ خدمت', `subtotal=${qt.subtotal} rate=${s0.baseRate}`);
  }

  // ۲) ثبت سفارش خدمات و بررسی ذخیرهٔ serviceMarkup
  const ord = await j('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ key: 'c0-0', qty: 1 }],
      customer: {
        fullName: 'آزمون پلن ۳۳',
        nationalId: '0012345678',
        mobile: '09120000001',
        address: 'تهران، خیابان آزمون، پلاک ۱، طبقه ۲، واحد ۳',
      },
      mode: 'ONSITE',
    }),
  });
  ok(ord.status === 200, 'ثبت سفارش خدمات', `status=${ord.status}`);
  const code = ord.d?.code;
  if (code) {
    const tr = await j('/api/orders/track', {
      method: 'POST',
      body: JSON.stringify({ code, mobile: '09120000001' }),
    });
    const o = tr.d?.order;
    ok(tr.status === 200 && o?.serviceMarkup !== undefined, 'serviceMarkup در پیگیری سفارش', `markup=${o?.serviceMarkup}`);
    if (o) {
      // پیام ۱۲: اگر مجموع زیر حداقل فاکتور (۵٬۰۰۰٬۰۰۰) باشد به سقف تعدیل می‌شود
      const rawTotal = o.grossTotal + o.serviceMarkup - o.discount;
      const expectedTotal = rawTotal < 5_000_000 ? 5_000_000 : rawTotal;
      ok(o.total === expectedTotal, 'ذخیرهٔ نهایی درست (با تعدیل حداقل فاکتور)', `gross=${o.grossTotal} markup=${o.serviceMarkup} disc=${o.discount} total=${o.total}`);
      ok(o.serviceMarkup === Math.round(o.grossTotal * 0.33), 'مقدار ذخیره‌شده = ۳۳٪ gross');
    }
  }

  // ۳) میز کالا: بدون پلن ۳۳٪ (پلن v3 دست‌نخورده — کارشناس + پلتفرم)
  const pr = await j('/api/products');
  ok(pr.status === 200, 'API میز کالا پاسخ می‌دهد');
  const txt = JSON.stringify(pr.d ?? {});
  ok(!txt.includes('serviceMarkup'), 'میز کالا فیلد پلن ۳۳٪ (خدمات) ندارد');
  const withPct = (pr.d?.products ?? pr.d ?? []).find?.((p) => p && typeof p.markupPct === 'number');
  if (withPct) ok(withPct.markupPct === 0.30, 'پلن v3 کالا حفظ شده (۰٫۳۰ = کارشناس + پلتفرم)', `key=${withPct.key} markupPct=${withPct.markupPct}`);

  console.log(`\n== ${pass} موفق / ${fail} ناموفق ==`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
