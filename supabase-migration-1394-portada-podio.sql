-- ═══════════════════════════════════════════════════════════════════
-- Tanda 1394 — «Tu torneo» en Inicio: portada_hoy() trae el podio
-- ═══════════════════════════════════════════════════════════════════
--
-- La ficha del torneo de Inicio (js/hoy.js) dice «¡Campeón!» o «2.º puesto»
-- unos días cuando acabas en el podio de un torneo. Inicio lo pide TODO de
-- una vez a portada_hoy() (1017: nada de consultas sueltas), y su lista de
-- tus torneos ya incluye los terminados; solo le faltaban dos campos: el
-- podio congelado (`podium`, 388) y cuándo se cerró (`updated_at`).
--
-- Es la MISMA función de la 1017 con esos dos campos más en 'torneos'; nada
-- cambia de forma ni de permisos. Sin esta migración la web no se rompe:
-- sin `podium` la ficha sigue siendo la de siempre.
--
-- Se puede ejecutar entera en el SQL Editor, y repetirla no hace daño.

create or replace function public.portada_hoy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := current_date;
  -- Lo que se puede JUGAR en una guía: es `PRACTICE_TYPES` de
  -- js/guia-contenido.js (una copia, y la vigila test-tanda-1017.mjs).
  v_practica text[] := array['quiz', 'truefalse', 'fillblank', 'match', 'order', 'cartaquiz', 'zonas', 'ordenprecio', 'clasifica', 'intruso', 'desliza', 'memoria', 'escribe', 'diferencias'];
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'dia', v_hoy,
    -- El valor: las fotos de 60 días y la suma de ahora (hoy.js: la foto es
    -- de anoche y no lleva lo que pusiste a mano ni lo que subió hoy).
    'valor', jsonb_build_object(
      'historia', coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'valor', h.valor) order by h.dia)
                             from public.user_collection_value h
                            where h.user_id = v_uid and h.dia >= v_hoy - 60), '[]'::jsonb),
      'ahora', public.coleccion_valor_de(v_uid)),
    -- Tus torneos con inscripción activa, todos: cuál es el próximo lo
    -- decide `proximaCita` en el navegador (879: una liga empezó hace
    -- semanas y su cita es la próxima jornada).
    'torneos', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'start_at', t.start_at,
                                 'status', t.status, 'format', t.format, 'matchday_dates', t.matchday_dates,
                                 -- 1394: el podio congelado y cuándo se cerró, para la
                                 -- ficha «Tu torneo» de Inicio («¡Campeón!» unos días).
                                 'podium', t.podium, 'updated_at', t.updated_at))
                          from public.tournaments t
                         where t.id in (select r.tournament_id from public.tournament_registrations r
                                         where r.user_id = v_uid and r.status = 'active')), '[]'::jsonb),
    -- El próximo con inscripciones abiertas (la ficha de quien no juega ninguno).
    'abierto', (select jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'start_at', t.start_at)
                  from public.tournaments t
                 where t.status = 'registration_open' and t.start_at >= now()
                 order by t.start_at limit 1),
    -- Los tres próximos lanzamientos del catálogo occidental (656), sin
    -- Pocket; las de TCGGO nacen escondidas (756) y las filtra el navegador.
    'sets', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'name_en', s.name_en, 'release_date', s.release_date,
                              'logo_tcggo', s.logo_tcggo, 'logo_scrydex', s.logo_scrydex, 'oculto', s.oculto, 'tcggo_id', s.tcggo_id)
                              order by s.release_date)
                       from (select * from public.tcg_sets
                              where market = 'WEST' and serie_id <> 'tcgp' and release_date >= v_hoy
                              order by release_date limit 3) s), '[]'::jsonb),
    -- Lo que tienes a medias (748): las últimas cuatro guías empezadas y
    -- sin acabar, con lo que la tarjeta pinta de cada una (no los bloques
    -- enteros: `bloques` y si hay algo que jugar), y tus tres últimos mazos
    -- con sus cartas contadas.
    'sigue', jsonb_build_object(
      'progreso', coalesce((select jsonb_agg(jsonb_build_object(
                             'guide_id', p.guide_id, 'current_block', p.current_block, 'status', p.status,
                             'started_at', p.started_at, 'read_at', p.read_at,
                             'guia', jsonb_build_object('id', g.id, 'slug', g.slug, 'title', g.title, 'estimated_mins', g.estimated_mins,
                               'bloques', case when jsonb_typeof(g.blocks) = 'array' then jsonb_array_length(g.blocks) else 0 end,
                               'curso', exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g.blocks) = 'array' then g.blocks else '[]'::jsonb end) b
                                                 where b ->> 'type' = any (v_practica))))
                             order by p.started_at desc)
                            from (select * from public.user_progress
                                   where user_id = v_uid and status <> 'completed' and started_at is not null
                                   order by started_at desc limit 4) p
                            join public.guides g on g.id = p.guide_id), '[]'::jsonb),
      'mazos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'updated_at', d.updated_at,
                           'cartas', (select coalesce(sum((x ->> 'n')::numeric), 0)
                                        from jsonb_array_elements(case when jsonb_typeof(d.cards) = 'array' then d.cards else '[]'::jsonb end) x
                                       where (x ->> 'n') ~ '^[0-9]+(\.[0-9]+)?$'))
                           order by d.updated_at desc)
                          from (select * from public.user_decks where user_id = v_uid order by updated_at desc limit 3) d), '[]'::jsonb)),
    -- Los temas que sigues con algo que no has visto (1010), con la regla
    -- de `estaSinLeer`: el último mensaje no es tuyo y es posterior a tu
    -- marca del tema o a «todo leído», la más nueva; sin ninguna, está sin
    -- leer. Las últimas 200 suscripciones, como la web.
    'hilos', (select jsonb_build_object('cuenta', count(*),
                                        'uno', (array_agg(t.id order by t.last_post_at desc))[1],
                                        'titulo', (array_agg(t.title order by t.last_post_at desc))[1])
                from (select s.thread_id from public.forum_subscriptions s where s.user_id = v_uid order by s.created_at desc limit 200) s
                join public.forum_threads t on t.id = s.thread_id
                left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
               where t.last_post_at is not null
                 and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
                 and t.last_post_at > coalesce(greatest(r.last_read_at, (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid)), '-infinity'::timestamptz)),
    -- Los retos (835) y la gente de hoy (842), las funciones de siempre.
    'retos', public.retos_mis_numeros(7),
    'comunidad', public.retos_comunidad(v_hoy),
    -- Las preguntas por repasar (curso-datos.js).
    'repaso', (select count(*) from public.course_review_queue q where q.user_id = v_uid and q.review_after <= now()),
    -- Los primeros pasos (primeros-pasos.js): si ya tienes el trofeo, y si
    -- no, cuál de los tres llevas.
    'pasos', (select jsonb_build_object(
                'logro', coalesce(u.achievements @> array['primeros_pasos'], false),
                'leer', exists (select 1 from public.user_progress p where p.user_id = v_uid and p.read_at is not null),
                'curso', exists (select 1 from public.user_progress p where p.user_id = v_uid and p.status = 'completed'),
                'foro', exists (select 1 from public.forum_posts m where m.author_id = v_uid))
                from public.user_profiles u where u.id = v_uid)
  );
end;
$$;

revoke all on function public.portada_hoy() from public, anon;

grant execute on function public.portada_hoy() to authenticated;

-- Comprobación: debe salir una fila con «podium».
select position('podium' in pg_get_functiondef('public.portada_hoy()'::regprocedure)) > 0 as trae_el_podio;
