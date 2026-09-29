# Beslutningslogg

Dato, beslutning, hvem — og hvor grunnlaget står. Ti linjer som sparer ti
diskusjoner (`docs/avklaringer-og-roller.md`, «Kadens som holder det sammen»).
Nyeste øverst. En beslutning som endres, får en ny linje; den gamle blir stående.

| Dato | Beslutning | Hvem | Grunnlag |
|---|---|---|---|
| 29.09.2026 | Resten av regel 6-ryddingen på salgsflatene: ingen tids- eller besparelsestall, ingen «forsikringsklar» og ingen «Byggforsk-henvisninger» som leveranse før det er målt eller vises i produktet. Grep-sjekkes i `e2e-headere.sh`. | Fredrik | `docs/nettside-masterplan.md` §1, §5.7 |
| 29.09.2026 | Dokumentgjelden i `docs/verdens-beste-losning.md` vedlegg A rettes nå (CliVa, valideringscaser 55, rate-limit, UU-status, modellflater, DDIA-status). | Fredrik | samme vedlegg |
| 28.09.2026 | docrai.io skal peke på Express-salgssidene (`/om` m.fl.), ikke `explainer/`. Stegene står i `docs/DEPLOYMENT.md` → «Domener»; DNS-byttet gjøres utenfor repoet. | Fredrik | `docs/nettside-masterplan.md` §0 |
| 28.09.2026 | «Nå»-sporet fra nettside-masterplanen implementeres: UU/kontrast, regel 6-rydding av pris (ingen pris publiseres før prisvedtak), cache-headere og `/eksempelrapport`. | Fredrik | `docs/nettside-masterplan.md` §4 |
| 28.09.2026 | Ikke nå: sperre PDF/Word-nedlasting før godkjenning, og ny CTA-arkitektur på /om. Salgsteksten lover bare at *deling* er sperret. | Fredrik | `docs/nettside-masterplan.md` §4 pkt 5 og 11 |
| 28.09.2026 | Rapportrute-feilen fra merge e2ae957 rettes i egen PR (#26); fiksen er portert til #25 så CI er grønn der også. | Fredrik | PR #26 |
| 28.09.2026 | Øvingssaken lages som klikkbar prototype først (ikke i appen), i repoet og som delbar lenke, med eksempeldata og fuktmålerdata. | Fredrik | `docs/ovingssak-og-prototyping.md` |
| 28.09.2026 | BIM/Revit utredes som studie, ikke bygging. Studiens anbefaling (openBIM før Revit, bevisporter først) er ikke vedtatt ennå. | Fredrik | `docs/bim-revit-potensial.md` |
| 27.09.2026 | Syntesen «verdens beste løsning» leveres som dokument i repoet, basert på repo + nettsøk. | Fredrik | `docs/verdens-beste-losning.md` |
