import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { freshCutoffJalaliStr } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

/** جستجوی سراسری — زیر اسلایدر صفحهٔ اصلی (پیام ۱۱)
 *  نتایج: خدمات (v1 ایران + v2 جهانی) + میز کالا/نرم‌افزار + قطعات.
 *  در صورت نبود نتیجه، مشتری می‌تواند خدمت جدید را به هوش مصنوعی بسپارد. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [], empty: true });

  const s = await getSettings();
  const freshFromJalali = freshCutoffJalaliStr(s.PRICE_FRESH_FROM); // 1405/08/10 — مقایسهٔ رشته‌ای تاریخ شمسی

  const [services, products, parts] = await Promise.all([
    db.service.findMany({
      where: {
        active: true,
        OR: [
          { nameFa: { contains: q } },
          { nameEn: { contains: q } },
          { descFa: { contains: q } },
          { descEn: { contains: q } },
          { category: { contains: q } },
        ],
      },
      orderBy: { baseRate: 'asc' },
      take: 8,
      select: { key: true, nameFa: true, nameEn: true, descFa: true, descEn: true, baseRate: true, currency: true, edition: true, category: true, icon: true },
    }),
    db.product.findMany({
      where: {
        active: true,
        priceStatus: { not: 'FROZEN' },
        // پیام ۱۲: فقط کالاهای با قیمت تازه (بعد از مرز تنظیم‌شده)
        priceDate: { not: null, gte: freshFromJalali },
        OR: [
          { nameFa: { contains: q } },
          { nameEn: { contains: q } },
          { descFa: { contains: q } },
          { descEn: { contains: q } },
          { category: { contains: q } },
          { brand: { contains: q } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      take: 8,
      select: { key: true, nameFa: true, nameEn: true, descFa: true, descEn: true, price: true, icon: true, section: true, priceDate: true, baseSource: true },
    }),
    db.part.findMany({
      where: { active: true, OR: [{ nameFa: { contains: q } }, { nameEn: { contains: q } }] },
      take: 4,
      select: { key: true, nameFa: true, nameEn: true, basePrice: true, icon: true },
    }),
  ]);

  const results = [
    ...services.map((s) => ({
      type: 'SERVICE' as const,
      key: s.key,
      titleFa: s.nameFa,
      titleEn: s.nameEn,
      subFa: s.category,
      price: s.baseRate,
      currency: s.currency,
      edition: s.edition,
      icon: s.icon,
    })),
    ...products.map((p) => ({
      type: 'PRODUCT' as const,
      key: p.key,
      titleFa: p.nameFa,
      titleEn: p.nameEn,
      subFa: p.section === 'GOODS' ? `میز کالا${p.baseSource ? ` — مرجع: ${p.baseSource}` : ''}` : 'نرم‌افزار',
      price: p.price,
      currency: 'IRT',
      edition: null,
      icon: p.icon,
    })),
    ...parts.map((p) => ({
      type: 'PART' as const,
      key: p.key,
      titleFa: p.nameFa,
      titleEn: p.nameEn,
      subFa: 'قطعه',
      price: p.basePrice,
      currency: 'IRT',
      edition: null,
      icon: p.icon,
    })),
  ];

  return NextResponse.json({ results, empty: results.length === 0 });
}
