import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const schema = z.object({
  query: z.string().trim().min(3).max(200),
  lang: z.enum(['fa', 'en']).default('fa'),
  edition: z.enum(['IRAN', 'WORLD']).default('IRAN'),
  contact: z.string().trim().max(30).optional().nullable(),
});

/** فیلتر خدمات غیرمجاز — فهرست کلیدواژه‌ای (فارسی/انگلیسی) */
const BANNED: RegExp[] = [
  /مواد\s*مخدر|ماری ?جوان|شیش(ه|هٔ)\b|کریستال|هروئین|اکستازی|اپیوئید|تریکا|قارچ\s*جادو|کوکائین/,
  /سلاح|اسلحه|مهمات|کلت|تفنگ|بی\s*دی\s*اس|گلوله|خشاب/,
  /هک(er)?|نفوذ\s*(غیرمجاز|به|به\s*اکانت)|دزدی\s*اکانت|کرک\s*(نرم|سایت)|بات\s*نت|ddos|فیشینگ|phishing|اسکیمر|کلاهبرداری|کید/,
  /جعل|اسناد\s*جعلی|مهر\s*جعلی|گواهی\s*جعلی|مدارک\s*جعلی|شناسنامه\s*جعلی|فکت\s*سازی|کارت\s*ملی\s*جعلی/,
  /قاچاق|سمگل|خروج\s*غیرقانونی|عبور\s*غیرمجاز|موتور\s*لنج/,
  /سقط\s*جنین|فروش\s*عضو|فروش\s*کلیه|پیوند\s*غیرمجاز|فروش\s*خون/,
  /شرط\s*بندی|قمار|کازینو|casino|سایت\s*بت|betting|poker/,
  /پورن|سکسی|جنسی|هرزه|porn|xxx|escort/,
  /تروریسم|بمب\s*ساز|انفجار|مواد\s*منفجره|نارنجک|آدم\s*ربایی|جان\s*سپاری|هیت\s*من/,
  /پول\s*شویی|حواله\s*غیرمجاز|لواباری|دورزدن\s*تحریم|نقض\s*تحریم| laundering|sanction\s*bypass/,
  /سیانور|سم\s*کشنده|بیکربنات\s*کشنده|زهر\s*خرگوش|فروش\s*سم/,
  /دستکاری\s*کیلومتر|کیلومتر\s*شمار|پلاک\s*دزدی|جریمه\s*را\s*حذف|خلاف\s*را\s*پاک/,
  /drugs|weed|cocaine|meth(amphe)?mine|opioid|weapon|gun\s*(sale|shop)|hack(ing)?\s*(service|for|into)|counterfeit|forg(e|ery)|money\s*laundering|human\s*trafficking|organ\s*(sale|trade)|hitman|bomb\s*making|fake\s*(id|passport|license)/,
];

function isBanned(text: string): boolean {
  const t = text.toLowerCase().replace(/\u200c/g, ' ').trim();
  return BANNED.some((re) => re.test(t));
}

interface AiSvc {
  nameFa: string; nameEn: string; descFa: string; descEn: string; category: string;
  baseRate: number; remoteCapable: boolean; details: { nameFa: string; price: number }[];
}

