// Debug: TGJU slug extraction + inventory patch action
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120';
const SLUGS = ['price_dollar', 'price_eur', 'seke', 'seke_gerami', 'geram18'];

async function main() {
  // 1) TGJU
  const res = await fetch('https://www.tgju.org/', { headers: { 'User-Agent': UA, 'Accept-Language': 'fa-IR,fa;q=0.9' } });
  const body = await res.text();
  console.log('status', res.status, 'len', body.length);
  for (const slug of SLUGS) {
    const re = new RegExp(`data-market-nameslug="${slug}"[^>]*data-price="([0-9,]+)"`);
    const m = body.match(re);
    console.log('regex slug', slug, '->', m ? m[1] : 'NO MATCH');
    // split-based extraction (robust against ">" inside quoted attributes)
    let splitVal = null;
    for (const chunk of body.split('<tr')) {
      if (chunk.includes(`data-market-nameslug="${slug}"`)) {
        const p = chunk.match(/data-price="([0-9,]+)"/);
        if (p) splitVal = p[1];
      }
    }
    console.log('split slug', slug, '->', splitVal ?? 'NO MATCH');
    if (splitVal == null && m == null) {
      let i = body.indexOf(slug);
      if (i > 0) console.log('   context:', body.slice(Math.max(0, i - 150), i + 200).replace(/\s+/g, ' ').slice(0, 340));
      else console.log('   slug string not present at all');
    }
  }
  // 2) dump all slugs on homepage
  const rows = new Map();
  for (const chunk of body.split('<tr')) {
    const s = chunk.match(/data-market-nameslug="([^"]+)"/);
    const p = chunk.match(/data-price="([0-9,]+)"/);
    if (s && p) rows.set(s[1], p[1]);
  }
  console.log('total rows:', rows.size);
  for (const [k, v] of rows) {
    if (/dollar|seke|coin|geram|gold|ons/i.test(k)) console.log('  ', k, '=', v);
  }
}
main().catch((e) => console.error('ERR', e.message));
