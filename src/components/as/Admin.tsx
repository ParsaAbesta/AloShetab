'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Lock, LayoutDashboard, Wallet, Star, Hourglass, CheckCircle2, ClipboardList, ShieldAlert,
  Search, RefreshCw, UsersRound, Share2, Mail, Settings, ReceiptText, CalendarDays, HandHeart,
  BadgeCheck, XCircle, Printer, CircleDollarSign, Tag, Banknote, CheckCheck, Package, Inbox,
  ListChecks, BadgeDollarSign, Cpu, Bot, Warehouse as WarehouseIcon, ShieldBan, BotMessageSquare, Store as StoreIcon,
} from 'lucide-react';
import { InventoryTab, WarehousesTab, StoresTab, DailyPricesTab, ProposalsTab, InvoiceStagesTab, CoordinationTab, AuditTab, AssistantTab } from './AdminExtra';
import { useAs } from './store';
import { t, type DictKey } from './i18n';
import { money, moneyLabel, factor, faDigits, svcName, svcDesc } from './util';
import { formatJalaliTime, formatJalali } from '@/lib/jalali';
import { ORDER_STATUS } from '@/lib/constants';

// ─── تایپ‌ها ──────────────────────────────────────────────
interface Stats {
  totalOrders: number; paidOrders: number; doneOrders: number; expertOrders: number;
  walletHeld: number; unpaidReferralsCount: number;
  avgRating: number; ratingsCount: number;
  pendingProductOrders: number; pendingProposals: number; pendingDailyReports: number;
  pendingDetailRequests: number; pendingPriceChangeRequests: number; invoiceStagesOpen: number;
  manualCoordinations: number; operationsFrozen: boolean; frozenAt: string;
  automationEnabled: boolean; lastAuditStatus: string | null; lastAuditDate: string | null; lastAuditAnomalies: number;
}
interface AdminOrder {
  id: string; code: string; status: string; mode: string; needsExpertise: boolean;
  miscNotes: string | null; aiPrice: number | null;
  subtotal: number; grossTotal: number; serviceMarkup: number; discount: number; total: number;
  weekFactor: number; hourFactor: number; dayFactor: number; modeFactor: number;
  referralCode: string | null; settledAt: string | null; paidAt: string | null; createdAt: string;
  customer: { fullName: string; mobile: string; nationalId: string; address: string };
  items: {
    id: string; qty: number; baseRate: number; lineTotal: number;
    itemAmount: number | null; settled: boolean;
    service: { key: string; nameFa: string; nameEn: string };
    worker: { id: string; fullName: string; field: string } | null;
  }[];
  rating: { skill: number; ethics: number } | null;
  referral: { paid: boolean; referrerNat: string } | null;
  payments: { id: string; method: string; status: string; amount: number; rrn: string | null; cardMask: string | null; createdAt: string }[];
}
interface WorkerRow {
  id: string; fullName: string; nationalId: string; mobile: string; city: string; field: string;
  resume: string | null; status: string; level: string; points: number; createdAt: string;
  jobsCount: number; settledJobsCount: number;
}
interface ReferralRow {
  id: string; referrerNat: string; referrer: { fullName: string; mobile: string } | null;
  paid: boolean; paidAt: string | null; createdAt: string;
  order: { code: string; total: number; status: string; settledAt: string | null; customer: { fullName: string; mobile: string } };
}
interface GoodsReferralRow { // پیام ۱۹ (V4.1) — پورسانت معرف کالا (مبلغ محرمانه)
  id: string; code: string; referrerNat: string; referrer: { fullName: string; mobile: string } | null;
  buyer: string; buyerMobile: string; status: string;
  paid: boolean; paidAt: string | null; createdAt: string;
}
interface PendingPayment {
  id: string; method: string; status: string; amount: number; cardMask: string | null; rrn: string | null; createdAt: string;
  order: { id: string; code: string; total: number; customer: { fullName: string; mobile: string } };
}
interface ReportRow { id: string; type: string; title: string; body: string; emails: string; sent: boolean; sentAt: string | null; createdAt: string }
interface ContactRow { id: string; name: string; phone: string; subject: string | null; message: string; handled: boolean; createdAt: string }
interface ActivityRow { id: string; actor: string; action: string; detail: string | null; createdAt: string }
interface ServiceRow {
  id: string; key: string; nameFa: string; nameEn: string; descFa: string; descEn: string;
  baseRate: number; remoteCapable: boolean; isMisc: boolean; active: boolean; sortOrder: number;
  category?: string; percentValue?: number | null;
}
interface DayRateRow { id: string; date: string; labelFa: string; labelEn: string; multiplier: number }

const STATUS_LIST = Object.values(ORDER_STATUS);
const LEVEL_COLORS: Record<string, string> = {
  GOLD: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  SILVER: 'bg-slate-400/20 text-slate-600 dark:text-slate-300',
  BRONZE: 'bg-orange-700/15 text-orange-700 dark:text-orange-400',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { message?: string }).message ?? 'خطا');
  return d as T;
}

