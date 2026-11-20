// ─── ثابت‌ها و وضعیت‌های سیستم ──────────────────────────────

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  EXPERT_REVIEW: 'EXPERT_REVIEW',
  PAID: 'PAID',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS;

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'PENDING_PAYMENT', 'PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE',
];

// سهم‌بندی جدید (مجموعاً ۷/۷):
export const WORKER_SHARE = 4 / 7; // سهم انجام‌دهنده — ۴/۷ مبلغ کل
export const REFERRAL_SHARE = 1 / 7; // سهم معرف مشتری — ۱/۷ مبلغ کل
export const COMPANY_SHARE = 2 / 7; // سهم ألو شتاب — ۲/۷ مبلغ کل (در سفارش بدون معرف، ۳/۷)

export const PAYMENT_METHOD = { GATEWAY: 'GATEWAY', CARD_TRANSFER: 'CARD_TRANSFER' } as const;
export const PAYMENT_STATUS = { PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED', AWAITING_ADMIN: 'AWAITING_ADMIN' } as const;

export const WORKER_LEVEL = { BRONZE: 'BRONZE', SILVER: 'SILVER', GOLD: 'GOLD' } as const;

// ─── پیام ۱۱: حساب‌های مالی (بررسی‌شده با کد — صحیح) ─────────
// شبای حساب دریافت: IR43 0170 0000 0034 5884 8410 04 — بانک مهر ایران (کد ۰۱۷) — mod-97 ✔
export const SHEBA_RECEIVING_DEFAULT = 'IR430170000000345884841004';
// کارت مبالغ تصمیم‌گیری/تقسیم‌بندی (حق معرفی، خرید کالا، دستمزد کارشناس): بانک ملی — Luhn ✔
export const CARD_DIVISION_DEFAULT = '6037998140974550';
// کارت سهم شرکت: بانک قرض‌الحسنه مهر ایران — Luhn ✔
export const CARD_COMPANY_DEFAULT = '6063731121468624';
// ─── پیام ۱۲ (اصلاح ۱۴۰۵/۰۸/۲۶): حداقل مبلغ هر فاکتور ────────
// «حداقل مبلغ دریافتی از هر فاکتور باید ۵٬۰۰۰٬۰۰۰ تومان باشد» —
// در صفحهٔ پرداخت به این سقف تعدیل می‌شود؛ چون همهٔ فاکتورها ≥ ۵م هستند،
// دریافت همیشه از طریق شبای حساب دریافت (بانک مهر ایران) انجام می‌شود.
export const MIN_INVOICE_DEFAULT = '5000000';
export const SHEBA_THRESHOLD_DEFAULT = '5000000';

// ─── پیام ۱۲: تازگی قیمت‌ها — فقط از ۱ نوامبر ۲۰۲۶ (۱۴۰۵/۰۸/۱۰) به بعد ──
export const PRICE_FRESH_FROM_DEFAULT = '2026-11-01'; // ISO — معادل شمسی: ۱۴۰۵/۰۸/۱۰

// ─── پیام ۱۴ (v3.0): پلن جدید قیمت‌گذاری — جایگزین کامل پلن ۳۳٪ ──
// «۱۶٫۵ تا ۲۰ درصد یا بیشتر از کارشناس، مابقی (۱۰ تا ۱۶٫۵ درصد) افزایش قیمت»
export const EXPERT_SHARE_PCT_DEFAULT = '18'; // سهم کارشناس — پیش‌فرض ۱۸٪
export const PLATFORM_MARGIN_PCT_DEFAULT = '12'; // افزایش قیمت پلتفرم — پیش‌فرض ۱۲٪
export const EXPERT_SHARE_MIN = 16.5; // کمترین سهم کارشناس («یا بیشتر» = بدون سقف)
export const PLATFORM_MARGIN_MIN = 10; // کمترین افزایش قیمت
export const PLATFORM_MARGIN_MAX = 16.5; // بیشترین افزایش قیمت

/** اعتبارسنجی پلن v3: سهم کارشناس ≥ ۱۶٫۵ | افزایش قیمت در بازهٔ ۱۰ تا ۱۶٫۵ */
export function validateMarkupPlan(expertPct: number, platformPct: number): { ok: boolean; message?: string } {
  if (!Number.isFinite(expertPct) || expertPct < EXPERT_SHARE_MIN) {
    return { ok: false, message: `سهم کارشناس باید حداقل ${EXPERT_SHARE_MIN} درصد باشد (یا بیشتر)` };
  }
  if (!Number.isFinite(platformPct) || platformPct < PLATFORM_MARGIN_MIN || platformPct > PLATFORM_MARGIN_MAX) {
    return { ok: false, message: `افزایش قیمت پلتفرم باید بین ${PLATFORM_MARGIN_MIN} و ${PLATFORM_MARGIN_MAX} درصد باشد` };
  }
  return { ok: true };
}

// ─── پیام ۱۲: هزینهٔ ارسال و بسته‌بندی (پیک) — در صفحهٔ پرداخت ────
export const COURIER_FEE_SMALL_DEFAULT = '250000'; // کالای سبک/متوسط
export const COURIER_FEE_HEAVY_DEFAULT = '750000'; // کالای سنگین (یخچال، لباسشویی، تلویزیون، کولر، بخاری، ...)

// دسته‌های کالای سنگین برای هزینهٔ پیک
export const HEAVY_GOODS_CATEGORIES = ['یخچال', 'لباسشویی', 'تلویزیون', 'کولر', 'بخاری'];

export const DEFAULT_SETTING_VALUES = {
  ACCOUNT_NAME: 'ألو شتاب',
  CARD_1: '6037998140974550', // کارت تقسیم‌بندی (ملی) — محرمانه/داخلی
  CARD_2: '6063731121468624', // کارت سهم شرکت (مهر ایران) — محرمانه/داخلی
  SUPPORT_PHONE: '09014700109',
  EMAIL_1: 'AloShetabOwner@Gmail.com',
  EMAIL_2: 'AloShetabAdmin@Gmail.com',
  REFERRAL_PERCENT: '5',
  REMOTE_FACTOR: '0.7',
  ADMIN_PASSWORD: 'AloShetab1404',
  VERSION: 'v5.0-IR', // پیام ۲۰: نسخهٔ V5.0 — نسخهٔ جهانی en در هدر سایت جابه‌جا می‌شود
  // پیام ۱۹/۲۰ (V4.1→V5.0): قفل «سود بلاصاحب → بانک ملی» + پاداش سقف‌دار دوره‌ای معرف
  // پیام ۲۰ (V5.0): هر ۵ فاکتور قطعی‌شده از جانب هر معرف → ۵۰۰٬۰۰۰ تومان پاداش ثابت
  PERIODIC_BONUS_ENABLE: '1', // فعال/غیرفعال پاداش دوره‌ای
  PERIODIC_BONUS_INVOICES: '5', // هر چند فاکتور از جانب معرف → یک پاداش
  PERIODIC_BONUS_REWARD: '500000', // مبلغ ثابت (سقف‌دار) هر پاداش دوره‌ای (تومان)
  COMPANY_BONUS_DEBT: '0', // پیام ۲۰: بدهی پاداش تأمین‌نشده — از واریزی‌های ملی بعدی کسر می‌شود
  PERIODIC_BONUS_PERIODS: '', // دوره‌های بسته‌شده (کلید '1405-08' جدا با کاما) — نهایی‌سازی تکراری ممنوع
  // پیام ۱۱:
  SHEBA_RECEIVING: SHEBA_RECEIVING_DEFAULT, // شبای حساب دریافت (بانک مهر ایران) — عمومی
  POL_RECEIVING: '', // شماره کارت حساب دریافت (در صورت تمایل ادمین تکمیل کند)
  SHEBA_THRESHOLD: SHEBA_THRESHOLD_DEFAULT,
  AUTOMATION_ENABLED: 'false', // فعلاً امور دستی توسط ادمین؛ مالک فعال می‌کند
  OPERATIONS_FROZEN: 'false', // توقف عملیات توسط حسابدار هوشمند
  FROZEN_AT: '', // زمان توقف (ISO)
  // پیام ۱۴ (v3.0): پلن جدید — سهم کارشناس + افزایش قیمت (پلن ۳۳٪ از میز کالا حذف شد)
  EXPERT_SHARE_PCT: EXPERT_SHARE_PCT_DEFAULT, // سهم کارشناس ۱۶٫۵ تا ۲۰+ درصد — فقط میز کالا
  PLATFORM_MARGIN_PCT: PLATFORM_MARGIN_PCT_DEFAULT, // افزایش قیمت پلتفرم ۱۰ تا ۱۶٫۵ درصد — فقط میز کالا
  SERVICE_MARKUP_PCT: '33', // پلن ۳۳٪ — فقط در میز خدمات باقی می‌ماند (اصلاح مالک)
  // پیام ۱۸ (V4.0): پلن مالی — سهم‌ها درون اجرت، بدون افزودنی؛ پورسانت معرف فقط فاکتور اول
  SERVICES_EXPERT_PCT: '67', // دستمزد کارشناس خدمات = ۶۷٪ اجرت → بانک مهر
  SERVICES_REFERRER_PCT_NORMAL: '0', // منسوخ در V4.0 — پورسانت معرف مستمر حذف شد (کلید فقط برای سازگاری)
  SERVICES_REFERRER_PCT_FIRST: '10', // پورسانت معرف خدمات — فقط فاکتور اول معرفی‌شده
  GOODS_REFERRER_PCT_NORMAL: '0', // منسوخ در V4.0 — پورسانت معرف مستمر حذف شد (کلید فقط برای سازگاری)
  GOODS_REFERRER_PCT_FIRST: '20', // پورسانت معرف کالا — فقط فاکتور اول (از سود کالا)
  FIRST_INVOICE_DISCOUNT_PCT: '10', // تخفیف فقط فاکتور اول مشتری معرفی‌شده
  TICK_SECRET: 'AloShetab-Tick-1405', // کلید کرن شبانه /api/tick
  // پیام ۱۲ (اصلاح ۱۴۰۵/۰۸/۲۶):
  MIN_INVOICE_AMOUNT: MIN_INVOICE_DEFAULT, // حداقل مبلغ دریافتی هر فاکتور (تومان)
  PRICE_FRESH_FROM: PRICE_FRESH_FROM_DEFAULT, // فقط قیمت‌های بعد از این تاریخ معتبرند
  COURIER_FEE_SMALL: COURIER_FEE_SMALL_DEFAULT, // هزینهٔ ارسال و بسته‌بندی — کالای سبک
  COURIER_FEE_HEAVY: COURIER_FEE_HEAVY_DEFAULT, // هزینهٔ ارسال و بسته‌بندی — کالای سنگین
  // پیام ۱۳ — اتصال لحظه‌ای:
  LIVE_FEED_STATUS: '', // وضعیت آخرین چرخهٔ اتصال (JSON داخلی)
  DIGIKALA_COOKIE: '', // کوکی معتبر api.digikala.com — برای عبور از چالش CDN (اختیاری، توسط مالک ثبت می‌شود)
} as const;

export function orderCode(): string {
  return `AS-${Math.floor(100000 + Math.random() * 900000)}`;
}

/** ماسک شماره کارت برای نمایش: ****-****-****-4550 */
export function maskCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `****-****-****-${digits.slice(-4)}`;
}

