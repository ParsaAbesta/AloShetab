'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAs } from './store';
import { t } from './i18n';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/** پشتیبانی هوشمند ألو شتاب — چت‌بات در همهٔ صفحات (PRD §11) */
export default function ChatBot() {
  const { lang } = useAs();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // پیام خوش‌آمد + تغییر زبان
  useEffect(() => {
    setMsgs((m) => (m.length === 0 ? [{ role: 'assistant', content: t('chatWelcome', lang) }] : m));
  }, [lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang,
          history: next.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const d = await res.json();
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply ?? t('errGeneric', lang) }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: t('errGeneric', lang) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* دکمهٔ شناور */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 18 }}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('chatOpen', lang)}
        className="fixed bottom-4 start-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 start-3 sm:start-4 z-50 flex h-[min(520px,70vh)] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
            role="dialog"
            aria-label={t('chatTitle', lang)}
          >
            {/* هدر */}
            <div className="flex items-center gap-2.5 border-b bg-primary px-4 py-3 text-primary-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{t('chatTitle', lang)}</p>
                <p className="flex items-center gap-1 text-[10px] opacity-85">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {lang === 'fa' ? 'آنلاین — فارسی / English' : 'Online — English / فارسی'}
                </p>
              </div>
            </div>

            {/* پیام‌ها */}
            <div ref={scrollRef} className="as-scroll flex-1 space-y-2.5 overflow-y-auto p-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 ${
                      m.role === 'user'
                        ? 'rounded-ee-md bg-primary text-primary-foreground'
                        : 'rounded-es-md bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-es-md bg-secondary px-3.5 py-2.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">{t('loading', lang)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ورودی */}
            <div className="flex items-center gap-2 border-t p-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={t('chatPlaceholder', lang)}
                className="h-10 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                aria-label={t('chatPlaceholder', lang)}
              />
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={send} disabled={busy || !input.trim()} aria-label={t('chatSend', lang)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
