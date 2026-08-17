-- Cartas de varios mercados: occidental, japonés y chino
-- ============================================================
--
-- Hoy el catálogo es sólo el occidental. Van a entrar el japonés y los
-- dos chinos, y una Charizard japonesa NO es la misma carta que la
-- inglesa: para quien colecciona son dos cosas, con precios distintos.
--
-- ── Lo que decidió esta migración, con datos ──
--
-- El diagnóstico del panel preguntó a TCGdex por 16 idiomas. Dos cosas
-- salieron claras:
--
-- 1. Los idiomas OCCIDENTALES son un solo catálogo traducido. El español
--    comparte sus 154 identificadores de set con el inglés; el alemán sus
--    153, el italiano sus 190, el portugués sus 123. Todos. Sólo el
--    francés tiene 3 sets propios (promos francesas). Por eso se importa
--    el inglés, que es el superconjunto (218 sets, 23.746 cartas): pedir
--    los demás sería traer las mismas cartas con otro nombre.
--
-- 2. Los catálogos ASIÁTICOS tienen identificadores propios... PERO SE
--    PISAN ENTRE ELLOS. Esto es lo que decide la clave primaria, y no lo
--    buscaba nadie: el diagnóstico comparaba cada idioma contra el
--    inglés, no unos contra otros. Aun así se ve en los datos —
--    `CS1a`, `CS1b`, `CS2.5` y `CS4a` aparecen en chino tradicional, en
--    indonesio Y en tailandés, y `SVDs` en indonesio y tailandés. Son
--    sets DISTINTOS con el mismo identificador.
--
--    Con la clave siendo sólo `id`, importar dos de esos catálogos haría
--    que el segundo PISARA al primero sin dar ningún error.
--
-- Así que la clave pasa a ser (id, market) en las dos tablas. Con eso, un
-- choque entre mercados es imposible por construcción.
--
-- El japonés comparte 4 identificadores con el inglés, y con esta clave
-- da igual: son dos filas, una por mercado, que es justo lo que quiere
-- quien colecciona.
--
-- Necesita supabase-migration-cartas.sql.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- ── 1. La columna de mercado ──
--
-- Lo que ya está importado es occidental, así que el valor por defecto
-- deja la base coherente sin tocar una fila.
alter table tcg_sets add column if not exists market text not null default 'WEST';
alter table tcg_cards add column if not exists market text not null default 'WEST';

-- Los códigos son los mercados, no los idiomas: 'WEST' es un catálogo
-- que se publica en ocho idiomas con las mismas cartas dentro.
--
-- CN es el chino simplificado y TW el tradicional: son dos catálogos
-- distintos (56 y 98 sets), no dos traducciones del mismo.
--
-- KO, ID y TH existen y están completos (95, 70 y 72 sets). No se
-- importan porque no se han pedido, pero se admiten aquí para que
-- añadirlos sea cambiar una lista en js/tcgdex.js y nada más.
alter table tcg_sets drop constraint if exists tcg_sets_market_check;
alter table tcg_cards drop constraint if exists tcg_cards_market_check;
alter table tcg_sets add constraint tcg_sets_market_check
  check (market in ('WEST', 'JP', 'KO', 'CN', 'TW', 'ID', 'TH'));
alter table tcg_cards add constraint tcg_cards_market_check
  check (market in ('WEST', 'JP', 'KO', 'CN', 'TW', 'ID', 'TH'));

-- ── 2. La clave primaria pasa a (id, market) ──
--
-- El orden importa: la clave ajena de las cartas apunta a la clave de los
-- sets, así que hay que soltarla antes de tocar nada y volver a atarla
-- compuesta al final.
--
-- Se hace mirando pg_constraint en vez de a pelo para que se pueda
-- ejecutar dos veces: la segunda no encuentra nada que cambiar y pasa de
-- largo sin error.
do $$
declare
  nombre_fk text;
begin
  -- La clave ajena de tcg_cards -> tcg_sets, se llame como se llame.
  select conname into nombre_fk
  from pg_constraint
  where conrelid = 'public.tcg_cards'::regclass
    and contype = 'f'
    and confrelid = 'public.tcg_sets'::regclass;
  if nombre_fk is not null then
    execute format('alter table public.tcg_cards drop constraint %I', nombre_fk);
  end if;

  -- tcg_sets: (id) -> (id, market)
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.tcg_sets'::regclass and c.contype = 'p'
      and (select count(*) from unnest(c.conkey)) = 1
  ) then
    alter table public.tcg_sets drop constraint tcg_sets_pkey;
    alter table public.tcg_sets add constraint tcg_sets_pkey primary key (id, market);
  end if;

  -- tcg_cards: (id) -> (id, market)
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.tcg_cards'::regclass and c.contype = 'p'
      and (select count(*) from unnest(c.conkey)) = 1
  ) then
    alter table public.tcg_cards drop constraint tcg_cards_pkey;
    alter table public.tcg_cards add constraint tcg_cards_pkey primary key (id, market);
  end if;
end $$;

-- Y la clave ajena, ahora compuesta. Obliga a que una carta y su set
-- sean del MISMO mercado: sin esto se podría colar una carta japonesa
-- colgada de un set occidental.
alter table public.tcg_cards
  add constraint tcg_cards_set_fk
  foreign key (set_id, market) references public.tcg_sets (id, market)
  on delete cascade on update cascade;

-- ── 3. Índices ──
--
-- El buscador del editor filtra por mercado: quien busca una carta para
-- su guía no quiere las cuatro versiones de la misma carta mezcladas.
create index if not exists tcg_cards_market_idx on tcg_cards (market);
create index if not exists tcg_sets_market_idx on tcg_sets (market);

-- El índice de búsqueda por nombre ya existe (trigram sobre
-- `name_search`), pero ahora hay cuatro veces más filas y casi siempre se
-- consulta con el mercado puesto. Este lo cubre entero.
create index if not exists tcg_cards_market_name_idx on tcg_cards (market, name_search);

commit;
