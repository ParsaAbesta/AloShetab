'use client';

// ─── پیام ۱۱: تب‌های جدید پنل مدیریتی ────────────────────────
// موجودی کالا، انبارها، گزارش روزانهٔ قیمت، پیشنهاد قیمت، مراحل فاکتور،
// هماهنگی‌ها → اتوماسیون، حسابدار هوشمند، دستیار هوشمند
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, RefreshCw, Package, Warehouse as WarehouseIcon, Phone, Globe, MapPin,
  Link2, ShieldCheck, ShieldAlert, CalendarDays, ReceiptText, Plus, CheckCircle2, XCircle,
  Send, TrendingUp, Building2, MessageSquareText, ListChecks, Store as StoreIcon,
} from 'lucide-react';
import { useAs } from './store';
import { money, faDigits } from './util';
import { formatJalaliTime } from '@/lib/jalali';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { message?: string }).message ?? 'خطا');
  return d as T;
}

function post<T = { ok: boolean }>(url: string, body: unknown) {
  return api<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

// ═══ موجودی کالا (میز کالا + نرم‌افزار) ═══════════════════
interface InvProduct {
  id: string; key: string; nameFa: string; nameEn: string; descFa: string;
  section: string; category: string; brand: string | null; model: string | null;
  price: number; basePrice: number; baseSource: string | null; sourceUrl: string | null;
  refPrice: number | null; refSource: string | null; priceRule: string; priceStatus: string;
  priceDate: string | null; stock: number; active: boolean; warranty: string | null;
  warehouse: { nameFa: string; website: string | null; phone: string | null; address: string | null; verified: boolean; priceListFresh: boolean } | null;
  priceProposals: { id: string; newPrice: number }[];
  offersSummary?: {
    count: number;
    storeCount: number;
    warehouseCount: number;
    sellBase: number | null;
    sellBaseStore: string | null;
    buyTarget: number | null;
    buyTargetStore: string | null;
    freshestStock: number | null;
    freshestStockWarehouse: string | null;
    freshestShamsi: string | null;
    expertPct: number;
    platformPct: number;
  };
}

export function InventoryTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [items, setItems] = useState<InvProduct[] | null>(null);
  const [section, setSection] = useState('GOODS');
  const [busyId, setBusyId] = useState('');
  const [priceDlg, setPriceDlg] = useState<InvProduct | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [addDlg, setAddDlg] = useState(false);
  const [offersDlg, setOffersDlg] = useState<InvProduct | null>(null);

  const load = useCallback(() => {
    api<{ products: InvProduct[] }>(`/api/admin/inventory?section=${section === 'ALL' ? '' : section}`)
      .then((d) => setItems(d.products))
      .catch((e) => toast.error(e.message));
  }, [section]);
  useEffect(load, [load]);

  async function act(body: Record<string, unknown>, msg: string, id = '') {
    setBusyId(id);
    try {
      await post('/api/admin/inventory', body);
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="GOODS">{isFa ? 'میز کالا' : 'Goods'}</SelectItem>
            <SelectItem value="SOFTWARE">{isFa ? 'نرم‌افزار' : 'Software'}</SelectItem>
            <SelectItem value="ALL">{isFa ? 'همه' : 'All'}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" />{isFa ? 'بروزرسانی' : 'Refresh'}</Button>
        <Button size="sm" onClick={() => setAddDlg(true)}><Plus className="h-4 w-4" />{isFa ? 'افزودن کالا/نرم‌افزار' : 'Add item'}</Button>
        <p className="text-xs text-muted-foreground">
          {isFa ? 'پلن v3 (پیام ۱۴): پایهٔ فروش = گران‌ترین فروشگاه | خرید از ارزان‌ترین انبار | موجودی فقط از بروزترین انبار. افزودنی پرداخت = سهم کارشناس (۱۶٫۵–۲۰٪+) + افزایش قیمت پلتفرم (۱۰–۱۶٫۵٪) + پیک — فقط در صفحهٔ پرداخت؛ حداقل فاکتور ۵٬۰۰۰٬۰۰۰ تومان. فقط قیمت‌های بعد از ۱۴۰۵/۰۸/۱۰ نمایش داده می‌شوند.' : 'Plan v3: sell base = priciest store | buy from cheapest warehouse | stock only from freshest quote. Checkout markup = expert share (16.5–20%+) + platform margin (10–16.5%) + courier — only at checkout; 5M Toman minimum invoice. Only prices dated after 1405/08/10 are shown.'}
        </p>
      </div>

      {!items ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="h-4.5 w-4.5" /></span>
                  <div className="min-w-40">
                    <p className="text-sm font-bold">{p.nameFa}</p>
                    <p className="text-[11px] text-muted-foreground">{p.section === 'GOODS' ? (isFa ? 'کالا' : 'Goods') : (isFa ? 'نرم‌افزار' : 'Software')} · {p.category}{p.brand ? ` · ${p.brand}` : ''}</p>
                  </div>
                  <div className="text-xs text-muted-foreground ltr-num" dir="ltr">
                    <p className="font-extrabold text-primary text-sm">{money(p.price, lang)}</p>
                    <p>{isFa ? 'پایهٔ فروش' : 'Sell base'}: {money(p.price, lang)}{p.basePrice ? ` | ${isFa ? 'انبار/خرید' : 'warehouse/buy'}: ${money(p.basePrice, lang)}` : ''}{p.refPrice ? ` | ${isFa ? 'مرجع' : 'ref'}: ${money(p.refPrice, lang)}` : ''}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {p.priceRule === 'MANUAL' ? (isFa ? 'قیمت دستی' : 'manual') : (isFa ? 'پلن v3: کارشناس + پلتفرم' : 'Plan v3: expert + platform')}
                  </Badge>
                  {p.priceDate && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{faDigits(p.priceDate)}</span>
                  )}
                  {!p.priceDate && (
                    <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-600">{isFa ? 'قیمت کهنه — نیاز به استعلام تازهٔ انبار (بعد از ۱۴۰۵/۰۸/۱۰)' : 'stale price — needs fresh warehouse quote'}</Badge>
                  )}
                  {p.baseSource && <span className="text-[10px] text-muted-foreground">{isFa ? 'مرجع' : 'src'}: {p.baseSource}</span>}
                  <Badge variant="secondary" className="text-[10px]">
                    {isFa ? 'موجودی' : 'stock'}: {faDigits(p.offersSummary?.freshestStock ?? p.stock)}
                    {p.offersSummary?.freshestStockWarehouse ? ` · ${p.offersSummary.freshestStockWarehouse}` : ''}
                  </Badge>
                  {p.offersSummary && p.offersSummary.warehouseCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">{isFa ? `بروزترین قیمت از ${faDigits(p.offersSummary.warehouseCount)} انبار` : `${p.offersSummary.warehouseCount} warehouses`}</Badge>
                  )}
                  {!p.active && <Badge variant="outline" className="text-[10px] text-destructive">{isFa ? 'غیرفعال' : 'inactive'}</Badge>}
                  {p.priceStatus === 'FROZEN' && <Badge className="bg-amber-500 text-[10px]">{isFa ? 'در بررسی قیمت' : 'price review'}</Badge>}
                  <div className="ms-auto flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setOffersDlg(p)}>
                      <StoreIcon className="h-3.5 w-3.5" />{isFa ? 'فروشگاه‌ها و قیمت‌ها' : 'Stores & offers'}
                      {p.offersSummary && p.offersSummary.count > 0 && (
                        <Badge variant="secondary" className="ms-1 px-1.5 text-[9px]">{faDigits(p.offersSummary.count)}</Badge>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPriceDlg(p); setNewPrice(String(p.price)); setReason(''); }}>
                      <TrendingUp className="h-3.5 w-3.5" />{isFa ? 'اصلاح قیمت کارشناس' : 'Expert price fix'}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => act({ action: 'patch', productId: p.id, active: !p.active }, isFa ? 'وضعیت تغییر کرد' : 'Updated', p.id)}>
                      {p.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {p.active ? (isFa ? 'غیرفعال' : 'Disable') : (isFa ? 'فعال' : 'Enable')}
                    </Button>
                  </div>
                </div>
                {p.priceProposals.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    <p className="font-bold text-amber-700 dark:text-amber-400">{isFa ? 'پیشنهاد قیمت در انتظار تأیید پشتیبانی:' : 'Price proposal pending support approval:'}</p>
                    {p.priceProposals.map((pr) => (
                      <div key={pr.id} className="mt-1.5 flex items-center gap-2">
                        <span className="ltr-num" dir="ltr">{money(p.price, lang)} ← {money(pr.newPrice, lang)}</span>
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => act({ action: 'decide-proposal', proposalId: pr.id, approve: true }, isFa ? 'تأیید و اعمال شد' : 'Applied', pr.id)}>{isFa ? 'تأیید و اعمال' : 'Approve & apply'}</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => act({ action: 'decide-proposal', proposalId: pr.id, approve: false }, isFa ? 'رد شد' : 'Rejected', pr.id)}>{isFa ? 'رد' : 'Reject'}</Button>
                      </div>
                    ))}
                  </div>
                )}
                {p.warehouse && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3">
                    <span className="flex items-center gap-1"><WarehouseIcon className="h-3 w-3" />{p.warehouse.nameFa}</span>
                    {p.warehouse.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /><span dir="ltr" className="ltr-num">{p.warehouse.phone}</span></span>}
                    {p.warehouse.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /><span dir="ltr">{p.warehouse.website}</span></span>}
                    {p.warehouse.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.warehouse.address}</span>}
                    <Badge variant={p.warehouse.verified ? 'default' : 'outline'} className="text-[9px]">{p.warehouse.verified ? (isFa ? 'تأییدشده' : 'verified') : (isFa ? 'نیاز به تأیید' : 'unverified')}</Badge>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* دیالوگ اصلاح قیمت کارشناس */}
      <Dialog open={!!priceDlg} onOpenChange={(v) => !v && setPriceDlg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isFa ? 'اصلاح قیمت (کارشناس)' : 'Expert price correction'}</DialogTitle>
            <DialogDescription className="text-start text-xs leading-6">
              {isFa ? 'در صورت ناهمخوانی قیمت با بازار، کارشناس قیمت صحیح را پیشنهاد می‌دهد؛ پس از تأیید پشتیبانی، قیمت جایگزین می‌شود.' : 'The expert proposes the correct price; support approval replaces it.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-bold">{priceDlg?.nameFa} — <span className="ltr-num" dir="ltr">{money(priceDlg?.price ?? 0, lang)}</span></p>
            <div className="flex flex-col gap-1.5">
              <Label>{isFa ? 'قیمت صحیح (تومان)' : 'Correct price (Toman)'}</Label>
              <Input dir="ltr" className="ltr-num" value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{isFa ? 'دلیل (ناهمخوانی با بازار و...)' : 'Reason'}</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={busyId !== ''}
              onClick={() => priceDlg && act({ action: 'propose-price', productId: priceDlg.id, newPrice: parseInt(newPrice, 10) || 0, reason: reason || null }, isFa ? 'پیشنهاد ثبت شد — در انتظار تأیید پشتیبانی' : 'Proposal submitted', priceDlg.id).then(() => setPriceDlg(null))}
            >
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {isFa ? 'ثبت پیشنهاد' : 'Submit proposal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddProductDialog open={addDlg} onOpenChange={setAddDlg} lang={lang} onDone={() => { setAddDlg(false); load(); }} />
      <OffersDialog product={offersDlg} onClose={() => setOffersDlg(null)} lang={lang} onChanged={load} />
    </div>
  );
}

