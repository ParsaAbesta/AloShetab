import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdmin, isOwner, unauthorized, forbidden, changePassword } from '@/lib/adminAuth';
import { getSettings, setSetting } from '@/lib/settings';
import { logActivity } from '@/lib/reports';
import { validateSheba, validateCard } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

/** تنظیمات کامل (فقط ادمین) */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const s = await getSettings();
  return NextResponse.json({ settings: s });
}

const putSchema = z.object({
  ACCOUNT_NAME: z.string().trim().min(2).max(60).optional(),
  CARD_1: z.string().trim().regex(/^\d{16}$/, 'شماره کارت باید ۱۶ رقم باشد').or(z.string().regex(/^\d{4}(-\d{4}){3}$/)).optional(),
  CARD_2: z.string().trim().regex(/^\d{16}$/, 'شماره کارت باید ۱۶ رقم باشد').or(z.string().regex(/^\d{4}(-\d{4}){3}$/)).optional(),
  SUPPORT_PHONE: z.string().trim().regex(/^0\d{9,10}$/, 'شماره تلفن نامعتبر است').optional(),
  EMAIL_1: z.string().trim().email('ایمیل نامعتبر است').optional(),
  EMAIL_2: z.string().trim().email('ایمیل نامعتبر است').or(z.literal('')).optional(),
  REFERRAL_PERCENT: z.string().regex(/^\d{1,2}$/, 'درصد تخفیف باید عدد ۰ تا ۹۹ باشد').optional(),
  REMOTE_FACTOR: z.string().regex(/^0?\.\d+$|^[01]$/, 'ضریب از راه دور باید بین ۰ و ۱ باشد').optional(),
  ADMIN_PASSWORD: z.string().min(6, 'رمز ادمین حداقل ۶ کاراکتر').max(60).optional(),
  // پیام ۱۱:
  SHEBA_RECEIVING: z.string().trim().optional(),
  POL_RECEIVING: z.string().trim().max(24).optional().or(z.literal('')),
  SHEBA_THRESHOLD: z.string().regex(/^\d{4,10}$/, 'آستانهٔ شبا نامعتبر است').optional(),
  AUTOMATION_ENABLED: z.enum(['true', 'false']).optional(),
  // پلن v3 (پیام ۱۴): سهم کارشناس + افزایش قیمت پلتفرم — جایگزین پلن ۳۳٪ در میز کالا
  EXPERT_SHARE_PCT: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, 'درصد نامعتبر').optional(),
  PLATFORM_MARGIN_PCT: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, 'درصد نامعتبر').optional(),
  // پلن ۳۳٪ میز خدمات (اصلاح مالک: فقط در میز خدمات باقی می‌ماند)
  SERVICE_MARKUP_PCT: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, 'درصد نامعتبر').optional(),
  TICK_SECRET: z.string().trim().min(6).max(60).optional(),
  // پیام ۱۲:
  MIN_INVOICE_AMOUNT: z.string().regex(/^\d{6,10}$/, 'حداقل فاکتور نامعتبر است').optional(),
  PRICE_FRESH_FROM: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ باید yyyy-mm-dd باشد').optional(),
  COURIER_FEE_SMALL: z.string().regex(/^\d{5,10}$/, 'هزینهٔ پیک نامعتبر است').optional(),
  COURIER_FEE_HEAVY: z.string().regex(/^\d{5,10}$/, 'هزینهٔ پیک نامعتبر است').optional(),
});

