// ─── پیام ۱۷: پلن خرید و فروش میز کالا و میز خدمات (v3.2) ──────────
// سود میز خدمات = ۳۳٪ از اجرت کارشناس (درون اجرت — افزودنی ۳۳٪ حذف شد)
//   • دستمزد کارشناس = ۶۷٪ اجرت → بانک مهر
//   • پورسانت معرف = ۱۵٪ اجرت (فاکتور اول معرفی‌شده: ۱۰٪ اجرت)
//   • سود خالص شرکت = ۱۸٪ اجرت (فاکتور اول: باقیمانده = ۱۳٪ اجرت پس از تخفیف ۱۰٪)
//   • (۱۵ + ۱۸ = ۳۳) — کل سود خدمات تقسیم می‌شود؛ و در میز خدمات باقی می‌ماند (پیام ۱۶)
// سود میز کالا = فروش (بالاترین قیمت معتبرترین فروشگاه‌ها) − خرید (ارزان‌ترین انبار،
//   پایین‌ترین قیمت توافقی) − هزینهٔ پیک
//   • پورسانت معرف = ۳۰٪ سود کالا (فاکتور اول: ۲۰٪)
//   • سود خالص شرکت = ۷۰٪ سود کالا (فاکتور اول: باقیمانده = ۸۰٪)
// تخفیف مشتری: ثبت‌نام با کد معرف → ۱۰٪ تخفیف فقط روی اولین فاکتور خرید
// جریان بانکی:
//   بانک ملی (کارت 6037-99-...) ← سود خالص شرکت (۱۸٪ خدمات + ۷۰٪ کالا)
//   بانک مهر (شبا حساب دریافت + کارت 6063-73-...) ← حق معرف + ۶۷٪ اجرت کارشناس + هزینهٔ خرید کالا [+ پیک]

export interface Plan17Settings {
  servicesExpertPct: number; // 0.67 — دستمزد کارشناس خدمات
  servicesReferrerNormal: number; // 0.15 — پورسانت معرف خدمات (فاکتور دوم به بعد)
  servicesReferrerFirst: number; // 0.10 — پورسانت معرف خدمات (فاکتور اول)
  goodsReferrerNormal: number; // 0.30 — پورسانت معرف کالا
  goodsReferrerFirst: number; // 0.20 — پورسانت معرف کالا (فاکتور اول)
  firstInvoiceDiscount: number; // 0.10 — تخفیف فاکتور اول مشتری معرفی‌شده
}

export const PLAN17_DEFAULTS: Plan17Settings = {
  servicesExpertPct: 0.67,
  servicesReferrerNormal: 0.15,
  servicesReferrerFirst: 0.1,
  goodsReferrerNormal: 0.3,
  goodsReferrerFirst: 0.2,
  firstInvoiceDiscount: 0.1,
};

export interface ServicesSettlement {
  collected: number; // وصولی بخش خدمات (پس از تخفیف فاکتور اول)
  expert: number; // ۶۷٪ اجرت → بانک مهر
  referrer: number; // پورسانت معرف (۱۵٪ / ۱۰٪ فاکتور اول)
  company: number; // سود خالص شرکت خدمات (۱۸٪ / فاکتور اول ۱۳٪)
  marginPool: number; // سود میز خدمات = ۳۳٪ اجرت
  referrerRate: number;
  issues: string[];
}

/** تسویهٔ میز خدمات بر پایهٔ پیام ۱۷ — اجرت کارشناس مبنای همهٔ نرخ‌هاست */
export function settleServices17(params: {
  grossFee: number; // اجرت کارشناس (grossTotal پس از ضرایب تقویمی)
  referred: boolean;
  isFirstInvoice: boolean;
  collectedServices?: number; // وصولی خدمات (پیش‌فرض = grossFee)
  settings?: Partial<Plan17Settings>;
}): ServicesSettlement {
  const s = { ...PLAN17_DEFAULTS, ...(params.settings || {}) };
  const issues: string[] = [];
  const expert = Math.round(params.grossFee * s.servicesExpertPct);
  const marginPool = params.grossFee - expert; // ۳۳٪ اجرت
  const refRate = params.isFirstInvoice ? s.servicesReferrerFirst : s.servicesReferrerNormal;
  const referrer = params.referred ? Math.round(params.grossFee * refRate) : 0;
  const collected = params.collectedServices ?? params.grossFee;
  const company = collected - expert - referrer; // باقیمانده → عادی = ۱۸٪ اجرت
  if (company < 0) issues.push('SERVICES_COMPANY_NEGATIVE');
  return { collected, expert, referrer, company, marginPool, referrerRate: refRate, issues };
}

export interface GoodsSettlement {
  saleTotal: number; // فروش = بالاترین قیمت معتبر × تعداد
  purchaseTotal: number; // خرید = ارزان‌ترین انبار (توافقی) × تعداد
  courierFee: number; // پیک
  profit: number; // فروش − خرید − پیک
  referrer: number; // ۳۰٪ سود (فاکتور اول ۲۰٪)
  company: number; // ۷۰٪ سود (فاکتور اول ۸۰٪ — باقیمانده)
  referrerRate: number;
  ok: boolean;
  issues: string[];
}

/** تسویهٔ میز کالا بر پایهٔ پیام ۱۷ — سود = اختلاف خرید و فروش منهای پیک */
export function settleGoods17(params: {
  saleTotal: number;
  purchaseTotal: number;
  courierFee?: number;
  referred?: boolean;
  isFirstInvoice?: boolean;
  settings?: Partial<Plan17Settings>;
}): GoodsSettlement {
  const s = { ...PLAN17_DEFAULTS, ...(params.settings || {}) };
  const issues: string[] = [];
  const courierFee = params.courierFee ?? 0;
  const profit = params.saleTotal - params.purchaseTotal - courierFee;
  const ok = profit > 0;
  if (!ok) issues.push('GOODS_PROFIT_NOT_POSITIVE');
  const refRate = params.isFirstInvoice ? s.goodsReferrerFirst : s.goodsReferrerNormal;
  const referred = !!params.referred;
  const referrer = referred && ok ? Math.round(profit * refRate) : 0;
  const company = ok ? profit - referrer : 0; // باقیمانده → عادی = ۷۰٪ سود
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
export function bankRouting17(params: {
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

/** خواندن نرخ‌های پلن ۱۷ از رکورد تنظیمات (رشتهٔ درصدی مانند '67') */
export function plan17SettingsFromRecord(rec: Record<string, string>): Plan17Settings {
  const num = (v: string | undefined, d: number) => {
    const n = parseFloat(v ?? '');
    return Number.isFinite(n) ? n / 100 : d;
  };
  return {
    servicesExpertPct: num(rec.SERVICES_EXPERT_PCT, PLAN17_DEFAULTS.servicesExpertPct),
    servicesReferrerNormal: num(rec.SERVICES_REFERRER_PCT_NORMAL, PLAN17_DEFAULTS.servicesReferrerNormal),
    servicesReferrerFirst: num(rec.SERVICES_REFERRER_PCT_FIRST, PLAN17_DEFAULTS.servicesReferrerFirst),
    goodsReferrerNormal: num(rec.GOODS_REFERRER_PCT_NORMAL, PLAN17_DEFAULTS.goodsReferrerNormal),
    goodsReferrerFirst: num(rec.GOODS_REFERRER_PCT_FIRST, PLAN17_DEFAULTS.goodsReferrerFirst),
    firstInvoiceDiscount: num(rec.FIRST_INVOICE_DISCOUNT_PCT, PLAN17_DEFAULTS.firstInvoiceDiscount),
  };
}
