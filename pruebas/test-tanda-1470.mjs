// Tanda 1470 — Sin check-in no hay resultado (Manso, vía PINGU), contra
// PostgreSQL de verdad: torneos_reportar, vencida la ventana de check-in con
// el de alguno sin hacer, cierra la mesa con la regla del barredor y NO apunta
// el parte; antes de vencer, o con los dos presentes, todo como siempre. Y la
// ficha esconde Victoria/Derrota y dice qué ha pasado.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1470'
const MIG = `${REPO}/supabase-migration-1470-sin-checkin-no-hay-resultado.sql`
const sql = readFileSync(MIG, 'utf8')

console.log('── La migración ──')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
check('reemplaza torneos_reportar con la misma firma', /create or replace function public\.torneos_reportar\(p_partida uuid, p_resultado text, p_juego smallint default 0\)/.test(sql))
check('el resto de la función es la de producción (la conciliación del BO3 sigue)', /BO3: se recuenta la SERIE/.test(sql) && /return 'juego';/.test(sql))

if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b'
const T = '00000000-0000-0000-0000-0000000000a1', R = '00000000-0000-0000-0000-0000000000c1'
const base = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  create table tournaments (id uuid primary key, checkin_minutes int, swiss_bo smallint default 1, top_cut_bo smallint default 3);
  create table rounds (id uuid primary key, tournament_id uuid, status text, phase text default 'swiss', started_at timestamptz);
  create table tournament_matches (id uuid primary key, round_id uuid, player_a_id uuid, player_b_id uuid, status text, check_in_a_at timestamptz, check_in_b_at timestamptz, finished_at timestamptz);
  create table match_reports (id uuid primary key default gen_random_uuid(), match_id uuid, reporter_id uuid, result text, game_number smallint default 0, reported_at timestamptz default now());
  create table match_results (match_id uuid primary key, result text, winner_id uuid, resolved_by uuid, score text);
  insert into tournaments values ('${T}', 5);`])
check('la base de prueba', base.status === 0, base.stderr)
const mig = psql(['-d', BD, '-f', MIG])
check('la migración entra', mig.status === 0, mig.stderr)
check('…y se puede ejecutar dos veces', psql(['-d', BD, '-f', MIG]).status === 0)

// Cada caso: una ronda empezada hace `hace` minutos y una mesa con los check-ins dados.
let n = 0
function caso({ hace, a = null, b = null }) {
  n++
  const M = `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`
  const ronda = `00000000-0000-0000-0000-0000000002${String(n).padStart(2, '0')}`
  psql(['-d', BD, '-c', `insert into rounds values ('${ronda}', '${T}', 'active', 'swiss', now() - interval '${hace} minutes');
    insert into tournament_matches values ('${M}', '${ronda}', '${A}', '${B}', 'active', ${a ? 'now()' : 'null'}, ${b ? 'now()' : 'null'}, null);`])
  return M
}
const reporta = (M, quien, res) => {
  const r = psql(['-d', BD, '-c', `set prueba.uid = '${quien}'; select public.torneos_reportar('${M}', '${res}', 0::smallint);`])
  return (r.stdout || '').trim().split('\n').pop() || r.stderr
}
const mesa = (M) => psql(['-d', BD, '-c', `select status || '|' || coalesce((select result || '/' || coalesce(winner_id::text,'-') || '/' || coalesce(score,'') from match_results where match_id = '${M}'), 'sin') || '|' || (select count(*) from match_reports where match_id = '${M}') from tournament_matches where id = '${M}'`]).stdout.trim()

console.log('── La regla ──')
{
  const M = caso({ hace: 2, a: false, b: false })
  check('dentro de la ventana, sin check-in todavía, se puede reportar como siempre', reporta(M, A, 'win') === 'esperando', mesa(M))
}
{
  const M = caso({ hace: 10, a: true, b: false })
  const r = reporta(M, B, 'win')
  check('vencida, B sin check-in pulsa Victoria → «sin_checkin»', r === 'sin_checkin', r)
  check('…la mesa cae para A (forfeit_b, ganador A, score check_in) y el parte de B no se apunta', mesa(M) === `forfeit_b|forfeit_b/${A}/check_in|0`, mesa(M))
}
{
  const M = caso({ hace: 10, a: true, b: false })
  const r = reporta(M, A, 'win')
  check('vencida, el que SÍ vino también la cierra (la ronda es suya)', r === 'sin_checkin' && mesa(M).startsWith('forfeit_b|'), `${r} ${mesa(M)}`)
}
{
  const M = caso({ hace: 10, a: false, b: false })
  check('vencida sin ninguno de los dos → forfeit_both, sin ganador', reporta(M, A, 'loss') === 'sin_checkin' && mesa(M) === 'forfeit_both|forfeit_both/-/check_in|0', mesa(M))
}
{
  const M = caso({ hace: 10, a: true, b: true })
  const r1 = reporta(M, A, 'win')
  const r2 = reporta(M, B, 'loss')
  check('vencida con los dos presentes, todo como siempre (esperando → conciliado)', r1 === 'esperando' && r2 === 'conciliado' && mesa(M).startsWith('finished|a_wins'), `${r1} ${r2} ${mesa(M)}`)
}
{
  psql(['-d', BD, '-c', `update tournaments set checkin_minutes = 0 where id = '${T}'`])
  const M = caso({ hace: 30, a: false, b: false })
  check('sin ventana de check-in (0 min), no se cierra nada: se reporta', reporta(M, A, 'win') === 'esperando', mesa(M))
  psql(['-d', BD, '-c', `update tournaments set checkin_minutes = 5 where id = '${T}'`])
}
psql(['-c', `drop database if exists ${BD}`])

console.log('── La ficha ──')
{
  const ronda = readFileSync(`${REPO}/js/torneos/ronda.js`, 'utf8')
  const css = readFileSync(`${REPO}/css/torneos.css`, 'utf8')
  check('la mesa lleva el aviso de «No hiciste check-in a tiempo» (escondido hasta que vence)', /data-checkin-falta/.test(ronda) && /No hiciste check-in a tiempo/.test(ronda) && /\.torneo-checkin-perdido \{ display: none; \}/.test(css))
  check('el tictac pone `.checkin-vencido` al vencer el plazo', /classList\.toggle\('checkin-vencido'/.test(ronda))
  check('…y entonces no hay Victoria/Derrota (ni BO3 ni check-in)', /\.checkin-vencido \.torneo-reportar,/.test(css) && /\.checkin-vencido \.torneo-bo3,/.test(css) && /\.checkin-vencido #btnCheckin,/.test(css))
  check('la respuesta «sin_checkin» tiene su aviso', /sin_checkin: \[/.test(ronda))
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
