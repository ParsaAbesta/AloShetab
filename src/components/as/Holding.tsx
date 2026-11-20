'use client';

import { motion } from 'framer-motion';
import { Briefcase, ShoppingBag, TrendingUp, HeartHandshake, ArrowLeft, ArrowRight, ShieldCheck, Search, Package, Wrench, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAs } from './store';
import { t } from './i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { money } from './util';

const PILLARS = [
  { view: 'services' as const, icon: Briefcase, tKey: 'pillar1t' as const, dKey: 'pillar1d' as const, accent: 'from-emerald-600 to-emerald-800' },
  { view: 'products' as const, icon: ShoppingBag, tKey: 'pillar2t' as const, dKey: 'pillar2d' as const, accent: 'from-teal-600 to-teal-800' },
  { view: 'invest' as const, icon: TrendingUp, tKey: 'pillar3t' as const, dKey: 'pillar3d' as const, accent: 'from-amber-600 to-amber-800' },
  { view: 'fund' as const, icon: HeartHandshake, tKey: 'pillar4t' as const, dKey: 'pillar4d' as const, accent: 'from-rose-600 to-rose-800' },
];

interface SearchHit {
  type: 'SERVICE' | 'PRODUCT' | 'PART';
  key: string;
  titleFa: string;
  titleEn: string;
  subFa: string;
  price: number;
  currency: string;
  edition: string | null;
  icon: string;
}

/** نوار جستجوی سراسری — طبق پیام ۱۱ زیر اسلایدر سایت، تقریباً بالای صفحه */
function GlobalSearchBar({ lang }: { lang: 'fa' | 'en' }) {
  const { setView, setEdition } = useAs();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [aiHint, setAiHint] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const fa = lang === 'fa';

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits(null);
      setAiHint(false);
      return;
    }
    setBusy(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setHits(d.results ?? []);
        setAiHint(!!d.empty);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function go(hit: SearchHit) {
    if (hit.type === 'SERVICE') {
      if (hit.edition === 'WORLD') setEdition('WORLD');
      else setEdition('IRAN');
      setView('services');
    } else {
      setView('products');
    }
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative mt-5">
      <div className="relative">
        <Search className="absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits && setOpen(true)}
          placeholder={fa ? 'جستجوی خدمات، کالا و نرم‌افزار — مثلاً: نصب ویندوز، لپ‌تاپ، یخچال…' : 'Search services, goods and software — e.g. Windows install, laptop, fridge…'}
          aria-label={fa ? 'جستجوی سراسری' : 'Global search'}
          className="w-full rounded-2xl border bg-background/95 py-3.5 ps-12 pe-12 text-sm shadow-md outline-none ring-primary/30 transition focus:ring-2"
        />
        {busy && <Loader2 className="absolute top-1/2 end-4 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && hits && (q.trim().length >= 2) && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-background shadow-xl as-scroll max-h-80 overflow-y-auto">
          {hits.length === 0 ? (
            <div className="p-4 text-center text-xs leading-6 text-muted-foreground">
              {fa ? 'نتیجه‌ای یافت نشد.' : 'No results.'}{' '}
              {aiHint && (
                <span className="flex items-center justify-center gap-1.5 font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {fa ? 'در میز خدمات دکمهٔ «افزودن خدمت جدید» را بزنید تا هوش مصنوعی آن را بسازد.' : 'Use “Add new service” in the services desk so the AI can create it.'}
                </span>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {hits.map((h) => (
                <button
                  key={`${h.type}-${h.key}`}
                  className="flex w-full items-center gap-3 p-3 text-start text-sm hover:bg-secondary/60 transition-colors"
                  onClick={() => go(h)}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {h.type === 'SERVICE' ? <Wrench className="h-4.5 w-4.5" /> : <Package className="h-4.5 w-4.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{fa ? h.titleFa : h.titleEn}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{h.subFa}{h.edition === 'WORLD' ? (fa ? ' · نسخهٔ جهانی v2.0' : ' · World v2.0') : ''}</span>
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {h.type === 'SERVICE' ? (fa ? 'خدمت' : 'Service') : h.type === 'PRODUCT' ? (fa ? 'کالا' : 'Product') : (fa ? 'قطعه' : 'Part')}
                  </Badge>
                  {h.price > 0 && <span className="shrink-0 text-xs font-extrabold text-primary ltr-num" dir="ltr">{money(h.price, lang)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Holding() {
  const { lang, setView } = useAs();
  const fa = lang === 'fa';
  const Arrow = fa ? ArrowLeft : ArrowRight;

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 pb-10">
      {/* Hero */}
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 px-5 py-10 sm:px-10 sm:py-14 text-primary-foreground shadow-lg">
        <div className="absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative max-w-2xl">
          <Badge className="bg-white/15 text-primary-foreground backdrop-blur border-0">{fa ? 'هلدینگ ألو شتاب' : 'Alo Shetab Holding'}</Badge>
          <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold leading-snug">{t('holdingHeroTitle', lang)}</h1>
          <p className="mt-3 text-sm sm:text-base leading-7 opacity-90">{t('holdingHeroSub', lang)}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> {fa ? 'پرداخت امن شاپرک/شتاب' : 'Secure Shaparak/Shetab payment'}
            </span>
          </div>
        </div>
      </section>

      {/* نوار جستجو — زیر اسلایدر (پیام ۱۱) */}
      <GlobalSearchBar lang={lang} />

      {/* چهار ستون هلدینگ */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p, i) => (
          <motion.div key={p.view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="group h-full cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => setView(p.view)}>
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${p.accent} text-white shadow-sm`}>
                  <p.icon className="h-6 w-6" />
                </span>
                <h2 className="text-lg font-extrabold">{t(p.tKey, lang)}</h2>
                <p className="flex-1 text-xs leading-6 text-muted-foreground">{t(p.dKey, lang)}</p>
                <span className="flex items-center gap-1 text-sm font-bold text-primary">
                  {t('holdingEnter', lang)}
                  <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* نکتهٔ واحد بودن حساب‌ها */}
      <Card className="mt-6 border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-muted-foreground">{t('holdingNote', lang)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
