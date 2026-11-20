// ─── Smoke پیام ۱۳ — فروشگاه‌ها، فروش بالاترین/خرید پایین‌ترین توافقی، اتصال لحظه‌ای ──
const BASE = 'http://127.0.0.1:3010';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function j(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  let d = null;
  try { d = await r.json(); } catch {}
  const sc = r.headers.get('set-cookie');
  const cookie = sc ? sc.split(';')[0] : undefined;
  return { status: r.status, d, cookie };
}
const post = (path, body, cookie) => j(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

async function main() {
  console.log('— Smoke پیام ۱۳ (۱۴۰۵/۰۸/۲۷) —');

  // ۱) میز عمومی — تعداد فروشگاه‌های مقایسه‌شده
  const pr = await j('/api/products');
  ok('GET /api/products', pr.status === 200);
  const goods = pr.d.goods ?? [];
  const mouse = goods.find((p) => p.key === 'mouse-q5');
  ok('mouse offersCount ≥ 2', (mouse?.offersCount ?? 0) >= 2, `count=${mouse?.offersCount}`);
  ok('mouse list price = highest offered (1,312,000)', mouse?.price === 1_312_000, `price=${mouse?.price}`);
  const cooler = goods.find((p) => p.key === 'cooler-trust-12000');
  ok('cooler markup stays 15% (competitive rule intact)', cooler?.markupPct === 0.15, `pct=${cooler?.markupPct}`);

  // ۲) ورود ادمین
  const lg = await post('/api/admin/login', { username: 'admin', password: 'AloShetabAdmin1405' });
  ok('admin login', lg.status === 200, `status=${lg.status}`);
  const cookie = lg.cookie ?? '';

  // ۳) فهرست فروشگاه‌ها در پنل ادمین (پیام ۱۳)
  const st = await j('/api/admin/stores', { headers: { Cookie: cookie } });
  ok('GET /api/admin/stores', st.status === 200);
  const stores = st.d.stores ?? [];
  ok('stores ≥ 8 registered', stores.length >= 8, `${stores.length} stores`);
  const dk = stores.find((s) => s.key === 'digikala');
  ok('digikala with DIGIKALA feed + contact info', !!dk && dk.feedType === 'DIGIKALA' && !!dk.phone && !!dk.address, `feed=${dk?.feedType} phone=${dk?.phone}`);
  ok('stores carry sell/buy aggregates', stores.every((s) => 'highestOffer' in s && 'lowestBuy' in s));

  // ۴) اتصال لحظه‌ای به سایت نوسان قیمت (tgju.org)
  const sync = await post('/api/admin/stores', { action: 'sync-reference' }, cookie);
  ok('sync-reference responded', sync.status === 200, `ok=${sync.d?.ok} err=${sync.d?.result?.tgju?.error ?? ''}`);
  if (sync.d?.result?.tgju?.ok) {
    ok('TGJU live quotes received', (sync.d.result.tgju.quotes?.length ?? 0) >= 3, `${sync.d.result.tgju.count} quotes`);
    const dollar = sync.d.result.tgju.quotes.find((q) => q.slug === 'price_dollar_rl');
    ok('dollar quote present', !!dollar && dollar.price > 0, dollar ? `${dollar.price} Toman` : '');
  } else {
    console.log('  ⚠ TGJU in this environment unreachable — graceful error recorded (status shown in admin panel)');
    ok('graceful failure (no fake data)', sync.d?.result?.tgju?.error !== undefined);
  }
  const st2 = await j('/api/admin/stores', { headers: { Cookie: cookie } });
  ok('LiveQuote rows persisted', (st2.d.quotes?.length ?? 0) >= 1, `${st2.d.quotes?.length ?? 0} quotes stored`);

  // ۵) سیاست پیشنهادها برای ماوس Q5
  const inv = await j('/api/admin/inventory?section=GOODS', { headers: { Cookie: cookie } });
  const invMouse = (inv.d.products ?? []).find((p) => p.key === 'mouse-q5');
  ok('inventory offersSummary attached', !!invMouse?.offersSummary, `count=${invMouse?.offersSummary?.count}`);
  const om = await j(`/api/admin/offers?productId=${invMouse.id}`, { headers: { Cookie: cookie } });
  ok('GET /api/admin/offers', om.status === 200);
  const pol = om.d.policy ?? {};
  ok('policy.count = 2 stores', pol.count === 2, `${pol.count}`);
  ok('sellBase = 1,312,000 (بالاترین ارائه‌شده)', pol.sellBase === 1_312_000, `${pol.sellBase}`);
  ok('sellBaseStore = دیجی‌کالا', pol.sellBaseStore === 'دیجی‌کالا', pol.sellBaseStore);
  ok('buyTarget = 1,200,000 (پایین‌ترین توافقی)', pol.buyTarget === 1_200_000, `${pol.buyTarget}`);
  ok('buyTargetStore = تکنولایف', pol.buyTargetStore === 'تکنولایف', pol.buyTargetStore);
  ok('margin = 112,000 (داخلی)', pol.margin === 112_000, `${pol.margin}`);
  ok('markupRule = BASE+33%', pol.markupRule === 'BASE+33%', pol.markupRule);
  ok('offers sorted freshest-first', (om.d.offers?.[0]?.fetchedShamsi ?? '') >= (om.d.offers?.[om.d.offers.length - 1]?.fetchedShamsi ?? '') && (om.d.offers ?? []).every((o) => o.fetchedShamsi >= '1405/08/11'), om.d.offers?.[0]?.fetchedShamsi);

  // ۶) گیت تازگی — پیشنهاد کهنه رد می‌شود
  const staleAdd = await post('/api/admin/offers', { action: 'add', productId: invMouse.id, storeName: 'فروشگاه آزمون کهنه', offeredPrice: 1_300_000, fetchedShamsi: '1405/05/01' }, cookie);
  ok('stale offer rejected (before 1405/08/10)', staleAdd.status === 400 && staleAdd.d?.error === 'PRICE_STALE', `status=${staleAdd.status}`);

  // ۷) پیشنهاد تازهٔ دستی — فروشگاه آزاد
  const freshAdd = await post('/api/admin/offers', { action: 'add', productId: invMouse.id, storeName: 'کالای برتر آزمون', offeredPrice: 1_350_000, negotiatedPrice: 1_250_000, note: 'استعلام تلفنی آزمون' }, cookie);
  ok('fresh manual offer accepted', freshAdd.status === 200, `status=${freshAdd.status}`);
  const om2 = await j(`/api/admin/offers?productId=${invMouse.id}`, { headers: { Cookie: cookie } });
  ok('policy recalculated: count=3, sellBase=1,350,000', om2.d.policy?.count === 3 && om2.d.policy?.sellBase === 1_350_000, `count=${om2.d.policy?.count} sell=${om2.d.policy?.sellBase}`);
  // پاکسازی: غیرفعال‌سازی پیشنهاد آزمون
  const testOffer = (om2.d.offers ?? []).find((o) => o.storeName === 'کالای برتر آزمون');
  const deact = await post('/api/admin/offers', { action: 'deactivate', offerId: testOffer.id }, cookie);
  ok('deactivate test offer', deact.status === 200);

  // ۸) کالای آزمایشی: اعمال کامل سیاست فروش بالاترین/خرید پایین‌ترین (کلید یکتا در هر اجرا)
  const scratchKey = `p13-scratch-${Date.now() % 100000000}`;
  const created = await post('/api/admin/inventory', {
    action: 'create', key: scratchKey, nameFa: 'کالای آزمون سیاست پیام ۱۳', descFa: 'آزمون', descEn: 'test',
    section: 'GOODS', category: 'ماوس', basePrice: 10_000_000, stock: 1, icon: 'mouse',
  }, cookie);
  ok('scratch product created', created.status === 200, created.d?.error ?? JSON.stringify(created.d ?? {}).slice(0, 120));
  const pid = created.d?.product?.id;
  const oA = await post('/api/admin/offers', { action: 'add', productId: pid, storeName: 'فروشگاه الف', offeredPrice: 12_000_000, negotiatedPrice: 9_000_000 }, cookie);
  ok('offer A: 12M offered / 9M negotiated', oA.status === 200);
  const apply = await post('/api/admin/offers', { action: 'apply-policy', productId: pid }, cookie);
  ok('apply-policy executed', apply.status === 200, apply.d?.error ?? '');
  ok('listed price ← highest offered (12,000,000)', apply.d?.product?.price === 12_000_000, `${apply.d?.product?.price}`);
  ok('rule ← SITE+15% (spread > 33%: 12M > 9M×1.33)', apply.d?.policy?.markupRule === 'SITE+15%', apply.d?.policy?.markupRule);
  ok('basePrice ← lowest negotiated (9,000,000)', apply.d?.product?.basePrice === 9_000_000, `${apply.d?.product?.basePrice}`);
  ok('refSource explains policy', String(apply.d?.product?.refSource ?? '').includes('بالاترین قیمت ارائه‌شده'), apply.d?.product?.refSource);
  // صفحهٔ پرداخت روی کالای سیاست‌دار: +۱۵٪ + پیک
  const ord = await post('/api/products/order', {
    productKey: scratchKey, qty: 1,
    fullName: 'مشتری آزمون پیام ۱۳', mobile: '09121234567',
    address: 'تهران، خیابان آزمون، کوچه تست، ساختمان الو شتاب',
    plaque: '۷', floor: '۲', unit: '۱', postalCode: '', serviceItems: [],
  });
  ok('policy product orderable', ord.status === 200, ord.d?.error ?? '');
  ok('checkout listTotal = 12M (بالاترین ارائه‌شده)', ord.d?.breakdown?.listTotal === 12_000_000, `${ord.d?.breakdown?.listTotal}`);
  ok('checkout markup = 15% = 1,800,000', ord.d?.breakdown?.markupAmount === 1_800_000, `${ord.d?.breakdown?.markupAmount}`);
  ok('courierFee 250,000 (light)', ord.d?.breakdown?.courierFee === 250_000);
  ok('payable = 14,050,000', ord.d?.total === 14_050_000, `${ord.d?.total}`);
  // پاکسازی: غیرفعال‌سازی کالای آزمون
  const deactP = await post('/api/admin/inventory', { action: 'patch', productId: pid, active: false }, cookie);
  ok('scratch product deactivated', deactP.status === 200, `status=${deactP.status} err=${JSON.stringify(deactP.d ?? {})} body=${JSON.stringify({ action: 'patch', productId: pid, active: false })}`);

  // ۹) کرن شبانه — اتصال لحظه‌ای + گزارش روزانه
  const tick = await j('/api/tick?key=AloShetab-Tick-1405');
  ok('tick runs liveFeed cycle', tick.status === 200 && 'liveFeed' in tick.d, `tgjuOk=${tick.d?.liveFeed?.tgju?.ok ?? 'graceful'}`);
  ok('tick daily report present', 'dailyReport' in tick.d, `items=${tick.d?.dailyReport?.itemCount ?? '?'}`);

  // ۱۰) بدون کوکی ادمین → محرمانه می‌ماند
  const noauth = await j('/api/admin/offers?productId=x');
  ok('offers API requires auth', noauth.status === 401, `status=${noauth.status}`);
  const pubSt = await j('/api/admin/stores');
  ok('stores API requires auth', pubSt.status === 401, `status=${pubSt.status}`);

  console.log(`\n=== نتیجه: ${pass} موفق / ${fail} ناموفق ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('SMOKE ERROR', e); process.exit(1); });
