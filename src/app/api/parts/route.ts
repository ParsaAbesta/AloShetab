import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dayRateFactor } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/** کاتالوگ قطعات برای «سفارش خرید قطعات» — قیمت با ضریب نرخ روز (طبق تقویم) */
export async function GET() {
  const [parts, dr] = await Promise.all([
    db.part.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    dayRateFactor(new Date()),
  ]);
  return NextResponse.json({
    dayRate: { factor: dr.factor, labelFa: dr.labelFa, labelEn: dr.labelEn },
    parts: parts.map((p) => ({
      key: p.key,
      nameFa: p.nameFa,
      nameEn: p.nameEn,
      category: p.category,
      icon: p.icon,
      basePrice: p.basePrice,
      unitPrice: Math.round(p.basePrice * dr.factor), // قیمت روز
    })),
  });
}
