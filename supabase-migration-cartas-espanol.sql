-- ════════════════════════════════════════════════════════════════════
-- Tanda 330 — el catálogo en español
-- ════════════════════════════════════════════════════════════════════
--
-- Los ataques salen en inglés, y no es un descuido: el catálogo
-- occidental se importa en INGLÉS a propósito (español e inglés
-- comparten los identificadores de set y el inglés es el superconjunto,
-- 218 sets frente a 154). Pero eso era una decisión sobre el LISTADO,
-- donde lo único que hay es el nombre.
--
-- El texto de los ataques viene en la petición POR CARTA, que ya
-- hacemos igual para engordar. Pedirla en español no cuesta ni una
-- petición más: cuesta pedirla en otro idioma.
--
-- ── Por qué hace falta una columna ──
--
-- La cobertura en español NO es completa: las cartas anteriores a 2011
-- no están traducidas y TCGdex devuelve 404. Así que se pide `es` y se
-- cae a `en`, y hay que poder responder a «¿cuántas están de verdad en
-- español?» y «¿cuáles conviene reintentar dentro de un año, cuando la
-- comunidad haya traducido más?».
--
-- Sin esta columna, una carta engordada en inglés y una engordada en
-- español son indistinguibles, y volver a intentarlo obligaría a
-- reengordar las 23.000.
--
-- Ejecutar en el SQL Editor de Supabase.

begin;

alter table public.tcg_cards
  -- 'es' o 'en'. Null = engordada antes de la tanda 330, o sea, inglés
  -- sin haberlo intentado en español. Esas son justo las que hay que
  -- volver a pasar, y por eso se distinguen de las que ya se
  -- intentaron: repetir lo que ya se sabe que no existe es gastar
  -- 23.000 peticiones para nada.
  add column if not exists detalle_lang text;

-- El índice del engorde pasa a mirar también el idioma: lo que toca
-- ahora es lo que no está engordado O lo que está en un idioma que no
-- hemos elegido. Parcial, como el de la 322, para que siga siendo
-- barato cuando queden cuatro.
drop index if exists public.tcg_cards_sin_detalle_idx;
create index if not exists tcg_cards_sin_detalle_idx
  on public.tcg_cards (set_id)
  where detalle_at is null or detalle_lang is null;

commit;

-- ── Para mirar cómo va ──
--
-- select coalesce(detalle_lang, '(sin intentar)') as idioma,
--        count(*) filter (where detalle_at is not null) as engordadas,
--        count(*) as total
-- from public.tcg_cards
-- where market = 'WEST'
-- group by 1 order by 3 desc;
