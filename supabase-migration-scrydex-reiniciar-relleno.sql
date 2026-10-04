-- Reiniciar el relleno de Scrydex (tanda 526).
--
-- POR QUÉ HACE FALTA: la noche del 2026-10-03 el relleno corrió entero
-- sin escribir UNA SOLA carta. El upsert no mandaba `local_id` ni `name`,
-- que son `not null` en `tcg_cards`, y Postgres FORMA la fila que
-- insertaría antes de ver que ya existe: 23502, y la sentencia rechazada
-- entera —las 250 cartas de la página— aunque todas fueran a ser updates.
--
-- Como el fallo era nuestro y no de una página suya, saltarse la página
-- no arreglaba nada: avanzó hasta la 42 pagando cinco créditos por cada
-- una para no escribir nada. Eso ya no puede pasar (ahora PARA), pero el
-- estado se quedó en la página 42 con el barrido dado por empezado.
--
-- Esto lo devuelve al principio. Es una sola fila de control: no toca
-- ninguna carta ni ningún set.
update public.scrydex_estado
set valor = jsonb_build_object(
      'pagina', 1,
      'barridos', 0,
      'fallos', 0,
      'total', coalesce((valor->>'total')::bigint, 0),
      'reiniciado', '2026-10-04'
    ),
    updated_at = now()
where clave = 'cartas-west';

-- Y si no existiera la fila, se crea en el principio.
insert into public.scrydex_estado (clave, valor)
select 'cartas-west', jsonb_build_object('pagina', 1, 'barridos', 0, 'fallos', 0)
where not exists (select 1 from public.scrydex_estado where clave = 'cartas-west');

select clave, valor from public.scrydex_estado where clave = 'cartas-west';
