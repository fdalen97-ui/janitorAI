-- Kampanjetrakt siste 30 dager, per kampanjekilde (?k= i lenken).
-- Besøk → klikk på «Bli pilot» / «Book møte» → innsendt pilotinteresse.
-- Kjør: psql "$DATABASE_URL" -f apps/api/scripts/kampanjetrakt.sql
-- Ingen persondata i resultatet: bare tellinger per kode. Testet i test/e2e-share.sh.
WITH alle AS (
  SELECT coalesce(kilde, '(direkte)') AS kilde, 1 AS besok, 0 AS pilotklikk, 0 AS moteklikk, 0 AS leads
    FROM sidevisninger WHERE created_at > now() - interval '30 days'
  UNION ALL
  SELECT coalesce(kilde, '(direkte)'), 0, (navn = 'cta_pilot')::int, (navn = 'cta_mote')::int, 0
    FROM hendelser WHERE created_at > now() - interval '30 days'
  UNION ALL
  SELECT coalesce(kilde, '(direkte)'), 0, 0, 0, 1
    FROM pilot_interesse WHERE created_at > now() - interval '30 days'
)
SELECT kilde,
       sum(besok)      AS besok,
       sum(pilotklikk) AS pilotklikk,
       sum(moteklikk)  AS moteklikk,
       sum(leads)      AS leads
  FROM alle
 GROUP BY kilde
 ORDER BY leads DESC, besok DESC, kilde;
