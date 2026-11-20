'use client';

import { useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Zap, Moon, Sun, Languages, Menu, X, MoreHorizontal, Globe2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAs, type View } from './store';
import { t } from './i18n';
import Holding from './Holding';
import Catalog from './Catalog';
import Products from './Products';
import Invest from './Invest';
import Fund from './Fund';
import OrderWizard from './OrderWizard';
import Track from './Track';
import Help from './Help';
import Contact from './Contact';
import Join from './Join';
import Admin from './Admin';
import ChatBot from './ChatBot';
import GetAppButton from './GetApp';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function NavButtons({ lang, view, setView, onPick, className }: { lang: 'fa' | 'en'; view: View; setView: (v: View) => void; onPick?: () => void; className?: string }) {
  const go = (v: View) => {
    setView(v);
    onPick?.();
  };
  const primary: { key: View; label: string }[] = [
    { key: 'home', label: t('navHolding', lang) },
    { key: 'services', label: t('navServices', lang) },
    { key: 'products', label: t('navProducts', lang) },
    { key: 'invest', label: t('navInvest', lang) },
    { key: 'fund', label: t('navFund', lang) },
  ];
  const secondary: { key: View; label: string }[] = [
    { key: 'track', label: t('navTrack', lang) },
    { key: 'help', label: t('navHelp', lang) },
    { key: 'join', label: t('navJoin', lang) },
    { key: 'contact', label: t('navContact', lang) },
    { key: 'admin', label: t('navAdmin', lang) },
  ];
  return (
    <div className={className}>
      {primary.map((n) => (
        <Button
          key={n.key}
          variant={view === n.key ? 'default' : 'ghost'}
          size="sm"
          onClick={() => go(n.key)}
        >
          {n.label}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={secondary.some((s) => s.key === view) ? 'default' : 'ghost'} size="sm" aria-label={t('moreMenu', lang)}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden xl:inline">{t('moreMenu', lang)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {secondary.map((n) => (
            <DropdownMenuItem key={n.key} onClick={() => go(n.key)} className={view === n.key ? 'bg-secondary font-bold' : ''}>
              {n.label}
            </DropdownMenuItem>
          ))
          }
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** سوییچ نسخهٔ ایران (fa) / جهانی (en) — پیام ۱۴ */
function EditionSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, edition, setEdition, setLang } = useAs();
  const pick = (e: 'IRAN' | 'WORLD') => {
    setEdition(e);
    setLang(e === 'WORLD' ? 'en' : 'fa'); // نسخهٔ ایران fa — نسخهٔ جهانی en
  };
  return (
    <div className={`flex items-center rounded-lg border overflow-hidden ${compact ? 'h-9' : 'h-8'}`} role="group" aria-label="edition">
      <button
        type="button"
        className={`flex items-center gap-1 px-2 h-full text-[11px] font-bold transition-colors ${edition === 'IRAN' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
        onClick={() => pick('IRAN')}
      >
        <Globe2 className="h-3 w-3" />
        {t('editionIRAN', lang)}
      </button>
      <button
        type="button"
        className={`flex items-center gap-1 px-2 h-full text-[11px] font-bold transition-colors ${edition === 'WORLD' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
        onClick={() => pick('WORLD')}
      >
        {t('editionWORLD', lang)}
      </button>
    </div>
  );
}

function Header() {
  const { lang, setLang, view, setView } = useAs();
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
        <button className="flex items-center gap-2 shrink-0" onClick={() => setView('home')} aria-label="Alo Shetab">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Zap className="h-5 w-5" />
          </span>
          <span className="hidden sm:block font-extrabold text-lg tracking-tight">{t('brand', lang)}</span>
        </button>

        <div className="mx-auto hidden md:flex items-center gap-1">
          <NavButtons lang={lang} view={view} setView={setView} />
        </div>

        <div className="ms-auto md:ms-0 flex items-center gap-1.5">
          <div className="hidden sm:block"><EditionSwitch /></div>
          <GetAppButton />
          <Button
            variant="ghost"
            size="icon"
            aria-label="language"
            onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
          >
            <span className="flex items-center gap-1 text-xs font-bold">
              <Languages className="h-4 w-4" />
              {lang === 'fa' ? 'EN' : 'FA'}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4.5 w-4.5 hidden dark:block" />
            <Moon className="h-4.5 w-4.5 dark:hidden" />
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="menu">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side={lang === 'fa' ? 'right' : 'left'} className="w-72">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </span>
                {t('brand', lang)}
              </SheetTitle>
              <div className="mt-4 flex flex-col gap-1.5">
                <div className="pb-1"><EditionSwitch compact /></div>
                <NavButtons lang={lang} view={view} setView={setView} onPick={() => setOpen(false)} className="flex flex-col gap-1.5 items-stretch [&>button]:justify-center" />
                <div className="mt-1 flex justify-center pb-2">
                  <GetAppButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { lang, edition } = useAs();
  const [phone, setPhone] = useState('09014700109');
  const [version, setVersion] = useState('');

  // تلفن پشتیبانی فقط همین‌جا (فوتر) نمایش داده می‌شود — طبق پیام ۱۰
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings?.SUPPORT_PHONE) setPhone(d.settings.SUPPORT_PHONE);
        if (d?.settings?.VERSION) setVersion(d.settings.VERSION);
      })
      .catch(() => {});
  }, []);

  // نسخهٔ ایران fa / نسخهٔ جهانی en — پسوند نسخه طبق نسخهٔ فعال
  const displayVersion = version ? version.replace(/-(IR|WORLD)$/, edition === 'WORLD' ? '-WORLD' : '-IR') : '';

  const fmtPhone = (p: string) => p.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3').replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]);

  return (
    <footer className="mt-auto border-t bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 py-6 grid gap-4 sm:grid-cols-3 text-sm">
        <div>
          <p className="font-bold mb-1.5">{t('brand', lang)}</p>
          <p className="text-muted-foreground leading-6">{t('tagline', lang)}</p>
          {displayVersion && (
            <p className="mt-1.5 text-xs text-muted-foreground/80">
              {t('versionDomain', lang).replace('{v}', displayVersion)}
            </p>
          )}
        </div>
        <div>
          <p className="font-bold mb-1.5">{t('rules', lang)}</p>
          <p className="text-muted-foreground leading-6">{t('footerRules', lang)}</p>
        </div>
        <div>
          <p className="font-bold mb-1.5">{t('support', lang)}</p>
          <a href={`tel:${phone}`} className="ltr-num block text-primary font-bold leading-6 hover:underline" dir="ltr">{fmtPhone(phone)}</a>
          <p className="text-muted-foreground leading-6 mt-1" dir="ltr">AloShetabOwner@Gmail.com</p>
          <p className="text-xs text-muted-foreground/70 mt-2">{t('footerLangs', lang)}</p>
        </div>
      </div>
    </footer>
  );
}

