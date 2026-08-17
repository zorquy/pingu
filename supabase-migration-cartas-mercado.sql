-- De qué mercado es cada carta
-- ============================================================
--
-- Hoy el catálogo es sólo el occidental, y en inglés. Van a entrar el
-- japonés y (si TCGdex lo sirve) el chino, y una Charizard japonesa NO
-- es la misma carta que la inglesa: para quien colecciona son dos cosas
-- distintas, con precios distintos.
--
-- Esta migración añade la columna y marca todo lo que ya hay como
-- occidental. NO importa nada nueva y NO cambia la clave primaria.
--
-- Lo segundo es a propósito. La clave de `tcg_cards` es hoy el id de la
-- carta a secas, y cambiarla depende de una pregunta que todavía no
-- tiene respuesta: si los catálogos comparten identificadores de set. Si
-- los comparten, importar japonés PISARÍA las occidentales en silencio,
-- y la clave tendría que pasar a ser (id, market) ANTES de importar.
--
-- Para eso está el botón «Diagnosticar catálogos» del panel de cartas:
-- lo contesta con datos de la API, no de oído. Hasta entonces esta
-- columna no hace nada más que dejar el terreno preparado.
--
-- Necesita supabase-migration-cartas.sql.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- 'WEST' = el catálogo occidental (inglés). 'JP' = japonés.
-- 'CN' = chino, si existe. Se deja como texto libre con comprobación en
-- vez de un enum: añadir un valor a un enum en Postgres es más incómodo
-- de lo que parece, y esta lista va a crecer.
alter table tcg_sets add column if not exists market text not null default 'WEST';
alter table tcg_cards add column if not exists market text not null default 'WEST';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tcg_sets_market_check'
  ) then
    alter table tcg_sets add constraint tcg_sets_market_check
      check (market in ('WEST', 'JP', 'CN'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tcg_cards_market_check'
  ) then
    alter table tcg_cards add constraint tcg_cards_market_check
      check (market in ('WEST', 'JP', 'CN'));
  end if;
end $$;

-- El buscador del editor filtrará por mercado en cuanto haya más de uno:
-- quien busca una carta para su guía no quiere las tres versiones de la
-- misma carta mezcladas en los resultados.
create index if not exists tcg_cards_market_idx on tcg_cards (market);
create index if not exists tcg_sets_market_idx on tcg_sets (market);

commit;
