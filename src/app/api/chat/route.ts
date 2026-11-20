import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ORDER_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const schema = z.object({
  message: z.string().trim().min(1).max(1500),
  lang: z.enum(['fa', 'en']).default('fa'),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(12).optional(),
});

const STATUS_FA: Record<string, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'در انتظار پرداخت',
  [ORDER_STATUS.EXPERT_REVIEW]: 'در انتظار بررسی و کارشناسی',
  [ORDER_STATUS.PAID]: 'پرداخت‌شده — آمادهٔ زمان‌بندی',
  [ORDER_STATUS.SCHEDULED]: 'زمان‌بندی‌شده',
  [ORDER_STATUS.IN_PROGRESS]: 'در حال انجام',
  [ORDER_STATUS.DONE]: 'انجام‌شده — منتظر ثبت رضایت شما',
  [ORDER_STATUS.CANCELLED]: 'لغو شده',
};
const STATUS_EN: Record<string, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'Awaiting payment',
  [ORDER_STATUS.EXPERT_REVIEW]: 'Awaiting expert review',
  [ORDER_STATUS.PAID]: 'Paid — ready to schedule',
  [ORDER_STATUS.SCHEDULED]: 'Scheduled',
  [ORDER_STATUS.IN_PROGRESS]: 'In progress',
  [ORDER_STATUS.DONE]: 'Done — awaiting your satisfaction rating',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

/** وضعیت سفارش با کد رهگیری + موبایل (بدون LLM — سریع و قطعی) */
async function orderStatusReply(message: string, lang: 'fa' | 'en'): Promise<string | null> {
  const codeMatch = message.toUpperCase().match(/AS[- ]?(\d{6})/);
  const mobileMatch = message.match(/09\d{9}/);
  if (!codeMatch) return null;
  const code = `AS-${codeMatch[1]}`;
  const order = await db.order.findUnique({
    where: { code },
    include: { customer: true, items: { include: { service: true } }, events: { orderBy: { createdAt: 'asc' }, take: 20 } },
  });
  if (!order || (mobileMatch && order.customer.mobile !== mobileMatch[0])) {
    return lang === 'fa'
      ? `سفارشی با کد ${code}${mobileMatch ? ' و این شماره موبایل' : ''} پیدا نکردم. لطفاً کد رهگیری و شمارهٔ همراهِ سفارش را دقیق بفرستید، یا از صفحهٔ «پیگیری سفارش» استفاده کنید.`
      : `No order found for ${code}${mobileMatch ? ' with this mobile number' : ''}. Please double-check the tracking code and the order mobile, or use the Track Order page.`;
  }
  const st = lang === 'fa' ? STATUS_FA[order.status] : STATUS_EN[order.status];
  const last = order.events[order.events.length - 1];
  const items = order.items.map((i) => `${lang === 'fa' ? i.service.nameFa : i.service.nameEn} ×${i.qty}`).join(', ');
  const fmt = (d: Date) => new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(d);
  return lang === 'fa'
    ? `سفارش ${code} — وضعیت فعلی: «${st}».\nخدمات: ${items}\nمبلغ: ${order.total.toLocaleString('fa-IR')} تومان\nآخرین بهروزرسانی: ${last ? last.noteFa + ' (' + fmt(last.createdAt) + ')' : '—'}\nبرای جزئیات کامل، صفحهٔ «پیگیری سفارش» را با کد و موبایل باز کنید.`
    : `Order ${code} — current status: "${st}".\nServices: ${items}\nAmount: ${order.total.toLocaleString('en-US')} Toman\nLast update: ${last ? last.noteEn + ' (' + fmt(last.createdAt) + ')' : '—'}\nFor full details, open the Track Order page with the code and mobile.`;
}

