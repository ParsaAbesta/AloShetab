// ─── پیام ۱۳: اتصال به سایت نوسان قیمت (آمار دقیق لحظه‌ای) ───
// «اگر سایت نوسان قیمت می‌شناسی که آمار دقیق لحظه‌ای بدهد، به آن وصل شو»
//
// معمار اتصال:
//  ۱) TGJU (tgju.org) — مرجع نوسان لحظه‌ای ارز/طلا در ایران؛ از HTML رسمی سایت
//     خوانده می‌شود (data-market-nameslug + data-price) و در LiveQuote ذخیره می‌شود.
//     از این نرخ‌ها برای «علم‌گر تازگی» استفاده می‌شود: اگر دلار/طلا نوسان بزرگی
//     داشته باشد، کالاهای آن روز استعلام‌نشده برای استعلام تازهٔ انبار علامت می‌خورند.
//  ۲) دیجی‌کالا — آداپتور رسمی api.digikala.com؛ اگر CDN چالش کوکی داد (۳۰۷) →
//     وضعیت CHALLENGED و راهنمای ثبت کوکی در تنظیمات (DIGIKALA_COOKIE).
//  ۳) ترب — آداپتور api.torob.com؛ کپچای آرکپچا → وضعیت CHALLENGED.
//  ۴) اسنپ‌مارکت — رندر سمت کلاینت؛ HTML بدون قیمت → وضعیت NO_MATCH.
//  هر تلاش همگام‌سازی «وضعیت و زمان» را در خود فروشگاه ثبت می‌کند تا در
//  پنل ادمین کاملاً شفاف باشد؛ هیچ دادهٔ ساختگی از اتصال قطع نوشته نمی‌شود.
import { db } from '@/lib/db';
import { getSettings, setSetting } from '@/lib/settings';
import { formatJalali } from '@/lib/jalali';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function httpGet(url: string, timeoutMs = 12000, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.6', ...extraHeaders },
    });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// ─── ۱) نرخ‌های لحظه‌ای مرجع (TGJU) ─────────────────────────
export const TGJU_SLUGS: Record<string, string> = {
  price_dollar_rl: 'دلار آمریکا',
  price_eur: 'یورو',
  sekee: 'سکه امامی',
  gerami: 'سکه گرمی',
  geram18: 'طلای ۱۸ عیار',
};

/** استخراج مقاوم: تقسیم روی ردیف‌های <tr — چون data-title می‌تواند > داشته باشد */
function extractTgjuRows(body: string): Map<string, number> {
  const rows = new Map<string, number>();
  for (const chunk of body.split('<tr')) {
    const s = chunk.match(/data-market-nameslug="([^"]+)"/);
    const p = chunk.match(/data-price="([0-9,]+)"/);
    if (s && p) {
      const price = parseInt(p[1].replace(/,/g, ''), 10);
      if (Number.isFinite(price) && price > 0) rows.set(s[1], price);
    }
  }
  return rows;
}

export interface TgjuResult {
  ok: boolean;
  count: number;
  quotes: { slug: string; titleFa: string; price: number; prevPrice: number | null; percentChange: number | null }[];
  error?: string;
}

/** خواندن نرخ‌های لحظه‌ای از HTML رسمی tgju.org و ثبت در LiveQuote */
export async function syncTgjuReference(): Promise<TgjuResult> {
  try {
    const { status, body } = await httpGet('https://www.tgju.org/', 15000);
    if (status !== 200 || body.length < 10000) {
      return { ok: false, count: 0, quotes: [], error: `پاسخ نامعتبر سایت مرجع (HTTP ${status})` };
    }
    const now = new Date();
    const marketRows = extractTgjuRows(body);
    const quotes: TgjuResult['quotes'] = [];
    for (const [slug, titleFa] of Object.entries(TGJU_SLUGS)) {
      const price = marketRows.get(slug);
      if (!price) continue;
      const priceToman = Math.round(price / 10); // سایت مرجع ریال می‌دهد — ذخیره در تومان (کالای سکه‌ای هم جا می‌شود)
      const prev = await db.liveQuote.findUnique({ where: { slug } });
      const percentChange = prev && prev.price > 0 ? Math.round(((priceToman - prev.price) / prev.price) * 10000) / 100 : null;
      await db.liveQuote.upsert({
        where: { slug },
        update: { titleFa, price: priceToman, prevPrice: prev?.price ?? null, percentChange, fetchedAt: now, source: 'TGJU' },
        create: { slug, titleFa, price: priceToman, prevPrice: prev?.price ?? null, percentChange, fetchedAt: now, source: 'TGJU' },
      });
      quotes.push({ slug, titleFa, price: priceToman, prevPrice: prev?.price ?? null, percentChange });
    }
    if (quotes.length === 0) {
      return { ok: false, count: 0, quotes: [], error: 'ساختار سایت مرجع تغییر کرده — هیچ نرخ استخراج نشد' };
    }
    return { ok: true, count: quotes.length, quotes };
  } catch (e) {
    return { ok: false, count: 0, quotes: [], error: e instanceof Error ? e.message : 'خطای اتصال' };
  }
}

