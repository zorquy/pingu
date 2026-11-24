// Tanda 1432 — Novedades de una tienda, contra PostgreSQL:
//   · solo una tienda publica; el texto, de 1 a 280;
//   · avisa a quien la sigue (no a baneados ni a quien lo tiene apagado);
//   · las cartas: solo las que existen, sin repetir, seis como mucho, en orden;
//   · una por semana, y borrar no devuelve la semana;
//   · borrar la esconde y quita los avisos sin abrir (no los abiertos);
//   · la ve todo el mundo (anon también) y nadie la escribe a pelo;
//   · el estado: seguidores y «próxima»;
//   · la migración aguanta dos veces y no usa tablas temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1432'
const MIG = `${REPO}/supabase-migration-1432-novedades-de-tienda.sql`
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(MIG, 'utf8')))
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const T = '00000000-0000-0000-0000-0000000000a1'
const P = (n) => `00000000-0000-0000-0000-00000000000${n}`
const base = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  create schema if not exists auth;
  grant usage on schema auth to authenticated, anon;
  create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  grant usage on schema public to authenticated, anon;
  create table user_profiles (id uuid primary key, username text, display_name text, tipo text not null default 'persona', is_banned boolean default false, notification_prefs_disabled text[] not null default '{}');
  create table user_follows (follower_id uuid, following_id uuid, primary key (follower_id, following_id));
  create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now());
  create table tcg_cards (id text primary key, market text not null default 'WEST', name text);
  insert into user_profiles (id, username, display_name, tipo, is_banned, notification_prefs_disabled) values
    ('${T}', 'cartasbilbao', 'Cartas Bilbao', 'tienda', false, '{}'),
    ('${P(1)}', 'ane', null, 'persona', false, '{}'),
    ('${P(2)}', 'iker', null, 'persona', false, '{}'),
    ('${P(3)}', 'malo', null, 'persona', true, '{}'),
    ('${P(4)}', 'callado', null, 'persona', false, '{tienda_novedad}'),
    ('${P(5)}', 'nosigue', null, 'persona', false, '{}');
  insert into user_follows values ('${P(1)}', '${T}'), ('${P(2)}', '${T}'), ('${P(3)}', '${T}'), ('${P(4)}', '${T}'), ('${P(5)}', '${P(1)}');
  insert into tcg_cards values ('a', 'WEST', 'A'), ('b', 'WEST', 'B'), ('c', 'WEST', 'C'), ('d', 'WEST', 'D'), ('e', 'WEST', 'E'), ('f', 'WEST', 'F'), ('g', 'WEST', 'G'), ('j1', 'JP', 'J');`])
check('el andamio', base.status === 0, base.stderr)
for (const v of [1, 2]) { const r = psql(['-d', BD, '-f', MIG]); check(`la migración corre (vez ${v})`, r.status === 0, r.stderr) }
const como = (uid, sql, rol = 'authenticated') => { const r = psql(['-At', '-d', BD, '-c', `set prueba.uid = '${uid}'; set role ${rol}; ${sql}`]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const admin = (sql) => { const r = psql(['-At', '-d', BD, '-c', sql]); return (r.stdout || '').trim() }

const persona = como(P(1), `select public.tienda_publicar_novedad('Hola', '[]')->>'motivo'`)
check('una persona no publica', persona.out === 'solo_tiendas', persona.out || persona.err)
const vacio = como(T, `select public.tienda_publicar_novedad('   ', '[]')->>'motivo'`)
check('sin texto, no', vacio.out === 'texto', vacio.out || vacio.err)
const largo = como(T, `select public.tienda_publicar_novedad(repeat('x', 281), '[]')->>'motivo'`)
check('más de 280, no', largo.out === 'texto', largo.out || largo.err)

const cartas = `'[{"card_id":"b"},{"card_id":"zz"},{"card_id":"a"},{"card_id":"b"},{"card_id":"c"},{"card_id":"d"},{"card_id":"e"},{"card_id":"f"},{"card_id":"g"},{"card_id":"j1","market":"JP"}]'`
const pub = como(T, `select public.tienda_publicar_novedad('  Ha llegado la caja de 151  ', ${cartas})`)
const r = JSON.parse(pub.out || '{}')
check('la tienda publica', pub.ok && r.vale === true && r.id, pub.out || pub.err)
check('avisa a 2: no al baneado, ni a quien lo apagó, ni a quien no la sigue', r.avisados === 2, pub.out)
const avisos = admin(`select string_agg(u.username || '|' || n.title || '|' || n.body || '|' || n.link, ' ; ' order by u.username) from user_notifications n join user_profiles u on u.id = n.recipient_id where n.type = 'tienda_novedad'`)
check('el aviso: «Cartas Bilbao tiene novedades», el texto y el enlace a la novedad', avisos === `ane|Cartas Bilbao tiene novedades|Ha llegado la caja de 151|/tiendas/cartasbilbao#novedad-${r.id} ; iker|Cartas Bilbao tiene novedades|Ha llegado la caja de 151|/tiendas/cartasbilbao#novedad-${r.id}`, avisos)
const guardada = admin(`select texto || '|' || (select string_agg(e->>'card_id', ',' order by n) from jsonb_array_elements(cartas) with ordinality as x(e, n)) from tienda_novedades where id = '${r.id}'`)
check('las cartas: b, a, c, d, e, f (sin la que no existe, sin repetir, seis)', guardada === 'Ha llegado la caja de 151|b,a,c,d,e,f', guardada)

