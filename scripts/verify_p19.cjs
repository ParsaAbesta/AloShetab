// ─── صحت‌سنجی پیام ۱۹ (V4.1): قفل سود بلاصاحب → بانک ملی + رفع باگ‌ها + پاداش سقف‌دار دوره‌ای ──
// اجرا پس از بالا آمدن سرور production روی 3010 (پس از verify_p18 — وابسته به دادهٔ آن)
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

/** کلید دورهٔ شمسی جاری با Intl (تقویم persian) */
function jalaliPeriodKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Tehran' }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value.replace(/\D/g, '') ?? '';
  const m = parts.find((p) => p.type === 'month')?.value.replace(/\D/g, '') ?? '';
  return `${y}-${m.padStart(2, '0')}`;
}

async function adminCookie() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'AloShetab1404' }),
  });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

async function main() {
  const cookie = await adminCookie();
  const AH = { cookie };
  const period = jalaliPeriodKey();

  // ─── پاکسازی تکرارپذیری داده‌های آزمون خود ───
  for (const nat of ['0056789012', '0056789013', '0056789014']) {
    const c = await db.customer.findUnique({ where: { nationalId: nat } });
    if (c) {
      const olds = await db.order.findMany({ where: { customerId: c.id } });
      for (const o of olds) await db.order.delete({ where: { id: o.id } }).catch(() => {});
      await db.customer.delete({ where: { id: c.id } }).catch(() => {});
    }
  }
  for (const mob of ['09120000600', '09120000650', '09120000651', '09120000700', '09120000800']) {
    await db.productOrder.deleteMany({ where: { mobile: mob } });
  }
  // معرف V4.1
  await db.customer.upsert({
    where: { nationalId: '0045678901' },
    update: { mobile: '09120000450' },
    create: { fullName: 'معرف آزمون پلن ۱۹', nationalId: '0045678901', mobile: '09120000450', address: 'تهران، خیابان آزمون ۱۹، پلاک ۱' },
  });
  // سلف-رفرال کالا: خریدار = معرف
  await db.customer.upsert({
    where: { nationalId: '0045678902' },
    update: {},
    create: { fullName: 'سلف-رفرال کالا', nationalId: '0045678902', mobile: '09120000700', address: 'تهران، خیابان آزمون ۱۹، پلاک ۲' },
  });
  // دورهٔ قبلاً بسته‌شدهٔ پاداش را باز کن (تکرارپذیری)
  const bp = await db.setting.findUnique({ where: { key: 'PERIODIC_BONUS_PERIODS' } });
  if (bp && bp.value.split(',').map((x) => x.trim()).includes(period)) {
    await db.setting.update({ where: { key: 'PERIODIC_BONUS_PERIODS' }, data: { value: bp.value.split(',').map((x) => x.trim()).filter((x) => x !== period).join(',') } });
  }
  // دِبت پاداش از اجراهای قبلی آزمون — صفر برای تکرارپذیری
  await db.setting.upsert({ where: { key: 'COMPANY_BONUS_DEBT' }, update: { value: '0' }, create: { key: 'COMPANY_BONUS_DEBT', value: '0' } });

  // ═══ ۱) قفل «سود بلاصاحب → بانک ملی» — تسویهٔ سفارش بدون همکار ═══
  const o1 = await j('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ key: 'c0-0', qty: 1 }],
      customer: { fullName: 'مشتری بلاصاحب ۱۹', nationalId: '0056789012', mobile: '09120000600', address: 'تهران، خیابان آزمون ۱۹، پلاک ۳، طبقه ۱، واحد ۱' },
      mode: 'ONSITE',
    }),
  });
  ok(o1.status === 200, 'ثبت سفارش خدمات بدون همکار', `status=${o1.status}`);
  const code1 = o1.d?.code;
  const row1 = code1 ? await db.order.findUnique({ where: { code: code1 }, include: { items: true } }) : null;
  if (row1) {
    // پرداخت + پیشبرد وضعیت تا DONE
    await db.order.update({ where: { id: row1.id }, data: { paidAt: new Date() } });
    for (const st of ['PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE']) {
      const r = await j(`/api/admin/orders/${row1.id}`, { method: 'PATCH', headers: AH, body: JSON.stringify({ action: 'set-status', status: st }) });
      if (r.status !== 200) { ok(false, `پیشبرد وضعیت به ${st}`, `status=${r.status} ${JSON.stringify(r.d).slice(0, 120)}`); }
    }
    const rate = await j('/api/orders/rate', { method: 'POST', body: JSON.stringify({ code: code1, mobile: '09120000600', skill: 5, ethics: 5 }) });
    ok(rate.status === 200 && rate.d?.settled === true, 'رضایت + تسویهٔ خودکار', `status=${rate.status} settled=${rate.d?.settled}`);
    const after = await db.order.findUnique({ where: { id: row1.id }, include: { items: true } });
    const workerTotal = after.items.reduce((t, it) => t + (it.workerShare ?? 0), 0);
    const collected = after.total - after.partsTotal;
    // فرمول V4.1: شرکت = وصولی − دستمزد پرداختی واقعی − معرف  (نه ۶۷٪ فرضی کل اجرت)
    const expCompany = Math.max(0, collected - workerTotal);
    const logRow = await db.activityLog.findFirst({ where: { action: { contains: `تسویهٔ خودکار ${code1}` } }, orderBy: { createdAt: 'desc' } });
    const m = logRow?.detail?.match(/شرکت\(ملی\): (\d+)/);
    const loggedCompany = m ? parseInt(m[1], 10) : -1;
    ok(workerTotal === 0, 'اقلام بدون همکار — دستمزد پرداختی صفر', `workerTotal=${workerTotal}`);
    ok(loggedCompany === expCompany, 'سود بلاصاحب → بانک ملی (فرمول V4.1 — بدون نشتی)', `logged=${loggedCompany} exp=${expCompany} collected=${collected}`);
    // با کد قدیمی logged = collected − 0.67×gross ≈ 1,650,000 → اختلاف نشتی آشکار می‌شود
    const leakOld = collected - Math.round(row1.grossTotal * 0.67);
    ok(loggedCompany !== leakOld || leakOld === expCompany, 'نشتی قدیم (۶۷٪ فرضی) بسته شد', `leakOld=${leakOld} fixed=${expCompany}`);
    const unclaimedItem = after.items.filter((it) => (it.companyShare ?? 0) === (it.itemAmount ?? 0)).length;
    ok(unclaimedItem === after.items.length, 'سهم اقلام بدون همکار نزد شرکت (امانی)', `items=${after.items.length}`);
  } else {
    ok(false, 'سفارش بلاصاحب ثبت نشد', JSON.stringify(o1.d).slice(0, 150));
  }

  // ═══ ۲) تشخیص یکپارچهٔ فاکتور اول بین دو میز (کالا اول → خدمات دوم بدون پورسانت) ═══
  const pr = await j('/api/products');
  const products = pr.d?.products ?? pr.d ?? [];
  const p0 = (Array.isArray(products) ? products : []).find((p) => p && p.price > 0 && p.priceStatus !== 'FROZEN');
  const mk = (mob, ref) => JSON.stringify({
    productKey: p0.key, qty: 1,
    fullName: 'خریدار یکپارچه ۱۹', mobile: mob,
    address: 'تهران، خیابان یکپارچه، پلاک ۱', plaque: '۱', floor: '۱', unit: '۱',
    referralCode: ref,
  });
  if (p0) {
    const g1 = await j('/api/products/order', { method: 'POST', body: mk('09120000650', '0045678901') });
    ok(g1.status === 200 && g1.d?.isFirstInvoice === true, 'کالا — فاکتور اول مشتری معرفی‌شده', `status=${g1.status} isFirst=${g1.d?.isFirstInvoice}`);
    ok(g1.d?.discount > 0, 'تخفیف ۱۰٪ روی فاکتور اول کالا', `disc=${g1.d?.discount}`);
    // همان خریدار — این بار میز خدمات با همان معرف: نباید «فاکتور اول» باشد
    const s2 = await j('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ key: 'c0-0', qty: 1 }],
        customer: { fullName: 'خریدار یکپارچه ۱۹', nationalId: '0056789013', mobile: '09120000650', address: 'تهران، خیابان یکپارچه، پلاک ۲، طبقه ۱، واحد ۲' },
        mode: 'ONSITE',
        referralCode: '0045678901',
      }),
    });
    const o2 = s2.d?.code ? await db.order.findUnique({ where: { code: s2.d.code } }) : null;
    const ref2 = o2 ? await db.referral.findUnique({ where: { orderId: o2.id } }) : null;
    ok(s2.status === 200 && s2.d?.quote?.discount === 0, 'خدمات پس از خرید کالا — بدون تخفیف «فاکتور اول» (رفع باگ دو-مزیتی)', `disc=${s2.d?.quote?.discount}`);
    ok(!ref2, 'خدمات پس از خرید کالا — هیچ پورسانت دومی برای معرف ثبت نشد', `ref=${!!ref2}`);
  } else {
    ok(false, 'کالای قابل سفارش برای آزمون یکپارچه نیست', '');
  }

  // ═══ ۳) گاردهای معرف در میز کالا (رفع باگ اعتبارسنجی سست) ═══
  if (p0) {
    const self = await j('/api/products/order', { method: 'POST', body: mk('09120000700', '0045678902') });
    ok(self.status === 400 && self.d?.error === 'REFERRAL_SELF', 'سلف-رفرال کالا مسدود شد (خریدار = معرف)', `status=${self.status} error=${self.d?.error}`);
    const inv = await j('/api/products/order', { method: 'POST', body: mk('09120000651', '9999999999') });
    ok(inv.status === 400 && inv.d?.error === 'REFERRAL_INVALID', 'کد معرف نامعتبر در کالا → ۴۰۰ (قبلاً بی‌صدا نادیده می‌شد)', `status=${inv.status} error=${inv.d?.error}`);
  }

  // ═══ ۴) پورسانت معرف کالا در دیتابیس + تب «معرفی‌ها» (رفع باگ ثبت‌نشدن) ═══
  if (p0) {
    const mk4 = (mob, ref) => JSON.stringify({
      productKey: p0.key, qty: 1,
      fullName: 'خریدار پورسانت کالا ۱۹', mobile: mob,
      address: 'تهران، خیابان پورسانت کالا، پلاک ۵', plaque: '۵', floor: '۱', unit: '۱',
      referralCode: ref,
    });
    const g4 = await j('/api/products/order', { method: 'POST', body: mk4('09120000652', '0045678901') });
    ok(g4.status === 200 && g4.d?.isFirstInvoice === true, 'سفارش کالای معرف‌دار برای آزمون ثبت پورسانت', `status=${g4.status} isFirst=${g4.d?.isFirstInvoice}`);
    if (g4.status === 200) {
      const poRow = await db.productOrder.findUnique({ where: { code: g4.d.code } });
      const purchase = Math.round(g4.d.goodsTotal * 0.7); // خرید توافقی — سود مثبت
      const del = await j('/api/admin/product-orders', { method: 'PATCH', headers: AH, body: JSON.stringify({ id: poRow.id, status: 'DELIVERED', purchaseAmount: purchase }) });
      const stt = del.d?.settlement;
      ok(del.status === 200 && stt && stt.referrer > 0, 'تسویهٔ تحویل — پورسانت معرف کالا محاسبه شد', `ref=${stt?.referrer}`);
      const after0 = await db.productOrder.findUnique({ where: { id: poRow.id } });
      ok(after0.referralAmount === stt?.referrer && after0.referralAmount > 0, 'پورسانت معرف کالا در ProductOrder ثبت شد (V4.1 — قبلاً فقط ایمیل بود)', `amount=${after0.referralAmount} exp=${stt?.referrer}`);
      const lst = await j('/api/admin/referrals', { headers: AH });
      const g = lst.d?.goodsReferrals?.find((x) => x.code === poRow.code);
      ok(lst.status === 200 && !!g, 'پورسانت کالا در تب «معرفی‌ها» دیده می‌شود', `found=${!!g} paid=${g?.paid}`);
      const p1 = await j('/api/admin/referrals', { method: 'PATCH', headers: AH, body: JSON.stringify({ goodsId: poRow.id }) });
      ok(p1.status === 200, 'واریز پورسانت کالا (goodsId)', `status=${p1.status}`);
      const p2 = await j('/api/admin/referrals', { method: 'PATCH', headers: AH, body: JSON.stringify({ goodsId: poRow.id }) });
      ok(p2.status === 400 && p2.d?.error === 'ALREADY_PAID', 'واریز تکراری مسدود است', `status=${p2.status}`);
      const after = await db.productOrder.findUnique({ where: { id: poRow.id } });
      ok(after.referralPaid === true && after.referralPaidAt, 'referralPaid ثبت شد', `paid=${after.referralPaid}`);
      await db.productOrder.delete({ where: { id: poRow.id } }).catch(() => {}); // پاکسازی
    }
  }

  // ═══ ۵) پاداش سقف‌دار دوره‌ای (پیام ۲۰ — V4.2: هر ۵ فاکتور → ۵۰۰ هزار تومان) ═══
  // داده: ۵ فاکتور خدمات قطعی‌شده برای معرف 0045678901 (خریدار واحد، سفارش‌های پیاپی) → تسویه
  async function makeReferredOrder(idx, nat, mob, name) {
    const r = await j('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ key: 'c0-0', qty: 1 }],
        customer: { fullName: name, nationalId: nat, mobile: mob, address: 'تهران، خیابان پاداش، پلاک ۴، طبقه ۱، واحد ۱' },
        mode: 'ONSITE',
        referralCode: '0045678901',
      }),
    });
    const row = r.d?.code ? await db.order.findUnique({ where: { code: r.d.code } }) : null;
    if (!row) return null;
    await db.order.update({ where: { id: row.id }, data: { paidAt: new Date() } });
    for (const st of ['PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE']) {
      await j(`/api/admin/orders/${row.id}`, { method: 'PATCH', headers: AH, body: JSON.stringify({ action: 'set-status', status: st }) });
    }
    await j('/api/orders/rate', { method: 'POST', body: JSON.stringify({ code: row.code, mobile: mob, skill: 5, ethics: 5 }) });
    return row;
  }
  const o3 = await makeReferredOrder(1, '0056789014', '09120000800', 'معرفی‌شدهٔ پاداش ۱۹');
  ok(!!o3, 'سفارش معرف‌دار اول برای دورهٔ پاداش (فاکتور اول — با تخفیف)', `code=${o3?.code}`);
  for (let i = 2; i <= 5; i++) {
    await makeReferredOrder(i, '0056789014', '09120000800', 'معرفی‌شدهٔ پاداش ۱۹');
  }
  const prev = await j(`/api/admin/periodic-bonus?period=${period}`, { headers: AH });
  ok(prev.status === 200 && prev.d?.enable === true, 'پیش‌نمایش پاداش دوره‌ای', `status=${prev.status} rows=${prev.d?.rows?.length}`);
  const rowFor = prev.d?.rows?.find((r) => r.referrerNat === '0045678901');
  ok(!!rowFor, 'معرف آزمون در دوره مشمول پاداش شد', `bonus=${rowFor?.bonus}`);
  if (rowFor && prev.d) {
    ok(prev.d.invoicesPerReward === 5 && prev.d.rewardToman === 500000, 'قواعد پاداش V4.2 — هر ۵ فاکتور، ۵۰۰ هزار تومان', `per=${prev.d.invoicesPerReward} reward=${prev.d.rewardToman}`);
    const expBatches = Math.floor(rowFor.invoices / prev.d.invoicesPerReward);
    const expBonus = expBatches * prev.d.rewardToman;
    ok(rowFor.bonus === expBonus && rowFor.bonus > 0, 'فرمول پاداش = ⌊فاکتورها ÷ ۵⌋ × ۵۰۰ هزار تومان', `invoices=${rowFor.invoices} bonus=${rowFor.bonus} exp=${expBonus}`);
    ok(rowFor.invoices === 5 && rowFor.batches === 1 && rowFor.bonus === 500000, 'دقیقاً ۵ فاکتور → یک پاداش ۵۰۰ هزار تومانی', `invoices=${rowFor.invoices} batches=${rowFor.batches}`);
  }
  const fin = await j('/api/admin/periodic-bonus', { method: 'POST', headers: AH, body: JSON.stringify({ period }) });
  ok(fin.status === 200 && fin.d?.ok === true, 'بستن دوره و صدور سند پاداش', `status=${fin.status} total=${fin.d?.total}`);
  const fin2 = await j('/api/admin/periodic-bonus', { method: 'POST', headers: AH, body: JSON.stringify({ period }) });
  ok(fin2.status === 409 && fin2.d?.error === 'PERIOD_CLOSED', 'نهایی‌سازی تکراری دوره مسدود است', `status=${fin2.status}`);
  const saved = await db.setting.findUnique({ where: { key: 'PERIODIC_BONUS_PERIODS' } });
  ok(saved && saved.value.split(',').map((x) => x.trim()).includes(period), 'دورهٔ بسته‌شده در تنظیمات ثبت شد', `periods=${saved?.value}`);
  const rep = await db.reportItem.findFirst({ where: { title: { contains: `پاداش سقف‌دار دوره‌ای` }, body: { contains: period } }, orderBy: { createdAt: 'desc' } });
  ok(!!rep, 'سند پاداش در صف ایمیل مالک (محرمانه — فقط بک‌اند)', `title=${rep?.title?.slice(0, 50)}`);

  // ═══ ۶) گارد توقف عملیات در میز خدمات (همسو با کالا) ═══
  await db.setting.upsert({ where: { key: 'OPERATIONS_FROZEN' }, update: { value: 'true' }, create: { key: 'OPERATIONS_FROZEN', value: 'true' } });
  const froz = await j('/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ key: 'c0-0', qty: 1 }], customer: { fullName: 'آزمون فریز', nationalId: '0056789015', mobile: '09120000900', address: 'تهران، خیابان فریز، پلاک ۱، طبقه ۱، واحد ۱' }, mode: 'ONSITE' }) });
  ok(froz.status === 423 && froz.d?.error === 'OPERATIONS_FROZEN', 'توقف عملیات در میز خدمات فعال شد (V4.1)', `status=${froz.status}`);
  await db.setting.upsert({ where: { key: 'OPERATIONS_FROZEN' }, update: { value: 'false' }, create: { key: 'OPERATIONS_FROZEN', value: 'false' } });

  console.log(`\n== پیام ۱۹ (V4.1): ${pass} موفق / ${fail} ناموفق ==`);
  await db.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  await db.$disconnect();
  process.exit(1);
});
