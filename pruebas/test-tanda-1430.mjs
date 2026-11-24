// Tanda 1430 — Lo que busca la gente y NO tienes, contra PostgreSQL:
//   · cuenta personas distintas (no tiendas, no baneados, no ella misma);
//   · lo que la tienda tiene con unidades no sale; con 0 unidades, sí;
//   · solo lo que buscan dos o más (con una, casi se sabe quién);
//   · el orden: más buscadas primero, y a igual, la más cara;
//   · una persona no puede preguntarlo; `tienda_quieren` cuenta las que se piden
//     (también desde dos);
//   · la migración aguanta dos veces y no usa tablas temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1430'
const MIG = `${REPO}/supabase-migration-1430-buscan-y-no-tienes.sql`
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(MIG, 'utf8')))
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const T = '00000000-0000-0000-0000-0000000000a1'
const OTRA = '00000000-0000-0000-0000-0000000000a2'
const P = (n) => `00000000-0000-0000-0000-00000000000${n}`
const base = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  create schema if not exists auth;
  grant usage on schema auth to authenticated;
  create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  grant usage on schema public to authenticated;
  create table user_profiles (id uuid primary key, tipo text not null default 'persona', is_banned boolean default false);
  create table user_wants (id uuid primary key default gen_random_uuid(), user_id uuid not null, card_id text not null, idioma text, variante text);
  create table tcg_cards (id text primary key, market text not null default 'WEST', set_id text, local_id text, name text, name_es text);
  create table tcg_card_prices (card_id text primary key, cm_trend numeric, cm_trend_holo numeric, cm_avg30 numeric);
  create table tienda_stock (id uuid primary key default gen_random_uuid(), tienda_id uuid, card_id text, unidades int not null default 1);
  insert into user_profiles values ('${T}', 'tienda', false), ('${OTRA}', 'tienda', false), ('${P(1)}', 'persona', false), ('${P(2)}', 'persona', false), ('${P(3)}', 'persona', false), ('${P(4)}', 'persona', true);
  insert into tcg_cards values ('a', 'WEST', 'sv1', '1', 'Charizard', null), ('b', 'WEST', 'sv1', '2', 'Pikachu', null), ('c', 'WEST', 'sv1', '3', 'Mew', null), ('d', 'WEST', 'sv1', '4', 'Eevee', null), ('e', 'WEST', 'sv1', '5', 'Umbreon', null);
  insert into tcg_card_prices values ('a', 100, null, null), ('b', 50, null, null), ('c', 10, null, null), ('d', 5, null, null), ('e', 900, null, null);
  -- a: 3 personas (+ una tienda y un baneado, que no cuentan) · b: 2 · c: 1 · d: 2 pero la tienda la tiene · e: 2, la tiene con 0 unidades
  insert into user_wants (user_id, card_id) values ('${P(1)}', 'a'), ('${P(2)}', 'a'), ('${P(3)}', 'a'), ('${OTRA}', 'a'), ('${P(4)}', 'a'), ('${P(1)}', 'a'),
    ('${P(1)}', 'b'), ('${P(2)}', 'b'), ('${T}', 'b'),
    ('${P(1)}', 'c'),
    ('${P(1)}', 'd'), ('${P(2)}', 'd'),
    ('${P(1)}', 'e'), ('${P(3)}', 'e');
  insert into tienda_stock (tienda_id, card_id, unidades) values ('${T}', 'd', 2), ('${T}', 'e', 0), ('${OTRA}', 'a', 1);`])
check('el andamio', base.status === 0, base.stderr)
for (const v of [1, 2]) { const r = psql(['-d', BD, '-f', MIG]); check(`la migración corre (vez ${v})`, r.status === 0, r.stderr) }
const como = (uid, sql) => { const r = psql(['-At', '-d', BD, '-c', `set prueba.uid = '${uid}'; set role authenticated; ${sql}`]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }

const lista = como(T, `select string_agg(card_id || ':' || quieren, ',' order by n) from (select *, row_number() over () n from public.tienda_buscan_y_no_tienes(8)) x`)
check('la tienda ve e:2, a:3, b:2 (más buscadas primero; a igual, la más cara)', lista.out === 'a:3,e:2,b:2', lista.out || lista.err)
check('no salen: la que tiene con unidades (d), la que busca una sola persona (c)', !/\b[cd]:/.test(lista.out), lista.out)
const persona = como(P(1), `select count(*) from public.tienda_buscan_y_no_tienes(8)`)
check('una persona no ve nada', persona.out === '0', persona.out || persona.err)
const tope = como(T, `select count(*) from public.tienda_buscan_y_no_tienes(1)`)
check('el límite se respeta', tope.out === '1', tope.out)
const q = como(T, `select string_agg(card_id || ':' || quieren, ',' order by card_id) from public.tienda_quieren(array['a','b','c','z'])`)
check('tienda_quieren: a:3, b:2 (c, una sola persona, y z, nadie: no vuelven)', q.out === 'a:3,b:2', q.out || q.err)
const q2 = como(P(2), `select count(*) from public.tienda_quieren(array['a'])`)
check('tienda_quieren de una persona: nada', q2.out === '0', q2.out)

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