// ─── ۲–۴) آداپتور فروشگاه‌ها (قیمت لحظه‌ای کالا) ─────────────
export type FeedStatus = 'OK' | 'CHALLENGED' | 'UNREACHABLE' | 'NO_MATCH' | 'ERROR' | 'DISABLED' | 'NONE';

export interface FeedResult {
  status: FeedStatus;
  message: string;
  offeredPrice?: number; // تومان — در صورت OK نوشته می‌شود
  sourceUrl?: string;
  storeLabel?: string;
}

function buildQuery(p: { brand: string | null; model: string | null; nameFa: string; nameEn: string }): string {
  const q = [p.brand, p.model].filter(Boolean).join(' ').trim() || p.nameEn || p.nameFa;
  return encodeURIComponent(q.slice(0, 80));
}

/** قیمت لحظه‌ای یک کالا از یک فروشگاه متصل — نوشتن مستقیم در ProductOffer */
export async function syncProductFromStore(
  productId: string,
  storeId: string
): Promise<FeedResult> {
  const store = await db.store.findUnique({ where: { id: storeId } });
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!store || !product) return { status: 'ERROR', message: 'فروشگاه یا کالا یافت نشد' };
  if (store.feedType === 'NONE') {
    await db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date(), lastSyncStatus: 'NONE', lastSyncNote: 'این فروشگاه اتصال لحظه‌ای پیکربندی نشده — ثبت دستی فعال است' } });
    return { status: 'NONE', message: 'این فروشگاه اتصال لحظه‌ای ندارد (حالت دستی)' };
  }

  const s = await getSettings();
  const q = buildQuery(product);
  let result: FeedResult;

  try {
    if (store.feedType === 'DIGIKALA') {
      result = await fetchDigikala(store.feedQueryTemplate ?? 'https://api.digikala.com/v1/product/search/?q={q}', q, s.DIGIKALA_COOKIE ?? '');
    } else if (store.feedType === 'TOROB') {
      result = await fetchTorob(store.feedQueryTemplate ?? 'https://api.torob.com/v4/base-product/search/?q={q}', q);
    } else if (store.feedType === 'SNAPP_MARKET') {
      result = await fetchSnappMarket(`https://snapp.market/m/search?query=${q}`);
    } else {
      result = { status: 'NONE', message: 'نوع اتصال ناشناخته' };
    }
  } catch (e) {
    result = { status: 'UNREACHABLE', message: e instanceof Error ? e.message : 'خطای اتصال' };
  }

  await db.store.update({
    where: { id: store.id },
    data: { lastSyncAt: new Date(), lastSyncStatus: result.status, lastSyncNote: result.message },
  });

  // نوشتن قیمت لحظه‌ای فقط وقتی اتصال واقعاً موفق بوده — هیچ دادهٔ ساختگی نوشته نمی‌شود
  if (result.status === 'OK' && result.offeredPrice && result.offeredPrice > 0) {
    await db.productOffer.create({
      data: {
        productId,
        storeId: store.id,
        storeName: result.storeLabel ?? store.nameFa,
        sourceUrl: result.sourceUrl ?? null,
        offeredPrice: result.offeredPrice,
        negotiatedPrice: null,
        fetchedAt: new Date(),
        fetchedShamsi: todayJalaliStr(),
        source: 'LIVE_FEED',
        active: true,
        note: result.message.slice(0, 300),
      },
    });
  }
  return result;
}

/** دیجی‌کالا — JSON رسمی؛ قیمت selling_price ریال است (÷۱۰ = تومان) */
async function fetchDigikala(template: string, q: string, cookie: string): Promise<FeedResult> {
  const url = template.replace('{q}', q);
  const headers: Record<string, string> = {};
  if (cookie.trim()) headers['Cookie'] = cookie.trim();
  const { status, body } = await httpGet(url, 15000, headers);
  if (status === 307 || status === 403 || status === 490) {
    return {
      status: 'CHALLENGED',
      message: 'CDN دیجی‌کالا چالش امنیتی داد — از سرور داخل ایران یا با ثبت کوکی معتبر در تنظیمات (DIGIKALA_COOKIE) متصل می‌شود؛ در غیر این صورت ثبت دستی قیمت فعال است.',
    };
  }
  if (status !== 200) return { status: 'UNREACHABLE', message: `HTTP ${status}` };
  let json: unknown;
  try { json = JSON.parse(body); } catch { return { status: 'NO_MATCH', message: 'پاسخ JSON نبود' }; }
  const products = (json as { data?: { products?: unknown[] } })?.data?.products ?? [];
  if (products.length === 0) return { status: 'NO_MATCH', message: 'نتیجه‌ای برای این کالا یافت نشد' };
  const first = products[0] as {
    id: number; title_fa?: string;
    default_variant?: { price?: { selling_price?: number } };
  };
  const rial = first?.default_variant?.price?.selling_price ?? 0;
  if (!first?.id || !rial) return { status: 'NO_MATCH', message: 'قیمت در پاسخ یافت نشد' };
  return {
    status: 'OK',
    message: `قیمت لحظه‌ای گرفته شد: ${first.title_fa ?? `dkp-${first.id}`}`,
    offeredPrice: Math.round(rial / 10), // ریال → تومان
    sourceUrl: `https://www.digikala.com/product/dkp-${first.id}/`,
    storeLabel: 'دیجی‌کالا',
  };
}

