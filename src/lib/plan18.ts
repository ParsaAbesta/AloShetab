// ─── پیام ۱۸: پلن مالی V4.0 — پورسانت معرف فقط یک‌بار (فاکتور اول) ──────────
// سود میز خدمات = ۳۳٪ از اجرت کارشناس (درون اجرت)
//   • دستمزد کارشناس = ۶۷٪ اجرت → بانک مهر (ثابت)
//   • پورسانت معرف = فقط در اولین فاکتور مشتریِ معرفی‌شده: ۱۰٪ اجرت
//     (همان فاکتوری که معرفی‌شده ۱۰٪ تخفیف می‌گیرد) — از فاکتور دوم به بعد: صفر
//   • سود خالص شرکت = باقیمانده → فاکتور اول ۱۳٪ اجرت | فاکتورهای بعدی ۳۳٪ اجرت (بدون معرف)
// سود میز کالا = فروش (بالاترین قیمت معتبرترین فروشگاه‌ها) − خرید (ارزان‌ترین انبار،
//   پایین‌ترین قیمت توافقی) − هزینهٔ پیک
//   • پورسانت معرف = فقط فاکتور اول: ۲۰٪ سود کالا — بعد از آن: صفر
//   • سود خالص شرکت = باقیمانده → فاکتور اول ۸۰٪ | بعد از آن ۱۰۰٪
// تخفیف مشتری: ثبت‌نام با کد معرف → ۱۰٪ تخفیف فقط روی همان اولین فاکتور
// گاردها:
//   • سلف-رفرال ممنوع (معرف ≠ معرفی‌شده — کد ملی؛ REFERRAL_SELF)
//   • سود کالا ≤ ۰ → تسویه متوقف و پرچم‌گذاری (GOODS_PROFIT_NOT_POSITIVE)
// جریان بانکی (بدون تغییر):
//   بانک ملی (کارت 6037-99-...) ← سود خالص شرکت
//   بانک مهر (شبا حساب دریافت + کارت 6063-73-...) ← حق معرف + ۶۷٪ اجرت کارشناس + خرید کالا [+ پیک]

export interface Plan18Settings {
  servicesExpertPct: number; // 0.67 — دستمزد کارشناس خدمات
  servicesReferrerFirst: number; // 0.10 — پورسانت معرف خدمات (فقط فاکتور اول)
  goodsReferrerFirst: number; // 0.20 — پورسانت معرف کالا (فقط فاکتور اول)
  firstInvoiceDiscount: number; // 0.10 — تخفیف فاکتور اول مشتری معرفی‌شده
}

export const PLAN18_DEFAULTS: Plan18Settings = {
  servicesExpertPct: 0.67,
  servicesReferrerFirst: 0.1,
  goodsReferrerFirst: 0.2,
  firstInvoiceDiscount: 0.1,
};

export interface ServicesSettlement {
  collected: number; // وصولی بخش خدمات (پس از تخفیف فاکتور اول)
  expert: number; // ۶۷٪ اجرت → بانک مهر
  referrer: number; // پورسانت معرف — فقط فاکتور اول (۱۰٪ اجرت)؛ بعد از آن ۰
  company: number; // سود خالص شرکت خدمات (باقیمانده)
  marginPool: number; // سود میز خدمات = ۳۳٪ اجرت
  referrerRate: number;
  issues: string[];
}

/** تسویهٔ میز خدمات بر پایهٔ V4.0 — اجرت کارشناس مبنای همهٔ نرخ‌هاست؛ پورسانت معرف یک‌بارمصرف است */
export function settleServices18(params: {
  grossFee: number; // اجرت کارشناس (grossTotal پس از ضرایب تقویمی)
  referred: boolean;
  isFirstInvoice: boolean;
  collectedServices?: number; // وصولی خدمات (پیش‌فرض = grossFee)
  settings?: Partial<Plan18Settings>;
}): ServicesSettlement {
  const s = { ...PLAN18_DEFAULTS, ...(params.settings || {}) };
  const issues: string[] = [];
  const expert = Math.round(params.grossFee * s.servicesExpertPct);
  const marginPool = params.grossFee - expert; // ۳۳٪ اجرت
  // V4.0: پورسانت معرف فقط در همان فاکتور اولِ هم‌زمان با تخفیف ۱۰٪ پرداخت می‌شود
  const refRate = params.isFirstInvoice ? s.servicesReferrerFirst : 0;
  const referrer = params.referred && params.isFirstInvoice ? Math.round(params.grossFee * refRate) : 0;
  const collected = params.collectedServices ?? params.grossFee;
  const company = collected - expert - referrer; // باقیمانده → بدون معرف/بعد از فاکتور اول = ۳۳٪ اجرت
  if (company < 0) issues.push('SERVICES_COMPANY_NEGATIVE');
  return { collected, expert, referrer, company, marginPool, referrerRate: refRate, issues };
}

