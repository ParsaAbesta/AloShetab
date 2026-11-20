'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, PackageSearch, Check, CreditCard, Star, MapPin } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';
import { money, moneyLabel, svcName } from './util';
import { formatJalaliTime } from '@/lib/jalali';
import GatewayDialog from './Gateway';

const FLOW = ['PENDING_PAYMENT', 'PAID', 'SCHEDULED', 'IN_PROGRESS', 'DONE'] as const;

interface TrackedOrder {
  id: string;
  code: string;
  status: string;
  mode: string;
  total: number;
  discount: number;
  grossTotal: number;
  serviceMarkup?: number;
  referralCode: string | null;
  needsExpertise: boolean;
  miscNotes: string | null;
  createdAt: string;
  paidAt: string | null;
  customer: { fullName: string; mobile: string; address: string; lat: number | null; lng: number | null };
  items: { id: string; qty: number; baseRate: number; lineTotal: number; service: { key: string; nameFa: string; nameEn: string }; workerId: string | null }[];
  events: { id: string; status: string; noteFa: string; noteEn: string; createdAt: string }[];
  rating: { id: string; skill: number; ethics: number; comment: string | null } | null;
  payments: { id: string; method: string; status: string; amount: number; rrn: string | null; cardMask: string | null }[];
}

function Stars({ value, onChange, lang }: { value: number; onChange: (v: number) => void; lang: 'fa' | 'en' }) {
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star`}
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star className={`h-6 w-6 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
        </button>
      ))}
      <span className="ms-1 text-xs font-bold text-muted-foreground" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
        {new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(value)}/5
      </span>
    </div>
  );
}