/** ذخیرهٔ تنظیمات — شماره حساب‌ها، تلفن پشتیبانی، ایمیل‌های گزارش، تخفیف معرف، رمزها */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر';
    return NextResponse.json({ error: 'INVALID_INPUT', message: msg }, { status: 400 });
  }
  // تنظیمات حساس فقط با دسترسی مالک
  const ownerOnly = ['ADMIN_PASSWORD', 'CARD_1', 'CARD_2', 'SHEBA_RECEIVING', 'POL_RECEIVING', 'SHEBA_THRESHOLD', 'TICK_SECRET', 'MIN_INVOICE_AMOUNT', 'PRICE_FRESH_FROM', 'COURIER_FEE_SMALL', 'COURIER_FEE_HEAVY', 'EXPERT_SHARE_PCT', 'PLATFORM_MARGIN_PCT', 'SERVICE_MARKUP_PCT'];
  if (Object.keys(parsed.data).some((k) => ownerOnly.includes(k)) && !(await isOwner())) {
    return forbidden('ویرایش حساب‌ها و رمزها فقط با دسترسی مالک مجاز است');
  }
  const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined && v !== '') as [string, string][];
  for (const [key, value] of entries) {
    // بررسی صحت شبای دریافت پیش از ذخیره
    if (key === 'SHEBA_RECEIVING') {
      const v = validateSheba(value);
      if (!v.valid) {
        return NextResponse.json(
          { error: 'INVALID_SHEBA', message: `شبا نامعتبر است — طول ${v.length} (شبای ایران ۲۶ کاراکتر است و رقم کنترل باید صحیح باشد)` },
          { status: 400 }
        );
      }
      await setSetting(key, value.replace(/[\s-]/g, '').toUpperCase());
      continue;
    }
    // بررسی صحت کارت حساب دریافت پیش از ذخیره (در صورت تکمیل)
    if (key === 'POL_RECEIVING') {
      if (value.replace(/\D/g, '').length > 0) {
        const v = validateCard(value);
        if (!v.valid) {
          return NextResponse.json(
            { error: 'INVALID_CARD', message: 'شماره کارت حساب دریافت نامعتبر است (الگوریتم Luhn)' },
            { status: 400 }
          );
        }
        await setSetting(key, value.replace(/\D/g, ''));
        continue;
      }
      await setSetting(key, '');
      continue;
    }
    // نرمال‌سازی کارت به ۱۶ رقم
    if (key === 'CARD_1' || key === 'CARD_2') {
      await setSetting(key, value.replace(/\D/g, ''));
    } else if (key === 'ADMIN_PASSWORD') {
      await setSetting(key, value);
      await changePassword('owner', value); // همگام‌سازی رمز مالک در پنل
    } else if (key === 'EXPERT_SHARE_PCT' || key === 'PLATFORM_MARGIN_PCT') {
      // اعتبارسنجی پلن v3: کارشناس ≥ ۱۶٫۵ | پلتفرم بین ۱۰ و ۱۶٫۵
      const { validateMarkupPlan } = await import('@/lib/constants');
      const e = key === 'EXPERT_SHARE_PCT' ? parseFloat(value) : undefined;
      const p = key === 'PLATFORM_MARGIN_PCT' ? parseFloat(value) : undefined;
      const cur = await getSettings();
      const eEff = e ?? parseFloat(cur.EXPERT_SHARE_PCT || '18');
      const pEff = p ?? parseFloat(cur.PLATFORM_MARGIN_PCT || '12');
      const chk = validateMarkupPlan(eEff, pEff);
      if (!chk.ok) {
        return NextResponse.json({ error: 'INVALID_PLAN', message: chk.message }, { status: 400 });
      }
      await setSetting(key, String(e ?? p));
    } else if (key === 'SERVICE_MARKUP_PCT') {
      // پلن ۳۳٪ میز خدمات — بین ۰ و ۹۹ درصد
      const v = parseFloat(value);
      if (!Number.isFinite(v) || v < 0 || v > 99) {
        return NextResponse.json({ error: 'INVALID_PLAN', message: 'پلن خدمات باید عددی بین ۰ تا ۹۹ باشد' }, { status: 400 });
      }
      await setSetting(key, String(v));
    } else {
      await setSetting(key, value);
    }
  }
  await logActivity('ADMIN', 'بروزرسانی تنظیمات', entries.map(([k]) => k).join(', '));
  const s = await getSettings();
  return NextResponse.json({ ok: true, settings: s });
}