export interface GoodsSettlement {
  saleTotal: number; // فروش = بالاترین قیمت معتبر × تعداد
  purchaseTotal: number; // خرید = ارزان‌ترین انبار (توافقی) × تعداد
  courierFee: number; // پیک
  profit: number; // فروش − خرید − پیک
  referrer: number; // فقط فاکتور اول: ۲۰٪ سود؛ بعد از آن ۰
  company: number; // باقیمانده سود (فکتور اول ۸۰٪ — بعد از آن ۱۰۰٪)
  referrerRate: number;
  ok: boolean;
  issues: string[];
}

/** تسویهٔ میز کالا بر پایهٔ V4.0 — سود = اختلاف خرید و فروش منهای پیک؛ پورسانت معرف یک‌بارمصرف است */
export function settleGoods18(params: {
  saleTotal: number;
  purchaseTotal: number;
  courierFee?: number;
  referred?: boolean;
  isFirstInvoice?: boolean;
  settings?: Partial<Plan18Settings>;
}): GoodsSettlement {
  const s = { ...PLAN18_DEFAULTS, ...(params.settings || {}) };
  const issues: string[] = [];
  const courierFee = params.courierFee ?? 0;
  const profit = params.saleTotal - params.purchaseTotal - courierFee;
  const ok = profit > 0;
  if (!ok) issues.push('GOODS_PROFIT_NOT_POSITIVE');
  // V4.0: پورسانت معرف فقط در فاکتور اول معرفی‌شده (همان فاکتورِ تخفیف ۱۰٪)
  const refRate = params.isFirstInvoice ? s.goodsReferrerFirst : 0;
  const referred = !!params.referred;
  const referrer = referred && params.isFirstInvoice && ok ? Math.round(profit * refRate) : 0;
  const company = ok ? profit - referrer : 0;
  return {
    saleTotal: params.saleTotal,
    purchaseTotal: params.purchaseTotal,
    courierFee,
    profit,
    referrer,
    company,
    referrerRate: refRate,
    ok,
    issues,
  };
}

export interface BankRouting {
  melli: { name: string; card: string; amount: number }; // سود خالص شرکت
  mehr: { name: string; card: string; amount: number }; // حق معرف + ۶۷٪ اجرت + خرید کالا + پیک (در گردش)
}

const CARD_MELLI = '6037998140974550';
const CARD_MEHR = '6063731121468624';

/** تقسیم بانکی نهایی هر تسویه — محرمانه؛ فقط در گزارش ایمنی پنل/ایمیل مالک */
export function bankRouting18(params: {
  company: number;
  expert: number;
  referrer: number;
  purchaseTotal?: number;
  courierFee?: number;
}): BankRouting {
  const mehr = params.expert + params.referrer + (params.purchaseTotal ?? 0) + (params.courierFee ?? 0);
  return {
    melli: { name: 'بانک ملی ایران', card: CARD_MELLI, amount: Math.max(0, params.company) },
    mehr: { name: 'بانک مهر ایران', card: CARD_MEHR, amount: mehr },
  };
}

/** خواندن نرخ‌های V4.0 از رکورد تنظیمات (رشتهٔ درصدی مانند '67')
 *  کلیدهای منسوخ SERVICES_REFERRER_PCT_NORMAL / GOODS_REFERRER_PCT_NORMAL دیگر خوانده نمی‌شوند —
 *  پورسانت معرف طبق V4.0 فقط در فاکتور اول پرداخت می‌شود. */
export function plan18SettingsFromRecord(rec: Record<string, string>): Plan18Settings {
  const num = (v: string | undefined, d: number) => {
    const n = parseFloat(v ?? '');
    return Number.isFinite(n) ? n / 100 : d;
  };
  return {
    servicesExpertPct: num(rec.SERVICES_EXPERT_PCT, PLAN18_DEFAULTS.servicesExpertPct),
    servicesReferrerFirst: num(rec.SERVICES_REFERRER_PCT_FIRST, PLAN18_DEFAULTS.servicesReferrerFirst),
    goodsReferrerFirst: num(rec.GOODS_REFERRER_PCT_FIRST, PLAN18_DEFAULTS.goodsReferrerFirst),
    firstInvoiceDiscount: num(rec.FIRST_INVOICE_DISCOUNT_PCT, PLAN18_DEFAULTS.firstInvoiceDiscount),
  };
}
