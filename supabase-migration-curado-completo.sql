-- ─────────────────────────────────────────────────────────────────────
-- LA MARCA DE VERSIÓN DEL CURADO (tanda 380).
--
-- PINGU: «hay un montón de colecciones que no tienen logo —Shining
-- Legends, la Shiny Vault, todas las Trainer Gallery, la 30th
-- Celebration— y la Classic Collection no trae ninguna carta».
--
-- Tres síntomas, UNA causa: la función programada `cartas-detalle` ya se
-- descarga el SET COMPLETO y la CARTA COMPLETA de TCGdex —son las
-- peticiones caras, las que la importación evita a propósito— y se queda
-- con una parte de lo que viene dentro:
--
--   · de un set cura la fecha, la serie y el código de TCG Live, pero
--     NO el logo ni la cuenta de cartas. Por eso la 30th Classic
--     Collection dice «0 de 0»: tiene sus 30 cartas en la base y
--     `card_count_official` a 0, y la estantería cuenta por ahí.
--   · de una carta guarda 17 campos —vida, ataques, rareza,
--     ilustrador— y NO la imagen.
--
-- O sea que el arreglo no cuesta NI UNA PETICIÓN MÁS. Lo que cuesta es
-- volver a visitar lo ya visitado, y ahí está el problema de verdad.
--
-- ── POR QUÉ HACE FALTA UNA VERSIÓN Y NO BASTA CON «¿LE FALTA?» ──
--
-- La tentación es visitar los sets sin logo. Pero **hay sets cuyo logo
-- TCGdex no tiene**, y la condición «le falta el logo» no distingue «no
-- lo hemos pedido» de «no existe»: esos se volverían a pedir cada cinco
-- minutos PARA SIEMPRE.
--
-- Eso no es una hipótesis, es lo que pasó en la tanda 333 con el código
-- de TCG Live: ~100 sets imposibles de completar, la fase de sets no
-- acababa nunca y el engorde de cartas —que va detrás— no arrancó
-- jamás. 3.676 cartas engordadas de 21.356, y ninguna en español.
--
-- La marca de versión lo resuelve de raíz: el curador lleva un número, y
-- cuando APRENDE a quedarse con un campo nuevo, ese número sube. Cada
-- fila con una versión vieja se revisita UNA vez, se le escribe la
-- versión nueva, y no vuelve — tenga o no tenga el campo. La pregunta
-- deja de ser «¿le falta esto?» y pasa a ser «¿le hemos preguntado con
-- lo que sabemos hoy?», que sí se puede contestar.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- 0 = «visitado por un curador que todavía no sabía quedarse con el
-- logo ni con las cuentas». Todas las filas de hoy son 0, que es
-- justamente lo que se quiere: una pasada de repaso y ya.
alter table public.tcg_sets  add column if not exists curado_v smallint not null default 0;
alter table public.tcg_cards add column if not exists curado_v smallint not null default 0;

comment on column public.tcg_sets.curado_v is
  'Versión del curador que visitó este set. Sube cuando el curador aprende a quedarse con un campo nuevo; las filas con versión vieja se revisitan UNA vez. No es «le falta algo»: es «le preguntamos con lo que sabíamos entonces».';
comment on column public.tcg_cards.curado_v is
  'Lo mismo para una carta. Ver tcg_sets.curado_v.';

-- El índice es PARCIAL y sobre las dos cosas a la vez: lo que se busca
-- es «cartas sin imagen que no hemos vuelto a mirar», y son ~1.200 de
-- 21.356. Sin el `where`, el índice pesaría dieciocho veces más para
-- contestar la misma pregunta.
--
-- Cuando el repaso termine, este índice se queda VACÍO y la consulta
-- sigue costando lo mismo: nada. Por eso no hay que acordarse de
-- borrarlo.
create index if not exists tcg_cards_sin_imagen_idx
  on public.tcg_cards (market, set_id)
  where image_path is null and curado_v < 1;

-- Y el de los sets por repasar, por lo mismo.
create index if not exists tcg_sets_curado_viejo_idx
  on public.tcg_sets (market, release_date desc nulls last)
  where curado_v < 1;

commit;

-- ── Comprobación: el tamaño del repaso que viene ──
select
  (select count(*) from public.tcg_sets  where market = 'WEST' and curado_v < 1) as sets_por_repasar,
  (select count(*) from public.tcg_sets  where market = 'WEST' and logo_path is null) as sets_sin_logo,
  (select count(*) from public.tcg_sets  where market = 'WEST'
      and coalesce(card_count_official, card_count_total, 0) = 0)                 as sets_sin_cuenta,
  (select count(*) from public.tcg_cards where market = 'WEST'
      and image_path is null and curado_v < 1)                                    as cartas_por_mirar;

notify pgrst, 'reload schema';
