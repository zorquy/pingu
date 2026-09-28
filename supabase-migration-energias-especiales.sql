-- ─────────────────────────────────────────────────────────────────────
-- Tanda 358 — el tipo de las energías de `tcg_cards` decía «básica»
-- en energías ESPECIALES.
--
-- El origen (comprobado el 2026-09-28 contra la API de TCGdex): TCGdex
-- trae `energyType: "Normal"` en varias energías especiales — la
-- Prisma, la Ignición, la del Team Rocket y las ocho «Energía X
-- Creciente / Telepática / Rocosa / Burbujeante / Magnética / Nitro /
-- Voltaica / Sombría» de la era ME. Y pasa EN INGLÉS también, así que
-- no es cosa del engorde en español: el dato viene mal de fábrica. En
-- español encima llega traducido como «Básico», que la canonización de
-- la tanda 334 no conocía (solo «Basica»), y se guardaba tal cual.
--
-- Qué rompía: el constructor les quitaba el límite de 4 copias (ya
-- corregido en el cliente, tanda 357) y la FICHA las presentaba como
-- «Energía básica» y SIEMPRE legales en Estándar, que es mentira.
--
-- El arreglo de origen va en `js/carta-detalle.js` (tanda 358): el
-- «Normal» de una energía solo se cree si el NOMBRE es el de una de
-- las básicas. Esto corrige las filas que ya estaban escritas.
--
-- OJO con la dirección: solo se tocan filas que hoy digan «básica» o
-- «Normal». Un `Special` que ya está bien NO se reescribe por nombre —
-- las «Darkness Energy» y «Metal Energy» de la era Neo son ESPECIALES
-- con nombre de básica, y la regla del nombre las estropearía.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede ejecutar dos veces
-- sin romper nada (la segunda no encuentra filas que cambiar).
-- ─────────────────────────────────────────────────────────────────────
begin;

-- Las dos formas del nombre de una energía básica, sin distinguir
-- mayúsculas (~*). Los acentos se escriben con alternativa porque las
-- filas llegaron mitad con tilde y mitad sin ella.
--   · «Energía Fuego», «Energia Básica Planta», «Energía Hada»…
--   · «Fire Energy», «Basic Fire Energy», «Basic {R} Energy»…
-- El Hada cuenta: fue básica hasta 2020 y sigue viva en Expandido.

update public.tcg_cards
set energy_type = 'Special'
where market = 'WEST'
  and category in ('Energy', 'Energía', 'Energia')
  and energy_type in ('Básico', 'Basico', 'Básica', 'Basica', 'Basic', 'Normal')
  and set_id not in ('sve', 'mee')
  and coalesce(name, '') !~* '^energ(í|i)a( b(á|a)sica)? (planta|fuego|agua|rayo|ps(í|i)quic(a|o)|lucha|oscur(a|o)|met(á|a)lic(a|o)|hada)( b(á|a)sica)?$'
  and coalesce(name, '') !~* '^(basic )?(\{[grwlpfdmy]\}|grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$'
  and coalesce(name_es, '') !~* '^energ(í|i)a( b(á|a)sica)? (planta|fuego|agua|rayo|ps(í|i)quic(a|o)|lucha|oscur(a|o)|met(á|a)lic(a|o)|hada)( b(á|a)sica)?$'
  and coalesce(name_es, '') !~* '^(basic )?(\{[grwlpfdmy]\}|grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$';

-- Las básicas de verdad que quedaron con la forma en español (o la
-- vieja «Basic»), a su forma canónica: todo el código compara 'Normal'.
update public.tcg_cards
set energy_type = 'Normal'
where market = 'WEST'
  and category in ('Energy', 'Energía', 'Energia')
  and energy_type in ('Básico', 'Basico', 'Básica', 'Basica', 'Basic');

-- Y el «Especial» traducido, a su forma canónica.
update public.tcg_cards
set energy_type = 'Special'
where market = 'WEST'
  and energy_type = 'Especial';

commit;

-- Comprobación 1: ya no queda ninguna forma sin canonizar.
-- Tiene que devolver CERO filas.
select energy_type, count(*)
from public.tcg_cards
where market = 'WEST' and energy_type not in ('Normal', 'Special')
group by energy_type;

-- Comprobación 2: las conocidas salen como 'Special'.
-- Tiene que salir 'Special' en todas las filas.
select id, name, name_es, energy_type
from public.tcg_cards
where market = 'WEST'
  and (
    coalesce(name, '') ~* '(prism|ignition|team rocket|rising|telepathic|rocky|bubbly|magnetic|nitro|voltaic|shadowy) energy'
    or coalesce(name_es, '') ~* 'energ(í|i)a .*(prisma|ignici(ó|o)n|team rocket|creciente|telep(á|a)tica|rocosa|burbujeante|magn(é|e)tica|nitro|volt(á|a)ica|sombr(í|i)a)'
    or coalesce(name_es, '') ~* '^energ(í|i)a prisma$'
  )
order by id;
