import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ORDER_STATUS, WORKER_LEVEL } from '@/lib/constants';
import { queueReport, logActivity } from '@/lib/reports';
import { settleOrder } from '@/lib/settlement';
import { formatJalaliTime } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().trim().min(3).max(20),
  mobile: z.string().trim().regex(/^09\d{9}$/),
  skill: z.number().int().min(0).max(5),
  ethics: z.number().int().min(0).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
});

function levelFor(points: number): string {
  if (points >= 100) return WORKER_LEVEL.GOLD;
  if (points >= 40) return WORKER_LEVEL.SILVER;
  return WORKER_LEVEL.BRONZE;
}

/** ثبت رضایت و امتیاز (۵ مهارت + ۵ اخلاق) پس از پایان کار */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'امتیازها باید بین ۰ تا ۵ ستاره باشند' }, { status: 400 });
  }
  const code = `AS-${parsed.data.code.toUpperCase().replace(/^AS-/i, '').trim()}`;
  const order = await db.order.findUnique({
    where: { code },
    include: { customer: true, items: { include: { worker: true } }, rating: true },
  });
  if (!order || order.customer.mobile !== parsed.data.mobile) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'سفارش یافت نشد' }, { status: 404 });
  }
  if (order.status !== ORDER_STATUS.DONE) {
    return NextResponse.json({ error: 'NOT_DONE', message: 'ثبت رضایت فقط پس از اعلام «انجام‌شده» سفارش ممکن است' }, { status: 400 });
  }
  if (order.rating) {
    return NextResponse.json({ error: 'ALREADY_RATED', message: 'برای این سفارش قبلاً رضایت ثبت شده است' }, { status: 400 });
  }

  await db.rating.create({
    data: { orderId: order.id, skill: parsed.data.skill, ethics: parsed.data.ethics, comment: parsed.data.comment ?? null },
  });

  // امتیاز تجمعی همکاران + سطح‌بندی (برنزی/نقره‌ای/طلایی)
  const gained = parsed.data.skill + parsed.data.ethics;
  const workerIds = [...new Set(order.items.filter((i) => i.workerId).map((i) => i.workerId as string))];
  for (const wid of workerIds) {
    const w = await db.worker.findUnique({ where: { id: wid } });
    if (!w) continue;
    const points = w.points + gained;
    await db.worker.update({ where: { id: wid }, data: { points, level: levelFor(points) } });
  }

  await queueReport(
    'RATING',
    `رضایت مشتری برای سفارش ${order.code}`,
    [
      `سفارش: ${order.code} | مشتری: ${order.customer.fullName}`,
      `امتیاز مهارت: ${parsed.data.skill}/5 | امتیاز اخلاق: ${parsed.data.ethics}/5`,
      parsed.data.comment ? `نظر: ${parsed.data.comment}` : '',
      workerIds.length ? `همکار(ان): ${workerIds.join(', ')} (+${gained} امتیاز)` : '',
      `زمان: ${formatJalaliTime(new Date())}`,
    ].filter(Boolean).join('\n')
  );
  await logActivity('CUSTOMER', `ثبت رضایت ${order.code}`, `مهارت: ${parsed.data.skill} | اخلاق: ${parsed.data.ethics}`);

  // تسویهٔ خودکار بلافاصله پس از رضایت (جزئیات محرمانه — در پاسخ عمومی بازتاب داده نمی‌شود)
  const settlement = await settleOrder(order.id);

  return NextResponse.json({ ok: true, pointsToWorkers: gained * workerIds.length, settled: settlement.ok });
}
