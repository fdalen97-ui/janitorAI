/* Generator for RF Studio presentations (15 min + 30 min) for PFT Eiendom.
   Run: node gen.js <outdir>
*/
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fi = require("react-icons/fi");
const path = require("path");
const fs = require("fs");

const OUT = process.argv[2] || ".";

// ---------- Palette (politi-mørkeblå + rav-aksent) ----------
const NAVY = "14283C";
const STEEL = "3F6E93";
const PALE = "EAF0F5";
const PANEL = "F4F7FA";
const ACCENT = "E0A526";
const INK = "1F2933";
const MUTED = "66737F";
const WHITE = "FFFFFF";
const LINE = "D3DCE4";

const HEAD = "Cambria";
const BODY = "Calibri";

const W = 13.333;
const H = 7.5;
const MX = 0.7; // margin x

// ---------- Icons ----------
const iconCache = new Map();
async function icon(name, color) {
  const key = name + color;
  if (iconCache.has(key)) return iconCache.get(key);
  const Comp = Fi[name];
  if (!Comp) throw new Error("Unknown icon " + name);
  let svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { size: 256, strokeWidth: 1.75 })
  );
  svg = svg.replace(/currentColor/g, "#" + color);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const data = "image/png;base64," + buf.toString("base64");
  iconCache.set(key, data);
  return data;
}

async function iconCircle(slide, { x, y, d = 0.7, name, circle = NAVY, color = WHITE }) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: circle }, line: { color: circle } });
  const pad = d * 0.25;
  slide.addImage({ data: await icon(name, color), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
}

// ---------- Text helpers ----------
function T(slide, text, o) {
  slide.addText(text, Object.assign({ isTextBox: true, fontFace: BODY, color: INK, margin: 0 }, o));
}

function title(slide, text, { section, n, total, dark = false } = {}) {
  T(slide, text, {
    x: MX, y: 0.5, w: W - 2 * MX - 2.6, h: 0.9,
    fontFace: HEAD, fontSize: 32, bold: true, color: dark ? WHITE : NAVY, valign: "middle",
  });
  if (section) {
    T(slide, section.toUpperCase(), {
      x: W - MX - 2.6, y: 0.62, w: 2.6, h: 0.4, fontSize: 10, bold: true, charSpacing: 2,
      color: dark ? ACCENT : STEEL, align: "right", valign: "middle",
    });
  }
  footer(slide, n, total, dark);
}

function footer(slide, n, total, dark = false) {
  T(slide, "RF Studio  ·  PFT Eiendom", {
    x: MX, y: H - 0.5, w: 5, h: 0.3, fontSize: 9, color: dark ? "8FA3B5" : MUTED, valign: "middle",
  });
  if (n) {
    T(slide, `${n} / ${total}`, {
      x: W - MX - 1.2, y: H - 0.5, w: 1.2, h: 0.3, fontSize: 9, color: dark ? "8FA3B5" : MUTED,
      align: "right", valign: "middle",
    });
  }
}

// Marked fill-in text (must be verified/replaced by RF Studio before use)
function fill(text) {
  return { text: "[" + text + "]", options: { color: STEEL, italic: true } };
}

function bullets(slide, items, o) {
  const arr = items.map((it, i) => {
    const isLast = i === items.length - 1;
    if (typeof it === "string") {
      return { text: it, options: { bullet: { indent: 14 }, breakLine: !isLast, paraSpaceAfter: 8 } };
    }
    return { text: it.text, options: Object.assign({ bullet: { indent: 14 }, breakLine: !isLast, paraSpaceAfter: 8 }, it.options || {}) };
  });
  slide.addText(arr, Object.assign({ isTextBox: true, fontFace: BODY, fontSize: 15, color: INK, margin: 0, valign: "top" }, o));
}

function card(slide, { x, y, w, h, fillColor = PANEL, shadow = false }) {
  const o = { x, y, w, h, fill: { color: fillColor }, line: { color: fillColor }, rectRadius: 0.12 };
  if (shadow) o.shadow = { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.12 };
  slide.addShape("roundRect", o);
}

// Three or four cards with icon + heading + body
async function cardRow(slide, items, { x = MX, y = 1.7, w = W - 2 * MX, h = 3.2, gap = 0.3, fillColor = PANEL, iconCircleColor = NAVY, iconColor = WHITE, headSize = 17, bodySize = 13.5 } = {}) {
  const n = items.length;
  const cw = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const cx = x + i * (cw + gap);
    card(slide, { x: cx, y, w: cw, h, fillColor });
    await iconCircle(slide, { x: cx + 0.3, y: y + 0.3, d: 0.7, name: items[i].icon, circle: iconCircleColor, color: iconColor });
    T(slide, items[i].head, { x: cx + 0.3, y: y + 1.15, w: cw - 0.6, h: 0.55, fontFace: HEAD, fontSize: headSize, bold: true, color: NAVY, valign: "top" });
    const body = Array.isArray(items[i].body) ? items[i].body : [{ text: items[i].body }];
    slide.addText(body.map((b) => (typeof b === "string" ? { text: b } : b)), {
      isTextBox: true, x: cx + 0.3, y: y + 1.75, w: cw - 0.6, h: h - 2.0, fontFace: BODY, fontSize: bodySize, color: INK, margin: 0, valign: "top",
    });
  }
}

function numberBadge(slide, n, { x, y, d = 0.5, bg = ACCENT, fg = NAVY }) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg } });
  T(slide, String(n), { x, y, w: d, h: d, fontFace: HEAD, fontSize: 14, bold: true, color: fg, align: "center", valign: "middle" });
}

// ---------- Slide builders (shared between the two decks) ----------

