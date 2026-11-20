// ─── موتور قیمت‌گذاری پویا — تمام محاسبات سمت سرور ──────────
import { db } from '@/lib/db';
import { tehranParts, tehranDateKey } from '@/lib/jalali';
import { getSettings } from '@/lib/settings';

export type OrderMode = 'ONSITE' | 'REMOTE';

export const REMOTE_FACTOR = 0.7; // از راه دور ×۰٫۷
export const REFERRAL_PERCENT_DEFAULT = 8; // تخفیف معرف ۸٪

// ─── پلن ۳۳٪ میز خدمات — پیام ۱۷ (v3.2) ─────────────────────
// اصلاح مالک (پیام ۱۶): پلن ۳۳٪ فقط از میز کالا حذف شد و در میز خدمات باقی می‌ماند.
// پیام ۱۷ (پلن جدید خرید و فروش): سود میز خدمات = ۳۳٪ اجرت کارشناس است و «درون» اجرت
// تقسیم می‌شود — دیگر افزودنی روی فاکتور نیست:
//   • مشتری اجرت کارشناس را می‌پردازد (grossTotal پس از ضرایب تقویمی)
//   • کارشناس ۶۷٪ اجرت → بانک مهر | سود میز خدمات = ۳۳٪ اجرت
//   • معرف ۱۵٪ اجرت (فاکتور اول معرفی‌شده ۱۰٪) | شرکت ۱۸٪ اجرت (فاکتور اول: باقیمانده ۱۳٪)
//   • تخفیف ۱۰٪ فقط روی اولین فاکتور خرید مشتری معرفی‌شده (پیام ۱۷)
export const SERVICE_MARKUP_PCT = 0.33; // سود میز خدمات = ۳۳٪ اجرت (گزارشی — درون اجرت)

/** ضریب روز هفته: شنبه تا چهارشنبه ×۱ | پنجشنبه ×۱٫۱ | جمعه ×۱٫۲ */
export function weekFactor(weekday: number): number {
  if (weekday === 5) return 1.1; // پنجشنبه
  if (weekday === 6) return 1.2; // جمعه
  return 1; // شنبه تا چهارشنبه
}

/** ضریب ساعت: ۸–۱۷ ×۱ | ۱۷–۲۲ ×۱٫۱ | ۲۲–۸ ×۱٫۲۵ (شب/اورژانسی) */
export function hourFactor(hour: number): number {
  if (hour >= 8 && hour < 17) return 1;
  if (hour >= 17 && hour < 22) return 1.1;
  return 1.25;
}

/** نرخ روز خدمت (تعطیلات رسمی/پرمشغول) ثبت‌شدهٔ ادمین */
export async function dayRateFactor(date: Date): Promise<{ factor: number; labelFa: string; labelEn: string }> {
  const key = tehranDateKey(date);
  const dr = await db.dayRate.findUnique({ where: { date: key } });
  if (!dr) return { factor: 1, labelFa: '', labelEn: '' };
  return { factor: dr.multiplier, labelFa: dr.labelFa, labelEn: dr.labelEn };
}

export interface QuoteLine {
  serviceKey: string;
  qty: number;
  baseRate: number;
  lineTotal: number;
}

export interface QuoteResult {
  lines: QuoteLine[];
  subtotal: number;      // Σ نرخ پایه × تعداد
  weekFactor: number;
  hourFactor: number;
  dayFactor: number;
  dayLabelFa: string;
  dayLabelEn: string;
  modeFactor: number;
  grossTotal: number;    // subtotal × همهٔ ضرایب
  serviceMarkupPct: number; // پلن ۳۳٪ میز خدمات
  serviceMarkup: number;    // مبلغ افزودنی پلن ۳۳٪
  referralPercent: number;
  discount: number;      // تخفیف معرف (روی مبلغ پس از افزودنی)
  total: number;         // مبلغ نهایی (تومان)
}

