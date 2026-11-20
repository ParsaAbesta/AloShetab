// ─── صحت‌سنجی پیام ۲۰ (V4.2): پاداش سقف‌دار دوره‌ای — «هر ۵ فاکتور از جانب معرف → ۵۰۰ هزار تومان» ──
// مرزهای فرمول: ۴ فاکتور → صفر | ۵ → ۵۰۰٬۰۰۰ | ۹ → ۵۰۰٬۰۰۰ | ۱۰ (خدمات + کالا) → ۱٬۰۰۰٬۰۰۰
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

const REF = '0044332211'; // معرف آزمون پیام ۲۰
const CUST_NAT = '0055443350';
const CUST_MOB = '09120001100';

async function main() {
  const cookie = await adminCookie();
  const AH = { cookie };
  const period = jalaliPeriodKey();

  // ─── پاکسازی تکرارپذیری ───
  const c0 = await db.customer.findUnique({ where: { nationalId: CUST_NAT } });
  if (c0) {
    const olds = await db.order.findMany({ where: { customerId: c0.id } });
    for (const o of olds) await db.order.delete({ where: { id: o.id } }).catch(() => {});
  }
  await db.productOrder.deleteMany({ where: { mobile: CUST_MOB } });
  await db.customer.upsert({
    where: { nationalId: REF },
    update: { mobile: '09120001050' },
    create: { fullName: 'معرف آزمون پیام ۲۰', nationalId: REF, mobile: '09120001050', address: 'تهران، خیابان پیام ۲۰، پلاک ۱' },
  });
  await db.customer.upsert({
    where: { nationalId: CUST_NAT },
    update: { mobile: CUST_MOB },
    create: { fullName: 'معرفی‌شدهٔ آزمون پیام ۲۰', nationalId: CUST_NAT, mobile: CUST_MOB, address: 'تهران، خیابان پیام ۲۰، پلاک ۲، طبقه ۱، واحد ۱' },
  });
  const bp = await db.setting.findUnique({ where: { key: 'PERIODIC_BONUS_PERIODS' } });
  if (bp && bp.value.split(',').map((x) => x.trim()).includes(period)) {
    await db.setting.update({ where: { key: 'PERIODIC_BONUS_PERIODS' }, data: { value: bp.value.split(',').map((x) => x.trim()).filter((x) => x !== period).join(',') } });
  }
  // دِبت پاداش از اجراهای قبلی آزمون — صفر برای تکرارپذیری
  await db.setting.upsert({ where: { key: 'COMPANY_BONUS_DEBT' }, update: { value: '0' }, create: { key: 'COMPANY_BONUS_DEBT', value: '0' } });

  const svcCodes = [];
  const goodsCodes = [];

  const makeSvc = async () => {
    const r = await j('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ key: 'c0-0', qty: 1 }],
        customer: { fullName: 'معرفی‌شدهٔ آزمون پیام ۲۰', nationalId: CUST_NAT, mobile: CUST_MOB, address: 'تهران، خیابان پیام ۲۰، پلاک ۲، طبقه ۱، واحد ۱' },
        mode: 'ONSITE',
        referralCode: REF,
      }),
    });
    if (r.status !== 200 || !r.d?.code) throw new Error(`order fail: ${JSON.stringify(r.d).slice(0, 120)}`);
    const row = await db.order.findUnique({ where: { code: r.d.code } });
    await db.order.update({ where: { id: row.id }, data: { paidAt: new Date() } });
    for (const st of ['PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE']) {
      await j(`/api/admin/orders/${row.id}`, { method: 'PATCH', headers: AH, body: JSON.stringify({ action: 'set-status', status: st }) });
    }
    const rate = await j('/api/orders/rate', { method: 'POST', body: JSON.stringify({ code: row.code, mobile: CUST_MOB, skill: 5, ethics: 5 }) });
    if (rate.d?.settled !== true) throw new Error(`settle fail: ${JSON.stringify(rate.d).slice(0, 120)}`);
    svcCodes.push(row.code);
    return row;
  };

  const fundedSum = async () => {
    if (svcCodes.length + goodsCodes.length === 0) return 0;
    const logs = await db.activityLog.findMany({
      where: {
        OR: [
          ...svcCodes.map((c) => ({ action: { contains: `تسویهٔ خودکار ${c}` } })),
          ...goodsCodes.map((c) => ({ action: { contains: `تسویهٔ کالا ${c}` } })),
        ],
      },
    });
    return logs.reduce((t, l) => {
      const m = (l.detail || '').match(/پاداش دوره‌ای\(مهر\): (\d+)/);
      return t + (m ? parseInt(m[1], 10) : 0);
    }, 0);
  };
  const debtNow = async () => parseInt((await db.setting.findUnique({ where: { key: 'COMPANY_BONUS_DEBT' } }))?.value ?? '0', 10);

  const rowOf = async () => {
    const prev = await j(`/api/admin/periodic-bonus?period=${period}`, { headers: AH });
    return { prev, row: prev.d?.rows?.find((r) => r.referrerNat === REF) ?? null };
  };

  // ═══ مرحلهٔ A — ۴ فاکتور: هنوز پاداشی ندارد (سقف‌دار = فقط دسته‌های کامل ۵تایی) ═══
  for (let i = 1; i <= 4; i++) await makeSvc();
  let { prev, row } = await rowOf();
  ok(prev.status === 200 && prev.d?.enable === true && prev.d?.invoicesPerReward === 5 && prev.d?.rewardToman === 500000, 'قواعد V4.2 از API — هر ۵ فاکتور، ۵۰۰ هزار تومان', `per=${prev.d?.invoicesPerReward} reward=${prev.d?.rewardToman}`);
  ok(!row, '۴ فاکتور → بدون پاداش (فقط دسته‌های کامل ۵تایی)', `row=${!!row}`);
  ok((await fundedSum()) === 0 && (await debtNow()) === 0, '۴ فاکتور → هیچ تومانی از ملی به مهر منتقل نشده', `funded=${await fundedSum()} debt=${await debtNow()}`);

  // ═══ مرحلهٔ B — فاکتور پنجم: در همین لحظه ۵۰۰٬۰۰۰ از واریزی ملی کسر و به مهر می‌رود ═══
  const row5 = await makeSvc();
  ({ prev, row } = await rowOf());
  ok(!!row && row.invoices === 5 && row.batches === 1 && row.bonus === 500000, '۵ فاکتور → یک پاداش ۵۰۰٬۰۰۰ تومانی', `invoices=${row?.invoices} batches=${row?.batches} bonus=${row?.bonus}`);
  const log5 = await db.activityLog.findFirst({ where: { action: { contains: `تسویهٔ خودکار ${row5?.code}` } }, orderBy: { createdAt: 'desc' } });
  const m5 = log5?.detail?.match(/شرکت\(ملی\): (\d+)/);
  const melli5 = m5 ? parseInt(m5[1], 10) : -1;
  const expMelli5 = Math.max(0, (row5?.total ?? 0) - (row5?.partsTotal ?? 0) - 500000);
  ok(melli5 === expMelli5, 'در لحظهٔ فاکتور پنجم: واریزی ملی = سهم شرکت − ۵۰۰٬۰۰۰', `melli=${melli5} exp=${expMelli5}`);
  ok((log5?.detail || '').includes('پاداش دوره‌ای(مهر): 500000'), 'انتقال ۵۰۰٬۰۰۰ به مهر در لاگ تسویه ثبت شد', log5?.detail?.slice(0, 120));
  const debtB = await debtNow();
  ok(debtB === 0, 'بدهی تأمین‌نشده صفر است (تأمین کامل در همین فاکتور)', `debt=${debtB}`);
  const trigRep = await db.reportItem.findFirst({ where: { title: { contains: 'تریگر لحظه‌ای' }, body: { contains: REF } }, orderBy: { createdAt: 'desc' } });
  ok(!!trigRep, 'سند تریگر لحظه‌ای در صف ایمیل مالک (محرمانه)', `title=${trigRep?.title?.slice(0, 45)}`);

  // ═══ مرحلهٔ C — ۹ فاکتور: همچنان یک پاداش (۴ فاکتور مازاد بی‌تأثیر) ═══
  for (let i = 6; i <= 9; i++) await makeSvc();
  ({ prev, row } = await rowOf());
  ok(!!row && row.invoices === 9 && row.batches === 1 && row.bonus === 500000, '۹ فاکتور → همچنان ۵۰۰٬۰۰۰ تومان (کسرِ باقیمانده دوره‌ای است)', `invoices=${row?.invoices} bonus=${row?.bonus}`);

  // ═══ مرحلهٔ D — فاکتور دهم از میز کالا: شمارش یکپارچهٔ دو میز → ۱٬۰۰۰٬۰۰۰ ═══
  const pr = await j('/api/products');
  const products = pr.d?.products ?? pr.d ?? [];
  const p0 = (Array.isArray(products) ? products : []).find((p) => p && p.price > 0 && p.priceStatus !== 'FROZEN');
  if (p0) {
    const g1 = await j('/api/products/order', {
      method: 'POST',
      body: JSON.stringify({
        productKey: p0.key, qty: 1,
        fullName: 'معرفی‌شدهٔ آزمون پیام ۲۰', mobile: CUST_MOB,
        address: 'تهران، خیابان پیام ۲۰، پلاک ۲', plaque: '۲', floor: '۱', unit: '۱',
        referralCode: REF,
      }),
    });
    ok(g1.status === 200, 'فاکتور کالا با کد معرف ثبت شد', `status=${g1.status}`);
    if (g1.status === 200) {
      goodsCodes.push(g1.d.code);
      const poRow = await db.productOrder.findUnique({ where: { code: g1.d.code } });
      const del = await j('/api/admin/product-orders', { method: 'PATCH', headers: AH, body: JSON.stringify({ id: poRow.id, status: 'DELIVERED', purchaseAmount: Math.round(g1.d.goodsTotal * 0.7) }) });
      ok(del.status === 200, 'تحویل کالا — فاکتور قطعی شد', `status=${del.status}`);
    }
  } else {
    ok(false, 'کالای قابل سفارش برای آزمون نبود — شمارش کالا نادیده گرفته شد', '');
  }
  ({ prev, row } = await rowOf());
  ok(!!row && row.invoices === (p0 ? 10 : 9) && row.batches === (p0 ? 2 : 1) && row.bonus === (p0 ? 1000000 : 500000), 'فاکتور کالا هم در شمارش دو-میزه است → پاداش دوم', `invoices=${row?.invoices} batches=${row?.batches} bonus=${row?.bonus}`);
  // پایستگی پول: جمع کسر ملی→مهر + بدهی تأمین‌نشده = کل پاداش‌های صادره (هیچ تومانی گم نمی‌شود)
  const fs = await fundedSum();
  const dbt = await debtNow();
  ok(fs + dbt === (p0 ? 1000000 : 500000), 'جمع انتقال ملی→مهر + بدهی = پاداش‌های صادره (بدون نشتی)', `funded=${fs} debt=${dbt}`);

  // ═══ بستن دوره + گاردها ═══
  const fin = await j('/api/admin/periodic-bonus', { method: 'POST', headers: AH, body: JSON.stringify({ period }) });
  const finRow = fin.d?.rows?.find((r) => r.referrerNat === REF);
  ok(fin.status === 200 && fin.d?.ok === true && !!finRow && finRow.bonus === row?.bonus, 'بستن دوره — سند پاداش با فرمول جدید', `status=${fin.status} bonus=${finRow?.bonus}`);
  const fin2 = await j('/api/admin/periodic-bonus', { method: 'POST', headers: AH, body: JSON.stringify({ period }) });
  ok(fin2.status === 409 && fin2.d?.error === 'PERIOD_CLOSED', 'نهایی‌سازی تکراری دوره مسدود است', `status=${fin2.status}`);
  const rep = await db.reportItem.findFirst({ where: { title: { contains: 'پاداش سقف‌دار دوره‌ای' }, body: { contains: period } }, orderBy: { createdAt: 'desc' } });
  ok(!!rep && rep.body.includes('هر ۵ فاکتور') && rep.body.includes(CUST_MOB === '' ? '' : '۵۰۰٬۰۰۰'), 'سند ایمیل مالک با قاعدهٔ V4.2 (محرمانه — فقط بک‌اند)', `title=${rep?.title?.slice(0, 50)}`);

  // ─── پاکسازی دادهٔ آزمون ───
  const c = await db.customer.findUnique({ where: { nationalId: CUST_NAT } });
  if (c) {
    const olds = await db.order.findMany({ where: { customerId: c.id } });
    for (const o of olds) await db.order.delete({ where: { id: o.id } }).catch(() => {});
    await db.customer.delete({ where: { id: c.id } }).catch(() => {});
  }
  await db.productOrder.deleteMany({ where: { mobile: CUST_MOB } });

  console.log(`\n== پیام ۲۰ (V4.2): ${pass} موفق / ${fail} ناموفق ==`);
  await db.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  await db.$disconnect();
  process.exit(1);
});
