'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Mail, MapPin } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';

export default function Contact() {
  const { lang } = useAs();
  const [form, setForm] = useState({ name: '', phone: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (form.name.trim().length < 3 || form.phone.trim().length < 7 || form.message.trim().length < 5) {
      toast.error(t('errField', lang));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim(), subject: form.subject.trim() || null, message: form.message.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      toast.success(t('sentOk', lang));
      setDone(true);
      setForm({ name: '', phone: '', subject: '', message: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric', lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 pb-16">
      <div className="mt-8">
        <h1 className="text-xl sm:text-2xl font-extrabold">{t('contactTitle', lang)}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('contactSub', lang)}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="p-4 space-y-4">
            {done && (
              <div className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {t('sentOk', lang)}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">{t('yourName', lang)} *</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">{t('yourPhone', lang)} *</Label>
                <Input id="c-phone" dir="ltr" className="ltr-num text-start" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-subj">{t('subject', lang)}</Label>
              <Input id="c-subj" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-msg">{t('message', lang)} *</Label>
              <Textarea id="c-msg" rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            </div>
            <Button className="w-full font-bold gap-2" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('send', lang)}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3 text-sm">
              <p className="flex items-center gap-2.5 text-muted-foreground" dir="ltr">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">AloShetabOwner@Gmail.com</span>
              </p>
              <p className="flex items-center gap-2.5 text-muted-foreground leading-5">
                <MapPin className="h-4 w-4 shrink-0" />
                {lang === 'fa' ? 'خدمات در سراسر کشور — حضوری و از راه دور' : 'Nationwide services — on-site & remote'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/60">
            <CardContent className="p-4 text-xs leading-6 text-muted-foreground">
              {lang === 'fa'
                ? 'پیام شما در پنل ادمین الو شتاب ثبت و برای دو ایمیل شرکت صف‌بندی می‌شود؛ کارشناسان ما در سریع‌ترین زمان تماس می‌گیرند.'
                : 'Your message is registered in the Alo Shetab admin panel and queued to both company emails; our experts will call you shortly.'}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
