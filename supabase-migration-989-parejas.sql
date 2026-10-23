-- Tanda 989 — «Parejas», el sexto reto (sustituye a «El reto de hoy»).
--
-- Se puede ejecutar más de una vez, y cada sentencia va sola (el SQL Editor
-- puede mandarlas por separado: la 631). Necesita la de la 835
-- (supabase-migration-retos-xp.sql).
--
-- Lo que cambia:
--   1. `retos_resultados` acepta el juego 'parejas', y sus `intentos` (los
--      MOVIMIENTOS: dos cartas vueltas) pueden pasar de 10.
--   2. `retos_xp` sabe lo que da Parejas: +30 con 6 o 7 movimientos, +20
--      hasta 10, +10 hasta 14 y +5 si se tarda más (lo mismo que
--      js/retos-xp.js). El resto, igual que en la 835.
-- Las seis cartas del día van en `retos_reto_del_dia` (juego 'parejas'),
-- que ya acepta cualquier juego. El día perfecto sigue siendo «seis juegos
-- distintos el mismo día»: los seis de ahora.
--
-- Hasta que se ejecute, Parejas se juega igual pero no guarda nada: la base
-- rechaza el juego y la web no enseña XP.

alter table public.retos_resultados drop constraint if exists retos_resultados_juego;

alter table public.retos_resultados add constraint retos_resultados_juego
  check (juego in ('reto', 'carta', 'caro', 'silueta', 'ordena', 'expansion', 'parejas'));

alter table public.retos_resultados drop constraint if exists retos_resultados_intentos;

alter table public.retos_resultados add constraint retos_resultados_intentos
  check (intentos is null or intentos between 0 and 99);

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
    return case coalesce(p_intentos, 3) when 1 then 20 when 2 then 10 else 5 end;
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
