-- ════════════════════════════════════════════════════════════════════
-- Tanda 337 — el check-in de una mesa que sigue viva
-- ════════════════════════════════════════════════════════════════════
--
-- EL FALLO, reportado en un torneo de verdad: sin que hubieran pasado
-- los 5 minutos de check-in, una mesa no dejaba marcarse listo y
-- soltaba «Esta mesa ya no admite check-in.»
--
-- Lo que pasaba, paso a paso:
--
--   1. El rival reporta su resultado antes de que tú hayas hecho
--      check-in. Eso deja la mesa en `awaiting_confirmation`.
--   2. Tú sigues viendo el botón de «Hacer check-in», porque el cliente
--      lo pinta mirando solo si TÚ ya estás listo, no en qué estado
--      está la mesa.
--   3. Lo pulsas, y `torneos_checkin` solo admitía `pending` y
--      `active`: te suelta un error que habla de una ventana de tiempo
--      que ni siquiera se ha cerrado.
--
-- El mensaje mentía dos veces: ni era «ya», ni tenía nada que ver con
-- el check-in que estabas mirando.
--
-- ── Por qué se arregla ABRIENDO, y solo en el servidor ──
--
-- La tentación es quitar el botón y ya. Pero el check-in es un registro
-- de PRESENCIA, y si tu rival acaba de reportar es que estabas en la
-- mesa: negarte apuntarlo es lo contrario de lo que dice la realidad. Y
-- a quien resuelva una disputa le va a hacer falta saber que los dos
-- estaban.
--
-- El cliente NO se toca, y eso costó verlo: «Tu partida» ya tiene una
-- pantalla propia para cada estado cerrado (`TERMINALES` en
-- js/torneos/ronda.js) y para `pending` y `disputed`, así que el botón
-- solo llega a pintarse en `active` y `awaiting_confirmation`. El
-- primer intento de arreglo le añadió una guarda más, que no habría
-- cambiado ni un píxel. El desajuste estaba entero en la función.
--
-- Y no reabre ninguna puerta: el barredor que da la ronda por perdida
-- a quien no aparece **solo mira las mesas en `active`**, así que un
-- check-in tardío en una mesa que ya está esperando confirmación no
-- cambia ningún resultado. Solo deja constancia.
--
-- Ejecutar en el SQL Editor de Supabase. Sustituye la función; no toca
-- ninguna tabla ni ningún dato.

create or replace function public.torneos_checkin(p_partida uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_m tournament_matches%rowtype;
begin
  select * into v_m from tournament_matches where id = p_partida;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  if auth.uid() not in (v_m.player_a_id, v_m.player_b_id) then
    raise exception 'Solo los jugadores de la mesa se marcan listos.';
  end if;
  -- Mientras la mesa siga viva. `awaiting_confirmation` es el estado del
  -- fallo; `disputed` entra por la misma razón —hay gente sentada y un
  -- juez mirando— aunque hoy el cliente no ofrezca el botón ahí.
  --
  -- Lo que vigila la prueba NO es que esta lista y el cliente sean
  -- iguales, sino lo único que importa: que **todo estado en el que la
  -- pantalla pinta el botón esté aquí dentro**. Copiar la lista en
  -- JavaScript habría sido una copia más que mantener; esto se mide
  -- abriendo la página en los nueve estados.
  if v_m.status not in ('pending', 'active', 'awaiting_confirmation', 'disputed') then
    raise exception 'Esta mesa ya está cerrada: no se puede hacer check-in.';
  end if;

  if auth.uid() = v_m.player_a_id then
    update tournament_matches set check_in_a_at = coalesce(check_in_a_at, now()) where id = p_partida;
  else
    update tournament_matches set check_in_b_at = coalesce(check_in_b_at, now()) where id = p_partida;
  end if;
  return true;
end $$;