/** پاسخ قاعده‌محور در نبود LLM */
function fallbackReply(message: string, lang: 'fa' | 'en'): string {
  const m = message.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => m.includes(k));
  if (has('قیمت', 'نرخ', 'هزینه', 'price', 'cost', 'rate', 'تومان')) {
    return lang === 'fa'
      ? 'قیمت هر خدمت = نرخ پایه × ضریب روز هفته (پنجشنبه ×۱٫۱، جمعه ×۱٫۲) × ضریب ساعت (۸–۱۷ ×۱، ۱۷–۲۲ ×۱٫۱، ۲۲–۸ ×۱٫۲۵) × نرخ روز خدمت − ۵٪ تخفیف معرف. حالت «از راه دور» با ضریب ۰٫۷ ارزان‌تر است. نرخ پایهٔ هر خدمت در کارت همان خدمت و دکمهٔ راهنمای کنارش نمایش داده می‌شود.'
      : 'Price = base rate × weekday factor (Thu ×1.1, Fri ×1.2) × hour factor (8–17 ×1, 17–22 ×1.1, 22–8 ×1.25) × day rate − 5% referral discount. Remote mode gets a ×0.7 discount. Base rates appear on each service card and its help button.';
  }
  if (has('پرداخت', 'درگاه', 'کارت', 'pay', 'payment', 'gateway')) {
    return lang === 'fa'
      ? 'پرداخت فقط از طریق میز خدمات و به حساب‌های شرکت «ألو شتاب» انجام می‌شود: درگاه اینترنتی شاپرک/شتاب (کارت ← رمز دوم ← OTP) یا کارت‌به‌کارت با ثبت رسید و تأیید ادمین. کل مبلغ ابتدا در کیف پول شرکت امانت می‌ماند و پس از رضایت شما تسویه می‌شود.'
      : 'Payment goes only through the service desk to "Alo Shetab" company accounts: Shaparak/Shetab gateway (card → PIN2 → OTP) or card-to-card with a receipt confirmed by the admin. The full amount is held in escrow and settled after your satisfaction.';
  }
  if (has('معرف', 'معرفی', 'تخفیف', 'referral', 'discount')) {
    return lang === 'fa'
      ? 'هر کد ملیِ ثبت‌شده یک کد معرف یکتاست. با وارد کردن کد معرف، ۸٪ تخفیف روی کل سفارش می‌گیرید و حق معرفی نیز برای معرف ثبت و طبق فرایند داخلی واریز می‌شود. مشتری و معرف نمی‌توانند یک نفر باشند.'
      : 'Every registered national ID is a unique referral code. Entering it gives 8% off the whole order; a referral fee is also recorded for the referrer and paid per the internal process. Customer and referrer cannot be the same person.';
  }
  if (has('همکار', 'جذب', 'worker', 'join')) {
    return lang === 'fa'
      ? 'برای همکاری با ألو شتاب، از منو «جذب همکار» را باز کنید و نام، کد ملی، موبایل، شهر، رشتهٔ تخصصی و سوابق را ثبت کنید. پس از تأیید ادمین، در تسویهٔ سفارش‌ها قابل انتخاب می‌شوید و با امتیاز مشتری‌ها به سطح برنزی/نقره‌ای/طلایی می‌رسید.'
      : 'To join Alo Shetab, open "Join as worker" from the menu and submit your name, national ID, mobile, city, specialty and résumé. After admin approval you become selectable for order settlements, plus Bronze/Silver/Gold levels from customer ratings.';
  }
  if (has('تسویه', 'سهم', 'کیف پول', 'settle', 'settlement', 'wallet')) {
    return lang === 'fa'
      ? 'کل مبلغ سفارش ابتدا در کیف پول ألو شتاب نگه داشته می‌شود. پس از ثبت رضایت شما، تسویه به‌صورت خودکار انجام می‌شود؛ جزئیات سهم‌ها مطابق قرارداد نزد ألو شتاب محرمانه است.'
      : 'The full order amount is held in the Alo Shetab wallet. After your satisfaction rating, settlement runs automatically; share details stay confidential to Alo Shetab per the contract.';
  }
  if (has('امتیاز', 'رضایت', 'rating', 'stars')) {
    return lang === 'fa'
      ? 'پس از پایان کار، در صفحهٔ پیگیری سفارش جمعاً ۱۰ امتیاز ثبت می‌کنید: ۵ امتیاز مهارت + ۵ امتیاز اخلاق (هر کدام ۰ تا ۵ ستاره). این امتیازها مبنای سطح و مزایای همکاران است.'
      : 'After completion, submit 10 points on the Track Order page: 5 skill + 5 ethics (0–5 stars each). These ratings drive worker levels and benefits.';
  }
  if (has('سلام', 'درود', 'hello', 'hi', 'سلام علیکم')) {
    return lang === 'fa'
      ? 'سلام! به میز خدمات ألو شتاب خوش آمدید. دربارهٔ خدمات، قیمت، پرداخت، کد معرف یا وضعیت سفارش (کد را با فرمت AS-XXXXXX بفرستید) هر سؤالی دارید بپرسید.'
      : 'Hello! Welcome to the Alo Shetab Service Desk. Ask me anything about services, pricing, payment, referral codes, or your order status (send the code as AS-XXXXXX).';
  }
  return lang === 'fa'
    ? 'سؤال شما را متوجه شدم. می‌توانم دربارهٔ فهرست خدمات، قیمت‌گذاری پویا، روش‌های پرداخت، کد معرف و تخفیف، جذب همکار، یا وضعیت سفارش (کد رهگیری AS-XXXXXX + موبایل) راهنمایی کنم. تلفن تماس پشتیبانی در پایین صفحهٔ سایت درج شده است.'
    : 'I understand. I can help with the service catalog, dynamic pricing, payment methods, referral discounts, joining as a worker, or order status (tracking code AS-XXXXXX + mobile). The support phone number is listed at the bottom of the site.';
}

