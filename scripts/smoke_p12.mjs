// ─── Smoke test پیام ۱۲ — حداقل فاکتور ۵م، قیمت مرجع بدون افزودنی، افزودنی پرداخت، پیک، تازگی ──
const BASE = 'http://127.0.0.1:3010';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function j(path, opts) {
  const r = await fetch(BASE + path, opts);
  let d = null;
  try { d = await r.json(); } catch {}
  const sc = r.headers.get('set-cookie');
  const cookie = sc ? sc.split(';')[0] : undefined;
  return { status: r.status, d, cookie };
}

const orderBody = (productKey, qty = 1, serviceItems = []) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productKey, qty,
    fullName: 'مشتری آزمون پیام ۱۲',
    mobile: '09121234567',
    address: 'تهران، خیابان آزمون، کوچه تست، ساختمان الو شتاب',
    plaque: '۱۲', floor: '۳', unit: '۴',
    postalCode: '',
    serviceItems,
    notes: null,
  }),
});

async function main() {
  console.log('— Smoke پیام ۱۲ (۱۴۰۵/۰۸/۲۶) —');

  // ۱) میز محصولات: فقط تازه‌ها + پیکربندی پرداخت
  const pr = await j('/api/products');
  ok('GET /api/products', pr.status === 200);
  const goods = pr.d.goods ?? [];
  const software = pr.d.software ?? [];
  ok('kala list non-empty', goods.length > 0, `${goods.length} goods, ${software.length} software`);
  const keys = goods.map((p) => p.key);
  ok('stale legacy hidden (cctv-kit absent)', !keys.includes('cctv-kit'));
  ok('fridge present', keys.includes('fridge-taksan-rfn24'));
  ok('washer present', keys.includes('washer-lg-y1-7kg'));
  ok('tv present', keys.includes('tv-samsung-du8000-55'));
  ok('cooler present', keys.includes('cooler-trust-12000'));
  ok('heater present', keys.includes('heater-absal-437'));
  const mouse = goods.find((p) => p.key === 'mouse-q5');
  ok('list price = source price (mouse 1,312,000)', mouse?.price === 1_312_000, `price=${mouse?.price}`);
  ok('checkout.minInvoice = 5,000,000', pr.d.checkout?.minInvoice === 5_000_000);
  ok('mouse courierFee = 250,000 (light)', mouse?.courierFee === 250_000, `${mouse?.courierFee}`);
  const heater = goods.find((p) => p.key === 'heater-absal-437');
  ok('heater courierFee = 750,000 (heavy)', heater?.courierFee === 750_000, `${heater?.courierFee}`);
  const cooler = goods.find((p) => p.key === 'cooler-trust-12000');
  ok('cooler rule B → markupPct 0.15', cooler?.markupPct === 0.15, `pct=${cooler?.markupPct}`);
  ok('cooler list = warehouse 55,000,000', cooler?.price === 55_000_000, `price=${cooler?.price}`);
  const swAnt = software.find((p) => p.key === 'sw-antivirus');
  ok('software courierFee = 0', swAnt?.courierFee === 0);

  // ۲) سفارش کالای کوچک → تعدیل به حداقل فاکتور ۵م + شبا
  const o1 = await j('/api/products/order', orderBody('mouse-q5', 1));
  ok('order small goods', o1.status === 200, o1.d?.error ?? '');
  const bd1 = o1.d?.breakdown ?? {};
  ok('small: markup = +33% of 1,312,000 = 433,000', bd1.markupAmount === 433_000, `${bd1.markupAmount}`);
  ok('small: courierFee 250,000', bd1.courierFee === 250_000);
  ok('small: minInvoiceAdj 3,005,000', bd1.minInvoiceAdj === 3_005_000, `${bd1.minInvoiceAdj}`);
  ok('small: payable = 5,000,000', o1.d?.total === 5_000_000, `${o1.d?.total}`);
  ok('small: paySheba true', o1.d?.paySheba === true);
  ok('small: sheba = IR430170000000345884841004', o1.d?.sheba === 'IR430170000000345884841004');
  ok('small: bank name محرمانه نیست — شبا عمومی', !!o1.d?.sheba);

  // ۳) سفارش کالای سنگین (بخاری آبسال ۱۱م) → بدون تعدیل، پیک ۷۵۰ هزار
  const o2 = await j('/api/products/order', orderBody('heater-absal-437', 1));
  const bd2 = o2.d?.breakdown ?? {};
  ok('heater: markup 33% of 11,000,000 = 3,630,000', bd2.markupAmount === 3_630_000, `${bd2.markupAmount}`);
  ok('heater: no min adj (11,000,000+3,630,000+750,000 = 15,380,000)', bd2.beforeMin === 15_380_000 && bd2.minInvoiceAdj === 0, `beforeMin=${bd2.beforeMin}`);
  ok('heater payable = 15,380,000', o2.d?.total === 15_380_000, `${o2.d?.total}`);

  // ۴) قاعدهٔ رقابتی: کولر تراست → افزودنی +۱۵٪
  const o3 = await j('/api/products/order', orderBody('cooler-trust-12000', 1));
  const bd3 = o3.d?.breakdown ?? {};
  ok('cooler: listTotal 55,000,000 (مرجع)', bd3.listTotal === 55_000_000, `${bd3.listTotal}`);
  ok('cooler: markup 15% = 8,250,000', bd3.markupAmount === 8_250_000, `${bd3.markupAmount}`);
  ok('cooler: payable = 64,000,000 (55M+8.25M+0.75M)', o3.d?.total === 64_000_000, `${o3.d?.total}`);

  // ۵) سفارش خدمات کنار خرید روی کالا
  const o4 = await j('/api/products/order', orderBody('mouse-q5', 1, [{ title: 'نصب و راه‌اندازی در محل', price: 850000, qty: 1 }]));
  const bd4 = o4.d?.breakdown ?? {};
  ok('add-on services counted (beforeMin incl 850k)', bd4.servicesTotal === 850_000, `${bd4.servicesTotal}`);
  ok('add-on: payable still 5,000,000 (min)', o4.d?.total === 5_000_000, `${o4.d?.total}`);
  ok('add-on: leadTime includes +1-3', String(o4.d?.leadTimeDays ?? '').includes('1-3'), o4.d?.leadTimeDays);

  // ۶) نرم‌افزار: بدون پیک، حداقل فاکتور اعمال می‌شود
  const o5 = await j('/api/products/order', orderBody('sw-antivirus', 1));
  const bd5 = o5.d?.breakdown ?? {};
  ok('software: courierFee 0', bd5.courierFee === 0);
  ok('software: markup 33% = 924,000', bd5.markupAmount === 924_000, `${bd5.markupAmount}`);
  ok('software: payable = 5,000,000 (min)', o5.d?.total === 5_000_000, `${o5.d?.total}`);

  // ۷) کوت خدمات — تعدیل حداقل فاکتور
  const sv = await j('/api/services');
  const svcList = (sv.d?.services ?? sv.d ?? []).filter?.((s) => s.edition === 'IRAN' && s.baseRate > 0 && s.baseRate < 4_000_000 && s.percentValue == null) ?? [];
  const cheap = svcList[0];
  if (cheap) {
    const q = await j('/api/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ key: cheap.key, qty: 1 }], mode: 'ONSITE' }),
    });
    const qq = q.d?.quote ?? {};
    ok('quote: minInvoiceAdj applied when below 5M', qq.grandTotal === Math.max(qq.total ?? 0, 5_000_000) || qq.grandTotal === (qq.total ?? 0) + (qq.minInvoiceAdj ?? 0), `total=${qq.total} adj=${qq.minInvoiceAdj} grand=${qq.grandTotal}`);
    const or = await j('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ key: cheap.key, qty: 1 }],
        customer: { fullName: 'مشتری آزمون پیام ۱۲', nationalId: '0079123456', mobile: '09121234567', address: 'تهران، خیابان آزمون، پلاک ۱۲، طبقه ۳، واحد ۴' },
        mode: 'ONSITE',
      }),
    });
    ok('service order: total ≥ 5,000,000', (or.d?.total ?? 0) >= 5_000_000, `total=${or.d?.total} adj=${or.d?.minInvoiceAdj}`);
  } else {
    console.log('  ⚠ خدمت ارزان برای تست کوت یافت نشد — رد شد');
  }

  // ۸) تنظیمات عمومی شامل حداقل فاکتور
  const st = await j('/api/settings');
  ok('public settings: MIN_INVOICE_AMOUNT = 5000000', st.d?.settings?.MIN_INVOICE_AMOUNT === '5000000');
  ok('public settings: SHEBA_RECEIVING exposed', st.d?.settings?.SHEBA_RECEIVING === 'IR430170000000345884841004');
  ok('confidential: CARD_1 NOT exposed', st.d?.settings?.CARD_1 === undefined);
  ok('confidential: CARD_2 NOT exposed', st.d?.settings?.CARD_2 === undefined);

  // ۹) جستجو — بدون نتایج کهنه
  const sr = await j('/api/search?q=یخچال');
  const prodHits = (sr.d?.results ?? []).filter((r) => r.type === 'PRODUCT');
  ok('search finds fresh fridge', prodHits.some((r) => r.key === 'fridge-taksan-rfn24'), `${prodHits.length} product hits`);
  const sr2 = await j('/api/search?q=cctv');
  ok('search excludes stale cctv', !((sr2.d?.results ?? []).some((r) => r.type === 'PRODUCT')));

  // ۱۰) پنل ادمین: ورود + گزارش روزانهٔ جدید
  const lg = await j('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'AloShetabAdmin1405' }) });
  ok('admin login', lg.status === 200, `status=${lg.status}`);
  ok('admin cookie as_admin set', !!lg.cookie && lg.cookie.startsWith('as_admin='), lg.cookie ?? 'none');
  const cookie = lg.cookie ?? '';
  const gen = await j('/api/admin/daily-prices', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ action: 'generate' }) });
  ok('daily price report generated', gen.status === 200 || gen.status === 409, `status=${gen.status}`);
  const reports = await j('/api/admin/daily-prices', { headers: { Cookie: cookie } });
  const allReps = reports.d?.reports ?? [];
  const rep = allReps.find((r) => { try { return 'listPrice' in JSON.parse(r.itemsJson)[0]; } catch { return false; } });
  if (rep) {
    const items = JSON.parse(rep.itemsJson);
    ok('report item has listPrice + fresh fields', items.length > 0 && 'listPrice' in items[0] && 'fresh' in items[0]);
    // پیام ۱۳: اقلام دارای پیشنهاد فروشگاه، listPrice = بالاترین ارائه‌شده (نه basePrice)
    ok('report listPrice = basePrice (بدون افزودنی) یا سیاست فروشگاه‌ها', items.every((i) => i.listPrice === i.basePrice || String(i.source).includes('فروشگاه‌ها')));
  } else {
    console.log('  ⚠ گزارش با ساختار جدید یافت نشد (گزارش‌های قدیمی فقط newPrice دارند)');
  }

  console.log(`\n=== نتیجه: ${pass} موفق / ${fail} ناموفق ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('SMOKE ERROR', e); process.exit(1); });
