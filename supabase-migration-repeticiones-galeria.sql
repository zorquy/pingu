-- ════════════════════════════════════════════════════════════════════
-- Tanda 520 — partidas de ejemplo: publicar una repetición en la ficha
-- de su mazo del meta
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU, de la lista de ideas: «una galería pública por arquetipo:
-- publicar (si quieres) una repetición y que salga en /meta como partida
-- de ejemplo de ese mazo».
--
-- Va DESPUÉS de supabase-migration-repeticiones.sql (necesita su tabla).
--
-- ── Qué es publicar ──
--
-- Compartir (lo de siempre) es tener un enlace: la abre quien lo tiene y
-- nadie puede buscarla. PUBLICAR es que salga en una LISTA, la de la ficha
-- de su mazo en /meta, para cualquiera. Por eso es aparte y por función:
--
--   · `publica`, `arquetipos` y `publicada_at` NO están en el permiso de
--     escritura por columnas de `replays` (titulo, compartida, notas): solo
--     se cambian con repeticiones_publicar().
--   · Publicar exige ser el dueño y que al menos un mazo sea uno del meta
--     (su id en el catálogo, 'dragapult-dusknoir'): sin eso no saldría en
--     ninguna ficha, y una «pública» que no se ve en ningún sitio miente.
--   · Publicar la deja también compartida (sin enlace no se abre), y dejar
--     de compartirla la saca de la lista: la lista pide las dos cosas.
--   · Quitarla de la lista puede su dueño, y la administración del sitio
--     (para lo que no deba estar ahí).
--
-- La web publica una COPIA con los nombres de los jugadores cambiados por
-- Rojo y Azul (js/repeticiones/anonimizar.js): el rival no ha dicho que
-- quiera salir en una galería. La base no lo comprueba —no sabe leer un
-- registro—, por eso la casilla está en la web y viene marcada.
--
-- Se ejecuta en el SQL Editor de Supabase. Se puede repetir entera.

begin;

alter table public.replays add column if not exists publica boolean not null default false;
alter table public.replays add column if not exists arquetipos text[];
alter table public.replays add column if not exists publicada_at timestamptz;

alter table public.replays drop constraint if exists replays_arquetipos;
alter table public.replays add constraint replays_arquetipos check (
  arquetipos is null
  or (cardinality(arquetipos) between 1 and 2
      and array_to_string(arquetipos, ',') ~ '^[a-z0-9][a-z0-9-]{0,79}(,[a-z0-9][a-z0-9-]{0,79})?$')
);

create index if not exists replays_publicas on public.replays using gin (arquetipos) where publica;

-- Publicar o quitar. Devuelve cómo queda.
create or replace function public.repeticiones_publicar(p_id text, p_publica boolean, p_arquetipos text[] default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dueno uuid;
  v_ids text[];
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  select user_id into v_dueno from public.replays where id = p_id;
  if v_dueno is null then
    raise exception 'Esa repetición no existe.' using errcode = 'P0002';
  end if;
  if not p_publica then
    if v_dueno <> auth.uid() and not exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin) then
      raise exception 'Solo quien la publicó puede quitarla de la lista.' using errcode = '42501';
    end if;
    update public.replays set publica = false, publicada_at = null where id = p_id;
    return false;
  end if;
  if v_dueno <> auth.uid() then
    raise exception 'Solo quien la guardó puede publicarla.' using errcode = '42501';
  end if;
  -- Los ids de mazo que tienen forma de id del catálogo, sin repetir, dos
  -- como mucho (los dos de la partida).
  select array_agg(x order by primero) into v_ids
  from (select x, min(o) as primero
          from unnest(coalesce(p_arquetipos, '{}'::text[])) with ordinality as t(x, o)
         where x ~ '^[a-z0-9][a-z0-9-]{0,79}$'
         group by x) s;
  if v_ids is null then
    raise exception 'Ninguno de los dos mazos es de los del meta: no saldría en ninguna ficha.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.replays where user_id = auth.uid() and publica and compartida and id <> p_id) >= 30 then
    raise exception 'Caben 30 partidas publicadas por persona: quita alguna antes.' using errcode = 'P0001';
  end if;
  update public.replays
     set publica = true, compartida = true, arquetipos = v_ids[1:2], publicada_at = coalesce(publicada_at, now())
   where id = p_id;
  return true;
end;
$$;

-- La lista de un mazo: las publicadas (y compartidas) de ese arquetipo, de
-- la más nueva a la más vieja. Sin el registro: para la lista basta el
-- resumen, y el registro se abre con su enlace.
create or replace function public.repeticiones_publicas(p_arquetipo text, p_limite int default 12)
returns table (id text, titulo text, jugador_a text, jugador_b text, ganador text, turnos int, mazo_a text, mazo_b text, publicada_at timestamptz, autor text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.titulo, r.jugador_a, r.jugador_b, r.ganador, r.turnos, r.mazo_a, r.mazo_b, r.publicada_at,
         coalesce(p.display_name, p.username)
  from public.replays r
  left join public.user_profiles p on p.id = r.user_id
  where r.publica and r.compartida and r.arquetipos @> array[p_arquetipo]
  order by r.publicada_at desc nulls last
  limit least(greatest(coalesce(p_limite, 12), 1), 50)
$$;

revoke all on function public.repeticiones_publicar(text, boolean, text[]) from public, anon;
grant execute on function public.repeticiones_publicar(text, boolean, text[]) to authenticated;
revoke all on function public.repeticiones_publicas(text, int) from public;
grant execute on function public.repeticiones_publicas(text, int) to anon, authenticated;

commit;
