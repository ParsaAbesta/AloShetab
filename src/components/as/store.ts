'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from './i18n';

export type View = 'home' | 'services' | 'products' | 'invest' | 'fund' | 'order' | 'track' | 'help' | 'contact' | 'join' | 'admin';

export interface CartItem {
  key: string;
  qty: number;
  details?: string[]; // شناسهٔ ریز جزئیات انتخاب‌شده (پیام ۱۰)
}

export interface LastOrderInfo {
  code: string;
  total: number;
  rrn?: string;
  method?: 'GATEWAY' | 'CARD_TRANSFER';
  needsExpertise?: boolean;
  mode: 'ONSITE' | 'REMOTE';
  createdAt: string;
}

interface AsState {
  lang: Lang;
  view: View;
  edition: 'IRAN' | 'WORLD'; // نسخهٔ کاتالوگ: ایران v1 یا جهانی v2.0
  cart: CartItem[];
  miscNotes: string;
  lastOrder: LastOrderInfo | null;
  trackPrefill: string | null;
  setLang: (l: Lang) => void;
  setView: (v: View) => void;
  setEdition: (e: 'IRAN' | 'WORLD') => void;
  addToCart: (key: string, details?: string[]) => void;
  removeFromCart: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  setCartDetails: (key: string, details: string[]) => void;
  clearCart: () => void;
  setMiscNotes: (s: string) => void;
  setLastOrder: (o: LastOrderInfo | null) => void;
  setTrackPrefill: (code: string | null) => void;
}

export const useAs = create<AsState>()(
  persist(
    (set) => ({
      lang: 'fa',
      view: 'home',
      edition: 'IRAN',
      cart: [],
      miscNotes: '',
      lastOrder: null,
      trackPrefill: null,
      setLang: (lang) => set({ lang }),
      setView: (view) => set({ view }),
      setEdition: (edition) => set({ edition }),
      addToCart: (key, details) =>
        set((s) => {
          const ex = s.cart.find((c) => c.key === key);
          if (ex) return { cart: s.cart.map((c) => (c.key === key ? { ...c, qty: Math.min(99, c.qty + 1), details: details ?? c.details } : c)) };
          return { cart: [...s.cart, { key, qty: 1, details: details?.length ? details : undefined }] };
        }),
      removeFromCart: (key) => set((s) => ({ cart: s.cart.filter((c) => c.key !== key) })),
      setQty: (key, qty) =>
        set((s) => ({
          cart: qty <= 0 ? s.cart.filter((c) => c.key !== key) : s.cart.map((c) => (c.key === key ? { ...c, qty: Math.min(99, qty) } : c)),
        })),
      setCartDetails: (key, details) =>
        set((s) => ({ cart: s.cart.map((c) => (c.key === key ? { ...c, details: details.length ? details : undefined } : c)) })),
      clearCart: () => set({ cart: [], miscNotes: '' }),
      setMiscNotes: (miscNotes) => set({ miscNotes }),
      setLastOrder: (lastOrder) => set({ lastOrder }),
      setTrackPrefill: (trackPrefill) => set({ trackPrefill }),
    }),
    {
      name: 'aloshetab-state',
      partialize: (s) => ({ lang: s.lang, edition: s.edition, cart: s.cart, miscNotes: s.miscNotes }),
    }
  )
);
