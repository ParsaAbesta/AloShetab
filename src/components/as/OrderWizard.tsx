'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Minus, Plus, MapPin, Check, ChevronLeft, ChevronRight, Trash2, Wifi, Store, UserRound, ClipboardList, ReceiptText, Sparkles, CreditCard, Copy, Printer, Package } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';
import { factor, money, moneyLabel, faDigits, ServiceIconView, svcName, type ServiceLite } from './util';
import GatewayDialog from './Gateway';
import type { LastOrderInfo } from './store';

interface QuotePart { key: string; nameFa: string; nameEn?: string; unitPrice: number; qty: number; lineTotal: number }
interface QuoteLine { serviceKey: string; qty: number; baseRate: number; lineTotal: number }
interface Quote {
  lines: QuoteLine[];
  subtotal: number; weekFactor: number; hourFactor: number; dayFactor: number;
  dayLabelFa: string; dayLabelEn: string; modeFactor: number;
  grossTotal: number; serviceMarkupPct?: number; serviceMarkup?: number;
  referralPercent: number; discount: number; total: number;
  minInvoice?: number; minInvoiceAdj?: number;
  parts?: QuotePart[]; partsTotal?: number; grandTotal?: number;
}
interface PartLite { key: string; nameFa: string; nameEn: string; unitPrice: number; basePrice: number; icon?: string }
interface PartSel { on: boolean; qty: number; model: string }

const STEPS = ['stepServices', 'stepInfo', 'stepMode', 'stepQuote', 'stepPay', 'stepDone'] as const;

interface CustomerForm {
  fullName: string; nationalId: string; mobile: string; landline: string;
  address: string; needs: string; lat: number | null; lng: number | null;
}

const EMPTY_CUSTOMER: CustomerForm = { fullName: '', nationalId: '', mobile: '', landline: '', address: '', needs: '', lat: null, lng: null };

