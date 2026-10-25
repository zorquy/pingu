-- ─────────────────────────────────────────────────────────────────────
-- LA PORTADA CON CUENTA EN TRES OLAS (tanda 1017, R3 del repaso).
--
-- Al abrir la portada con sesión se hacían 50 consultas a Supabase en 6
-- olas seguidas (cada ola espera a la anterior); el índice del foro, 32.
-- Casi todas pequeñas, pero las olas suman: con la base a 250 ms, 1,5 s
-- hasta la última pieza. Lo que pintan las fichas de «Hoy», el bloque
-- «Ahora en el foro» de la portada y el índice del foro salen ahora de UNA
-- función cada uno, calculada en la base con LAS MISMAS REGLAS que tenía
-- el navegador (cada regla lleva al lado de dónde viene):
--
--   portada_hoy()          lo tuyo de hoy: lo que vale tu colección (la
--                          historia de 60 días y la suma de AHORA, la misma
--                          que el Panel), tus torneos vivos, el próximo
--                          abierto, los próximos lanzamientos, lo que tienes
--                          a medias, los temas que sigues con algo nuevo, los
--                          retos y la gente de hoy, las preguntas por repasar
--                          y los primeros pasos.
--   portada_foro(p_desde)  «Ahora en el foro»: los cuatro temas vivos de los
--                          foros que se ven, lo de hoy, el último mensaje
--                          del que más se mueve, quién escribe y, con
--                          cuenta, lo que no has leído.
--   foro_resumen()         el índice del foro: secciones, foros con sus
--                          cuentas y, con cuenta, cuántos temas sin leer
--                          tiene cada uno, tu rol y los perfiles.
--
-- Y para que «lo que vale tu colección ahora» sea UNA cuenta y no dos (la
-- 377 lo dejó escrito: la foto de la noche suma lo mismo que la pantalla),
-- `valor_de_copia(c, pr)` es lo que vale una línea con su fila de precios,
-- `sin_precio(c, pr)` dice si no tiene precio, y `coleccion_foto_diaria`
-- (la 377, reescrita en la 905) pasa a sumar por ellas: la foto de cada
-- noche y la cifra de la portada salen de la misma función.
--
-- Cada sentencia va por su lado (la 631). Se puede ejecutar más de una vez.
-- Necesita la 905 (`valor_gradeado`, `valor_de_linea`), la 844 (la
-- portada), la 835 y la 842 (los retos) y las del foro (lecturas y
-- suscripciones).
-- ─────────────────────────────────────────────────────────────────────

-- ── Lo que vale UNA copia, con su fila de precios ──
-- Es el `case` que tenía dentro `coleccion_foto_diaria` desde la 905: «Tu
-- valor» manda; si no, la nota de una gradeada; si no, `valor_de_linea`
-- (el mínimo en SU idioma, la 900, con sus respaldos). `pr` puede venir
-- vacía (una carta sin fila de precios): cada campo sale null y la copia
-- vale 0, como en la web.
create or replace function public.valor_de_copia(c public.user_collection, pr public.tcg_card_prices)
returns numeric
language sql
stable
as $$
  select case
    when coalesce((c).valor_manual, 0) = 0
     and public.valor_gradeado((c).gradeo, (pr).cm_gradeadas, (pr).ebay_gradeadas) is not null
    then public.valor_gradeado((c).gradeo, (pr).cm_gradeadas, (pr).ebay_gradeadas) * greatest(coalesce((c).cantidad, 1), 0)
    else public.valor_de_linea(
      (c).valor_manual, (c).cantidad, (c).variante, (c).idioma,
      (pr).cm_low_es, (pr).cm_low_en, (pr).cm_low_de, (pr).cm_low_fr, (pr).cm_low_it, (pr).cm_low_ja,
      (pr).cm_trend, (pr).cm_avg30, (pr).cm_low,
      (pr).cm_trend_holo, (pr).cm_avg30_holo, (pr).cm_low_holo,
      (pr).tp_market_eur,
      (pr).tp_normal_market, (pr).tp_normal_low, (pr).tp_holo_market, (pr).tp_holo_low,
      (pr).tp_reverse_market, (pr).tp_reverse_low, (pr).tp_primera_market, (pr).tp_primera_low)
  end
$$;

comment on function public.valor_de_copia(public.user_collection, public.tcg_card_prices) is
  'Lo que vale una línea de la colección con su fila de precios: Tu valor, la nota de una gradeada o valor_de_linea. La misma cuenta para la foto diaria y para la portada (1017).';

