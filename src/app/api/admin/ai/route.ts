import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdmin, unauthorized } from '@/lib/adminAuth';
import { adminAssistant } from '@/lib/ai/assistant';

export const dynamic = 'force-dynamic';

const schema = z.object({ question: z.string().trim().min(2).max(600) });

/** دستیار هوشمند فوق‌هوشمند پنل مدیریتی — با آمار زندهٔ پنل */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const result = await adminAssistant(parsed.data.question);
  return NextResponse.json(result);
}
