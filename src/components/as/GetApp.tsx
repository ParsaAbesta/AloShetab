'use client';

import { useState, useSyncExternalStore } from 'react';
import { Copy, Check, Share2, Smartphone, QrCode, Download, Loader2 } from 'lucide-react';
import { useAs } from './store';
import { t } from './i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const noopSubscribe = () => () => {};
const getAppUrl = () => window.location.origin + '/';
const emptyUrl = () => '';

/** آدرس سامانه — فقط سمت کلاینت (بدون mismatch و بدون setState در effect) */
function useAppUrl(): string {
  return useSyncExternalStore(noopSubscribe, getAppUrl, emptyUrl);
}

/** محتوای مشترک دیالوگ/بخش «دریافت برنامه»: QR + لینک + کپی + اشتراک‌گذاری */
export function GetAppContent({ compact = false }: { compact?: boolean }) {
  const { lang } = useAs();
  const url = useAppUrl();
  const [copied, setCopied] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function shareLink() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Alo Shetab — ألو شتاب', text: lang === 'fa' ? 'سامانهٔ ألو شتاب' : 'Alo Shetab app', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share cancelled */
    }
  }

  return (
    <div className={compact ? 'flex flex-col items-center gap-4 sm:flex-row sm:items-center' : 'flex flex-col items-center gap-5'}>
      {/* QR */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="rounded-2xl border-2 border-primary/20 bg-white p-2.5 shadow-sm">
          {url ? (
            imgOk ? (
              <img
                src={`/api/qr?text=${encodeURIComponent(url)}`}
                alt={t('getAppScan', lang)}
                width={168}
                height={168}
                className="h-42 w-42 rounded-lg"
                onError={() => setImgOk(false)}
              />
            ) : (
              <div className="flex h-42 w-42 items-center justify-center rounded-lg bg-secondary">
                <QrCode className="h-16 w-16 text-muted-foreground" />
              </div>
            )
          ) : (
            <div className="flex h-42 w-42 items-center justify-center rounded-lg bg-secondary">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{t('getAppScan', lang)}</p>
      </div>

      {/* لینک + اکشن‌ها */}
      <div className="flex w-full flex-col gap-3 sm:max-w-sm">
        <div>
          <p className="mb-1.5 text-xs font-bold text-muted-foreground">{t('getAppLink', lang)}:</p>
          <div className="flex items-center gap-2 rounded-xl border bg-secondary/40 p-2" dir="ltr">
            <Smartphone className="ms-1 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{url || '…'}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyLink} aria-label={t('copy', lang)}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={shareLink} className="gap-1.5">
            <Share2 className="h-4 w-4" />
            {t('getAppShare', lang)}
          </Button>
          <a href={url || '#'} target="_blank" rel="noreferrer">
            <Button size="sm" variant="secondary" className="gap-1.5">
              <Download className="h-4 w-4" />
              {t('navGetApp', lang)}
            </Button>
          </a>
        </div>
        <p className="rounded-lg bg-secondary/50 p-2.5 text-xs leading-5 text-muted-foreground">{t('getAppInstall', lang)}</p>
      </div>
    </div>
  );
}

/** دکمهٔ هدر + دیالوگ «دریافت برنامه» */
export default function GetAppButton() {
  const { lang } = useAs();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-full border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground">
          <QrCode className="h-4 w-4" />
          <span className="hidden sm:inline">{t('navGetApp', lang)}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {t('getAppTitle', lang)}
          </DialogTitle>
          <DialogDescription className="text-start leading-6 pt-1">{t('getAppSub', lang)}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <GetAppContent compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** بخش صفحهٔ اصلی «دریافت برنامه» */
export function GetAppSection() {
  const { lang } = useAs();
  return (
    <section className="mt-12">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/40">
        <CardContent className="p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <QrCode className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold">{t('getAppTitle', lang)}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{t('getAppSub', lang)}</p>
            </div>
          </div>
          <p className="mb-6 hidden text-sm leading-6 text-muted-foreground sm:block">{t('getAppSub', lang)}</p>
          <GetAppContent compact />
        </CardContent>
      </Card>
    </section>
  );
}
