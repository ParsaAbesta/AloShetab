'use client';

import { Monitor, Cctv, Network, Tv, Antenna, Refrigerator, Microwave, PaintRoller, Fingerprint, Scissors, Scale, Stethoscope, Car, Hammer, Globe, Smartphone, CircleHelp,
  GraduationCap, Music, Dumbbell, Languages, Calculator, Printer, Building2, Home, ShoppingBag, CarFront, ShieldCheck, Plane, Truck, PackageOpen, SprayCan,
  Wrench, Zap, AirVent, DoorClosed, GlassWater, Flower2, Shirt, Camera, UtensilsCrossed,
  HardDrive, Router, Cable, Laptop, PlugZap, LockKeyhole, Lightbulb, BatteryCharging, Package, type LucideIcon } from 'lucide-react';
import type { Lang } from './i18n';

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  computer: Monitor,
  cctv: Cctv,
  network: Network,
  tv: Tv,
  antenna: Antenna,
  fridge: Refrigerator,
  microwave: Microwave,
  painting: PaintRoller,
  tattoo: Fingerprint,
  beauty: Scissors,
  legal: Scale,
  medical: Stethoscope,
  mechanic: Car,
  pdr: Hammer,
  web: Globe,
  app: Smartphone,
  education: GraduationCap,
  music: Music,
  fitness: Dumbbell,
  translation: Languages,
  accounting: Calculator,
  printing: Printer,
  'realestate-rent': Building2,
  'realestate-sale': Home,
  sales: ShoppingBag,
  carsale: CarFront,
  insurance: ShieldCheck,
  travel: Plane,
  transport: Truck,
  moving: PackageOpen,
  cleaning: SprayCan,
  plumbing: Wrench,
  electric: Zap,
  hvac: AirVent,
  carpentry: DoorClosed,
  glass: GlassWater,
  greenery: Flower2,
  tailoring: Shirt,
  photography: Camera,
  catering: UtensilsCrossed,
  misc: CircleHelp,
};

// ─── آیکون‌های میز محصولات ─────────────────────────────────
export const PRODUCT_ICONS: Record<string, LucideIcon> = {
  cctv: Cctv,
  camera: Camera,
  harddrive: HardDrive,
  router: Router,
  cable: Cable,
  laptop: Laptop,
  monitor: Monitor,
  printer: Printer,
  plugzap: PlugZap,
  lock: LockKeyhole,
  lightbulb: Lightbulb,
  battery: BatteryCharging,
  package: Package,
};

export function ProductIconView({ k, className }: { k: string; className?: string }) {
  const C = PRODUCT_ICONS[k] ?? Package;
  return <C className={className} />;
}

export function serviceIcon(key: string): LucideIcon {
  return SERVICE_ICONS[key] ?? CircleHelp;
}

/** آیکون خدمت — به‌صورت کامپوننت سطح ماژول */
export function ServiceIconView({ k, className }: { k: string; className?: string }) {
  const C = SERVICE_ICONS[k] ?? CircleHelp;
  return <C className={className} />;
}

export function svcName(s: { nameFa: string; nameEn: string }, lang: Lang): string {
  return lang === 'fa' ? s.nameFa : s.nameEn;
}

export function svcDesc(s: { descFa: string; descEn: string }, lang: Lang): string {
  return lang === 'fa' ? s.descFa : s.descEn;
}

export interface ServiceDetailLite {
  id: string;
  nameFa: string;
  nameEn: string;
  price: number;
}

export interface ServiceLite {
  key: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  baseRate: number;
  remoteCapable: boolean;
  isMisc: boolean;
  category?: string;
  percentValue?: number | null;
  icon?: string;
  edition?: 'IRAN' | 'WORLD';
  currency?: 'IRT' | 'USD';
  aiGenerated?: boolean;
  details?: ServiceDetailLite[];
}

// ─── قالب‌بندی اعداد ────────────────────────────────────────
const FA = '۰۱۲۳۴۵۶۷۸۹';
export function faDigits(v: string | number): string {
  return String(v).replace(/[0-9]/g, (c) => FA[parseInt(c, 10)]);
}

export function money(v: number, lang: Lang): string {
  const s = Math.round(v).toLocaleString('en-US');
  return lang === 'fa' ? faDigits(s) : s;
}

export function factor(v: number, lang: Lang): string {
  const s = v.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return lang === 'fa' ? faDigits(s) : s;
}

export function moneyLabel(lang: Lang): string {
  return lang === 'fa' ? 'تومان' : 'Toman';
}

/** برچسب ارسال بر اساس ارز خدمت (نسخهٔ جهانی = دلار) */
export function curLabel(currency: string | undefined, lang: Lang): string {
  if (currency === 'USD') return lang === 'fa' ? 'دلار' : 'USD';
  return moneyLabel(lang);
}
