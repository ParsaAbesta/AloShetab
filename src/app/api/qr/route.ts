import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** تولید QR code SVG — ?text=... (پیش‌فرض: آدرس فعلی سامانه) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get('text') || searchParams.get('t') || '').trim().slice(0, 800);
  if (!text) {
    return NextResponse.json({ error: 'MISSING_TEXT', message: 'پارامتر text الزامی است' }, { status: 400 });
  }
  try {
    const QRCode = (await import('qrcode')).default;
    const svg = await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'QR_FAILED', message: 'تولید QR ناموفق بود' }, { status: 500 });
  }
}
