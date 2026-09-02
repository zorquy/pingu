-- ═══════════════════════════════════════════════════════════════════
-- EL REGISTRO DE PARTIDAS, POR TORNEOS (tanda 236)
--
-- Lo pidió Ibai: «lo de mis partidas debería funcionar por torneos —
-- creas un torneo y apuntas cómo te ha ido». Como trainingcourt: el
-- torneo de la tienda es UNA cosa con sus rondas dentro, no cinco
-- partidas sueltas que casualmente comparten fecha.
--
-- ── QUÉ ES ESTA TABLA Y QUÉ NO ──
--
-- Es el torneo APUNTADO A MANO (el presencial, el de TCG Live), no los
-- torneos de PokeDoc: esos ya viven en `tournaments` con sus rondas de
-- verdad y /mis-partidas los lee de allí. Aquí solo va lo que nadie más
-- puede apuntar por ti.
--
-- Las rondas de un torneo apuntado son filas NORMALES de `match_log`
-- con `torneo_id` relleno. A propósito:
--   · La matriz de enfrentamientos no distingue una ronda de torneo de
--     una partida suelta — sigue leyendo match_log y ya está.
--   · El mazo va DENORMALIZADO en cada ronda (mi_mazo se copia del
--     torneo al guardar): match_log ya exigía mi_mazo not null y las
--     filas viejas no tienen torneo del que heredarlo.
--   · Borrar el torneo borra sus rondas (cascade): una ronda sin su
--     torneo es un dato huérfano que nadie sabría leer.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists public.match_log_torneos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,

  -- «Liga del jueves», «Regional de Sevilla»… El nombre lo es todo aquí:
  -- es como el jugador reconoce su torneo en la lista.
  nombre text not null,
  donde text,

  -- El mazo que se jugó TODO el torneo, con la misma clave que
  -- match_log (claveDeArquetipo). Se copia a cada ronda al guardarla.
  mi_mazo text,
  mi_mazo_nombre text,

  jugado_el date not null default (now() at time zone 'utc')::date,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists log_torneos_mios on public.match_log_torneos (user_id, jugado_el desc);

alter table public.match_log_torneos enable row level security;

-- El mismo trato que match_log: tus torneos son TUYOS. Ni lectura
-- pública ni para admins — es el cuaderno de entrenamiento de cada uno.
drop policy if exists log_torneos_solo_mios on public.match_log_torneos;
create policy log_torneos_solo_mios on public.match_log_torneos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Cada ronda apunta a su torneo. NULL = partida suelta de las de antes
-- (y de las de siempre: la partida suelta sigue existiendo).
alter table public.match_log
  add column if not exists torneo_id uuid references public.match_log_torneos (id) on delete cascade;

create index if not exists partidas_de_torneo on public.match_log (torneo_id) where torneo_id is not null;

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que devolver 0 y no dar error.
select count(*) as torneos_apuntados from public.match_log_torneos;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
