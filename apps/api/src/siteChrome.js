// siteChrome.js – felles topptekst, bunntekst og kontaktseksjon for de
// offentlige sidene. Sidene er statiske HTML-filer med plassholderne
// __SITE_HEADER__, __SITE_FOOTER__ og (valgfritt) __SITE_TEAM__; delene leses
// én gang ved oppstart. Ingen brukerdata går
// gjennom her: routePath er alltid en fast streng fra rutetabellen, aldri
// noe fra forespørselen.
const fs = require("fs");
const path = require("path");

const HEADER = fs.readFileSync(path.join(__dirname, "partials/header.html"), "utf8");
const FOOTER = fs.readFileSync(path.join(__dirname, "partials/footer.html"), "utf8");
const TEAM = fs.readFileSync(path.join(__dirname, "partials/team.html"), "utf8");

// Marker gjeldende side i menyen (aria-current) når ruten har en menylenke.
function headerFor(routePath) {
  if (!routePath) return HEADER;
  const needle = `<a href="${routePath}">`;
  return HEADER.includes(needle)
    ? HEADER.replace(needle, () => `<a href="${routePath}" aria-current="page">`)
    : HEADER;
}

// Funksjons-erstatning: «$» i delene skal aldri tolkes som erstatningsmønster.
function withChrome(html, routePath) {
  const header = headerFor(routePath);
  return html
    .replace("__SITE_HEADER__", () => header)
    .replace("__SITE_FOOTER__", () => FOOTER)
    .replace("__SITE_TEAM__", () => TEAM);
}

module.exports = { withChrome, HEADER, FOOTER, TEAM };