function sTitle(pres, { subtitle, duration }) {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  // Motif: large soft circle
  s.addShape("ellipse", { x: 8.6, y: -1.6, w: 6.5, h: 6.5, fill: { color: "1D3750" }, line: { color: "1D3750" } });
  s.addShape("ellipse", { x: 10.4, y: 0.6, w: 3.2, h: 3.2, fill: { color: STEEL }, line: { color: STEEL }, transparency: 40 });
  T(s, "PFT EIENDOM  ·  UTVIKLINGSARBEID", { x: MX, y: 1.6, w: 8, h: 0.4, fontSize: 12, bold: true, charSpacing: 3, color: ACCENT });
  T(s, "RF Studio", { x: MX, y: 2.1, w: 9, h: 1.4, fontFace: HEAD, fontSize: 66, bold: true, color: WHITE, valign: "middle" });
  T(s, subtitle, { x: MX, y: 3.55, w: 8.5, h: 0.9, fontSize: 22, color: "DCE6EF", valign: "top" });
  T(s, `For eiendomsansvarlige  ·  ${duration}`, { x: MX, y: 4.7, w: 8, h: 0.4, fontSize: 14, color: "AFC1D0" });
  s.addText([fill("Dato"), { text: "   ·   ", options: { color: "AFC1D0" } }, fill("Navn på presentatør, RF Studio")], {
    isTextBox: true, x: MX, y: 5.1, w: 8, h: 0.4, fontFace: BODY, fontSize: 14, color: "AFC1D0", margin: 0,
  });
  footer(s, null, null, true);
  s.addNotes(
    `ÅPNING (30 sek). Si hvem du er og hvorfor du står her: eiendomsansvarlige har bedt om innblikk i utviklingsarbeidet i PFT. ` +
    `Lov publikum én ting: «Om ${duration} vet du hva RF Studio er, hva det betyr for ditt bygg, og hvordan du får sagt din mening.»\n\n` +
    `Pedagogisk grep: Start med et løfte, ikke med organisasjonskart. Det setter forventning (Gagnés hendelse 1–2: fang oppmerksomhet, opplys om målet).`
  );
  return s;
}

async function sGoals(pres, { n, total, agenda, minutes }) {
  const s = pres.addSlide();
  title(s, `Etter ${minutes} minutter kan du …`, { section: "Mål og plan", n, total });
  const goals = [
    { icon: "FiMessageCircle", text: "forklare hva RF Studio er – med én setning" },
    { icon: "FiHome", text: "peke på hva utviklingsarbeidet betyr for dine bygg og din hverdag" },
    { icon: "FiSend", text: "vite hvordan du melder inn behov og bidrar" },
  ];
  let y = 1.75;
  for (const g of goals) {
    await iconCircle(s, { x: MX, y, d: 0.62, name: g.icon, circle: PALE, color: NAVY });
    T(s, g.text, { x: MX + 0.85, y, w: 5.6, h: 0.62, fontSize: 17, valign: "middle" });
    y += 1.05;
  }
  T(s, "Læringsmålene er lovnaden vår – vi sjekker dem på slutten.", { x: MX, y: 5.0, w: 6.2, h: 0.6, fontSize: 12, italic: true, color: MUTED });

  // Agenda panel
  const ax = 7.6, ay = 1.55, aw = W - MX - ax, ah = 4.6;
  card(s, { x: ax, y: ay, w: aw, h: ah, fillColor: PANEL });
  T(s, "PLAN", { x: ax + 0.35, y: ay + 0.25, w: 3, h: 0.3, fontSize: 10, bold: true, charSpacing: 2, color: STEEL });
  let yy = ay + 0.7;
  const rowH = (ah - 0.9) / agenda.length;
  agenda.forEach((a, i) => {
    numberBadge(s, i + 1, { x: ax + 0.35, y: yy + (rowH - 0.42) / 2, d: 0.42 });
    T(s, a[0], { x: ax + 0.95, y: yy, w: aw - 2.4, h: rowH, fontSize: 15, valign: "middle" });
    T(s, a[1], { x: ax + aw - 1.45, y: yy, w: 1.1, h: rowH, fontSize: 13, color: MUTED, align: "right", valign: "middle" });
    yy += rowH;
  });
  s.addNotes(
    `MÅL OG PLAN (1 min). Les de tre målene høyt. Si at planen til høyre er «skiltingen» – publikum skal alltid vite hvor vi er.\n\n` +
    `Pedagogisk grep: Eksplisitte læringsmål + tidsatt agenda (signposting) reduserer kognitiv belastning: tilhørerne slipper å lure på «hvor lenge varer dette» og kan bruke oppmerksomheten på innholdet.`
  );
  return s;
}

async function sHook(pres, { n, total }) {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  title(s, "Politiets lokaler i tall", { section: "Hvorfor", n, total, dark: true });
  const stats = [
    ["780 000", "m² i porteføljen"],
    ["350", "lokasjoner over hele landet"],
    ["1", "samfunnsoppdrag som lokalene skal støtte"],
  ];
  const cw = (W - 2 * MX - 0.6) / 3;
  stats.forEach((st, i) => {
    const x = MX + i * (cw + 0.3);
    T(s, st[0], { x, y: 1.9, w: cw, h: 1.3, fontFace: HEAD, fontSize: 60, bold: true, color: ACCENT, valign: "bottom" });
    T(s, st[1], { x, y: 3.25, w: cw - 0.3, h: 0.7, fontSize: 16, color: "DCE6EF", valign: "top" });
  });
  card(s, { x: MX, y: 4.55, w: W - 2 * MX, h: 1.5, fillColor: "1D3750" });
  T(s, "Spørsmål til salen:", { x: MX + 0.4, y: 4.75, w: 4, h: 0.4, fontSize: 12, bold: true, charSpacing: 1, color: ACCENT });
  T(s, "Hvor ofte løser du et problem lokalt som du mistenker at noen andre allerede har løst et annet sted?", {
    x: MX + 0.4, y: 5.15, w: W - 2 * MX - 0.8, h: 0.7, fontFace: HEAD, fontSize: 20, color: WHITE, valign: "top",
  });
  T(s, "Kilde: PFT Eiendom (eiendomsyrker.no). Verifiser tallene før bruk.", { x: MX, y: 6.35, w: 8, h: 0.3, fontSize: 9, color: "8FA3B5" });
  s.addNotes(
    `HVORFOR – KROKEN (2 min). La tallene stå et øyeblikk. Still spørsmålet og be om håndsopprekning: «Hvem har opplevd dette den siste måneden?» Vent i 5 sekunder – stillhet er lov.\n\n` +
    `Poeng: Med 350 lokasjoner er det ikke mulig å lære av hverandre uten en felles arena. Det er hullet RF Studio skal fylle.\n\n` +
    `Pedagogisk grep: Aktiver forkunnskap (Gagnés hendelse 3) – publikum kobler det nye til egen erfaring før vi forklarer løsningen. Tall > adjektiver.`
  );
  return s;
}

