import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({ description: z.string().trim().min(15).max(2000) });

interface EstimateResult {
  price: number | null;
  needsExpertise: boolean;
  note?: string;
}

/** برآورد اولیهٔ نرخ پروژهٔ «متفرقه» با هوش مصنوعی (سمت سرور) */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'لطفاً شرح نیاز را کامل‌تر بنویسید (حداقل ۱۵ کاراکتر)' }, { status: 400 });
  }
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'تو کارشناس قیمت‌گذاری خدمات فنی و خدماتی در ایران هستی. کاربر نیاز خود را توضیح می‌دهد. اگر بتوانی نرخ انجام را برآورد کردی فقط JSON برگردان: {"price": <مبلغ به تومان عدد صحیح>, "needsExpert": false, "note": "یک جملهٔ کوتاه فارسی دربارهٔ برآورد"}. اگر کار پیچیده/ابهام‌دار است و کارشناسی حضوری لازم است: {"price": null, "needsExpert": true, "note": "علت کوتاه"}. هیچ متن دیگری ننویس.',
          },
          { role: 'user', content: parsed.data.description.slice(0, 1500) },
        ],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000)),
    ]);
    const content = (completion as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as EstimateResult & { needsExpert?: boolean };
      if (typeof obj.price === 'number' && obj.price > 0) {
        return NextResponse.json({ price: Math.round(obj.price), needsExpertise: false, note: obj.note ?? '' });
      }
      return NextResponse.json({ price: null, needsExpertise: true, note: obj.note ?? '' });
    }
    return NextResponse.json({ price: null, needsExpertise: true, note: '' });
  } catch {
    return NextResponse.json({ price: null, needsExpertise: true, note: '' });
  }
}
