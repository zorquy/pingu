-- ════════════════════════════════════════════════════════════════════
-- Tanda 352 — los premios de un torneo, en su sitio
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «acabo de crear mi primer torneo con premios, pero solo se
-- especifican en la descripción».
--
-- Y la descripción es un bloque de texto: no se puede enseñar en
-- /torneos —donde la gente decide si se apunta—, ni resumir al
-- compartir, ni cruzar con la clasificación final. Un premio metido en
-- un párrafo solo lo ve quien ya había entrado.
--
-- ── Por qué una lista y no un texto ──
--
-- Porque un premio SIEMPRE es de alguien: del primero, del segundo, de
-- todo el que juegue. Guardado como «1º: 50 € en cartas, 2º: un sobre»
-- hay que volver a partirlo por comas cada vez que se quiera enseñar en
-- otro sitio, y ahí es donde se rompe. Guardado como lista, el sitio
-- decide qué enseña: la ficha los pinta todos, el listado enseña el
-- primero, y el día que se cruce con la clasificación final cada puesto
-- ya sabe cuál es el suyo.
--
-- La forma: [{"puesto": "1º", "premio": "50 € en cartas"}, …]
--
--   · `puesto` es TEXTO y no un número a propósito: «Top 8», «Todos los
--     participantes» y «Mejor lista» son premios de verdad y no caben en
--     un entero.
--   · El orden es el del array. Lo pone quien lo escribe.
--
-- Se valida la FORMA aquí y no solo en el navegador: esta columna la
-- escribe cualquiera que pueda editar su torneo, y un jsonb sin forma
-- rompería la ficha de todo el mundo que la abra.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

alter table public.tournaments
  add column if not exists prizes jsonb;

alter table public.tournaments
  drop constraint if exists tournaments_prizes_check;

alter table public.tournaments
  add constraint tournaments_prizes_check check (
    prizes is null
    or (
      jsonb_typeof(prizes) = 'array'
      -- Doce premios son de sobra para un podio y un par de menciones.
      and jsonb_array_length(prizes) <= 12
      and not exists (
        select 1
        from jsonb_array_elements(prizes) as p
        where jsonb_typeof(p) <> 'object'
           or jsonb_typeof(p -> 'puesto') <> 'string'
           or jsonb_typeof(p -> 'premio') <> 'string'
           or length(p ->> 'puesto') > 40
           or length(p ->> 'premio') > 200
      )
    )
  );

-- Las políticas no se tocan: quien puede editar su torneo puede escribir
-- esta columna, igual que el nombre o la fecha. Y `torneos_mando` sigue
-- siendo el único criterio de quién lleva un torneo.

-- ── Para verlos ──
--
-- select slug, name, prizes from public.tournaments
-- where prizes is not null order by created_at desc;