/** ترب — چالش آرکپچا معمولاً ربات‌ها را می‌بندد */
async function fetchTorob(template: string, q: string): Promise<FeedResult> {
  const url = template.replace('{q}', q);
  const { status, body } = await httpGet(url, 15000);
  if (body.includes('arcaptcha') || body.includes('ربات')) {
    return { status: 'CHALLENGED', message: 'ترب کپچای آرکپچا نشان داد — اتصال لحظه‌ای فقط از IP مسکون ایران ممکن است؛ ثبت دستی فعال است.' };
  }
  if (status !== 200) return { status: 'UNREACHABLE', message: `HTTP ${status}` };
  let json: unknown;
  try { json = JSON.parse(body); } catch { return { status: 'NO_MATCH', message: 'پاسخ JSON نبود' }; }
  const results = (json as { results?: { min_price?: number; price_text?: string; title1?: string; web_client_absolute_url?: string }[] })?.results ?? [];
  if (results.length === 0) return { status: 'NO_MATCH', message: 'نتیجه‌ای یافت نشد' };
  const first = results[0];
  return { status: 'OK', message: `کمترین قیمت ترب: ${first.price_text ?? first.min_price ?? '—'} — ${first.title1 ?? ''}` };
}

/** اسنپ‌مارکت — رندر سمت کلاینت؛ HTML بدون قیمت */
async function fetchSnappMarket(url: string): Promise<FeedResult> {
  const { status, body } = await httpGet(url, 15000);
  if (status !== 200) return { status: 'UNREACHABLE', message: `HTTP ${status}` };
  if (/toman|price|قیمت/i.test(body) === false || body.includes('__NEXT_DATA__') === false) {
    return { status: 'NO_MATCH', message: 'اسنپ‌مارکت قیمت را سمت مرورگر رندر می‌کند — از سرور ایران با پیکربندی مخصوص قابل اتصال است؛ فعلاً ثبت دستی فعال است.' };
  }
  return { status: 'NO_MATCH', message: 'ساختار دادهٔ اسنپ‌مارکت نیازمند کلید API رسمی است — ثبت دستی فعال است.' };
}

// ─── وضعیت کلی اتصال‌ها (پنل ادمین) ─────────────────────────
export interface FeedSummary {
  tgju: TgjuResult | null;
  lastRunAt: string | null;
}

export async function runFeedCycle(): Promise<FeedSummary> {
  const tgju = await syncTgjuReference();
  const stores = await db.store.findMany({ where: { active: true } });
  let okCount = 0;
  let challenged = 0;
  for (const st of stores) {
    if (st.feedType === 'NONE') continue;
    // در چرخهٔ خودکار فقط وضعیت مرجع تازه می‌شود؛ قیمت لحظه‌ای کالا با فرمان ادمین
    // یا از سرور ایران اجرا می‌شود تا کوکی/IP لازم فراهم باشد.
    if (st.lastSyncStatus === 'OK') okCount++;
    if (st.lastSyncStatus === 'CHALLENGED') challenged++;
  }
  const summary: FeedSummary & { stores: number; okCount: number; challenged: number } = {
    tgju,
    stores: stores.length,
    okCount,
    challenged,
    lastRunAt: new Date().toISOString(),
  };
  await setSetting('LIVE_FEED_STATUS', JSON.stringify(summary));
  return summary;
}

/** علم‌گر نوسان: اگر دلار/طلا از آخرین ثبت بیش از آستانه حرکت کرده باشد،
 *  کالاهای بدون استعلام تازه باید دوباره قیمت بخورند (قیمت‌ها از بروزترین‌ها). */
export async function marketMoved(thresholdPct = 2): Promise<boolean> {
  const dollar = await db.liveQuote.findUnique({ where: { slug: 'price_dollar_rl' } });
  if (dollar?.percentChange != null && Math.abs(dollar.percentChange) >= thresholdPct) return true;
  const gold = await db.liveQuote.findUnique({ where: { slug: 'geram18' } });
  if (gold?.percentChange != null && Math.abs(gold.percentChange) >= thresholdPct) return true;
  return false;
}

export function todayJalaliStr(): string {
  return formatJalali(new Date(), 'en');
}