export default function Track() {
  const { lang, trackPrefill } = useAs();
  const [code, setCode] = useState(trackPrefill ?? '');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [skill, setSkill] = useState(0);
  const [ethics, setEthics] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [gwOpen, setGwOpen] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  useEffect(() => {
    if (trackPrefill) setCode(trackPrefill);
  }, [trackPrefill]);

  async function search() {
    if (!code.trim() || !/^09\d{9}$/.test(mobile.trim())) {
      toast.error(t('trackSub', lang));
      return;
    }
    setBusy(true);
    setNotFound(false);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), mobile: mobile.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setOrder(null);
        setNotFound(true);
        return;
      }
      setOrder(d.order);
      if (d.order?.rating) {
        setSkill(d.order.rating.skill);
        setEthics(d.order.rating.ethics);
      }
    } catch {
      toast.error(t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  }

  async function submitRating() {
    if (!order) return;
    if (skill === 0 || ethics === 0) {
      toast.error(lang === 'fa' ? 'برای هر دو بخش، حداقل یک ستاره ثبت کنید' : 'Give at least one star for both sections');
      return;
    }
    setRatingBusy(true);
    try {
      const res = await fetch('/api/orders/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: order.code, mobile, skill, ethics, comment: comment.trim() || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      toast.success(t('rateDone', lang));
      setRatingDone(true);
      setOrder({ ...order, rating: { id: 'new', skill, ethics, comment: comment.trim() || null } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric', lang));
    } finally {
      setRatingBusy(false);
    }
  }

  const flowIdx = order ? FLOW.indexOf(order.status as (typeof FLOW)[number]) : -1;
  const paidPayment = order?.payments.find((p) => p.status === 'SUCCESS');
  const pendingPay = !!order && ['PENDING_PAYMENT'].includes(order.status) && order.total > 0;

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4 pb-16">
      <div className="mt-8">
        <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
          <PackageSearch className="h-6 w-6 text-primary" />
          {t('trackTitle', lang)}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('trackSub', lang)}</p>
      </div>

      <Card className="mt-5">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="tcode">{t('yourCode', lang)}</Label>
            <Input id="tcode" dir="ltr" className="ltr-num text-start font-bold tracking-wider" placeholder="AS-XXXXXX"
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmob">{t('mobile', lang)}</Label>
            <Input id="tmob" dir="ltr" className="ltr-num text-start" inputMode="tel" maxLength={11} placeholder="09xxxxxxxxx"
              value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
          </div>
          <Button className="font-bold h-10" onClick={search} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
            {t('trackBtn', lang)}
          </Button>
        </CardContent>
      </Card>

      {notFound && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          {t('trackNotFound', lang)}
        </div>
      )}

      {order && (
        <div className="mt-5 space-y-4">
          {/* مشخصات */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-extrabold tracking-wider" dir="ltr">{order.code}</p>
                <Badge className={order.status === 'DONE' ? 'bg-emerald-600' : order.status === 'CANCELLED' ? 'bg-destructive' : 'bg-primary'}>
                  {t(`st${order.status}` as never, lang) ?? order.status}
                </Badge>
              </div>
              <Separator />
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('fullName', lang)}</span><span className="font-semibold">{order.customer.fullName}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('modeLabel', lang)}</span><span className="font-semibold">{order.mode === 'REMOTE' ? t('remote', lang) : t('onsite', lang)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('fServiceMarkup', lang)}{order.serviceMarkup ? ' (۳۳٪)' : ''}</span><span className="font-semibold ltr-num" dir="ltr">{order.serviceMarkup ? `+ ${money(order.serviceMarkup, lang)} ${moneyLabel(lang)}` : '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('fTotal', lang)}</span><span className="font-extrabold text-primary ltr-num" dir="ltr">{money(order.total, lang)} {moneyLabel(lang)}</span></div>
                {paidPayment?.rrn && <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('rrn', lang)}</span><span className="font-semibold ltr-num" dir="ltr">{paidPayment.rrn}</span></div>}
                <div className="flex justify-between items-start gap-3">
                  <span className="text-muted-foreground shrink-0">{t('address', lang)}</span>
                  <span className="font-semibold text-end leading-5">{order.customer.address}</span>
                </div>
                {order.customer.lat != null && order.customer.lng != null && (
                  <a className="flex items-center gap-1 text-xs font-semibold text-primary underline" target="_blank" rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${order.customer.lat}&mlon=${order.customer.lng}#map=17/${order.customer.lat}/${order.customer.lng}`}>
                    <MapPin className="h-3.5 w-3.5" />{t('locationView', lang)}
                  </a>
                )}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-1.5">
                {order.items.map((it) => {
                  const w = it.workerId;
                  return (
                    <Badge key={it.id} variant="secondary" className="gap-1">
                      {svcName(it.service, lang)} × {new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(it.qty)}
                      {w && <span className="text-[10px] text-muted-foreground">· {w.slice(0, 6)}</span>}
                    </Badge>
                  );
                })}
              </div>
              {order.miscNotes && <p className="rounded-lg bg-secondary/60 p-3 text-xs leading-5">{order.miscNotes}</p>}

              {pendingPay && (
                <Button className="w-full font-bold gap-2" onClick={() => setGwOpen(true)}>
                  <CreditCard className="h-4 w-4" />
                  {t('payPendingBtn', lang)}
                </Button>
              )}
              {order.payments.some((p) => p.status === 'AWAITING_ADMIN') && (
                <p className="rounded-lg bg-amber-500/10 p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">{t('stAWAITING_ADMIN', lang)}</p>
              )}
            </CardContent>
          </Card>

          {/* خط زمانی */}
          <Card>
            <CardContent className="p-4">
              <p className="mb-4 font-bold">{t('timeline', lang)}</p>
              <div className="relative space-y-4 before:absolute before:inset-y-1 before:start-[11px] before:w-0.5 before:bg-border">
                {order.events.map((ev) => {
                  const idx = FLOW.indexOf(ev.status as (typeof FLOW)[number]);
                  const done = idx >= 0 && idx <= (flowIdx < 0 ? 99 : flowIdx);
                  return (
                    <div key={ev.id} className="relative flex items-start gap-3 ps-0">
                      <span className={`z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5">{lang === 'fa' ? ev.noteFa : ev.noteEn}</p>
                        <p className="text-[11px] text-muted-foreground">{formatJalaliTime(new Date(ev.createdAt), lang)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* امتیازدهی */}
          {order.status === 'DONE' && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="font-bold">{t('rateTitle', lang)}</p>
                {order.rating || ratingDone ? (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-5 w-5" />
                    {t('rateDone', lang)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t('rateSkill', lang)}</Label>
                      <Stars value={skill} onChange={setSkill} lang={lang} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t('rateEthics', lang)}</Label>
                      <Stars value={ethics} onChange={setEthics} lang={lang} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rc">{t('rateComment', lang)}</Label>
                      <Textarea id="rc" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                    </div>
                    <Button className="w-full font-bold" onClick={submitRating} disabled={ratingBusy}>
                      {ratingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                      {t('rateSubmit', lang)}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {gwOpen && order && (
        <GatewayDialog
          open={gwOpen}
          onOpenChange={setGwOpen}
          code={order.code}
          mobile={mobile}
          amount={order.total}
          lang={lang}
          onSuccess={() => {
            setGwOpen(false);
            search();
          }}
        />
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {lang === 'fa' ? 'تلفن تماس پشتیبانی فقط در پایین صفحهٔ سایت (فوتر) درج می‌شود.' : 'The support phone number is listed only in the site footer.'}
      </p>
    </div>
  );
}