const otra = como(T, `select public.tienda_publicar_novedad('Otra más', '[]')`)
const o = JSON.parse(otra.out || '{}')
check('la segunda en la semana: no, y dice cuándo', o.vale === false && o.motivo === 'una_por_semana' && !!o.proxima, otra.out || otra.err)
const est = JSON.parse(como(T, `select public.tienda_novedades_estado()`).out || '{}')
check('el estado: 4 seguidores y la próxima', est.seguidores === 4 && !!est.proxima, JSON.stringify(est))
check('el estado de una persona: nada', como(P(1), `select public.tienda_novedades_estado() is null`).out === 't')

check('la ve una persona', como(P(5), `select count(*) from public.tienda_novedades`).out === '1')
check('y sin cuenta (anon)', como('', `select count(*) from public.tienda_novedades`, 'anon').out === '1')
const pelo = como(T, `insert into public.tienda_novedades (tienda_id, texto) values ('${T}', 'a pelo')`)
check('nadie la escribe a pelo', !pelo.ok, pelo.err)

admin(`update user_notifications set read_at = now() where recipient_id = '${P(1)}'`)
check('otra tienda no la borra', como(P(1), `select public.tienda_borrar_novedad('${r.id}')`).out === 'f')
check('la tienda la borra', como(T, `select public.tienda_borrar_novedad('${r.id}')`).out === 't')
check('ya no se ve', como(P(5), `select count(*) from public.tienda_novedades`).out === '0')
check('se quita el aviso sin abrir (iker) y queda el abierto (ane)', admin(`select string_agg(u.username, ',') from user_notifications n join user_profiles u on u.id = n.recipient_id where n.type = 'tienda_novedad'`) === 'ane')
const tras = JSON.parse(como(T, `select public.tienda_publicar_novedad('Tras borrar', '[]')`).out || '{}')
check('borrar no devuelve la semana', tras.motivo === 'una_por_semana', JSON.stringify(tras))

admin(`update tienda_novedades set created_at = now() - interval '8 days'`)
const nueva = JSON.parse(como(T, `select public.tienda_publicar_novedad('A la semana siguiente', '[]')`).out || '{}')
check('a los siete días, otra (y avisa a los dos de nuevo)', nueva.vale === true && nueva.avisados === 2, JSON.stringify(nueva))

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
