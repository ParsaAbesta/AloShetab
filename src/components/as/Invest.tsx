'use client';

import { useState } from 'react';
import { TrendingUp, Briefcase, ShoppingBag, HeartHandshake, Loader2, BadgeCheck, Info } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const MODELS = [
  { icon: Briefcase, key: 'invModel1' as const },
  { icon: ShoppingBag, key: 'invModel2' as const },
  { icon: TrendingUp, key: 'invModel3' as const },
  { icon: HeartHandshake, key: 'invModel4' as const },
];

const TIERS = [
  { tKey: 'tier1t' as const, dKey: 'tier1d' as const, cls: 'from-amber-700 to-amber-900' },
  { tKey: 'tier2t' as const, dKey: 'tier2d' as const, cls: 'from-slate-500 to-slate-700' },
  { tKey: 'tier3t' as const, dKey: 'tier3d' as const, cls: 'from-yellow-600 to-yellow-800' },
];

export default function Invest() {
  const { lang } = useAs();
  const { toast } = useToast();
  const fa = lang === 'fa';
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [amountRange, setAmountRange] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (fullName.trim().length < 3 || !/^09\d{9}$/.test(mobile.trim()) || !amountRange) {
      toast({ title: fa ? 'نام، موبایل (۰۹…) و بازهٔ سرمایه را کامل کنید.' : 'Fill name, mobile (09…) and the investment range.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          mobile: mobile.trim(),
          nationalId: /^\d{10}$/.test(nationalId.trim()) ? nationalId.trim() : null,
          amountRange,
          message: message.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? 'error');
      setDone(true);
    } catch {
      toast({ title: t('errGeneric', lang), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 pb-10">
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-700 via-amber-800 to-emerald-900 px-5 py-10 sm:px-10 text-primary-foreground shadow-lg">
        <div className="absolute -top-14 -end-14 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-snug">{t('invTitle', lang)}</h1>
          <p className="mt-3 text-sm sm:text-base leading-7 opacity-90">{t('invSub', lang)}</p>
        </div>
      </section>

      {/* مدل کسب‌وکار */}
      <section className="mt-8">
        <h2 className="text-lg sm:text-xl font-extrabold">{t('invModelTitle', lang)}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODELS.map((m) => (
            <Card key={m.key}>
              <CardContent className="flex items-start gap-3 p-4">
                <m.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">{t(m.key, lang)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* سطوح مشارکت */}
      <section className="mt-8">
        <h2 className="text-lg sm:text-xl font-extrabold">{t('invTiersTitle', lang)}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TIERS.map((tr) => (
            <Card key={tr.tKey} className="overflow-hidden">
              <div className={`bg-gradient-to-br ${tr.cls} px-4 py-3 text-primary-foreground`}>
                <p className="font-extrabold">{t(tr.tKey, lang)}</p>
              </div>
              <CardContent className="p-4">
                <p className="text-xs leading-6 text-muted-foreground">{t(tr.dKey, lang)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mt-3 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-2.5 p-4">
            <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
            <p className="text-xs leading-6 text-muted-foreground">{t('invNote', lang)}</p>
          </CardContent>
        </Card>
      </section>

      {/* فرم */}
      <section className="mt-10">
        <Card>
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('invFormTitle', lang)}
            </h2>
            {done ? (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-emerald-50 py-8 text-center dark:bg-emerald-900/20">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                  <BadgeCheck className="h-6 w-6" />
                </span>
                <p className="max-w-sm text-sm font-bold leading-6">{t('invDone', lang)}</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('fullName', lang)} *</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('yourName', lang)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('mobile', lang)} *</Label>
                    <Input dir="ltr" className="ltr-num" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09xxxxxxxxx" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('nationalId', lang)}</Label>
                    <Input dir="ltr" className="ltr-num" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="**********" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('invAmount', lang)} *</Label>
                    <Select value={amountRange} onValueChange={setAmountRange} dir={fa ? 'rtl' : 'ltr'}>
                      <SelectTrigger><SelectValue placeholder={t('invAmount', lang)} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNDER_50M">{t('amountOpt1', lang)}</SelectItem>
                        <SelectItem value="M_50_200">{t('amountOpt2', lang)}</SelectItem>
                        <SelectItem value="M_200_1B">{t('amountOpt3', lang)}</SelectItem>
                        <SelectItem value="OVER_1B">{t('amountOpt4', lang)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t('message', lang)}</Label>
                  <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={fa ? 'مثلاً: حوزهٔ علاقه‌مندی برای مشارکت، تجربهٔ قبلی…' : 'e.g. your preferred area, prior experience…'} />
                </div>
                <Button onClick={submit} disabled={busy} className="mt-1">
                  {busy ? (<><Loader2 className="h-4 w-4 animate-spin" />{t('poBusy', lang)}</>) : (<><TrendingUp className="h-4 w-4" />{t('invSubmit', lang)}</>)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
