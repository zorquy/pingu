-- ════════════════════════════════════════════════════════════════════
-- ARREGLO de supabase-migration-noticias.sql (tanda 274)
--
-- EL FALLO: el disparador que impide que alguien de fuera del equipo
-- publique una noticia buscaba quién eres en `public.profiles`. En esta
-- base esa tabla NO EXISTE — se llama `public.user_profiles`, que es lo
-- que usan todas las demás migraciones de la casa.
--
-- CÓMO SE NOTA: al guardar un artículo marcado como «Noticia»,
--     No se pudo guardar la guía: relation "public.profiles" does not exist
-- Las guías normales no se enteran: el disparador se sale antes de
-- llegar a la consulta cuando `kind` es 'guide' o no cambia. O sea que
-- lo único roto era publicar noticias, que es justo lo que se iba a
-- estrenar.
--
-- Esto solo vuelve a crear la función, bien. No toca datos ni el resto
-- de la migración, que estaba correcta. Ejecutar en el SQL Editor.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.guides_solo_admin_publica_noticias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  soy_admin boolean;
begin
  -- Nada que vigilar si no se está tocando el tipo.
  if tg_op = 'UPDATE' and new.kind is not distinct from old.kind then
    return new;
  end if;
  if new.kind = 'guide' then
    return new;
  end if;

  -- `user_profiles`, que es como se llama aquí. Era el fallo.
  select coalesce(p.is_admin, false) into soy_admin
  from public.user_profiles p
  where p.id = auth.uid();

  if coalesce(soy_admin, false) then
    return new;
  end if;

  -- Quien no es del equipo no convierte nada en noticia: se queda como
  -- estaba (o como guía, si la está creando).
  new.kind := case when tg_op = 'UPDATE' then old.kind else 'guide' end;
  return new;
end $$;

-- El disparador ya está puesto de la migración anterior y apunta a esta
-- función, así que con volver a crearla basta. Se vuelve a declarar de
-- todas formas por si esto se ejecuta en una base donde no llegó a
-- crearse.
drop trigger if exists guides_solo_admin_publica_noticias on public.guides;
create trigger guides_solo_admin_publica_noticias
  before insert or update on public.guides
  for each row execute function public.guides_solo_admin_publica_noticias();

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que salir `user_profiles` y NO `profiles`.
select p.proname as funcion,
       case when pg_get_functiondef(p.oid) like '%user_profiles%' then 'bien: user_profiles'
            else 'MAL: sigue apuntando a otra tabla' end as estado
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'guides_solo_admin_publica_noticias';
