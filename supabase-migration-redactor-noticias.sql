-- Un rol para escribir noticias, y solo noticias (tanda 803).
--
-- PINGU: «un rol para una persona que quiero darle permisos pero solo
-- para escribir las noticias». Es el mismo corte que el organizador de
-- torneos (tanda 295): manda en UNA cosa y en nada más. Ni panel de
-- administración, ni guías ajenas, ni foro, ni usuarios.
--
-- Qué puede quien lo tiene (`is_news_writer`):
--   · marcar un artículo SUYO como noticia (hasta hoy, solo admin);
--   · PUBLICAR su noticia él mismo, sin pasar por la cola de revisión —
--     una noticia que espera a que alguien la apruebe llega tarde;
--   · corregir sus noticias publicadas (eso ya lo podía todo autor).
-- Qué NO puede:
--   · publicarse una GUÍA sin revisión: sus guías van a la cola igual
--     que las de cualquiera;
--   · convertir una noticia publicada en guía (sería una guía que se ha
--     saltado la revisión);
--   · tocar artículos de otros, ni borrar los suyos publicados;
--   · darse el rol: lo reparte el admin desde /admin → Usuarios.
--
-- Todo va en la BASE, en los dos disparadores que ya guardaban esto. Un
-- `if` en el navegador no protegería nada.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera. Cada
-- sentencia se sostiene sola (sin tablas temporales).

alter table public.user_profiles
  add column if not exists is_news_writer boolean not null default false;

comment on column public.user_profiles.is_news_writer is
  'Redacta noticias: puede marcar sus artículos como noticia y publicarlos sin revisión. Nada más: ni el panel, ni las guías de otros.';

-- ── Quién puede escribir noticias ──
create or replace function public.soy_redactor_de_noticias()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_news_writer, false))
  )
$$;

-- ── 1. Marcar como noticia ──
--
-- Sustituye a la de supabase-migration-noticias-arreglo.sql. Lo nuevo:
-- el redactor también puede, y una noticia ya publicada no vuelve a guía
-- por mano de nadie que no sea admin.
create or replace function public.guides_solo_admin_publica_noticias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_redactor boolean;
begin
  -- Nada que vigilar si no se está tocando el tipo.
  if tg_op = 'UPDATE' and new.kind is not distinct from old.kind then
    return new;
  end if;
  -- Sin sesión es el SQL Editor o una función con la clave de servicio:
  -- un humano del equipo. Antes esto devolvía la fila a guía también ahí.
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(p.is_admin, false), coalesce(p.is_news_writer, false)
    into v_admin, v_redactor
  from public.user_profiles p
  where p.id = auth.uid();

  if coalesce(v_admin, false) then
    return new;
  end if;

  -- Una noticia PUBLICADA que pasara a guía sería una guía publicada sin
  -- revisión. Se queda noticia.
  if tg_op = 'UPDATE' and old.kind = 'news' and old.review_status = 'approved' then
    new.kind := old.kind;
    return new;
  end if;

  if new.kind = 'guide' or coalesce(v_redactor, false) then
    return new;
  end if;

  -- Quien no es del equipo no convierte nada en noticia: se queda como
  -- estaba (o como guía, si la está creando).
  new.kind := case when tg_op = 'UPDATE' then old.kind else 'guide' end;
  return new;
end $$;

drop trigger if exists guides_solo_admin_publica_noticias on public.guides;
create trigger guides_solo_admin_publica_noticias
  before insert or update on public.guides
  for each row execute function public.guides_solo_admin_publica_noticias();

-- ── 2. Publicar la noticia sin revisión ──
--
-- Sustituye a la de supabase-migration-editar-publicada.sql (mismo
-- cuerpo, más el caso del redactor). La política `guides_author_update`
-- ya admite `approved` en el `with check`; quien cerraba la puerta era
-- este disparador, y aquí se abre SOLO para una noticia de un redactor.
--
-- Este disparador corre ANTES que el de arriba (van por orden
-- alfabético: «guides_guardar…» < «guides_solo…»), así que mira el
-- `kind` que manda el cliente: si no es redactor y manda noticia +
-- publicada, se lleva el error de siempre.
create or replace function public.guardar_lo_que_no_es_del_autor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.review_status = 'approved'
     and old.review_status is distinct from 'approved'
     and new.kind = 'news'
     and public.soy_redactor_de_noticias() then
    -- La fecha de publicación la pone la base, no el cliente: es la que
    -- ordena /noticias y la que dispara el aviso de Telegram.
    new.published_at := coalesce(old.published_at, now());
    new.xp_reward := old.xp_reward;
    new.guide_rarity := old.guide_rarity;
    new.is_pro := old.is_pro;
    return new;
  end if;

  -- Lo que el autor sí puede: mover su guía entre borrador y revisión,
  -- en los dos sentidos (mandarla y retirarla). Lo que no: publicarla,
  -- rechazarla, o tocar el estado de una que ya está publicada.
  if new.review_status is distinct from old.review_status
     and not (
       old.review_status in ('draft', 'rejected', 'pending')
       and new.review_status in ('draft', 'pending')
     ) then
    raise exception 'No puedes cambiar el estado de revisión de esta guía'
      using errcode = 'check_violation';
  end if;

  new.published_at := old.published_at;
  new.xp_reward := old.xp_reward;
  new.guide_rarity := old.guide_rarity;
  new.is_pro := old.is_pro;
  return new;
end;
$$;

revoke all on function public.guardar_lo_que_no_es_del_autor() from public, anon, authenticated;

drop trigger if exists guides_guardar_lo_del_equipo on public.guides;
create trigger guides_guardar_lo_del_equipo
  before update on public.guides
  for each row
  execute function public.guardar_lo_que_no_es_del_autor();

-- ── 3. Que nadie se dé el rol a sí mismo ──
--
-- Sustituye a la de supabase-migration-torneos-organizadores.sql: las
-- mismas columnas de mando, más la nueva.
create or replace function public.solo_admin_da_titulos()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.forum_title := old.forum_title;
    new.is_moderator := old.is_moderator;
    new.is_admin := old.is_admin;
    new.is_tournament_admin := coalesce(old.is_tournament_admin, false);
    new.is_news_writer := coalesce(old.is_news_writer, false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solo_admin_da_titulos on public.user_profiles;
create trigger trg_solo_admin_da_titulos
  before update on public.user_profiles
  for each row execute function public.solo_admin_da_titulos();

-- ── 4. El hilo del foro de su noticia ──
--
-- Al publicar, la web abre sola el hilo de la noticia en el foro
-- «Noticias» (js/noticias-foro.js), y ese foro es `post_policy = 'staff'`:
-- sin esto, el hilo no se abriría —sin error a la vista: la función se lo
-- calla para no asustar después de guardar—. Sustituye a la política de
-- supabase-migration-foro-titulos.sql con UNA rama más: el redactor abre
-- temas en ese foro y en ningún otro.
drop policy if exists "forum_threads_insert" on public.forum_threads;
create policy "forum_threads_insert" on public.forum_threads
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
    and not public.is_muted()
    and (
      public.is_staff()
      or exists (
        select 1 from public.forum_boards b
         where b.id = board_id and b.post_policy = 'todos' and not b.is_hidden
      )
      or (
        public.soy_redactor_de_noticias()
        and exists (
          select 1 from public.forum_boards b
           where b.id = board_id and b.slug = 'noticias'
        )
      )
    )
  );

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select username, is_admin, is_news_writer
--   from public.user_profiles
--  where is_admin or is_news_writer
--  order by is_admin desc, username;
