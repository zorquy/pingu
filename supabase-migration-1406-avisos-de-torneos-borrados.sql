-- ═══════════════════════════════════════════════════════════════════
-- Tanda 1406 — Los avisos de un torneo que ya no existe
-- ═══════════════════════════════════════════════════════════════════
--
-- Un torneo creado por error abrió inscripciones, el barredor mandó
-- «Inscripciones abiertas» a TODA la comunidad, y el torneo se borró. Los
-- avisos no: se quedaron sin leer, con el número puesto en Jugar y en
-- Torneos para todo el mundo, apuntando a una ficha que ya no existe.
--
-- Esta migración hace dos cosas:
--   1. Borra los avisos que ya están huérfanos: los que enlazan con
--      /torneo?slug=… de un torneo que no está en `tournaments`.
--   2. Desde ahora, al BORRAR un torneo se borran los avisos que enlazan con
--      su ficha, y al CANCELARLO, el anuncio de apertura (ya no hay nada a lo
--      que apuntarse). El aviso de «se ha cancelado» de un torneo que se borra
--      con gente dentro (223) enlaza con /torneos y no con la ficha: ese se
--      queda, que es justo el que tienen que leer.
--
-- La web ya da por leídos los huérfanos al entrar en Jugar, sin esperar a
-- esto, y el barredor espera 10 minutos antes de anunciar un torneo recién
-- creado; esto es la limpieza de verdad.
--
-- El slug sale del enlace igual que lo pone el barredor
-- (`/torneo?slug=<slug>`, con encodeURIComponent: los slugs son letras,
-- números y guiones, así que va tal cual). Con split_part y no con LIKE: un
-- guion bajo en un slug sería un comodín.
--
-- Se puede ejecutar entera en el SQL Editor, y repetirla no hace daño.

create or replace function public.slug_de_aviso_de_torneo(p_link text)
returns text
language sql
immutable
as $$
  select nullif(split_part(split_part(split_part(p_link, '/torneo?slug=', 2), '&', 1), '#', 1), '')
   where p_link like '%/torneo?slug=%'
$$;

-- 1. Los que ya están huérfanos.
delete from public.user_notifications n
 where n.link like '%/torneo?slug=%'
   and public.slug_de_aviso_de_torneo(n.link) is not null
   and not exists (select 1 from public.tournaments t where t.slug = public.slug_de_aviso_de_torneo(n.link));

-- 2. Desde ahora. SECURITY DEFINER: quien borra el torneo es su organizador,
--    y la RLS no le deja tocar los avisos de los demás.
create or replace function public.torneos_limpiar_avisos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.user_notifications
     where link like '%/torneo?slug=%'
       and public.slug_de_aviso_de_torneo(link) = old.slug;
    return old;
  end if;
  -- Cancelado: el anuncio de apertura sobra; los demás (el de «se ha
  -- cancelado», los de rondas ya jugadas) se quedan.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    delete from public.user_notifications
     where type = 'torneo_apertura'
       and link like '%/torneo?slug=%'
       and public.slug_de_aviso_de_torneo(link) = new.slug;
  end if;
  return new;
end;
$$;

revoke all on function public.torneos_limpiar_avisos() from public, anon, authenticated;

drop trigger if exists trg_torneos_limpiar_avisos_borrado on public.tournaments;
create trigger trg_torneos_limpiar_avisos_borrado
  after delete on public.tournaments
  for each row execute function public.torneos_limpiar_avisos();

drop trigger if exists trg_torneos_limpiar_avisos_cancelado on public.tournaments;
create trigger trg_torneos_limpiar_avisos_cancelado
  after update of status on public.tournaments
  for each row execute function public.torneos_limpiar_avisos();
