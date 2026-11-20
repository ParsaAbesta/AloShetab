// ─── پیام ۱۱: احراز هویت پنل مدیریتی — دو دسترسی مالک و ادمین ──
import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';

export type AdminRole = 'OWNER' | 'ADMIN';

export interface AdminSession {
  username: string;
  role: AdminRole;
  displayName: string;
}

const COOKIE = 'as_admin';
const APP_SALT = 'aloshetab::p11::secure::panel';

export function hashPass(password: string): string {
  return createHash('sha256').update(`${APP_SALT}:${password}`).digest('hex');
}

/** مقایسهٔ زمان-ثابت — ضد حملهٔ timing */
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function tokenFor(username: string, role: AdminRole, passHash: string): string {
  return createHash('sha256').update(`${APP_SALT}:${username}:${role}:${passHash}`).digest('hex');
}

export async function loginAdmin(username: string, password: string): Promise<AdminSession> {
  const user = await db.adminUser.findUnique({ where: { username: username.trim().toLowerCase() } });
  if (!user || !user.active) throw new Error('نام کاربری یا رمز عبور نادرست است');
  const h = hashPass(password);
  if (!safeEq(h, user.passHash)) throw new Error('نام کاربری یا رمز عبور نادرست است');
  const role = user.role as AdminRole;
  const jar = await (await import('next/headers')).cookies();
  jar.set(COOKIE, `${user.username}.${role}.${tokenFor(user.username, role, user.passHash)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 14,
    path: '/',
  });
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { username: user.username, role, displayName: user.displayName };
}

export async function logoutAdmin(): Promise<void> {
  const jar = await (await import('next/headers')).cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const jar = await (await import('next/headers')).cookies();
  const c = jar.get(COOKIE)?.value;
  if (!c) return null;
  const parts = c.split('.');
  if (parts.length !== 3) return null;
  const [username, role, token] = parts;
  const user = await db.adminUser.findUnique({ where: { username } });
  if (!user || !user.active || user.role !== role) return null;
  if (!safeEq(tokenFor(user.username, user.role as AdminRole, user.passHash), token)) return null;
  return { username: user.username, role: user.role as AdminRole, displayName: user.displayName };
}

/** هر کاربر پنل (مالک یا ادمین) */
export async function isAdmin(): Promise<boolean> {
  return (await getSession()) !== null;
}

/** فقط مالک */
export async function isOwner(): Promise<boolean> {
  return (await getSession())?.role === 'OWNER';
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: 'دسترسی غیرمجاز' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function forbidden(msg = 'این عملیات فقط با دسترسی مالک مجاز است'): Response {
  return new Response(JSON.stringify({ error: 'FORBIDDEN', message: msg }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** تغییر رمز کاربر پنل */
export async function changePassword(username: string, newPassword: string): Promise<void> {
  await db.adminUser.update({
    where: { username: username.trim().toLowerCase() },
    data: { passHash: hashPass(newPassword) },
  });
}