function sThinkPair(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Tenk – par – del", { section: "Aktivitet · 3 min", n, total });
  card(s, { x: MX, y: 1.6, w: W - 2 * MX, h: 1.6, fillColor: PALE });
  T(s, "Hva er det mest tidkrevende du løser lokalt i dag – som burde vært løst én gang for alle?", {
    x: MX + 0.4, y: 1.8, w: W - 2 * MX - 0.8, h: 1.2, fontFace: HEAD, fontSize: 24, color: NAVY, valign: "middle",
  });
  const steps = [
    ["1 min", "Tenk", "Skriv ett eksempel på en lapp eller i notatene dine."],
    ["1 min", "Par", "Fortell sidemannen. Er problemet det samme hos dere?"],
    ["1 min", "Del", "To–tre eksempler høyt i rommet. Vi noterer alle."],
  ];
  const cw = (W - 2 * MX - 0.6) / 3;
  steps.forEach((st, i) => {
    const x = MX + i * (cw + 0.3);
    card(s, { x, y: 3.55, w: cw, h: 2.5, fillColor: PANEL });
    T(s, st[0], { x: x + 0.3, y: 3.75, w: 2, h: 0.3, fontSize: 11, bold: true, charSpacing: 1, color: STEEL });
    T(s, st[1], { x: x + 0.3, y: 4.1, w: cw - 0.6, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: NAVY });
    T(s, st[2], { x: x + 0.3, y: 4.7, w: cw - 0.6, h: 1.2, fontSize: 14, valign: "top" });
  });
  s.addNotes(
    `AKTIVITET (3 min). Hold tiden strengt – si «ett minutt» høyt. Skriv eksemplene som kommer på tavle/flipover; de blir råstoff for slutten («Hvilket behov ville du meldt inn i dag?»).\n\n` +
    `Pedagogisk grep: Tenk–par–del gir alle en stemme (ikke bare de høylytte) og skaper eierskap før vi presenterer RF Studio. Innholdet vårt lander bedre når det svarer på et problem de selv nettopp har satt ord på.`
  );
  return s;
}

async function sWhy(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Tre utfordringer vi vil løse sammen", { section: "Hvorfor", n, total });
  await cardRow(s, [
    { icon: "FiGrid", head: "Ulik praksis fra sted til sted", body: "Samme behov løses på 350 ulike måter. Det koster tid, og kvaliteten varierer." },
    { icon: "FiLayers", head: "Løsninger blir i siloer", body: "Gode grep i ett distrikt når sjelden ut til de andre. Læringen forsvinner med prosjektet." },
    { icon: "FiTrendingUp", head: "Behov endrer seg raskere enn bygg", body: "Nye arbeidsformer, sikkerhetskrav og teknologi krever at vi kan prøve ut ting – uten å bygge om alt." },
  ], { y: 1.7, h: 3.4 });
  s.addText([
    { text: "Verifiser: ", options: { bold: true, color: STEEL } },
    { text: "bytt ut med utfordringene RF Studio faktisk er satt til å jobbe med, gjerne med ett konkret eksempel per punkt.", options: { color: MUTED } },
  ], { isTextBox: true, x: MX, y: 5.45, w: W - 2 * MX, h: 0.5, fontFace: BODY, fontSize: 11, italic: true, margin: 0 });
  s.addNotes(
    `UTFORDRINGENE (2 min). Én setning per kort – ikke les. Koble til det publikum sa i sted: «Dere nevnte X – det er et typisk eksempel på punkt 2.»\n\n` +
    `Pedagogisk grep: Problem før løsning. Hjernen husker svar bedre når den først har kjent på spørsmålet. Tre punkter – ikke fem – fordi arbeidsminnet er begrenset (chunking).`
  );
  return s;
}

async function sWhat(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Hva er RF Studio?", { section: "Hva", n, total });
  card(s, { x: MX, y: 1.5, w: W - 2 * MX, h: 1.35, fillColor: NAVY });
  s.addText([
    { text: "RF Studio er PFT Eiendoms utviklingsmiljø for politiets lokaler: der ideer og behov testes i liten skala før de blir felles løsninger for hele porteføljen.", options: { color: WHITE } },
  ], { isTextBox: true, x: MX + 0.4, y: 1.6, w: W - 2 * MX - 0.8, h: 1.15, fontFace: HEAD, fontSize: 20, margin: 0, valign: "middle" });
  s.addText([
    { text: "RF står for ", options: { color: MUTED } }, fill("fyll inn"),
    { text: "   ·   Etablert ", options: { color: MUTED } }, fill("år"),
    { text: "   ·   Del av ", options: { color: MUTED } }, fill("seksjon/avdeling"),
  ], { isTextBox: true, x: MX, y: 2.95, w: W - 2 * MX, h: 0.4, fontFace: BODY, fontSize: 12, margin: 0 });
  await cardRow(s, [
    { icon: "FiSearch", head: "Utforske", body: "Samle behov og ideer fra eiendomsansvarlige, brukere og drift. Forstå problemet først." },
    { icon: "FiTool", head: "Utvikle", body: "Lage prototyper og pilotløsninger som kan prøves i ekte lokaler – raskt og rimelig." },
    { icon: "FiShare2", head: "Dele", body: "Gjøre det som virker til felles standarder, veiledere og verktøy for alle 350 lokasjoner." },
  ], { y: 3.5, h: 2.85, headSize: 16, bodySize: 12.5 });
  s.addNotes(
    `HVA ER RF STUDIO (2 min). Les definisjonen høyt én gang – dette er setningen publikum skal kunne gjengi (læringsmål 1). Så de tre verbene: utforske, utvikle, dele.\n\n` +
    `FYLL INN før bruk: hva RF står for, etableringsår, organisatorisk plassering. Juster definisjonen så den stemmer med RF Studios eget mandat.\n\n` +
    `Pedagogisk grep: Én definisjon + tre verb. Verb er lettere å huske enn substantiv, og de svarer på «hva gjør dere egentlig?».`
  );
  return s;
}

