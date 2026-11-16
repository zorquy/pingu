-- ─────────────────────────────────────────────────────────────────────
-- MENCIONES CON PUNTO (tanda 1382).
--
-- PINGU: «las menciones en el foro no funcionan bien y ya ves que sergio.m
-- no lo reconoce por el punto». La gente escribe el nombre que VE
-- («@Sergio.M»), pero los usuarios son minúsculas, números y guiones
-- («sergio-m»): el patrón cortaba en el punto y la mención se iba a
-- «@sergio», que es OTRA persona (y a esa le llegaba el correo).
--
-- `menciones_de` (la que usa el disparador del correo del foro) hace ahora
-- lo mismo que js/menciones.js (`encajeDe`): el nombre admite puntos por
-- dentro, el punto del final de una frase no es del nombre, y un nombre con
-- punto es, por este orden, el usuario con guion, el usuario sin el punto,
-- quien se llama así de cara a la gente y, solo si nada de eso existe, lo de
-- antes del punto. Devuelve el USUARIO de cada uno, así que el disparador
-- (`lower(u.username) = nombre`) no cambia. El tope de cinco sigue: es para
-- avisar, no para pintar.
--
-- Deja de ser `immutable` (mira user_profiles): `stable`. Re-ejecutable y
-- sin tablas temporales (tanda 631).
-- ─────────────────────────────────────────────────────────────────────
begin;

create or replace function public.menciones_de(p_texto text)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  with escritos as (
    select n, min(orden) as orden
    from (
      select regexp_replace(lower(m[1]), '[._-]+$', '') as n, row_number() over () as orden
      from regexp_matches(
        coalesce(p_texto, ''),
        '(?:^|[^a-zA-Z0-9@._-])@([a-zA-Z0-9][a-zA-Z0-9._-]{1,29})',
        'g'
      ) as m
    ) x
    where length(n) >= 2
    group by n
  ),
  resueltos as (
    select e.orden, (
      select k.usuario
      from (
        select c.prioridad, u.username as usuario
        from (values
          (1, regexp_replace(e.n, '\.+', '-', 'g')),
          (2, replace(e.n, '.', '')),
          (4, split_part(e.n, '.', 1))
        ) as c(prioridad, nombre)
        join user_profiles u on lower(u.username) = c.nombre
        where e.n like '%.%' or c.prioridad = 1
        union all
        select 3, u.username
        from user_profiles u
        where e.n like '%.%' and lower(u.display_name) = e.n
      ) k
      order by k.prioridad
      limit 1
    ) as usuario
    from escritos e
  )
  select coalesce(array_agg(r.u order by r.o), '{}')
  from (
    select lower(usuario) as u, min(orden) as o
    from resueltos
    where usuario is not null
    group by lower(usuario)
    order by o
    limit 5
  ) r
$$;

comment on function public.menciones_de(text) is
  'Los usuarios mencionados en un texto plano (como mucho cinco), con los nombres con punto resueltos como encajeDe en js/menciones.js (1382): si se cambia una, hay que cambiar la otra.';

commit;