function StepHeader({ step, lang }: { step: number; lang: 'fa' | 'en' }) {
  return (
    <div className="mb-6 overflow-x-auto as-scroll">
      <div className="flex items-center gap-1.5 min-w-max pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/25 text-[10px]">
                {i < step ? <Check className="h-3 w-3" /> : money(i + 1, lang)}
              </span>
              {t(s, lang)}
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-4 rounded ${i < step ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderWizard() {
  const { lang, cart, setQty, removeFromCart, miscNotes, setMiscNotes, clearCart, lastOrder, setLastOrder, setView, setTrackPrefill } = useAs();
  const [services, setServices] = useState<ServiceLite[] | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<CustomerForm>(EMPTY_CUSTOMER);
  const [mode, setMode] = useState<'ONSITE' | 'REMOTE'>('ONSITE');
  const [referralCode, setReferralCode] = useState('');
  const [refState, setRefState] = useState<'idle' | 'valid' | 'invalid' | 'self' | 'checking'>('idle');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'price' | 'expert'>('idle');
  const [aiPrice, setAiPrice] = useState<number | null>(null);
  const [aiNote, setAiNote] = useState('');
  const [order, setOrder] = useState<{ code: string; needsExpertise: boolean; total: number; minInvoiceAdj: number } | null>(null);
  const [lastRrn, setLastRrn] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'GATEWAY' | 'CARD_TRANSFER' | null>(null);
  const [gwOpen, setGwOpen] = useState(false);
  const [terms, setTerms] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [parts, setParts] = useState<PartLite[] | null>(null);
  const [partSel, setPartSel] = useState<Record<string, PartSel>>({});

  const isFa = lang === 'fa';

  useEffect(() => {
    // خدمات هر دو نسخه (ایران v1 + جهانی v2.0) برای پوشش کامل سبد + کاتالوگ قطعات
    Promise.all([
      fetch('/api/services?edition=IRAN').then((r) => r.json()),
      fetch('/api/services?edition=WORLD').then((r) => r.json()),
      fetch('/api/parts').then((r) => r.json()),
    ])
      .then(([a, w, p]) => {
        setServices([...(a.services ?? []), ...(w.services ?? [])]);
        setParts(p.parts ?? []);
      })
      .catch(() => {
        setServices([]);
        setParts([]);
      });
  }, []);

  const svcByKey = useMemo(() => new Map((services ?? []).map((s) => [s.key, s])), [services]);
  const cartLines = cart.map((c) => ({ ...c, svc: svcByKey.get(c.key) })).filter((c) => c.svc);
  const hasMisc = cart.some((c) => c.key === 'misc');
  const hasNonRemote = cartLines.some((c) => c.svc && !c.svc.remoteCapable);

  const detailExtraOf = (key: string, ids?: string[]) => {
    if (!ids?.length) return 0;
    const dets = svcByKey.get(key)?.details ?? [];
    return ids.reduce((s, id) => s + (dets.find((d) => d.id === id)?.price ?? 0), 0);
  };
  const baseSubtotal = cartLines.reduce((s, c) => s + ((c.svc!.baseRate || aiPrice || 0) + detailExtraOf(c.key, c.details)) * c.qty, 0);
  const partsSelTotal = Object.entries(partSel).filter(([, v]) => v.on).reduce((s, [k, v]) => s + (parts?.find((p) => p.key === k)?.unitPrice ?? 0) * v.qty, 0);

  // ─── اعتبارسنجی گام‌ها ───
  function validateStep(current: number): boolean {
    const e: Record<string, string> = {};
    if (current === 0) {
      if (cart.length === 0) e.cart = isFa ? 'حداقل یک خدمت انتخاب کنید' : 'Select at least one service';
      if (hasMisc && (!miscNotes || miscNotes.trim().length < 15)) {
        e.miscNotes = isFa ? 'برای متفرقه، شرح نیاز (حداقل ۱۵ کاراکتر) الزامی است' : 'For misc, describe your need (min 15 chars)';
      }
    }
    if (current === 1) {
      if (customer.fullName.trim().length < 3) e.fullName = isFa ? 'نام و نام خانوادگی کامل را وارد کنید' : 'Enter full name';
      if (!/^\d{10}$/.test(customer.nationalId.trim())) e.nationalId = isFa ? 'کد ملی باید دقیقاً ۱۰ رقم باشد' : 'National ID must be exactly 10 digits';
      if (!/^09\d{9}$/.test(customer.mobile.trim())) e.mobile = isFa ? 'تلفن همراه باید ۱۱ رقم و با ۰۹ شروع شود' : 'Mobile must be 11 digits starting with 09';
      if (customer.landline.trim() && !/^0\d{9,10}$/.test(customer.landline.trim())) e.landline = isFa ? 'تلفن ثابت نامعتبر است' : 'Invalid landline';
      if (customer.address.trim().length < 10) e.address = isFa ? 'آدرس دقیق را کامل‌تر بنویسید (حداقل ۱۰ کاراکتر)' : 'Address is too short (min 10 chars)';
    }
    if (current === 2) {
      if (mode === 'REMOTE' && hasNonRemote) e.mode = isFa ? 'برخی خدمات انتخابی از راه دور قابل انجام نیستند' : 'Some selected services cannot be done remotely';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function next() {
    if (!validateStep(step)) return;
    // هنگام ترک گام «نحوهٔ انجام»، کوت سرور گرفته و پیش‌فاکتور پر می‌شود
    if (step === 2) {
      setBusy(true);
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((c) => ({ key: c.key, qty: c.qty, details: c.details ?? [] })),
            parts: Object.entries(partSel).filter(([, v]) => v.on).map(([k, v]) => ({ key: k, qty: v.qty })),
            mode,
            referralCode: referralCode.trim() || null,
            customerNationalId: customer.nationalId.trim() || null,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message);
        setQuote(d.quote);
        if (referralCode.trim()) {
          if (d.referralBlockedSelf) setRefState('self');
          else if (d.referralValid) setRefState('valid');
          else setRefState('invalid');
        }
        setStep(3);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('errGeneric', lang));
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function prev() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  // ─── ثبت سفارش و پرداخت ───
  async function createOrder(): Promise<{ code: string; needsExpertise: boolean; total: number } | null> {
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((c) => ({ key: c.key, qty: c.qty, details: c.details ?? [] })),
          parts: Object.entries(partSel).filter(([, v]) => v.on).map(([k, v]) => ({ key: k, qty: v.qty, model: v.model.trim() || null })),
          miscNotes: hasMisc ? miscNotes : null,
          customer: {
            fullName: customer.fullName.trim(),
            nationalId: customer.nationalId.trim(),
            mobile: customer.mobile.trim(),
            landline: customer.landline.trim() || null,
            address: customer.address.trim(),
            lat: customer.lat,
            lng: customer.lng,
          },
          mode,
          referralCode: referralCode.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.message ?? t('errGeneric', lang));
        return null;
      }
      const info: LastOrderInfo = {
        code: d.code, total: d.total, needsExpertise: d.needsExpertise, mode, createdAt: new Date().toISOString(),
      };
      setOrder({ code: d.code, needsExpertise: d.needsExpertise, total: d.total, minInvoiceAdj: d.minInvoiceAdj ?? 0 });
      setLastOrder(info);
      return d;
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    const created = await createOrder();
    if (!created) return;
    if (created.needsExpertise) {
      setStep(5);
      clearCart();
      return;
    }
    setStep(4); // گام پرداخت
  }

  async function startGateway() {
    const created = order ?? (await createOrder());
    if (!created) return;
    setPayMethod('GATEWAY');
    setGwOpen(true);
  }

  async function onGatewaySuccess(rrn: string) {
    setLastRrn(rrn);
    setGwOpen(false);
    setLastOrder(lastOrder ? { ...lastOrder, rrn, method: 'GATEWAY' } : null);
    setStep(5);
    clearCart();
  }

  async function submitTransfer(fromCard: string, rrn: string) {
    setBusy(true);
    try {
      const created = order ?? (await createOrder());
      if (!created) return;
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'card-transfer', code: created.code, mobile: customer.mobile.trim(), fromCard, rrn }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setPayMethod('CARD_TRANSFER');
      setLastOrder(lastOrder ? { ...lastOrder, method: 'CARD_TRANSFER' } : null);
      setStep(5);
      clearCart();
      toast.success(t('transferWait', lang));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  }

  async function estimateMisc() {
    setAiState('loading');
    try {
      const res = await fetch('/api/misc/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: miscNotes }),
      });
      const d = await res.json();
      if (d.price) {
        setAiPrice(d.price);
        setAiNote(d.note ?? '');
        setAiState('price');
      } else {
        setAiNote(d.note ?? '');
        setAiState('expert');
      }
    } catch {
      setAiNote('');
      setAiState('expert');
    }
  }

  function pickLocation() {
    if (!navigator.geolocation) {
      toast.error(t('locationFail', lang));
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomer((c) => ({ ...c, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }));
        setLocLoading(false);
        toast.success(t('locationDone', lang));
      },
      () => {
        setLocLoading(false);
        toast.error(t('locationFail', lang));
      },
      { timeout: 10000 }
    );
  }

  const Err = ({ k }: { k: string }) =>
    errors[k] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[k]}</p> : null;

  const stepIcons = [ClipboardList, UserRound, Wifi, ReceiptText, undefined, undefined];

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 pb-16">
      <div className="mt-6">
        <StepHeader step={step} lang={lang} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: isFa ? 24 : -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isFa ? -24 : 24 }} transition={{ duration: 0.2 }}>
          {/* ─── گام ۱: سبد خدمات ─── */}
          {step === 0 && (
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-extrabold">{t('cart', lang)}</h2>
                {cartLines.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t('cartEmpty', lang)}
                    <Button variant="link" onClick={() => setView('services')}>{t('chooseServices', lang)}</Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cartLines.map((c) => {
                      const rate = c.svc!.isMisc ? (aiPrice ?? 0) : c.svc!.baseRate;
                      return (
                        <div key={c.key} className="flex items-center gap-3 rounded-xl border p-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ServiceIconView k={c.key} className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{svcName(c.svc!, lang)}</p>
                            {c.details?.length ? (
                              <p className="text-[10px] font-bold text-primary">
                                + {faDigits(c.details.length)} {t('detailsCount', lang)} (+{money(detailExtraOf(c.key, c.details), lang)})
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {c.svc!.isMisc
                                ? aiPrice
                                  ? `${t('miscAiOk', lang)}: ${money(aiPrice, lang)} ${moneyLabel(lang)}`
                                  : t('miscAiExpert', lang)
                                : `${money(rate, lang)} ${moneyLabel(lang)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border p-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(c.key, c.qty - 1)} aria-label="minus"><Minus className="h-3.5 w-3.5" /></Button>
                            <span className="w-6 text-center text-sm font-bold">{money(c.qty, lang)}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(c.key, c.qty + 1)} aria-label="plus"><Plus className="h-3.5 w-3.5" /></Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(c.key)} aria-label="remove"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {cartLines.length > 0 && parts && parts.length > 0 && !cartLines.some((c) => c.svc?.edition === 'WORLD') && (
                  <div className="space-y-2 rounded-xl border border-primary/25 p-3">
                    <Label className="flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-primary" />
                      {t('partsTitle', lang)}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t('partsSub', lang)}</p>
                    <div className="as-scroll max-h-72 divide-y overflow-y-auto">
                      {parts.map((p) => {
                        const sel = partSel[p.key] ?? { on: false, qty: 1, model: '' };
                        return (
                          <div key={p.key} className="flex flex-wrap items-center gap-2 py-2">
                            <Checkbox
                              id={`pt-${p.key}`}
                              checked={sel.on}
                              onCheckedChange={(v) => setPartSel((s) => ({ ...s, [p.key]: { ...sel, on: !!v } }))}
                            />
                            <label htmlFor={`pt-${p.key}`} className="min-w-0 flex-1 cursor-pointer truncate text-sm font-semibold">
                              {isFa ? p.nameFa : p.nameEn}
                            </label>
                            <span className="text-xs text-muted-foreground ltr-num" dir="ltr">{money(p.unitPrice, lang)}</span>
                            {sel.on && (
                              <>
                                <Input
                                  dir="ltr"
                                  className="h-8 w-36 text-xs"
                                  placeholder={t('partModelPh', lang)}
                                  value={sel.model}
                                  onChange={(e) => setPartSel((s) => ({ ...s, [p.key]: { ...sel, model: e.target.value } }))}
                                />
                                <div className="flex items-center gap-1 rounded-lg border p-0.5">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPartSel((s) => ({ ...s, [p.key]: { ...sel, qty: Math.max(1, sel.qty - 1) } }))} aria-label="minus"><Minus className="h-3.5 w-3.5" /></Button>
                                  <span className="w-6 text-center text-sm font-bold">{money(sel.qty, lang)}</span>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPartSel((s) => ({ ...s, [p.key]: { ...sel, qty: Math.min(99, sel.qty + 1) } }))} aria-label="plus"><Plus className="h-3.5 w-3.5" /></Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {partsSelTotal > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                        <span className="font-semibold">{t('partsTotal', lang)}</span>
                        <span className="font-extrabold text-primary ltr-num" dir="ltr">{money(partsSelTotal, lang)} {moneyLabel(lang)}</span>
                      </div>
                    )}
                  </div>
                )}

                {hasMisc && (
                  <div className="space-y-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3">
                    <Label className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t('miscNotes', lang)}
                    </Label>
                    <Textarea value={miscNotes} onChange={(e) => setMiscNotes(e.target.value)} rows={4} placeholder={isFa ? 'مثال: راه‌اندازی خانهٔ هوشمند ۵ اتاقه با کنترل از موبایل…' : 'e.g. set up smart home for 5 rooms controlled via mobile…'} />
                    <Err k="miscNotes" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" disabled={aiState === 'loading' || miscNotes.trim().length < 15} onClick={estimateMisc}>
                        {aiState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {aiState === 'loading' ? t('miscAiWait', lang) : t('miscAiBtn', lang)}
                      </Button>
                      {aiState === 'price' && (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                          {t('miscAiOk', lang)}: {money(aiPrice ?? 0, lang)} {moneyLabel(lang)} {aiNote ? `— ${aiNote}` : ''}
                        </Badge>
                      )}
                      {aiState === 'expert' && (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                          {t('miscAiExpert', lang)} {aiNote ? `— ${aiNote}` : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                  <span className="text-sm font-semibold">{t('fSubtotal', lang)}</span>
                  <span className="font-extrabold text-primary">{money(baseSubtotal, lang)} {moneyLabel(lang)}</span>
                </div>
                <Err k="cart" />
              </CardContent>
            </Card>
          )}

          {/* ─── گام ۲: مشخصات مشتری ─── */}
          {step === 1 && (
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-extrabold">{t('stepInfo', lang)}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">{t('fullName', lang)} *</Label>
                    <Input id="fullName" value={customer.fullName} onChange={(e) => setCustomer((c) => ({ ...c, fullName: e.target.value }))} autoComplete="name" />
                    <Err k="fullName" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nationalId">{t('nationalId', lang)} *</Label>
                    <Input id="nationalId" className="ltr-num text-start" dir="ltr" inputMode="numeric" maxLength={10} value={customer.nationalId} onChange={(e) => setCustomer((c) => ({ ...c, nationalId: e.target.value.replace(/\D/g, '') }))} />
                    <Err k="nationalId" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile">{t('mobile', lang)} *</Label>
                    <Input id="mobile" className="ltr-num text-start" dir="ltr" inputMode="tel" maxLength={11} placeholder="09xxxxxxxxx" value={customer.mobile} onChange={(e) => setCustomer((c) => ({ ...c, mobile: e.target.value.replace(/\D/g, '') }))} />
                    <Err k="mobile" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="landline">{t('landline', lang)}</Label>
                    <Input id="landline" className="ltr-num text-start" dir="ltr" inputMode="tel" value={customer.landline} onChange={(e) => setCustomer((c) => ({ ...c, landline: e.target.value.replace(/\D/g, '') }))} />
                    <Err k="landline" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">{t('address', lang)} *</Label>
                  <Textarea id="address" rows={2} value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} />
                  <Err k="address" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={pickLocation} disabled={locLoading}>
                      {locLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                      {t('location', lang)}
                    </Button>
                    {customer.lat != null && customer.lng != null && (
                      <a className="text-xs font-semibold text-primary underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${customer.lat}&mlon=${customer.lng}#map=17/${customer.lat}/${customer.lng}`}>
                        {t('locationView', lang)} ({customer.lat}, {customer.lng})
                      </a>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="needs">{t('needs', lang)}</Label>
                  <Textarea id="needs" rows={3} placeholder={t('needsHint', lang)} value={customer.needs} onChange={(e) => setCustomer((c) => ({ ...c, needs: e.target.value }))} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── گام ۳: نحوهٔ انجام + معرف ─── */}
          {step === 2 && (
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-5">
                <h2 className="text-lg font-extrabold">{t('modeTitle', lang)}</h2>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'ONSITE' | 'REMOTE')} className="grid gap-3 sm:grid-cols-2">
                  <Label htmlFor="m-onsite" className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${mode === 'ONSITE' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <RadioGroupItem id="m-onsite" value="ONSITE" className="sr-only" />
                    <Store className={`h-6 w-6 ${mode === 'ONSITE' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="mt-2 font-bold">{t('onsite', lang)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('onsiteHint', lang)}</p>
                  </Label>
                  <Label htmlFor="m-remote" className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${mode === 'REMOTE' ? 'border-primary bg-primary/5' : 'border-border'} ${hasNonRemote ? 'opacity-60' : ''}`}>
                    <RadioGroupItem id="m-remote" value="REMOTE" className="sr-only" disabled={hasNonRemote} />
                    <Wifi className={`h-6 w-6 ${mode === 'REMOTE' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="mt-2 font-bold">{t('remote', lang)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('remoteHint', lang)}</p>
                  </Label>
                </RadioGroup>
                {mode === 'REMOTE' && hasNonRemote && <Err k="mode" />}

                <Separator />
                <div className="space-y-1.5">
                  <Label htmlFor="ref">{t('referralTitle', lang)}</Label>
                  <Input id="ref" className="ltr-num text-start max-w-xs" dir="ltr" inputMode="numeric" maxLength={10} placeholder={isFa ? 'کد ملی معرف (۱۰ رقم)' : "Referrer's national ID (10 digits)"} value={referralCode} onChange={(e) => { setReferralCode(e.target.value.replace(/\D/g, '')); setRefState('idle'); }} />
                  <p className="text-xs text-muted-foreground">{t('referralHint', lang)}</p>
                  {refState === 'valid' && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ {t('referralOk', lang)}</p>}
                  {refState === 'self' && <p className="text-xs font-bold text-destructive">✕ {t('referralSelf', lang)}</p>}
                  {refState === 'invalid' && <p className="text-xs font-bold text-destructive">✕ {t('referralBad', lang)}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── گام ۴: پیش‌فاکتور ─── */}
          {step === 3 && (
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">{t('proforma', lang)}</h2>
                  <Badge variant="secondary">{t('serverQuote', lang)}</Badge>
                </div>

                <div className="rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-secondary/60 text-xs text-muted-foreground">
                        <th className="p-2.5 text-start font-semibold">{t('service', lang)}</th>
                        <th className="p-2.5 text-center font-semibold">{t('qty', lang)}</th>
                        <th className="p-2.5 text-end font-semibold">{t('baseRate', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote?.lines.map((l) => (
                        <tr key={l.serviceKey} className="border-b last:border-0">
                          <td className="p-2.5 font-semibold">{svcName(svcByKey.get(l.serviceKey)!, lang)}</td>
                          <td className="p-2.5 text-center">{money(l.qty, lang)}</td>
                          <td className="p-2.5 text-end ltr-num" dir="ltr">{money(l.lineTotal, lang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {quote?.parts && quote.parts.length > 0 && (
                  <div className="rounded-xl border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-secondary/60 text-xs text-muted-foreground">
                          <th className="p-2.5 text-start font-semibold">{t('partsTitle', lang)}</th>
                          <th className="p-2.5 text-center font-semibold">{t('qty', lang)}</th>
                          <th className="p-2.5 text-end font-semibold">{t('baseRate', lang)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.parts.map((p) => (
                          <tr key={p.key} className="border-b last:border-0">
                            <td className="p-2.5 font-semibold">{isFa ? p.nameFa : p.nameEn || p.nameFa}</td>
                            <td className="p-2.5 text-center">{money(p.qty, lang)}</td>
                            <td className="p-2.5 text-end ltr-num" dir="ltr">{money(p.lineTotal, lang)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="rounded-xl bg-secondary/60 p-3 text-xs space-y-1.5" dir={isFa ? 'rtl' : 'ltr'}>
                  <p className="font-bold mb-1">{t('factors', lang)}</p>
                  {[
                    [t('fSubtotal', lang), `${money(quote?.subtotal ?? 0, lang)} ${moneyLabel(lang)}`],
                    [t('fWeek', lang), `× ${factor(quote?.weekFactor ?? 1, lang)}`],
                    [t('fHour', lang), `× ${factor(quote?.hourFactor ?? 1, lang)}`],
                    [`${t('fDay', lang)}${quote?.dayLabelFa ? (isFa ? ` (${quote.dayLabelFa})` : ` (${quote.dayLabelEn})`) : ''}`, `× ${factor(quote?.dayFactor ?? 1, lang)}`],
                    [t('fMode', lang), `× ${factor(quote?.modeFactor ?? 1, lang)}`],
                    [t('fGross', lang), `${money(quote?.grossTotal ?? 0, lang)} ${moneyLabel(lang)}`],
                    quote?.serviceMarkup ? [`${t('fServiceMarkup', lang)} (${factor(quote.serviceMarkupPct ?? 0.33, lang)}٪)`, `+ ${money(quote.serviceMarkup, lang)} ${moneyLabel(lang)}`] : null,
                    quote?.discount ? [`${t('fDiscount', lang)} (${factor(quote.referralPercent ?? 0, lang)}٪)`, `− ${money(quote.discount, lang)} ${moneyLabel(lang)}`] : null,
                    quote?.partsTotal ? [t('fParts', lang), `+ ${money(quote.partsTotal, lang)} ${moneyLabel(lang)}`] : null,
                    quote?.minInvoiceAdj ? [isFa ? `تعدیل به حداقل فاکتور (${money(quote.minInvoice ?? 5_000_000, lang)})` : `Min-invoice adjustment (${money(quote.minInvoice ?? 5_000_000, lang)})`, `+ ${money(quote.minInvoiceAdj, lang)} ${moneyLabel(lang)}`] : null,
                  ].filter(Boolean).map((row, i) => {
                    const [k, v] = row as [string, string];
                    return (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold ltr-num" dir="ltr">{v}</span>
                      </div>
                    );
                  })}
                  <Separator className="my-1.5" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-extrabold">{quote?.partsTotal ? t('grandTotal', lang) : t('fTotal', lang)}</span>
                    <span className="font-extrabold text-primary ltr-num" dir="ltr">{money(quote?.grandTotal ?? quote?.total ?? 0, lang)} {moneyLabel(lang)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('quoteNote', lang)}{isFa ? ' — حداقل مبلغ هر فاکتور ۵٬۰۰۰٬۰۰۰ تومان است و در صورت کمتر بودن، به این سقف تعدیل می‌شود.' : ' — minimum invoice amount is 5,000,000 Toman; smaller totals are adjusted up to it.'}</p>

                <div className="flex items-start gap-2">
                  <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(!!v)} />
                  <Label htmlFor="terms" className="text-xs leading-5 cursor-pointer">{t('terms', lang)}</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── گام ۵: پرداخت ─── */}
          {step === 4 && (
            <div className="space-y-4">
              {order?.needsExpertise ? (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription className="leading-6">{t('expertNote', lang)}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="rounded-2xl border p-4 text-center">
                    <p className="text-xs text-muted-foreground">{t('fTotal', lang)}</p>
                    <p className="mt-1 text-2xl font-extrabold text-primary ltr-num" dir="ltr">{money(order?.total ?? quote?.grandTotal ?? quote?.total ?? 0, lang)} <span className="text-sm">{moneyLabel(lang)}</span></p>
                    {order && order.minInvoiceAdj > 0 && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{isFa ? `شامل تعدیل به حداقل فاکتور: +${money(order.minInvoiceAdj, lang)} ${moneyLabel(lang)}` : `includes min-invoice adjustment: +${order.minInvoiceAdj.toLocaleString()} Toman`}</p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button onClick={startGateway} disabled={busy} className="rounded-2xl border-2 p-4 text-start transition-colors hover:border-primary hover:bg-primary/5">
                      <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><span className="font-bold">{t('payGateway', lang)}</span></div>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-5">{t('payGatewayHint', lang)}</p>
                    </button>
                    <button onClick={() => setPayMethod('CARD_TRANSFER')} disabled={busy} className="rounded-2xl border-2 p-4 text-start transition-colors hover:border-primary hover:bg-primary/5">
                      <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /><span className="font-bold">{t('payTransfer', lang)}</span></div>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-5">{t('payTransferHint', lang)}</p>
                    </button>
                  </div>

                  {payMethod === 'CARD_TRANSFER' && <TransferForm lang={lang} busy={busy} onSubmit={submitTransfer} />}
                </>
              )}
            </div>
          )}

          {/* ─── گام ۶: رسید ─── */}
          {step === 5 && order && (
            <Card className="print-area">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-7 w-7" />
                  </span>
                  <h2 className="mt-3 text-lg font-extrabold">{t('orderRegistered', lang)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t('keepCode', lang)}</p>
                  <p className="mt-3 inline-block rounded-xl bg-secondary px-5 py-2.5 text-xl font-extrabold tracking-widest text-primary" dir="ltr">{order.code}</p>
                </div>
                <Separator />
                <div className="grid gap-2 text-sm">
                  <Row k={t('status', lang)} v={order.needsExpertise ? t('stEXPERT_REVIEW', lang) : lastRrn ? t('stPAID', lang) : payMethod === 'CARD_TRANSFER' ? t('stAWAITING_ADMIN', lang) : t('stPENDING_PAYMENT', lang)} />
                  <Row k={t('modeLabel', lang)} v={mode === 'REMOTE' ? t('remote', lang) : t('onsite', lang)} />
                  {lastRrn && <Row k={t('rrn', lang)} v={lastRrn} />}
                  <Row k={t('fTotal', lang)} v={`${money(order.total, lang)} ${moneyLabel(lang)}`} />
                  {order.minInvoiceAdj > 0 && <Row k={isFa ? 'تعدیل به حداقل فاکتور' : 'Min-invoice adjustment'} v={`+ ${money(order.minInvoiceAdj, lang)} ${moneyLabel(lang)}`} />}
                </div>
                <div className="flex flex-wrap gap-2 pt-2 print:hidden">
                  <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('print', lang)}</Button>
                  <Button className="gap-1.5" onClick={() => { setTrackPrefill(order.code); setView('track'); }}><ReceiptText className="h-4 w-4" />{t('trackIt', lang)}</Button>
                  <Button variant="secondary" onClick={() => setView('services')}><Plus className="h-4 w-4" />{t('newOrder', lang)}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ناوبری گام‌ها */}
      {step < 4 && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={prev} disabled={step === 0 || busy} className="gap-1">
            {isFa ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {t('back', lang)}
          </Button>
          {step === 3 ? (
            <Button onClick={payNow} disabled={busy || !terms} className="gap-1.5 font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('payNow', lang)}
            </Button>
          ) : (
            <Button onClick={next} disabled={busy || (step === 0 && cart.length === 0)} className="gap-1 font-bold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('next', lang)}
              {isFa ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}

      {/* درگاه پرداخت */}
      {gwOpen && order && (
        <GatewayDialog
          open={gwOpen}
          onOpenChange={(o) => {
            setGwOpen(o);
            if (!o && !lastRrn) setStep(4);
          }}
          code={order.code}
          mobile={customer.mobile}
          amount={order.total}
          lang={lang}
          onSuccess={onGatewaySuccess}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

function TransferForm({ lang, busy, onSubmit }: { lang: 'fa' | 'en'; busy: boolean; onSubmit: (fromCard: string, rrn: string) => void }) {
  const [fromCard, setFromCard] = useState('');
  const [rrn, setRrn] = useState('');
  // پیام ۱۲: دریافت همهٔ فاکتورها (≥ ۵م تومان) با شبای حساب دریافت — بانک مهر ایران
  const [settings, setSettings] = useState<{ SHEBA_RECEIVING: string; POL_RECEIVING: string; ACCOUNT_NAME: string; MIN_INVOICE_AMOUNT: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => setSettings(d.settings)).catch(() => {});
  }, []);

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const accounts = settings
    ? [
        settings.SHEBA_RECEIVING && { label: 'شبای حساب دریافت — بانک مهر ایران', value: settings.SHEBA_RECEIVING, ltr: true },
        settings.POL_RECEIVING && { label: 'کارت حساب دریافت (پل)', value: settings.POL_RECEIVING, ltr: true },
      ].filter(Boolean) as { label: string; value: string; ltr: boolean }[]
    : [];

  return (
    <div className="space-y-4 rounded-2xl border p-4">
      <div className="space-y-2">
        <p className="text-sm font-bold">{t('accounts', lang)}</p>
        {accounts.map((a) => (
          <div key={a.value} className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{settings?.ACCOUNT_NAME} — {a.label}</p>
              <p className="ltr-num font-extrabold tracking-wider" dir="ltr">{a.value.replace(/^(IR.{2})(.{4})(.{4})(.{4})(.{4})(.{4})(.+)$/, '$1 $2 $3 $4 $5 $6 $7').replace(/(\d{4})(?=\d)/g, '$1-')}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => copy(a.value)} className="gap-1 shrink-0">
              {copied === a.value ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === a.value ? t('copied', lang) : t('copy', lang)}
            </Button>
          </div>
        ))}
        {settings?.MIN_INVOICE_AMOUNT && (
          <p className="text-[11px] leading-5 text-muted-foreground">
            {lang === 'fa'
              ? `حداقل مبلغ هر فاکتور ${money(parseInt(settings.MIN_INVOICE_AMOUNT, 10) || 5_000_000, lang)} ${moneyLabel(lang)} است؛ پس از واریز به شبا/پل حساب دریافت، کد سفارش و رسید در پنل ادمین ثبت و به پروندهٔ مشتری الصاق می‌شود.`
              : `Minimum invoice amount is ${parseInt(settings.MIN_INVOICE_AMOUNT, 10) || 5_000_000} Toman; after transferring to the receiving Sheba/card, the order code and receipt are registered in the admin panel.`}
          </p>
        )}
      </div>
      <Separator />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('transferFrom', lang)}</Label>
          <Input className="ltr-num text-start" dir="ltr" inputMode="numeric" maxLength={19} value={fromCard} onChange={(e) => setFromCard(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('transferRrn', lang)}</Label>
          <Input className="ltr-num text-start" dir="ltr" value={rrn} onChange={(e) => setRrn(e.target.value)} />
        </div>
      </div>
      <Button className="w-full font-bold" disabled={busy || fromCard.length !== 16 || rrn.length < 4} onClick={() => onSubmit(fromCard, rrn)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
        {t('transferSubmit', lang)}
      </Button>
    </div>
  );
}
