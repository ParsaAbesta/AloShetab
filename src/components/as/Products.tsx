'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Loader2, BadgeCheck, ShoppingCart, Wrench, CalendarDays, Landmark, Copy, ShieldCheck, Cpu } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';
import { money, moneyLabel, ProductIconView, faDigits } from './util';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface WarehousePriceLite {
  name: string;
  price: number; // قیمت انبار (ارائه‌شده)
  stockQty: number | null;
  shamsi: string | null;
}

interface ProductLite {
  key: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  price: number; // پایهٔ فروش = گران‌ترین فروشگاه (پلن v3)
  icon: string;
  warranty: string | null;
  section: 'GOODS' | 'SOFTWARE';
  category: string;
  brand: string | null;
  model: string | null;
  baseSource: string | null;
  sourceUrl?: string | null;
  refPrice?: number | null;
  priceDate: string | null;
  priceRule: string;
  priceStatus: string;
  stock: number; // موجودی از بروزترین انبار
  stockSource?: string | null; // نام انبار بروزترین موجودی
  sellBaseStore?: string | null; // نام گران‌ترین فروشگاه
  warehousePrices?: WarehousePriceLite[]; // لیست بروزترین قیمت بروزترین انبارها
  buyWarehouse?: { name: string; price: number } | null; // ارزان‌ترین انبار
  offersCount?: number; // تعداد مجموعه‌های مقایسه‌شده
  expertSharePct: number; // سهم کارشناس (۰٫۱۶۵–۰٫۲+)
  platformMarginPct: number; // افزایش قیمت پلتفرم (۰٫۱–۰٫۱۶۵)
  markupPct: number; // جمع افزودنی پرداخت
  courierFee: number; // هزینهٔ ارسال و بسته‌بندی (پیک) — نرم‌افزار: ۰
  warehouse?: { nameFa: string; website: string | null; linkTemplate: string | null } | null;
}

interface OrderResult {
  code: string;
  total: number;
  goodsTotal: number; // پایهٔ فروش (گران‌ترین فروشگاه) × تعداد
  expertSharePct: number;
  platformMarginPct: number;
  markupPct: number;
  expertShareAmount: number;
  platformMarginAmount: number;
  markupAmount: number;
  courierFee: number;
  servicesTotal: number;
  minInvoice: number;
  minInvoiceAdj: number;
  leadTimeDays: string;
  paySheba: boolean;
  sheba: string | null;
  pol: string | null;
  accountName: string;
  nameFa: string;
}

// ─── سفارش خدمات کنار خرید (پیام ۱۱) ─────────────────────────
const ADDON_SERVICES = [
  { key: 'install', fa: 'نصب و راه‌اندازی در محل', en: 'On-site installation', price: 850_000 },
  { key: 'setup', fa: 'راه‌اندازی و تنظیمات نرم‌افزاری', en: 'Software setup', price: 600_000 },
  { key: 'training', fa: 'آموزش استفاده از دستگاه', en: 'Usage training', price: 450_000 },
  { key: 'moving', fa: 'حمل تا طبقه و نصب نهایی', en: 'Carry to floor & final install', price: 700_000 },
];

