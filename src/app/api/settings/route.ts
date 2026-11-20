import { NextResponse } from 'next/server';
import { getSettings, PUBLIC_SETTING_KEYS } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** تنظیمات عمومی قابل نمایش در رابط کاربری (بدون رمز ادمین) */
export async function GET() {
  const s = await getSettings();
  const pub: Record<string, string> = {};
  for (const k of PUBLIC_SETTING_KEYS) pub[k] = s[k];
  return NextResponse.json({ settings: pub });
}
