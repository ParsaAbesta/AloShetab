'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BadgeCheck, CircleDollarSign, HandHeart, Share2, Minus, Plus, BookOpen, ShoppingCart, Loader2, RemoteCorner, Search, Sparkles } from './icons';
import { useAs } from './store';
import { t, type Lang } from './i18n';
import { money, faDigits, curLabel, ServiceIconView, svcDesc, svcName, type ServiceLite, type ServiceDetailLite } from './util';
import { GetAppSection } from './GetApp';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TRUST = [
  { icon: CircleDollarSign, titleKey: 'trust1t' as const, descKey: 'trust1d' as const },
  { icon: BadgeCheck, titleKey: 'trust2t' as const, descKey: 'trust2d' as const },
  { icon: HandHeart, titleKey: 'trust3t' as const, descKey: 'trust3d' as const },
  { icon: Share2, titleKey: 'trust4t' as const, descKey: 'trust4d' as const },
];

const JOURNEY = [
  { titleKey: 'step1t' as const, descKey: 'step1d' as const },
  { titleKey: 'step2t' as const, descKey: 'step2d' as const },
  { titleKey: 'step3t' as const, descKey: 'step3d' as const },
  { titleKey: 'step4t' as const, descKey: 'step4d' as const },
  { titleKey: 'step5t' as const, descKey: 'step5d' as const },
  { titleKey: 'step6t' as const, descKey: 'step6d' as const },
];

function priceLabel(s: ServiceLite, lang: Lang): string {
  if (s.isMisc) return lang === 'fa' ? 'برآورد هوشمند' : 'Smart estimate';
  if (s.percentValue != null) return `${faDigits(s.percentValue.toLocaleString('en-US', { maximumFractionDigits: 2 }))}٪`;
  return `${money(s.baseRate, lang)}${s.currency === 'USD' ? ' $' : ''}`;
}