function OrderDialog({ p, lang, minInvoice, onClose }: { p: ProductLite; lang: 'fa' | 'en'; minInvoice: number; onClose: () => void }) {
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [plaque, setPlaque] = useState('');
  const [floor, setFloor] = useState('');
  const [unit, setUnit] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<OrderResult | null>(null);
  const fa = lang === 'fa';

  const servicesTotal = ADDON_SERVICES.filter((a) => addons[a.key]).reduce((s, a) => s + a.price, 0);
  // برآورد صفحهٔ پرداخت (پلن v3) — محاسبهٔ قطعی سمت سرور انجام می‌شود
  const listTotal = p.price * qty;
  const estExpert = Math.round((listTotal * p.expertSharePct) / 1000) * 1000;
  const estPlatform = Math.round((listTotal * p.platformMarginPct) / 1000) * 1000;
  const estMarkup = estExpert + estPlatform;
  const estCourier = p.courierFee;
  const beforeMin = listTotal + estMarkup + estCourier + servicesTotal;
  const minAdj = Math.max(0, minInvoice - beforeMin);
  const total = beforeMin + minAdj;
  const expertFa = faDigits(String(Math.round(p.expertSharePct * 100)));
  const platformFa = faDigits(String(Math.round(p.platformMarginPct * 100)));

  async function submit() {
    if (fullName.trim().length < 3 || !/^09\d{9}$/.test(mobile.trim()) || address.trim().length < 10) {
      toast({ title: fa ? 'لطفاً نام، موبایل (۰۹…) و آدرس دقیق را کامل وارد کنید.' : 'Please fill name, mobile (09…) and exact address.', variant: 'destructive' });
      return;
    }
    if (!plaque.trim() || !floor.trim() || !unit.trim()) {
      toast({
        title: fa
          ? 'ثبت آدرس دقیق الزامی است: پلاک، طبقه و واحد را کامل وارد کنید. (کد پستی اختیاری ولی ترجیحی است)'
          : 'Exact address is required: plaque, floor and unit. (Postal code optional but preferred)',
        variant: 'destructive',
      });
      return;
    }
    if (postalCode.trim() && !/^\d{10}$/.test(postalCode.trim())) {
      toast({ title: fa ? 'کد پستی باید ۱۰ رقم باشد (یا خالی بگذارید).' : 'Postal code must be 10 digits (or leave empty).', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/products/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey: p.key,
          qty,
          fullName: fullName.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
          plaque: plaque.trim(),
          floor: floor.trim(),
          unit: unit.trim(),
          postalCode: postalCode.trim() || null,
          serviceItems: ADDON_SERVICES.filter((a) => addons[a.key]).map((a) => ({ title: fa ? a.fa : a.en, price: a.price, qty: 1 })),
          notes: notes.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? 'error');
      setDone(d);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t('errGeneric', lang), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function copyText(v: string) {
    navigator.clipboard?.writeText(v).then(() => toast({ title: fa ? 'کپی شد' : 'Copied' })).catch(() => {});
  }

  const toFa = (s: string) => s.replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]);

  return (
    <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto as-scroll">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          {t('productOrder', lang)} — {fa ? p.nameFa : p.nameEn}
        </DialogTitle>
        <DialogDescription className="text-start leading-6 pt-1">{fa ? p.descFa : p.descEn}</DialogDescription>
      </DialogHeader>

      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
            <BadgeCheck className="h-6 w-6" />
          </span>
          <p className="text-sm font-bold leading-6">{t('poDone', lang)}</p>
          <p className="text-xs text-muted-foreground">{t('poCode', lang)}:</p>
          <p className="rounded-lg bg-secondary px-4 py-2 text-lg font-extrabold tracking-wider" dir="ltr">{done.code}</p>
          <div className="w-full rounded-xl bg-secondary/60 p-3 text-xs leading-6 text-start">
            <p className="flex justify-between"><span>{fa ? 'پایهٔ فروش (گران‌ترین فروشگاه) × تعداد' : 'Sell base (priciest store) × qty'}</span><b className="ltr-num" dir="ltr">{money(done.goodsTotal, lang)}</b></p>
            <p className="flex justify-between"><span>{fa ? `سهم کارشناس +${toFa(String(Math.round(done.expertSharePct * 100)))}٪` : `Expert share +${Math.round(done.expertSharePct * 100)}%`}</span><b className="ltr-num" dir="ltr">{money(done.expertShareAmount, lang)}</b></p>
            <p className="flex justify-between"><span>{fa ? `افزایش قیمت پلتفرم +${toFa(String(Math.round(done.platformMarginPct * 100)))}٪` : `Platform margin +${Math.round(done.platformMarginPct * 100)}%`}</span><b className="ltr-num" dir="ltr">{money(done.platformMarginAmount, lang)}</b></p>
            {done.courierFee > 0 && (
              <p className="flex justify-between"><span>{fa ? 'هزینهٔ ارسال و بسته‌بندی (پیک)' : 'Shipping & packaging (courier)'}</span><b className="ltr-num" dir="ltr">{money(done.courierFee, lang)}</b></p>
            )}
            {done.servicesTotal > 0 && (
              <p className="flex justify-between"><span>{fa ? 'خدمات کنار خرید' : 'Add-on services'}</span><b className="ltr-num" dir="ltr">{money(done.servicesTotal, lang)}</b></p>
            )}
            {done.minInvoiceAdj > 0 && (
              <p className="flex justify-between text-amber-700 dark:text-amber-400"><span>{fa ? `تعدیل به حداقل فاکتور (${money(done.minInvoice, lang)})` : `Min-invoice adjustment (${money(done.minInvoice, lang)})`}</span><b className="ltr-num" dir="ltr">+ {money(done.minInvoiceAdj, lang)}</b></p>
            )}
            <p className="flex justify-between border-t pt-1.5 mt-1.5"><span>{fa ? 'مبلغ قابل پرداخت' : 'Payable'}</span><b className="ltr-num text-primary" dir="ltr">{money(done.total, lang)}</b></p>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {fa ? `بازهٔ رسیدگی: ${toFa(done.leadTimeDays)} روز` : `Lead time: ${done.leadTimeDays} days`}
            </p>
          </div>
          {done.paySheba && done.sheba && (
            <div className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-6 text-start">
              <p className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <Landmark className="h-4 w-4" />
                {fa ? `فاکتور ≥ ${money(done.minInvoice, lang)} ${moneyLabel(lang)} — دریافت از طریق شبا/پل انجام شود` : `Invoice ≥ ${done.minInvoice.toLocaleString()} — pay via Sheba/card transfer`}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-2" dir="ltr">
                <code className="text-[13px] font-bold tracking-wide">{done.sheba.replace(/^(IR.{2})(.{4})(.{4})(.{4})(.{4})(.{4})(.+)$/, '$1 $2 $3 $4 $5 $6 $7')}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyText(done.sheba!)} aria-label="copy sheba"><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              {done.pol && (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-2" dir="ltr">
                  <code className="text-[13px] font-bold tracking-wide">{done.pol.replace(/(\d{4})(?=\d)/g, '$1-')}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyText(done.pol!)} aria-label="copy card"><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-muted-foreground">{fa ? 'شبای حساب دریافت — بانک مهر ایران، به نام ألو شتاب — پس از واریز، کد سفارش را در پیگیری ثبت کنید؛ رسید به پنل ادمین ارسال و به پروندهٔ مشتری الصاق می‌شود.' : 'Receiving Sheba — Bank Mehr Iran — after transfer, enter the order code in tracking; receipt goes to the admin panel and customer file.'}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          {/* قیمت و بازهٔ رسیدگی */}
          <div className="rounded-xl bg-secondary/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('productTotal', lang)}:</span>
              <span className="font-extrabold text-primary ltr-num" dir="ltr">{money(total, lang)} {moneyLabel(lang)}</span>
            </div>
            {p.section === 'GOODS' && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {fa
                  ? `رسیدگی به امور کالا بین ۳ تا ۷ روز${servicesTotal > 0 ? ' — هماهنگی خدمات ۱ تا ۳ روز با تأیید ساعت و زمان شما' : ''}`
                  : `Goods handling takes 3–7 days${servicesTotal > 0 ? ' — service coordination 1–3 days after your time confirmation' : ''}`}
              </div>
            )}
          </div>

          {/* ریزدیسکی صفحهٔ پرداخت — پلن v3: پایهٔ فروش گران‌ترین فروشگاه + کارشناس + پلتفرم + پیک */}
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-6">
            <p className="mb-1 font-bold">{fa ? 'ریزدیسکی پرداخت — پلن v3' : 'Checkout breakdown — Plan v3'}</p>
            <p className="flex justify-between"><span>{fa ? 'پایهٔ فروش (گران‌ترین فروشگاه) × تعداد' : 'Sell base (priciest store) × qty'}</span><b className="ltr-num" dir="ltr">{money(listTotal, lang)}</b></p>
            <p className="flex justify-between"><span>{fa ? `سهم کارشناس +${expertFa}٪` : `Expert share +${Math.round(p.expertSharePct * 100)}%`}</span><b className="ltr-num" dir="ltr">{money(estExpert, lang)}</b></p>
            <p className="flex justify-between"><span>{fa ? `افزایش قیمت پلتفرم +${platformFa}٪` : `Platform margin +${Math.round(p.platformMarginPct * 100)}%`}</span><b className="ltr-num" dir="ltr">{money(estPlatform, lang)}</b></p>
            <p className="flex justify-between"><span>{fa ? 'هزینهٔ ارسال و بسته‌بندی (پیک)' : 'Shipping & packaging (courier)'}</span><b className="ltr-num" dir="ltr">{estCourier === 0 ? (fa ? 'ارسال دیجیتال' : 'digital delivery') : money(estCourier, lang)}</b></p>
            {servicesTotal > 0 && (
              <p className="flex justify-between"><span>{fa ? 'خدمات کنار خرید' : 'Add-on services'}</span><b className="ltr-num" dir="ltr">{money(servicesTotal, lang)}</b></p>
            )}
            {minAdj > 0 && (
              <p className="flex justify-between text-amber-700 dark:text-amber-400"><span>{fa ? `تعدیل به حداقل فاکتور (${money(minInvoice, lang)})` : `Min-invoice adjustment`}</span><b className="ltr-num" dir="ltr">+ {money(minAdj, lang)}</b></p>
            )}
            <p className="flex justify-between border-t pt-1.5 mt-1"><span className="font-bold">{fa ? 'مبلغ قابل پرداخت' : 'Payable'}</span><b className="ltr-num text-primary" dir="ltr">{money(total, lang)}</b></p>
            <p className="mt-1 text-[10px] text-muted-foreground">{fa ? 'پایهٔ فروش = قیمت گران‌ترین فروشگاه؛ افزودنی = سهم کارشناس (۱۶٫۵ تا ۲۰٪ یا بیشتر) + افزایش قیمت پلتفرم (۱۰ تا ۱۶٫۵٪). محاسبهٔ قطعی هنگام ثبت سمت سرور انجام می‌شود.' : 'Sell base = priciest store; markup = expert share (16.5–20%+) + platform margin (10–16.5%). Server computes the authoritative amount.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t('productQty', lang)}</Label>
              <Input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('fullName', lang)} *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('yourName', lang)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('mobile', lang)} *</Label>
            <Input dir="ltr" className="ltr-num" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09xxxxxxxxx" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('address', lang)} *</Label>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          {/* آدرس دقیق — پلاک/طبقه/واحد الزامی، کدپستی اختیاری */}
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{fa ? 'پلاک *' : 'No. *'}</Label>
              <Input value={plaque} onChange={(e) => setPlaque(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{fa ? 'طبقه *' : 'Floor *'}</Label>
              <Input value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{fa ? 'واحد *' : 'Unit *'}</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{fa ? 'کدپستی' : 'Postal'}</Label>
              <Input dir="ltr" className="ltr-num" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={fa ? 'اختیاری' : 'optional'} />
            </div>
          </div>

          {/* سفارش خدمات کنار خرید */}
          <div className="space-y-2 rounded-xl border border-primary/25 p-3">
            <Label className="flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-primary" />
              {fa ? 'سفارش خدمات کنار خرید (نصب، راه‌اندازی و...)' : 'Add-on services (installation, setup…)'}
            </Label>
            {ADDON_SERVICES.map((a) => (
              <div key={a.key} className="flex items-center gap-2">
                <Checkbox
                  id={`ad-${a.key}`}
                  checked={!!addons[a.key]}
                  onCheckedChange={(v) => setAddons((s) => ({ ...s, [a.key]: !!v }))}
                />
                <label htmlFor={`ad-${a.key}`} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
                  {fa ? a.fa : a.en}
                </label>
                <span className="text-xs text-muted-foreground ltr-num" dir="ltr">{a.price === 0 ? (fa ? 'همراه خرید' : 'included') : money(a.price, lang)}</span>
              </div>
            ))}
            {servicesTotal > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {fa ? `جمع خدمات: ${money(servicesTotal, lang)} ${moneyLabel(lang)} — پس از رسیدگی کالا (۳ تا ۷ روز)، هماهنگی خدمات در ۱ تا ۳ روز با تأیید ساعت و زمان شما انجام می‌شود.` : `Services total: ${money(servicesTotal, lang)} — service coordination takes 1–3 days with your time confirmation.`}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('needs', lang)}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('needsHint', lang)} />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-5 text-amber-700 dark:text-amber-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {fa
              ? `حداقل مبلغ هر فاکتور ${money(minInvoice, lang)} ${moneyLabel(lang)} است؛ اگر جمع سفارش کمتر باشد، در همین صفحه به این سقف تعدیل می‌شود. دریافت از طریق شبای حساب دریافت (بانک مهر ایران) انجام می‌گیرد.`
              : `Minimum invoice amount is ${minInvoice.toLocaleString()} Toman; smaller orders are adjusted up to this floor at checkout. Payment is received via the receiving Sheba (Bank Mehr Iran).`}
          </div>

          <Button onClick={submit} disabled={busy} className="mt-1">
            {busy ? (<><Loader2 className="h-4 w-4 animate-spin" />{t('poBusy', lang)}</>) : (<><ShoppingCart className="h-4 w-4" />{t('poSubmit', lang)}</>)}
          </Button>
        </div>
      )}
    </DialogContent>
  );
}

