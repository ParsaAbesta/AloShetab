// ─── تنظیمات سیستم (key/value با مقادیر پیش‌فرض) ────────────
import { db } from '@/lib/db';
import { DEFAULT_SETTING_VALUES } from '@/lib/constants';

export type SettingKey = keyof typeof DEFAULT_SETTING_VALUES;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.setting.findMany();
  const map = { ...DEFAULT_SETTING_VALUES } as Record<SettingKey, string>;
  for (const row of rows) {
    if (row.key in map) map[row.key as SettingKey] = row.value;
  }
  return map;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function referralPercent(): Promise<number> {
  const s = await getSettings();
  const p = parseFloat(s.REFERRAL_PERCENT);
  return Number.isFinite(p) ? p : 8;
}

// تنظیمات عمومی قابل نمایش در رابط کاربری — بدون هیچ دادهٔ محرمانهٔ تقسیم‌بندی
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  'ACCOUNT_NAME', 'SUPPORT_PHONE', 'VERSION',
  'SHEBA_RECEIVING', 'POL_RECEIVING', 'SHEBA_THRESHOLD',
  'MIN_INVOICE_AMOUNT', // پیام ۱۲ — حداقل فاکتور، اطلاعات عمومی قیمت‌گذاری
];

/** توقف عملیات توسط حسابدار هوشمند فعال است؟ */
export async function isFrozen(): Promise<{ frozen: boolean; since: string }> {
  const s = await getSettings();
  return { frozen: s.OPERATIONS_FROZEN === 'true', since: s.FROZEN_AT ?? '' };
}
