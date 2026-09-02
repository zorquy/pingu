-- ═══════════════════════════════════════════════════════════════════
-- EL REGISTRO DE PARTIDAS (tanda 230)
--
-- Lo pidió PINGU tras enseñarme trainingcourt.app: apuntar contra qué
-- mazo has jugado y cómo te ha ido, para saber en qué enfrentamientos
-- vas bien y en cuáles te comen.
--
-- ── LO QUE ESTA TABLA NO GUARDA ──
--
-- Las partidas jugadas EN POKEDOC no van aquí. Esas ya están en
-- tournament_matches con su resultado, y el arquetipo se deduce de las
-- decklists cuando se pueden ver — /mis-partidas las lee de ahí y las
-- junta con estas al vuelo.
--
-- Copiarlas aquí habría sido más cómodo de consultar y una fuente de
-- verdad duplicada: dos sitios donde vive el mismo resultado, y el día
-- que uno se desincronice no hay forma de saber cuál miente. Además, el
-- arquetipo del rival puede cambiar cuando un admin cataloga un mazo
-- nuevo, y lo copiado no se enteraría.
--
-- Aquí van SOLO las de fuera: TCG Live, la tienda del barrio, un torneo
-- presencial. Las que nadie más va a apuntar por ti.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists public.match_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,

  -- Los dos mazos, con la MISMA clave que usa js/torneos/arquetipos.js
  -- (claveDeArquetipo): 'a:<id-del-catálogo>' para uno catalogado o
  -- 'd:<nombre normalizado>' para uno deducido a mano. Así una partida
  -- apuntada aquí y una jugada en un torneo caen en la misma casilla de
  -- la matriz sin tener que casar nombres a ojo.
  mi_mazo text not null,
  rival_mazo text not null,
  -- Y el nombre tal cual se escribió, para poder enseñarlo: la clave es
  -- para agrupar, no para leer.
  mi_mazo_nombre text not null,
  rival_mazo_nombre text not null,

  resultado text not null check (resultado in ('win', 'loss', 'draw')),

  -- Dónde se jugó. Texto libre a propósito («TCG Live», «Liga del
  -- jueves», «Regional de Madrid»): una lista cerrada de sitios se
  -- queda corta el primer día.
  donde text,
  notas text,

  -- La fecha la pone quien apunta, que casi nunca apunta el mismo día.
  jugada_el date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists partidas_mias on public.match_log (user_id, jugada_el desc);
-- La matriz agrupa por los dos mazos: este índice es el que la hace
-- barata cuando alguien lleve cientos de partidas apuntadas.
create index if not exists partidas_enfrentamiento on public.match_log (user_id, mi_mazo, rival_mazo);

alter table public.match_log enable row level security;

-- Tus partidas son TUYAS y de nadie más. No hay lectura pública ni para
-- admins: esto es el cuaderno de entrenamiento de cada uno, y saber a
-- qué está probando alguien antes de un torneo es justo lo que no se
-- puede filtrar.
drop policy if exists partidas_solo_mias on public.match_log;
create policy partidas_solo_mias on public.match_log for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que devolver 0 y no dar error.
select count(*) as partidas_apuntadas from public.match_log;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
