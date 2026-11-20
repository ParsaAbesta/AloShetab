'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, HandHeart, BadgeCheck, Send } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';

/** جذب همکار (PRD §8) — ثبت مستقیم درخواست در پنل ادمین الو شتاب */
export default function Join() {
  const { lang } = useAs();
  const isFa = lang === 'fa';
  const [form, setForm] = useState({ fullName: '', nationalId: '', mobile: '', city: '', field: '', resume: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = isFa ? 'نام و نام خانوادگی کامل را وارد کنید' : 'Enter full name';
    if (!/^\d{10}$/.test(form.nationalId.trim())) e.nationalId = isFa ? 'کد ملی باید دقیقاً ۱۰ رقم باشد' : 'National ID must be exactly 10 digits';
    if (!/^09\d{9}$/.test(form.mobile.trim())) e.mobile = isFa ? 'تلفن همراه باید ۱۱ رقم و با ۰۹ شروع شود' : 'Mobile must be 11 digits starting with 09';
    if (form.city.trim().length < 2) e.city = isFa ? 'شهر را وارد کنید' : 'Enter your city';
    if (form.field.trim().length < 2) e.field = isFa ? 'رشتهٔ تخصصی را وارد کنید' : 'Enter your specialty';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          nationalId: form.nationalId.trim(),
          mobile: form.mobile.trim(),
          city: form.city.trim(),
          field: form.field.trim(),
          resume: form.resume.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? t('errGeneric', lang));
      setDone(d.status === 'APPROVED' ? 'approved' : 'pending');
      toast.success(d.message ?? t('joinDone', lang));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  }

  const Err = ({ k }: { k: string }) =>
    errors[k] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[k]}</p> : null;

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4 pb-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mt-6">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <HandHeart className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold">{t('joinTitle', lang)}</h1>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground leading-5">{t('joinSub', lang)}</p>
              </div>
            </div>

            {done ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold leading-7 text-emerald-700 dark:text-emerald-400">
                <BadgeCheck className="mb-1 h-5 w-5" />
                <p>{done === 'approved' ? t('joinDupApproved', lang) : t('joinDone', lang)}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="j-name">{t('fullName', lang)} *</Label>
                    <Input id="j-name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} autoComplete="name" />
                    <Err k="fullName" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="j-nid">{t('nationalId', lang)} *</Label>
                    <Input id="j-nid" className="ltr-num text-start" dir="ltr" inputMode="numeric" maxLength={10} value={form.nationalId} onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value.replace(/\D/g, '') }))} />
                    <Err k="nationalId" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="j-mobile">{t('mobile', lang)} *</Label>
                    <Input id="j-mobile" className="ltr-num text-start" dir="ltr" inputMode="tel" maxLength={11} placeholder="09xxxxxxxxx" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} />
                    <Err k="mobile" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="j-city">{t('joinCity', lang)} *</Label>
                    <Input id="j-city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                    <Err k="city" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="j-field">{t('joinField', lang)} *</Label>
                  <Input id="j-field" value={form.field} onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))} placeholder={t('joinFieldHint', lang)} />
                  <Err k="field" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="j-resume">{t('joinResume', lang)}</Label>
                  <Textarea id="j-resume" rows={4} value={form.resume} onChange={(e) => setForm((f) => ({ ...f, resume: e.target.value }))} placeholder={t('joinResumeHint', lang)} />
                </div>
                <Button className="w-full gap-2 font-bold" onClick={submit} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('joinSubmit', lang)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