// ─── پیام ۱۱: مراحل فاکتور ──────────────────────────────────
export const INVOICE_STAGES = [
  'PAID_FROM_ACCOUNT', // پرداخت از حساب
  'PAID_TO_ACCOUNT', // پرداخت به شماره حساب
  'COORDINATION_PHONE', // تلفن هماهنگی
  'OPERATOR_INFO', // مشخصات اپراتور
  'ADDRESS_CONFIRMED', // آدرس دقیق مشتری
  'WAREHOUSE_PRICE', // قیمت انبار
  'SITE_PRICE', // قیمت کالا در سایت
  'HANDED_TO_COURIER', // به پیک تحویل داده شد
  'DEPOSITED_TO_ACCOUNT', // واریزی مبلغ کالا به شماره حساب ... به نام ...
  'DONE', // با موفقیت انجام شد
] as const;
export type InvoiceStageKey = (typeof INVOICE_STAGES)[number];

export const INVOICE_STAGE_LABELS_FA: Record<string, string> = {
  PAID_FROM_ACCOUNT: 'پرداخت از حساب انجام شد',
  PAID_TO_ACCOUNT: 'پرداخت به شماره حساب انجام شد',
  COORDINATION_PHONE: 'تلفن هماهنگی ثبت/تماس گرفته شد',
  OPERATOR_INFO: 'مشخصات اپراتور ثبت شد',
  ADDRESS_CONFIRMED: 'آدرس دقیق مشتری (پلاک، طبقه، واحد) ثبت شد',
  WAREHOUSE_PRICE: 'قیمت انبار ثبت شد',
  SITE_PRICE: 'قیمت کالا در سایت ثبت شد',
  HANDED_TO_COURIER: 'به پیک تحویل داده شد',
  DEPOSITED_TO_ACCOUNT: 'واریزی مبلغ کالا به شماره حساب ... به نام ... انجام شد',
  DONE: 'با موفقیت انجام شد',
};

// ─── پیام ۱۱: بازهٔ زمانی رسیدگی (روز) ──────────────────────
export const SERVICE_LEAD_DAYS = '1-3'; // امور خدمات — با هماهنگی و تأیید ساعت/زمان مشتری
export const GOODS_LEAD_DAYS = '3-7'; // امور کالا