// ═══ پیام ۱۳: دیالوگ فروشگاه‌ها و پیشنهادهای قیمت ══════════
interface OfferRow {
  id: string; storeId: string | null; storeName: string; side: string; offeredPrice: number; negotiatedPrice: number | null; stockQty: number | null;
  sourceUrl: string | null; fetchedShamsi: string; source: string; active: boolean; note: string | null;
  store?: { id: string; nameFa: string; website: string | null; feedType: string } | null;
}
interface OfferProductInfo {
  id: string; key: string; nameFa: string; price: number; basePrice: number; refPrice: number | null; priceRule: string; priceDate: string | null; section: string;
}

export function OffersDialog({ product, onClose, lang, onChanged }: { product: InvProduct | null; onClose: () => void; lang: 'fa' | 'en'; onChanged: () => void }) {
  const isFa = lang === 'fa';
  const [data, setData] = useState<{ product: OfferProductInfo; offers: OfferRow[]; policy: OfferPolicyLite; stores: { id: string; nameFa: string; feedType: string }[]; warehouses: { id: string; nameFa: string }[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [offerSide, setOfferSide] = useState<'STORE' | 'WAREHOUSE'>('STORE');
  const [sourcePick, setSourcePick] = useState('');
  const [storeName, setStoreName] = useState('');
  const [offered, setOffered] = useState('');
  const [negotiated, setNegotiated] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [offerNote, setOfferNote] = useState('');

  const load = useCallback(() => {
    if (!product) return;
    api<{ product: OfferProductInfo; offers: OfferRow[]; policy: OfferPolicyLite; stores: { id: string; nameFa: string; feedType: string }[]; warehouses: { id: string; nameFa: string }[] }>(`/api/admin/offers?productId=${product.id}`)
      .then((d) => setData(d))
      .catch((e) => toast.error(e.message));
  }, [product]);
  useEffect(() => {
    if (product) { load(); setStoreName(''); setOffered(''); setNegotiated(''); setStockQty(''); setSrcUrl(''); setOfferDate(''); setOfferNote(''); setSourcePick(''); setOfferSide('STORE'); }
    else setData(null);
  }, [product, load]);

  async function act(body: Record<string, unknown>, msg: string, key = 'x') {
    setBusy(key);
    try {
      const d = await post<{ ok?: boolean; result?: { status: string; message: string } }>('/api/admin/offers', body);
      if (d.result && d.result.status) toast.success(`${d.result.status} — ${d.result.message}`);
      else toast.success(msg);
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy('');
    }
  }

  async function syncLive(storeId: string) {
    if (!product) return;
    setBusy(`live-${storeId}`);
    try {
      const d = await post<{ ok: boolean; result: { status: string; message: string } }>('/api/admin/stores', { action: 'sync-product', productId: product.id, storeId });
      if (d.ok) toast.success(`${isFa ? 'قیمت لحظه‌ای ثبت شد' : 'live price saved'} — ${d.result.message}`);
      else toast.error(`${d.result.status} — ${d.result.message}`);
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy('');
    }
  }

  const p = data?.policy;
  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto as-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StoreIcon className="h-5 w-5 text-primary" />
            {isFa ? 'فروشگاه‌ها و انبارهای کالا' : 'Stores & warehouses'} — {product?.nameFa}
          </DialogTitle>
          <DialogDescription className="text-start text-xs leading-6">
            {isFa
              ? 'پلن v3 (پیام ۱۴): فروش به قیمت گران‌ترین فروشگاه | خرید از ارزان‌ترین انبار | موجودی فقط از بروزترین انبار. افزودنی پرداخت = سهم کارشناس + افزایش قیمت پلتفرم (پلن ۳۳٪ حذف شد).'
              : 'Plan v3: sell at the priciest store | buy from the cheapest warehouse | stock only from the freshest quote. Checkout markup = expert share + platform margin.'}
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {/* خلاصهٔ سیاست پلن v3 */}
            {p && (p.storeCount > 0 || p.warehouseCount > 0) ? (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-3 text-xs">
                <div>
                  <p className="text-muted-foreground">{isFa ? 'فروش — گران‌ترین فروشگاه' : 'Sell — priciest store'}</p>
                  <p className="font-extrabold text-primary ltr-num" dir="ltr">{money(p.sellBase ?? 0, lang)}</p>
                  <p className="text-[10px] text-muted-foreground">{p.sellBaseStore} · {isFa ? `${faDigits(p.storeCount)} فروشگاه` : `${p.storeCount} stores`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isFa ? 'خرید/تأمین — ارزان‌ترین انبار (محرمانه)' : 'Buy — cheapest warehouse (internal)'}</p>
                  <p className="font-extrabold ltr-num" dir="ltr">{money(p.buyTarget ?? 0, lang)}</p>
                  <p className="text-[10px] text-muted-foreground">{p.buyTargetStore} · {isFa ? `${faDigits(p.warehouseCount)} انبار` : `${p.warehouseCount} warehouses`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isFa ? 'موجودی — فقط از بروزترین انبار' : 'Stock — freshest warehouse only'}</p>
                  <p className="font-bold">{p.freshestStock != null ? `${faDigits(p.freshestStock)} ${isFa ? 'عدد' : 'pcs'}` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">{p.freshestStockWarehouse ?? ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isFa ? 'حاشیهٔ ناخالص بازار (داخلی)' : 'Market margin (internal)'}</p>
                  <p className="font-bold ltr-num" dir="ltr">{money(p.margin ?? 0, lang)}</p>
                  <p className="text-[10px] text-muted-foreground">{isFa ? `افزودنی پرداخت: کارشناس ${faDigits(String(Math.round(p.expertPct * 100)))}٪ + پلتفرم ${faDigits(String(Math.round(p.platformPct * 100)))}٪` : `markup: expert ${Math.round(p.expertPct * 100)}% + platform ${Math.round(p.platformPct * 100)}%`}</p>
                </div>
                {/* لیست بروزترین قیمت انبارها */}
                {p.warehousePrices.length > 0 && (
                  <div className="col-span-2 rounded-lg bg-secondary/50 p-2">
                    <p className="mb-1 font-bold">{isFa ? 'لیست بروزترین قیمت بروزترین انبارها (ارزان‌ترین اول):' : 'Latest warehouse prices (cheapest first):'}</p>
                    {p.warehousePrices.map((w, i) => (
                      <p key={`${w.name}-${i}`} className="flex items-center justify-between gap-2 text-[11px]">
                        <span>{i === 0 && <Badge className="me-1 px-1 py-0 text-[8px]" variant="default">{isFa ? 'خرید' : 'buy'}</Badge>}{w.name}</span>
                        <span className="ltr-num" dir="ltr">{money(w.price, lang)}{w.stockQty != null ? ` · ${isFa ? `موجودی ${faDigits(w.stockQty)}` : `stock ${w.stockQty}`}` : ''}{w.shamsi ? ` · ${faDigits(w.shamsi)}` : ''}</span>
                      </p>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  className="col-span-2"
                  disabled={busy !== ''}
                  onClick={() => act({ action: 'apply-policy', productId: data.product.id }, isFa ? 'سیاست اعمال شد — پایهٔ فروش = گران‌ترین فروشگاه' : 'Policy applied', 'apply')}
                >
                  {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isFa ? `اعمال پلن v3: پایهٔ فروش ← ${money(p.sellBase ?? 0, lang)} تومان` : `Apply plan v3: sell base ← ${money(p.sellBase ?? 0, lang)}`}
                </Button>
              </div>
            ) : (
              <p className="rounded-lg bg-secondary/60 p-2.5 text-xs text-muted-foreground">{isFa ? 'هنوز استعلامی ثبت نشده — استعلام فروشگاه (پایهٔ فروش) و انبار (خرید + موجودی) ثبت کنید.' : 'No quotes yet — add a store offer (sell base) and a warehouse quote (buy + stock).'}</p>
            )}

            {/* فهرست پیشنهادها */}
            <div className="space-y-1.5">
              {data.offers.length === 0 && <p className="text-xs text-muted-foreground">{isFa ? 'پیشنهادی نیست.' : 'No offers.'}</p>}
              {data.offers.map((o) => (
                <div key={o.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border p-2 text-xs ${o.active ? '' : 'opacity-50'}`}>
                  {o.side === 'WAREHOUSE' ? <WarehouseIcon className="h-3.5 w-3.5 text-primary" /> : <StoreIcon className="h-3.5 w-3.5 text-primary" />}
                  <span className="font-bold">{o.storeName}</span>
                  <Badge variant="outline" className="text-[9px]">{o.side === 'WAREHOUSE' ? (isFa ? 'انبار' : 'warehouse') : (isFa ? 'فروشگاه' : 'store')}</Badge>
                  <Badge variant="outline" className="text-[9px]">{o.source === 'LIVE_FEED' ? (isFa ? 'لحظه‌ای' : 'live') : (isFa ? 'دستی' : 'manual')}</Badge>
                  <span className="ltr-num" dir="ltr">{isFa ? 'قیمت' : 'price'}: <b>{money(o.offeredPrice, lang)}</b></span>
                  {o.stockQty != null && <span className="ltr-num" dir="ltr">{isFa ? 'موجودی' : 'stock'}: <b>{faDigits(o.stockQty)}</b></span>}
                  {o.negotiatedPrice != null && <span className="ltr-num" dir="ltr">{isFa ? 'توافقی' : 'negotiated'}: <b>{money(o.negotiatedPrice, lang)}</b></span>}
                  <span className="text-[10px] text-muted-foreground">{faDigits(o.fetchedShamsi)}</span>
                  {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline" dir="ltr">link</a>}
                  {o.active && (
                    <Button size="sm" variant="ghost" className="ms-auto h-6 text-[10px]" disabled={busy !== ''} onClick={() => act({ action: 'deactivate', offerId: o.id }, isFa ? 'غیرفعال شد' : 'Deactivated', o.id)}>
                      <XCircle className="h-3 w-3" />{isFa ? 'غیرفعال' : 'Disable'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* دریافت لحظه‌ای از فروشگاه‌های متصل */}
            {data.stores.some((s) => s.feedType !== 'NONE') && (
              <div className="rounded-lg border border-dashed border-primary/40 p-2.5">
                <p className="mb-1.5 text-xs font-bold">{isFa ? 'اتصال لحظه‌ای (سایت نوسان قیمت)' : 'Live feeds'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.stores.filter((s) => s.feedType !== 'NONE').map((s) => (
                    <Button key={s.id} size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy !== ''} onClick={() => syncLive(s.id)}>
                      {busy === `live-${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      {s.nameFa}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* ثبت استعلام دستی — فروشگاه (پایهٔ فروش) یا انبار (خرید + موجودی) */}
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-xs font-bold">{isFa ? 'ثبت استعلام تازه (قیمت‌ها فقط از بروزترین‌ها)' : 'Add fresh quote'}</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant={offerSide === 'STORE' ? 'default' : 'outline'} className="h-8 text-[11px]" onClick={() => { setOfferSide('STORE'); setStockQty(''); }}>
                  <StoreIcon className="h-3 w-3" />{isFa ? 'فروشگاه — پایهٔ فروش' : 'Store — sell base'}
                </Button>
                <Button size="sm" variant={offerSide === 'WAREHOUSE' ? 'default' : 'outline'} className="h-8 text-[11px]" onClick={() => { setOfferSide('WAREHOUSE'); }}>
                  <WarehouseIcon className="h-3 w-3" />{isFa ? 'انبار — خرید + موجودی' : 'Warehouse — buy + stock'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">{offerSide === 'STORE' ? (isFa ? 'فروشگاه ثبت‌شده' : 'Registered store') : (isFa ? 'انبار ثبت‌شده' : 'Registered warehouse')}</Label>
                  <Select value={sourcePick || 'free'} onValueChange={(v) => { setSourcePick(v === 'free' ? '' : v); if (v !== 'free') { const s = offerSide === 'STORE' ? data.stores.find((x) => x.id === v) : data.warehouses.find((x) => x.id === v); if (s) setStoreName(s.nameFa); } }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">{isFa ? 'نام آزاد…' : 'Free name…'}</SelectItem>
                      {(offerSide === 'STORE' ? data.stores.map((s) => ({ id: s.id, nameFa: s.nameFa })) : data.warehouses).map((s) => <SelectItem key={s.id} value={s.id}>{s.nameFa}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">{offerSide === 'STORE' ? (isFa ? 'نام فروشگاه *' : 'Store name *') : (isFa ? 'نام انبار *' : 'Warehouse name *')}</Label>
                  <Input className="h-8" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">{offerSide === 'STORE' ? (isFa ? 'قیمت ارائه‌شده (تومان) *' : 'Offered price *') : (isFa ? 'قیمت انبار (تومان) *' : 'Warehouse price *')}</Label>
                  <Input dir="ltr" className="ltr-num h-8" value={offered} onChange={(e) => setOffered(e.target.value.replace(/\D/g, ''))} />
                </div>
                {offerSide === 'WAREHOUSE' && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px]">{isFa ? 'موجودی انبار (عدد) *' : 'Warehouse stock *'}</Label>
                    <Input dir="ltr" className="ltr-num h-8" value={stockQty} onChange={(e) => setStockQty(e.target.value.replace(/\D/g, ''))} placeholder={isFa ? 'موجودی همین لحظه' : 'stock now'} />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">{isFa ? 'قیمت توافقی خرید (تومان — محرمانه)' : 'Negotiated price (internal)'}</Label>
                  <Input dir="ltr" className="ltr-num h-8" value={negotiated} onChange={(e) => setNegotiated(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">{isFa ? 'تاریخ قیمت (مثلاً ۱۴۰۵/۰۸/۲۷)' : 'Price date'}</Label>
                  <Input dir="ltr" className="ltr-num h-8" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} placeholder={isFa ? 'پیش‌فرض امروز' : 'default today'} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">{isFa ? 'لینک کالا در سایت مرجع' : 'Product link'}</Label>
                  <Input dir="ltr" className="h-8" value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} />
                </div>
              </div>
              <Input value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder={isFa ? 'یادداشت (شرط توافق، بسته‌بندی و...)' : 'note'} className="h-8" />
              <Button
                size="sm"
                className="w-full"
                disabled={busy !== '' || !storeName.trim() || !(parseInt(offered, 10) > 0) || (offerSide === 'WAREHOUSE' && stockQty === '')}
                onClick={() => act({
                  action: 'add',
                  productId: data.product.id,
                  side: offerSide,
                  storeId: sourcePick || null,
                  storeName: storeName.trim(),
                  offeredPrice: parseInt(offered, 10) || 0,
                  negotiatedPrice: parseInt(negotiated, 10) || null,
                  stockQty: offerSide === 'WAREHOUSE' ? (parseInt(stockQty, 10) || 0) : null,
                  sourceUrl: srcUrl.trim() || null,
                  fetchedShamsi: offerDate.trim() || null,
                  note: offerNote.trim() || null,
                }, isFa ? 'استعلام ثبت شد' : 'Quote saved', 'add')}
              >
                {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isFa ? 'ثبت استعلام' : 'Save quote'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface OfferPolicyLite {
  storeCount: number; warehouseCount: number;
  sellBase: number | null; sellBaseStore: string | null;
  buyTarget: number | null; buyTargetStore: string | null; margin: number | null;
  warehousePrices: { name: string; price: number; stockQty: number | null; fetchedAt: string; shamsi?: string }[];
  freshestStock: number | null; freshestStockWarehouse: string | null; freshestStockAt: string | null;
  freshestAt: string | null; expertPct: number; platformPct: number; markupPct: number;
}

// ═══ پیام ۱۳: تب فروشگاه‌ها ═════════════════════════════════
interface StoreRow {
  id: string; key: string; nameFa: string; nameEn: string; kind: string; kindFa: string;
  website: string | null; phone: string | null; address: string | null; city: string;
  feedType: string; priceMode: string; lastSyncAt: string | null; lastSyncStatus: string; lastSyncNote: string | null;
  active: boolean; verified: boolean; notes: string | null; offersCount: number;
  highestOffer: number | null; lowestBuy: number | null; freshestShamsi: string | null;
}
interface QuoteRow { id: string; slug: string; titleFa: string; price: number; prevPrice: number | null; percentChange: number | null; fetchedAt: string; source: string }

const SYNC_STATUS_FA: Record<string, string> = {
  OK: 'متصل ✓',
  CHALLENGED: 'چالش امنیتی',
  UNREACHABLE: 'در دسترس نبود',
  NO_MATCH: 'بدون نتیجه',
  NEVER: 'هنوز همگام نشده',
  NONE: 'بدون اتصال لحظه‌ای',
  ERROR: 'خطا',
  DISABLED: 'غیرفعال',
};

export function StoresTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [rows, setRows] = useState<StoreRow[] | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [busy, setBusy] = useState('');
  const [addDlg, setAddDlg] = useState(false);

  const load = useCallback(() => {
    api<{ stores: StoreRow[]; quotes: QuoteRow[] }>('/api/admin/stores')
      .then((d) => { setRows(d.stores); setQuotes(d.quotes ?? []); })
      .catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(body: Record<string, unknown>, msg: string, key = 'x') {
    setBusy(key);
    try {
      const d = await post<{ ok?: boolean; result?: { tgju?: { ok: boolean; error?: string; count?: number } } }>('/api/admin/stores', body);
      if (body.action === 'sync-reference') {
        const tg = d.result?.tgju;
        if (tg?.ok) toast.success(`${isFa ? 'نرخ‌های لحظه‌ای به‌روز شد' : 'Live quotes updated'} (${tg.count} ${isFa ? 'نرخ' : 'quotes'})`);
        else toast.error(tg?.error ?? 'خطا');
      } else toast.success(msg);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="mt-4">
      <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-6">
        {isFa
          ? 'لیست تمام فروشگاه‌ها (پیام ۱۳/۱۴) — راه‌های ارتباطی، آدرس و وضعیت اتصال لحظه‌ای هر فروشگاه. پلن v3: فروش به قیمت گران‌ترین فروشگاه و خرید و تأمین موجودی از ارزان‌ترین انبار؛ افزودنی پرداخت = سهم کارشناس + افزایش قیمت پلتفرم. قیمت‌ها فقط از بروزترین منابع و بعد از ۱۴۰۵/۰۸/۱۰ پذیرفته می‌شود.'
          : 'All stores (Messages 13/14) — contacts, address and live-feed status. Plan v3: sell at the priciest store, procure from the cheapest warehouse; checkout markup = expert share + platform margin. Only fresh prices (after 1405/08/10) are accepted.'}
      </p>

      {/* نرخ‌های لحظه‌ای مرجع — سایت نوسان قیمت */}
      <Card className="mt-3">
        <CardContent className="p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">{isFa ? 'نرخ‌های لحظه‌ای مرجع — اتصال به سایت نوسان قیمت (tgju.org)' : 'Live reference quotes — tgju.org'}</p>
            <Button size="sm" className="ms-auto" disabled={busy !== ''} onClick={() => act({ action: 'sync-reference' }, '', 'ref')}>
              {busy === 'ref' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isFa ? 'همگام‌سازی لحظه‌ای' : 'Sync now'}
            </Button>
          </div>
          {quotes.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{isFa ? 'هنوز نرخِ گرفته‌شده‌ای ثبت نشده — دکمهٔ همگام‌سازی را بزنید.' : 'No quotes yet — press sync.'}</p>
          ) : (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {quotes.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5 text-xs">
                  <span>{q.titleFa}</span>
                  <span className="ltr-num font-bold" dir="ltr">{faDigits(q.price.toLocaleString('en-US'))}</span>
                  {q.percentChange != null && (
                    <Badge variant={q.percentChange >= 0 ? 'default' : 'secondary'} className={`text-[9px] ${q.percentChange < 0 ? 'text-red-600' : ''}`}>
                      {q.percentChange >= 0 ? '▲' : '▼'} {faDigits(Math.abs(q.percentChange).toFixed(2))}٪
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={() => setAddDlg(true)}><Plus className="h-4 w-4" />{isFa ? 'افزودن فروشگاه' : 'Add store'}</Button>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" />{isFa ? 'بروزرسانی' : 'Refresh'}</Button>
      </div>

      {!rows ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-2 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><StoreIcon className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{s.nameFa}</p>
                    <p className="text-[10px] text-muted-foreground">{s.kindFa} · {s.city} · {faDigits(s.offersCount)} {isFa ? 'پیشنهاد قیمت' : 'offers'}</p>
                  </div>
                  <Badge variant={s.verified ? 'default' : 'outline'} className="text-[9px]">{s.verified ? (isFa ? 'تأییدشده' : 'verified') : (isFa ? 'نیاز به تأیید' : 'unverified')}</Badge>
                </div>
                <div className="space-y-1 text-[11px] leading-5 text-muted-foreground">
                  {s.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span dir="ltr" className="ltr-num">{s.phone}</span></p>}
                  {s.website && (
                    <p className="flex items-center gap-1.5"><Globe className="h-3 w-3" /><a className="underline" href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" dir="ltr">{s.website}</a></p>
                  )}
                  {s.address && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{s.address}</p>}
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">{isFa ? 'فروش' : 'Sell'}:</span>
                  <span className="ltr-num font-bold text-primary" dir="ltr">{s.highestOffer ? money(s.highestOffer, lang) : '—'}</span>
                  <span className="text-muted-foreground">{isFa ? 'خرید توافقی' : 'Buy'}:</span>
                  <span className="ltr-num font-bold" dir="ltr">{s.lowestBuy ? money(s.lowestBuy, lang) : '—'}</span>
                  {s.freshestShamsi && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{faDigits(s.freshestShamsi)}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{isFa ? 'اتصال' : 'feed'}: {s.feedType === 'NONE' ? (isFa ? 'دستی' : 'manual') : s.feedType}</Badge>
                  <Badge variant={s.lastSyncStatus === 'OK' ? 'default' : 'outline'} className={`text-[9px] ${['UNREACHABLE', 'ERROR'].includes(s.lastSyncStatus) ? 'text-red-600' : ''}`}>
                    {SYNC_STATUS_FA[s.lastSyncStatus] ?? s.lastSyncStatus}
                  </Badge>
                  {s.lastSyncAt && <span>{formatJalaliTime(new Date(s.lastSyncAt), lang)}</span>}
                  {s.lastSyncNote && <span className="w-full leading-4">{s.lastSyncNote}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant={s.verified ? 'outline' : 'default'} className="h-7 text-[11px]" disabled={busy !== ''} onClick={() => act({ action: 'patch', id: s.id, verified: !s.verified }, isFa ? 'تأیید تغییر کرد' : 'Updated', s.id)}>
                    <ShieldCheck className="h-3.5 w-3.5" />{s.verified ? (isFa ? 'لغو تأیید' : 'Unverify') : (isFa ? 'تأیید فعال بودن' : 'Verify')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={busy !== ''} onClick={() => act({ action: 'patch', id: s.id, active: !s.active }, isFa ? 'وضعیت تغییر کرد' : 'Updated', s.id)}>
                    {s.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isFa ? (s.active ? 'غیرفعال' : 'فعال') : (s.active ? 'Disable' : 'Enable')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddStoreDialog open={addDlg} onOpenChange={setAddDlg} lang={lang} onDone={() => { setAddDlg(false); load(); }} />
    </div>
  );
}

function AddStoreDialog({ open, onOpenChange, lang, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; lang: 'fa' | 'en'; onDone: () => void }) {
  const isFa = lang === 'fa';
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ key: '', nameFa: '', kind: 'ONLINE', website: '', phone: '', address: '', city: 'تهران', feedType: 'NONE', feedQueryTemplate: '', notes: '' });

  async function save() {
    if (!f.key.trim() || f.nameFa.trim().length < 2) return;
    setBusy(true);
    try {
      await post('/api/admin/stores', {
        action: 'upsert',
        key: f.key.trim(),
        nameFa: f.nameFa.trim(),
        kind: f.kind,
        website: f.website.trim() || null,
        phone: f.phone.trim() || null,
        address: f.address.trim() || null,
        city: f.city.trim() || 'تهران',
        feedType: f.feedType,
        feedQueryTemplate: f.feedQueryTemplate.trim() || null,
        notes: f.notes.trim() || null,
      });
      toast.success(isFa ? 'فروشگاه ثبت شد' : 'Store saved');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto as-scroll">
        <DialogHeader>
          <DialogTitle>{isFa ? 'افزودن فروشگاه' : 'Add store'}</DialogTitle>
          <DialogDescription className="text-start text-xs">
            {isFa ? 'فروشگاه جدید با راه‌های ارتباطی و نوع اتصال لحظه‌ای ثبت می‌شود.' : 'Register a new store with contacts and feed type.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1"><Label className="text-[11px]">کلید یکتا *</Label><Input dir="ltr" className="h-8" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.replace(/\s+/g, '-').toLowerCase() })} placeholder="digikala" /></div>
          <div className="flex flex-col gap-1"><Label className="text-[11px]">نام فروشگاه *</Label><Input className="h-8" value={f.nameFa} onChange={(e) => setF({ ...f, nameFa: e.target.value })} /></div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px]">نوع</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ONLINE">فروشگاه اینترنتی</SelectItem>
                <SelectItem value="MARKETPLACE">بازار آنلاین</SelectItem>
                <SelectItem value="PRICE_AGGREGATOR">مقایسه‌گر قیمت</SelectItem>
                <SelectItem value="PHYSICAL">حضوری</SelectItem>
                <SelectItem value="SERVICE">خدمات</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px]">اتصال لحظه‌ای</Label>
            <Select value={f.feedType} onValueChange={(v) => setF({ ...f, feedType: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">دستی</SelectItem>
                <SelectItem value="DIGIKALA">دیجی‌کالا (API)</SelectItem>
                <SelectItem value="TOROB">ترب (API)</SelectItem>
                <SelectItem value="SNAPP_MARKET">اسنپ‌مارکت</SelectItem>
                <SelectItem value="TGJU">TGJU (مرجع)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1"><Label className="text-[11px]">سایت</Label><Input dir="ltr" className="h-8" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
          <div className="flex flex-col gap-1"><Label className="text-[11px]">تلفن</Label><Input dir="ltr" className="ltr-num h-8" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="flex flex-col gap-1 col-span-2"><Label className="text-[11px]">آدرس</Label><Input className="h-8" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="flex flex-col gap-1 col-span-2"><Label className="text-[11px]">قالب جستجوی لحظه‌ای ({'{q}'})</Label><Input dir="ltr" className="h-8" value={f.feedQueryTemplate} onChange={(e) => setF({ ...f, feedQueryTemplate: e.target.value })} placeholder="https://api.digikala.com/v1/product/search/?q={q}" /></div>
        </div>
        <Button className="mt-1 w-full" disabled={busy || !f.key.trim() || f.nameFa.trim().length < 2} onClick={save}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isFa ? 'ثبت فروشگاه' : 'Save'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ═══ افزودن کالا/نرم‌افزار ═════════════════════════════════
function AddProductDialog({ open, onOpenChange, lang, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; lang: 'fa' | 'en'; onDone: () => void }) {
  const isFa = lang === 'fa';
  const [form, setForm] = useState({ key: '', nameFa: '', nameEn: '', descFa: '', section: 'GOODS', category: '', brand: '', basePrice: '', baseSource: '', sourceUrl: '', refPrice: '', stock: '5' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto as-scroll">
        <DialogHeader>
          <DialogTitle>{isFa ? 'افزودن به میز کالا / نرم‌افزار' : 'Add to goods / software desk'}</DialogTitle>
          <DialogDescription className="text-start text-xs">{isFa ? 'پایهٔ فروش طبق پلن v3 (گران‌ترین فروشگاه) ثبت می‌شود؛ افزودنی پرداخت (سهم کارشناس + افزایش قیمت پلتفرم) فقط در صفحهٔ پرداخت محاسبه می‌شود. پلن ۳۳٪ فقط در میز خدمات باقی است.' : 'Sell base follows plan v3 (priciest store); checkout markup (expert share + platform margin) is computed at checkout. The 33% plan applies to the services counter only.'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 flex flex-col gap-1.5"><Label>{isFa ? 'نام فارسی *' : 'Name (fa) *'}</Label><Input value={form.nameFa} onChange={(e) => set('nameFa', e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'کلید یکتا *' : 'Key *'}</Label><Input dir="ltr" value={form.key} onChange={(e) => set('key', e.target.value)} placeholder="gpu-rtx" /></div>
          <div className="flex flex-col gap-1.5">
            <Label>{isFa ? 'بخش' : 'Section'}</Label>
            <Select value={form.section} onValueChange={(v) => set('section', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="GOODS">{isFa ? 'کالا' : 'Goods'}</SelectItem><SelectItem value="SOFTWARE">{isFa ? 'نرم‌افزار' : 'Software'}</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'دسته' : 'Category'}</Label><Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder={isFa ? 'لپ‌تاپ / یخچال / ...' : ''} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'برند' : 'Brand'}</Label><Input value={form.brand} onChange={(e) => set('brand', e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'قیمت پایه انبار (تومان) *' : 'Warehouse base price *'}</Label><Input dir="ltr" className="ltr-num" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value.replace(/\D/g, ''))} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'قیمت سایت مرجع (اختیاری)' : 'Ref site price'}</Label><Input dir="ltr" className="ltr-num" value={form.refPrice} onChange={(e) => set('refPrice', e.target.value.replace(/\D/g, ''))} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'نام مرجع قیمت' : 'Price source'}</Label><Input value={form.baseSource} onChange={(e) => set('baseSource', e.target.value)} placeholder={isFa ? 'کامپیوتر افق، دیجی‌کالا...' : ''} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'لینک کالا' : 'Product link'}</Label><Input dir="ltr" value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>{isFa ? 'موجودی' : 'Stock'}</Label><Input dir="ltr" className="ltr-num" value={form.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} /></div>
          <div className="col-span-2 flex flex-col gap-1.5"><Label>{isFa ? 'توضیحات' : 'Description'}</Label><Textarea rows={2} value={form.descFa} onChange={(e) => set('descFa', e.target.value)} /></div>
        </div>
        <Button
          className="w-full"
          disabled={busy}
          onClick={async () => {
            if (!form.nameFa.trim() || !form.key.trim() || !form.basePrice) {
              toast.error(isFa ? 'نام، کلید و قیمت پایه الزامی است' : 'Name, key and base price are required');
              return;
            }
            setBusy(true);
            try {
              await post('/api/admin/inventory', {
                action: 'create',
                key: form.key.trim(),
                nameFa: form.nameFa.trim(),
                nameEn: form.nameEn.trim(),
                descFa: form.descFa.trim(),
                descEn: form.nameEn.trim(),
                section: form.section,
                category: form.category.trim() || (isFa ? 'سایر' : 'Other'),
                brand: form.brand.trim() || null,
                basePrice: parseInt(form.basePrice, 10) || 0,
                baseSource: form.baseSource.trim() || null,
                sourceUrl: form.sourceUrl.trim() || null,
                refPrice: form.refPrice ? parseInt(form.refPrice, 10) : null,
                refSource: form.refPrice ? (isFa ? 'سایت مرجع' : 'Ref site') : null,
                stock: parseInt(form.stock, 10) || 5,
              });
              toast.success(isFa ? 'افزوده شد' : 'Added');
              onDone();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'خطا');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isFa ? 'افزودن' : 'Add'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ═══ انبارها و مراجع قیمت ═══════════════════════════════════
interface WarehouseRow {
  id: string; key: string; nameFa: string; kind: string; website: string | null; phone: string | null;
  address: string | null; city: string; linkTemplate: string | null; active: boolean;
  priceListFresh: boolean; verified: boolean; notes: string | null; _count?: { products: number };
}

const KIND_FA: Record<string, string> = {
  COMPUTER: 'کامپیوتر', APPLIANCE: 'لوازم خانگی', MARKETPLACE: 'بازارگاه آنلاین',
  SERVICES: 'خدمات', PRICE_AGGREGATOR: 'مرجع مقایسه قیمت', GOODS: 'کالا',
};

export function WarehousesTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [rows, setRows] = useState<WarehouseRow[] | null>(null);

  const load = useCallback(() => {
    api<{ warehouses: WarehouseRow[] }>('/api/admin/warehouses').then((d) => setRows(d.warehouses)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, msg: string) {
    try {
      await post('/api/admin/warehouses', body);
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    }
  }

  return (
    <div className="mt-4">
      <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-6">
        {isFa
          ? `لیست تمام انبارها و مراجع قیمت (پیام ۱۴) — راه‌های ارتباطی، آدرس محل و سایت هر مجموعه. پلن v3: خرید و تأمین موجودی از ارزان‌ترین انبار و موجودی فقط از بروزترین استعلام؛ استعلام هر انبار باید در دیالوگ «فروشگاه‌ها و انبارهای کالا» با موجودی ثبت شود. پیش از موجود کردن هر کالا، فعال بودن مجموعه و بروز بودن لیست قیمت آن را تأیید کنید.`
          : `All warehouses and price sources (Message 14) — contacts, address and website. Plan v3: procure from the cheapest warehouse, stock only from the freshest quote. Verify activity and price freshness before stocking any item.`}
      </p>
      {!rows ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {rows.map((w) => (
            <Card key={w.id}>
              <CardContent className="space-y-2 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{w.nameFa}</p>
                    <p className="text-[10px] text-muted-foreground">{KIND_FA[w.kind] ?? w.kind} · {w.city} · {w._count?.products ?? 0} {isFa ? 'کالا' : 'items'}</p>
                  </div>
                  <Badge variant={w.verified ? 'default' : 'outline'} className="text-[9px]">{w.verified ? (isFa ? 'تأیید فعال' : 'verified') : (isFa ? 'نیاز به تأیید' : 'unverified')}</Badge>
                </div>
                <div className="space-y-1 text-[11px] leading-5 text-muted-foreground">
                  {w.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span dir="ltr" className="ltr-num">{w.phone}</span></p>}
                  {w.website && (
                    <p className="flex items-center gap-1.5"><Globe className="h-3 w-3" /><a className="underline" href={w.website.startsWith('http') ? w.website : `https://${w.website}`} target="_blank" rel="noreferrer" dir="ltr">{w.website}</a></p>
                  )}
                  {w.address && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{w.address}</p>}
                  {w.linkTemplate && <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3" /><span dir="ltr" className="truncate text-[10px]">{w.linkTemplate}</span></p>}
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant={w.verified ? 'outline' : 'default'} className="h-7 text-[11px]" onClick={() => patch({ id: w.id, verified: !w.verified }, isFa ? (w.verified ? 'تأیید لغو شد' : 'مجموعه تأیید شد') : 'Updated')}>
                    <ShieldCheck className="h-3.5 w-3.5" />{w.verified ? (isFa ? 'لغو تأیید' : 'Unverify') : (isFa ? 'تأیید فعال بودن' : 'Verify')}
                  </Button>
                  <Button size="sm" variant={w.priceListFresh ? 'outline' : 'default'} className="h-7 text-[11px]" onClick={() => patch({ id: w.id, priceListFresh: !w.priceListFresh }, isFa ? 'بروزی تغییر کرد' : 'Updated')}>
                    <CalendarDays className="h-3.5 w-3.5" />{isFa ? (w.priceListFresh ? 'قیمت‌ها بروز است' : 'قیمت‌ها بروز نیست') : (w.priceListFresh ? 'prices fresh' : 'stale')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => patch({ id: w.id, active: !w.active }, isFa ? 'وضعیت تغییر کرد' : 'Updated')}>
                    {w.active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isFa ? (w.active ? 'غیرفعال' : 'فعال') : (w.active ? 'Disable' : 'Enable')}
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

// ═══ گزارش روزانهٔ قیمت ══════════════════════════════════════
interface DailyReport {
  id: string; dateKey: string; dateShamsi: string; itemsJson: string; itemCount: number;
  status: string; approvedBy: string | null; createdAt: string;
}
interface ReportItem { productId: string; title: string; listPrice: number; oldPrice: number; basePrice: number; refPrice: number | null; rule: string; source: string; priceDate: string; fresh: boolean; changed: boolean }

export function DailyPricesTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [reports, setReports] = useState<DailyReport[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState('');

  const load = useCallback(() => {
    api<{ reports: DailyReport[] }>('/api/admin/daily-prices').then((d) => setReports(d.reports)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  async function act(action: string, reportId?: string) {
    setBusy(true);
    try {
      await post('/api/admin/daily-prices', { action, reportId });
      toast.success(action === 'generate' ? (isFa ? 'گزارش روزانهٔ قیمت تولید و به ادمین/ایمیل ارسال شد' : 'Report generated') : action === 'approve' ? (isFa ? 'تأیید شد — قیمت‌های نمایشی جدید (= قیمت مرجع) در میز کالا لحاظ گردید' : 'Applied') : (isFa ? 'رد شد' : 'Rejected'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => act('generate')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
          {isFa ? 'تولید/بررسی گزارش امروز (قیمت‌ها طبق تقویم)' : 'Generate today report'}
        </Button>
        <p className="text-xs text-muted-foreground">{isFa ? 'هر روز، بروزترین لیست قیمت اقلام موجودی (همان قیمت مرجع، بدون افزودنی) برای پنل ادمین ارسال می‌شود؛ افزودنی پرداخت و هزینهٔ پیک در صفحهٔ پرداخت اعمال می‌شود. فقط قیمت‌های بعد از ۱۴۰۵/۰۸/۱۰ معتبرند؛ اقلام کهنه باید با استعلام تازهٔ انبار بروز شوند.' : 'Daily report shows the freshest source prices (no markup); checkout markup & courier apply at payment. Only prices after 1405/08/10 are valid; stale items need a fresh warehouse quote.'}</p>
      </div>
      {!reports ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{isFa ? 'هنوز گزارشی تولید نشده است.' : 'No reports yet.'}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {reports.map((r) => {
            const items: ReportItem[] = JSON.parse(r.itemsJson);
            const changed = items.filter((i) => i.changed);
            return (
              <Card key={r.id}>
                <CardContent className="p-3.5">
                  <button className="flex w-full flex-wrap items-center gap-2 text-start" onClick={() => setOpenId(openId === r.id ? '' : r.id)}>
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">{faDigits(r.dateShamsi)}</span>
                    <Badge variant="secondary" className="text-[10px]">{isFa ? `${faDigits(r.itemCount)} قلم` : `${r.itemCount} items`}</Badge>
                    <Badge className={`text-[10px] ${r.status === 'PENDING' ? 'bg-amber-500' : r.status === 'APPLIED' ? 'bg-emerald-600' : r.status === 'REJECTED' ? 'bg-destructive' : 'bg-secondary'}`}>
                      {r.status === 'PENDING' ? (isFa ? 'در انتظار تأیید ادمین' : 'pending') : r.status === 'APPLIED' ? (isFa ? 'اعمال شد' : 'applied') : r.status === 'REJECTED' ? (isFa ? 'رد شد' : 'rejected') : r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{isFa ? `${faDigits(changed.length)} مورد تغییر قیمت` : `${changed.length} changed`}</span>
                    <RefreshCw className={`ms-auto h-3.5 w-3.5 transition-transform ${openId === r.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openId === r.id && (
                    <div className="as-scroll mt-3 max-h-72 divide-y overflow-y-auto rounded-lg border">
                      {items.map((i) => (
                        <div key={i.productId} className="flex flex-wrap items-center gap-2 p-2.5 text-xs">
                          <span className="min-w-36 font-bold">{i.title}</span>
                          {i.changed ? (
                            <>
                              <span className="ltr-num text-muted-foreground line-through" dir="ltr">{money(i.oldPrice, lang)}</span>
                              <TrendingUp className="h-3.5 w-3.5 text-primary" />
                              <span className="ltr-num font-extrabold text-primary" dir="ltr">{money(i.listPrice, lang)}</span>
                              <Badge variant="outline" className="text-[9px]">{i.rule === 'MANUAL' ? (isFa ? 'قیمت دستی' : 'manual') : (isFa ? 'پلن v3: کارشناس + پلتفرم' : 'Plan v3: expert + platform')}</Badge>
                              <span className="text-[10px] text-muted-foreground">{i.source}</span>
                            </>
                          ) : (
                            <>
                              <span className="ltr-num" dir="ltr">{money(i.oldPrice, lang)}</span>
                              <span className="text-[10px] text-muted-foreground">{isFa ? 'بدون تغییر' : 'no change'}</span>
                            </>
                          )}
                          {i.priceDate && <span className="text-[10px] text-muted-foreground ltr-num" dir="ltr">{faDigits(i.priceDate)}</span>}
                          {!i.fresh && <Badge variant="outline" className="text-[9px] border-red-500/50 text-red-600">{isFa ? 'کهنه — استعلام تازه لازم' : 'stale — needs fresh quote'}</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                  {r.status === 'PENDING' && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => act('approve', r.id)}><CheckCircle2 className="h-4 w-4" />{isFa ? 'تأیید و لحاظ قیمت‌های جدید' : 'Approve & apply'}</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act('reject', r.id)}><XCircle className="h-4 w-4" />{isFa ? 'رد' : 'Reject'}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ مراحل فاکتور ════════════════════════════════════════════
const STAGE_FA: Record<string, string> = {
  PAID_FROM_ACCOUNT: 'پرداخت از حساب',
  PAID_TO_ACCOUNT: 'پرداخت به شماره حساب',
  COORDINATION_PHONE: 'تلفن هماهنگی',
  OPERATOR_INFO: 'مشخصات اپراتور',
  ADDRESS_CONFIRMED: 'آدرس دقیق (پلاک/طبقه/واحد)',
  WAREHOUSE_PRICE: 'قیمت انبار',
  SITE_PRICE: 'قیمت کالا در سایت',
  HANDED_TO_COURIER: 'به پیک تحویل داده شد',
  DEPOSITED_TO_ACCOUNT: 'واریزی مبلغ کالا به حساب ... به نام ...',
  DONE: 'با موفقیت انجام شد',
};
const ALL_STAGES = Object.keys(STAGE_FA);

interface StageRow {
  id: string; stage: string; amount: number | null; accountRef: string | null; toName: string | null; operator: string | null; note: string | null; createdAt: string;
}
interface StageOrder {
  id: string; code: string; kind: 'PRODUCT' | 'SERVICE'; status: string; total: number; createdAt: string;
  fullName?: string; mobile?: string; address?: string; plaque?: string | null; floor?: string | null; unit?: string | null; postalCode?: string | null;
  leadTimeDays?: string; paySheba?: boolean; servicesTotal?: number;
  product?: { nameFa: string; baseSource: string | null; sourceUrl: string | null };
  services?: { id: string; title: string; price: number; qty: number }[];
  customer?: { fullName: string; mobile: string; address: string; plaque: string | null; floor: string | null; unit: string | null; postalCode: string | null };
  stages: StageRow[];
}

export function InvoiceStagesTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [kind, setKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [orders, setOrders] = useState<StageOrder[] | null>(null);
  const [q, setQ] = useState('');
  const [dlg, setDlg] = useState<{ order: StageOrder; stage: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [accountRef, setAccountRef] = useState('');
  const [toName, setToName] = useState('');
  const [operator, setOperator] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ orders: StageOrder[] }>(`/api/admin/invoice-stages?kind=${kind}&q=${encodeURIComponent(q)}`)
      .then((d) => setOrders(d.orders))
      .catch((e) => toast.error(e.message));
  }, [kind, q]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  async function submitStage() {
    if (!dlg) return;
    setBusy(true);
    try {
      await post('/api/admin/invoice-stages', {
        kind: dlg.order.kind, refId: dlg.order.id, stage: dlg.stage,
        amount: amount ? parseInt(amount, 10) : null,
        accountRef: accountRef || null, toName: toName || null, operator: operator || null, note: note || null,
      });
      toast.success(isFa ? 'مرحله ثبت شد' : 'Stage recorded');
      setDlg(null);
      setAmount(''); setAccountRef(''); setToName(''); setOperator(''); setNote('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-6">
        {isFa
          ? 'ادمین موظف است مسیر انجام مراحل فاکتور را ثبت نماید: پرداخت از حساب، پرداخت به شماره حساب، تلفن هماهنگی، مشخصات اپراتور، آدرس، قیمت انبار، قیمت کالا در سایت، تحویل به پیک، واریزی مبلغ کالا به شماره حساب ... به نام ... و در نهایت «با موفقیت انجام شد». فاکتورها برای ضمیمه به پروندهٔ مشتری نگهداری می‌شوند.'
          : 'The admin must record every invoice stage; invoices are archived to the customer file.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as 'PRODUCT' | 'SERVICE')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PRODUCT">{isFa ? 'سفارش کالا (ASP)' : 'Goods (ASP)'}</SelectItem>
            <SelectItem value="SERVICE">{isFa ? 'سفارش خدمات (AS)' : 'Services (AS)'}</SelectItem>
          </SelectContent>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isFa ? 'جستجوی کد سفارش...' : 'Search order code…'} className="max-w-52" />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {!orders ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{isFa ? 'سفارشی یافت نشد.' : 'No orders.'}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {orders.map((o) => {
            const doneStages = new Set(o.stages.map((s) => s.stage));
            const customer = o.kind === 'PRODUCT' ? { fullName: o.fullName, mobile: o.mobile, address: o.address, plaque: o.plaque, floor: o.floor, unit: o.unit, postalCode: o.postalCode } : o.customer;
            const progress = Math.round((doneStages.size / ALL_STAGES.length) * 100);
            return (
              <Card key={o.id}>
                <CardContent className="space-y-2.5 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-primary" />
                    <span className="font-extrabold tracking-wider text-primary" dir="ltr">{o.code}</span>
                    <Badge variant="secondary" className="text-[10px]">{o.kind === 'PRODUCT' ? (isFa ? 'کالا' : 'goods') : (isFa ? 'خدمات' : 'service')}</Badge>
                    <span className="text-sm font-bold">{o.kind === 'PRODUCT' ? o.product?.nameFa : (isFa ? 'سفارش خدمت' : 'service order')}</span>
                    <span className="ltr-num text-xs font-extrabold text-primary" dir="ltr">{money(o.total, lang)}</span>
                    <span className="ms-auto text-[11px] text-muted-foreground">{formatJalaliTime(new Date(o.createdAt), lang)}</span>
                  </div>
                  {customer && (
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      {customer.fullName} · <span dir="ltr" className="ltr-num">{customer.mobile}</span> · {customer.address}
                      {customer.plaque && ` — ${isFa ? 'پلاک' : 'No.'} ${customer.plaque}${customer.floor ? `، ${isFa ? 'طبقه' : 'floor'} ${customer.floor}` : ''}${customer.unit ? `، ${isFa ? 'واحد' : 'unit'} ${customer.unit}` : ''}${customer.postalCode ? `، ${isFa ? 'کدپستی' : 'postal'} ${customer.postalCode}` : ''}`}
                    </p>
                  )}
                  {o.kind === 'PRODUCT' && o.services && o.services.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">{isFa ? 'خدمات کنار خرید' : 'Add-ons'}: {o.services.map((s) => `${s.title} ×${s.qty} (${money(s.price, lang)})`).join('، ')}</p>
                  )}
                  {/* نوار پیشرفت مراحل */}
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{faDigits(progress)}٪</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_STAGES.map((st) => {
                      const done = doneStages.has(st);
                      return (
                        <button
                          key={st}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${done ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'border-muted text-muted-foreground hover:border-primary hover:text-primary'}`}
                          onClick={() => !done && setDlg({ order: o, stage: st })}
                          disabled={done}
                          title={done ? (isFa ? 'ثبت‌شده' : 'recorded') : (isFa ? 'ثبت این مرحله' : 'record')}
                        >
                          {done && <CheckCircle2 className="me-1 inline h-3 w-3" />}
                          {STAGE_FA[st]}
                        </button>
                      );
                    })}
                  </div>
                  {o.stages.length > 0 && (
                    <div className="as-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2 text-[10px] leading-5 text-muted-foreground">
                      {o.stages.map((s) => (
                        <p key={s.id}>
                          <b className="text-foreground">{STAGE_FA[s.stage] ?? s.stage}</b>
                          {s.amount ? ` — ${money(s.amount, lang)}` : ''}
                          {s.accountRef ? ` — ${s.accountRef}` : ''}
                          {s.toName ? ` — ${isFa ? 'به نام' : 'to'} ${s.toName}` : ''}
                          {s.operator ? ` — ${s.operator}` : ''}
                          {s.note ? ` — ${s.note}` : ''}
                          <span className="opacity-70"> · {formatJalaliTime(new Date(s.createdAt), lang)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!dlg} onOpenChange={(v) => !v && setDlg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{STAGE_FA[dlg?.stage ?? '']} — {dlg?.order.code}</DialogTitle>
            <DialogDescription className="text-start text-xs">{isFa ? 'مشخصات این مرحله را ثبت کنید (مبلغ/حساب/نام واریزی/اپراتور در صورت لزوم).' : 'Record the stage details.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {(dlg?.stage === 'WAREHOUSE_PRICE' || dlg?.stage === 'SITE_PRICE' || dlg?.stage === 'PAID_FROM_ACCOUNT' || dlg?.stage === 'PAID_TO_ACCOUNT' || dlg?.stage === 'DEPOSITED_TO_ACCOUNT') && (
              <div className="flex flex-col gap-1.5"><Label>{isFa ? 'مبلغ (تومان)' : 'Amount (Toman)'}</Label><Input dir="ltr" className="ltr-num" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></div>
            )}
            {(dlg?.stage === 'PAID_TO_ACCOUNT' || dlg?.stage === 'DEPOSITED_TO_ACCOUNT') && (
              <>
                <div className="flex flex-col gap-1.5"><Label>{isFa ? 'شماره حساب/کارت مقصد' : 'Destination account/card'}</Label><Input dir="ltr" className="ltr-num" value={accountRef} onChange={(e) => setAccountRef(e.target.value)} placeholder="IR... یا 6037..." /></div>
                <div className="flex flex-col gap-1.5"><Label>{isFa ? 'واریز به نام' : 'Deposited in the name of'}</Label><Input value={toName} onChange={(e) => setToName(e.target.value)} /></div>
              </>
            )}
            {dlg?.stage === 'COORDINATION_PHONE' && (
              <div className="flex flex-col gap-1.5"><Label>{isFa ? 'تلفن هماهنگی / خلاصهٔ تماس' : 'Coordination phone / call summary'}</Label><Input dir="ltr" className="ltr-num" value={operator} onChange={(e) => setOperator(e.target.value)} /></div>
            )}
            {dlg?.stage === 'OPERATOR_INFO' && (
              <div className="flex flex-col gap-1.5"><Label>{isFa ? 'مشخصات اپراتور' : 'Operator details'}</Label><Input value={operator} onChange={(e) => setOperator(e.target.value)} /></div>
            )}
            <div className="flex flex-col gap-1.5"><Label>{isFa ? 'یادداشت' : 'Note'}</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button className="w-full" disabled={busy} onClick={submitStage}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isFa ? 'ثبت مرحله' : 'Record stage'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══ هماهنگی‌ها → اتوماسیون ══════════════════════════════════
interface CoordRow {
  id: string; kind: string; orderId: string | null; productOrderId: string | null; summary: string;
  handledBy: string; eligible: boolean; ownerApproved: boolean; adminApproved: boolean;
  movedToAutomation: boolean; createdAt: string;
}

export function CoordinationTab({ lang, role }: { lang: 'fa' | 'en'; role: 'OWNER' | 'ADMIN' }) {
  const isFa = lang === 'fa';
  const [view, setView] = useState<'MANUAL' | 'AUTOMATION'>('MANUAL');
  const [rows, setRows] = useState<CoordRow[] | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [dlg, setDlg] = useState(false);
  const [kind, setKind] = useState('CALL');
  const [orderCodeIn, setOrderCodeIn] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ logs: CoordRow[]; automationEnabled: boolean }>(`/api/admin/coordination?view=${view}`)
      .then((d) => { setRows(d.logs); setAutoEnabled(d.automationEnabled); })
      .catch((e) => toast.error(e.message));
  }, [view]);
  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>, msg: string) {
    try {
      await api('/api/admin/coordination', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    }
  }

  return (
    <div className="mt-4">
      <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-6">
        {isFa
          ? 'تا فعال شدن اتوماسیون از جانب مالک، تمام امور رزرو، هماهنگی و پرداختی به صورت دستی توسط ادمین انجام و همین‌جا ثبت می‌شود. هر هماهنگی دستی پس از اولین بار، در صورت تأیید مالک (یا باز کردن دسترسی توسط مالک و تأیید ادمین)، به بخش هماهنگی‌های اتوماسیون منتقل می‌گردد.'
          : 'Until the owner enables automation, all coordination is manual by the admin. After owner approval (or admin approval with owner-granted access), each manual coordination moves to the automation section.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={view} onValueChange={(v) => setView(v as 'MANUAL' | 'AUTOMATION')}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">{isFa ? 'هماهنگی‌های دستی' : 'Manual'}</SelectItem>
            <SelectItem value="AUTOMATION">{isFa ? 'منتقل‌شده به اتوماسیون' : 'In automation'}</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant={autoEnabled ? 'default' : 'outline'} className="text-[10px]">
          {isFa ? (autoEnabled ? 'اتوماسیون فعال است' : 'اتوماسیون غیرفعال — امور دستی') : (autoEnabled ? 'automation on' : 'automation off')}
        </Badge>
        <Button size="sm" onClick={() => setDlg(true)}><Plus className="h-4 w-4" />{isFa ? 'ثبت هماهنگی دستی' : 'Log coordination'}</Button>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {!rows ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{isFa ? 'موردی ثبت نشده است.' : 'Nothing logged yet.'}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-3.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                  <Badge variant="secondary" className="text-[10px]">
                    {r.kind === 'CALL' ? (isFa ? 'تماس' : 'call') : r.kind === 'SCHEDULE' ? (isFa ? 'زمان‌بندی' : 'schedule') : r.kind === 'PAYMENT' ? (isFa ? 'پرداخت' : 'payment') : (isFa ? 'سایر' : 'other')}
                  </Badge>
                  {r.orderId && <span className="text-xs font-bold text-primary" dir="ltr">{isFa ? 'سفارش:' : 'order:'} {r.orderId.slice(-8)}</span>}
                  <span className="text-[11px] text-muted-foreground">{formatJalaliTime(new Date(r.createdAt), lang)} · {r.handledBy}</span>
                  {r.movedToAutomation && <Badge className="bg-emerald-600 text-[10px]"><ListChecks className="me-1 h-3 w-3" />{isFa ? 'اتوماسیون' : 'automation'}</Badge>}
                </div>
                <p className="text-xs leading-6">{r.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {role === 'OWNER' && !r.ownerApproved && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => patch({ id: r.id, ownerApproved: true }, isFa ? 'تأیید مالک ثبت شد' : 'Owner approved')}>
                      <ShieldCheck className="h-3.5 w-3.5" />{isFa ? 'تأیید مالک' : 'Owner approve'}
                    </Button>
                  )}
                  {r.ownerApproved && <Badge variant="secondary" className="text-[10px]"><ShieldCheck className="me-1 h-3 w-3" />{isFa ? 'تأیید مالک ✓' : 'owner ✓'}</Badge>}
                  {role === 'ADMIN' && !r.adminApproved && !r.movedToAutomation && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => patch({ id: r.id, adminApproved: true }, isFa ? 'تأیید ادمین ثبت شد' : 'Admin approved')}>
                      {isFa ? 'تأیید ادمین' : 'Admin approve'}
                    </Button>
                  )}
                  {!r.movedToAutomation && (
                    <Button size="sm" className="h-7 text-[11px]" onClick={() => patch({ id: r.id, move: true }, isFa ? 'به اتوماسیون منتقل شد' : 'Moved to automation')}>
                      {isFa ? 'انتقال به اتوماسیون' : 'Move to automation'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{isFa ? 'ثبت هماهنگی دستی' : 'Log manual coordination'}</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <div className="flex flex-col gap-1.5">
              <Label>{isFa ? 'نوع' : 'Kind'}</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">{isFa ? 'تماس' : 'Call'}</SelectItem>
                  <SelectItem value="SCHEDULE">{isFa ? 'زمان‌بندی' : 'Schedule'}</SelectItem>
                  <SelectItem value="PAYMENT">{isFa ? 'پرداخت' : 'Payment'}</SelectItem>
                  <SelectItem value="OTHER">{isFa ? 'سایر' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>{isFa ? 'کد سفارش (AS-… یا ASP-…) — اختیاری' : 'Order code (optional)'}</Label><Input dir="ltr" value={orderCodeIn} onChange={(e) => setOrderCodeIn(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label>{isFa ? 'خلاصهٔ هماهنگی *' : 'Summary *'}</Label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={isFa ? 'مثلاً: هماهنگی تلفنی نصب کولر — تأیید ساعت ۱۷ چهارشنبه توسط مشتری' : ''} /></div>
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                if (summary.trim().length < 5) { toast.error(isFa ? 'خلاصه را کامل بنویسید' : 'Summary too short'); return; }
                setBusy(true);
                try {
                  await post('/api/admin/coordination', { kind, orderId: orderCodeIn.trim().startsWith('AS-') ? orderCodeIn.trim() : null, productOrderId: orderCodeIn.trim().startsWith('ASP-') ? orderCodeIn.trim() : null, summary: summary.trim() });
                  toast.success(isFa ? 'ثبت شد' : 'Logged');
                  setDlg(false); setSummary(''); setOrderCodeIn('');
                  load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'خطا');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isFa ? 'ثبت' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══ حسابدار هوشمند ══════════════════════════════════════════
interface AuditRow {
  id: string; dateShamsi: string; totalsJson: string; anomaliesJson: string; anomalyCount: number;
  status: string; escalatedToAdmin: boolean; resolvedBy: string | null; resolvedAt: string | null; createdAt: string;
}

export function AuditTab({ lang, role }: { lang: 'fa' | 'en'; role: 'OWNER' | 'ADMIN' }) {
  const isFa = lang === 'fa';
  const [reports, setReports] = useState<AuditRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [frozenAt, setFrozenAt] = useState('');

  const load = useCallback(() => {
    api<{ reports: AuditRow[] }>('/api/admin/audit')
      .then((d) => setReports(d.reports))
      .catch((e) => toast.error(e.message));
    api<{ stats: { operationsFrozen: boolean; frozenAt: string } }>('/api/admin/stats')
      .then((d) => { setFrozen(d.stats.operationsFrozen); setFrozenAt(d.stats.frozenAt); })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function run() {
    setBusy(true);
    try {
      const r = await api<{ anomalyCount: number; status: string }>('/api/admin/audit', { method: 'POST' });
      toast.success(r.status === 'ANOMALY_FROZEN'
        ? `${isFa ? 'حسابرسی انجام شد — خطا یافت شد و عملیات متوقف گردید' : 'Audit done — anomaly found, operations frozen'} (${r.anomalyCount})`
        : isFa ? 'حسابرسی انجام شد — بدون خطا' : 'Audit done — no anomalies');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    try {
      await api('/api/admin/audit', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      toast.success(isFa ? 'فرمان ادامهٔ عملیات صادر شد — سیستم فعال است' : 'Operations resumed');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={run}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}{isFa ? 'اجرای حسابرسی الآن' : 'Run audit now'}</Button>
        <Badge variant={frozen ? 'destructive' : 'secondary'} className="text-[10px]">
          {isFa ? (frozen ? 'عملیات متوقف است' : 'عملیات فعال است') : (frozen ? 'frozen' : 'active')}
        </Badge>
        {frozen && (
          <Button size="sm" className="bg-emerald-600" disabled={busy} onClick={resume}>
            <CheckCircle2 className="h-4 w-4" />
            {role === 'OWNER' ? (isFa ? 'فرمان ادامهٔ عملیات (مالک)' : 'Resume (owner)') : (isFa ? 'فرمان ادامهٔ عملیات (ادمین)' : 'Resume (admin)')}
          </Button>
        )}
        {frozen && frozenAt && <span className="text-[10px] text-muted-foreground">{isFa ? 'از' : 'since'} {formatJalaliTime(new Date(frozenAt), lang)}</span>}
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {isFa
          ? 'حسابدار هوشمند هر شب گزارش حسابرسی را به ایمیل و پنل (مالک و ادمین) ارسال می‌کند. در صورت مشاهدهٔ خطا (ضرر و زیان)، عملیات تا تأیید مالک/مدیر متوقف می‌شود؛ در عدم تأیید مالک تا ۳ ساعت، تأیید ادمین لازم است و پس از فرمان ادامه، دوباره فعال می‌شود.'
          : 'The smart accountant sends nightly audit reports to email and panel; on anomaly, operations freeze until owner (or admin after 3h) approves resumption.'}
      </p>

      {!reports ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{isFa ? 'هنوز حسابرسی اجرا نشده است.' : 'No audit yet.'}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {reports.map((r) => {
            const anomalies: { code: string; severity: string; detail: string }[] = JSON.parse(r.anomaliesJson);
            const totals: Record<string, number> = JSON.parse(r.totalsJson);
            return (
              <Card key={r.id}>
                <CardContent className="p-3.5">
                  <button className="flex w-full flex-wrap items-center gap-2 text-start" onClick={() => setOpenId(openId === r.id ? '' : r.id)}>
                    <ShieldAlert className={`h-4 w-4 ${r.status === 'OK' ? 'text-emerald-600' : r.status === 'RESOLVED' ? 'text-muted-foreground' : 'text-destructive'}`} />
                    <span className="text-sm font-bold">{faDigits(r.dateShamsi)}</span>
                    <Badge className={`text-[10px] ${r.status === 'OK' ? 'bg-emerald-600' : r.status === 'RESOLVED' ? 'bg-secondary' : 'bg-destructive'}`}>
                      {r.status === 'OK' ? (isFa ? 'سالم' : 'OK') : r.status === 'RESOLVED' ? (isFa ? 'برطرف‌شده' : 'resolved') : (isFa ? 'خطا/توقف' : 'frozen')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{isFa ? `${faDigits(r.anomalyCount)} خطا` : `${r.anomalyCount} anomalies`}</span>
                    {r.escalatedToAdmin && r.status === 'ANOMALY_FROZEN' && <Badge variant="outline" className="text-[9px]">{isFa ? 'مجاز برای تأیید ادمین (۳ ساعت گذشت)' : 'admin may resume'}</Badge>}
                    {r.resolvedBy && <span className="text-[10px] text-muted-foreground">{isFa ? 'برطرف توسط' : 'resolved by'}: {r.resolvedBy}</span>}
                    <span className="ms-auto text-[10px] text-muted-foreground">{formatJalaliTime(new Date(r.createdAt), lang)}</span>
                  </button>
                  {openId === r.id && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4">
                        <p className="rounded-lg bg-secondary/60 p-2">{isFa ? 'دریافتی خدمات' : 'Services'}: <b className="ltr-num" dir="ltr">{money(totals.receiptsService ?? 0, lang)}</b></p>
                        <p className="rounded-lg bg-secondary/60 p-2">{isFa ? 'دریافتی کالا' : 'Goods'}: <b className="ltr-num" dir="ltr">{money(totals.receiptsGoods ?? 0, lang)}</b></p>
                        <p className="rounded-lg bg-secondary/60 p-2">{isFa ? 'حق معرف پرداخت‌نشده' : 'Unpaid referrals'}: <b>{faDigits(totals.unpaidReferralsAmount ?? 0)}</b></p>
                        <p className="rounded-lg bg-secondary/60 p-2">{isFa ? 'انجام‌شده بدون تسویه' : 'Done w/o settle'}: <b>{faDigits(totals.doneNotSettled ?? 0)}</b></p>
                      </div>
                      {anomalies.length > 0 && (
                        <div className="as-scroll max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs leading-6">
                          {anomalies.map((a, idx) => (
                            <p key={idx}><b className={a.severity === 'HIGH' ? 'text-destructive' : 'text-amber-600'}>[{a.severity === 'HIGH' ? (isFa ? 'بحرانی' : 'HIGH') : (isFa ? 'هشدار' : 'MED')}]</b> {a.detail}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ دستیار هوشمند ════════════════════════════════════════════
interface ChatMsg { role: 'user' | 'bot'; text: string; engine?: string }

export function AssistantTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: 'bot', text: isFa
      ? 'سلام 👋 من دستیار هوشمند پنل ألو شتاب هستم. دربارهٔ موجودی کالا، گزارش روزانهٔ قیمت، سفارش‌ها، مراحل فاکتور، هماهنگی‌ها، حسابدار هوشمند و صف تأییدها بپرسید.'
      : 'Hi! I am the Alo Shetab panel assistant. Ask about inventory, daily price reports, orders, invoice stages, coordination, audit or approval queues.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function ask(q?: string) {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);
    try {
      const d = await post<{ answer: string; engine: string }>('/api/admin/ai', { question });
      setMsgs((m) => [...m, { role: 'bot', text: d.answer, engine: d.engine }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'bot', text: e instanceof Error ? e.message : 'خطا' }]);
    } finally {
      setBusy(false);
    }
  }

  const chips = isFa
    ? ['وضعیت امروز پنل چیست؟', 'موجودی کالا چند است؟', 'صف تأییدها چه چیزی مانده؟', 'وضعیت حسابرسی؟', 'هماهنگی‌های دستی چقدر مانده؟']
    : ['Today status?', 'Goods inventory?', 'Pending approvals?', 'Audit status?', 'Manual coordinations?'];

  return (
    <div className="mt-4">
      <Card>
        <CardContent className="p-0">
          <div className="as-scroll max-h-[420px] min-h-64 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-7 whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-secondary/50'}`}>
                  {m.text}
                  {m.engine && <span className="mt-1 block text-[9px] opacity-60">{m.engine === 'LLM' ? '🧠 AI' : '⚙️ rules + live data'}</span>}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="rounded-2xl border bg-secondary/50 px-3.5 py-2.5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div></div>}
            <div ref={endRef} />
          </div>
          <Separator />
          <div className="p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button key={c} className="rounded-full border px-2.5 py-1 text-[10px] text-muted-foreground transition hover:border-primary hover:text-primary" onClick={() => ask(c)}>{c}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                placeholder={isFa ? 'سؤال خود را بپرسید…' : 'Ask anything…'}
              />
              <Button size="icon" disabled={busy} onClick={() => ask()} aria-label="send"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ پیشنهادهای قیمت کالا (کارشناس/گزارش روزانه) ═══════════
interface ProposalRow {
  id: string; oldPrice: number; newPrice: number; basePrice: number | null; rule: string | null;
  reason: string | null; source: string; status: string; proposedBy: string;
  decidedBy: string | null; createdAt: string;
  product: { nameFa: string; nameEn: string; key: string; section: string };
}

export function ProposalsTab({ lang }: { lang: 'fa' | 'en' }) {
  const isFa = lang === 'fa';
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    api<{ proposals: ProposalRow[] }>(`/api/admin/proposals?status=${status}`)
      .then((d) => setRows(d.proposals))
      .catch((e) => toast.error(e.message));
  }, [status]);
  useEffect(load, [load]);

  async function decide(proposalId: string, approve: boolean) {
    setBusyId(proposalId);
    try {
      await post('/api/admin/inventory', { action: 'decide-proposal', proposalId, approve });
      toast.success(approve ? (isFa ? 'تأیید و در میز کالا اعمال شد' : 'Applied') : (isFa ? 'رد شد' : 'Rejected'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mt-4">
      <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-6">
        {isFa
          ? 'کارشناس در صورت ناهمخوانی قیمت کالا با بازار، قیمت اصلاحی را پیشنهاد می‌دهد و پس از تأیید پشتیبانی/ادمین، قیمت جایگزین می‌شود. پیشنهادهای «گزارش روزانه» نیز پس از تأیید همین‌جا قابل مشاهده‌اند.'
          : 'Expert corrections and daily-report proposals appear here; approval replaces the price.'}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">{isFa ? 'در انتظار' : 'Pending'}</SelectItem>
            <SelectItem value="APPROVED">{isFa ? 'تأییدشده' : 'Approved'}</SelectItem>
            <SelectItem value="REJECTED">{isFa ? 'ردشده' : 'Rejected'}</SelectItem>
            <SelectItem value="ALL">{isFa ? 'همه' : 'All'}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {!rows ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{isFa ? 'پیشنهادی در این وضعیت نیست.' : 'Nothing here.'}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 text-sm">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-bold">{r.product.nameFa}</span>
                <Badge variant="outline" className="text-[9px]">{r.product.section === 'GOODS' ? (isFa ? 'کالا' : 'goods') : (isFa ? 'نرم‌افزار' : 'software')}</Badge>
                <Badge variant="secondary" className="text-[9px]">{r.source === 'DAILY_REPORT' ? (isFa ? 'گزارش روزانه' : 'daily') : (isFa ? 'کارشناس' : 'expert')}</Badge>
                <span className="ltr-num text-xs text-muted-foreground line-through" dir="ltr">{money(r.oldPrice, lang)}</span>
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="ltr-num font-extrabold text-primary" dir="ltr">{money(r.newPrice, lang)}</span>
                {r.reason && <span className="text-[11px] text-muted-foreground">{isFa ? 'دلیل' : 'reason'}: {r.reason}</span>}
                <span className="text-[10px] text-muted-foreground">{r.proposedBy} · {formatJalaliTime(new Date(r.createdAt), lang)}</span>
                {r.status === 'PENDING' ? (
                  <div className="ms-auto flex gap-1.5">
                    <Button size="sm" className="h-7 text-[11px]" disabled={busyId === r.id} onClick={() => decide(r.id, true)}><CheckCircle2 className="h-3.5 w-3.5" />{isFa ? 'تأیید' : 'Approve'}</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busyId === r.id} onClick={() => decide(r.id, false)}><XCircle className="h-3.5 w-3.5" />{isFa ? 'رد' : 'Reject'}</Button>
                  </div>
                ) : (
                  <Badge variant="secondary" className="ms-auto text-[10px]">{r.status === 'APPROVED' ? (isFa ? 'اعمال شد' : 'applied') : (isFa ? 'رد شد' : 'rejected')}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
