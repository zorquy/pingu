-- Tanda 388 — sumar XP sin perderlo
--
-- `addXP` en js/gamification.js hace LEER, SUMAR, ESCRIBIR:
--
--     select total_xp        → 100
--     update total_xp = 105
--
-- Entre esas dos frases cabe otro premio, y el que llega tarde escribe
-- el total que leyó al principio: el de en medio **desaparece sin dejar
-- rastro**. Ya pasaba entre dos pestañas o entre la racha diaria y el
-- premio de un curso, pero eran 5 XP y no se notaba.
--
-- Desde la tanda 387 el otro que escribe es el SERVIDOR, repartiendo el
-- XP de un torneo. Ahí la cuenta sale así:
--
--     cliente lee 100 · el barredor reparte 150 (total 250) · cliente
--     escribe 105  →  150 XP perdidos, y nadie se enteró
--
-- La suma tiene que pasar DENTRO de la base, en una sola frase, que es
-- atómica por definición. `total_xp = total_xp + p_cuanto` no puede
-- perder nada por mucho que se solapen.
--
-- ── Y de paso arregla algo que estaba abierto ──
--
-- La función NO recibe a quién sumarle: se lo suma a `auth.uid()`. Antes
-- el cliente mandaba el id en el `update`, así que la única cosa entre
-- alguien y el XP de otra persona era la política de la tabla. Ahora el
-- id no es un parámetro y no hay nada que falsear.
--
-- (Lo que sigue en manos del cliente es CUÁNTO: eso ya era así y no lo
-- cambia esta migración. Para cerrarlo habría que mover cada premio al
-- servidor, que es otra tanda mucho más grande.)
--
-- Devuelve el total nuevo, que es lo que el cliente necesita para saber
-- si se ha cruzado un umbral: con el total nuevo y lo que acaba de sumar
-- sabe de dónde venía. Y es MÁS fiable que antes, porque antes el nivel
-- de partida salía de una lectura que podía estar vieja.
create or replace function public.xp_sumar(p_cuanto int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  if auth.uid() is null then
    raise exception 'hay que tener sesión para sumar XP';
  end if;
  -- Un premio no puede ser negativo ni absurdo: el cliente decide cuánto
  -- y esto es el techo de lo que se acepta sin preguntar. El premio más
  -- grande que reparte la web hoy son los 150 de ganar un torneo.
  if p_cuanto is null or p_cuanto <= 0 or p_cuanto > 500 then
    raise exception 'premio de XP fuera de rango: %', p_cuanto;
  end if;

  update public.user_profiles
     set total_xp = coalesce(total_xp, 0) + p_cuanto,
         -- El nivel, en el MISMO update (lección de la 387): `level` es
         -- una columna aparte, y subir el XP sin tocarla deja a alguien
         -- con 4.000 puntos y la chapa de Novato sin dar ningún error.
         level = public.nivel_de_xp(coalesce(total_xp, 0) + p_cuanto)
   where id = auth.uid()
   returning total_xp into v_total;

  -- Si no había fila que actualizar, `v_total` se queda en NULL y la
  -- función contestaría «bien» sin haber sumado nada. El cliente se lo
  -- creería y daría el premio por dado: «la función contestó» NO es «el
  -- XP entró». Mejor que reviente.
  if v_total is null then
    raise exception 'no hay perfil para %', auth.uid();
  end if;

  return v_total;
end;
$$;

-- Esta sí la llama el cliente, así que aquí el grant es al revés que en
-- `torneos_repartir_xp`: se le da a quien tiene sesión y se le quita a
-- quien no. Y el `revoke` de `public` obliga a nombrar a `service_role`
-- aparte — una función nueva nace con EXECUTE para PUBLIC y revocarlo
-- se lo quita también a él (comprobado contra Postgres 16 en la 387).
revoke all on function public.xp_sumar(int) from public, anon;
grant execute on function public.xp_sumar(int) to authenticated, service_role;
