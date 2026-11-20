import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/** فهرست پیشنهادهای قیمت کالا (کارشناس/گزارش روزانه) — در انتظار تصمیم */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'PENDING';
  const proposals = await db.productPriceProposal.findMany({
    where: status === 'ALL' ? {} : { status },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { product: { select: { nameFa: true, nameEn: true, key: true, section: true } } },
  });
  return NextResponse.json({ proposals });
}
