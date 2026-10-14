// Tanda 844 — la portada nueva contra PostgreSQL de verdad: la clasificación
// de la semana y del mes con la XP de los retos, y los sucesos de la
// comunidad (días perfectos, mazos públicos, campeones, colecciones
// completas), con la privacidad de la 842.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_844'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b2'
const C = '00000000-0000-0000-0000-0000000000c3'
const como = (uid, s, rol = 'authenticated') => {
  const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role ${rol}; ${uid ? `set local prueba.uid = '${uid}';` : ''} ${s}; commit;`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const json = (g) => JSON.parse(g.out.split('\n').find((l) => /^[[{]/.test(l)) || 'null')
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-835.sql')])
  // Lo que la base de verdad ya tiene y el andamio no.
  r = psql(['-d', BD, '-c', `alter table public.user_profiles add column username text, add column display_name text, add column avatar_url text, add column hide_activity boolean not null default false, add column coleccion_publica boolean not null default false, add column is_admin boolean not null default false, add column is_moderator boolean not null default false;
    update public.user_profiles set username = case id when '${A}' then 'ash' when '${B}' then 'misty' else 'brock' end;
    create table public.user_decks (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null, is_public boolean not null default false, updated_at timestamptz not null default now());
    create table public.tournaments (id uuid primary key default gen_random_uuid(), slug text, name text, status text, champion_id uuid, updated_at timestamptz not null default now());
    create table public.tcg_sets (id text, market text default 'WEST', name text, card_count_official int, primary key (id, market));
    create table public.tcg_cards (id text, market text default 'WEST', set_id text, local_id text, primary key (id, market));
    create table public.user_collection (id uuid primary key default gen_random_uuid(), user_id uuid, card_id text, market text default 'WEST', cambio int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table public.tournament_registrations (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'active', registered_at timestamptz not null default now());
    create table public.user_follows (follower_id uuid, following_id uuid, created_at timestamptz not null default now());
    create table public.forum_threads (id uuid primary key default gen_random_uuid(), title text, author_id uuid, created_at timestamptz not null default now());
    create table public.forum_posts (id uuid primary key default gen_random_uuid(), thread_id uuid, author_id uuid, body_html text default '', created_at timestamptz not null default now());`])
  check('el andamio carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-xp.sql')])
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-comunidad.sql')])
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-portada.sql')])
  check('la 844 carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-portada.sql')])
  check('  …y otra vez encima', r.status === 0, r.stderr)

  console.log('── La clasificación ──')
  // A: 30 XP hoy; B: 50 hoy y un bono perfecto de 25; C: 20 hace 40 días (fuera de los dos).
  sql(`insert into retos_resultados (user_id, juego, day, aciertos, total, xp) values
    ('${A}', 'carta', current_date, 1, 1, 30),
    ('${B}', 'carta', current_date, 1, 1, 50),
    ('${C}', 'carta', current_date - 40, 1, 1, 20);
    insert into retos_bonos (user_id, tipo, day, xp) values ('${B}', 'perfecto', current_date, 25);`)
  let d = json(como(null, `select public.portada_clasificacion('semana')`, 'anon'))
  check('sin cuenta se ve, con 2 en la semana y misty primera con 75 (50 + el bono)', d?.jugadores === 2 && d.ranking[0].username === 'misty' && d.ranking[0].xp === 75 && d.tu === null, JSON.stringify(d))
  check('  …la semana empieza el lunes', d?.desde === sql(`select current_date - (extract(isodow from current_date)::int - 1)`))
  d = json(como(A, `select public.portada_clasificacion('semana')`))
  check('con cuenta: tu puesto, y lo que te falta para pasar a misty (75 − 30 + 1)', d?.tu?.puesto === 2 && d.tu.faltan === 46 && d.tu.pasarA === 'misty' && d.ranking.find((x) => x.username === 'ash')?.tu === true, JSON.stringify(d?.tu))
  d = json(como(A, `select public.portada_clasificacion('mes')`))
  check('el mes empieza el día 1 y deja fuera lo de hace 40 días', d?.periodo === 'mes' && d.desde === sql(`select date_trunc('month', current_date)::date`) && !d.ranking.some((x) => x.username === 'brock'))
  sql(`update user_profiles set retos_oculto = true where id = '${B}'`)
  d = json(como(A, `select public.portada_clasificacion('semana')`))
  check('quien no quiere salir no sale con nombre, ni como «pasar a»', !JSON.stringify(d.ranking).includes('misty') && d.tu.pasarA === null && d.tu.faltan === 46 && d.jugadores === 2, JSON.stringify(d))
  check('  …y a esa persona le sigue diciendo su puesto', json(como(B, `select public.portada_clasificacion('semana')`))?.tu?.puesto === 1)
  sql(`update user_profiles set retos_oculto = false where id = '${B}'`)

  console.log('── La comunidad ──')
  sql(`insert into user_decks (user_id, name, is_public, updated_at) values ('${A}', 'Charizard ex', true, now() - interval '1 hour'), ('${A}', 'Viejo', true, now() - interval '3 hours'), ('${C}', 'Secreto', false, now());
    insert into tournaments (slug, name, status, champion_id, updated_at) values ('otono', 'Liga de otoño', 'finished', '${C}', now() - interval '2 hours'), ('enjuego', 'En juego', 'in_progress', '${A}', now());
    insert into tcg_sets values ('base1', 'WEST', 'Base Set', 3), ('jungle', 'WEST', 'Jungle', 3);
    insert into tcg_cards values ('base1-1', 'WEST', 'base1', '1'), ('base1-2', 'WEST', 'base1', '2'), ('base1-3', 'WEST', 'base1', '3'), ('base1-4', 'WEST', 'base1', '4'),
      ('jungle-1', 'WEST', 'jungle', '1'), ('jungle-2', 'WEST', 'jungle', '2'), ('jungle-3', 'WEST', 'jungle', '3');
    insert into user_collection (user_id, card_id, created_at) values
      ('${B}', 'base1-1', now() - interval '5 days'), ('${B}', 'base1-2', now() - interval '5 days'), ('${B}', 'base1-3', now() - interval '30 minutes'),
      ('${B}', 'jungle-1', now()), ('${B}', 'jungle-2', now()), ('${B}', 'jungle-4', now()),
      ('${C}', 'base1-1', now()), ('${C}', 'base1-2', now()), ('${C}', 'base1-3', now());`)
  let e = json(como(null, `select public.portada_comunidad(20)`, 'anon')) || []
  const tipos = e.map((x) => `${x.tipo}:${x.username}`)
  check('el día perfecto de misty, el mazo de ash y el campeón brock', tipos.includes('perfecto:misty') && tipos.includes('mazo:ash') && tipos.includes('campeon:brock'), tipos.join(' '))
  check('  …un mazo por persona (el último que tocó), y nada privado', e.filter((x) => x.tipo === 'mazo').length === 1 && e.find((x) => x.tipo === 'mazo').datos.nombre === 'Charizard ex' && !JSON.stringify(e).includes('Secreto'))
  check('  …un torneo en juego no tiene campeón', !JSON.stringify(e).includes('En juego'))
  check('  …sin colección pública no sale ninguna completa', !e.some((x) => x.tipo === 'coleccion'))
  sql(`update user_profiles set coleccion_publica = true where id in ('${B}', '${C}')`)
  e = json(como(null, `select public.portada_comunidad(20)`, 'anon')) || []
  const col = e.filter((x) => x.tipo === 'coleccion').map((x) => `${x.username}:${x.datos.nombre}`)
  check('con la colección pública: misty completó Base Set y brock también; Jungle no (le falta la 3)', col.includes('misty:Base Set') && col.includes('brock:Base Set') && !col.some((x) => x.includes('Jungle')), col.join(' '))
  check('  …lo más nuevo primero', e.every((x, i) => !i || e[i - 1].fecha >= x.fecha))
  check('  …y el límite se respeta', (json(como(null, `select public.portada_comunidad(2)`, 'anon')) || []).length === 2)
  console.log('── Los cuatro de la 845 ──')
  sql(`insert into tournament_registrations (tournament_id, user_id, status) select id, '${A}', 'active' from tournaments where slug = 'otono';
    insert into tournament_registrations (tournament_id, user_id, status) select id, '${B}', 'dropped' from tournaments where slug = 'otono';
    insert into user_follows (follower_id, following_id) values ('${A}', '${B}');
    insert into forum_threads (id, title, author_id, created_at) values ('00000000-0000-0000-0000-00000000aaaa', '¿Qué mazo llevo?', '${A}', now() - interval '1 hour');
    insert into forum_posts (thread_id, author_id, created_at) values
      ('00000000-0000-0000-0000-00000000aaaa', '${A}', now() - interval '1 hour'),
      ('00000000-0000-0000-0000-00000000aaaa', '${B}', now() - interval '50 minutes'),
      ('00000000-0000-0000-0000-00000000aaaa', '${B}', now() - interval '40 minutes');
    update user_collection set cambio = 1 where user_id = '${C}' and card_id in ('base1-1', 'base1-2');`)
  e = json(como(null, `select public.portada_comunidad(60)`, 'anon')) || []
  const t = (tipo) => e.filter((x) => x.tipo === tipo)
  check('ash se apuntó a la Liga de otoño (y la que se dio de baja no sale)', t('inscripcion').length === 1 && t('inscripcion')[0].username === 'ash' && t('inscripcion')[0].datos.nombre === 'Liga de otoño', JSON.stringify(t('inscripcion')))
  check('  …ash empezó a seguir a misty', t('sigue').length === 1 && t('sigue')[0].username === 'ash' && t('sigue')[0].datos.username === 'misty')
  check('  …con el rango del seguido, para pintarle el color (la 386)', 'is_admin' in t('sigue')[0].datos && 'is_moderator' in t('sigue')[0].datos)
  check('  …misty respondió en el tema, una sola vez aunque escribiera dos (y abrir el tema no cuenta)', t('respuesta').length === 1 && t('respuesta')[0].username === 'misty' && t('respuesta')[0].datos.titulo === '¿Qué mazo llevo?', JSON.stringify(t('respuesta')))
  check('  …y brock tiene 2 cartas para cambiar', t('cambio').length === 1 && t('cambio')[0].datos.cartas === 2)
  check('  …hasta 60', e.length <= 60)
  sql(`update user_profiles set hide_activity = true where id = '${B}'`)
  e = json(como(null, `select public.portada_comunidad(60)`, 'anon')) || []
  check('si el seguido oculta su actividad, el «sigue a» no sale', !e.some((x) => x.tipo === 'sigue'))
  sql(`update user_profiles set hide_activity = false where id = '${B}'`)
  sql(`update user_profiles set hide_activity = true where id = '${C}'`)
  e = json(como(null, `select public.portada_comunidad(20)`, 'anon')) || []
  check('quien oculta su actividad no sale en nada', !e.some((x) => x.username === 'brock'), e.map((x) => x.username).join(' '))
}
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
