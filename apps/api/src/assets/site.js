// site.js – cookiefri kampanjekilde og klikktelling for salgssidene.
// Ingen cookies, ingen lagring i nettleseren, ingen tredjepart:
//  1. Kampanjekoden (?k=…) leses fra adressen og bæres videre i interne lenker
//     og skjema, så kilden følger besøket fra side til side og inn i leadet.
//  2. Klikk på elementer med data-cta telles hos vårt eget API (/api/hendelse)
//     med knappenavn, sti og kampanjekode. Aldri IP, ID eller fingeravtrykk.
// På docrai.io (explainer/) peker data-api til API-verten, og data-besok ber
// skriptet også telle sidevisningen.
(function () {
  var el = document.currentScript;
  var api = (el && el.getAttribute('data-api')) || '';
  var sti = (el && el.getAttribute('data-sti')) || location.pathname;
  var k = null;
  try {
    var raw = new URLSearchParams(location.search).get('k');
    if (raw && /^[A-Za-z0-9_.:-]{1,80}$/.test(raw)) k = raw;
  } catch (e) {}

  function send(path, data) {
    try { navigator.sendBeacon(api + path, JSON.stringify(data)); } catch (e) {}
  }
  function own(url) {
    return url.origin === location.origin || (api && url.origin === api);
  }

  if (k) {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      try {
        var u = new URL(href, location.href);
        if (!/^https?:$/.test(u.protocol) || !own(u) || u.pathname.indexOf('/api/') === 0) return;
        if (!u.searchParams.has('k')) { u.searchParams.set('k', k); a.setAttribute('href', u.href); }
      } catch (e) {}
    });
    document.querySelectorAll('form[action]').forEach(function (f) {
      try {
        if (!own(new URL(f.getAttribute('action'), location.href))) return;
        var i = document.createElement('input');
        i.type = 'hidden';
        i.name = (f.method || '').toLowerCase() === 'post' ? 'kilde' : 'k';
        i.value = k;
        f.appendChild(i);
      } catch (e) {}
    });
  }

  function hendelse(navn) {
    send('/api/hendelse', { navn: navn, sti: sti, kilde: k || undefined });
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('a[data-cta], button[data-cta]') : null;
    if (t) hendelse(t.getAttribute('data-cta'));
  });
  document.addEventListener('submit', function (e) {
    var navn = e.target && e.target.getAttribute ? e.target.getAttribute('data-cta') : null;
    if (navn) hendelse(navn);
  });

  if (el && el.hasAttribute('data-besok')) send('/api/besok', { sti: sti, kilde: k || undefined });
})();
