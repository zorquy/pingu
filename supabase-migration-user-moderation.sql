-- ============================================================
-- Migración: banear (bloquea la sesión entera) y silenciar (puede
-- seguir navegando pero no publicar nada nuevo) usuarios desde el
-- panel de admin.
--
-- Cada bloque de política comprueba antes con to_regclass() que la
-- tabla existe de verdad en tu base, para que si alguna migración
-- anterior (p.ej. guide-comments, guide-reviews o private-messages)
-- todavía no se ha aplicado, este script no falle entero por eso —
-- simplemente se salta esa tabla en concreto y sigue con el resto.
-- ============================================================

alter table user_profiles add column if not exists is_banned boolean not null default false;
alter table user_profiles add column if not exists is_muted boolean not null default false;

-- Funciones auxiliares SECURITY DEFINER (como is_admin()), para no
-- repetir la subconsulta en cada policy.
create or replace function public.is_banned()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_banned from user_profiles where id = auth.uid()), false);
$$;

create or replace function public.is_muted()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_muted from user_profiles where id = auth.uid()), false);
$$;

-- Un usuario baneado o silenciado no puede crear guías, comentarios,
-- reseñas ni mensajes nuevos. La lectura no se toca aquí: un
-- silenciado sigue viendo todo con normalidad; un baneado, en la
-- práctica, tampoco llega a ver nada porque el cliente le cierra la
-- sesión en cuanto detecta is_banned = true (ver js/app.js), pero eso
-- es un cierre de sesión del lado del cliente, no algo que impongan
-- estas políticas de RLS.

do $$
begin
  if to_regclass('public.guides') is not null then
    drop policy if exists "guides_author_insert" on guides;
    create policy "guides_author_insert" on guides
      for insert
      with check (auth.uid() = author_id and review_status in ('draft', 'pending') and not is_banned() and not is_muted());
  end if;

  if to_regclass('public.profile_comments') is not null then
    drop policy if exists "profile_comments_insert" on profile_comments;
    create policy "profile_comments_insert" on profile_comments
      for insert with check (auth.uid() = author_id and not is_banned() and not is_muted());
  end if;

  if to_regclass('public.profile_reviews') is not null then
    drop policy if exists "profile_reviews_insert" on profile_reviews;
    create policy "profile_reviews_insert" on profile_reviews
      for insert with check (auth.uid() = reviewer_id and reviewer_id <> profile_id and not is_banned() and not is_muted());
  end if;

  if to_regclass('public.guide_comments') is not null then
    drop policy if exists "guide_comments_insert" on guide_comments;
    create policy "guide_comments_insert" on guide_comments
      for insert with check (auth.uid() = author_id and not is_banned() and not is_muted());
  end if;

  if to_regclass('public.guide_reviews') is not null then
    drop policy if exists "guide_reviews_insert" on guide_reviews;
    create policy "guide_reviews_insert" on guide_reviews
      for insert with check (auth.uid() = reviewer_id and not is_banned() and not is_muted());
  end if;

  if to_regclass('public.private_messages') is not null then
    drop policy if exists private_messages_insert on public.private_messages;
    create policy private_messages_insert on public.private_messages
      for insert to authenticated with check (
        sender_id = auth.uid() and public.is_conversation_participant(conversation_id) and not is_banned() and not is_muted()
      );
  end if;
end $$;

-- Si alguno de los bloques de arriba se saltó, comprueba qué tablas te
-- faltan de verdad ejecutando esto:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('guides', 'profile_comments', 'profile_reviews', 'guide_comments', 'guide_reviews', 'private_messages');
--
-- y aplica la migración correspondiente de las que falten antes de
-- volver a correr este script (no hace daño volver a ejecutarlo, es
-- idempotente).
