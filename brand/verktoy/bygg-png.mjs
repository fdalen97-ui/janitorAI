// Krever Playwright med Chromium (npx playwright install chromium). Kjør fra repo-rota:
//   node brand/verktoy/bygg-png.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const B=R+'/brand';
const read=n=>fs.readFileSync(`${B}/${n}`,'utf8');
const b=await chromium.launch();
async function shot(html, w, h, out, {transparent=true, scale=1}={}){
  const pg=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:scale});
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style></head><body>${html}</body></html>`,{waitUntil:'networkidle'});
  await pg.screenshot({path:out, omitBackground:transparent, clip:{x:0,y:0,width:w,height:h}});
  await pg.close(); console.log('wrote', out.replace(R+'/',''), w+'x'+h);
}
const svgSized=(name,w,h)=>read(name).replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
const M=R+'/apps/mobile/assets/images', A=R+'/apps/api/src/assets', E=R+'/explainer';
// App-ikon (iOS/Expo): full flate, uten avrunding
await shot(svgSized('docrai-app-ikon.svg',1024,1024),1024,1024,`${M}/icon.png`,{transparent:false});
// Android adaptive: forgrunn = merket i papir på gjennomsiktig, innenfor sikker sone (66 %)
const fgMark=read('docrai-merke-mork.svg').replace('#ECC745','#FFD84D').replace(/width="[\d.]+" height="[\d.]+"/,'width="300" height="300"');
await shot(`<div style="width:512px;height:512px;display:flex;align-items:center;justify-content:center">${fgMark}</div>`,512,512,`${M}/android-icon-foreground.png`);
await shot(`<div style="width:512px;height:512px;background:#2F4A5E"></div>`,512,512,`${M}/android-icon-background.png`,{transparent:false});
const monoMark=read('docrai-merke.svg').replace(/#2F4A5E/g,'#000000').replace('#FFD84D','#000000').replace(/width="[\d.]+" height="[\d.]+"/,'width="252" height="252"');
await shot(`<div style="width:432px;height:432px;display:flex;align-items:center;justify-content:center">${monoMark}</div>`,432,432,`${M}/android-icon-monochrome.png`);
// Splash: avrundet brikke på gjennomsiktig, fungerer på lys og mørk bunn
await shot(`<div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center"><div style="width:1024px;height:1024px;border-radius:226px;overflow:hidden">${svgSized('docrai-app-ikon.svg',1024,1024)}</div></div>`,1024,1024,`${M}/splash-icon.png`);
// Favicons (brikke med avrundede hjørner)
await shot(svgSized('docrai-favicon.svg',500,500),500,500,`${M}/docrai_favicon.png`);
await shot(svgSized('docrai-favicon.svg',48,48),48,48,`${M}/favicon.png`);
await shot(svgSized('docrai-favicon.svg',256,256),256,256,`${A}/favicon.png`);
await shot(svgSized('docrai-favicon.svg',256,256),256,256,`${E}/favicon.png`);
// Apple touch: full flate (iOS runder selv)
await shot(svgSized('docrai-app-ikon.svg',360,360),360,360,`${A}/apple-touch-icon.png`,{transparent:false});
await shot(svgSized('docrai-app-ikon.svg',360,360),360,360,`${E}/apple-touch-icon.png`,{transparent:false});
// OG-bilde 1200×630: tekst = salgssidens tittel (regel 6-ryddet), ingen tall eller lovnader
const og=`<div style="width:1200px;height:630px;background:#E8F5F8;box-sizing:border-box;padding:72px 88px;display:flex;flex-direction:column;justify-content:space-between;font-family:'Manrope','Segoe UI',Arial,sans-serif;color:#072227">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700&display=swap">
<div>${svgSized('docrai-logo.svg',281,96)}</div>
<div style="font-size:58px;font-weight:700;letter-spacing:-1.8px;line-height:1.12;max-width:1020px">Fra befaring til skaderapport.<br><span style="color:#2F4A5E">AI-en skriver utkastet, du godkjenner.</span></div>
<div style="display:flex;align-items:center;gap:18px;font-size:24px;font-weight:600;color:#596D71"><span style="background:#2F4A5E;color:#FBFEFF;border-radius:999px;padding:10px 22px">Du godkjenner, ikke AI-en</span><span>Video · tale · foto · årsak · akutt/gradvis</span></div>
</div>`;
await shot(og,1200,630,`${A}/og-bilde.png`,{transparent:false});
await shot(og,1200,630,`${E}/og-bilde.png`,{transparent:false});
await b.close();
