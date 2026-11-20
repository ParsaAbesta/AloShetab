// ─── بررسی سهم‌ها در آخرین سفارش ─────────────────────────────
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const o = await db.order.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { referral: true, items: true, customer: true },
  });
  if (!o) return console.log('NO ORDER');
  console.log('code:', o.code, '| total:', o.total, '| status:', o.status);
  console.log('referralCode:', o.referralCode, '| referral.amount:', o.referral?.amount, '| expected 1/7:', Math.round(o.total / 7));
  console.log('check 1/7 ok:', o.referral?.amount === Math.round(o.total / 7));
  console.log('4/7 of total =', Math.round(o.total * 4 / 7), '| 2/7 =', Math.round(o.total * 2 / 7));
  const totalServices = await db.service.count();
  console.log('services in DB:', totalServices);
  const refs = await db.referral.count();
  console.log('referrals:', refs);
}

main().finally(() => db.$disconnect());
