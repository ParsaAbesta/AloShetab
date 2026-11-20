import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, getSession, unauthorized } from '@/lib/adminAuth';
import { getSettings } from '@/lib/settings';
import { logActivity } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/** فهرست هماهنگی‌ها — دستی (فعلاً توسط ادمین) و منتقل‌شده به اتوماسیون */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') ?? 'MANUAL'; // MANUAL | AUTOMATION | ALL
  const where =
    view === 'MANUAL' ? { movedToAutomation: false } :
    view === 'AUTOMATION' ? { movedToAutomation: true } : {};
  const logs = await db.coordinationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const s = await getSettings();
  return NextResponse.json({ logs, automationEnabled: s.AUTOMATION_ENABLED === 'true' });
}

const createSchema = z.object({
  kind: z.enum(['CALL', 'SCHEDULE', 'PAYMENT', 'OTHER']).default('CALL'),
  orderId: z.string().trim().max(60).optional().nullable(),
  productOrderId: z.string().trim().max(60).optional().nullable(),
  summary: z.string().trim().min(5).max(600),
});

/** ثبت هماهنگی دستی — ادمین موظف است هر هماهنگی را ثبت کند */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const session = await getSession();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'دادهٔ نامعتبر' }, { status: 400 });
  }
  // سازگاری: کد سفارش AS- / ASP- به شناسه تبدیل می‌شود
  let orderId = parsed.data.orderId || null;
  let productOrderId = parsed.data.productOrderId || null;
  if (orderId?.startsWith('AS-')) {
    const o = await db.order.findUnique({ where: { code: orderId } });
    orderId = o?.id ?? orderId;
  }
  if (productOrderId?.startsWith('ASP-')) {
    const po = await db.productOrder.findUnique({ where: { code: productOrderId } });
    productOrderId = po?.id ?? productOrderId;
  }
  const log = await db.coordinationLog.create({
    data: {
      kind: parsed.data.kind,
      orderId, productOrderId,
      summary: parsed.data.summary,
      handledBy: `${session?.role === 'OWNER' ? 'OWNER' : 'ADMIN'}:${session?.username}`,
      manual: true,
    },
  });
  await logActivity('ADMIN', 'ثبت هماهنگی دستی', parsed.data.summary.slice(0, 60));
  return NextResponse.json({ ok: true, log });
}

const patchSchema = z.object({
  id: z.string().trim().min(1),
  eligible: z.boolean().optional(),
  ownerApproved: z.boolean().optional(),
  adminApproved: z.boolean().optional(),
  move: z.boolean().optional(), // درخواست انتقال به اتوماسیون
});

/** تأیید هماهنگی — پس از تأیید مالک (یا ادمین با دسترسی بازشدهٔ مالک)، به اتوماسیون منتقل می‌شود */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const session = await getSession();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const { id, move, ...flags } = parsed.data;
  const log = await db.coordinationLog.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const s = await getSettings();
  const isOwner = session?.role === 'OWNER';
  const data: Record<string, unknown> = {};
  if (flags.eligible !== undefined) data.eligible = flags.eligible;
  if (flags.ownerApproved !== undefined) {
    if (!isOwner) return NextResponse.json({ error: 'FORBIDDEN', message: 'تأیید مالک فقط با دسترسی مالک مجاز است' }, { status: 403 });
    data.ownerApproved = flags.ownerApproved;
  }
  if (flags.adminApproved !== undefined) data.adminApproved = flags.adminApproved;

  let moved = log.movedToAutomation;
  if (move && !log.movedToAutomation) {
    // انتقال به اتوماسیون: تأیید مالک الزامی؛ یا (ادمین + باز بودن دسترسی توسط مالک + تأیید ادمین)
    const approved = data.ownerApproved === true || log.ownerApproved === true;
    const adminPath = s.AUTOMATION_ENABLED === 'true' && (data.adminApproved === true || log.adminApproved === true);
    if (!approved && !adminPath) {
      return NextResponse.json(
        { error: 'APPROVAL_REQUIRED', message: 'انتقال به اتوماسیون نیازمند تأیید مالک است (یا فعال‌سازی و تأیید ادمین پس از باز کردن دسترسی توسط مالک)' },
        { status: 403 }
      );
    }
    data.movedToAutomation = true;
    data.movedAt = new Date();
    moved = true;
  }

  await db.coordinationLog.update({ where: { id }, data });
  await logActivity('ADMIN', moved ? 'انتقال هماهنگی به اتوماسیون' : 'بروزرسانی هماهنگی');
  return NextResponse.json({ ok: true, movedToAutomation: moved });
}
