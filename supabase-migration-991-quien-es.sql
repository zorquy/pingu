-- Tanda 991 — «¿Quién es ese Pokémon?»: el primer intento, borroso.
--
-- Una sola sentencia, que se puede ejecutar más de una vez. Necesita la de
-- la 989 (supabase-migration-989-parejas.sql), cuyo `retos_xp` redefine
-- entero: es el mismo cuerpo con la rama de la silueta nueva.
--
-- Lo que cambia: la silueta sale borrosa al principio y se aclara con cada
-- fallo, así que acertar a la primera vale más. +30 a la primera, +20 a la
-- segunda y +10 a la tercera (antes +20, +10 y +5). Lo mismo que
-- js/retos-xp.js. Lo ya guardado no cambia: la XP se apunta al guardar.
--
-- Hasta que se ejecute, la base sigue dando +20/+10/+5 y el final del reto
-- enseña lo que dé la base.

create or replace function public.retos_xp(p_juego text, p_aciertos int, p_total int, p_intentos int, p_acertada boolean, p_tira boolean[] default null)
returns int
language plpgsql
immutable
set search_path = public
as $$
declare
  v_puntos int := 0;
  v_racha int := 0;
  v_i int;
begin
  if p_juego = 'reto' then
    -- El de preguntas ya daba su XP en curso.js: aquí no cobra dos veces.
    return 0;
  elsif p_juego = 'carta' then
    if not coalesce(p_acertada, false) then return 5; end if;
    return case coalesce(p_intentos, 6) when 1 then 50 when 2 then 45 when 3 then 40 when 4 then 30 when 5 then 20 else 15 end;
  elsif p_juego = 'caro' then
    if p_tira is null then return least(30, greatest(0, coalesce(p_aciertos, 0)) * 3); end if;
    for v_i in 1 .. least(coalesce(array_length(p_tira, 1), 0), 5) loop
      if p_tira[v_i] then
        v_racha := v_racha + 1;
        v_puntos := v_puntos + case when v_racha >= 3 then 6 else 3 end;
      else
        v_racha := 0;
      end if;
    end loop;
    if coalesce(array_length(p_tira, 1), 0) = 5 and not (false = any (p_tira)) then v_puntos := v_puntos + 6; end if;
    return least(30, v_puntos);
  elsif p_juego = 'silueta' then
    if not coalesce(p_acertada, false) then return 0; end if;
    -- 991: el primer intento va borroso, así que vale más.
    return case coalesce(p_intentos, 3) when 1 then 30 when 2 then 20 else 10 end;
  elsif p_juego = 'ordena' then
    if not coalesce(p_acertada, false) then return 2; end if;
    return case coalesce(p_intentos, 3) when 1 then 25 when 2 then 15 else 8 end;
  elsif p_juego = 'expansion' then
    return least(5, greatest(0, coalesce(p_aciertos, 0))) * 4;
  elsif p_juego = 'parejas' then
    -- Siempre se acaba: lo que cuenta son los movimientos.
    return case
      when coalesce(p_intentos, 99) <= 7 then 30
      when p_intentos <= 10 then 20
      when p_intentos <= 14 then 10
      else 5
    end;
  end if;
  return 0;
end;
$$;
