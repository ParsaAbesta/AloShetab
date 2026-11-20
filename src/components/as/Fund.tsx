'use client';

import { useState } from 'react';
import { HeartHandshake, HandHeart, HandCoins, Loader2, BadgeCheck } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const GOALS = ['fundGoal1', 'fundGoal2', 'fundGoal3', 'fundGoal4'] as const;

export default function Fund() {
  const { lang } = useAs();
  const { toast } = useToast();
  const fa = lang === 'fa';

  const [tab, setTab] = useState<'SUPPORT' | 'CONTRIBUTE'>('SUPPORT');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (fullName.trim().length < 3 || !/^09\d{9}$/.test(mobile.trim()) || message.trim().length < 10) {
      toast({ title: fa ? 'نام، موبایل (۰۹…) و شرح (حداقل ۱۰ کاراکتر) را کامل کنید.' : 'Fill name, mobile (09…) and description (min 10 chars).', variant: 'destructive' });
      return;
    }
    if (tab === 'CONTRIBUTE' && !category) {
      toast({ title: fa ? 'نوع مشارکت را انتخاب کنید.' : 'Choose the contribution type.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: tab,
          fullName: fullName.trim(),
          mobile: mobile.trim(),
          category: tab === 'CONTRIBUTE' ? category : null,
          amount: amount ? parseInt(amount.replace(/\D/g, ''), 10) || null : null,
          message: message.trim(),
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
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-700 via-rose-800 to-emerald-900 px-5 py-10 sm:px-10 text-primary-foreground shadow-lg">
        <div className="absolute -top-14 -start-14 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-snug">{t('fundTitle', lang)}</h1>
          <p className="mt-3 text-sm sm:text-base leading-7 opacity-90">{t('fundSub', lang)}</p>
        </div>
      </section>

      {/* اهداف صندوق */}
      <section className="mt-8">
        <h2 className="text-lg sm:text-xl font-extrabold">{t('fundGoalsTitle', lang)}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GOALS.map((g, i) => (
            <Card key={g}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
                  {fa ? ['۱', '۲', '۳', '۴'][i] : i + 1}
                </span>
                <p className="text-sm leading-6 text-muted-foreground">{t(g, lang)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* فرم‌ها */}
      <section className="mt-10">
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
              <Button variant={tab === 'SUPPORT' ? 'default' : 'ghost'} size="sm" onClick={() => { setTab('SUPPORT'); setDone(false); }} className="gap-1.5">
                <HandHeart className="h-4 w-4" />
                {t('fundSupportTitle', lang)}
              </Button>
              <Button variant={tab === 'CONTRIBUTE' ? 'default' : 'ghost'} size="sm" onClick={() => { setTab('CONTRIBUTE'); setDone(false); }} className="gap-1.5">
                <HandCoins className="h-4 w-4" />
                {t('fundContributeTitle', lang)}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {tab === 'SUPPORT' ? t('fundSupportDesc', lang) : t('fundContributeDesc', lang)}
            </p>

            {done ? (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-emerald-50 py-8 text-center dark:bg-emerald-900/20">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                  <BadgeCheck className="h-6 w-6" />
                </span>
                <p className="max-w-sm text-sm font-bold leading-6">{t('fundDone', lang)}</p>
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
                {tab === 'CONTRIBUTE' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label>{t('fundCategory', lang)} *</Label>
                      <Select value={category} onValueChange={setCategory} dir={fa ? 'rtl' : 'ltr'}>
                        <SelectTrigger><SelectValue placeholder={t('fundCategory', lang)} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FINANCIAL">{t('catFinancial', lang)}</SelectItem>
                          <SelectItem value="NON_FINANCIAL">{t('catNonFinancial', lang)}</SelectItem>
                          <SelectItem value="SERVICE">{t('catService', lang)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>{t('fundAmount', lang)}</Label>
                      <Input dir="ltr" className="ltr-num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label>{t('fundMessage', lang)} *</Label>
                  <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={tab === 'SUPPORT' ? (fa ? 'شرح نیاز یا وضعیت خود را بنویسید…' : 'Describe your need or situation…') : (fa ? 'نوع مشارکت و شرایط خود را بنویسید…' : 'Describe your contribution…')} />
                </div>
                <Button onClick={submit} disabled={busy} className="mt-1">
                  {busy ? (<><Loader2 className="h-4 w-4 animate-spin" />{t('poBusy', lang)}</>) : (<><HeartHandshake className="h-4 w-4" />{tab === 'SUPPORT' ? t('fundSubmitSupport', lang) : t('fundSubmitContribute', lang)}</>)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