export default function AsApp({ initialView }: { initialView?: View } = {}) {
  const { view, setEdition, setLang, setView } = useAs();

  // نمای اولیهٔ اختصاصی (مثلاً مسیر مستقل پنل مدیریت /admin — پیام ۱۴)
  useEffect(() => {
    if (initialView) setView(initialView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // نسخهٔ ایران fa / نسخهٔ جهانی en — پارامتر آدرس (برای APK نسخهٔ جهانی):
  // ?lang=en&edition=WORLD یا ?lang=fa&edition=IRAN
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ed = p.get('edition');
    const lg = p.get('lang');
    if (ed === 'WORLD' || ed === 'IRAN') setEdition(ed);
    if (lg === 'fa' || lg === 'en') setLang(lg);
    else if (ed === 'WORLD') setLang('en');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // نصب PWA — ثبت service worker (PRD §12)
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          {view === 'home' && <Holding />}
          {view === 'services' && <Catalog />}
          {view === 'products' && <Products />}
          {view === 'invest' && <Invest />}
          {view === 'fund' && <Fund />}
          {view === 'order' && <OrderWizard />}
          {view === 'track' && <Track />}
          {view === 'help' && <Help />}
          {view === 'join' && <Join />}
          {view === 'contact' && <Contact />}
          {view === 'admin' && <Admin />}
        </main>
        <Footer />
        <ChatBot />
      </div>
    </ThemeProvider>
  );
}