/** هوش مصنوعی: ساخت سریع خدمت درخواستی از جستجوی خالی (در صورت مجاز بودن) */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const { query, lang, edition } = parsed.data;

  // ۱) فیلتر غیرمجاز
  if (isBanned(query)) {
    return NextResponse.json({
      created: false,
      reason: 'FORBIDDEN',
      message:
        lang === 'fa'
          ? 'این درخواست مجاز نیست و ساخته نمی‌شود. فقط خدمات قانونی و حرفه‌ای در الو شتاب ارائه می‌شوند.'
          : 'This request is not allowed and cannot be created. Alo Shetab only offers lawful professional services.',
    });
  }

  // ۲) اگر خدمت مشابه وجود دارد، همان را برگردان
  const norm = (s: string) => s.replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
  const existing = await db.service.findFirst({
    where: { edition, active: true, nameFa: { contains: query.trim().slice(0, 30) } },
    include: { details: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
  });
  if (existing) {
    return NextResponse.json({
      created: false,
      reason: 'EXISTS',
      serviceKey: existing.key,
      message: lang === 'fa' ? `«${existing.nameFa}» از قبل در میز خدمات موجود است.` : `"${existing.nameEn}" already exists.`,
    });
  }

  const isWorld = edition === 'WORLD';
  const cur = isWorld ? 'USD' : 'IRT';
  const rateRange = isWorld ? 'between 10 and 50000 (integer USD, global market average 2026)' : 'بین ۵۰۰٬۰۰۰ تا ۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان (نرخ روز بازار ایران ۱۴۰۵)';
  const detRange = isWorld ? 'integer USD, 5 to baseRate' : 'عدد صحیح تومان، حداکثر دو برابر نرخ پایه';

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const system =
      lang === 'fa'
        ? `تو مدیر کاتالوگ خدمات «الو شتاب» هستی. مشتری خدمتی را می‌خواهد که در کاتالوگ نیست؛ آن را به‌صورت خدمت استاندارد و قانونی تعریف کن. نسخهٔ کاتالوگ: ${isWorld ? 'جهانی (قیمت به دلار)' : 'ایران (قیمت به تومان)'}. فقط و فقط JSON خالص برگردان بدون هیچ متن دیگر:
{"nameFa":"نام خدمت","nameEn":"English name","descFa":"یک جملهٔ شفاف","descEn":"one clear sentence","category":"نام دستهٔ کوتاه","baseRate":<نرخ پایهٔ کل خدمت، ${rateRange}>,"remoteCapable":true|false,"details":[{"nameFa":"ریز جزئیات","price":<قیمت آن قلم، ${detRange}>}]}
قواعد: ۴ تا ۸ ریز جزئیات؛ هر قلم زیرخدمت یا تحویل‌دادنی مشخص است؛ خدمت باید قانونی، حرفه‌ای و قابل انجام باشد؛ هیچ چیز غیرقانونی نساز.`
        : `You are the catalog manager of "Alo Shetab" marketplace. The customer wants a service that is missing. Define it as a standard, lawful service. Catalog edition: ${isWorld ? 'WORLD (prices in USD)' : 'IRAN (prices in Toman)'}. Return ONLY pure JSON, no other text:
{"nameFa":"Persian name","nameEn":"English name","descFa":"one clear Persian sentence","descEn":"one clear English sentence","category":"short category","baseRate":<integer, ${rateRange}>,"remoteCapable":true|false,"details":[{"nameFa":"detail name","price":<integer, ${detRange}>}]}
Rules: 4-8 details, each a concrete sub-task or deliverable; service must be lawful and performable. Never create anything unlawful.`;

    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: query.slice(0, 300) },
        ],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000)),
    ]);
    const content = (completion as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no-json');
    const obj = JSON.parse(m[0]) as Partial<AiSvc> & { details?: { nameFa?: string; price?: number }[] };
    if (!obj.nameFa || typeof obj.baseRate !== 'number' || obj.baseRate <= 0) throw new Error('bad-json');

    const baseRate = isWorld ? Math.min(50000, Math.max(10, Math.round(obj.baseRate))) : Math.min(2_000_000_000, Math.max(50_000, Math.round(obj.baseRate)));
    const key = `ai-${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`;
    const svc = await db.service.create({
      data: {
        key,
        nameFa: String(obj.nameFa).slice(0, 80),
        nameEn: String(obj.nameEn || obj.nameFa).slice(0, 80),
        descFa: String(obj.descFa || 'خدمت درخواستی ساخته‌شده با هوش مصنوعی.').slice(0, 400),
        descEn: String(obj.descEn || 'AI-created requested service.').slice(0, 400),
        category: String(obj.category || (isWorld ? 'Requested Services' : 'خدمات درخواستی')).slice(0, 60),
        baseRate,
        remoteCapable: obj.remoteCapable !== false,
        isMisc: false,
        edition,
        currency: cur,
        aiGenerated: true,
        pendingReview: true,
        requestedBy: parsed.data.contact ?? null,
        sortOrder: 5000 + Math.floor(Math.random() * 4000),
        icon: 'sparkles',
      },
    });
    const details = (Array.isArray(obj.details) ? obj.details : []).slice(0, 8);
    let di = 0;
    const outDetails: { id: string; nameFa: string; price: number }[] = [];
    for (const d of details) {
      if (!d?.nameFa) continue;
      const price = Math.max(0, Math.min(baseRate * 2, Math.round(Number(d.price) || 0)));
      const row = await db.serviceDetail.create({
        data: { serviceId: svc.id, nameFa: String(d.nameFa).slice(0, 80), price, sortOrder: di++ },
      });
      outDetails.push({ id: row.id, nameFa: row.nameFa, price: row.price });
    }
    await logActivity('SYSTEM', `خدمت درخواستی با AI ساخته شد (${edition})`, `«${svc.nameFa}» | درخواست: ${query.slice(0, 120)}`);
    return NextResponse.json({
      created: true,
      service: {
        key: svc.key, nameFa: svc.nameFa, nameEn: svc.nameEn, descFa: svc.descFa, descEn: svc.descEn,
        baseRate: svc.baseRate, remoteCapable: svc.remoteCapable, isMisc: false, category: svc.category,
        percentValue: null, edition, currency: cur, aiGenerated: true, pendingReview: true,
        details: outDetails,
      },
      message:
        lang === 'fa'
          ? `«${svc.nameFa}» ساخته شد و همین حالا در میز خدمات موجود است؛ پشتیبانی نیز آن را بررسی می‌کند.`
          : `"${svc.nameEn}" has been created and is now available; support will review it as well.`,
    });
  } catch {
    return NextResponse.json({
      created: false,
      reason: 'AI_FAIL',
      message:
        lang === 'fa'
          ? 'الان نتوانستم خدمت را بسازم. لطفاً چند لحظه بعد دوباره امتحان کنید یا از گزینهٔ «متفرقه» در سفارش استفاده کنید.'
          : 'Could not create the service right now. Please retry in a moment or use the "Misc" option at checkout.',
    });
  }
}
