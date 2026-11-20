// ─── Smoke پیام ۱۴ (v3.0) — پلن جدید قیمت‌گذاری، انبارها، نسخه ایران/جهانی ──
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
  console.log('— Smoke پیام ۱۴ / v3.0 (۱۴۰۵/۰۸/۲۷) —');

  // ۱) میز عمومی — پلن v3 روی میز محصولات
  const pr = await j('/api/products');
  ok('GET /api/products', pr.status === 200);
  const goods = pr.d.goods ?? [];
  const mouse = goods.find((p) => p.key === 'mouse-q5');
  ok('mouse sell base = 1,312,000 (گران‌ترین فروشگاه دیجی‌کالا)', mouse?.price === 1_312_000, `price=${mouse?.price}`);
  ok('mouse sellBaseStore = دیجی‌کالا', mouse?.sellBaseStore === 'دیجی‌کالا', mouse?.sellBaseStore);
  ok('expertSharePct = 0.18 (۱۶٫۵ تا ۲۰+)', mouse?.expertSharePct === 0.18, `${mouse?.expertSharePct}`);
  ok('platformMarginPct = 0.12 (۱۰ تا ۱۶٫۵)', mouse?.platformMarginPct === 0.12, `${mouse?.platformMarginPct}`);
  ok('plan 33% removed (markupPct = 0.30)', mouse?.markupPct === 0.30, `${mouse?.markupPct}`);
  ok('warehouse price list attached (لیست بروزترین انبارها)', Array.isArray(mouse?.warehousePrices) && mouse.warehousePrices.length >= 2, `${mouse?.warehousePrices?.length} warehouses`);
  ok('cheapest warehouse first (خرید از ارزان‌ترین)', mouse?.warehousePrices?.[0]?.name === 'کامپیوتر افق' && mouse.warehousePrices[0].price === 1_150_000, `${mouse?.warehousePrices?.[0]?.name} ${mouse?.warehousePrices?.[0]?.price}`);
  ok('negotiated price NOT exposed publicly (محرمانه)', mouse?.warehousePrices?.every((w) => !('negotiated' in w) && !('negotiatedPrice' in w)));
  ok('stock from freshest warehouse (موجودی فقط از بروزترین انبار)', mouse?.stock === 15 && mouse?.stockSource === 'کامپیوتر افق', `${mouse?.stock} از ${mouse?.stockSource}`);
  ok('checkout meta: minInvoice 5M + plan pcts', pr.d.checkout?.minInvoice === 5_000_000 && pr.d.checkout?.expertSharePct === 0.18 && pr.d.checkout?.platformMarginPct === 0.12);
  const no33 = JSON.stringify(pr.d).includes('0.33') === false && JSON.stringify(pr.d).includes('۳۳٪') === false;
  ok('no 33% plan anywhere in products API (حذف پلن ۳۳٪)', no33);

  // ۲) ورود ادمین
  const lg = await post('/api/admin/login', { username: 'admin', password: 'AloShetabAdmin1405' });
  ok('admin login', lg.status === 200, `status=${lg.status}`);
  const cookie = lg.cookie ?? '';

  // ۳) لیست تمام انبارها در پنل ادمین (پیام ۱۴)
  const wh = await j('/api/admin/warehouses', { headers: { Cookie: cookie } });
  ok('GET /api/admin/warehouses', wh.status === 200);
  const warehouses = wh.d.warehouses ?? [];
  ok('warehouses ≥ 13 (لیست کامل)', warehouses.length >= 13, `${warehouses.length} warehouses`);
  for (const k of ['ofogh-computer', 'mobit', 'ofoghkourosh', 'delgarm', 'gadgetnews', 'afralland', 'trust-mp']) {
    const w = warehouses.find((x) => x.key === k);
    ok(`warehouse ${k} present`, !!w, w ? `${w.nameFa} · ${w.city}` : 'missing');
  }
  ok('warehouses carry contacts', warehouses.every((w) => 'phone' in w && 'address' in w && 'website' in w));

  // ۴) لیست تمام فروشگاه‌ها (پیام ۱۳ — حفظ‌شده)
  const st = await j('/api/admin/stores', { headers: { Cookie: cookie } });
  ok('GET /api/admin/stores', st.status === 200);
  ok('stores ≥ 8', (st.d.stores ?? []).length >= 8, `${st.d.stores?.length} stores`);

  // ۵) سیاست پلن v3 برای ماوس Q5
  const inv = await j('/api/admin/inventory?section=GOODS', { headers: { Cookie: cookie } });
  const invMouse = (inv.d.products ?? []).find((p) => p.key === 'mouse-q5');
  ok('inventory offersSummary attached', !!invMouse?.offersSummary, `count=${invMouse?.offersSummary?.count}`);
  ok('summary freshestStock + warehouse', invMouse?.offersSummary?.freshestStock === 15 && invMouse?.offersSummary?.freshestStockWarehouse === 'کامپیوتر افق');
  const om = await j(`/api/admin/offers?productId=${invMouse.id}`, { headers: { Cookie: cookie } });
  ok('GET /api/admin/offers', om.status === 200);
  const pol = om.d.policy ?? {};
  ok('policy.storeCount ≥ 2', (pol.storeCount ?? 0) >= 2, `${pol.storeCount}`);
  ok('policy.warehouseCount = 2', pol.warehouseCount === 2, `${pol.warehouseCount}`);
  ok('sellBase = 1,312,000 (فروش به گران‌ترین فروشگاه)', pol.sellBase === 1_312_000, `${pol.sellBase}`);
  ok('buyTarget = 1,120,000 (خرید از ارزان‌ترین انبار + توافقی)', pol.buyTarget === 1_120_000, `${pol.buyTarget}`);
  ok('buyTargetStore = کامپیوتر افق', pol.buyTargetStore === 'کامپیوتر افق', pol.buyTargetStore);
  ok('freshestStock = 15 از کامپیوتر افق', pol.freshestStock === 15 && pol.freshestStockWarehouse === 'کامپیوتر افق');
  ok('policy.warehousePrices cheapest-first (public prices)', pol.warehousePrices?.[0]?.name === 'کامپیوتر افق' && pol.warehousePrices[0].price === 1_150_000);
  ok('offers include side badge data', (om.d.offers ?? []).every((o) => 'side' in o), `warehouses=${om.d.offers?.filter((o) => o.side === 'WAREHOUSE').length}`);

  // ۶) گیت تازگی — استعلام کهنه رد می‌شود
  const staleAdd = await post('/api/admin/offers', { action: 'add', productId: invMouse.id, side: 'WAREHOUSE', storeName: 'انبار آزمون کهنه', offeredPrice: 1_200_000, stockQty: 5, fetchedShamsi: '1405/05/01' }, cookie);
  ok('stale warehouse quote rejected (before 1405/08/10)', staleAdd.status === 400 && staleAdd.d?.error === 'PRICE_STALE', `status=${staleAdd.status}`);

  // ۷) استعلام انبار بدون موجودی رد می‌شود (موجودی فقط از بروزترین انبار)
  const noStock = await post('/api/admin/offers', { action: 'add', productId: invMouse.id, side: 'WAREHOUSE', storeName: 'انبار بی‌موجودی', offeredPrice: 1_200_000 }, cookie);
  ok('warehouse quote without stock rejected', noStock.status === 400 && noStock.d?.error === 'STOCK_REQUIRED', `status=${noStock.status}`);

  // ۸) استعلام تازهٔ انبار با موجودی پذیرفته می‌شود → سیاست بازمحاسبه
  const freshAdd = await post('/api/admin/offers', { action: 'add', productId: invMouse.id, side: 'WAREHOUSE', storeName: 'انبار آزمون تازه', offeredPrice: 1_140_000, negotiatedPrice: 1_100_000, stockQty: 20, note: 'استعلام آزمون' }, cookie);
  ok('fresh warehouse quote accepted', freshAdd.status === 200, `status=${freshAdd.status}`);
  const om2 = await j(`/api/admin/offers?productId=${invMouse.id}`, { headers: { Cookie: cookie } });
  ok('policy recalculated: warehouseCount=3', om2.d.policy?.warehouseCount === 3, `${om2.d.policy?.warehouseCount}`);
  ok('cheapest warehouse now انبار آزمون تازه (buy 1,100,000)', om2.d.policy?.buyTarget === 1_100_000 && om2.d.policy?.buyTargetStore === 'انبار آزمون تازه', `${om2.d.policy?.buyTarget}`);
  ok('freshest stock = 20 از انبار آزمون تازه', om2.d.policy?.freshestStock === 20 && om2.d.policy?.freshestStockWarehouse === 'انبار آزمون تازه');
  const testOffer = (om2.d.offers ?? []).find((o) => o.storeName === 'انبار آزمون تازه');
  const deact = await post('/api/admin/offers', { action: 'deactivate', offerId: testOffer.id }, cookie);
  ok('deactivate test warehouse quote', deact.status === 200);

  // ۹) کالای آزمایشی: اعمال کامل پلن v3
  const scratchKey = `p14-scratch-${Date.now() % 100000000}`;
  const created = await post('/api/admin/inventory', {
    action: 'create', key: scratchKey, nameFa: 'کالای آزمون پلن v3', descFa: 'آزمون', descEn: 'test',
    section: 'GOODS', category: 'ماوس', basePrice: 10_000_000, stock: 1, icon: 'mouse',
  }, cookie);
  ok('scratch product created (rule=V3-PLAN)', created.status === 200 && created.d?.product?.priceRule === 'V3-PLAN', created.d?.error ?? '');
  const pid = created.d?.product?.id;
  const oA = await post('/api/admin/offers', { action: 'add', productId: pid, storeName: 'فروشگاه الف', offeredPrice: 12_000_000, negotiatedPrice: 9_000_000 }, cookie);
  ok('store offer A: 12M offered', oA.status === 200);
  const oB = await post('/api/admin/offers', { action: 'add', productId: pid, storeName: 'فروشگاه ب', offeredPrice: 11_500_000 }, cookie);
  ok('store offer B: 11.5M', oB.status === 200);
  const oW = await post('/api/admin/offers', { action: 'add', productId: pid, side: 'WAREHOUSE', storeName: 'انبار آزمون v3', offeredPrice: 10_500_000, negotiatedPrice: 9_800_000, stockQty: 4 }, cookie);
  ok('warehouse quote: 10.5M / stock 4', oW.status === 200);
  const apply = await post('/api/admin/offers', { action: 'apply-policy', productId: pid }, cookie);
  ok('apply-policy executed', apply.status === 200, apply.d?.error ?? '');
  ok('sell base ← priciest store (12,000,000)', apply.d?.product?.price === 12_000_000, `${apply.d?.product?.price}`);
  ok('rule ← V3-PLAN', apply.d?.product?.priceRule === 'V3-PLAN', apply.d?.product?.priceRule);
  ok('buy base ← cheapest warehouse negotiated (9,800,000)', apply.d?.product?.basePrice === 9_800_000, `${apply.d?.product?.basePrice}`);
  ok('policy.expertPct/platformPct attached', apply.d?.policy?.expertPct === 0.18 && apply.d?.policy?.platformPct === 0.12);

  // ۱۰) صفحهٔ پرداخت با پلن v3: کارشناس ۱۸٪ + پلتفرم ۱۲٪ + پیک
  const ord = await post('/api/products/order', {
    productKey: scratchKey, qty: 1,
    fullName: 'مشتری آزمون پیام ۱۴', mobile: '09121234567',
    address: 'تهران، خیابان آزمون، کوچه تست، ساختمان الو شتاب',
    plaque: '۷', floor: '۲', unit: '۱', postalCode: '', serviceItems: [],
  });
  ok('policy product orderable', ord.status === 200, ord.d?.error ?? '');
  ok('checkout listTotal = 12M (پایهٔ فروش)', ord.d?.breakdown?.listTotal === 12_000_000, `${ord.d?.breakdown?.listTotal}`);
  ok('expert share 18% = 2,160,000', ord.d?.breakdown?.expertShareAmount === 2_160_000, `${ord.d?.breakdown?.expertShareAmount}`);
  ok('platform margin 12% = 1,440,000', ord.d?.breakdown?.platformMarginAmount === 1_440_000, `${ord.d?.breakdown?.platformMarginAmount}`);
  ok('markup total = 3,600,000 (= کارشناس + پلتفرم)', ord.d?.breakdown?.markupAmount === 3_600_000, `${ord.d?.breakdown?.markupAmount}`);
  ok('courierFee 250,000 (light)', ord.d?.breakdown?.courierFee === 250_000);
  ok('payable = 15,850,000', ord.d?.total === 15_850_000, `${ord.d?.total}`);
  ok('order records expert/platform split', ord.d?.breakdown?.expertSharePct === 0.18 && ord.d?.breakdown?.platformMarginPct === 0.12);

  // ۱۱) سفارش ماوس — تعدیل به حداقل فاکتور ۵م
  const ordMouse = await post('/api/products/order', {
    productKey: 'mouse-q5', qty: 1,
    fullName: 'مشتری آزمون حداقل فاکتور', mobile: '09121234568',
    address: 'تهران، خیابان آزمون دوم، پلاک ۱',
    plaque: '۱', floor: '۱', unit: '۱', postalCode: '', serviceItems: [],
  });
  ok('mouse order ok', ordMouse.status === 200, ordMouse.d?.error ?? '');
  ok('min invoice adjustment applied (payable=5,000,000)', ordMouse.d?.total === 5_000_000 && ordMouse.d?.minInvoiceAdj > 0, `total=${ordMouse.d?.total} adj=${ordMouse.d?.minInvoiceAdj}`);

  // ۱۲) اعتبارسنجی پلن در تنظیمات — فقط مالک | کارشناس ≥ ۱۶٫۵ | پلتفرم ۱۰–۱۶٫۵
  const badEAdmin = await fetch(BASE + '/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ EXPERT_SHARE_PCT: '15' }) });
  ok('admin cannot edit plan (مالک‌محور)', badEAdmin.status === 403, `status=${badEAdmin.status}`);
  const lgOwner = await post('/api/admin/login', { username: 'owner', password: 'AloShetab1404' });
  ok('owner login', lgOwner.status === 200, `status=${lgOwner.status}`);
  const oc = lgOwner.cookie ?? '';
  const badE = await fetch(BASE + '/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: oc }, body: JSON.stringify({ EXPERT_SHARE_PCT: '15' }) });
  ok('expert share 15% rejected (< 16.5)', badE.status === 400, `status=${badE.status}`);
  const badP = await fetch(BASE + '/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: oc }, body: JSON.stringify({ PLATFORM_MARGIN_PCT: '17' }) });
  ok('platform margin 17% rejected (> 16.5)', badP.status === 400, `status=${badP.status}`);
  const okE = await fetch(BASE + '/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: oc }, body: JSON.stringify({ EXPERT_SHARE_PCT: '20' }) });
  ok('expert share 20% accepted («یا بیشتر»)', okE.status === 200);
  const restoreE = await fetch(BASE + '/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: oc }, body: JSON.stringify({ EXPERT_SHARE_PCT: '18' }) });
  ok('expert share restored to 18%', restoreE.status === 200);

  // ۱۳) نسخه — v3.0-IR
  const set = await j('/api/settings');
  ok('VERSION = v3.0-IR (نسخهٔ ایران fa)', set.d?.settings?.VERSION === 'v3.0-IR', set.d?.settings?.VERSION);

  // ۱۴) کرن شبانه — گزارش روزانهٔ پلن v3 + اتصال لحظه‌ای
  const tick = await j('/api/tick?key=AloShetab-Tick-1405');
  ok('tick runs liveFeed cycle', tick.status === 200 && 'liveFeed' in tick.d, `tgjuOk=${tick.d?.liveFeed?.tgju?.ok ?? 'graceful'}`);
  ok('tick daily report present', 'dailyReport' in tick.d, `items=${tick.d?.dailyReport?.itemCount ?? '?'}`);

  // ۱۵) پاکسازی کالای آزمون + بدون کوکی ادمین → محرمانه می‌ماند
  const deactP = await post('/api/admin/inventory', { action: 'patch', productId: pid, active: false }, cookie);
  ok('scratch product deactivated', deactP.status === 200, `status=${deactP.status}`);
  const noauth = await j('/api/admin/offers?productId=x');
  ok('offers API requires auth', noauth.status === 401, `status=${noauth.status}`);
  const pubWh = await j('/api/admin/warehouses');
  ok('warehouses API requires auth', pubWh.status === 401, `status=${pubWh.status}`);

  console.log(`\n=== نتیجه: ${pass} موفق / ${fail} ناموفق ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('SMOKE ERROR', e); process.exit(1); });
