-- ═══════════════════════════════════════════════════════════════════
-- EDITAR UN TORNEO APUNTADO SIN DEJAR SUS RONDAS ATRÁS (tanda 251)
--
-- PINGU: «debería poder editar cada ronda e incluso mi mazo, por si no
-- lo he puesto bien».
--
-- ── EL PROBLEMA, QUE NO SE VE ──
--
-- El mazo del torneo va DENORMALIZADO en cada ronda: al guardar una
-- ronda se le copia `mi_mazo` del torneo (ver la migración
-- partidas-torneos). Eso está bien y tiene su motivo — `match_log` exige
-- `mi_mazo` y las filas viejas no tienen torneo del que heredarlo.
--
-- Pero convierte «cambiar el mazo del torneo» en dos escrituras, y si
-- solo se hace la primera el histórico queda mintiendo: la tarjeta dice
-- que jugaste Gardevoir y la matriz de enfrentamientos sigue contando
-- esas seis rondas como Dragapult. Y no avisa nadie.
--
-- ── POR QUÉ UN DISPARADOR Y NO DOS UPDATE DESDE EL CLIENTE ──
--
-- Porque un disparador no se puede olvidar. Desde el navegador serían
-- dos peticiones que pueden fallar por separado y dejar el histórico a
-- medias; aquí las dos cosas pasan en la misma transacción o no pasa
-- ninguna. La consistencia deja de depender de que quien escriba el
-- próximo formulario se acuerde.
--
-- Arrastra las CUATRO cosas que la ronda copia del torneo: el mazo (y su
-- nombre), el nombre del torneo —que en la ronda vive en `donde`— y la
-- fecha.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

create or replace function public.match_log_torneo_arrastra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Solo si algo de lo copiado ha cambiado de verdad: un update que
  -- toca las notas no tiene por qué reescribir todas las rondas.
  -- `is distinct from` y no `<>` porque estas columnas admiten NULL y
  -- `null <> null` no es cierto, es desconocido: con `<>` un cambio
  -- desde o hacia NULL se colaría sin arrastrar nada.
  if new.mi_mazo is distinct from old.mi_mazo
     or new.mi_mazo_nombre is distinct from old.mi_mazo_nombre
     or new.nombre is distinct from old.nombre
     or new.jugado_el is distinct from old.jugado_el then
    update match_log
       set mi_mazo = new.mi_mazo,
           mi_mazo_nombre = new.mi_mazo_nombre,
           donde = new.nombre,
           jugada_el = new.jugado_el
     where torneo_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists match_log_torneo_arrastra on public.match_log_torneos;
create trigger match_log_torneo_arrastra
  after update on public.match_log_torneos
  for each row execute function public.match_log_torneo_arrastra();

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que salir una fila con el disparador puesto.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.match_log_torneos'::regclass
   and not tgisinternal;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
notify pgrst, 'reload schema';
