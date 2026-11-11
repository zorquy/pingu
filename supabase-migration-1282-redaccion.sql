-- Tanda 1282 — el rol de REDACCIÓN: guías y noticias sin revisión.
--
-- PINGU: «hemos conseguido un colaborador… sus guías en PokeDoc no hace falta
-- que vayan a revisión… diferéncialo con el redactor de noticias: tiene que
-- haber otro rol distinto que valga para los dos». Eligió lo recomendado de
-- la propuesta: se llama «Redacción», su firma lleva la chapa y sus artículos
-- pueden llevar la caja «También en…» con el enlace a su web.
--
-- Qué puede quien lo tiene (`is_writer`):
--   · todo lo de «Redacción de noticias» (`is_news_writer`, la 803);
--   · y además PUBLICAR SUS GUÍAS sin pasar por la cola;
--   · poner en lo suyo «Publicado también en» (nombre y dirección).
-- Qué NO puede: el panel, el foro, lo de otros, borrar lo suyo publicado ni
-- darse el rol. Todo en la BASE: un `if` en el navegador no protege nada.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera. Cada
-- sentencia se sostiene sola (sin tablas temporales, la 631).

-- ── 1. La columna del rol ──
alter table public.user_profiles
  add column if not exists is_writer boolean not null default false;

comment on column public.user_profiles.is_writer is
  'Redacción: publica guías y noticias suyas sin revisión. Nada más: ni el panel, ni el foro, ni lo de otros.';

-- ── 2. Quién redacta ──
-- `soy_redactor()`: guías y noticias. `soy_redactor_de_noticias()` (803)
-- sigue siendo la de las noticias y ahora también cuenta a Redacción.
create or replace function public.soy_redactor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_writer, false))
  )
$$;

create or replace function public.soy_redactor_de_noticias()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_news_writer, false) or coalesce(p.is_writer, false))
  )
$$;

-- ── 3. Marcar como noticia ──
-- La de la 803, con Redacción contado como redactor.
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
  if tg_op = 'UPDATE' and new.kind is not distinct from old.kind then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(p.is_admin, false), coalesce(p.is_news_writer, false) or coalesce(p.is_writer, false)
    into v_admin, v_redactor
  from public.user_profiles p
  where p.id = auth.uid();

  if coalesce(v_admin, false) then
    return new;
  end if;

  -- Una noticia PUBLICADA que pasara a guía sería una guía publicada sin
  -- revisión. Se queda noticia (también para Redacción: lo suyo se corrige,
  -- no se cambia de sección).
  if tg_op = 'UPDATE' and old.kind = 'news' and old.review_status = 'approved' then
    new.kind := old.kind;
    return new;
  end if;

  if new.kind = 'guide' or coalesce(v_redactor, false) then
    return new;
  end if;

  new.kind := case when tg_op = 'UPDATE' then old.kind else 'guide' end;
  return new;
end $$;

drop trigger if exists guides_solo_admin_publica_noticias on public.guides;
create trigger guides_solo_admin_publica_noticias
  before insert or update on public.guides
  for each row execute function public.guides_solo_admin_publica_noticias();

-- ── 4. Publicar sin revisión ──
-- La de la 803 con una rama más: Redacción publica también una GUÍA suya.
-- Corre antes que la de arriba (orden alfabético) y mira el `kind` que manda
-- el cliente.
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
     and ((new.kind = 'news' and public.soy_redactor_de_noticias()) or public.soy_redactor()) then
    -- La fecha de publicación la pone la base, no el cliente: es la que
    -- ordena /noticias y /aprender y la que dispara el aviso de Telegram.
    new.published_at := coalesce(old.published_at, now());
    new.xp_reward := old.xp_reward;
    new.guide_rarity := old.guide_rarity;
    new.is_pro := old.is_pro;
    return new;
  end if;

  -- Lo que el autor sí puede: mover su guía entre borrador y revisión, en
  -- los dos sentidos. Lo que no: publicarla, rechazarla, o tocar el estado
  -- de una que ya está publicada.
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

