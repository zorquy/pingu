-- ═══════════════════════════════════════════════════════════════════
-- EL CÓDIGO DE TCG LIVE DE CADA SET (tanda 233)
--
-- Una línea de decklist trae el código del set tal como lo escribe TCG
-- Live: «4 Dreepy TWM 128». Para enseñar la imagen de esa carta hay que
-- traducir TWM a un set nuestro.
--
-- Hasta ahora esa traducción vivía ESCRITA A MANO en js/torneos/comun.js,
-- y por eso se quedaba corta cada vez que salía un set: el 2026-09-01 una
-- lista traía ASC, POR, CRI y MEE y no estaba ninguno — esas cartas
-- salían sin imagen y hacía falta desplegar para arreglarlo.
--
-- La traducción la da TCGdex: el objeto Set completo (el de `sets/<id>`,
-- NO el del listado) trae el campo `tcgOnline`. Y ese objeto ya se pide
-- en cada importación de cartas, así que el dato lo teníamos delante y
-- lo estábamos tirando.
--
-- Con esta columna, un set nuevo trae su código solo al importarlo y no
-- hace falta tocar nada más.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.tcg_sets
  add column if not exists tcg_online_code text;

-- Por este índice se entra en CADA línea de una decklist, así que no es
-- un adorno. Parcial porque la inmensa mayoría de los sets antiguos no
-- tienen código (TCG Live no existía) y no hay por qué indexar nulos.
create index if not exists sets_codigo_live
  on public.tcg_sets (tcg_online_code, market)
  where tcg_online_code is not null;

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Al ejecutarla sale 0: la columna existe pero está vacía. Se rellena
-- desde /admin → Cartas → «Traer códigos de TCG Live», que pide a
-- TCGdex el detalle de cada set y se queda solo con el código.
select count(*) filter (where tcg_online_code is not null) as con_codigo,
       count(*) as sets_totales
from public.tcg_sets
where market = 'WEST';

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
