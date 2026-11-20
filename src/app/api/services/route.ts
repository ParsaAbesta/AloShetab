import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** فهرست خدمات نسخه‌ای — IRAN (v1) یا WORLD (v2.0) — همراه ریز جزئیات */
export async function GET(req: Request) {
  const edition = new URL(req.url).searchParams.get('edition') === 'WORLD' ? 'WORLD' : 'IRAN';
  const services = await db.service.findMany({
    where: { active: true, edition },
    orderBy: { sortOrder: 'asc' },
    include: { details: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
  });
  return NextResponse.json({
    edition,
    services: services.map((s) => ({
      key: s.key,
      nameFa: s.nameFa,
      nameEn: s.nameEn,
      descFa: s.descFa,
      descEn: s.descEn,
      icon: s.icon,
      baseRate: s.baseRate,
      remoteCapable: s.remoteCapable,
      isMisc: s.isMisc,
      category: s.category,
      percentValue: s.percentValue,
      edition: s.edition,
      currency: s.currency,
      aiGenerated: s.aiGenerated,
      pendingReview: s.pendingReview,
      details: s.details.map((d) => ({ id: d.id, nameFa: d.nameFa, nameEn: d.nameEn, price: d.price })),
    })),
  });
}
