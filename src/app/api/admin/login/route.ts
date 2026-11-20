import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loginAdmin, logoutAdmin, getSession, hashPass, changePassword } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/reports';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const schema = z.object({
  username: z.string().trim().min(2).max(40),
  password: z.string().min(1).max(100),
});

/** ورود امن پنل مدیریتی — دو دسترسی: مالک (OWNER) و ادمین (ADMIN) */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'نام کاربری و رمز عبور الزامی است' }, { status: 400 });
  }
  try {
    // سازگاری: اگر هیچ کاربر پنلی وجود ندارد، مالک با رمز تنظیمات ساخته می‌شود
    const count = await db.adminUser.count();
    if (count === 0) {
      const s = await getSettings();
      const username = parsed.data.username.trim().toLowerCase();
      if (parsed.data.password === s.ADMIN_PASSWORD) {
        await db.adminUser.create({
          data: { username, role: 'OWNER', passHash: hashPass(parsed.data.password), displayName: 'مالک ألو شتاب' },
        });
      }
    }
    const session = await loginAdmin(parsed.data.username, parsed.data.password);
    await logActivity('ADMIN', `ورود موفق پنل (${session.role === 'OWNER' ? 'مالک' : 'ادمین'})`, session.username);
    return NextResponse.json({ ok: true, role: session.role, displayName: session.displayName, username: session.username });
  } catch (err) {
    await logActivity('SYSTEM', 'تلاش ناموفق ورود پنل', parsed.data.username);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'خطای ورود' },
      { status: 401 }
    );
  }
}

/** نشست فعلی — نقش و نام کاربر */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ logged: false });
  return NextResponse.json({ logged: true, role: s.role, displayName: s.displayName, username: s.username });
}

export async function DELETE() {
  await logoutAdmin();
  return NextResponse.json({ ok: true });
}

/** تغییر رمز — مالک می‌تواند رمز هر دو را عوض کند؛ ادمین فقط رمز خودش */
export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const schema2 = z.object({
    target: z.enum(['OWNER', 'ADMIN']),
    newPassword: z.string().min(6).max(60),
  });
  const parsed = schema2.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'رمز جدید باید حداقل ۶ کاراکتر باشد' }, { status: 400 });
  }
  if (s.role !== 'OWNER') {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'تغییر رمز فقط با دسترسی مالک مجاز است' }, { status: 403 });
  }
  const username = parsed.data.target === 'OWNER' ? 'owner' : 'admin';
  await changePassword(username, parsed.data.newPassword);
  await logActivity('ADMIN', `تغییر رمز ${parsed.data.target === 'OWNER' ? 'مالک' : 'ادمین'}`);
  return NextResponse.json({ ok: true });
}
