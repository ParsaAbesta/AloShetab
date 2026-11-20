import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdmin, getSession, unauthorized } from '@/lib/adminAuth';
import { isFrozen, getSettings } from '@/lib/settings';
import { checkFreezeEscalation } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** داشبورد پنل — شمارش‌ها + صف‌های در انتظار + وضعیت توقف + سفارش‌های اخیر */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();

  // اِسکِیلِیشن توقف حسابرسی (۳ ساعت) — فقط بررسی، بدون اجرای حسابرسی جدید
  await checkFreezeEscalation();

  const [
    total, paid, done, expert, payments, referrals, ratings, recentOrders,
    pendingProductOrders, pendingProposals, pendingDaily, pendingDetailReq,
    pendingPriceChg, pendingStagesDone, manualCoordinations, lastAudit,
  ] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: { in: ['PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE'] } } }),
    db.order.count({ where: { status: 'DONE' } }),
    db.order.count({ where: { status: 'EXPERT_REVIEW' } }),
    db.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    db.referral.findMany({ where: { paid: false }, select: { amount: true } }),
    db.rating.findMany({ select: { skill: true, ethics: true } }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { customer: { select: { fullName: true, mobile: true } }, items: { include: { service: { select: { key: true, nameFa: true, nameEn: true } } } } },
    }),
    db.productOrder.count({ where: { status: 'PENDING' } }),
    db.productPriceProposal.count({ where: { status: 'PENDING' } }),
    db.dailyPriceReport.count({ where: { status: 'PENDING' } }),
    db.detailRequest.count({ where: { status: 'PENDING' } }),
    db.priceChangeRequest.count({ where: { status: 'PENDING' } }),
    db.invoiceStage.count({ where: { stage: { not: 'DONE' } } }),
    db.coordinationLog.count({ where: { movedToAutomation: false } }),
    db.auditReport.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

  const avg = ratings.length ? (ratings.reduce((s, r) => s + r.skill + r.ethics, 0) / (ratings.length * 2)) : 0;
  const frozen = await isFrozen();
  const s = await getSettings();
  const session = await getSession();

  return NextResponse.json({
    stats: {
      totalOrders: total,
      paidOrders: paid,
      doneOrders: done,
      expertOrders: expert,
      walletHeld: payments._sum.amount ?? 0,
      // محرمانگی: فقط «تعداد» حق معرف‌های پرداخت‌نشده؛ مبلغ تجمعی هرگز به UI ارسال نمی‌شود
      unpaidReferralsCount: referrals.length,
      avgRating: Math.round(avg * 100) / 100,
      ratingsCount: ratings.length,
      // پیام ۱۱:
      pendingProductOrders,
      pendingProposals,
      pendingDailyReports: pendingDaily,
      pendingDetailRequests: pendingDetailReq,
      pendingPriceChangeRequests: pendingPriceChg,
      invoiceStagesOpen: pendingStagesDone,
      manualCoordinations,
      operationsFrozen: frozen.frozen,
      frozenAt: frozen.since,
      automationEnabled: s.AUTOMATION_ENABLED === 'true',
      lastAuditStatus: lastAudit?.status ?? null,
      lastAuditDate: lastAudit?.dateShamsi ?? null,
      lastAuditAnomalies: lastAudit?.anomalyCount ?? 0,
    },
    role: session?.role ?? 'ADMIN',
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      mode: o.mode,
      total: o.total,
      needsExpertise: o.needsExpertise,
      createdAt: o.createdAt,
      customer: o.customer,
      items: o.items.map((i) => ({ qty: i.qty, service: { key: i.service.key, nameFa: i.service.nameFa, nameEn: i.service.nameEn } })),
    })),
  });
}