export function computeQuoteSync(params: {
  items: { baseRate: number; qty: number }[];
  mode: OrderMode;
  when?: Date;
  weekF?: number;
  hourF?: number;
  dayF?: number;
  serviceMarkupPct?: number; // سود ۳۳٪ میز خدمات — پیش‌فرض ثابت (گزارشی)
  referralPercent: number;
  hasReferral: boolean;
  isFirstInvoice?: boolean; // پیام ۱۷: اولین فاکتور خرید مشتری معرفی‌شده
  firstInvoiceDiscountPct?: number; // پیش‌فرض ۱۰٪
}): Omit<QuoteResult, 'lines' | 'dayLabelFa' | 'dayLabelEn'> {
  const when = params.when ?? new Date();
  const tp = tehranParts(when);
  const subtotal = params.items.reduce((s, it) => s + it.baseRate * it.qty, 0);
  const wf = params.weekF ?? weekFactor(tp.weekday);
  const hf = params.hourF ?? hourFactor(tp.hour);
  const df = params.dayF ?? 1;
  const mf = params.mode === 'REMOTE' ? REMOTE_FACTOR : 1;
  const grossTotal = Math.round(subtotal * wf * hf * df * mf);
  const serviceMarkupPct = params.serviceMarkupPct ?? SERVICE_MARKUP_PCT;
  // پیام ۱۷: سود میز خدمات = ۳۳٪ اجرت — درون اجرت تقسیم می‌شود (نه افزودنی روی فاکتور)
  const serviceMarkup = Math.round(grossTotal * serviceMarkupPct);
  // تخفیف ۱۰٪ فقط برای اولین فاکتور خرید مشتریِ معرفی‌شده (پیام ۱۷)
  const firstPct = (params.firstInvoiceDiscountPct ?? 10) / 100;
  const isFirst = !!params.isFirstInvoice;
  const discount = params.hasReferral && isFirst ? Math.round(grossTotal * firstPct) : 0;
  const referralPercent = params.hasReferral ? params.referralPercent : 0;
  const total = grossTotal - discount; // افزودنی ۳۳٪ حذف شد — مشتری اجرت را می‌پردازد
  return {
    subtotal,
    weekFactor: wf,
    hourFactor: hf,
    dayFactor: df,
    modeFactor: mf,
    grossTotal,
    serviceMarkupPct,
    serviceMarkup,
    referralPercent,
    discount,
    total,
  };
}

/** کوت کامل سمت سرور (شامل نرخ روز خدمت از دیتابیس) */
export async function computeQuote(params: {
  items: { baseRate: number; qty: number }[];
  mode: OrderMode;
  when?: Date;
  referralPercent: number;
  hasReferral: boolean;
  isFirstInvoice?: boolean;
  firstInvoiceDiscountPct?: number;
}): Promise<QuoteResult> {
  const when = params.when ?? new Date();
  const base = computeQuoteSync({ ...params, when });
  const dr = await dayRateFactor(when);
  // درصد سود ۳۳٪ میز خدمات از تنظیمات مالک (قابل تغییر در پنل)
  const s = await getSettings();
  const markupPct = Math.min(Math.max(parseFloat(s.SERVICE_MARKUP_PCT) || 33, 0), 99) / 100;
  // بازمحاسبه با ضریب روز از دیتابیس
  const tp = tehranParts(when);
  const recalced = computeQuoteSync({ ...params, when, weekF: weekFactor(tp.weekday), hourF: hourFactor(tp.hour), dayF: dr.factor, serviceMarkupPct: markupPct });
  return {
    ...recalced,
    dayLabelFa: dr.labelFa,
    dayLabelEn: dr.labelEn,
    lines: params.items.map((it) => ({
      serviceKey: (it as { serviceKey?: string }).serviceKey ?? '',
      qty: it.qty,
      baseRate: it.baseRate,
      lineTotal: it.baseRate * it.qty,
    })),
  };
}

/** تخصیص مبلغ پرداختی بین اقلام (برای تسویهٔ ۴/۷ و ۲/۷ و حق معرف ۱/۷) */
export function allocateAmounts(total: number, lineTotals: number[]): number[] {
  const sum = lineTotals.reduce((s, v) => s + v, 0) || 1;
  let allocated = 0;
  const out = lineTotals.map((lt, i) => {
    if (i === lineTotals.length - 1) return total - allocated;
    const v = Math.round((total * lt) / sum);
    allocated += v;
    return v;
  });
  return out;
}
