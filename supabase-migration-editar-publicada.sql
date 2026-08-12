-- El autor puede editar su guía ya publicada
-- ============================================================
--
-- Escribir una guía lleva días, y hasta ahora en cuanto se aprobaba se
-- cerraba con llave para siempre: su autor no podía corregir ni una
-- errata. Y tampoco podía sugerir una corrección, porque el formulario
-- de sugerencias se le esconde justamente al autor. Callejón sin salida:
-- el único camino era pedirle a alguien del equipo que lo arreglara.
--
-- Lo que cambia: el autor puede editar sus guías `approved`, además de
-- las `draft`, `rejected` y `pending` que ya podía. Los cambios se ven
-- en la web al momento, sin volver a pasar por revisión.
--
-- Necesita supabase-migration-editar-en-revision.sql, Y EN ESE ORDEN.
--
-- Las dos reescriben la MISMA política (`guides_author_update`), así que
-- manda la última que se ejecute. Ejecutar la anterior después de esta
-- —por repasar, por si acaso— vuelve a dejar la versión vieja y quita el
-- permiso que esta abre. El disparador de abajo se queda puesto, así que
-- no salta ningún error: simplemente el autor deja de poder editar su
-- guía publicada otra vez. Si pasa, se arregla volviendo a ejecutar
-- ESTE fichero.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- ── 1. La política ──
--
-- `using` mira la fila COMO ESTÁ (puede editarse), `with check` la mira
-- COMO QUEDA (puede guardarse así). Las dos tienen que admitir
-- `approved`: sin lo primero no deja empezar, y sin lo segundo la
-- rechaza al guardar.
drop policy if exists "guides_author_update" on guides;
create policy "guides_author_update" on guides
  for update
  using (
    auth.uid() = author_id
    and (
      review_status in ('draft', 'rejected')
      -- Una guía en revisión está a un clic de publicarse y una
      -- publicada ya la está leyendo la comunidad: en las dos, quien
      -- esté baneado o silenciado no sigue metiendo mano.
      or (review_status in ('pending', 'approved') and not is_banned() and not is_muted())
    )
  )
  with check (auth.uid() = author_id and review_status in ('draft', 'pending', 'approved'));

-- ── 2. Lo que esa apertura deja al descubierto ──
--
-- Y aquí está lo que hay que entender antes de tocar nada de esto:
-- meter `approved` en el `with check` ABRE UN AGUJERO por sí solo.
--
-- Una política de RLS no puede comparar la fila vieja con la nueva: el
-- `with check` sólo ve cómo QUEDA. Así que en cuanto admite `approved`,
-- el autor de un borrador puede mandar `review_status = 'approved'` y
-- **publicarse la guía él mismo**, saltándose la revisión entera. No es
-- una posibilidad teórica: es una llamada a la API.
--
-- Eso sólo se puede cerrar donde sí existen las dos versiones de la
-- fila, que es un disparador. Y ya puestos, el disparador clava también
-- los campos que decide el equipo y no el autor:
--
--   published_at .... es lo que hace pública la guía (lo mira
--                     `guides_select`). Sin clavarlo, un borrador con
--                     fecha puesta a mano se ve en la web.
--   xp_reward ....... con la guía ya aprobada, subírselo a mano es
--   guide_rarity .... repartir XP y rareza a placer.
--   is_pro
--
-- Quien revisa pasa de largo. Es `is_admin()` y NO `is_staff()` a
-- propósito: hoy las guías las lleva sólo la administración — la
-- política `guides_admin_all` es `for all using (is_admin())`, así que
-- un moderador no puede tocarlas ni con el disparador quitado. Poner
-- aquí `is_staff()` sugeriría un permiso que no existe.
--
-- Si algún día las guías pasan al equipo entero, hay que cambiar LAS
-- DOS cosas a la vez: aquella política y este `if`. Cambiar sólo la
-- política dejaría a los moderadores sin poder aprobar, y el error
-- saldría desde aquí.
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

-- Sin argumentos y `security definer`: PostgREST no expone las funciones
-- de disparador como RPC, pero el `revoke` se queda por costumbre — es
-- más barato ponerlo que acordarse de comprobarlo cada vez.
revoke all on function public.guardar_lo_que_no_es_del_autor() from public, anon, authenticated;

drop trigger if exists guides_guardar_lo_del_equipo on public.guides;
create trigger guides_guardar_lo_del_equipo
  before update on public.guides
  for each row
  execute function public.guardar_lo_que_no_es_del_autor();

-- El borrado NO se amplía. Una guía publicada la está leyendo gente, la
-- tienen guardada y puede estar enlazada desde fuera; que su autor la
-- haga desaparecer de un clic deja agujeros por todas partes. Para eso
-- se pide al equipo.

commit;
