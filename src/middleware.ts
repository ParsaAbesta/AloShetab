// ─── پیام ۲۰ (V5.0): سخت‌سازی امنیتی — «فوق‌العاده ایمن و غیرقابل هک» ──────────
//  • هدرهای امنیتی روی همهٔ پاسخ‌ها (CSP، nosniff، DENY-framing، HSTS در production)
//  • محدودسازی نرخ درخواست (ضد brute-force ورود پنل: ۸ تلاش در دقیقه برای هر IP؛
//    و کل API: ۲۴۰ POST در دقیقه برای هر IP) — درخواست‌های اضافه → 429
//  • درخواست‌های استاتیک Next نادیده گرفته می‌شوند (کارایی)
import { NextRequest, NextResponse } from 'next/server';

const windows = new Map<string, { n: number; t: number }>();

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = windows.get(key);
  if (!b || now - b.t > windowMs) {
    windows.set(key, { n: 1, t: now });
    if (windows.size > 20000) {
      for (const [k, v] of windows) if (now - v.t > windowMs) windows.delete(k);
    }
    return false;
  }
  b.n += 1;
  return b.n > limit;
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'direct';
}

export function middleware(req: NextRequest) {
  const ip = clientIp(req);
  const { pathname } = req.nextUrl;

  if (req.method === 'POST' && pathname === '/api/admin/login' && hit(`login:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'تلاش‌های ورود بیش از حد مجاز است — یک دقیقه بعد دوباره تلاش کنید' }, { status: 429 });
  }
  if (req.method === 'POST' && pathname.startsWith('/api/') && hit(`api:${ip}`, 240, 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'درخواست‌های بیش از حد — کمی بعد دوباره تلاش کنید' }, { status: 429 });
  }

  const res = NextResponse.next();
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  h.set('X-DNS-Prefetch-Control', 'off');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    h.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