/** پشتیبانی هوشمند ألو شتاب — پاسخ دربارهٔ خدمات، قیمت، پرداخت، معرفی و وضعیت سفارش (fa/en) */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'پیام نامعتبر است' }, { status: 400 });
  }
  const { message, lang } = parsed.data;

  // ۱) اگر کد رهگیری در پیام است، وضعیت را مستقیم و قطعی از دیتابیس بده
  const direct = await orderStatusReply(message, lang);
  if (direct) return NextResponse.json({ reply: direct, source: 'order-lookup' });

  // ۲) درخواست فهرست خدمات — از دیتابیس
  const wantsServices = /خدمات|فهرست|لیست|چه کار|services|list|catalog/i.test(message);
  if (wantsServices && message.length < 60) {
    const services = await db.service.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    const list = services.map((s) => `• ${lang === 'fa' ? s.nameFa : s.nameEn}${s.isMisc ? '' : ` — ${(lang === 'fa' ? s.baseRate.toLocaleString('fa-IR') : s.baseRate.toLocaleString('en-US'))} ${lang === 'fa' ? 'تومان' : 'Toman'}`}`).join('\n');
    const reply = lang === 'fa'
      ? `فهرست خدمات ألو شتاب:\n${list}\n\nهزینهٔ نهایی بر اساس روز، ساعت و حالت انجام (حضوری/از راه دور) محاسبه می‌شود. کدام خدمت را می‌خواهید؟`
      : `Alo Shetab services:\n${list}\n\nFinal price depends on day, hour and mode (on-site/remote). Which service do you need?`;
    return NextResponse.json({ reply, source: 'catalog' });
  }

  // ۳) پاسخ با هوش مصنوعی + زمینهٔ سیستم
  try {
    const [services, settings] = await Promise.all([
      db.service.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.setting.findMany(),
    ]);
    const setMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const svcList = services.map((s) => `- ${lang === 'fa' ? s.nameFa : s.nameEn} (${s.key}): base ${(lang === 'fa' ? s.baseRate.toLocaleString('fa-IR') : s.baseRate.toLocaleString('en-US'))} Toman, ${s.remoteCapable ? 'remote OK' : 'on-site only'}`).join('\n');
    const system = [
      lang === 'fa'
        ? 'تو «پشتیبان هوشمند میز خدمات ألو شتاب» هستی. فقط به زبان کاربر و کوتاه (حداکثر ۱۲۰ کلمه) پاسخ بده.'
        : 'You are the Alo Shetab Service Desk smart assistant. Answer briefly (max 120 words) in the user\'s language.',
      lang === 'fa'
        ? 'قواعد: قیمت = نرخ پایه × ضریب روز هفته (پنجشنبه ×۱٫۱، جمعه ×۱٫۲) × ضریب ساعت (۸–۱۷ ×۱ | ۱۷–۲۲ ×۱٫۱ | ۲۲–۸ ×۱٫۲۵) × نرخ روز خدمت − تخفیف معرف ۵٪. از راه دور ×۰٫۷. پرداخت فقط به حساب‌های ألو شتاب با درگاه شاپرک/شتاب یا کارت‌به‌کارت با تأیید ادمین. کل مبلغ امانی در کیف پول ألو شتاب می‌ماند و پس از رضایت مشتری، تسویهٔ خودکار انجام می‌شود. امتیازدهی: ۵ مهارت + ۵ اخلاق (۰ تا ۵ ستاره). تلفن پشتیبانی فقط در فوتر سایت است.'
        : 'Rules: price = base × weekday factor (Thu ×1.1, Fri ×1.2) × hour factor (8–17 ×1 | 17–22 ×1.1 | 22–8 ×1.25) × day rate − 5% referral discount. Remote ×0.7. Payment only to Alo Shetab accounts via Shaparak/Shetab gateway or card-to-card confirmed by admin. Full amount held in escrow; after customer satisfaction, settlement runs automatically. Rating: 5 skill + 5 ethics (0–5 stars). Support phone is only in the site footer.',
      `Services:\n${svcList}`,
      `Company accounts (name: ${setMap.ACCOUNT_NAME ?? 'ألو شتاب'}): ${setMap.CARD_1 ?? ''} , ${setMap.CARD_2 ?? ''}`,
      lang === 'fa'
        ? 'برای وضعیت سفارش از کاربر کد رهگیری AS-XXXXXX و موبایل را بخواه (خودت به دیتابیس دسترسی نداری). اطلاعات غیروقوعی اختراع نکن.'
        : 'For order status ask the user for the AS-XXXXXX code and mobile (you have no direct DB access). Never invent facts.',
    ].join('\n');

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          ...(parsed.data.history ?? []),
          { role: 'user', content: message },
        ],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000)),
    ]);
    const content = (completion as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content?.trim();
    if (content) return NextResponse.json({ reply: content, source: 'ai' });
    return NextResponse.json({ reply: fallbackReply(message, lang), source: 'fallback' });
  } catch {
    return NextResponse.json({ reply: fallbackReply(message, lang), source: 'fallback' });
  }
}
