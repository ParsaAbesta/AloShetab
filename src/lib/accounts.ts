// ─── پیام ۱۱: بررسی صحت شماره شبا (IBAN mod-97) و شماره کارت (Luhn) ──
// مورد استفاده در پنل ادمین برای «بررسی دقیق شبا و پل و اصلاح در صورت نیاز»

/** اعتبارسنجی شبای ایران — طول ۲۶، الگوریتم mod-97 */
export function validateSheba(input: string): { valid: boolean; length: number; bankCode?: string; bankName?: string; formatted?: string } {
  const clean = (input || '').replace(/[\s-]/g, '').toUpperCase();
  if (!clean.startsWith('IR')) return { valid: false, length: clean.length };
  if (clean.length !== 26) return { valid: false, length: clean.length };
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const num = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of num) {
    rem = (rem * 10 + Number(ch)) % 97;
  }
  const valid = rem === 1;
  const bankCode = clean.slice(4, 7);
  const BANKS: Record<string, string> = {
    '010': 'بانک مرکزی', '011': 'بانک صنعت و معدن', '012': 'بانک ملت', '013': 'بانک ملی',
    '014': 'بانک مسکن', '015': 'بانک سپه', '016': 'بانک کشاورزی', '017': 'بانک مهر ایران',
    '018': 'بانک توسعه صادرات', '019': 'بانک پست بانک', '020': 'بانک توسعه', '021': 'بانک پارسیان',
    '022': 'بانک سامان', '023': 'بانک پاسارگاد', '024': 'بانک اقتصاد نوین', '030': 'بانک آینده',
    '031': 'بانک شهر', '057': 'بانک قرض‌الحسنه مهر ایران',
  };
  const formatted = clean.replace(/^(IR.{2})(.{4})(.{4})(.{4})(.{4})(.{4})(.+)$/, '$1 $2 $3 $4 $5 $6 $7');
  return { valid, length: clean.length, bankCode, bankName: BANKS[bankCode], formatted };
}

/** اعتبارسنجی شماره کارت ۱۶ رقمی — الگوریتم Luhn + تشخیص بانک */
export function validateCard(input: string): { valid: boolean; digits: number; bankName?: string; masked: string } {
  const digits = (input || '').replace(/\D/g, '');
  const masked = digits.length >= 4 ? `****-****-****-${digits.slice(-4)}` : '****';
  if (digits.length !== 16) return { valid: false, digits: digits.length, masked };
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let d = Number(digits[15 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const BANKS: Record<string, string> = {
    '603799': 'بانک ملی ایران',
    '606373': 'بانک قرض‌الحسنه مهر ایران',
    '610433': 'بانک ملت',
    '589210': 'بانک سپه',
    '627353': 'بانک تجارت',
    '585983': 'بانک تجارت',
    '621986': 'بانک سامان',
    '603769': 'بانک صادرات',
    '585949': 'بانک خاورمیانه (مید)',
    '502806': 'بانک شهر',
    '606374': 'بانک مهر ایران',
  };
  const prefix = digits.slice(0, 6);
  return { valid: sum % 10 === 0, digits: 16, bankName: BANKS[prefix], masked };
}