async function sTeam(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Hvem er vi – og hvor passer du inn?", { section: "Hva", n, total });
  // Ecosystem diagram: center RF Studio, four satellites with labels beneath
  const cx = 3.5, cy = 3.9;
  const nodes = [
    { name: "FiUsers", label: "Eiendomsansvarlige", x: 1.0, y: 1.75 },
    { name: "FiBriefcase", label: "PFT Eiendom-ledelse", x: 5.0, y: 1.75 },
    { name: "FiTruck", label: "Leverandører og rådgivere", x: 1.0, y: 4.85 },
    { name: "FiShield", label: "Politidistrikt og særorgan", x: 5.0, y: 4.85 },
  ];
  for (const nd of nodes) {
    const x1 = nd.x + 0.5, y1 = nd.y + 0.5;
    s.addShape("line", { x: Math.min(x1, cx), y: Math.min(y1, cy), w: Math.abs(cx - x1), h: Math.abs(cy - y1), line: { color: LINE, width: 1.5 }, flipH: (x1 > cx) !== (y1 > cy) });
  }
  s.addShape("ellipse", { x: cx - 1.0, y: cy - 1.0, w: 2.0, h: 2.0, fill: { color: NAVY }, line: { color: NAVY } });
  T(s, "RF Studio", { x: cx - 1.0, y: cy - 1.0, w: 2.0, h: 2.0, fontFace: HEAD, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle" });
  for (const nd of nodes) {
    await iconCircle(s, { x: nd.x, y: nd.y, d: 1.0, name: nd.name, circle: PALE, color: NAVY });
    T(s, nd.label, { x: nd.x + 0.5 - 1.2, y: nd.y + 1.05, w: 2.4, h: 0.5, fontSize: 12, bold: true, color: NAVY, align: "center", valign: "top" });
  }
  // Right panel: team
  const px = 8.3, pw = W - MX - px;
  card(s, { x: px, y: 1.55, w: pw, h: 4.7, fillColor: PANEL });
  T(s, "TEAMET", { x: px + 0.35, y: 1.8, w: 3, h: 0.3, fontSize: 10, bold: true, charSpacing: 2, color: STEEL });
  s.addText([
    fill("Navn – rolle"), { text: "", options: { breakLine: true } },
    fill("Navn – rolle"), { text: "", options: { breakLine: true } },
    fill("Navn – rolle"), { text: "", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "Din rolle: ", options: { bold: true, color: NAVY } },
    { text: "du kjenner byggene, brukerne og hverdagen. Uten det vet vi ikke hvilke problemer som er verdt å løse." },
  ], { isTextBox: true, x: px + 0.35, y: 2.2, w: pw - 0.7, h: 3.8, fontFace: BODY, fontSize: 14, color: INK, margin: 0, valign: "top", paraSpaceAfter: 6 });
  s.addNotes(
    `HVEM (1,5 min). Pek på figuren: RF Studio står i midten, men eiendomsansvarlige er den viktigste kilden til behov. Si tydelig: «Dere er ikke publikum for dette arbeidet – dere er medspillere.»\n\n` +
    `FYLL INN: navn og roller i teamet. Bytt gjerne ut satellittene hvis RF Studio har andre hovedpartnere.\n\n` +
    `Pedagogisk grep: Plasser tilhøreren i bildet (relevans – ARCS-modellen). Folk husker det de er en del av.`
  );
  return s;
}

async function sFocus(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Det vi jobber med nå", { section: "Hva", n, total });
  await cardRow(s, [
    { icon: "FiLayout", head: fill("Fokusområde 1").text, body: [
      { text: "Eksempel: standardiserte romløsninger for politispesifikke arealer.", options: { color: MUTED, italic: true, breakLine: true } },
      { text: " ", options: { breakLine: true } },
      { text: "Status: ", options: { bold: true } }, fill("pilot / utrulling / idé"),
    ] },
    { icon: "FiSmartphone", head: fill("Fokusområde 2").text, body: [
      { text: "Eksempel: digitale verktøy for drift, avvik og tilstand.", options: { color: MUTED, italic: true, breakLine: true } },
      { text: " ", options: { breakLine: true } },
      { text: "Status: ", options: { bold: true } }, fill("pilot / utrulling / idé"),
    ] },
    { icon: "FiLock", head: fill("Fokusområde 3").text, body: [
      { text: "Eksempel: sikkerhet og funksjonalitet i nye og ombygde lokaler.", options: { color: MUTED, italic: true, breakLine: true } },
      { text: " ", options: { breakLine: true } },
      { text: "Status: ", options: { bold: true } }, fill("pilot / utrulling / idé"),
    ] },
  ], { y: 1.7, h: 3.5, headSize: 17, bodySize: 13.5 });
  T(s, "Én setning per område: hvilket problem, for hvem, og hvor langt er vi kommet.", { x: MX, y: 5.5, w: W - 2 * MX, h: 0.4, fontSize: 12, italic: true, color: MUTED });
  s.addNotes(
    `FOKUSOMRÅDER (2 min). Maks tre. For hvert: problem → for hvem → status. Ikke gå i detalj her – eksemplene kommer senere.\n\n` +
    `FYLL INN: RF Studios faktiske fokusområder og status. Eksemplene i grått er forslag og skal byttes ut.\n\n` +
    `Pedagogisk grep: Samme mønster på alle tre kortene (problem/for hvem/status) gjør det lett å sammenligne og huske – forutsigbar struktur frigjør oppmerksomhet.`
  );
  return s;
}

async function sProcess(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Fra behov til felles løsning", { section: "Hvordan", n, total });
  const steps = [
    { icon: "FiInbox", head: "Behov", body: "Eiendomsansvarlige og brukere melder inn. Vi sorterer etter hvor mange det gjelder." },
    { icon: "FiEdit3", head: "Prototype", body: "En enkel første versjon – skisse, mock-up eller testrom. Billig å endre." },
    { icon: "FiMapPin", head: "Test i ekte lokaler", body: "Pilot på 1–3 lokasjoner sammen med dem som skal bruke det. Vi måler og justerer." },
    { icon: "FiGlobe", head: "Skalering", body: "Det som virker blir standard, veileder eller verktøy for hele porteføljen." },
  ];
  const n4 = steps.length, gap = 0.45;
  const cw = (W - 2 * MX - gap * (n4 - 1)) / n4;
  for (let i = 0; i < n4; i++) {
    const x = MX + i * (cw + gap);
    card(s, { x, y: 1.9, w: cw, h: 3.3, fillColor: i === 2 ? PALE : PANEL });
    numberBadge(s, i + 1, { x: x + 0.3, y: 2.15, d: 0.42 });
    await iconCircle(s, { x: x + cw - 1.0, y: 2.1, d: 0.7, name: steps[i].icon, circle: NAVY, color: WHITE });
    T(s, steps[i].head, { x: x + 0.3, y: 3.0, w: cw - 0.6, h: 0.5, fontFace: HEAD, fontSize: 18, bold: true, color: NAVY });
    T(s, steps[i].body, { x: x + 0.3, y: 3.55, w: cw - 0.6, h: 1.5, fontSize: 13, valign: "top" });
    if (i < n4 - 1) {
      s.addShape("rightArrow", { x: x + cw + 0.07, y: 3.3, w: 0.32, h: 0.4, fill: { color: ACCENT }, line: { color: ACCENT } });
    }
  }
  // Learning loop
  s.addShape("line", { x: MX + 0.5, y: 5.6, w: W - 2 * MX - 1.0, h: 0, line: { color: STEEL, width: 1.5, dashType: "dash", beginArrowType: "triangle" } });
  T(s, "Læring går tilbake til start: det vi finner i piloten endrer neste behov og neste prototype", { x: MX, y: 5.7, w: W - 2 * MX, h: 0.4, fontSize: 12, italic: true, color: STEEL, align: "center" });
  s.addNotes(
    `PROSESSEN (2–3 min). Gå gjennom stegene med et ekte eksempel i bakhodet. Understrek steg 3: «Vi tester i ekte lokaler – kanskje i ditt.» Pek på den stiplede pilen: dette er en sløyfe, ikke en linje.\n\n` +
    `Pedagogisk grep: Prosessvisualisering (dual coding – bilde + ord) og nummerering. Fremhevet steg 3 fordi det er der eiendomsansvarlige møter arbeidet i praksis.`
  );
  return s;
}

async function sPrinciples(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Tre prinsipper vi styrer etter", { section: "Hvordan", n, total });
  const items = [
    { icon: "FiZap", head: "Test lite, lær fort", body: "Heller tre små forsøk enn ett stort prosjekt. En feil i en prototype koster en dag – i et bygg koster den år." },
    { icon: "FiUsers", head: "Brukerne avgjør", body: "Ingen løsning skaleres før de som skal bruke den har prøvd den. Eiendomsansvarlige er dommerne." },
    { icon: "FiShare2", head: "Del alt som virker", body: "Resultatet av et forsøk er ikke et bygg – det er en standard alle kan bruke. Læring er leveransen." },
  ];
  let y = 1.7;
  for (const it of items) {
    card(s, { x: MX, y, w: W - 2 * MX, h: 1.25, fillColor: PANEL });
    await iconCircle(s, { x: MX + 0.3, y: y + 0.28, d: 0.7, name: it.icon, circle: NAVY, color: WHITE });
    T(s, it.head, { x: MX + 1.3, y: y + 0.15, w: 4.2, h: 0.95, fontFace: HEAD, fontSize: 20, bold: true, color: NAVY, valign: "middle" });
    T(s, it.body, { x: MX + 5.6, y: y + 0.15, w: W - 2 * MX - 5.9, h: 0.95, fontSize: 14, valign: "middle" });
    y += 1.45;
  }
  s.addNotes(
    `PRINSIPPER (2 min). Dette er «hvorfor vi sier nei til noen ting». Bruk gjerne et eksempel på noe RF Studio har valgt bort fordi det brøt med prinsipp 1 eller 2.\n\n` +
    `FYLL INN/JUSTER: bytt ut med RF Studios egne prinsipper hvis de har formulert dem.\n\n` +
    `Pedagogisk grep: Prinsipper gir publikum en «tenkeregel» de kan bruke selv – det er høyere på Blooms taksonomi (anvende/vurdere) enn å huske fakta.`
  );
  return s;
}

function sCheckpoint(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Sjekkpunkt: sant eller usant?", { section: "Halvveis · 2 min", n, total });
  const qs = [
    "RF Studio bygger ferdige løsninger sentralt og sender dem ut til lokasjonene.",
    "En pilot testes i ekte lokaler før noe blir standard.",
    "Eiendomsansvarlige melder inn behov – RF Studio prioriterer etter hvor mange det gjelder.",
  ];
  let y = 1.7;
  qs.forEach((q, i) => {
    card(s, { x: MX, y, w: W - 2 * MX, h: 1.1, fillColor: i % 2 === 0 ? PANEL : PALE });
    numberBadge(s, i + 1, { x: MX + 0.3, y: y + 0.32, d: 0.46 });
    T(s, q, { x: MX + 1.05, y: y + 0.1, w: W - 2 * MX - 3.2, h: 0.9, fontSize: 17, valign: "middle" });
    T(s, "Sant   /   Usant", { x: W - MX - 2.1, y: y + 0.1, w: 1.9, h: 0.9, fontSize: 13, bold: true, color: STEEL, align: "right", valign: "middle" });
    y += 1.3;
  });
  T(s, "Rekk opp hånden for «sant». Fasit i notatene – og på neste slide i praksis.", { x: MX, y: 5.7, w: W - 2 * MX, h: 0.4, fontSize: 12, italic: true, color: MUTED });
  s.addNotes(
    `SJEKKPUNKT (2 min). Les hver påstand, be om håndsopprekning. Fasit: 1 = USANT (vi tester lokalt først, sammen med dere). 2 = SANT. 3 = SANT. Feil svar er gull: da vet du hva som må sies tydeligere i andre halvdel.\n\n` +
    `Pedagogisk grep: Hentetrening (retrieval practice) midt i økten. Å hente kunnskap fram styrker hukommelsen mer enn å høre den én gang til, og det bryter passiviteten etter 12–15 minutter.`
  );
  return s;
}

function sCase(pres, { n, total, label, section = "Eksempel" }) {
  const s = pres.addSlide();
  title(s, label, { section, n, total });
  const cw = (W - 2 * MX - 0.4) / 2;
  const cols = [
    { head: "FØR", color: PANEL, items: [
      fill("Hva var problemet?"),
      fill("Hvem opplevde det, og hvor ofte?"),
      fill("Hva kostet det i tid, kroner eller kvalitet?"),
    ] },
    { head: "ETTER", color: PALE, items: [
      fill("Hva prøvde vi ut – og hvor?"),
      fill("Hva ble resultatet? Bruk ett tall."),
      fill("Hva er nå tilgjengelig for alle lokasjoner?"),
    ] },
  ];
  cols.forEach((c, i) => {
    const x = MX + i * (cw + 0.4);
    card(s, { x, y: 1.65, w: cw, h: 3.9, fillColor: c.color });
    T(s, c.head, { x: x + 0.35, y: 1.9, w: 3, h: 0.35, fontSize: 11, bold: true, charSpacing: 2, color: STEEL });
    const arr = c.items.map((it, k) => ({ text: it.text, options: Object.assign({ bullet: { indent: 14 }, breakLine: k < c.items.length - 1, paraSpaceAfter: 10 }, it.options) }));
    s.addText(arr, { isTextBox: true, x: x + 0.35, y: 2.35, w: cw - 0.7, h: 3.0, fontFace: BODY, fontSize: 15, margin: 0, valign: "top" });
  });
  s.addShape("rightArrow", { x: MX + cw + 0.04, y: 3.35, w: 0.32, h: 0.5, fill: { color: ACCENT }, line: { color: ACCENT } });
  T(s, "Legg inn ett bilde fra piloten hvis dere har – et bilde av et ekte rom slår all tekst.", { x: MX, y: 5.75, w: W - 2 * MX, h: 0.4, fontSize: 12, italic: true, color: MUTED });
  s.addNotes(
    `EKSEMPEL (2–3 min). Fortell det som en historie: situasjonen, hva dere gjorde, hva som skjedde. Ett tall er nok («fra 6 uker til 2»). Avslutt med hva som nå er tilgjengelig for alle.\n\n` +
    `FYLL INN: et ekte case fra RF Studio. Bruk gjerne et der en eiendomsansvarlig var med – navngi vedkommende (med samtykke).\n\n` +
    `Pedagogisk grep: Konkret eksempel etter abstrakt prosess (konkret–abstrakt-veksling). Før/etter-formatet gjør effekten synlig, og historier huskes bedre enn punktlister.`
  );
  return s;
}

async function sWIIFM(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Hva betyr dette for deg?", { section: "For deg", n, total });
  await cardRow(s, [
    { icon: "FiRefreshCw", head: "Færre hjul å finne opp", body: "Løsninger som er testet et annet sted kommer til deg som ferdig veileder eller standard – ikke som et nytt prosjekt." },
    { icon: "FiInbox", head: "Én kanal for behov", body: "Det du melder inn blir sett i sammenheng med resten av landet. Gjelder det mange, blir det prioritert." },
    { icon: "FiEye", head: "Innsikt før endring", body: "Du får vite hva som testes og hva som kommer – før det treffer dine bygg og brukere." },
  ], { y: 1.7, h: 3.4, iconCircleColor: ACCENT, iconColor: NAVY });
  T(s, "Kort sagt: mindre alenearbeid, mer felles læring.", { x: MX, y: 5.4, w: W - 2 * MX, h: 0.5, fontFace: HEAD, fontSize: 18, color: NAVY });
  s.addNotes(
    `FOR DEG (2 min). Dette er svaret på «hva har jeg igjen for det?» – den viktigste sliden for at budskapet skal bli husket. Snakk direkte: «du», ikke «eiendomsansvarlige».\n\n` +
    `Pedagogisk grep: WIIFM («what's in it for me») – relevans er den sterkeste driveren for motivasjon (ARCS: Relevance). Oransje ikoner markerer skiftet fra «oss» til «deg».`
  );
  return s;
}

function sDiscussion(pres, { n, total }) {
  const s = pres.addSlide();
  title(s, "Hva ville du meldt inn i dag?", { section: "Aktivitet · 4 min", n, total });
  card(s, { x: MX, y: 1.6, w: 7.2, h: 4.5, fillColor: PALE });
  T(s, "I grupper på 3–4:", { x: MX + 0.4, y: 1.85, w: 6, h: 0.4, fontSize: 12, bold: true, charSpacing: 1, color: STEEL });
  bullets(s, [
    "Velg ett behov fra tenk–par–del i sted – eller et nytt.",
    "Formuler det på én linje: «Vi trenger … fordi …».",
    "Hvor mange lokasjoner tror dere det gjelder?",
    "Én person deler høyt. Vi noterer alt.",
  ], { x: MX + 0.4, y: 2.35, w: 6.4, h: 3.5, fontSize: 16 });
  card(s, { x: 8.3, y: 1.6, w: W - MX - 8.3, h: 4.5, fillColor: NAVY });
  T(s, "MAL", { x: 8.65, y: 1.85, w: 3, h: 0.35, fontSize: 11, bold: true, charSpacing: 2, color: ACCENT });
  T(s, "«Vi trenger ______\n\nfordi ______.\n\nDet gjelder ca. ___ lokasjoner.»", { x: 8.65, y: 2.35, w: W - MX - 8.3 - 0.7, h: 3.5, fontFace: HEAD, fontSize: 20, color: WHITE, valign: "top", lineSpacingMultiple: 1.2 });
  s.addNotes(
    `DISKUSJON (4 min). 2,5 min i grupper, 1,5 min deling. Ta imot alle innspill uten å vurdere dem («takk, notert») – vurdering dreper deling. Lov å komme tilbake med hva som skjer med innspillene, og hold det.\n\n` +
    `Pedagogisk grep: Overføring (transfer). Publikum bruker det de nettopp lærte (behov → hvor mange gjelder det) på sin egen situasjon. Det er den sterkeste formen for læring – og gir RF Studio ekte input.`
  );
  return s;
}

async function sContribute(pres, { n, total, withTimeline = true }) {
  const s = pres.addSlide();
  title(s, "Slik kan du bidra", { section: "Veien videre", n, total });
  const items = [
    { icon: "FiSend", head: "Meld inn et behov", body: [fill("kanal: e-post / skjema / Teams-kanal")] },
    { icon: "FiMapPin", head: "Tilby ditt bygg som pilot", body: ["Vi trenger ekte lokaler og ekte brukere. Si fra hvis du vil være tidlig ute."] },
    { icon: "FiBookOpen", head: "Bruk det som finnes", body: [fill("lenke til veiledere / standarder / intranett")] },
  ];
  await cardRow(s, items, { y: 1.6, h: withTimeline ? 2.6 : 3.6, headSize: 16, bodySize: 13 });
  if (withTimeline) {
    // Timeline
    const ty = 5.35;
    s.addShape("line", { x: MX + 0.4, y: ty, w: W - 2 * MX - 0.8, h: 0, line: { color: STEEL, width: 2 } });
    const ms = [fill("Måned: milepæl"), fill("Måned: milepæl"), fill("Måned: milepæl"), fill("Måned: milepæl")];
    const step = (W - 2 * MX - 0.8) / (ms.length - 1);
    ms.forEach((m, i) => {
      const x = MX + 0.4 + i * step;
      s.addShape("ellipse", { x: x - 0.11, y: ty - 0.11, w: 0.22, h: 0.22, fill: { color: ACCENT }, line: { color: ACCENT } });
      s.addText([m], { isTextBox: true, x: x - 1.3, y: ty + 0.25, w: 2.6, h: 0.5, fontFace: BODY, fontSize: 12, align: "center", margin: 0 });
    });
    T(s, "DE NESTE 6 MÅNEDENE", { x: MX, y: 4.55, w: 4, h: 0.3, fontSize: 10, bold: true, charSpacing: 2, color: STEEL });
  }
  s.addNotes(
    `BIDRA (1,5 min). Tre helt konkrete handlinger – si hva som er det første steget for hver. Tidslinjen viser at dette skjer nå, ikke «en gang».\n\n` +
    `FYLL INN: kanal for innmelding, lenke til det som finnes, og fire milepæler.\n\n` +
    `Pedagogisk grep: Handling med lav terskel. En oppfordring uten konkret første steg blir ikke fulgt opp.`
  );
  return s;
}

async function sRemember(pres, { n, total, minutes }) {
  const s = pres.addSlide();
  title(s, "Tre ting å ta med deg", { section: "Oppsummering", n, total });
  const items = [
    { icon: "FiMessageCircle", head: "Hva RF Studio er", body: "PFT Eiendoms utviklingsmiljø: ideer testes i liten skala før de blir felles løsninger." },
    { icon: "FiHome", head: "Hva det betyr for deg", body: "Færre lokale særløsninger, én kanal for behov, og innsikt før endringer treffer dine bygg." },
    { icon: "FiSend", head: "Hva du kan gjøre", body: "Meld inn ett behov denne uken – eller tilby bygget ditt som pilot." },
  ];
  let y = 1.7;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    card(s, { x: MX, y, w: W - 2 * MX, h: 1.2, fillColor: i === 2 ? PALE : PANEL });
    numberBadge(s, i + 1, { x: MX + 0.3, y: y + 0.37, d: 0.46 });
    await iconCircle(s, { x: MX + 1.0, y: y + 0.25, d: 0.7, name: it.icon, circle: NAVY, color: WHITE });
    T(s, it.head, { x: MX + 2.0, y: y + 0.15, w: 3.6, h: 0.9, fontFace: HEAD, fontSize: 19, bold: true, color: NAVY, valign: "middle" });
    T(s, it.body, { x: MX + 5.8, y: y + 0.15, w: W - 2 * MX - 6.1, h: 0.9, fontSize: 14, valign: "middle" });
    y += 1.4;
  }
  T(s, `Dette var løftet fra starten – sjekk selv: kan du forklare RF Studio med én setning?`, { x: MX, y: 5.95, w: W - 2 * MX, h: 0.4, fontSize: 12, italic: true, color: MUTED });
  s.addNotes(
    `OPPSUMMERING (1 min). Speil læringsmålene fra slide 2 – én til én. Spør: «Kan sidemannen din forklare RF Studio med én setning? Prøv.» (20 sekunder). Så: «Da har vi holdt løftet.»\n\n` +
    `Pedagogisk grep: Repetisjon i ny form + lukking av sløyfen mål → sjekk (Gagnés hendelse 8–9: vurder og styrk overføring). Tre punkter som speiler de tre målene gir en tydelig «ferdig»-følelse.`
  );
  return s;
}

function sClose(pres, { n, total }) {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape("ellipse", { x: 8.6, y: 3.2, w: 6.5, h: 6.5, fill: { color: "1D3750" }, line: { color: "1D3750" } });
  T(s, "Spørsmål?", { x: MX, y: 1.5, w: 8, h: 1.3, fontFace: HEAD, fontSize: 54, bold: true, color: WHITE, valign: "middle" });
  T(s, "Det dere lurer på nå, er det neste eiendomsansvarlig også lurer på. Ingen spørsmål er for små.", { x: MX, y: 2.85, w: 7.5, h: 0.9, fontSize: 18, color: "DCE6EF" });
  card(s, { x: MX, y: 4.2, w: 7.5, h: 1.9, fillColor: "1D3750" });
  T(s, "KONTAKT", { x: MX + 0.4, y: 4.4, w: 3, h: 0.3, fontSize: 10, bold: true, charSpacing: 2, color: ACCENT });
  s.addText([
    fill("Navn, RF Studio"), { text: "", options: { breakLine: true } },
    fill("e-post"), { text: "   ·   ", options: { color: "AFC1D0" } }, fill("telefon"), { text: "", options: { breakLine: true } },
    fill("Lenke til mer informasjon / intranett"),
  ], { isTextBox: true, x: MX + 0.4, y: 4.75, w: 6.7, h: 1.2, fontFace: BODY, fontSize: 15, color: WHITE, margin: 0, paraSpaceAfter: 4 });
  footer(s, n, total, true);
  s.addNotes(
    `AVSLUTNING. Ta spørsmål. Hvis det blir stille: still ett selv («Det jeg oftest får spørsmål om er …»). Avslutt med å gjenta det ene konkrete steget: meld inn ett behov denne uken.\n\n` +
    `FYLL INN: kontaktinformasjon og lenke. Send slidene til deltakerne etterpå – oppsummeringsslidene fungerer som huskelapp.`
  );
  return s;
}

// ---------- Deck assembly ----------
async function build15() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "RF Studio · PFT Eiendom";
  pres.title = "RF Studio – 15 minutter for eiendomsansvarlige";
  pres.lang = "nb-NO";
  const total = 11;
  let n = 0;
  sTitle(pres, { subtitle: "Utviklingsarbeidet i PFT Eiendom – kort fortalt", duration: "15 minutter" }); n++;
  await sGoals(pres, { n: ++n, total, minutes: 15, agenda: [
    ["Hvorfor utviklingsarbeid", "3 min"], ["Hva er RF Studio", "3 min"], ["Slik jobber vi", "3 min"],
    ["Ett eksempel", "2 min"], ["Hva betyr det for deg", "2 min"], ["Oppsummering og spørsmål", "2 min"],
  ] });
  await sHook(pres, { n: ++n, total });
  await sWhy(pres, { n: ++n, total });
  await sWhat(pres, { n: ++n, total });
  await sProcess(pres, { n: ++n, total });
  sCase(pres, { n: ++n, total, label: "Eksempel: fra behov til løsning" });
  await sWIIFM(pres, { n: ++n, total });
  await sContribute(pres, { n: ++n, total, withTimeline: true });
  await sRemember(pres, { n: ++n, total, minutes: 15 });
  sClose(pres, { n: ++n, total });
  if (n !== total) throw new Error("15: slide count mismatch " + n);
  const f = path.join(OUT, "RF-Studio-15-min.pptx");
  await pres.writeFile({ fileName: f });
  console.log("wrote", f);
}

