// ─── پیام ۱۱: دستیار هوشمند فوق‌هوشمند پنل مدیریتی ──────────
// سؤال ادمین/مالک → جمع‌آوری آمار زنده از دیتابیس → پاسخ فارسی دقیق
// در صورت در دسترس بودن مدل زبانی از آن استفاده می‌شود؛ در غیر این‌صورت
// موتور قاعده‌محور داخلی پاسخ می‌دهد (بدون وابستگی خارجی).
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { formatJalali } from '@/lib/jalali';

export interface AssistantAnswer {
  answer: string;
  engine: 'LLM' | 'RULES';
  stats?: Record<string, unknown>;
}

async function gatherStats(): Promise<Record<string, number | string | boolean>> {
  const s = await getSettings();
  const [
    orders, doneOrders, productOrders, pendingProductOrders,
    products, goodsActive, softwareActive, warehouses, verifiedWarehouses,
    pendingProposals, pendingDaily, pendingDetailReq, pendingPriceChg,
    pendingWorkers, unpaidReferrals, openStages, manualCoordinations,
    automationCoordinations, lastAudit, contacts, services, pendingServices,
  ] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: 'DONE' } }),
    db.productOrder.count(),
    db.productOrder.count({ where: { status: 'PENDING' } }),
    db.product.count({ where: { active: true } }),
    db.product.count({ where: { active: true, section: 'GOODS' } }),
    db.product.count({ where: { active: true, section: 'SOFTWARE' } }),
    db.warehouse.count({ where: { active: true } }),
    db.warehouse.count({ where: { active: true, verified: true } }),
    db.productPriceProposal.count({ where: { status: 'PENDING' } }),
    db.dailyPriceReport.count({ where: { status: 'PENDING' } }),
    db.detailRequest.count({ where: { status: 'PENDING' } }),
    db.priceChangeRequest.count({ where: { status: 'PENDING' } }),
    db.worker.count({ where: { status: 'PENDING' } }),
    db.referral.count({ where: { paid: false } }),
    db.invoiceStage.count({ where: { stage: { not: 'DONE' } } }),
    db.coordinationLog.count({ where: { movedToAutomation: false } }),
    db.coordinationLog.count({ where: { movedToAutomation: true } }),
    db.auditReport.findFirst({ orderBy: { createdAt: 'desc' } }),
    db.contactMessage.count({ where: { handled: false } }),
    db.service.count({ where: { active: true, edition: 'IRAN' } }),
    db.service.count({ where: { active: true, pendingReview: true } }),
  ]);
  const last = lastAudit as { status: string; dateShamsi: string; anomalyCount: number } | null;
  return {
    orders, doneOrders, productOrders, pendingProductOrders,
    inventoryActive: products, goodsActive, softwareActive,
    warehouses, verifiedWarehouses,
    pendingProposals, pendingDailyReports: pendingDaily, pendingDetailRequests: pendingDetailReq,
    pendingPriceChangeRequests: pendingPriceChg, pendingWorkers, unpaidReferrals,
    invoiceStagesOpen: openStages, manualCoordinations, automationCoordinations,
    lastAuditStatus: last ? (last.status === 'OK' ? 'سالم' : last.status === 'RESOLVED' ? 'برطرف‌شده' : 'خطا/توقف') : 'هنوز حسابرسی اجرا نشده',
    lastAuditDate: last?.dateShamsi ?? '—',
    lastAuditAnomalies: last?.anomalyCount ?? 0,
    operationsFrozen: s.OPERATIONS_FROZEN === 'true',
    automationEnabled: s.AUTOMATION_ENABLED === 'true',
    unhandledContacts: contacts,
    iranServices: services, pendingAiServices: pendingServices,
    today: formatJalali(new Date()),
  };
}

