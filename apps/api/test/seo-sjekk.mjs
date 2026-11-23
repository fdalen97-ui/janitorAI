// SEO-vakt for de offentlige sidene (kjøres av e2e-headere.sh mot en kjørende server):
//   node test/seo-sjekk.mjs http://127.0.0.1:PORT
// Sjekker det en søkemotor og en delingsforhåndsvisning faktisk leser: tittel- og
// beskrivelseslengde, én h1, ingen hopp i overskriftsnivå, absolutt canonical og
// og:url, komplette og:-tagger, gyldig JSON-LD uten rot-relative URL-er, og alt-tekst
// på alle bilder. Skriver «seo ok» eller én linje per brudd.
const base = process.argv[2];
const sider = ['/om', '/demo', '/eksempelrapport', '/faq', '/personvern', '/vilkar', '/kontakt', '/kundereisen'];
const feil = [];
const meta = (html, re) => (html.match(re) || [])[1];

for (const sti of sider) {
  const html = await (await fetch(base + sti)).text();
  const brudd = (tekst) => feil.push(`${sti}: ${tekst}`);

  const tittel = meta(html, /<title>([^<]*)<\/title>/) || '';
  if (tittel.length < 15 || tittel.length > 60) brudd(`tittel er ${tittel.length} tegn (15–60)`);
  const beskrivelse = meta(html, /<meta name="description" content="([^"]*)"/) || '';
  if (beskrivelse.length < 70 || beskrivelse.length > 155) brudd(`beskrivelse er ${beskrivelse.length} tegn (70–155)`);

  const nivaer = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  if (nivaer.filter((n) => n === 1).length !== 1) brudd(`${nivaer.filter((n) => n === 1).length} h1 (skal være én)`);
  nivaer.forEach((n, i) => { if (i && n > nivaer[i - 1] + 1) brudd(`overskriftshopp h${nivaer[i - 1]} → h${n}`); });

  const canonical = meta(html, /<link rel="canonical" href="([^"]*)"/) || '';
  if (!/^https?:\/\/[^/]+\//.test(canonical) || !canonical.endsWith(sti)) brudd(`canonical «${canonical}»`);
  for (const egenskap of ['og:title', 'og:description', 'og:type', 'og:locale', 'og:site_name', 'og:image:width', 'og:image:height', 'og:image:alt']) {
    if (!html.includes(`<meta property="${egenskap}" content="`)) brudd(`mangler ${egenskap}`);
  }
  for (const egenskap of ['og:image', 'og:url']) {
    const verdi = meta(html, new RegExp(`<meta property="${egenskap}" content="([^"]*)"`)) || '';
    if (!/^https?:\/\//.test(verdi)) brudd(`${egenskap} er ikke absolutt («${verdi}»)`);
  }
  if (!html.includes('<meta name="twitter:card" content="summary_large_image"')) brudd('mangler twitter:card');

  const blokker = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blokker.length) brudd('ingen JSON-LD');
  for (const blokk of blokker) {
    try {
      const data = JSON.parse(blokk);
      if (data['@context'] !== 'https://schema.org' || !data['@type']) brudd('JSON-LD uten @context/@type');
    } catch (e) { brudd(`ugyldig JSON-LD: ${e.message}`); }
    if (/"(?:url|item|logo)":\s*"\//.test(blokk)) brudd('rot-relativ URL i JSON-LD');
  }

  for (const [bilde] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="[^"]+"/.test(bilde) && !/\salt=""[^>]*aria-hidden="true"|aria-hidden="true"[^>]*\salt=""/.test(bilde)) brudd(`bilde uten alt: ${bilde.slice(0, 60)}`);
  }
}

if (feil.length) { console.log(feil.join('\n')); process.exit(1); }
console.log('seo ok');