function ProductCard({ p, lang, onOrder }: { p: ProductLite; lang: 'fa' | 'en'; onOrder: (p: ProductLite) => void }) {
  const fa = lang === 'fa';
  const isGoods = p.section === 'GOODS';
  const whList = (p.warehousePrices ?? []).slice(0, 4); // لیست بروزترین قیمت انبارها (ارزان‌ترین اول)
  return (
    <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ProductIconView k={p.icon} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-6">{fa ? p.nameFa : p.nameEn}</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.warranty && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <BadgeCheck className="h-3 w-3 text-emerald-600" />
                  {p.warranty}
                </Badge>
              )}
              {isGoods && p.brand && <Badge variant="outline" className="text-[10px]">{p.brand}</Badge>}
              {isGoods && (p.stock > 0 || p.stockSource) ? (
                <Badge variant="outline" className="text-[10px] gap-1" title={p.stockSource ?? ''}>
                  <Cpu className="h-3 w-3" />
                  {fa ? `موجودی: ${faDigits(p.stock)}` : `Stock: ${p.stock}`}
                  {p.stockSource ? ` · ${p.stockSource}` : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-amber-600">{fa ? 'سفارشی' : 'On request'}</Badge>
              )}
            </div>
          </div>
        </div>
        <p className="flex-1 text-xs leading-5 text-muted-foreground line-clamp-3">{fa ? p.descFa : p.descEn}</p>
        {/* پلن v3: لیست بروزترین قیمت بروزترین انبارها — ارزان‌ترین اول */}
        {isGoods && whList.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-2">
            <p className="mb-1 text-[10px] font-bold text-primary">
              {fa ? 'بروزترین قیمت انبارها (ارزان‌ترین اول — خرید از ارزان‌ترین):' : 'Latest warehouse prices (cheapest first):'}
            </p>
            <div className="space-y-0.5">
              {whList.map((w, i) => (
                <p key={`${w.name}-${w.shamsi}-${i}`} className="flex items-center justify-between gap-2 text-[10px] leading-4">
                  <span className="min-w-0 truncate" title={w.name}>
                    {i === 0 && <Badge className="me-1 px-1 py-0 text-[8px]" variant="default">{fa ? 'خرید' : 'buy'}</Badge>}
                    {w.name}
                  </span>
                  <span className="shrink-0 ltr-num" dir="ltr">{money(w.price, lang)}{w.stockQty != null ? ` · ${fa ? `موجودی ${faDigits(w.stockQty)}` : `stock ${w.stockQty}`}` : ''}</span>
                </p>
              ))}
            </div>
          </div>
        )}
        {isGoods && (p.sellBaseStore || p.priceDate) && (
          <p className="text-[10px] leading-4 text-muted-foreground/80">
            {fa ? 'پایهٔ فروش — گران‌ترین فروشگاه' : 'Sell base — priciest store'}: {p.sellBaseStore ?? p.baseSource ?? '—'}
            {p.priceDate ? ` · ${faDigits(p.priceDate)}` : ''}
            {p.offersCount ? ` · ${fa ? `مقایسهٔ ${faDigits(p.offersCount)} مجموعه` : `${p.offersCount} sources compared`}` : ''}
            <span className="text-emerald-600 dark:text-emerald-400"> · {fa ? 'قیمت بروز ✓' : 'fresh ✓'}</span>
          </p>
        )}
        {!isGoods && (
          <p className="text-[10px] leading-4 text-muted-foreground/80">
            {fa ? 'قیمت نهایی — ارسال و نصب دیجیتال؛ افزودنی پرداخت در صفحهٔ پرداخت لحاظ می‌شود' : 'Final price — digital delivery; checkout markup applies at payment'}
          </p>
        )}
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-extrabold text-primary ltr-num" dir="ltr">{money(p.price, lang)}</p>
            <p className="text-[10px] text-muted-foreground">
              {isGoods
                ? (fa ? `پایهٔ فروش · کارشناس +${faDigits(String(Math.round(p.expertSharePct * 100)))}٪ و پلتفرم +${faDigits(String(Math.round(p.platformMarginPct * 100)))}٪ و پیک در پرداخت` : `Sell base · expert +${Math.round(p.expertSharePct * 100)}% & platform +${Math.round(p.platformMarginPct * 100)}% & courier at checkout`)
                : moneyLabel(lang)}
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => onOrder(p)}>
            <ShoppingCart className="h-4 w-4" />
            {t('productOrder', lang)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Products() {
  const { lang } = useAs();
  const [products, setProducts] = useState<ProductLite[] | null>(null);
  const [selected, setSelected] = useState<ProductLite | null>(null);
  const [minInvoice, setMinInvoice] = useState(5_000_000);
  const fa = lang === 'fa';

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products ?? []);
        if (d.checkout?.minInvoice) setMinInvoice(d.checkout.minInvoice);
      })
      .catch(() => setProducts([]));
  }, []);

  const goods = useMemo(() => (products ?? []).filter((p) => p.section === 'GOODS'), [products]);
  const software = useMemo(() => (products ?? []).filter((p) => p.section === 'SOFTWARE'), [products]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 pb-10">
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-5 py-10 sm:px-10 text-primary-foreground shadow-lg">
        <div className="absolute -top-14 -end-14 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-snug">{t('productsTitle', lang)}</h1>
          <p className="mt-3 text-sm sm:text-base leading-7 opacity-90">{t('productsSub', lang)}</p>
        </div>
      </section>

      {!products ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('loading', lang)}
        </div>
      ) : (
        <Tabs defaultValue="goods" className="mt-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="goods" className="gap-1.5">
              <Package className="h-4 w-4" />
              {t('tabGoods', lang)} <Badge variant="secondary" className="text-[10px]">{faDigits(goods.length)}</Badge>
            </TabsTrigger>
            <TabsTrigger value="software" className="gap-1.5">
              <Cpu className="h-4 w-4" />
              {t('tabSoftware', lang)} <Badge variant="secondary" className="text-[10px]">{faDigits(software.length)}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goods" className="mt-4">
            {goods.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/[0.04] p-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Package className="h-7 w-7" />
                </span>
                <p className="mt-4 text-sm font-bold leading-7">{t('emptyProducts', lang)}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {goods.map((p) => (
                  <ProductCard key={p.key} p={p} lang={lang} onOrder={setSelected} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="software" className="mt-4">
            {software.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/[0.04] p-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Cpu className="h-7 w-7" />
                </span>
                <p className="mt-4 text-sm font-bold leading-7">{t('emptySoftware', lang)}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {software.map((p) => (
                  <ProductCard key={p.key} p={p} lang={lang} onOrder={setSelected} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {selected && (
        <Dialog open onOpenChange={(o) => !o && setSelected(null)}>
          <OrderDialog p={selected} lang={lang} minInvoice={minInvoice} onClose={() => setSelected(null)} />
        </Dialog>
      )}
    </div>
  );
}