// ═════════════════════════════════════════════════════════
export default function Admin() {
  const { lang } = useAs();
  const isFa = lang === 'fa';
  const [logged, setLogged] = useState(false);
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'ADMIN'>('ADMIN');
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!password) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? t('adminBad', lang));
      setRole(d.role === 'OWNER' ? 'OWNER' : 'ADMIN');
      setLogged(true);
      toast.success(isFa ? (d.role === 'OWNER' ? 'خوش آمدید — دسترسی مالک' : 'خوش آمدید — دسترسی ادمین') : 'Welcome');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('adminBad', lang));
    } finally {
      setBusy(false);
    }
  }

  if (!logged) {
    return (
      <div className="mx-auto max-w-sm px-4 pb-16">
        <Card className="mt-12">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Lock className="h-6 w-6" />
              </span>
              <h1 className="mt-3 text-lg font-extrabold">{t('adminLogin', lang)}</h1>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {isFa ? 'اپلیکیشن مدیریتی امن با دو دسترسی: مالک و ادمین' : 'Secure management app: owner and admin access levels'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auser">{isFa ? 'نام کاربری' : 'Username'}</Label>
              <Select value={username} onValueChange={setUsername}>
                <SelectTrigger id="auser" dir="ltr"><SelectValue /></SelectTrigger>
                <SelectContent dir="ltr">
                  <SelectItem value="owner">owner — {isFa ? 'مالک' : 'Owner'}</SelectItem>
                  <SelectItem value="admin">admin — {isFa ? 'ادمین' : 'Admin'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apw">{t('adminPass', lang)}</Label>
              <Input
                id="apw" type="password" dir="ltr" className="ltr-num text-start"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
              />
            </div>
            <Button className="w-full font-bold" onClick={login} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {t('login', lang)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4 pb-16">
      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          {t('adminTitle', lang)}
          <Badge variant={role === 'OWNER' ? 'default' : 'secondary'} className="text-[10px]">
            {role === 'OWNER' ? (isFa ? 'دسترسی مالک' : 'OWNER') : (isFa ? 'دسترسی ادمین' : 'ADMIN')}
          </Badge>
        </h1>
        <Button variant="outline" size="sm" onClick={async () => { await fetch('/api/admin/login', { method: 'DELETE' }); setLogged(false); setPassword(''); }}>
          {isFa ? 'خروج' : 'Log out'}
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="mt-4">
        <TabsList className="as-scroll flex w-full justify-start overflow-x-auto h-auto flex-wrap">
          <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" />{t('adminTabDashboard', lang)}</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />{t('adminTabOrders', lang)}</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><ReceiptText className="h-3.5 w-3.5" />{t('adminTabPayments', lang)}</TabsTrigger>
          <TabsTrigger value="stages" className="gap-1.5"><ReceiptText className="h-3.5 w-3.5" />{t('adminTabStages', lang)}</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5"><Package className="h-3.5 w-3.5" />{t('adminTabInventory', lang)}</TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1.5"><WarehouseIcon className="h-3.5 w-3.5" />{t('adminTabWarehouses', lang)}</TabsTrigger>
          <TabsTrigger value="stores" className="gap-1.5"><StoreIcon className="h-3.5 w-3.5" />{t('adminTabStores', lang)}</TabsTrigger>
          <TabsTrigger value="dailyprices" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{t('adminTabDailyPrices', lang)}</TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" />{t('adminTabProposals', lang)}</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><Tag className="h-3.5 w-3.5" />{t('adminTabPricing', lang)}</TabsTrigger>
          <TabsTrigger value="dayrates" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{t('adminTabDayRates', lang)}</TabsTrigger>
          <TabsTrigger value="coordination" className="gap-1.5"><BotMessageSquare className="h-3.5 w-3.5" />{t('adminTabCoordination', lang)}</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ShieldBan className="h-3.5 w-3.5" />{t('adminTabAudit', lang)}</TabsTrigger>
          <TabsTrigger value="assistant" className="gap-1.5"><Bot className="h-3.5 w-3.5" />{t('adminTabAssistant', lang)}</TabsTrigger>
          <TabsTrigger value="workers" className="gap-1.5"><UsersRound className="h-3.5 w-3.5" />{t('adminTabWorkers', lang)}</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1.5"><Share2 className="h-3.5 w-3.5" />{t('adminTabReferrals', lang)}</TabsTrigger>
          <TabsTrigger value="productorders" className="gap-1.5"><Package className="h-3.5 w-3.5" />{t('adminTabProducts', lang)}</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5"><Inbox className="h-3.5 w-3.5" />{t('adminTabRequests', lang)}</TabsTrigger>
          <TabsTrigger value="detailreq" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" />{t('adminTabDetailReq', lang)}</TabsTrigger>
          <TabsTrigger value="pricereq" className="gap-1.5"><BadgeDollarSign className="h-3.5 w-3.5" />{t('adminTabPriceReq', lang)}</TabsTrigger>
          <TabsTrigger value="parts" className="gap-1.5"><Cpu className="h-3.5 w-3.5" />{t('adminTabParts', lang)}</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5"><Mail className="h-3.5 w-3.5" />{t('adminTabReports', lang)}</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" />{t('adminTabSettings', lang)}</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardTab lang={lang} role={role} /></TabsContent>
        <TabsContent value="orders"><OrdersTab lang={lang} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab lang={lang} /></TabsContent>
        <TabsContent value="stages"><InvoiceStagesTab lang={lang} /></TabsContent>
        <TabsContent value="inventory"><InventoryTab lang={lang} /></TabsContent>
        <TabsContent value="warehouses"><WarehousesTab lang={lang} /></TabsContent>
        <TabsContent value="stores"><StoresTab lang={lang} /></TabsContent>
        <TabsContent value="dailyprices"><DailyPricesTab lang={lang} /></TabsContent>
        <TabsContent value="proposals"><ProposalsTab lang={lang} /></TabsContent>
        <TabsContent value="pricing"><PricingTab lang={lang} /></TabsContent>
        <TabsContent value="dayrates"><DayRatesTab lang={lang} /></TabsContent>
        <TabsContent value="coordination"><CoordinationTab lang={lang} role={role} /></TabsContent>
        <TabsContent value="audit"><AuditTab lang={lang} role={role} /></TabsContent>
        <TabsContent value="assistant"><AssistantTab lang={lang} /></TabsContent>
        <TabsContent value="workers"><WorkersTab lang={lang} /></TabsContent>
        <TabsContent value="referrals"><ReferralsTab lang={lang} /></TabsContent>
        <TabsContent value="productorders"><ProductOrdersTab lang={lang} /></TabsContent>
        <TabsContent value="requests"><RequestsTab lang={lang} /></TabsContent>
        <TabsContent value="detailreq"><DetailRequestsTab lang={lang} /></TabsContent>
        <TabsContent value="pricereq"><PriceRequestsTab lang={lang} /></TabsContent>
        <TabsContent value="parts"><PartsTab lang={lang} /></TabsContent>
        <TabsContent value="reports"><ReportsTab lang={lang} /></TabsContent>
        <TabsContent value="settings"><SettingsTab lang={lang} role={role} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══ داشبورد ═════════════════════════════════════════════
function DashboardTab({ lang, role }: { lang: 'fa' | 'en'; role: 'OWNER' | 'ADMIN' }) {
  const isFa = lang === 'fa';
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  const load = useCallback(() => {
    api<{ stats: Stats; recentOrders: AdminOrder[] }>('/api/admin/stats')
      .then((d) => { setStats(d.stats); setOrders(d.recentOrders ?? []); })
      .catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  const cards = stats
    ? [
        { icon: ClipboardList, label: isFa ? 'کل سفارش‌ها' : 'Total orders', value: money(stats.totalOrders, lang) },
        { icon: Wallet, label: t('walletHeld', lang), value: `${money(stats.walletHeld, lang)} ${moneyLabel(lang)}` },
        { icon: CheckCircle2, label: isFa ? 'انجام‌شده' : 'Completed', value: money(stats.doneOrders, lang) },
        { icon: Hourglass, label: t('stEXPERT_REVIEW', lang), value: money(stats.expertOrders, lang) },
        { icon: Star, label: t('avgRating', lang), value: `${new Intl.NumberFormat(isFa ? 'fa-IR' : 'en-US', { maximumFractionDigits: 2 }).format(stats.avgRating)} / ${isFa ? '۱۰' : '10'}` },
        { icon: ShieldAlert, label: isFa ? 'حق معرف پرداخت‌نشده (تعداد)' : 'Unpaid referrals', value: money(stats.unpaidReferralsCount, lang) },
        // پیام ۱۱:
        { icon: Package, label: isFa ? 'سفارش کالا در انتظار' : 'Pending goods orders', value: money(stats.pendingProductOrders, lang) },
        { icon: BadgeDollarSign, label: isFa ? 'پیشنهاد قیمت در انتظار' : 'Pending price proposals', value: money(stats.pendingProposals, lang) },
        { icon: CalendarDays, label: isFa ? 'گزارش روزانهٔ قیمت' : 'Daily price reports', value: money(stats.pendingDailyReports, lang) },
        { icon: ReceiptText, label: isFa ? 'مراحل فاکتور باز' : 'Open invoice stages', value: money(stats.invoiceStagesOpen, lang) },
        { icon: BotMessageSquare, label: isFa ? 'هماهنگی‌های دستی باز' : 'Open manual coordinations', value: money(stats.manualCoordinations, lang) },
        { icon: ShieldBan, label: isFa ? 'آخرین حسابرسی' : 'Last audit', value: stats.lastAuditDate ? `${stats.lastAuditStatus === 'OK' ? (isFa ? 'سالم' : 'OK') : stats.lastAuditStatus === 'RESOLVED' ? (isFa ? 'برطرف' : 'resolved') : (isFa ? 'خطا' : 'anomaly')}` : (isFa ? '—' : '—') },
      ]
    : [];

  return (
    <div>
      {/* هشدار توقف عملیات — حسابدار هوشمند (پیام ۱۱) */}
      {stats?.operationsFrozen && (
        <div className="mt-4 rounded-xl border border-destructive bg-destructive/10 p-3.5 text-sm">
          <p className="flex items-center gap-2 font-extrabold text-destructive">
            <ShieldBan className="h-5 w-5" />
            {isFa ? 'عملیات به دلیل خطای حسابرسی متوقف است' : 'Operations frozen due to audit anomaly'}
          </p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {isFa
              ? 'تا تأیید مالک/مدیر عملیات متوقف می‌ماند؛ در صورت عدم تأیید مالک تا ۳ ساعت، تأیید ادمین لازم است. فرمان ادامه را در تب «حسابدار هوشمند» صادر کنید.'
              : 'Resume from the Smart Accountant tab.'}
            {stats.frozenAt && ` · ${formatJalaliTime(new Date(stats.frozenAt), lang)}`}
          </p>
        </div>
      )}
      {!stats ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="p-4">
                  <c.icon className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-xs text-muted-foreground">{c.label}</p>
                  <p className="mt-0.5 font-extrabold ltr-num" dir="ltr">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs font-semibold leading-6">
            {t('adminNoteSettled', lang)}
          </div>

          <h2 className="mt-8 text-lg font-extrabold">{t('recentOrders', lang)}</h2>
          <Card className="mt-3">
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t('noOrders', lang)}</p>
              ) : (
                <div className="divide-y">
                  {orders.map((o) => (
                    <div key={o.code} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3.5 text-sm">
                      <span className="font-extrabold tracking-wider text-primary" dir="ltr">{o.code}</span>
                      <Badge variant="secondary">{t(`st${o.status}` as DictKey, lang)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{o.mode === 'REMOTE' ? t('remote', lang) : t('onsite', lang)}</Badge>
                      {o.needsExpertise && <Badge className="bg-amber-500 text-[10px]">{t('miscAiExpert', lang)}</Badge>}
                      <span className="font-semibold">{o.customer.fullName}</span>
                      <span className="text-xs text-muted-foreground ltr-num" dir="ltr">{o.customer.mobile}</span>
                      <span className="text-xs text-muted-foreground">{o.items.map((i) => `${svcName(i.service, lang)} ×${faDigits(i.qty)}`).join('، ')}</span>
                      <span className="ms-auto font-extrabold text-primary ltr-num" dir="ltr">{money(o.total, lang)} {moneyLabel(lang)}</span>
                      <span className="w-full text-[11px] text-muted-foreground">{formatJalaliTime(new Date(o.createdAt), lang)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══ سفارش‌ها ═════════════════════════════════════════════
function OrdersTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams({ status, q });
    api<{ orders: AdminOrder[] }>(`/api/admin/orders?${params}`)
      .then((d) => setOrders(d.orders))
      .catch((e) => toast.error(e.message));
  }, [status, q]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);
  useEffect(() => { api<{ workers: WorkerRow[] }>('/api/admin/workers').then((d) => setWorkers(d.workers.filter((w) => w.status === 'APPROVED'))).catch(() => {}); }, []);

  async function act(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success(okMsg);
      load();
      setDetail((d) => (d && d.id === id ? null : d));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  async function settleManual(id: string) {
    setBusyId(id);
    try {
      // محرمانگی: پاسخ تسویه فقط ok است؛ مبالغ سهم‌ها هرگز به رابط کاربری نمی‌رسند (فقط پایگاه داده + ایمیل بک‌اند)
      await api<{ ok: boolean }>(`/api/admin/orders/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settle' }) });
      toast.success(t('settled', lang));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  async function openDetail(o: AdminOrder) {
    setDetail(o);
    try {
      const d = await api<{ order: AdminOrder & { events: { id: string; noteFa: string; noteEn: string; createdAt: string }[] } }>(`/api/admin/orders/${o.id}`);
      setDetail(d.order);
    } catch { /* جزئیات لیست کافی است */ }
  }

  const approvedWorkers = workers.filter((w) => w.status === 'APPROVED');

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search', lang)} className="ps-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('filterAll', lang)}</SelectItem>
            {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{t(`st${s}` as DictKey, lang)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} aria-label="refresh"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {!orders ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : orders.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t('noOrders', lang)}</p>
      ) : (
        <Card className="mt-3">
          <CardContent className="p-0">
            <div className="divide-y">
              {orders.map((o) => (
                <button key={o.id} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 text-start text-sm hover:bg-secondary/60 transition-colors" onClick={() => openDetail(o)}>
                  <span className="font-extrabold tracking-wider text-primary" dir="ltr">{o.code}</span>
                  <Badge variant="secondary" className="text-[10px]">{t(`st${o.status}` as DictKey, lang)}</Badge>
                  {o.settledAt && <Badge className="bg-emerald-600 text-[10px]">{t('settled', lang)}</Badge>}
                  {o.needsExpertise && !o.settledAt && <Badge className="bg-amber-500 text-[10px]">{t('miscAiExpert', lang)}</Badge>}
                  <span className="font-semibold">{o.customer.fullName}</span>
                  <span className="ltr-num text-xs text-muted-foreground" dir="ltr">{o.customer.mobile}</span>
                  <span className="ms-auto font-extrabold text-primary ltr-num" dir="ltr">{money(o.total, lang)}</span>
                  <span className="w-full text-[11px] text-muted-foreground">{formatJalaliTime(new Date(o.createdAt), lang)} · {o.items.map((i) => svcName(i.service, lang)).join('، ')}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* دیالوگ جزئیات */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto as-scroll">
          {detail && <OrderDetail o={detail} workers={approvedWorkers} lang={lang} busy={busyId === detail.id} onAct={act} onSettle={settleManual} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetail({ o, workers, lang, busy, onAct, onSettle }: {
  o: AdminOrder;
  workers: WorkerRow[];
  lang: 'fa' | 'en';
  busy: boolean;
  onAct: (id: string, body: Record<string, unknown>, okMsg: string) => void;
  onSettle: (id: string) => void;
}) {
  const isFa = lang === 'fa';
  const [expertPrice, setExpertPrice] = useState<string>(String(o.items.find((i) => i.service.key === 'misc')?.baseRate ?? o.aiPrice ?? ''));
  const nextStatuses = STATUS_LIST.filter((s) => s !== o.status);

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2" dir="ltr">
          <span className="text-primary">{o.code}</span>
          <Badge variant="secondary">{t(`st${o.status}` as DictKey, lang)}</Badge>
          <Badge variant="outline">{o.mode === 'REMOTE' ? t('remote', lang) : t('onsite', lang)}</Badge>
          {o.settledAt && <Badge className="bg-emerald-600">{t('settled', lang)}</Badge>}
        </DialogTitle>
        <DialogDescription>{formatJalaliTime(new Date(o.createdAt), lang)}</DialogDescription>
      </DialogHeader>

      {/* مشتری */}
      <div className="rounded-xl border p-3 text-sm leading-7">
        <p className="font-bold">{t('customerLbl', lang)}: {o.customer.fullName}</p>
        <p className="text-muted-foreground ltr-num" dir="ltr">{o.customer.mobile} · {o.customer.nationalId}</p>
        <p className="text-muted-foreground">{o.customer.address}</p>
        {o.miscNotes && <p className="mt-1 rounded-lg bg-secondary p-2 text-xs leading-6">{o.miscNotes}</p>}
      </div>

      {/* ریز اقلام */}
      <div className="rounded-xl border p-3 text-sm">
        <p className="mb-2 font-bold">{t('lineItems', lang)}</p>
        <div className="space-y-2">
          {o.items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-0 last:pb-0">
              <span className="font-semibold">{svcName(i.service, lang)} ×{faDigits(i.qty)}</span>
              <span className="text-muted-foreground ltr-num" dir="ltr">{money(i.baseRate, lang)} × {factor(o.weekFactor * o.hourFactor * o.dayFactor * o.modeFactor, lang)} = {money(i.itemAmount ?? i.lineTotal, lang)}</span>
              {i.worker && <Badge variant="outline" className="text-[10px]">{i.worker.fullName}</Badge>}
              {/* محرمانگی: سهم مجری/شرکت هرگز نمایش داده نمی‌شود — فقط وضعیت تسویه */}
              {i.settled && <Badge variant="secondary" className="ms-auto text-[10px]">{lang === 'fa' ? 'تسویه‌شده' : 'Settled'}</Badge>}
            </div>
          ))}
        </div>
        <Separator className="my-2" />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>{t('fSubtotal', lang)}: <b className="text-foreground">{money(o.subtotal, lang)}</b></span>
          <span>{t('quoteFactors', lang)}: <b className="text-foreground ltr-num" dir="ltr">روز {factor(o.weekFactor, lang)} · ساعت {factor(o.hourFactor, lang)} · نرخ {factor(o.dayFactor, lang)} · حالت {factor(o.modeFactor, lang)}</b></span>
          {o.serviceMarkup > 0 && <span>{t('fServiceMarkup', lang)}: <b className="text-foreground">+{money(o.serviceMarkup, lang)}</b></span>}
          {o.discount > 0 && <span>{t('fDiscount', lang)}: <b className="text-foreground">−{money(o.discount, lang)}</b></span>}
          <span className="text-primary font-extrabold">{t('fTotal', lang)}: {money(o.total, lang)} {moneyLabel(lang)}</span>
        </div>
      </div>

      {/* معرف و امتیاز و پرداخت‌ها */}
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        {o.referral && (
          <div className="rounded-xl border p-3">
            <p className="font-bold">{t('referralLbl', lang)}</p>
            <p className="ltr-num text-xs text-muted-foreground" dir="ltr">{o.referral.referrerNat}</p>
            {/* محرمانگی: مبلغ حق معرف نمایش داده نمی‌شود؛ فقط وضعیت واریز */}
            <Badge variant={o.referral.paid ? 'default' : 'secondary'} className="mt-1 text-[10px]">{o.referral.paid ? t('sent', lang) : t('queued', lang)}</Badge>
          </div>
        )}
        {o.rating && (
          <div className="rounded-xl border p-3">
            <p className="font-bold">{t('ratingLbl', lang)}</p>
            <p className="text-xs text-muted-foreground">{t('rateSkill', lang)}: {faDigits(o.rating.skill)}/۵</p>
            <p className="text-xs text-muted-foreground">{t('rateEthics', lang)}: {faDigits(o.rating.ethics)}/۵</p>
          </div>
        )}
        <div className="rounded-xl border p-3">
          <p className="font-bold">{t('paymentsLbl', lang)}</p>
          {o.payments.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : o.payments.map((p) => (
            <p key={p.id} className="text-xs leading-6 text-muted-foreground">
              {p.method === 'GATEWAY' ? (isFa ? 'درگاه شاپرک/شتاب' : 'Shaparak gateway') : (isFa ? 'کارت‌به‌کارت' : 'Card transfer')} · <span className="ltr-num" dir="ltr">{money(p.amount, lang)}</span> · {p.status === 'SUCCESS' ? (isFa ? 'موفق' : 'Success') : p.status === 'AWAITING_ADMIN' ? t('stAWAITING_ADMIN', lang) : p.status === 'FAILED' ? (isFa ? 'ناموفق' : 'Failed') : (isFa ? 'در انتظار' : 'Pending')}
              {p.rrn && <span className="ltr-num" dir="ltr"> · {p.rrn}</span>}
            </p>
          ))}
        </div>
      </div>

      {/* عملیات */}
      <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
        {/* انتقال وضعیت */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{t('setStatus', lang)}:</span>
          <div className="flex flex-wrap gap-1.5">
            {nextStatuses.map((s) => (
              <Button key={s} size="sm" variant={s === 'CANCELLED' ? 'destructive' : 'outline'} disabled={busy}
                onClick={() => onAct(o.id, { action: 'set-status', status: s }, t('savedOk', lang))}>
                {t(`st${s}` as DictKey, lang)}
              </Button>
            ))}
          </div>
        </div>
        {/* تعیین مجری */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{t('assignWorker', lang)}:</span>
          <Select value={o.items[0]?.worker?.id ?? 'none'} onValueChange={(v) => onAct(o.id, { action: 'assign-worker', workerId: v === 'none' ? null : v }, t('savedOk', lang))}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('workerNone', lang)}</SelectItem>
              {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.fullName} — {w.field}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* قیمت کارشناسی متفرقه */}
        {o.needsExpertise && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{t('expertPriceTitle', lang)}</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">{t('expertPriceHint', lang)} {o.aiPrice ? `(${t('miscAiPriceLbl', lang)}: ${money(o.aiPrice, lang)})` : ''}</p>
            <div className="mt-2 flex items-center gap-2">
              <Input className="ltr-num w-44" dir="ltr" inputMode="numeric" value={expertPrice} onChange={(e) => setExpertPrice(e.target.value.replace(/\D/g, ''))} />
              <span className="text-xs text-muted-foreground">{moneyLabel(lang)}</span>
              <Button size="sm" disabled={busy || !expertPrice}
                onClick={() => onAct(o.id, { action: 'set-expert-price', expertPrice: parseInt(expertPrice, 10) }, t('savedOk', lang))}>
                {t('save', lang)}
              </Button>
            </div>
          </div>
        )}
        {/* تسویهٔ دستی */}
        {o.status === 'DONE' && o.rating && !o.settledAt && (
          <Button size="sm" variant="secondary" className="gap-1.5" disabled={busy} onClick={() => onSettle(o.id)}>
            <CircleDollarSign className="h-4 w-4" />
            {t('settleNow', lang)}
          </Button>
        )}
      </div>

      {/* رویدادها */}
      <div>
        <p className="mb-1.5 text-sm font-bold">{t('eventsLbl', lang)}</p>
        <div className="space-y-1.5 text-xs leading-6 text-muted-foreground">
          {(o as unknown as { events?: { id: string; noteFa: string; noteEn: string; createdAt: string }[] }).events?.map((ev) => (
            <p key={ev.id}>• {isFa ? ev.noteFa : ev.noteEn} — {formatJalaliTime(new Date(ev.createdAt), lang)}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ تأیید پرداخت ═════════════════════════════════════════
function PaymentsTab({ lang }: { lang: 'fa' | 'en' }) {
  const [payments, setPayments] = useState<PendingPayment[] | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    api<{ payments: PendingPayment[] }>('/api/admin/payments').then((d) => setPayments(d.payments)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, action: 'confirm' | 'reject') {
    setBusyId(id);
    try {
      await api(`/api/admin/payments?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      toast.success(action === 'confirm' ? t('savedOk', lang) : t('payFailed', lang));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mt-4">
      <h2 className="text-lg font-extrabold">{t('pendingPayments', lang)}</h2>
      {!payments ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : payments.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{t('noPendingPayments', lang)}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-primary ltr-num" dir="ltr">{p.order.code}</span>
                  <Badge variant={p.status === 'AWAITING_ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                    {p.status === 'AWAITING_ADMIN' ? t('stAWAITING_ADMIN', lang) : t('stPENDING_PAYMENT', lang)}
                  </Badge>
                </div>
                <p><b>{p.order.customer.fullName}</b> · <span className="ltr-num" dir="ltr">{p.order.customer.mobile}</span></p>
                <p className="text-muted-foreground">{t('amount', lang)}: <b className="text-foreground ltr-num" dir="ltr">{money(p.amount, lang)} {moneyLabel(lang)}</b></p>
                {p.cardMask && <p className="text-muted-foreground ltr-num" dir="ltr">{p.cardMask}</p>}
                {p.rrn && <p className="text-muted-foreground ltr-num" dir="ltr">{t('transferRrn', lang)}: {p.rrn}</p>}
                <p className="text-[11px] text-muted-foreground">{formatJalaliTime(new Date(p.createdAt), lang)}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 gap-1.5" disabled={busyId === p.id} onClick={() => act(p.id, 'confirm')}>
                    <BadgeCheck className="h-4 w-4" /> {t('confirmPay', lang)}
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 gap-1.5" disabled={busyId === p.id} onClick={() => act(p.id, 'reject')}>
                    <XCircle className="h-4 w-4" /> {t('rejectPay', lang)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ قیمت‌گذاری ═══════════════════════════════════════════
function PricingTab({ lang }: { lang: 'fa' | 'en' }) {
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    api<{ services: ServiceRow[] }>('/api/admin/pricing').then((d) => setServices(d.services)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function save(s: ServiceRow) {
    const v = edits[s.id];
    if (v === undefined || v === String(s.baseRate)) return;
    setBusyId(s.id);
    try {
      await api('/api/admin/pricing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, baseRate: parseInt(v, 10) || 0 }) });
      toast.success(t('savedOk', lang));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  async function toggle(s: ServiceRow, key: 'active' | 'remoteCapable') {
    setBusyId(s.id);
    try {
      await api('/api/admin/pricing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, [key]: !s[key] }) });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{t('pricingSub', lang)}</p>
      {!services ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : (
        <>
          <div className="relative mt-3">
            <Search className="absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPh', lang)}
              aria-label={t('searchPh', lang)}
              className="ps-9"
            />
          </div>
          <div className="as-scroll mt-3 max-h-[70vh] space-y-2 overflow-y-auto pe-1">
            {services
              .filter((s) => !q.trim() || svcName(s, lang).includes(q.trim()) || (s.category ?? '').includes(q.trim()))
              .map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-bold">{svcName(s, lang)} {s.isMisc && <Badge variant="outline" className="ms-1 text-[10px]">{t('miscTitle', lang).split('—')[0]}</Badge>}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{svcDesc(s, lang)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    className="ltr-num w-40" dir="ltr" inputMode="numeric"
                    value={edits[s.id] ?? String(s.baseRate)}
                    onChange={(e) => setEdits((m) => ({ ...m, [s.id]: e.target.value.replace(/\D/g, '') }))}
                  />
                  <span className="text-xs text-muted-foreground">{moneyLabel(lang)}</span>
                  <Button size="sm" disabled={busyId === s.id || edits[s.id] === undefined || edits[s.id] === String(s.baseRate)} onClick={() => save(s)}>
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('save', lang)}
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant={s.remoteCapable ? 'secondary' : 'outline'} className="text-[11px]" onClick={() => toggle(s, 'remoteCapable')}>
                    {s.remoteCapable ? t('remoteOk', lang) : t('remoteNo', lang)}
                  </Button>
                  <Button size="sm" variant={s.active ? 'secondary' : 'destructive'} className="text-[11px]" onClick={() => toggle(s, 'active')}>
                    {s.active ? (lang === 'fa' ? 'فعال' : 'Active') : (lang === 'fa' ? 'غیرفعال' : 'Inactive')}
                  </Button>
                </div>
              </CardContent>
            </Card>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══ نرخ روز خدمت ═════════════════════════════════════════
function DayRatesTab({ lang }: { lang: 'fa' | 'en' }) {
  const [rates, setRates] = useState<DayRateRow[] | null>(null);
  const [form, setForm] = useState({ date: '', labelFa: '', labelEn: '', multiplier: '1' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ rates: DayRateRow[] }>('/api/admin/dayrates').then((d) => setRates(d.rates)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function add() {
    if (!form.date || !form.labelFa.trim()) {
      toast.error(lang === 'fa' ? 'تاریخ و عنوان الزامی است' : 'Date and label are required');
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/dayrates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: form.date, labelFa: form.labelFa.trim(), labelEn: form.labelEn.trim() || null, multiplier: parseFloat(form.multiplier) || 1 }),
      });
      toast.success(t('savedOk', lang));
      setForm({ date: '', labelFa: '', labelEn: '', multiplier: '1' });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  }

  async function remove(date: string) {
    try {
      await api(`/api/admin/dayrates?date=${date}`, { method: 'DELETE' });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{t('dayRateSub', lang)}</p>
      <Card className="mt-3">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1.5">
              <Label>{t('date', lang)}</Label>
              <Input type="date" dir="ltr" className="ltr-num" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('dayRateLabel', lang)} (فا)</Label>
              <Input value={form.labelFa} onChange={(e) => setForm((f) => ({ ...f, labelFa: e.target.value }))} placeholder={lang === 'fa' ? 'مثلاً: نوروز — تعطیل رسمی' : ''} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('dayRateLabel', lang)} (EN)</Label>
              <Input dir="ltr" value={form.labelEn} onChange={(e) => setForm((f) => ({ ...f, labelEn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('dayRateMult', lang)}</Label>
              <div className="flex gap-1.5">
                <Input dir="ltr" inputMode="decimal" className="ltr-num" value={form.multiplier} onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value.replace(/[^\d.]/g, '') }))} />
                <Button disabled={busy} onClick={add}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('dayRateAdd', lang)}</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!rates ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : rates.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rates.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5 text-sm">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="ltr-num font-bold" dir="ltr">{r.date}</span>
                <span className="text-xs text-muted-foreground">{formatJalali(new Date(`${r.date}T12:00:00`), lang)}</span>
                <span className="font-semibold">{r.labelFa}{r.labelEn ? ` · ${r.labelEn}` : ''}</span>
                <Badge className="ms-auto bg-primary/15 text-primary hover:bg-primary/15 ltr-num" dir="ltr">×{factor(r.multiplier, lang)}</Badge>
                <Button size="sm" variant="destructive" onClick={() => remove(r.date)}>{t('dayRateDelete', lang)}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ همکاران ═══════════════════════════════════════════════
function WorkersTab({ lang }: { lang: 'fa' | 'en' }) {
  const [workers, setWorkers] = useState<WorkerRow[] | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    api<{ workers: WorkerRow[] }>('/api/admin/workers').then((d) => setWorkers(d.workers)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, action: 'approve' | 'reject' | 'set-level', level?: string) {
    setBusyId(id);
    try {
      await api('/api/admin/workers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, level }) });
      toast.success(t('savedOk', lang));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  const levelLabel = (l: string) => l === 'GOLD' ? (lang === 'fa' ? 'طلایی' : 'Gold') : l === 'SILVER' ? (lang === 'fa' ? 'نقره‌ای' : 'Silver') : (lang === 'fa' ? 'برنزی' : 'Bronze');

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{t('workersSub', lang)}</p>
      {!workers ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : workers.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <div className="mt-3 space-y-2">
          {workers.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold">{w.fullName}</span>
                  <Badge variant={w.status === 'APPROVED' ? 'default' : w.status === 'PENDING' ? 'secondary' : 'destructive'} className="text-[10px]">
                    {w.status === 'APPROVED' ? t('approve', lang) : w.status === 'PENDING' ? t('stAWAITING_ADMIN', lang) : t('reject', lang)}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${LEVEL_COLORS[w.level] ?? ''}`}>{levelLabel(w.level)}</Badge>
                  <span className="text-xs text-muted-foreground ltr-num" dir="ltr">{w.nationalId} · {w.mobile}</span>
                  <span className="ms-auto flex gap-3 text-xs text-muted-foreground">
                    <span>{t('points', lang)}: <b className="text-foreground ltr-num">{faDigits(w.points)}</b></span>
                    <span>{t('jobs', lang)}: <b className="text-foreground ltr-num">{faDigits(w.jobsCount)}</b></span>
                    <span>{lang === 'fa' ? 'تسویه‌شده' : 'Settled jobs'}: <b className="text-foreground ltr-num">{faDigits(w.settledJobsCount)}</b></span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{w.field} · {w.city}</p>
                {w.resume && <p className="rounded-lg bg-secondary p-2 text-xs leading-6">{w.resume}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {w.status !== 'APPROVED' && (
                    <Button size="sm" className="gap-1.5" disabled={busyId === w.id} onClick={() => act(w.id, 'approve')}>
                      <BadgeCheck className="h-4 w-4" /> {t('approve', lang)}
                    </Button>
                  )}
                  {w.status !== 'REJECTED' && (
                    <Button size="sm" variant="destructive" className="gap-1.5" disabled={busyId === w.id} onClick={() => act(w.id, 'reject')}>
                      <XCircle className="h-4 w-4" /> {t('reject', lang)}
                    </Button>
                  )}
                  {w.status === 'APPROVED' && ['BRONZE', 'SILVER', 'GOLD'].map((l) => (
                    <Button key={l} size="sm" variant={w.level === l ? 'default' : 'outline'} className={`text-[11px] ${w.level !== l ? (LEVEL_COLORS[l] ?? '') : ''}`} disabled={busyId === w.id} onClick={() => act(w.id, 'set-level', l)}>
                      {levelLabel(l)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ معرفی‌ها ═══════════════════════════════════════════════
// ═══ پیام ۱۹ (V4.1): پاداش سقف‌دار دوره‌ای معرف — پیش‌نمایش/بستن دوره ═══
function PeriodicBonusBox({ lang }: { lang: 'fa' | 'en' }) {
  const [period, setPeriod] = useState('');
  const [data, setData] = useState<{ rows: { referrerNat: string; referrerName: string; invoices: number; batches: number; bonus: number }[]; total: number; invoicesPerReward: number; rewardToman: number; debt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Tehran' })
    .formatToParts(new Date());
  const curPeriod = `${cur.find((p) => p.type === 'year')?.value.replace(/\D/g, '')}-${(cur.find((p) => p.type === 'month')?.value.replace(/\D/g, '') ?? '').padStart(2, '0')}`;
  const shown = period.trim() || curPeriod;

  const preview = () => {
    setBusy(true);
    api<{ rows: typeof data extends null ? never : NonNullable<typeof data>['rows']; total: number; invoicesPerReward: number; rewardToman: number; debt: number }>(`/api/admin/periodic-bonus?period=${shown}`)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setBusy(false));
  };
  const finalize = async () => {
    setBusy(true);
    try {
      const r = await api<{ total: number; rows: unknown[] }>('/api/admin/periodic-bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period: shown }) });
      toast.success(lang === 'fa' ? `دورهٔ ${shown} بسته شد — سند برای مالک ایمیل شد (جمع: ${r.total.toLocaleString('fa-IR')} تومان)` : `Period closed — emailed (${r.total})`);
      setData(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-3 border-dashed">
      <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="font-bold">{lang === 'fa' ? 'پاداش سقف‌دار دوره‌ای معرف (V5.0)' : 'Periodic capped referral bonus (V5.0)'}</span>
        <Input value={shown} onChange={(e) => setPeriod(e.target.value)} placeholder={curPeriod} className="h-8 w-28 ltr-num" dir="ltr" />
        <Button size="sm" variant="outline" disabled={busy} onClick={preview}>{lang === 'fa' ? 'محاسبه' : 'Compute'}</Button>
        {data && (
          <Button size="sm" variant="destructive" disabled={busy || data.rows.length === 0} onClick={finalize}>
            {lang === 'fa' ? `بستن دوره و ایمیل سند (${data.rows.length} معرف)` : 'Close period & email'}
          </Button>
        )}
        {data && (
          <span className="text-xs text-muted-foreground">
            {lang === 'fa'
              ? `هر ${data.invoicesPerReward.toLocaleString('fa-IR')} فاکتور از جانب معرف → ${data.rewardToman.toLocaleString('fa-IR')} تومان ثابت | جمع: ${data.total.toLocaleString('fa-IR')} تومان${data.debt > 0 ? ` | بدهی تأمین‌نشده: ${data.debt.toLocaleString('fa-IR')}` : ''}`
              : `${data.invoicesPerReward} invoices per referrer → ${data.rewardToman.toLocaleString('fa-IR')} T | total ${data.total}${data.debt > 0 ? ` | debt ${data.debt}` : ''}`}
          </span>
        )}
        {data && data.rows.length > 0 && (
          <div className="w-full text-[11px] text-muted-foreground leading-5">
            {data.rows.map((r) => (
              <div key={r.referrerNat} className="ltr-num">
                {lang === 'fa'
                  ? `${r.referrerName} — ${r.invoices} فاکتور → ${r.batches} × ${data.rewardToman.toLocaleString('fa-IR')} = ${r.bonus.toLocaleString('fa-IR')} تومان`
                  : `${r.referrerName} — ${r.invoices} invoices → ${r.bonus.toLocaleString('fa-IR')} T`}
              </div>
            ))}
          </div>
        )}
        <span className="text-xs text-muted-foreground w-full">{lang === 'fa' ? 'دورهٔ یک‌ماههٔ شمسی (مثل 1405-08) — در لحظهٔ فاکتور پنجم، ۵۰۰ هزار تومان از واریزی بانک ملی کسر و به بانک مهر منتقل می‌شود' : 'Jalali month period — at the 5th invoice, 500kT moves from Melli deposit to Mehr'}</span>
      </CardContent>
    </Card>
  );
}

function ReferralsTab({ lang }: { lang: 'fa' | 'en' }) {
  const [refs, setRefs] = useState<ReferralRow[] | null>(null);
  const [goods, setGoods] = useState<GoodsReferralRow[]>([]); // پیام ۱۹ (V4.1)
  const [totals, setTotals] = useState({ unpaidCount: 0, paidCount: 0 });
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    api<{ referrals: ReferralRow[]; goodsReferrals: GoodsReferralRow[]; unpaidCount: number; paidCount: number }>('/api/admin/referrals')
      .then((d) => { setRefs(d.referrals); setGoods(d.goodsReferrals ?? []); setTotals({ unpaidCount: d.unpaidCount, paidCount: d.paidCount }); })
      .catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await api('/api/admin/referrals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      toast.success(t('paidOk', lang));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  // پیام ۱۹ (V4.1): واریز پورسانت معرف کالا
  async function markPaidGoods(goodsId: string) {
    setBusyId(goodsId);
    try {
      await api('/api/admin/referrals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goodsId }) });
      toast.success(t('paidOk', lang));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{t('referralsSub', lang)}</p>
      {/* ═══ پیام ۱۹ (V4.1): پاداش سقف‌دار دوره‌ای معرف ═══ */}
      <PeriodicBonusBox lang={lang} />
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {/* محرمانگی: فقط تعداد؛ مبلغ حق معرف‌ها در UI نمایش داده نمی‌شود */}
        <Card><CardContent className="flex items-center gap-2 p-3"><Hourglass className="h-4 w-4 text-amber-500" /> {lang === 'fa' ? 'حق معرف پرداخت‌نشده (تعداد)' : 'Unpaid referrals'}: <b className="ltr-num" dir="ltr">{money(totals.unpaidCount, lang)}</b></CardContent></Card>
        <Card><CardContent className="flex items-center gap-2 p-3"><CheckCheck className="h-4 w-4 text-emerald-600" /> {lang === 'fa' ? 'واریزشده (تعداد)' : 'Paid referrals'}: <b className="ltr-num" dir="ltr">{money(totals.paidCount, lang)}</b></CardContent></Card>
      </div>
      {!refs ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : refs.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <Card className="mt-3">
          <CardContent className="p-0">
            <div className="divide-y">
              {refs.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 text-sm">
                  <span className="font-extrabold text-primary ltr-num" dir="ltr">{r.order.code}</span>
                  <Badge variant="secondary" className="text-[10px]">{t(`st${r.order.status}` as DictKey, lang)}</Badge>
                  <span>
                    {t('referralLbl', lang)}: <b>{r.referrer?.fullName ?? r.referrerNat}</b>
                    <span className="ltr-num text-xs text-muted-foreground" dir="ltr"> ({r.referrerNat}{r.referrer ? ` · ${r.referrer.mobile}` : ''})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {lang === 'fa' ? 'مشتری' : 'Customer'}: {r.order.customer.fullName}
                  </span>
                  {r.paid ? (
                    <Badge className="ms-auto bg-emerald-600 text-[10px]">{t('markPaid', lang)} ✓ {r.paidAt ? formatJalaliTime(new Date(r.paidAt), lang) : ''}</Badge>
                  ) : (
                    <Button size="sm" className="ms-auto gap-1.5" disabled={busyId === r.id || !r.order.settledAt} onClick={() => markPaid(r.id)}>
                      <Banknote className="h-4 w-4" /> {t('markPaid', lang)}
                    </Button>
                  )}
                </div>
              ))}
              {goods.map((g) => (
                <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 text-sm">
                  <span className="font-extrabold text-primary ltr-num" dir="ltr">{g.code}</span>
                  <Badge className="bg-indigo-600 text-[10px]">{lang === 'fa' ? 'کالا' : 'Goods'}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{t(`st${g.status}` as DictKey, lang)}</Badge>
                  <span>
                    {t('referralLbl', lang)}: <b>{g.referrer?.fullName ?? g.referrerNat}</b>
                    <span className="ltr-num text-xs text-muted-foreground" dir="ltr"> ({g.referrerNat}{g.referrer ? ` · ${g.referrer.mobile}` : ''})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {lang === 'fa' ? 'خریدار' : 'Buyer'}: {g.buyer}
                  </span>
                  {g.paid ? (
                    <Badge className="ms-auto bg-emerald-600 text-[10px]">{t('markPaid', lang)} ✓ {g.paidAt ? formatJalaliTime(new Date(g.paidAt), lang) : ''}</Badge>
                  ) : (
                    <Button size="sm" className="ms-auto gap-1.5" disabled={busyId === g.id} onClick={() => markPaidGoods(g.id)}>
                      <Banknote className="h-4 w-4" /> {t('markPaid', lang)}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══ گزارش‌ها ═══════════════════════════════════════════════
function ReportsTab({ lang }: { lang: 'fa' | 'en' }) {
  const [data, setData] = useState<{ reports: ReportRow[]; contactMessages: ContactRow[]; activities: ActivityRow[]; types: string[] } | null>(null);
  const [type, setType] = useState('ALL');

  const load = useCallback(() => {
    api<{ reports: ReportRow[]; contactMessages: ContactRow[]; activities: ActivityRow[]; types: string[] }>(`/api/admin/reports?type=${type}`)
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, [type]);
  useEffect(load, [load]);

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{t('reportsSub', lang)}</p>
      <div className="mt-3 flex items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('typeAll', lang)}</SelectItem>
            {data?.types.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} aria-label="refresh"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {!data ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>
      ) : (
        <div className="mt-3 space-y-6">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><Mail className="h-4 w-4 text-primary" /> {t('adminTabReports', lang)} ({faDigits(data.reports.length)})</h3>
            {data.reports.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
              <div className="space-y-2">
                {data.reports.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-3.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                        <span className="font-bold">{r.title}</span>
                        <Badge variant={r.sent ? 'default' : 'secondary'} className="ms-auto text-[10px]">{r.sent ? t('sent', lang) : t('queued', lang)}</Badge>
                        <span className="w-full text-[11px] text-muted-foreground">{formatJalaliTime(new Date(r.createdAt), lang)} · {r.emails}</span>
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary p-2.5 text-[11px] leading-6">{r.body}</pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><HandHeart className="h-4 w-4 text-primary" /> {t('contactMsgs', lang)} ({faDigits(data.contactMessages.length)})</h3>
            {data.contactMessages.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
              <div className="space-y-2">
                {data.contactMessages.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-3.5 text-sm">
                      <p><b>{c.name}</b> · <span className="ltr-num" dir="ltr">{c.phone}</span> {c.subject && <Badge variant="outline" className="ms-1 text-[10px]">{c.subject}</Badge>}</p>
                      <p className="mt-1 leading-6 text-muted-foreground">{c.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatJalaliTime(new Date(c.createdAt), lang)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><ReceiptText className="h-4 w-4 text-primary" /> {t('activityLog', lang)} ({faDigits(data.activities.length)})</h3>
            {data.activities.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-72">
                    <div className="divide-y text-xs">
                      {data.activities.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 p-2.5">
                          <Badge variant="outline" className="text-[9px]">{a.actor}</Badge>
                          <span className="font-semibold">{a.action}</span>
                          {a.detail && <span className="text-muted-foreground">{a.detail}</span>}
                          <span className="ms-auto text-muted-foreground">{formatJalaliTime(new Date(a.createdAt), lang)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ تنظیمات ═══════════════════════════════════════════════
function SettingsTab({ lang, role }: { lang: 'fa' | 'en'; role: 'OWNER' | 'ADMIN' }) {
  const [s, setS] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ settings: Record<string, string> }>('/api/admin/settings').then((d) => setS(d.settings)).catch((e) => toast.error(e.message));
  }, []);

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        ACCOUNT_NAME: s.ACCOUNT_NAME ?? '',
        CARD_1: s.CARD_1 ?? '',
        CARD_2: s.CARD_2 ?? '',
        SUPPORT_PHONE: s.SUPPORT_PHONE ?? '',
        EMAIL_1: s.EMAIL_1 ?? '',
        EMAIL_2: s.EMAIL_2 ?? '',
        REFERRAL_PERCENT: s.REFERRAL_PERCENT ?? '',
        REMOTE_FACTOR: s.REMOTE_FACTOR ?? '',
        // پیام ۱۱:
        SHEBA_RECEIVING: s.SHEBA_RECEIVING ?? '',
        POL_RECEIVING: s.POL_RECEIVING ?? '',
        SHEBA_THRESHOLD: s.SHEBA_THRESHOLD ?? '',
        // پلن v3 (پیام ۱۴):
        EXPERT_SHARE_PCT: s.EXPERT_SHARE_PCT ?? '',
        PLATFORM_MARGIN_PCT: s.PLATFORM_MARGIN_PCT ?? '',
        SERVICE_MARKUP_PCT: s.SERVICE_MARKUP_PCT ?? '',
        TICK_SECRET: s.TICK_SECRET ?? '',
        AUTOMATION_ENABLED: s.AUTOMATION_ENABLED ?? 'false',
        // پیام ۱۲:
        MIN_INVOICE_AMOUNT: s.MIN_INVOICE_AMOUNT ?? '',
        PRICE_FRESH_FROM: s.PRICE_FRESH_FROM ?? '',
        COURIER_FEE_SMALL: s.COURIER_FEE_SMALL ?? '',
        COURIER_FEE_HEAVY: s.COURIER_FEE_HEAVY ?? '',
      };
      if (s.ADMIN_PASSWORD && s.ADMIN_PASSWORD.length >= 6) payload.ADMIN_PASSWORD = s.ADMIN_PASSWORD;
      await api('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast.success(t('settingsSaved', lang));
      setS((prev) => (prev ? { ...prev, ADMIN_PASSWORD: '' } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  }

  const F = ({ k, label, ltr = false, hint, disabled = false }: { k: string; label: string; ltr?: boolean; hint?: string; disabled?: boolean }) => (
    <div className="space-y-1.5">
      <Label htmlFor={`set-${k}`}>{label}</Label>
      <Input
        id={`set-${k}`}
        dir={ltr ? 'ltr' : undefined}
        className={ltr ? 'ltr-num text-start' : ''}
        value={s?.[k] ?? ''}
        disabled={disabled}
        onChange={(e) => setS((prev) => (prev ? { ...prev, [k]: e.target.value } : prev))}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  if (!s) {
    return <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading', lang)}</div>;
  }

  return (
    <div className="mt-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">{t('settingsSub', lang)}</p>
      <Card className="mt-3">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <F k="ACCOUNT_NAME" label={lang === 'fa' ? 'نام حساب شرکت' : 'Account name'} />
          <F k="SUPPORT_PHONE" label={lang === 'fa' ? 'تلفن پشتیبانی (فقط فوتر سایت)' : 'Support phone (footer only)'} ltr />
          <F k="CARD_1" label={lang === 'fa' ? 'کارت تقسیم‌بندی (ملی) — محرمانه' : 'Division card (Melli) — private'} ltr hint={role === 'OWNER' ? undefined : (lang === 'fa' ? 'فقط مالک می‌تواند تغییر دهد' : 'Owner only')} disabled={role !== 'OWNER'} />
          <F k="CARD_2" label={lang === 'fa' ? 'کارت سهم شرکت (مهر ایران) — محرمانه' : 'Company card (Mehr) — private'} ltr hint={role === 'OWNER' ? undefined : (lang === 'fa' ? 'فقط مالک می‌تواند تغییر دهد' : 'Owner only')} disabled={role !== 'OWNER'} />
          <F k="EMAIL_1" label={lang === 'fa' ? 'ایمیل گزارش ۱ (مالک)' : 'Report email 1 (owner)'} ltr />
          <F k="EMAIL_2" label={lang === 'fa' ? 'ایمیل گزارش ۲ (ادمین)' : 'Report email 2 (admin)'} ltr hint={lang === 'fa' ? 'گزارش حسابرسی شبانه به هر دو ایمیل ارسال می‌شود' : 'Nightly audit reports go to both emails'} />
          <F k="SHEBA_RECEIVING" label={lang === 'fa' ? 'شبای حساب دریافت (همهٔ فاکتورها ≥ ۵م تومان)' : 'Receiving Sheba (all invoices ≥ 5M Toman)'} ltr hint={lang === 'fa' ? 'بررسی خودکار mod-97 — بانک مهر ایران (کد ۰۱۷): IR43 0170 …' : 'mod-97 auto-check — Bank Mehr Iran (code 017)'} disabled={role !== 'OWNER'} />
          <F k="POL_RECEIVING" label={lang === 'fa' ? 'کارت حساب دریافت (در صورت وجود)' : 'Receiving card (optional)'} ltr hint={lang === 'fa' ? 'بررسی خودکار Luhn؛ خالی یعنی فقط شبا' : 'Luhn auto-check; empty = Sheba only'} disabled={role !== 'OWNER'} />
          <F k="SHEBA_THRESHOLD" label={lang === 'fa' ? 'آستانهٔ پرداخت شبا (تومان)' : 'Sheba threshold (Toman)'} ltr hint={lang === 'fa' ? 'چون حداقل هر فاکتور ۵م تومان است، همهٔ فاکتورها با شبا/پل دریافت می‌شوند' : 'Since the minimum invoice is 5M Toman, all invoices are received via Sheba/card'} disabled={role !== 'OWNER'} />
          <F k="MIN_INVOICE_AMOUNT" label={lang === 'fa' ? 'حداقل مبلغ هر فاکتور (تومان — پیام ۱۲)' : 'Minimum invoice amount (Toman — msg 12)'} ltr hint={lang === 'fa' ? 'در صفحهٔ پرداخت به این سقف تعدیل می‌شود (پیش‌فرض ۵٬۰۰۰٬۰۰۰)' : 'Checkout adjusts up to this floor (default 5,000,000)'} disabled={role !== 'OWNER'} />
          <F k="PRICE_FRESH_FROM" label={lang === 'fa' ? 'مرز تازگی قیمت (ISO — پیام ۱۲)' : 'Price freshness cutoff (ISO — msg 12)'} ltr hint={lang === 'fa' ? 'فقط قیمت‌های بعد از این تاریخ معتبرند — 2026-11-01 معادل ۱۴۰۵/۰۸/۱۰' : 'Only prices dated after this ISO date are valid — 2026-11-01'} disabled={role !== 'OWNER'} />
          <F k="COURIER_FEE_SMALL" label={lang === 'fa' ? 'هزینهٔ ارسال و بسته‌بندی — کالای سبک (تومان)' : 'Courier fee — light goods (Toman)'} ltr hint={lang === 'fa' ? 'در صفحهٔ پرداخت به قیمت اضافه می‌شود (پیش‌فرض ۲۵۰٬۰۰۰)' : 'Added at checkout (default 250,000)'} disabled={role !== 'OWNER'} />
          <F k="COURIER_FEE_HEAVY" label={lang === 'fa' ? 'هزینهٔ ارسال و بسته‌بندی — کالای سنگین (تومان)' : 'Courier fee — heavy goods (Toman)'} ltr hint={lang === 'fa' ? 'یخچال، لباسشویی، تلویزیون، کولر، بخاری (پیش‌فرض ۷۵۰٬۰۰۰)' : 'Fridge/washer/TV/cooler/heater (default 750,000)'} disabled={role !== 'OWNER'} />
          <F k="REFERRAL_PERCENT" label={lang === 'fa' ? 'درصد تخفیف معرف' : 'Referral discount %'} ltr />
          <F k="REMOTE_FACTOR" label={lang === 'fa' ? 'ضریب از راه دور' : 'Remote factor'} ltr />
          <F k="EXPERT_SHARE_PCT" label={lang === 'fa' ? 'سهم کارشناس (٪ — پیش‌فرض ۱۸؛ حداقل ۱۶٫۵ یا بیشتر)' : 'Expert share (% — default 18; min 16.5 or more)'} ltr hint={lang === 'fa' ? 'پلن v3: سهم کارشناس از افزودنی پرداخت — ۱۶٫۵ تا ۲۰ درصد یا بیشتر (پلن ۳۳٪ حذف شد)' : 'Plan v3: expert share of checkout markup — 16.5 to 20% or more'} disabled={role !== 'OWNER'} />
          <F k="PLATFORM_MARGIN_PCT" label={lang === 'fa' ? 'افزایش قیمت پلتفرم (٪ — پیش‌فرض ۱۲؛ بین ۱۰ و ۱۶٫۵)' : 'Platform margin (% — default 12; between 10 and 16.5)'} ltr hint={lang === 'fa' ? 'پلن v3: مابقی افزودنی پرداخت — فقط در صفحهٔ پرداخت اعمال می‌شود' : 'Plan v3: the rest of the checkout markup — applied only at checkout'} disabled={role !== 'OWNER'} />
          <F k="SERVICE_MARKUP_PCT" label={lang === 'fa' ? 'پلن میز خدمات (٪ — پیش‌فرض ۳۳)' : 'Services counter plan (% — default 33)'} ltr hint={lang === 'fa' ? 'پلن ۳۳٪ فقط در میز خدمات باقی می‌ماند و از میز کالا حذف شده است' : 'The 33% plan stays only in the services counter; removed from goods'} disabled={role !== 'OWNER'} />
          <F k="TICK_SECRET" label={lang === 'fa' ? 'کلید کرن شبانه (/api/tick?key=…)' : 'Nightly cron key (/api/tick?key=…)'} ltr hint={lang === 'fa' ? 'هر شب با Task Scheduler این آدرس صدا زده شود تا گزارش قیمت روزانه و حسابرسی شبانه اجرا شود' : 'Call daily via scheduler for price report + nightly audit'} disabled={role !== 'OWNER'} />
          <div className="sm:col-span-2 flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-bold">{lang === 'fa' ? 'اتوماسیون رزرو/هماهنگی/پرداخت' : 'Booking/payment automation'}</p>
              <p className="text-[11px] text-muted-foreground">{lang === 'fa' ? 'فعلاً امور دستی توسط ادمین است؛ مالک با فعال‌سازی این گزینه و تأیید هماهنگی‌ها، آن‌ها را به اتوماسیون منتقل می‌کند.' : 'Manual until the owner enables it.'}</p>
            </div>
            <Checkbox
              checked={s.AUTOMATION_ENABLED === 'true'}
              disabled={role !== 'OWNER'}
              onCheckedChange={(v) => setS((prev) => (prev ? { ...prev, AUTOMATION_ENABLED: v ? 'true' : 'false' } : prev))}
              aria-label="automation"
            />
          </div>
          <div className="sm:col-span-2">
            <F k="ADMIN_PASSWORD" label={t('adminNewPass', lang)} ltr hint={lang === 'fa' ? 'رمز ورود مالک (owner) — حداقل ۶ کاراکتر؛ خالی = بدون تغییر' : 'Owner password — min 6 chars; empty = keep'} disabled={role !== 'OWNER'} />
          </div>
          <div className="sm:col-span-2">
            <Button className="w-full gap-2 font-bold" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              {t('saveSettings', lang)}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs font-semibold leading-6">
        {t('adminNoteSettled', lang)}
      </div>
    </div>
  );
}

// ═══ سفارش‌های محصولات ═════════════════════════════════
interface ProductOrderRow {
  id: string; code: string; qty: number; unitPrice: number; total: number;
  fullName: string; mobile: string; address: string; notes: string | null; status: string; createdAt: string;
  // پیام ۱۱:
  plaque: string | null; floor: string | null; unit: string | null; postalCode: string | null;
  leadTimeDays: string; paySheba: boolean;
  // پیام ۱۲: ریزدیسکی صفحهٔ پرداخت
  listTotal?: number; markupPct?: number; markupAmount?: number; courierFee?: number; minInvoiceAdj?: number;
  services: { id: string; title: string; price: number; qty: number }[];
  product: { nameFa: string; nameEn: string; icon: string };
}

const PO_STATUSES = ['PENDING', 'CONFIRMED', 'SENT', 'DELIVERED', 'CANCELLED'] as const;
const PO_FA: Record<string, string> = {
  PENDING: 'در انتظار بررسی', CONFIRMED: 'تأییدشده', SENT: 'ارسال‌شده', DELIVERED: 'تحویل‌شده', CANCELLED: 'لغوشده',
};
const PO_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  CONFIRMED: 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400',
  SENT: 'bg-primary/15 text-primary',
  DELIVERED: 'bg-emerald-700/20 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

function ProductOrdersTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [orders, setOrders] = useState<ProductOrderRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ orders: ProductOrderRow[]; totalSum: number; count: number }>('/api/admin/product-orders')
      .then((d) => setOrders(d.orders))
      .catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/product-orders`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      setOrders((os) => (os ?? []).map((o) => (o.id === id ? { ...o, status } : o)));
      toast.success(t('savedOk', lang));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="as-scroll mt-4 flex max-h-[80vh] flex-col gap-3 overflow-y-auto pe-1">
        {!orders ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />{t('loading', lang)}
          </div>
        ) : orders.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('noProductOrders', lang)}</p>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold tracking-wider" dir="ltr">{o.code}</span>
                    <Badge className={`text-[10px] ${PO_BADGE[o.status] ?? ''}`}>{t((`poStatus${o.status}`) as DictKey, lang)}</Badge>
                    <span className="text-sm font-bold">{isFa ? o.product.nameFa : o.product.nameEn}</span>
                    <span className="text-xs text-muted-foreground">×{faDigits(o.qty)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-primary">{money(o.total, lang)} {moneyLabel(lang)}</span>
                    <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)} disabled={busyId === o.id} dir={isFa ? 'rtl' : 'ltr'}>
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PO_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{PO_FA[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                  <span>{t('customerLbl', lang)}: {o.fullName} — <span dir="ltr" className="ltr-num">{o.mobile}</span></span>
                  <span className="truncate">{t('address', lang)}: {o.address}{o.plaque && ` — ${isFa ? 'پلاک' : 'No.'} ${o.plaque}${o.floor ? `، ${isFa ? 'طبقه' : 'fl.'} ${o.floor}` : ''}${o.unit ? `، ${isFa ? 'واحد' : 'unit'} ${o.unit}` : ''}${o.postalCode ? `، ${isFa ? 'کدپستی' : 'postal'} ${o.postalCode}` : ''}`}</span>
                  <span>{isFa ? 'بازهٔ رسیدگی' : 'Lead time'}: <b>{o.leadTimeDays}</b>{o.paySheba && <Badge className="ms-2 bg-amber-500 text-[9px]">{isFa ? 'دریافت با شبا/پل (≥۵م)' : 'Sheba payment'}</Badge>}</span>
                  {o.listTotal != null && o.listTotal > 0 && (
                    <span className="sm:col-span-2">
                      {isFa ? 'ریزدیسکی پرداخت' : 'Checkout breakdown'}: <b className="ltr-num" dir="ltr">{money(o.listTotal, lang)}</b> {isFa ? 'مرجع' : 'source'} · +{isFa ? faDigits(String(Math.round((o.markupPct ?? 0.30) * 100))) : Math.round((o.markupPct ?? 0.30) * 100)}٪ → <b className="ltr-num" dir="ltr">{money(o.markupAmount ?? 0, lang)}</b> · پیک <b className="ltr-num" dir="ltr">{money(o.courierFee ?? 0, lang)}</b>{(o.minInvoiceAdj ?? 0) > 0 && <> · {isFa ? 'تعدیل حداقل فاکتور' : 'min-invoice'} <b className="ltr-num" dir="ltr">+{money(o.minInvoiceAdj ?? 0, lang)}</b></>}
                    </span>
                  )}
                  {o.services?.length > 0 && <span className="sm:col-span-2">{isFa ? 'خدمات کنار خرید' : 'Add-ons'}: {o.services.map((s) => `${s.title} ×${s.qty} (${money(s.price, lang)})`).join('، ')}</span>}
                  {o.notes && <span className="sm:col-span-2">{t('needs', lang)}: {o.notes}</span>}
                  <span>{formatJalaliTime(new Date(o.createdAt))}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ═══ درخواست‌ها (سرمایه‌گذار + صندوق) ═══════════════════
interface InvestorRow {
  id: string; fullName: string; mobile: string; nationalId: string | null;
  amountRange: string; rangeLabel: string; message: string | null; status: string; createdAt: string;
}
interface FundRow {
  id: string; kind: string; fullName: string; mobile: string; category: string | null; categoryLabel: string | null;
  amount: number | null; message: string; status: string; createdAt: string;
}
const INV_STATUSES = ['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'] as const;
const FUND_STATUSES = ['NEW', 'CONTACTED', 'DONE', 'REJECTED'] as const;

function RequestsTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [investors, setInvestors] = useState<InvestorRow[] | null>(null);
  const [funds, setFunds] = useState<FundRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ investors: InvestorRow[]; funds: FundRow[] }>('/api/admin/requests')
      .then((d) => { setInvestors(d.investors); setFunds(d.funds); })
      .catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function patch(kind: 'INVESTOR' | 'FUND', id: string, status: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/requests`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, status }) });
      if (kind === 'INVESTOR') setInvestors((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, status } : r)));
      else setFunds((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(t('savedOk', lang));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'error');
    } finally {
      setBusyId(null);
    }
  }

  function statusSelect(kind: 'INVESTOR' | 'FUND', id: string, current: string, list: readonly string[], busy: boolean) {
    return (
      <Select value={current} onValueChange={(v) => patch(kind, id, v)} disabled={busy} dir={isFa ? 'rtl' : 'ltr'}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {list.map((s) => (
            <SelectItem key={s} value={s}>{t((kind === 'INVESTOR' ? `invSt${s}` : `fundSt${s}`) as DictKey, lang)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* سرمایه‌گذاران */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-extrabold"><CircleDollarSign className="h-4 w-4 text-primary" />{t('investorsList', lang)}</h3>
        <div className="as-scroll mt-2 flex max-h-96 flex-col gap-2 overflow-y-auto pe-1">
          {!investors ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading', lang)}</div>
          ) : investors.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t('noRequests', lang)}</p>
          ) : (
            investors.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{r.fullName}</span>
                      <span dir="ltr" className="ltr-num text-xs text-muted-foreground">{r.mobile}</span>
                      {r.nationalId && <span dir="ltr" className="ltr-num text-xs text-muted-foreground">{r.nationalId}</span>}
                      <Badge variant="secondary" className="text-[10px]">{r.rangeLabel}</Badge>
                    </div>
                    {statusSelect('INVESTOR', r.id, r.status, INV_STATUSES, busyId === r.id)}
                  </div>
                  {r.message && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{r.message}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground/70">{formatJalaliTime(new Date(r.createdAt))}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* صندوق حمایت */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-extrabold"><HandHeart className="h-4 w-4 text-primary" />{t('fundsList', lang)}</h3>
        <div className="as-scroll mt-2 flex max-h-96 flex-col gap-2 overflow-y-auto pe-1">
          {!funds ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading', lang)}</div>
          ) : funds.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t('noRequests', lang)}</p>
          ) : (
            funds.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t(r.kind === 'SUPPORT' ? 'kindSupport' : 'kindContribute', lang)}</Badge>
                      <span className="text-sm font-bold">{r.fullName}</span>
                      <span dir="ltr" className="ltr-num text-xs text-muted-foreground">{r.mobile}</span>
                      {r.categoryLabel && <Badge variant="secondary" className="text-[10px]">{r.categoryLabel}</Badge>}
                      {r.amount ? <span className="text-xs font-bold text-primary">{money(r.amount, lang)} {moneyLabel(lang)}</span> : null}
                    </div>
                    {statusSelect('FUND', r.id, r.status, FUND_STATUSES, busyId === r.id)}
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{r.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">{formatJalaliTime(new Date(r.createdAt))}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ═══ ریز جزئیات درخواستی (پیام ۱۰) ═════════════════════════
interface DetailReqRow {
  id: string; serviceKey: string; serviceName: string; name: string;
  price: number | null; contact: string; note: string | null; status: string; createdAt: string;
}

function reqStatusBadgeClass(status: string): string {
  if (status === 'PENDING') return 'border-amber-500/50 text-amber-600 dark:text-amber-400';
  if (status === 'APPROVED' || status === 'NEW' || status === 'DONE') return 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400';
  return 'border-rose-500/50 text-rose-600 dark:text-rose-400';
}

function reqStatusLabel(status: string, lang: 'fa' | 'en'): string {
  if (status === 'PENDING') return t('stPending', lang);
  if (status === 'APPROVED') return t('stApproved', lang);
  if (status === 'REJECTED') return t('stRejected', lang);
  return status;
}

function DetailRequestsTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [items, setItems] = useState<DetailReqRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ items: DetailReqRow[] }>('/api/admin/detail-requests').then((d) => setItems(d.items)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function decide(id: string, action: 'APPROVE' | 'REJECT') {
    setBusyId(id);
    try {
      const d = await api<{ message: string }>('/api/admin/detail-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      toast.success(d.message);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold">{t('adminTabDetailReq', lang)}</h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />{isFa ? 'بازخوانی' : 'Refresh'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{isFa ? 'درخواست «[+] افزودن ریز جزئیات» مشتریان — تأیید = افزودن دائمی به کاتالوگ.' : 'Customer "[+] Add fine detail" requests — approve = permanent catalog addition.'}</p>
      {!items ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{t('loading', lang)}</div>
      ) : items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{t('noRequests', lang)}</p>
      ) : (
        items.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className={reqStatusBadgeClass(r.status)}>{reqStatusLabel(r.status, lang)}</Badge>
                <span className="font-bold">{r.name}</span>
                <span className="text-xs text-muted-foreground">→ {r.serviceName}</span>
                {r.price != null && r.price > 0 && <span className="text-xs font-bold text-primary">{money(r.price, lang)} {moneyLabel(lang)}</span>}
                <span className="ms-auto text-xs text-muted-foreground ltr-num" dir="ltr">{r.contact}</span>
              </div>
              {r.note && <p className="text-xs leading-5 text-muted-foreground">{r.note}</p>}
              <p className="text-[10px] text-muted-foreground/70">{formatJalaliTime(new Date(r.createdAt))}</p>
              {r.status === 'PENDING' && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-1.5" disabled={busyId === r.id} onClick={() => decide(r.id, 'APPROVE')}>
                    <CheckCheck className="h-3.5 w-3.5" />{t('approveBtn', lang)}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={busyId === r.id} onClick={() => decide(r.id, 'REJECT')}>
                    <XCircle className="h-3.5 w-3.5" />{t('rejectBtn', lang)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ═══ اصلاح قیمت‌ها: کارشناس پیشنهاد → تأیید پشتیبانی (پیام ۱۰) ═══
interface PriceReqRow {
  id: string; targetType: string; serviceKey: string; serviceName: string;
  oldPrice: number; newPrice: number; reason: string | null; proposedBy: string; status: string; createdAt: string;
}

function PriceRequestsTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [items, setItems] = useState<PriceReqRow[] | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [parts, setParts] = useState<{ key: string; nameFa: string; basePrice: number }[]>([]);
  const [target, setTarget] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ items: PriceReqRow[] }>('/api/admin/price-requests').then((d) => setItems(d.items)).catch((e) => toast.error(e.message));
    api<{ services: ServiceRow[] }>('/api/admin/pricing')
      .then((d) => setServices((d.services ?? []).filter((s) => s.percentValue == null && !s.isMisc)))
      .catch(() => {});
    api<{ parts: { key: string; nameFa: string; basePrice: number }[] }>('/api/admin/parts').then((d) => setParts(d.parts ?? [])).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const currentPrice = useMemo(() => {
    if (target.startsWith('S:')) return services.find((s) => s.key === target.slice(2))?.baseRate ?? null;
    if (target.startsWith('P:')) return parts.find((p) => p.key === target.slice(2))?.basePrice ?? null;
    return null;
  }, [target, services, parts]);

  async function propose() {
    if (!target || !newPrice.trim()) return;
    setBusy(true);
    try {
      const targetType = target.startsWith('P:') ? 'PART' : 'SERVICE';
      const key = target.slice(2);
      const d = await api<{ message: string }>('/api/price-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, key, newPrice: Number(newPrice.replace(/\D/g, '')), reason: reason.trim() || null }),
      });
      toast.success(d.message);
      setNewPrice('');
      setReason('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, action: 'APPROVE' | 'REJECT') {
    setBusyId(id);
    try {
      const d = await api<{ message: string }>('/api/admin/price-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      toast.success(d.message);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* فرم پیشنهاد کارشناس */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-extrabold">{t('proposeFix', lang)}</h2>
          <p className="text-xs text-muted-foreground">{t('proposeNote', lang)}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>{t('selectTarget', lang)}</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue placeholder={isFa ? 'انتخاب کنید' : 'Select'} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground">{isFa ? 'خدمات' : 'Services'}</div>
                  {services.map((s) => (
                    <SelectItem key={`s-${s.key}`} value={`S:${s.key}`}>{svcName(s, lang)} — {money(s.baseRate, lang)}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground">{isFa ? 'قطعات' : 'Parts'}</div>
                  {parts.map((p) => (
                    <SelectItem key={`p-${p.key}`} value={`P:${p.key}`}>{isFa ? p.nameFa : p.nameFa} — {money(p.basePrice, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('expertNewPrice', lang)} ({moneyLabel(lang)})</Label>
              <Input className="ltr-num text-start" dir="ltr" inputMode="numeric" value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ''))} disabled={!target} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('expertReason', lang)}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!target} />
            </div>
          </div>
          {currentPrice != null && (
            <p className="text-xs font-semibold text-muted-foreground">
              {t('oldPriceLbl', lang)}: <span className="ltr-num" dir="ltr">{money(currentPrice, lang)} {moneyLabel(lang)}</span>
            </p>
          )}
          <Button size="sm" className="font-bold" disabled={busy || !target || !newPrice.trim()} onClick={propose}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}
            {t('proposeFix', lang)}
          </Button>
        </CardContent>
      </Card>

      {/* فهرست پیشنهادها */}
      <div className="space-y-3">
        <h3 className="font-extrabold">{isFa ? 'پیشنهادها و وضعیت تأیید' : 'Proposals & approval status'}</h3>
        {!items ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{t('loading', lang)}</div>
        ) : items.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">{t('noRequests', lang)}</p>
        ) : (
          items.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className={reqStatusBadgeClass(r.status)}>{reqStatusLabel(r.status, lang)}</Badge>
                  <span className="font-bold">{r.serviceName}</span>
                  <span className="text-xs text-muted-foreground ltr-num" dir="ltr">
                    {money(r.oldPrice, lang)} → <span className="font-bold text-primary">{money(r.newPrice, lang)}</span>
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{r.targetType === 'PART' ? (isFa ? 'قطعه' : 'Part') : isFa ? 'خدمت' : 'Service'}</Badge>
                </div>
                {r.reason && <p className="text-xs leading-5 text-muted-foreground">{r.reason}</p>}
                <p className="text-[10px] text-muted-foreground/70">{formatJalaliTime(new Date(r.createdAt))}</p>
                {r.status === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5" disabled={busyId === r.id} onClick={() => decide(r.id, 'APPROVE')}>
                      <CheckCheck className="h-3.5 w-3.5" />{t('approveBtn', lang)}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={busyId === r.id} onClick={() => decide(r.id, 'REJECT')}>
                      <XCircle className="h-3.5 w-3.5" />{t('rejectBtn', lang)}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ═══ قطعات (پیام ۱۰) ═══════════════════════════════════════
interface PartRow { key: string; nameFa: string; nameEn: string; category: string; basePrice: number; active: boolean }

function PartsTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [parts, setParts] = useState<PartRow[] | null>(null);
  const [editPrice, setEditPrice] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ parts: PartRow[] }>('/api/admin/parts').then((d) => setParts(d.parts)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function save(key: string, patch: { basePrice?: number; active?: boolean }) {
    setBusyKey(key);
    try {
      await api('/api/admin/parts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...patch }),
      });
      toast.success(isFa ? 'ذخیره شد' : 'Saved');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'error');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold">{t('adminTabParts', lang)}</h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />{isFa ? 'بازخوانی' : 'Refresh'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{isFa ? 'قیمت پایهٔ هر قطعه را اصلاح کنید (در سفارش مشتری، ضریب نرخ روز تقویمی روی آن اعمال می‌شود). همچنین در تب «اصلاح قیمت‌ها» می‌توانید اصلاح قیمت با تأیید پشتیبانی ثبت کنید.' : 'Edit each part base price (the calendar day-rate factor is applied at checkout). You can also submit support-approved price fixes in the "Price fixes" tab.'}</p>
      {!parts ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{t('loading', lang)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((p) => (
            <Card key={p.key} className={p.active ? '' : 'opacity-60'}>
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm truncate">{isFa ? p.nameFa : p.nameEn || p.nameFa}</p>
                  <Badge variant={p.active ? 'secondary' : 'outline'} className="text-[10px]">{p.active ? (isFa ? 'فعال' : 'Active') : isFa ? 'غیرفعال' : 'Inactive'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground ltr-num" dir="ltr">
                  {t('oldPriceLbl', lang)}: {money(p.basePrice, lang)} {moneyLabel(lang)}
                </p>
                <div className="flex gap-1.5">
                  <Input
                    className="h-8 ltr-num text-start text-xs"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder={t('partBasePrice', lang)}
                    value={editPrice[p.key] ?? ''}
                    onChange={(e) => setEditPrice((s) => ({ ...s, [p.key]: e.target.value.replace(/\D/g, '') }))}
                  />
                  <Button size="sm" variant="secondary" className="h-8 shrink-0" disabled={busyKey === p.key || !editPrice[p.key]} onClick={() => save(p.key, { basePrice: Number(editPrice[p.key]) })}>
                    {busyKey === p.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isFa ? 'ذخیره' : 'Save'}
                  </Button>
                </div>
                <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled={busyKey === p.key} onClick={() => save(p.key, { active: !p.active })}>
                  {p.active ? (isFa ? 'غیرفعال‌سازی' : 'Deactivate') : isFa ? 'فعال‌سازی' : 'Activate'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
