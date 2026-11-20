import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { INVOICE_STAGES } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/** فهرست سفارش‌ها با مراحل فاکتور + فاکتورهای پرداختی برای ضمیمه به پروندهٔ مشتری */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind') ?? 'PRODUCT'; // PRODUCT | SERVICE
  const q = (searchParams.get('q') ?? '').trim();

  if (kind === 'SERVICE') {
    const orders = await db.order.findMany({
      where: q ? { code: { contains: q } } : {},
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true, code: true, status: true, total: true, createdAt: true,
        customer: { select: { fullName: true, mobile: true, address: true, plaque: true, floor: true, unit: true, postalCode: true } },
        payments: { where: { status: 'SUCCESS' }, select: { amount: true, method: true, rrn: true, createdAt: true } },
      },
    });
    const ids = orders.map((o) => o.id);
    const stages = await db.invoiceStage.findMany({ where: { orderId: { in: ids } }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({
      orders: orders.map((o) => ({ ...o, kind: 'SERVICE', stages: stages.filter((s) => s.orderId === o.id) })),
    });
  }

  const pos = await db.productOrder.findMany({
    where: q ? { code: { contains: q } } : {},
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      product: { select: { nameFa: true, baseSource: true, sourceUrl: true, price: true } },
      services: true,
    },
  });
  const ids = pos.map((o) => o.id);
  const stages = await db.invoiceStage.findMany({ where: { productOrderId: { in: ids } }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({
    orders: pos.map((o) => ({
      id: o.id, code: o.code, kind: 'PRODUCT', status: o.status,
      total: o.total, goodsTotal: o.unitPrice * o.qty,
      servicesTotal: o.services.reduce((s, x) => s + x.price * x.qty, 0),
      createdAt: o.createdAt, leadTimeDays: o.leadTimeDays, paySheba: o.paySheba,
      fullName: o.fullName, mobile: o.mobile,
      address: o.address, plaque: o.plaque, floor: o.floor, unit: o.unit, postalCode: o.postalCode,
      product: o.product, services: o.services,
      stages: stages.filter((s) => s.productOrderId === o.id),
    })),
  });
}

const schema = z.object({
  kind: z.enum(['PRODUCT', 'SERVICE']),
  refId: z.string().trim().min(1), // productOrderId یا orderId
  stage: z.enum(INVOICE_STAGES as unknown as [string, ...string[]]),
  amount: z.number().int().min(0).max(999_999_999_9).optional().nullable(),
  accountRef: z.string().trim().max(80).optional().nullable(),
  toName: z.string().trim().max(80).optional().nullable(),
  operator: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(400).optional().nullable(),
});

/** ثبت مرحلهٔ فاکتور توسط ادمین (الزامی طبق پیام ۱۱) */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر' }, { status: 400 });
  }
  const d = parsed.data;
  const stage = await db.invoiceStage.create({
    data: {
      ...(d.kind === 'PRODUCT' ? { productOrderId: d.refId } : { orderId: d.refId }),
      stage: d.stage,
      amount: d.amount ?? null,
      accountRef: d.accountRef ?? null,
      toName: d.toName ?? null,
      operator: d.operator ?? null,
      note: d.note ?? null,
    },
  });

  // اگر سفارش کالا DONE شد، فاکتور پرداختی برای ضمیمه به پروندهٔ مشتری به پنل ارسال می‌شود
  let code = d.refId;
  if (d.kind === 'PRODUCT') {
    const po = await db.productOrder.findUnique({ where: { id: d.refId }, include: { product: true, services: true } });
    if (po) code = po.code;
  } else {
    const o = await db.order.findUnique({ where: { id: d.refId } });
    if (o) code = o.code;
  }
  await logActivity('ADMIN', `ثبت مرحلهٔ فاکتور ${code}`, d.stage);
  await queueReport(
    'PAYMENT',
    `مرحلهٔ فاکتور ثبت شد — ${code}`,
    [
      `سفارش: ${code}`,
      `مرحله: ${d.stage}`,
      d.amount ? `مبلغ: ${d.amount.toLocaleString('fa-IR')} تومان` : '',
      d.accountRef ? `حساب/کارت: ${d.accountRef}` : '',
      d.toName ? `واریز به نام: ${d.toName}` : '',
      d.operator ? `اپراتور: ${d.operator}` : '',
      d.note ? `یادداشت: ${d.note}` : '',
      `زمان ثبت: ${formatJalaliTime(new Date())}`,
      'این فاکتور برای ضمیمه شدن به پروندهٔ مشتری در پنل ادمین نگهداری می‌شود.',
    ].filter(Boolean).join('\n')
  );
  return NextResponse.json({ ok: true, stage });
}