-- «Sin precio» (la 377: se cuenta en copias, «3 cartas no tienen precio
-- todavía»): ni valor a mano, ni nota con precio, ni una cifra en ninguna
-- columna. El mismo filtro que tenía la 905.
create or replace function public.sin_precio(c public.user_collection, pr public.tcg_card_prices)
returns boolean
language sql
stable
as $$
  select coalesce((c).valor_manual, 0) = 0
     and public.valor_gradeado((c).gradeo, (pr).cm_gradeadas, (pr).ebay_gradeadas) is null
     and coalesce((pr).cm_low_es, (pr).cm_low_en, (pr).cm_low_de, (pr).cm_low_fr, (pr).cm_low_it, (pr).cm_low_ja, 0) = 0
     and coalesce((pr).cm_trend, (pr).cm_avg30, (pr).cm_low, 0) = 0
     and coalesce((pr).tp_market_eur, 0) = 0
     and coalesce((pr).tp_normal_market, (pr).tp_normal_low, (pr).tp_holo_market, (pr).tp_holo_low, (pr).tp_reverse_market, (pr).tp_reverse_low, (pr).tp_primera_market, (pr).tp_primera_low, 0) = 0
$$;

-- La foto de hoy, de todo el mundo, en una sentencia (la 377): igual que
-- en la 905, sumando por `valor_de_copia` y `sin_precio`.
create or replace function public.coleccion_foto_diaria(p_dia date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.user_collection_value (user_id, dia, valor, copias, distintas, sin_precio)
  select c.user_id,
         p_dia,
         sum(public.valor_de_copia(c, pr)),
         sum(c.cantidad),
         count(distinct c.card_id),
         coalesce(sum(c.cantidad) filter (where public.sin_precio(c, pr)), 0)
    from public.user_collection c
    left join public.tcg_card_prices pr on pr.card_id = c.card_id
   group by c.user_id
  on conflict (user_id, dia) do update
    set valor = excluded.valor,
        copias = excluded.copias,
        distintas = excluded.distintas,
        sin_precio = excluded.sin_precio;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke all on function public.coleccion_foto_diaria(date) from public, anon, authenticated;

grant execute on function public.coleccion_foto_diaria(date) to service_role;

-- Lo que vale la colección de alguien AHORA: la tuya, o una pública (la
-- misma puerta que el histórico, `coleccion_es_publica`). `null` si no se
-- puede mirar: «no se sabe», no «cero» (la 319).
create or replace function public.coleccion_valor_de(p_user uuid default auth.uid())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null or not (p_user = auth.uid() or public.coleccion_es_publica(p_user)) then null
    else (
      select jsonb_build_object(
        'valor', coalesce(sum(public.valor_de_copia(c, pr)), 0),
        'copias', coalesce(sum(c.cantidad), 0),
        'lineas', count(*),
        'distintas', count(distinct c.card_id),
        'sin_precio', coalesce(sum(c.cantidad) filter (where public.sin_precio(c, pr)), 0))
      from public.user_collection c
      left join public.tcg_card_prices pr on pr.card_id = c.card_id
      where c.user_id = p_user)
  end
$$;

revoke all on function public.coleccion_valor_de(uuid) from public;

grant execute on function public.coleccion_valor_de(uuid) to anon, authenticated;

-- ── Lo tuyo de hoy, de una vez ──
-- Cada trozo es la consulta que hacía js/hoy.js (o js/home.js,
-- js/primeros-pasos.js), con su misma regla; el navegador sigue decidiendo
-- lo que decidía (la próxima cita de una liga, qué guía va primero).
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
                                 'status', t.status, 'format', t.format, 'matchday_dates', t.matchday_dates))
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

