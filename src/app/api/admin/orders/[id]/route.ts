import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { ORDER_STATUS } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { settleOrder } from '@/lib/settlement';
import { SERVICE_MARKUP_PCT } from '@/lib/pricing';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const STATUS_LABEL_FA: Record<string, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'در انتظار پرداخت',
  [ORDER_STATUS.EXPERT_REVIEW]: 'نیاز به بررسی و کارشناسی',
  [ORDER_STATUS.PAID]: 'پرداخت‌شده — آمادهٔ زمان‌بندی',
  [ORDER_STATUS.SCHEDULED]: 'زمان‌بندی‌شده',
  [ORDER_STATUS.IN_PROGRESS]: 'در حال انجام',
  [ORDER_STATUS.DONE]: 'انجام‌شده — در انتظار رضایت مشتری',
  [ORDER_STATUS.CANCELLED]: 'لغو شده',
};
const STATUS_LABEL_EN: Record<string, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'Awaiting payment',
  [ORDER_STATUS.EXPERT_REVIEW]: 'Needs expert review',
  [ORDER_STATUS.PAID]: 'Paid — ready to schedule',
  [ORDER_STATUS.SCHEDULED]: 'Scheduled',
  [ORDER_STATUS.IN_PROGRESS]: 'In progress',
  [ORDER_STATUS.DONE]: 'Done — awaiting customer satisfaction',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

const patchSchema = z.object({
  action: z.enum(['set-status', 'assign-worker', 'set-expert-price']),
  status: z.string().optional(),
  workerId: z.string().nullable().optional(),
  expertPrice: z.number().int().min(0).max(5_000_000_000).optional(),
});

