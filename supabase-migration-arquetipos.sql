-- ═══════════════════════════════════════════════════════════════════
-- EL CATÁLOGO DE ARQUETIPOS (tanda 230)
--
-- Lo pidió PINGU tras ver cómo lo hace Limitless: en la clasificación y
-- en las mesas, dos cartas al lado de cada jugador dicen a qué juega sin
-- tener que abrir su lista.
--
-- Esta tabla es SOLO el catálogo curado: cómo se llama cada mazo, qué
-- dos cartas lo representan y qué cartas tiene que llevar para serlo.
--
-- NO hay tabla de «arquetipo de fulano en tal torneo», a propósito: el
-- arquetipo se deduce de la decklist al pintarla. Así la regla de
-- visibilidad sale gratis y no se puede equivocar — ves el arquetipo
-- exactamente cuando la base te deja ver la lista, ni antes ni por otro
-- camino. Ver js/torneos/arquetipos.js.
--
-- SE ENTREGA VACÍA. No se siembra ningún arquetipo desde aquí: los
-- números de carta del meta de la temporada no me los puedo inventar, y
-- una fila mal puesta identifica mazos mal para siempre. Hasta que un
-- admin la llene desde /admin, la web deduce el arquetipo sola (los dos
-- Pokémon más definitorios) y marca esos mazos como «sin catalogar»,
-- que es exactamente la lista de lo que hay que añadir.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists public.tcg_archetypes (
  -- Un identificador legible y estable ('dragapult-dusknoir'): es lo que
  -- agrupa los enfrentamientos del registro de partidas, así que
  -- sobrevive a que le cambien el nombre bonito.
  id text primary key,
  nombre text not null,

  -- Las dos cartas que se pintan, en orden: [{set, numero}, {set, numero}].
  -- `set` es el código de TCG Live (TWM, SFA…) y `numero` el impreso en
  -- la carta; con esos dos se saca la imagen de nuestro espejo igual que
  -- hace la rejilla de la decklist.
  iconos jsonb not null default '[]'::jsonb,

  -- Qué tiene que llevar un mazo para ser esto:
  --   [{"nombres": ["Dragapult ex"], "set": "TWM", "numero": "130"}, …]
  -- Vale por número (exacto, pero se rompe con cada reimpresión) o por
  -- CUALQUIERA de los nombres (aguanta reimpresiones, y por eso son
  -- varios: el export de TCG Live viene en el idioma del jugador, y
  -- «Boss's Orders» y «Órdenes del jefe» son la misma carta).
  -- Cuantos más requisitos, más específico: de los que casen gana ese.
  requiere jsonb not null default '[]'::jsonb,

  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un arquetipo sin requisitos casaría con TODOS los mazos. El cliente ya
-- los descarta, pero eso es esconder el problema: aquí no entran.
alter table public.tcg_archetypes drop constraint if exists arquetipos_con_requisitos;
alter table public.tcg_archetypes add constraint arquetipos_con_requisitos
  check (jsonb_typeof(requiere) = 'array' and jsonb_array_length(requiere) > 0);

alter table public.tcg_archetypes drop constraint if exists arquetipos_dos_iconos;
alter table public.tcg_archetypes add constraint arquetipos_dos_iconos
  check (jsonb_typeof(iconos) = 'array' and jsonb_array_length(iconos) <= 2);

create index if not exists arquetipos_activos on public.tcg_archetypes (activo) where activo;

alter table public.tcg_archetypes enable row level security;

-- El catálogo es PÚBLICO de leer, y puede serlo sin miedo: son nombres
-- de mazos conocidos, no dice nada de nadie. Lo que revela lo que juega
-- una persona es la DECKLIST, y esa sigue con su política de siempre.
drop policy if exists arquetipos_leer on public.tcg_archetypes;
create policy arquetipos_leer on public.tcg_archetypes for select using (true);

drop policy if exists arquetipos_escribir on public.tcg_archetypes;
create policy arquetipos_escribir on public.tcg_archetypes for all
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin));

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que devolver 0 filas y no dar error: la tabla existe y está
-- vacía a la espera de que /admin → Torneos → Arquetipos la llene.
select count(*) as arquetipos_catalogados from public.tcg_archetypes;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
