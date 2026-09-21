-- ════════════════════════════════════════════════════════════════════
-- Tanda 325 — qué cartas se juegan de verdad en PokeDoc
-- ════════════════════════════════════════════════════════════════════
--
-- Esta es la tabla que hace que una ficha de carta merezca existir. El
-- nombre, la foto y los ataques los tienen otras quince webs; «en los
-- torneos de PokeDoc la llevan 18 mazos, sobre todo de Ceruledge
-- Dusknoir» no lo tiene nadie más, y sale de datos que ya recogemos.
--
-- ── Por qué una tabla y no una consulta ──
--
-- Saber qué mazos llevan una carta obliga a mirar DENTRO del jsonb de
-- cada decklist. Hacerlo en cada visita sería recorrer todas las listas
-- del sitio para pintar una página, y encima desde la función del borde,
-- que tiene 2,5 segundos para todo. Se calcula aparte y se guarda.
--
-- ── Y por qué eso NO rompe la garantía de los arquetipos ──
--
-- La casa tiene una regla: los arquetipos no se guardan, se deducen al
-- pintarlos, y por eso la visibilidad no se puede equivocar — ves el
-- mazo de alguien exactamente cuando la base te deja ver su lista.
-- Guardar un agregado se lleva esa garantía por delante SI se calcula
-- con la clave de servicio, que se salta la RLS.
--
-- Por eso la función programada LEE las decklists con la clave PÚBLICA
-- (y entonces la política `decklists_ver` decide, igual que para
-- cualquiera) y solo ESCRIBE aquí con la de servicio. Lo que entra en
-- este agregado es, por construcción, lo que ve todo el mundo.
--
-- Ejecutar en el SQL Editor de Supabase.

begin;

create table if not exists public.tcg_card_play (
  -- El nombre normalizado (sin tildes, en minúsculas). Se agrupa por
  -- NOMBRE y no por identificador de carta a propósito: una decklist
  -- nombra cartas, y a quien pregunta «¿se juega Ceruledge ex?» le da
  -- igual de qué reimpresión sea la copia que lleva el rival.
  name_key text primary key,
  name text not null,

  -- Cuántos mazos DISTINTOS la llevan y cuántas copias suman entre
  -- todos. La media sale de dividir: guardar la media ya dividida haría
  -- imposible recalcular nada.
  decks int not null default 0,
  total_copies int not null default 0,

  -- En cuántos torneos distintos ha aparecido. Diez mazos en un torneo
  -- es una moda de una tarde; diez mazos en seis torneos es un mazo.
  tournaments int not null default 0,

  -- Los arquetipos donde se juega, ya ordenados y recortados:
  -- [{ clave, nombre, mazos }]. Se guardan DEDUCIDOS en el momento del
  -- cálculo, con el mismo código que los pinta en un torneo.
  archetypes jsonb,

  updated_at timestamptz not null default now()
);

-- Para la portada del catálogo y para cualquier «lo más jugado».
create index if not exists tcg_card_play_decks_idx
  on public.tcg_card_play (decks desc);

alter table public.tcg_card_play enable row level security;

-- Lectura para todo el mundo, con y sin sesión: es el escaparate, y lo
-- que hay dentro ya es público por construcción (ver arriba).
drop policy if exists tcg_card_play_ver on public.tcg_card_play;
create policy tcg_card_play_ver on public.tcg_card_play for select using (true);

-- Escribir, solo la clave de servicio (que se salta la RLS y por eso no
-- necesita política). Sin política de escritura, nadie más puede tocarla.

commit;
