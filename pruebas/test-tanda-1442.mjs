// Tanda 1442 — prueba de carga y vigilancia de los torneos (tras el Tardeo de
// Testeo, donde 64 jugadores llenaron las 60 conexiones de la base).
//
//  1. Vigilancia: ninguna escucha de tiempo real de las tablas de un torneo
//     sin filtro, salvo el respaldo de torneo.js para cuando aún no está la
//     migración 1438, y ese respaldo va DESPUÉS del canal y con `return`.
//  2. Carga contra PostgreSQL de verdad: un torneo de 64 jugadores en la
//     séptima ronda (224 mesas con sus resultados, reportes y chat) y 60
//     conexiones a la vez —el tope de la base— pidiendo la ficha con
//     `torneo_ciclo` mientras otras escriben chat y resultados (cada
//     escritura dispara su aviso al canal). Se mira que no falle nada y que
//     la ficha tarde poco.
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

console.log('\n── 1. Vigilancia de las escuchas ──')
{
  const TABLAS = /^(rounds|tournament_matches|match_results|match_reports|match_messages|tournament_registrations|tournament_updates|judge_calls|judge_messages|tournaments)$/
  const ficheros = []
  const recorrer = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (f === 'vendor' || f === 'node_modules') continue
      if (statSync(p).isDirectory()) recorrer(p)
      else if (f.endsWith('.js')) ficheros.push(p)
    }
  }
  recorrer(join(REPO, 'js'))
  recorrer(join(REPO, 'admin/js'))
  const sinFiltro = []
  for (const f of ficheros) {
    const s = readFileSync(f, 'utf8')
    // Solo lo que está dentro de un escuchar({ … tablas: [ … ] }).
    for (const m of s.matchAll(/escuchar\(\{[\s\S]*?tablas:\s*\[([\s\S]*?)\]/g)) {
      for (const t of m[1].matchAll(/\{\s*tabla:\s*'([a-z_]+)'([^}]*)\}/g)) {
        if (TABLAS.test(t[1]) && !/filtro\s*:/.test(t[2])) sinFiltro.push(`${f.replace(REPO + '/', '')}:${t[1]}`)
      }
    }
  }
  const fuera = sinFiltro.filter((x) => !x.startsWith('js/torneos/torneo.js:'))
  check('sin escuchas sin filtro de tablas de torneo fuera del respaldo de torneo.js', fuera.length === 0, fuera.join(' | '))
  const t = readFileSync(join(REPO, 'js/torneos/torneo.js'), 'utf8')
  const canal = t.indexOf('if (ronda?.hayCanal?.() && escucharCanal)')
  const ret = t.indexOf('return', canal)
  const respaldo = t.indexOf("tablas: [", canal)
  check('en torneo.js, el canal va primero y corta (`return`) antes del respaldo', canal > 0 && ret > canal && respaldo > ret, `${canal} ${ret} ${respaldo}`)
  const vivo = readFileSync(join(REPO, 'js/vivo.js'), 'utf8')
  check('el canal del torneo es privado', /rt\.channel\(tema,\s*\{\s*config:\s*\{\s*private:\s*true/.test(vivo))
}

console.log('\n── 2. Carga contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000, env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } })
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
const BD = 'prueba_1442'
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const T = '00000000-0000-0000-0000-0000000000a1'
const ADMIN = '00000000-0000-0000-0000-0000000000f8'
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const andamio = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  create schema if not exists auth; create schema if not exists realtime;
  grant usage on schema auth, realtime, public to authenticated, anon;
  create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  create table realtime.enviados (payload jsonb, event text, topic text, private boolean);
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $f$
  begin insert into realtime.enviados values (payload, event, topic, private); end $f$;
  create table realtime.messages (id bigserial, topic text, extension text, payload jsonb, event text, private boolean);
  alter table realtime.messages enable row level security;
  create or replace function realtime.topic() returns text language sql as $f$ select current_setting('prueba.topic', true) $f$;
  create table tournaments (id uuid primary key, admin_id uuid, status text, current_round_id uuid, checkin_minutes int);
  create table rounds (id uuid primary key, tournament_id uuid, round_number int, phase text default 'swiss', status text, started_at timestamptz);
  create index on rounds (tournament_id);
  create table tournament_matches (id uuid primary key, round_id uuid, table_number int, player_a_id uuid, player_b_id uuid, status text, check_in_a_at timestamptz, check_in_b_at timestamptz, finished_at timestamptz);
  create index on tournament_matches (round_id);
  create table match_results (id uuid primary key default gen_random_uuid(), match_id uuid unique, result text, winner_id uuid, score text, resolved_by uuid);
  create table match_reports (id uuid primary key default gen_random_uuid(), match_id uuid, reporter_id uuid, result text);
  create index on match_reports (match_id);
  create table match_messages (id uuid primary key default gen_random_uuid(), match_id uuid, sender_id uuid, body text);
  create table tournament_registrations (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text, dropped_at timestamptz, dropped_after_round_id uuid);
  create index on tournament_registrations (tournament_id);
  create table tournament_updates (id uuid primary key default gen_random_uuid(), tournament_id uuid, body text);
  create table judge_calls (id uuid primary key default gen_random_uuid(), tournament_id uuid, match_id uuid, created_by uuid, status text default 'open');
  create table judge_messages (id uuid primary key default gen_random_uuid(), judge_call_id uuid, sender_id uuid, body text);
  create or replace function torneos_soy_admin() returns boolean language sql as $f$ select false $f$;
  create or replace function torneos_soy_juez(p uuid) returns boolean language sql as $f$ select false $f$;
  create or replace function torneos_mando(p uuid) returns boolean language sql stable as $f$ select exists (select 1 from tournaments t where t.id = p and t.admin_id = auth.uid()) $f$;
  grant select, insert on all tables in schema public to anon, authenticated;
  insert into tournaments values ('${T}', '${ADMIN}', 'in_progress', null, 5);
  insert into tournament_registrations (tournament_id, user_id, status) select '${T}', ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'active' from generate_series(1, 64) g;
  insert into rounds select ('00000000-0000-0000-0001-' || lpad(r::text, 12, '0'))::uuid, '${T}', r, 'swiss', case when r = 7 then 'active' else 'finished' end, now() - make_interval(mins => (8 - r) * 50) from generate_series(1, 7) r;
  insert into tournament_matches select ('00000000-0000-0000-0002-' || lpad((r * 100 + m)::text, 12, '0'))::uuid, ('00000000-0000-0000-0001-' || lpad(r::text, 12, '0'))::uuid, m,
    ('00000000-0000-0000-0000-' || lpad((m * 2 - 1)::text, 12, '0'))::uuid, ('00000000-0000-0000-0000-' || lpad((m * 2)::text, 12, '0'))::uuid,
    case when r = 7 and m > 10 then 'active' else 'finished' end, now(), now(), null from generate_series(1, 7) r, generate_series(1, 32) m;
  insert into match_results (match_id, result, winner_id) select id, 'a_wins', player_a_id from tournament_matches where status = 'finished';
  insert into match_reports (match_id, reporter_id, result) select id, player_a_id, 'win' from tournament_matches union all select id, player_b_id, 'loss' from tournament_matches;
  insert into match_messages (match_id, sender_id, body) select id, player_a_id, 'buena suerte' from tournament_matches;`])
check('el torneo de 64 jugadores, 7 rondas y 224 mesas', andamio.status === 0, andamio.stderr)
const mig = psql(['-d', BD, '-f', `${REPO}/supabase-migration-1438-torneos-sin-atascos.sql`])
check('la migración 1438 entra', mig.status === 0, mig.stderr)
psql(['-d', BD, '-c', 'truncate realtime.enviados'])

// Una ficha sola, 200 veces: lo que tarda de media.
const una = psql(['-d', BD, '-Atc', `set role authenticated; select set_config('prueba.uid', '${u(5)}', false);
  do $$ declare t0 timestamptz := clock_timestamp(); begin
    for i in 1..200 loop perform torneo_ciclo('${T}'); end loop;
    perform set_config('prueba.ms', (extract(epoch from clock_timestamp() - t0) * 1000 / 200)::text, false);
  end $$; select current_setting('prueba.ms');`])
const ms = Number(una.stdout.trim().split('\n').pop())
const tam = psql(['-d', BD, '-Atc', `set role authenticated; select set_config('prueba.uid', '${u(5)}', false); select length(torneo_ciclo('${T}')::text);`]).stdout.trim().split('\n').pop()
check(`la ficha de 224 mesas en una consulta: ${ms.toFixed(1)} ms de media`, ms > 0 && ms < 60, una.stderr)
console.log(`       (${Math.round(Number(tam) / 1024)} KB de JSON por llamada, sin comprimir)`)

// 60 conexiones a la vez durante 15 s: 9 de cada 10 piden la ficha (con un
// jugador cualquiera), 1 escribe un mensaje de chat o un reporte.
const DIR = mkdtempSync(join(tmpdir(), 'tanda-1442-'))
writeFileSync(join(DIR, 'leer.sql'), `\\set j random(1, 64)
set role authenticated;
select set_config('prueba.uid', '00000000-0000-0000-0000-' || lpad(:j::text, 12, '0'), false);
select torneo_ciclo('${T}');
reset role;
`)
writeFileSync(join(DIR, 'escribir.sql'), `\\set m random(1, 32)
insert into match_messages (match_id, sender_id, body) values (('00000000-0000-0000-0002-' || lpad((700 + :m)::text, 12, '0'))::uuid, '${u(1)}', 'gg');
insert into match_reports (match_id, reporter_id, result) values (('00000000-0000-0000-0002-' || lpad((700 + :m)::text, 12, '0'))::uuid, '${u(1)}', 'win');
`)
const carga = spawnSync('pgbench', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-n', '-c', '60', '-j', '6', '-T', '15', '-f', `${join(DIR, 'leer.sql')}@9`, '-f', `${join(DIR, 'escribir.sql')}@1`, BD], { encoding: 'utf8', timeout: 120000 })
const salida = carga.stdout + carga.stderr
const tps = Number((salida.match(/tps = ([\d.]+)/) || [])[1])
const lat = Number((salida.match(/latency average = ([\d.]+) ms/) || [])[1])
const fallidas = Number((salida.match(/number of failed transactions: (\d+)/) || [0, 0])[1])
const hechas = Number((salida.match(/number of transactions actually processed: (\d+)/) || [])[1])
check('60 conexiones a la vez, 15 s: ninguna transacción falla', carga.status === 0 && fallidas === 0 && hechas > 0, salida.slice(-600))
check(`… ${Math.round(tps)} por segundo, ${lat} ms de media (con 60 en cola a la vez)`, tps > 100 && lat < 600, salida.slice(-400))
// Para leer la cifra: un torneo de 64 con el canal pide la ficha cuando llega
// un aviso (con azar de 0,3–2,5 s) y como mucho una vez por minuto si no.
// Aunque las 64 fichas la pidieran a la vez, son 64 llamadas; aquí caben
// cientos por segundo.
const avisos = psql(['-d', BD, '-Atc', `select count(*), count(distinct topic), bool_and(private) from realtime.enviados`]).stdout.trim()
const [n, temas, privados] = avisos.split('|')
check('cada escritura dejó su aviso en el canal privado del torneo, y solo en ese', Number(n) > 0 && temas === '1' && privados === 't', avisos)
psql(['-c', `drop database if exists ${BD}`])

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
