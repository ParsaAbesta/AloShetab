// تولد نام انگلیسی و توضیح دوزبانه برای ۱۰۴ خدمت کاتالوگ رسمی الو شتاب
// خروجی: scripts/catalog104_enriched.json
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const SRC = '/home/z/my-project/download/alo_shetab_services_rates_1405-08-24.json';
const OUT = '/home/z/my-project/scripts/catalog104_enriched.json';

const cat = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const jobs = [];
cat.categories.forEach((c, ci) => {
  c.services.forEach((s, si) => {
    jobs.push({ ci, si, cat: c.name, name: s.name, unit: s.unit, rate: s.alo_rate, estimated: !!s.estimated });
  });
});
console.log('total jobs:', jobs.length);

const BATCH = 12;
const batches = [];
for (let i = 0; i < jobs.length; i += BATCH) batches.push(jobs.slice(i, i + BATCH));

function fallback(j) {
  return {
    key: `c${j.ci}-${j.si}`,
    nameEn: j.name,
    descFa: `خدمت «${j.name}» در دستهٔ «${j.cat}» توسط همکاران تأییدشدهٔ ألو شتاب ارائه می‌شود (${j.unit}). نرخ پایه بر پایهٔ آخرین استعلام بازار تنظیم شده است و در پیش‌فاکتور ریز محاسبه نمایش داده می‌شود.`,
    descEn: `"${j.name}" in the "${j.cat}" category is delivered by verified Alo Shetab partners (${j.unit}). The base rate follows the latest market survey and is itemized in the proforma.`,
  };
}

async function runBatch(zai, batch, attempt = 1) {
  const items = batch.map((j) => ({ id: `c${j.ci}-${j.si}`, name: j.name, cat: j.cat, unit: j.unit }));
  const prompt = `برای هر خدمت زیر سه فیلد بساز و فقط JSON برگردان (آرایه، بدون هیچ متن دیگر):
[{"id":"...","nameEn":"...","descFa":"...","descEn":"..."}]
- nameEn: معادل انگلیسی کوتاه و حرفه‌ای نام خدمت
- descFa: توضیح فارسی یک تا دو جمله‌ای (حداکثر ۳۵ کلمه) دربارهٔ محدودهٔ خدمت برای نمایش در دکمهٔ راهنما
- descEn: معادل انگلیسی توضیح
خدمات:\n${JSON.stringify(items, null, 0)}`;
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'تو مترجم و کارشناس محتوا هستی. فقط JSON معتبر برگردان.' },
        { role: 'user', content: prompt },
      ],
    }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 90000)),
  ]);
  const text = completion.choices[0]?.message?.content ?? '';
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('no json');
  return JSON.parse(m[0]);
}

const zai = await ZAI.create();
const out = {};
let ok = 0, fb = 0;
for (let b = 0; b < batches.length; b++) {
  const batch = batches[b];
  let got = null;
  try { got = await runBatch(zai, batch); }
  catch (e) {
    console.log(`batch ${b} attempt1 failed: ${e.message}`);
    try { got = await runBatch(zai, batch); } catch (e2) { console.log(`batch ${b} attempt2 failed: ${e2.message}`); }
  }
  if (got && Array.isArray(got)) {
    for (const g of got) {
      const j = batch.find((x) => `c${x.ci}-${x.si}` === g.id);
      if (j && g.nameEn && g.descFa && g.descEn) {
        out[g.id] = { key: g.id, nameEn: String(g.nameEn).slice(0, 90), descFa: String(g.descFa).slice(0, 320), descEn: String(g.descEn).slice(0, 320) };
        ok++;
      } else if (j) { out[fallback(j).key] = fallback(j); fb++; }
    }
  } else {
    for (const j of batch) { const f = fallback(j); out[f.key] = f; fb++; }
  }
  console.log(`batch ${b + 1}/${batches.length} done (ok=${ok}, fallback=${fb})`);
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf-8');
console.log('WROTE', OUT, 'items:', Object.keys(out).length, 'ok:', ok, 'fallback:', fb);
