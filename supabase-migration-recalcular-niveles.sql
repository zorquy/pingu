-- ============================================================
-- Recalcula user_profiles.level con los umbrales de XP nuevos.
--
-- Los anteriores se alcanzaban demasiado rápido: alguien recién
-- registrado llegaba a "Experto" con hacerse el contenido una vez.
-- Los nuevos son:
--
--     Novato          0
--     Entrenador    250
--     Coleccionista 1.000
--     Experto       3.000
--     Maestro       8.000
--
-- `user_profiles.level` es una columna guardada que la app solo
-- reescribe cuando alguien gana XP, así que sin esto los perfiles
-- existentes se quedarían con el nivel viejo hasta su próximo XP.
--
-- La web ya no depende de esta columna para pintar el nivel (lo
-- calcula desde total_xp), así que esto es para que el dato de la
-- base no se contradiga con lo que se ve.
--
-- Solo toca la columna `level`. No cambia el XP de nadie.
-- Es idempotente: se puede ejecutar las veces que haga falta.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- ANTES: cómo quedaría cada usuario (solo lee, no cambia nada)
-- ────────────────────────────────────────────────────────────
select
  coalesce(display_name, username, '(sin nombre)') as usuario,
  total_xp,
  level as nivel_actual,
  case
    when coalesce(total_xp, 0) >= 8000 then 'Maestro'
    when coalesce(total_xp, 0) >= 3000 then 'Experto'
    when coalesce(total_xp, 0) >= 1000 then 'Coleccionista'
    when coalesce(total_xp, 0) >= 250  then 'Entrenador'
    else 'Novato'
  end as nivel_nuevo
from user_profiles
order by total_xp desc nulls last;


-- ────────────────────────────────────────────────────────────
-- LA ACTUALIZACIÓN
-- ────────────────────────────────────────────────────────────
update user_profiles
set level = case
  when coalesce(total_xp, 0) >= 8000 then 'Maestro'
  when coalesce(total_xp, 0) >= 3000 then 'Experto'
  when coalesce(total_xp, 0) >= 1000 then 'Coleccionista'
  when coalesce(total_xp, 0) >= 250  then 'Entrenador'
  else 'Novato'
end
where level is distinct from (case
  when coalesce(total_xp, 0) >= 8000 then 'Maestro'
  when coalesce(total_xp, 0) >= 3000 then 'Experto'
  when coalesce(total_xp, 0) >= 1000 then 'Coleccionista'
  when coalesce(total_xp, 0) >= 250  then 'Entrenador'
  else 'Novato'
end);


-- ────────────────────────────────────────────────────────────
-- DESPUÉS: reparto por nivel
-- ────────────────────────────────────────────────────────────
select level as nivel, count(*) as usuarios, min(total_xp) as xp_min, max(total_xp) as xp_max
from user_profiles
group by level
order by min(total_xp);
