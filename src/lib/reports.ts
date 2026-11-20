// ─── گزارش‌دهی: صف گزارش + تابع sendEmail آمادهٔ SMTP ────────
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';

/**
 * تابع ارسال ایمیل — آمادهٔ جای‌گذاری SMTP واقعی.
 * به‌محض فعال شدن ایمیل دوم/SMTP، بدون تغییر کدِ فراخوانی کار می‌کند.
 * متغیرهای محیطی مورد نیاز (وقتی آماده شد):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */
export async function sendEmail(to: string[], subject: string, body: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    // SMTP هنوز راه‌اندازی نشده — گزارش در صف می‌ماند و در ادمین نمایش داده می‌شود.
    console.log(`[sendEmail:queued] to=${to.join(',')} subject=${subject}`);
    return false;
  }
  try {
    // nodemailer به‌صورت داینامیک ایمپورت می‌شود تا در نبود SMTP هیچ بار اضافه‌ای نباشد
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: parseInt(process.env.SMTP_PORT ?? '587', 10) === 465,
      auth: { user, pass },
    });
    await transport.sendMail({ from: user, to: to.join(','), subject, text: body });
    return true;
  } catch (e) {
    console.error('[sendEmail:error]', e);
    return false;
  }
}

/**
 * ثبت گزارش در صف برای دو ایمیل شرکت.
 * ایمیل دوم (AloShetabAdmin) هنوز راه‌اندازی نشده؛ به‌محض فعال شدن بدون تغییر کد دریافت می‌کند.
 */
export async function queueReport(
  type: 'ORDER' | 'PAYMENT' | 'STATUS' | 'RATING' | 'WORKER' | 'REFERRAL' | 'CONTACT' | 'SYSTEM' | 'PRODUCT' | 'INVEST' | 'FUND',
  title: string,
  body: string
): Promise<void> {
  try {
    const s = await getSettings();
    const emails = [s.EMAIL_1, s.EMAIL_2].filter(Boolean).join(',');
    const item = await db.reportItem.create({ data: { type, title, body, emails } });
    const ok = await sendEmail(emails.split(','), title, body);
    if (ok) {
      await db.reportItem.update({ where: { id: item.id }, data: { sent: true, sentAt: new Date() } });
    }
  } catch (e) {
    console.error('[queueReport:error]', e);
  }
}

export async function logActivity(actor: 'CUSTOMER' | 'ADMIN' | 'SYSTEM', action: string, detail?: string): Promise<void> {
  try {
    await db.activityLog.create({ data: { actor, action, detail } });
  } catch (e) {
    console.error('[logActivity:error]', e);
  }
}