// ─── فرم «[+] افزودن ریز جزئیات» ────────────────────────────
function AddDetailDialog({ svc, lang }: { svc: ServiceLite; lang: Lang }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    if (name.trim().length < 3 || !contact.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/detail-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceKey: svc.key,
          name: name.trim(),
          price: price.trim() ? Number(price.replace(/\D/g, '')) : null,
          contact: contact.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'error');
      toast.success(t('detailSent', lang));
      setOpen(false);
      setName('');
      setPrice('');
      setContact('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/50 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5">
          <Plus className="h-3.5 w-3.5" />
          {t('addDetailBtn', lang)}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addDetailTitle', lang)}</DialogTitle>
          <DialogDescription className="text-start leading-6">{t('addDetailHint', lang)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold">{svcName(svc, lang)}</p>
          <div className="space-y-1.5">
            <Label>{t('detailName', lang)} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('detailPrice', lang)}</Label>
            <Input className="ltr-num text-start" dir="ltr" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('yourContact', lang)} *</Label>
            <Input dir="ltr" className="ltr-num text-start" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <Button className="w-full font-bold" disabled={busy || name.trim().length < 3 || !contact.trim()} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('addDetailBtn', lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── کارت خدمت با ریز جزئیات تیک‌خور ─────────────────────────
function ServiceCard({ s, lang }: { s: ServiceLite; lang: Lang }) {
  const { cart, addToCart, setQty, setCartDetails } = useAs();
  const inCart = cart.find((c) => c.key === s.key);
  const [openDetails, setOpenDetails] = useState(false);
  const [sel, setSel] = useState<Record<string, number>>({}); // detailId -> qty
  const details = s.details ?? [];
  const selIds = Object.keys(sel);
  const selTotal = details.filter((d) => sel[d.id]).reduce((sum, d) => sum + d.price * (sel[d.id] || 1), 0);
  const cur = s.currency === 'USD' ? ' $' : '';

  function toggleDetail(id: string, on: boolean) {
    setSel((prev) => {
      const next = { ...prev };
      if (on) next[id] = 1;
      else delete next[id];
      // اگر خدمت در سبد است، ریز جزئیات را زنده به‌روزرسانی کن
      if (inCart) setCartDetails(s.key, Object.keys(next));
      return next;
    });
  }

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ServiceIconView k={s.key} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold leading-6">{svcName(s, lang)}</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    aria-label="help"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ServiceIconView k={s.key} className="h-5 w-5 text-primary" />
                      {svcName(s, lang)} — {t('helpTitle', lang)}
                    </DialogTitle>
                    <DialogDescription className="text-start leading-7 pt-2">{svcDesc(s, lang)}</DialogDescription>
                  </DialogHeader>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('baseRate', lang)}:</span>
                    <span className="font-bold text-primary">
                      {s.isMisc
                        ? (lang === 'fa' ? 'قیمت‌گذاری هوشمند/کارشناسی' : 'AI / expert pricing')
                        : s.percentValue != null
                          ? `${faDigits(s.percentValue.toLocaleString('en-US', { maximumFractionDigits: 2 }))}٪ ${t('percentLbl', lang)}`
                          : `${money(s.baseRate, lang)} ${curLabel(s.currency, lang)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('modeLabel', lang)}:</span>
                    <span className="font-semibold">{s.remoteCapable ? t('remoteOk', lang) : t('remoteNo', lang)}</span>
                  </div>
                  {details.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-bold text-muted-foreground">{t('detailsCount', lang)} ({faDigits(details.length)}):</p>
                      <ul className="max-h-48 overflow-y-auto as-scroll space-y-1 text-xs">
                        {details.map((d) => (
                          <li key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/60 px-2.5 py-1.5">
                            <span>{lang === 'fa' ? d.nameFa : (d.nameEn || d.nameFa)}</span>
                            <span className="font-semibold text-primary ltr-num" dir="ltr">{money(d.price, lang)}{cur}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </DialogContent>
              </Dialog>
              {s.aiGenerated && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-3 w-3" />
                  {t('aiBadge', lang)}
                </Badge>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-5">{svcDesc(s, lang)}</p>
          </div>
        </div>

        {/* ریز جزئیات — تیک + تعداد + قیمت */}
        {details.length > 0 && (
          <div className="rounded-xl border border-primary/25">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-primary"
              onClick={() => setOpenDetails((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {t('detailsCount', lang)} ({faDigits(details.length)})
                {selIds.length > 0 && <Badge className="h-4 px-1.5 text-[10px]">{faDigits(selIds.length)}</Badge>}
              </span>
              <span className="text-[10px] opacity-80">{openDetails ? '▲' : '▼'}</span>
            </button>
            {openDetails && (
              <div className="border-t border-primary/15 bg-primary/[0.03]">
                <p className="px-3 pt-2 text-[10px] text-muted-foreground">{t('detailsTitle', lang)}</p>
                <div className="max-h-60 overflow-y-auto as-scroll px-2 py-1.5">
                  {details.map((d: ServiceDetailLite) => {
                    const qty = sel[d.id] ?? 0;
                    return (
                      <div key={d.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-secondary/60">
                        <Checkbox
                          id={`dt-${s.key}-${d.id}`}
                          checked={qty > 0}
                          onCheckedChange={(v) => toggleDetail(d.id, !!v)}
                          className="shrink-0"
                        />
                        <label htmlFor={`dt-${s.key}-${d.id}`} className="min-w-0 flex-1 cursor-pointer truncate text-xs font-medium">
                          {lang === 'fa' ? d.nameFa : (d.nameEn || d.nameFa)}
                        </label>
                        <span className="shrink-0 text-[11px] font-bold text-primary ltr-num" dir="ltr">
                          {money(d.price, lang)}{cur}
                        </span>
                        {qty > 0 && (
                          <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleDetail(d.id, false)} aria-label="minus">
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-4 text-center text-[11px] font-bold">{faDigits(qty)}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSel((p) => ({ ...p, [d.id]: Math.min(99, qty + 1) }))} aria-label="plus">
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selTotal > 0 && (
                  <p className="border-t border-primary/15 px-3 py-2 text-[11px] font-bold text-primary">
                    {lang === 'fa' ? 'جمع ریز جزئیات انتخابی: ' : 'Selected details total: '}
                    <span className="ltr-num" dir="ltr">{money(selTotal, lang)}{cur}</span>
                  </p>
                )}
                <AddDetailDialog svc={s} lang={lang} />
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-primary">{priceLabel(s, lang)}</p>
            {!s.isMisc && (
              <p className="text-[10px] text-muted-foreground">
                {s.percentValue != null ? t('percentUnit', lang) : curLabel(s.currency, lang)}
              </p>
            )}
          </div>
          {inCart ? (
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(s.key, inCart.qty - 1)} aria-label="minus">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center text-sm font-bold">{money(inCart.qty, lang)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(s.key, inCart.qty + 1)} aria-label="plus">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => addToCart(s.key, selIds)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {lang === 'fa' ? 'افزودن' : 'Add'}
            </Button>
          )}
        </div>

        {s.remoteCapable && (
          <Badge variant="secondary" className="absolute top-2.5 end-2.5 text-[10px] gap-1">
            <RemoteCorner className="h-3 w-3" />
            {t('remoteOk', lang)}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function Catalog() {
  const { lang, edition, setEdition, cart, setView } = useAs();
  const [services, setServices] = useState<ServiceLite[] | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'created' | 'exists' | 'forbidden' | 'fail'>('idle');

  const fetchServices = useCallback((ed: 'IRAN' | 'WORLD') => {
    fetch(`/api/services?edition=${ed}`)
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .catch(() => setServices([]));
  }, []);

  useEffect(() => {
    fetchServices(edition);
  }, [edition, fetchServices]);

  const categories = useMemo(() => {
    if (!services) return [];
    const seen: string[] = [];
    for (const s of services) if (s.category && !seen.includes(s.category)) seen.push(s.category);
    return seen;
  }, [services]);

  const filtered = useMemo(() => {
    if (!services) return [];
    const needle = q.trim().toLowerCase();
    return services.filter((s) =>
      (!cat || s.category === cat) &&
      (!needle || s.nameFa.includes(needle) || s.nameEn.toLowerCase().includes(needle) || (s.category ?? '').includes(needle))
    );
  }, [services, cat, q]);

  async function createWithAi() {
    if (q.trim().length < 3) return;
    setAiState('loading');
    try {
      const res = await fetch('/api/ai/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim(), lang, edition }),
      });
      const d = await res.json();
      if (d.created) {
        setAiState('created');
        toast.success(t('aiMade', lang));
        setCat(null);
        fetchServices(edition);
        setQ('');
      } else if (d.reason === 'EXISTS') {
        setAiState('exists');
        toast.info(t('aiExists', lang));
        setCat(null);
        fetchServices(edition);
        setQ('');
      } else if (d.reason === 'FORBIDDEN') {
        setAiState('forbidden');
        toast.error(t('aiForbidden', lang));
      } else {
        setAiState('fail');
        toast.error(d.message ?? 'AI_FAIL');
      }
    } catch {
      setAiState('fail');
      toast.error('AI_FAIL');
    }
  }

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 pb-10">
      {/* Hero */}
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/85 to-emerald-800 px-5 py-10 sm:px-10 sm:py-14 text-primary-foreground shadow-lg">
        <div className="absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative max-w-2xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-snug">{t('heroTitle', lang)}</h1>
          <p className="mt-3 text-sm sm:text-base leading-7 opacity-90">{t('heroSub', lang)}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            {[t('heroBadge1', lang), t('heroBadge2', lang), t('heroBadge3', lang)].map((b) => (
              <span key={b} className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">{b}</span>
            ))}
          </div>
          <Button size="lg" variant="secondary" className="mt-6 gap-2 font-bold" onClick={() => setView('order')}>
            <ShoppingCart className="h-5 w-5" />
            {t('goToOrder', lang)}
          </Button>
        </div>
      </section>

      {/* چرا ألو شتاب */}
      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TRUST.map((tr, i) => (
          <motion.div key={tr.titleKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="h-full">
              <CardContent className="p-4">
                <tr.icon className="h-6 w-6 text-primary" />
                <p className="mt-2 font-bold text-sm">{t(tr.titleKey, lang)}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-5">{t(tr.descKey, lang)}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* خدمات */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold">{t('chooseServices', lang)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('chooseServicesSub', lang)}</p>
          </div>
          {services && (
            <Badge variant="outline" className="shrink-0">
              {money(services.length, lang)} {t('servicesCount', lang)}
            </Badge>
          )}
        </div>

        {/* سوییچ نسخهٔ کاتالوگ: ایران v1 / جهانی v2.0 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border">
            <button
              onClick={() => setEdition('IRAN')}
              className={`px-4 py-2 text-xs font-bold transition-colors ${edition === 'IRAN' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'}`}
            >
              {t('editionIRAN', lang)}
            </button>
            <button
              onClick={() => setEdition('WORLD')}
              className={`px-4 py-2 text-xs font-bold transition-colors ${edition === 'WORLD' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'}`}
            >
              {t('editionWORLD', lang)}
            </button>
          </div>
          {edition === 'WORLD' && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{t('editionHint', lang)}</span>
          )}
        </div>

        {!services ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('loading', lang)}
          </div>
        ) : (
          <>
            {/* فیلتر دسته‌ها + جستجو */}
            <div className="mt-5 flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setAiState('idle'); }}
                  placeholder={t('searchPh', lang)}
                  aria-label={t('searchPh', lang)}
                  className="h-10 w-full rounded-xl border bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]">
                <button
                  onClick={() => setCat(null)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${cat === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-secondary'}`}
                >
                  {t('catAll', lang)} ({faDigits(services.length)})
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(cat === c ? null : c)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${cat === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-secondary'}`}
                  >
                    {c} ({faDigits(services.filter((s) => s.category === c).length)})
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-primary/40 bg-primary/[0.04] p-6 text-center">
                <Sparkles className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-2 text-sm font-bold">{t('noResult', lang)}</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted-foreground">{t('aiNote', lang)}</p>
                {q.trim().length >= 3 ? (
                  <Button className="mt-4 gap-2 font-bold" onClick={createWithAi} disabled={aiState === 'loading'}>
                    {aiState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiState === 'loading' ? t('aiMaking', lang) : t('aiMake', lang)}
                  </Button>
                ) : (
                  <p className="mt-3 text-[11px] text-muted-foreground">{t('searchPh', lang)}…</p>
                )}
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((s) => (
                  <ServiceCard key={s.key} s={s} lang={lang} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* مسیر سفارش */}
      <section className="mt-12">
        <h2 className="text-xl sm:text-2xl font-extrabold">{t('steps', lang)}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map((j, i) => (
            <Card key={j.titleKey}>
              <CardContent className="p-4 flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-extrabold">
                  {money(i + 1, lang)}
                </span>
                <div>
                  <p className="font-bold text-sm">{t(j.titleKey, lang)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-5">{t(j.descKey, lang)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* دریافت برنامه (لینک + QR) */}
      <GetAppSection />

      {/* نوار سبد شناور */}
      {cartCount > 0 && (
        <motion.div initial={{ y: 60 }} animate={{ y: 0 }} className="fixed bottom-4 inset-x-4 z-30 mx-auto max-w-md">
          <Button size="lg" className="w-full gap-2 shadow-xl text-base font-bold" onClick={() => setView('order')}>
            <ShoppingCart className="h-5 w-5" />
            {t('goToOrder', lang)} ({money(cartCount, lang)} {t('itemsCount', lang)})
          </Button>
        </motion.div>
      )}
    </div>
  );
}
