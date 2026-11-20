'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShieldCheck, Landmark, Check } from 'lucide-react';
import { toast } from 'sonner';
import { t, type Lang } from './i18n';
import { money, moneyLabel } from './util';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  mobile: string;
  amount: number;
  lang: Lang;
  onSuccess: (rrn: string) => void;
}

type Phase = 'card' | 'pin' | 'otp' | 'processing';

function formatCard(v: string): string {
  return v.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1-');
}

/** درگاه شبیه‌سازی‌شدهٔ شاپرک/شتاب — چرخهٔ کامل کارت ← رمز دوم ← OTP */
export default function GatewayDialog({ open, onOpenChange, code, mobile, amount, lang, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>('card');
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [pin2, setPin2] = useState('');
  const [otp, setOtp] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPhase('card');
      setCard(''); setExp(''); setCvv(''); setPin2(''); setOtp('');
      setPaymentId(null);
    }
  }, [open]);

  useEffect(() => {
    if (phase !== 'otp') return;
    setCountdown(120);
    const iv = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    otpRef.current?.focus();
    return () => clearInterval(iv);
  }, [phase]);

  const cardDigits = card.replace(/\D/g, '');
  const cardValid = cardDigits.length === 16;
  const expValid = /^\d{2}\/?\d{2}$/.test(exp.replace(/\s/g, ''));
  const cvvValid = /^\d{3,4}$/.test(cvv);

  async function init(): Promise<string | null> {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init', code, mobile, method: 'GATEWAY' }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.message ?? t('errGeneric', lang));
      return null;
    }
    setPaymentId(d.paymentId);
    return d.paymentId;
  }

  async function toPin() {
    if (!cardValid || !expValid || !cvvValid) return;
    setBusy(true);
    try {
      const pid = await init();
      if (!pid) return;
      setPhase('pin');
    } finally {
      setBusy(false);
    }
  }

  async function toOtp() {
    if (pin2.trim().length < 4) return;
    setPhase('otp');
  }

  async function confirm() {
    if (!paymentId || !otp.trim() || otp.trim().length < 4) return;
    setBusy(true);
    setPhase('processing');
    try {
      // شبیه‌سازی تأخیر شبکهٔ شاپرک
      await new Promise((r) => setTimeout(r, 1200));
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gateway-confirm', paymentId, cardNumber: cardDigits, pin2, otp }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      toast.success(t('paySuccess', lang));
      onSuccess(d.rrn);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('payFailed', lang));
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gateway-fail', paymentId }),
      }).catch(() => {});
      setPhase('otp');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md p-0 overflow-hidden" dir="ltr" aria-describedby={undefined}>
        <div className="bg-gradient-to-l from-primary to-emerald-700 px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              <DialogTitle className="text-sm font-bold">{t('gatewayTitle', lang)}</DialogTitle>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wide">SHAPARAK · SHETAB</span>
          </div>
        </div>

        <div className="p-4 space-y-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-3 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">{t('merchant', lang)}</p>
              <p className="font-bold">ألو شتاب</p>
            </div>
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground">{t('amount', lang)}</p>
              <p className="font-extrabold text-primary ltr-num" dir="ltr">{money(amount, lang)} {moneyLabel(lang)}</p>
            </div>
          </div>

          {phase === 'card' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t('cardNumber', lang)}</Label>
                <Input
                  dir="ltr" inputMode="numeric" autoFocus
                  className="ltr-num text-center font-bold tracking-widest"
                  placeholder="####-####-####-####"
                  value={formatCard(card)}
                  onChange={(e) => setCard(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('cardExp', lang)}</Label>
                  <Input dir="ltr" inputMode="numeric" placeholder="MM/YY" maxLength={5}
                    className="ltr-num text-center"
                    value={exp}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                      setExp(v);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('cvv2', lang)}</Label>
                  <Input dir="ltr" inputMode="numeric" maxLength={4} type="password"
                    className="ltr-num text-center"
                    value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
              <Button className="w-full font-bold" disabled={busy || !cardValid || !expValid || !cvvValid} onClick={toPin}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {t('paySubmit', lang)}
              </Button>
            </div>
          )}

          {(phase === 'pin' || phase === 'otp' || phase === 'processing') && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t('cardNumber', lang)}</Label>
                <div className="rounded-lg border bg-secondary/60 px-3 py-2 text-center font-bold tracking-widest" dir="ltr">{formatCard(card)}</div>
              </div>

              {phase === 'pin' && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t('pin2', lang)}</Label>
                    <Input dir="ltr" type="password" inputMode="numeric" maxLength={12} autoFocus
                      className="ltr-num text-center tracking-widest"
                      value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <Button className="w-full font-bold" disabled={pin2.trim().length < 4} onClick={toOtp}>
                    {t('confirm', lang)}
                  </Button>
                </>
              )}

              {phase === 'otp' && (
                <>
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {t('otpSent', lang)} · <span className="ltr-num" dir="ltr">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
                  </p>
                  <div className="space-y-1.5">
                    <Label>{t('otp', lang)}</Label>
                    <Input ref={otpRef} dir="ltr" inputMode="numeric" maxLength={8}
                      className="ltr-num text-center text-lg font-bold tracking-[0.4em]"
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <Button className="w-full font-bold" disabled={busy || otp.trim().length < 4} onClick={confirm}>
                    <Check className="h-4 w-4" />
                    {t('confirm', lang)}
                  </Button>
                </>
              )}

              {phase === 'processing' && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-semibold">{t('payProcessing', lang)}</p>
                </div>
              )}

              <Separator />
              <Button variant="ghost" className="w-full text-xs" disabled={busy} onClick={() => (phase === 'pin' ? setPhase('card') : setPhase('pin'))}>
                {t('back', lang)}
              </Button>
            </div>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            {t('payGatewayHint', lang)} — کد سفارش: <span className="font-bold" dir="ltr">{code}</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