-- ── «Ahora en el foro», de una vez ──
-- Lo que hacía `montarForo` en js/portada-bloques.js, en siete consultas y
-- cinco olas. `p_desde` es la medianoche de QUIEN mira (lo de «hoy» se
-- cuenta en su hora); sin ella, la del servidor.
create or replace function public.portada_foro(p_desde timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_desde timestamptz := coalesce(p_desde, date_trunc('day', now()));
  v_hasta timestamptz := (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid);
  v jsonb;
begin
  with visibles as (
    select b.id, b.name from public.forum_boards b where not coalesce(b.is_hidden, false)
  ),
  -- Los cuatro temas más recientes de los foros que se ven (876).
  temas as (
    select t.id, t.title, t.prefix, t.post_count, t.created_at, t.last_post_at, t.author_id, t.last_post_author_id, t.board_id
      from public.forum_threads t
      join visibles b on b.id = t.board_id
     order by t.last_post_at desc nulls last
     limit 4
  ),
  de_hoy as (
    select m.thread_id, m.author_id from public.forum_posts m where m.created_at >= v_desde limit 1000
  ),
  cuenta_hoy as (
    select h.thread_id, count(*)::int as n from de_hoy h group by h.thread_id
  ),
  -- Delante, el que más mensajes ha tenido hoy; a igualdad, el más reciente.
  top as (
    select t.id from temas t left join cuenta_hoy c on c.thread_id = t.id
     order by coalesce(c.n, 0) desc, t.last_post_at desc nulls last
     limit 1
  ),
  ultimos as (
    select m.id, m.author_id, left(m.body_html, 1500) as body_html, m.created_at
      from public.forum_posts m
     where m.thread_id = (select id from top)
     order by m.created_at desc
     limit 10
  ),
  gente as (
    select t.author_id as id from temas t
    union select t.last_post_author_id from temas t
    union select u.author_id from ultimos u
  ),
  perfiles as (
    select u.id, u.username, u.display_name, u.avatar_url, u.level, u.total_xp, u.hide_activity, u.is_admin, u.is_moderator
      from public.user_profiles u
     where u.id in (select g.id from gente g where g.id is not null)
  ),
  -- Lo que no has leído, con la regla de `estaSinLeer`; el de delante con
  -- su cuenta exacta (los mensajes de otros posteriores a tu marca, y uno
  -- como poco), los demás con su punto.
  sin_leer as (
    select t.id, t.post_count, greatest(r.last_read_at, v_hasta) as ref
      from temas t
      left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
     where v_uid is not null and t.last_post_at is not null
       and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
       and t.last_post_at > coalesce(greatest(r.last_read_at, v_hasta), '-infinity'::timestamptz)
  ),
  nuevos as (
    select s.id,
           case when s.id = (select id from top) then
                  case when s.ref is null then least(coalesce(s.post_count, 1), 10)
                       else greatest((select count(*) from ultimos u where u.created_at > s.ref and u.author_id <> v_uid), 1) end
                else 1 end as n
      from sin_leer s
  )
  select jsonb_build_object(
    'temas', coalesce((select jsonb_agg(to_jsonb(t) order by (t.id = (select id from top)) desc, t.last_post_at desc nulls last) from temas t), '[]'::jsonb),
    'foros', coalesce((select jsonb_object_agg(b.id::text, b.name) from visibles b), '{}'::jsonb),
    'hoy', coalesce((select jsonb_object_agg(c.thread_id::text, c.n) from cuenta_hoy c), '{}'::jsonb),
    'escribiendo', (select count(distinct h.author_id) from de_hoy h),
    'ultimo', (select to_jsonb(u) from ultimos u order by u.created_at desc limit 1),
    'participantes', coalesce((select jsonb_agg(a.author_id order by a.ultimo desc)
                                 from (select u.author_id, max(u.created_at) as ultimo from ultimos u where u.author_id is not null group by u.author_id) a), '[]'::jsonb),
    'perfiles', coalesce((select jsonb_object_agg(p.id::text, to_jsonb(p)) from perfiles p), '{}'::jsonb),
    'nuevos', coalesce((select jsonb_object_agg(n.id::text, n.n) from nuevos n), '{}'::jsonb),
    'sesion', v_uid is not null
  ) into v;
  return v;
end;
$$;

revoke all on function public.portada_foro(timestamptz) from public;

grant execute on function public.portada_foro(timestamptz) to anon, authenticated;

-- ── El índice del foro, de una vez ──
-- Lo que hacía `pintarIndice` en js/foro.js con `marcasDeLectura` y
-- `sinLeerPorForo` (secciones, foros, perfiles, marcas, «todo leído» y
-- hasta mil temas para contarlos aquí): las secciones, los foros que se
-- ven con sus cuentas, cuántos temas sin leer tiene cada uno (la regla de
-- `estaSinLeer`, sin tope), los perfiles del último que escribió y tu rol.
create or replace function public.foro_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hasta timestamptz := (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid);
  v jsonb;
begin
  with foros as (
    select f.* from public.forum_boards_resumen f where not coalesce(f.is_hidden, false)
  ),
  sin_leer as (
    select t.board_id, count(*)::int as n
      from public.forum_threads t
      left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
     where v_uid is not null and t.last_post_at is not null
       and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
       and t.last_post_at > coalesce(greatest(r.last_read_at, v_hasta), '-infinity'::timestamptz)
     group by t.board_id
  ),
  perfiles as (
    select u.id, u.username, u.display_name, u.avatar_url, u.level, u.total_xp, u.hide_activity, u.is_admin, u.is_moderator
      from public.user_profiles u
     where u.id in (select f.last_post_author_id from foros f where f.last_post_author_id is not null)
  )
  select jsonb_build_object(
    'secciones', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.forum_sections s), '[]'::jsonb),
    'foros', coalesce((select jsonb_agg(to_jsonb(f) order by f.position) from foros f), '[]'::jsonb),
    'nuevos', coalesce((select jsonb_object_agg(x.board_id::text, x.n) from sin_leer x), '{}'::jsonb),
    'perfiles', coalesce((select jsonb_object_agg(p.id::text, to_jsonb(p)) from perfiles p), '{}'::jsonb),
    'rol', (select jsonb_build_object('staff', coalesce(u.is_admin, false) or coalesce(u.is_moderator, false), 'admin', coalesce(u.is_admin, false))
              from public.user_profiles u where u.id = v_uid),
    'marcas', v_uid is not null
  ) into v;
  return v;
end;
$$;

revoke all on function public.foro_resumen() from public;

grant execute on function public.foro_resumen() to anon, authenticated;

-- Comprobación: las seis funciones.
select proname from pg_proc where proname in ('valor_de_copia', 'sin_precio', 'coleccion_valor_de', 'portada_hoy', 'portada_foro', 'foro_resumen') order by proname;

notify pgrst, 'reload schema';
