-- ============================================================
-- Tanda 1124 — Diez niveles de XP
--
-- PINGU: «el de coleccionista no me cuadra» y «puede haber más niveles»:
-- con los retos se ganan hasta ~210 XP al día y con cinco niveles el
-- tercero llegaba en días. Los nuevos (los mismos de js/niveles.js):
--
--     Novato          0      Experto      3.500
--     Aprendiz      150      As           6.000
--     Entrenador    400      Alto Mando  10.000
--     Rival         900      Campeón     16.000
--     Veterano    1.800      Maestro     25.000
--
-- 1. `nivel_de_xp` con la tabla nueva: es la que usa la base al sumar XP.
-- 2. Recalcula `user_profiles.level` de todo el mundo (PINGU eligió
--    recalcular): nadie pierde XP, solo cambia el nombre que le toca. Quien
--    era «Maestro» con 8.000 pasa a «As» o «Alto Mando».
--
-- La guarda del perfil no estorba: solo actúa para `authenticated` y `anon`,
-- y el SQL Editor va como `postgres`. Idempotente.
-- ============================================================

create or replace function public.nivel_de_xp(p_xp int)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_xp, 0) >= 25000 then 'Maestro'
    when coalesce(p_xp, 0) >= 16000 then 'Campeón'
    when coalesce(p_xp, 0) >= 10000 then 'Alto Mando'
    when coalesce(p_xp, 0) >= 6000  then 'As'
    when coalesce(p_xp, 0) >= 3500  then 'Experto'
    when coalesce(p_xp, 0) >= 1800  then 'Veterano'
    when coalesce(p_xp, 0) >= 900   then 'Rival'
    when coalesce(p_xp, 0) >= 400   then 'Entrenador'
    when coalesce(p_xp, 0) >= 150   then 'Aprendiz'
    else 'Novato'
  end;
$$;

update public.user_profiles
   set level = public.nivel_de_xp(total_xp)
 where level is distinct from public.nivel_de_xp(total_xp);

notify pgrst, 'reload schema';