-- ── 5. Que nadie se dé el rol a sí mismo ──
-- La de la 803 con la columna nueva.
create or replace function public.solo_admin_da_titulos()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.forum_title := old.forum_title;
    new.is_moderator := old.is_moderator;
    new.is_admin := old.is_admin;
    new.is_tournament_admin := coalesce(old.is_tournament_admin, false);
    new.is_news_writer := coalesce(old.is_news_writer, false);
    new.is_writer := coalesce(old.is_writer, false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solo_admin_da_titulos on public.user_profiles;
create trigger trg_solo_admin_da_titulos
  before update on public.user_profiles
  for each row execute function public.solo_admin_da_titulos();

-- Y una fila NUEVA tampoco nace con él: la de la 805 con la columna nueva.
create or replace function public.perfil_guarda_columnas()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.is_moderator := false;
    new.is_tournament_admin := false;
    new.is_news_writer := false;
    new.is_writer := false;
    new.is_banned := false;
    new.is_muted := false;
    new.is_pro := false;
    new.forum_title := null;
    new.forum_title_color := null;
    new.total_xp := 0;
    new.level := public.nivel_de_xp(0);
    if not public.url_de_imagen_segura(new.avatar_url) then new.avatar_url := null; end if;
    if not public.url_de_imagen_segura(new.banner_url) then new.banner_url := null; end if;
    return new;
  end if;

  new.is_banned := old.is_banned;
  new.is_muted := old.is_muted;
  new.is_pro := old.is_pro;
  new.forum_title_color := old.forum_title_color;
  new.total_xp := old.total_xp;
  new.level := old.level;
  if new.avatar_url is distinct from old.avatar_url and not public.url_de_imagen_segura(new.avatar_url) then
    new.avatar_url := old.avatar_url;
  end if;
  if new.banner_url is distinct from old.banner_url and not public.url_de_imagen_segura(new.banner_url) then
    new.banner_url := old.banner_url;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfil_guarda_columnas on public.user_profiles;
create trigger trg_perfil_guarda_columnas
  before insert or update on public.user_profiles
  for each row execute function public.perfil_guarda_columnas();

-- ── 6. «También en…» ──
-- La caja del final del artículo con el enlace a la web de quien lo escribe
-- (PINGU: «va a relacionar desde su web al artículo de PokeDoc y desde PokeDoc
-- al de su web»). Solo lo pone Redacción (o el equipo): en la guía de
-- cualquiera sería un enlace de propaganda en una página nuestra.
alter table public.guides add column if not exists tambien_en_url text;
alter table public.guides add column if not exists tambien_en_nombre text;

create or replace function public.guides_tambien_en()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is not null and not public.soy_redactor() then
    if tg_op = 'INSERT' then
      new.tambien_en_url := null;
      new.tambien_en_nombre := null;
    else
      new.tambien_en_url := old.tambien_en_url;
      new.tambien_en_nombre := old.tambien_en_nombre;
    end if;
  end if;
  -- Una dirección que se pinta en un enlace: https y sin nada raro.
  new.tambien_en_url := nullif(btrim(coalesce(new.tambien_en_url, '')), '');
  if new.tambien_en_url is not null and new.tambien_en_url !~ '^https://[^[:space:]"''<>\\`]+$' then
    new.tambien_en_url := null;
  end if;
  new.tambien_en_nombre := nullif(left(btrim(coalesce(new.tambien_en_nombre, '')), 40), '');
  if new.tambien_en_url is null then
    new.tambien_en_nombre := null;
  end if;
  return new;
end $$;

drop trigger if exists guides_tambien_en on public.guides;
create trigger guides_tambien_en
  before insert or update on public.guides
  for each row execute function public.guides_tambien_en();

-- ── 7. El correo de «la hemos aprobado», solo si la aprobó otro ──
-- La de la tanda 350 (supabase-migration-correo-enlaces.sql) con una
-- condición más: quien se publica lo suyo no recibe «Hemos aprobado…».
create or replace function public.on_guide_review_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor text;
  v_titulo text;
  v_admin record;
  v_motivo text;
begin
  if tg_op = 'UPDATE' and new.review_status is not distinct from old.review_status then
    return new;
  end if;

  v_titulo := coalesce(email_preview(new.title, 70), 'Sin título');

  if new.review_status = 'pending' and new.author_id is not null then
    select coalesce(email_preview(display_name, 60), email_preview(username, 60), 'Alguien')
      into v_autor
      from user_profiles where id = new.author_id;
    v_autor := coalesce(v_autor, 'Alguien');

    for v_admin in select id from user_profiles where is_admin = true loop
      continue when v_admin.id = new.author_id;

      insert into user_notifications (recipient_id, type, title, body, link)
      values (
        v_admin.id,
        'guide_submitted',
        'Guía nueva para revisar',
        v_autor || ' ha enviado «' || v_titulo || '»',
        '/admin/'
      );

      perform enqueue_email(
        v_admin.id,
        'guide_submitted',
        'Guía nueva para revisar en PokeDoc',
        v_autor || ' ha enviado a revisión «' || v_titulo || '».',
        '/admin/',
        'guiarev:' || new.id::text
      );
    end loop;
    return new;
  end if;

  if new.author_id is null then
    return new;
  end if;

  if new.review_status = 'approved' then
    -- La ha publicado su autor (Redacción): no hay nadie que la haya aprobado.
    if auth.uid() is not null and auth.uid() = new.author_id then
      return new;
    end if;
    perform enqueue_email(
      new.author_id,
      'guide_approved',
      'Tu guía ya está publicada en PokeDoc',
      'Hemos aprobado «' || v_titulo || '». Ya la puede leer todo el mundo.',
      '/guia.html?slug=' || coalesce(new.slug, ''),
      'guiaest:' || new.id::text
    );
  elsif new.review_status = 'rejected' then
    v_motivo := coalesce(email_preview(new.rejection_reason, 200), '');
    perform enqueue_email(
      new.author_id,
      'guide_rejected',
      'Tu guía necesita unos cambios',
      case when v_motivo = '' then 'Ábrela en el editor para ver qué falta.'
           else 'Motivo: ' || v_motivo end,
      '/editor-guia.html?id=' || new.id::text,
      'guiaest:' || new.id::text
    );
  end if;

  return new;
end $$;

-- ── 8. La cuenta de guías de cada tema ──
-- El panel la recalcula al aprobar (`recalcCategoryGuideCount`), pero
-- `categories` no la puede escribir quien no es del equipo: una guía que
-- publica Redacción no sumaría en /aprender. La cuenta la lleva la base.
create or replace function public.guides_cuenta_del_tema()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando cambia lo que cuenta. Va sin `update of …` a propósito: la
  -- fecha la pone un disparador ANTES (al publicar), y `update of` solo mira
  -- las columnas que trae la sentencia — con él, publicar no sumaba.
  if tg_op = 'UPDATE' and new.published_at is not distinct from old.published_at
     and new.category_id is not distinct from old.category_id then
    return null;
  end if;
  -- En un INSERT `old` es NULL y en un DELETE lo es `new` (PostgreSQL 11+),
  -- así que una sola sentencia sirve para los tres casos.
  update public.categories c
     set guide_count = (select count(*) from public.guides g where g.category_id = c.id and g.published_at is not null)
   where c.id = old.category_id or c.id = new.category_id;
  return null;
end $$;

revoke all on function public.guides_cuenta_del_tema() from public, anon, authenticated;

drop trigger if exists guides_cuenta_del_tema on public.guides;
create trigger guides_cuenta_del_tema
  after insert or delete or update on public.guides
  for each row execute function public.guides_cuenta_del_tema();

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Para darle el rol a alguien (también se puede desde /admin → Usuarios):
--   update public.user_profiles set is_writer = true where username = 'deckmasters';
-- ------------------------------------------------------------