/** موتور قاعده‌محور — پاسخ‌های عملیاتی بر اساس آمار زنده */
function rulesAnswer(q: string, st: Record<string, unknown>): string {
  const n = (k: string) => Number(st[k] ?? 0);
  const b = (k: string) => Boolean(st[k]);
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));
  const out: string[] = [];
  const today = String(st.today);

  if (has('موجودی', 'کالا', 'انبار', 'قیمت', 'میز کالا', 'محصول')) {
    out.push(`📦 میز کالا: ${n('goodsActive')} کالای فعال | بخش نرم‌افزار: ${n('softwareActive')} مورد — مجموع ${n('inventoryActive')} قلم`);
    out.push(`🏬 انبارها و مراجع قیمت: ${n('warehouses')} فعال (${n('verifiedWarehouses')} تأییدشده از نظر تماس/آدرس/سایت)`);
    out.push(`💰 ${n('pendingProposals')} پیشنهاد قیمت در انتظار تأیید و ${n('pendingDailyReports')} گزارش روزانهٔ قیمت مانده است (قیمت‌ها طبق تقویم ${today}).`);
  }
  if (has('سفارش', 'خرید', 'فاکتور', 'پیک')) {
    out.push(`🧾 سفارش کالا: ${n('productOrders')} کل (${n('pendingProductOrders')} در انتظار بررسی) | سفارش خدمات: ${n('orders')} کل`);
    out.push(`📋 مراحل فاکتور باز: ${n('invoiceStagesOpen')} — یادآوری: ادمین موظف است مسیر فاکتور (پرداخت، هماهنگی، قیمت انبار، پیک، واریز و...) را مرحله‌به‌مرحله ثبت کند.`);
  }
  if (has('حسابرسی', 'حسابدار', 'توقف', 'خطا', 'ضرر', 'زیان')) {
    out.push(`🧮 حسابدار هوشمند — آخرین حسابرسی: ${String(st.lastAuditDate)} | وضعیت: ${String(st.lastAuditStatus)} | خطاها: ${n('lastAuditAnomalies')}`);
    out.push(b('operationsFrozen')
      ? '🛑 عملیات فعلاً متوقف است. مالک/مدیر (یا ادمین پس از ۳ ساعت) باید فرمان ادامه بدهد.'
      : '✅ عملیات فعال است.');
  }
  if (has('هماهنگی', 'اتوماسیون', 'دستی', 'خودکار')) {
    out.push(`🤝 هماهنگی‌های دستی باز: ${n('manualCoordinations')} | منتقل‌شده به اتوماسیون: ${n('automationCoordinations')}`);
    out.push(b('automationEnabled')
      ? '⚙️ اتوماسیون از سوی مالک فعال شده است.'
      : '⚙️ اتوماسیون هنوز غیرفعال است؛ تا فعال‌سازی از سوی مالک، امور دستی توسط ادمین انجام می‌شود. پس از تأیید مالک (یا ادمین با دسترسی باز)، هر هماهنگی دستی به اتوماسیون منتقل می‌شود.');
  }
  if (has('تأیید', 'تایید', 'درخواست', 'صف', 'مانده', 'منتظر')) {
    out.push('📥 صف‌های در انتظار:');
    if (n('pendingDetailRequests')) out.push(`• ریز جزئیات پیشنهادی مشتریان: ${n('pendingDetailRequests')}`);
    if (n('pendingPriceChangeRequests')) out.push(`• اصلاح قیمت کارشناس: ${n('pendingPriceChangeRequests')}`);
    if (n('pendingProposals')) out.push(`• پیشنهاد قیمت کالا: ${n('pendingProposals')}`);
    if (n('pendingDailyReports')) out.push(`• گزارش روزانهٔ قیمت: ${n('pendingDailyReports')}`);
    if (n('pendingWorkers')) out.push(`• درخواست همکاری: ${n('pendingWorkers')}`);
    if (n('pendingAiServices')) out.push(`• خدمات ساخته‌شدهٔ هوش مصنوعی: ${n('pendingAiServices')}`);
    if (n('unhandledContacts')) out.push(`• پیام «ارتباط با ما»: ${n('unhandledContacts')}`);
    if (!out.some((l) => l.startsWith('•'))) out.push('• همهٔ صف‌ها خالی است ✅');
  }
  if (has('شبا', 'کارت', 'پل', 'واریز', 'حساب')) {
    out.push('🏦 حساب دریافت (همهٔ فاکتورها ≥ ۵ میلیون تومان) شبای بانک مهر ایران است و در تنظیمات پنل ثبت/بررسی می‌شود. کارت‌های تقسیم‌بندی و سهم شرکت داخلی و محرمانه‌اند و در همین پنل قابل ویرایش‌اند.');
  }
  if (out.length === 0) {
    out.push(`📊 خلاصهٔ وضعیت (${today}):`);
    out.push(`• خدمات فعال نسخهٔ ایران: ${n('iranServices')} | سفارش خدمات: ${n('orders')} (${n('doneOrders')} انجام‌شده)`);
    out.push(`• میز کالا: ${n('goodsActive')} کالا | نرم‌افزار: ${n('softwareActive')} | انبارها: ${n('warehouses')}`);
    out.push(`• سفارش کالا: ${n('productOrders')} | صف‌های در انتظار: ${n('pendingProposals') + n('pendingDailyReports') + n('pendingDetailRequests') + n('pendingPriceChangeRequests')}`);
    out.push('برای راهنمایی می‌توانید بپرسید: «موجودی کالا»، «گزارش روزانه قیمت»، «حسابدار هوشمند»، «هماهنگی‌ها»، «صف تأییدها»، «سفارش‌ها».');
  }
  return out.join('\n');
}

/** پاسخ دستیار هوشمند */
export async function adminAssistant(question: string): Promise<AssistantAnswer> {
  const stats = await gatherStats();
  const q = (question || '').trim();
  let answer = rulesAnswer(q, stats);
  let engine: 'LLM' | 'RULES' = 'RULES';

  // در صورت در دسترس بودن مدل زبانی، پاسخ نهایی با دادهٔ زندهٔ پنل بازنویسی می‌شود
  try {
    const mod = await import('z-ai-web-dev-sdk');
    const candidate = (mod as { default?: unknown }).default as {
      create?: () => Promise<{
        chat: {
          completions: {
            create: (args: unknown) => Promise<{ choices?: { message?: { content?: string } }[] }>;
          };
        };
      }>;
    };
    if (candidate?.create) {
      const zai = await candidate.create();
      const sys = [
        'تو دستیار فوق‌هوشمند پنل مدیریتی سامانه ألو شتاب هستی.',
        'فقط فارسی روان و کوتاه پاسخ بده؛ از آمار زندهٔ زیر استفاده کن؛ عدد جدید از خودت نساز.',
        'دربارهٔ سهم‌بندی مالی داخلی (سهم مجری/معرف/شرکت) هرگز جزئیات نده — محرمانه است.',
        'آمار زندهٔ پنل:',
        JSON.stringify(stats),
      ].join('\n');
      const res = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: q || 'وضعیت امروز پنل را خلاصه کن' },
        ],
        temperature: 0.3,
        max_tokens: 700,
      });
      const txt = res?.choices?.[0]?.message?.content?.trim();
      if (txt) {
        answer = txt;
        engine = 'LLM';
      }
    }
  } catch {
    // SDK در دسترس نیست — پاسخ قاعده‌محور می‌ماند
  }

  return { answer, engine, stats };
}