async function build30() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "RF Studio · PFT Eiendom";
  pres.title = "RF Studio – 30 minutter for eiendomsansvarlige";
  pres.lang = "nb-NO";
  const total = 18;
  let n = 0;
  sTitle(pres, { subtitle: "Utviklingsarbeidet i PFT Eiendom – hva vi gjør, hvordan, og hva det betyr for deg", duration: "30 minutter" }); n++;
  await sGoals(pres, { n: ++n, total, minutes: 30, agenda: [
    ["Hvorfor utviklingsarbeid", "5 min"], ["Hva er RF Studio", "6 min"], ["Slik jobber vi", "6 min"],
    ["To eksempler", "5 min"], ["Hva betyr det for deg", "6 min"], ["Oppsummering og spørsmål", "2 min"],
  ] });
  await sHook(pres, { n: ++n, total });
  sThinkPair(pres, { n: ++n, total });
  await sWhy(pres, { n: ++n, total });
  await sWhat(pres, { n: ++n, total });
  await sTeam(pres, { n: ++n, total });
  await sFocus(pres, { n: ++n, total });
  await sProcess(pres, { n: ++n, total });
  await sPrinciples(pres, { n: ++n, total });
  sCheckpoint(pres, { n: ++n, total });
  sCase(pres, { n: ++n, total, label: "Eksempel 1: fra behov til løsning", section: "Eksempel 1 av 2" });
  sCase(pres, { n: ++n, total, label: "Eksempel 2: det vi lærte underveis", section: "Eksempel 2 av 2" });
  await sWIIFM(pres, { n: ++n, total });
  sDiscussion(pres, { n: ++n, total });
  await sContribute(pres, { n: ++n, total, withTimeline: true });
  await sRemember(pres, { n: ++n, total, minutes: 30 });
  sClose(pres, { n: ++n, total });
  if (n !== total) throw new Error("30: slide count mismatch " + n);
  const f = path.join(OUT, "RF-Studio-30-min.pptx");
  await pres.writeFile({ fileName: f });
  console.log("wrote", f);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await build15();
  await build30();
})().catch((e) => { console.error(e); process.exit(1); });