/** مدیریت سفارش: انتقال وضعیت، تعیین همکار مجری، قیمت‌گذاری کارشناسی «متفرقه» */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'درخواست نامعتبر است' }, { status: 400 });
  }

  const order = await db.order.findUnique({
    where: { id },
    include: { customer: true, items: { include: { service: true, worker: true } }, referral: true },
  });
  if (!order) return NextResponse.json({ error: 'NOT_FOUND', message: 'سفارش یافت نشد' }, { status: 404 });

  const { action } = parsed.data;

  // ── انتقال وضعیت ──
  if (action === 'set-status') {
    const next = parsed.data.status ?? '';
    if (!Object.values(ORDER_STATUS).includes(next as never)) {
      return NextResponse.json({ error: 'INVALID_STATUS', message: 'وضعیت نامعتبر است' }, { status: 400 });
    }
    // گارد: سفارشِ پرداخت‌نشده نمی‌تواند جلوتر از PAID برود (پرداخت فقط با درگاه/تأیید ادمین)
    const flow = [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.EXPERT_REVIEW, ORDER_STATUS.PAID, ORDER_STATUS.SCHEDULED, ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.DONE];
    if (next !== ORDER_STATUS.CANCELLED && !order.needsExpertise) {
      if (flow.indexOf(next as (typeof flow)[number]) > flow.indexOf(ORDER_STATUS.PAID) && order.paidAt === null) {
        return NextResponse.json({ error: 'NOT_PAID', message: 'ابتدا پرداخت سفارش باید تأیید شود' }, { status: 400 });
      }
    }
    const data: { status: string; scheduledAt?: Date; doneAt?: Date; paidAt?: Date } = { status: next };
    if (next === ORDER_STATUS.SCHEDULED && !order.scheduledAt) data.scheduledAt = new Date();
    if (next === ORDER_STATUS.DONE && !order.doneAt) data.doneAt = new Date();
    // انتقال دستی ادمین به PAID = تأیید پرداخت توسط ادمین (PRD §۱۳)
    if (next === ORDER_STATUS.PAID && !order.paidAt) data.paidAt = new Date();
    await db.order.update({ where: { id: order.id }, data });
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        status: next,
        noteFa: `بروزرسانی توسط ادمین — ${STATUS_LABEL_FA[next] ?? next}`,
        noteEn: `Admin update — ${STATUS_LABEL_EN[next] ?? next}`,
      },
    });
    await queueReport('STATUS', `تغییر وضعیت سفارش ${order.code} به «${STATUS_LABEL_FA[next] ?? next}»`, [
      `کد سفارش: ${order.code} | مشتری: ${order.customer.fullName} (${order.customer.mobile})`,
      `وضعیت جدید: ${STATUS_LABEL_FA[next] ?? next}`,
      `زمان: ${formatJalaliTime(new Date())}`,
    ].join('\n'));
    await logActivity('ADMIN', `تغییر وضعیت ${order.code}`, next);
    return NextResponse.json({ ok: true, status: next });
  }

  // ── تعیین همکار مجری ──
  if (action === 'assign-worker') {
    const workerId = parsed.data.workerId ?? null;
    if (workerId) {
      const w = await db.worker.findUnique({ where: { id: workerId } });
      if (!w || w.status !== 'APPROVED') {
        return NextResponse.json({ error: 'WORKER_NOT_APPROVED', message: 'همکار انتخابی تأییدشده نیست' }, { status: 400 });
      }
    }
    // تعیین/تغییر همکار روی همهٔ اقلام سفارش اعمال می‌شود (یک مجری برای سفارش)
    await db.orderItem.updateMany({ where: { orderId: order.id }, data: { workerId } });
    await logActivity('ADMIN', `تعیین مجری برای ${order.code}`, workerId ?? 'بدون مجری');
    return NextResponse.json({ ok: true, workerId });
  }

  // ── قیمت‌گذاری کارشناسی «متفرقه» ──
  if (action === 'set-expert-price') {
    if (!order.needsExpertise) {
      return NextResponse.json({ error: 'NOT_EXPERT', message: 'این سفارش نیازمند کارشناسی نیست' }, { status: 400 });
    }
    const price = parsed.data.expertPrice;
    if (price === undefined) {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'قیمت قطعی الزامی است' }, { status: 400 });
    }
    // قلم نیازمند کارشناسی: متفرقهٔ بدون برآورد یا خدمات کارمزد درصدی
    const isExpertItem = (i: { service: { isMisc: boolean; percentValue: number | null } }) =>
      i.service.isMisc || i.service.percentValue != null;
    const expertItem = order.items.find(isExpertItem);
    if (!expertItem) {
      return NextResponse.json({ error: 'NO_EXPERT_ITEM', message: 'قلم نیازمند کارشناسی در سفارش یافت نشد' }, { status: 400 });
    }
    // قیمت قطعی روی قلم کارشناسی اعمال، کل سفارش بازمحاسبه و سهم اقلام تخصیص مجدد می‌شود
    // (شامل پلن ۳۳٪ میز خدمات — همان فرمول ثبت سفارش)
    const factors = order.weekFactor * order.hourFactor * order.dayFactor * order.modeFactor;
    const newLines = order.items.map((i) => (isExpertItem(i) ? price * i.qty : i.lineTotal));
    const newSubtotal = newLines.reduce((s, v) => s + v, 0);
    const newGross = Math.round(newSubtotal * factors);
    const newMarkup = Math.round(newGross * SERVICE_MARKUP_PCT); // پلن ۳۳٪ میز خدمات
    const discountPercent = (order.grossTotal + order.serviceMarkup) > 0 ? (order.discount / (order.grossTotal + order.serviceMarkup)) * 100 : 0;
    const newDiscount = Math.round(((newGross + newMarkup) * discountPercent) / 100);
    const newTotal = newGross + newMarkup - newDiscount;

    // تخصیص مبلغ پرداختی بین اقلام متناسب با سهم هر قلم
    const sumLines = newSubtotal || 1;
    let allocated = 0;
    const itemAmounts = newLines.map((lt, idx) => {
      if (idx === newLines.length - 1) return newTotal - allocated;
      const v = Math.round((newTotal * lt) / sumLines);
      allocated += v;
      return v;
    });

    await db.$transaction(async (tx) => {
      for (let idx = 0; idx < order.items.length; idx++) {
        await tx.orderItem.update({
          where: { id: order.items[idx].id },
          data: { baseRate: isExpertItem(order.items[idx]) ? price : order.items[idx].baseRate, lineTotal: newLines[idx], itemAmount: itemAmounts[idx] },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: newSubtotal, grossTotal: newGross, serviceMarkup: newMarkup, discount: newDiscount, total: newTotal,
          // قیمت قطعی تعیین شد → سفارش به صف پرداخت برمی‌گردد
          ...(order.status === ORDER_STATUS.EXPERT_REVIEW ? { status: ORDER_STATUS.PENDING_PAYMENT } : {}),
        },
      });
      if (order.status === ORDER_STATUS.EXPERT_REVIEW) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            status: ORDER_STATUS.PENDING_PAYMENT,
            noteFa: `قیمت قطعی کارشناسی تعیین شد (${price.toLocaleString('fa-IR')} تومان) — در انتظار پرداخت`,
            noteEn: `Final expert price set (${price} Toman) — awaiting payment`,
          },
        });
      }
    });

    await queueReport('ORDER', `قیمت قطعی کارشناسی سفارش ${order.code} تعیین شد`, [
      `کد سفارش: ${order.code} | مشتری: ${order.customer.fullName} (${order.customer.mobile})`,
      `نرخ کارشناسی «${expertItem.service.nameFa}»: ${price.toLocaleString('fa-IR')} تومان`,
      `مبلغ قابل پرداخت جدید: ${newTotal.toLocaleString('fa-IR')} تومان`,
      order.miscNotes ? `توضیحات متفرقه: ${order.miscNotes}` : '',
      `زمان: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n'));
    await logActivity('ADMIN', `قیمت‌گذاری کارشناسی ${order.code}`, `${price} تومان`);
    return NextResponse.json({ ok: true, total: newTotal });
  }

  return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
}

/** جزئیات کامل سفارش برای ادمین */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { service: true, worker: true } },
      events: { orderBy: { createdAt: 'asc' } },
      rating: true,
      referral: true,
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ order });
}

/** تسویهٔ دستی توسط ادمین — POST { action: 'settle' } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}) as { action?: string });
  if (body.action !== 'settle') {
    return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
  }
  const result = await settleOrder(id);
  if (!result.ok) {
    const fa: Record<string, string> = {
      ORDER_NOT_FOUND: 'سفارش یافت نشد',
      NOT_DONE: 'سفارش هنوز انجام نشده است',
      NO_RATING: 'ابتدا رضایت مشتری باید ثبت شود',
      ALREADY_SETTLED: 'این سفارش قبلاً تسویه شده است',
    };
    return NextResponse.json({ error: result.reason, message: fa[result.reason] ?? result.reason }, { status: 400 });
  }
  // محرمانگی: فقط نتیجهٔ موفقیت برگردانده می‌شود؛
  // مبالغ سهم‌ها (۴/۷ مجری، ۱/۷ معرف، ۲/۷ ألو شتاب) هرگز به رابط کاربری ارسال نمی‌شود
  return NextResponse.json({ ok: true });
}
