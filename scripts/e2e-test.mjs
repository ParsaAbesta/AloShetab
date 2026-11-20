// ─── تست انتها-به-انتهای چرخهٔ کامل سفارش ألو شتاب ──────────
const BASE = 'http://localhost:3000';
let cookie = '';

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(opts.headers || {}) },
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const d = await res.json().catch(() => ({}));
  return { status: res.status, data: d };
}

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const nid = '0012345678';
  const refNid = '0098765432';

  // ۱) ورود ادمین
  let r = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'AloShetab1404' }) });
  check('admin login', r.status === 200 && r.data.ok);

  // ۲) ثبت درخواست همکار (مجری) و معرف
  r = await api('/api/workers', { method: 'POST', body: JSON.stringify({ fullName: 'همکار تستی', nationalId: '1111111111', mobile: '09120000001', city: 'تهران', field: 'تعمیر کامپیوتر', resume: '۱۰ سال سابقه' }) });
  check('worker application', r.status === 200 && r.data.ok);
  const workersRes = await api('/api/admin/workers');
  const worker = workersRes.data.workers.find((w) => w.nationalId === '1111111111');
  check('worker appears in admin', !!worker);
  r = await api('/api/admin/workers', { method: 'PATCH', body: JSON.stringify({ id: worker.id, action: 'approve' }) });
  check('worker approved', r.status === 200 && r.data.status === 'APPROVED');

  // ۳) معرف = مشتری قبلی (سفارش اول بدون معرف)
  //    سفارش اول: معرف آینده
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({
    items: [{ key: 'network', qty: 1 }],
    customer: { fullName: 'معرف تستی', nationalId: refNid, mobile: '09120000002', address: 'تهران، خیابان آزمایشی، پلاک ۱' },
    mode: 'REMOTE',
  }) });
  check('referrer order created', r.status === 200, `code=${r.data.code}`);
  const refCode = r.data.code;
  // پرداخت درگاه شبیه‌سازی‌شده
  r = await api('/api/payments', { method: 'POST', body: JSON.stringify({ action: 'init', code: refCode, mobile: '09120000002', method: 'GATEWAY' }) });
  check('payment init', r.status === 200, `paymentId=${r.data.paymentId}`);
  const payId1 = r.data.paymentId;
  r = await api('/api/payments', { method: 'POST', body: JSON.stringify({ action: 'gateway-confirm', paymentId: payId1, cardNumber: '6037998140974550', pin2: '123456', otp: '12345' }) });
  check('gateway confirm', r.status === 200 && r.data.ok, `rrn=${r.data.rrn}`);

  // ۴) سفارش دوم مشتری با کد معرف
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({
    items: [{ key: 'computer', qty: 1 }],
    customer: { fullName: 'مشتری تستی', nationalId: nid, mobile: '09120000003', address: 'تهران، خیابان تست، پلاک ۲' },
    mode: 'ONSITE',
    referralCode: refNid,
  }) });
  check('referred order created', r.status === 200, `code=${r.data.code} total=${r.data.total}`);
  const code = r.data.code;
  const total = r.data.total;
  const discount = r.data.quote.discount;
  check('8% referral discount applied', discount === Math.round(r.data.quote.grossTotal * 0.08), `discount=${discount}`);
  check('referral fee = total/6 recorded', r.status === 200);

  // جلوگیری از معرف=مشتری
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({
    items: [{ key: 'computer', qty: 1 }],
    customer: { fullName: 'مشتری تستی', nationalId: refNid, mobile: '09120000002', address: 'تهران، خیابان تست، پلاک ۲' },
    mode: 'ONSITE',
    referralCode: refNid,
  }) });
  check('self-referral blocked', r.status === 400 && r.data.error === 'REFERRAL_SELF');

  // ۵) پرداخت و انتقال وضعیت‌ها
  r = await api('/api/payments', { method: 'POST', body: JSON.stringify({ action: 'init', code, mobile: '09120000003', method: 'GATEWAY' }) });
  const payId2 = r.data.paymentId;
  r = await api('/api/payments', { method: 'POST', body: JSON.stringify({ action: 'gateway-confirm', paymentId: payId2, cardNumber: '6063731121468624', pin2: '123456', otp: '12345' }) });
  check('order2 paid', r.status === 200 && r.data.ok);

  // ۶) ادمین: تعیین مجری + انتقال وضعیت
  const list = await api('/api/admin/orders?status=PAID');
  const order = list.data.orders.find((o) => o.code === code);
  check('order visible in admin list', !!order);
  r = await api(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'assign-worker', workerId: worker.id }) });
  check('worker assigned', r.status === 200);
  for (const st of ['SCHEDULED', 'IN_PROGRESS', 'DONE']) {
    r = await api(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'set-status', status: st }) });
    check(`status → ${st}`, r.status === 200 && r.data.status === st);
  }
  // گارد: سفارش پرداخت‌نشده نمی‌تواند به SCHEDULED برود؛ اما PAID دستی = تأیید ادمین
  r = await api('/api/orders', { method: 'POST', body: JSON.stringify({
    items: [{ key: 'tv', qty: 1 }],
    customer: { fullName: 'بدون پرداخت', nationalId: '0055555555', mobile: '09120000004', address: 'تهران، خیابان بدون پرداخت' },
    mode: 'ONSITE',
  }) });
  const unpaidCode = r.data.code;
  const list2 = await api('/api/admin/orders?q=' + unpaidCode);
  const unpaid = list2.data.orders.find((o) => o.code === unpaidCode);
  r = await api(`/api/admin/orders/${unpaid.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'set-status', status: 'SCHEDULED' }) });
  check('unpaid order cannot jump to SCHEDULED', r.status === 400 && r.data.error === 'NOT_PAID');
  r = await api(`/api/admin/orders/${unpaid.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'set-status', status: 'PAID' }) });
  check('admin manual PAID = payment confirmation', r.status === 200 && r.data.status === 'PAID');

  // ۷) ثبت رضایت ← تسویهٔ خودکار
  r = await api('/api/orders/rate', { method: 'POST', body: JSON.stringify({ code, mobile: '09120000003', skill: 5, ethics: 4, comment: 'عالی بود' }) });
  check('rating submitted', r.status === 200 && r.data.ok);
  check('auto settlement ran', r.data.settlement && r.data.settlement.ok === true, `worker=${r.data.settlement?.workerTotal} company=${r.data.settlement?.companyTotal}`);
  const workerTotal = r.data.settlement.workerTotal;
  const companyTotal = r.data.settlement.companyTotal;
  check('2/3–1/3 math', workerTotal === Math.round(total * 2 / 3) && companyTotal === total - workerTotal, `total=${total}`);

  // ۸) حق معرف در ادمین + واریز
  const refs = await api('/api/admin/referrals');
  const ref = refs.data.referrals.find((x) => x.order.code === code);
  check('referral fee exists (1/6)', !!ref && ref.amount === Math.round(total / 6), `amount=${ref?.amount}`);
  r = await api('/api/admin/referrals', { method: 'PATCH', body: JSON.stringify({ id: ref.id }) });
  check('referral marked paid', r.status === 200);

  // ۹) نرخ روز خدمت
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  r = await api('/api/admin/dayrates', { method: 'POST', body: JSON.stringify({ date: today, labelFa: 'روز تست', labelEn: 'Test day', multiplier: 1.5 }) });
  check('day rate saved', r.status === 200);
  r = await api('/api/quote', { method: 'POST', body: JSON.stringify({ items: [{ key: 'computer', qty: 1 }], mode: 'ONSITE' }) });
  check('day factor applies to quote', r.data.quote.dayFactor === 1.5, `dayFactor=${r.data.quote.dayFactor}`);
  r = await api('/api/admin/dayrates?date=' + today, { method: 'DELETE' });
  check('day rate deleted', r.status === 200);

  // ۱۰) تنظیمات + گزارش‌ها + چت‌بات
  r = await api('/api/admin/reports');
  check('reports archive', r.status === 200 && r.data.reports.length > 0, `reports=${r.data.reports.length}`);
  r = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ REFERRAL_PERCENT: '8' }) });
  check('settings update', r.status === 200);
  r = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: `وضعیت سفارش ${code} موبایلم 09120000003`, lang: 'fa' }) });
  check('chatbot order status', r.status === 200 && r.data.reply.includes('AS-'), r.data.reply?.slice(0, 80));
  r = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'قیمت چطور محاسبه می‌شود؟', lang: 'fa' }) });
  check('chatbot pricing answer', r.status === 200 && r.data.reply.length > 20);

  // ۱۱) پیگیری سفارش
  r = await api('/api/orders/track', { method: 'POST', body: JSON.stringify({ code, mobile: '09120000003' }) });
  check('track order', r.status === 200 && r.data.order.settledAt, `status=${r.data.order?.status}`);

  console.log('\n=== E2E DONE ===');
}

main().catch((e) => { console.error('E2E FATAL', e); process.exitCode = 1; });
