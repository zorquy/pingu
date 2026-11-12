// Tanda 1285 — EL CALENDARIO DE ADVIENTO, contra PostgreSQL.
//
// La base decide: qué casilla se puede abrir HOY (hora de España), que la XP
// solo entre la primera vez, que nadie escriba las casillas a mano ni vea las
// de otro, y que la 24.ª dé el logro una sola vez.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1285'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }

const ANA = '00000000-0000-0000-0000-0000000000a1'
const BEA = '00000000-0000-0000-0000-0000000000b2'
const como = (uid) => `select set_config('prueba.uid', '${uid}', false);`
// Como `authenticated`, que es como llega la web (y lo que mira la RLS).
const comoWeb = (uid, sql) => q(`${como(uid)} set role authenticated; ${sql}`)
const elDia = (iso) => q(`create or replace function public.adviento_hoy() returns date language sql stable as $f$ select '${iso}'::date $f$;`)
const abrir = (uid, dia) => comoWeb(uid, `select public.adviento_abrir(${dia})`)
const xp = (uid) => Number(q(`select total_xp from user_profiles where id = '${uid}'`).out)

console.log('── La migración, contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 (si no, pg_ctl -D /var/tmp/pg364 -o "-p 5433 -k /var/tmp" start)', hay.status === 0)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, total_xp int not null default 0, level int not null default 1, achievements text[] default '{}');
    grant select on user_profiles to anon, authenticated;
    create or replace function public.nivel_de_xp(p int) returns int language sql immutable as $f$ select 1 + p / 1000 $f$;
    create table achievement_definitions (id text primary key, title text, description text, emoji text, rarity text, xp_reward int, is_active boolean default true, condition jsonb);`])
  check('el andamio carga', r.status === 0, r.stderr)

  const mig = readFileSync(`${REPO}/supabase-migration-1285-adviento.sql`, 'utf8')
  check('la migración no usa tablas temporales (la 631)', !/temp(orary)?\s+table/i.test(mig))
  r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
  check('la 1285 entra', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
  check('  …y entra dos veces (se puede repetir)', r.status === 0, r.stderr)
  check('  …con su logro «Adviento 2026» de 50 XP y su icono', q(`select title || '|' || xp_reward || '|' || emoji || '|' || (condition->>'type') from achievement_definitions where id = 'adviento_2026'`).out === 'Adviento 2026|50|gift|adviento')
  q(`insert into user_profiles (id, username, total_xp) values ('${ANA}', 'ana', 100), ('${BEA}', 'bea', 0)`)

  console.log('── Qué casilla se puede abrir ──')
  elDia('2026-11-30')
  check('el 30 de noviembre, ninguna', !abrir(ANA, 1).ok)
  elDia('2026-12-03')
  let a = abrir(ANA, 3)
  check('el 3 de diciembre, la 3: +10 XP y la cuenta', a.ok && /"nueva": true/.test(a.out) && /"xp": 10/.test(a.out) && /"abiertas": 1/.test(a.out) && xp(ANA) === 110, a.out + a.err)
  a = abrir(ANA, 3)
  check('  …abrirla otra vez no suma nada', a.ok && /"nueva": false/.test(a.out) && /"xp": 0/.test(a.out) && xp(ANA) === 110, a.out + a.err)
  a = abrir(ANA, 1)
  check('  …una de días pasados (la 1) se abre tarde, con su XP', a.ok && /"xp": 10/.test(a.out) && xp(ANA) === 120, a.out + a.err)
  check('  …la de mañana (la 4), no', !abrir(ANA, 4).ok)
  check('  …ni la 0 ni la 25', !abrir(ANA, 0).ok && !abrir(ANA, 25).ok)
  check('sin sesión, nada', !q(`select set_config('prueba.uid', '', false); set role anon; select public.adviento_abrir(1)`).ok)

  console.log('── Nadie escribe ni mira lo de otro ──')
  check('insertar una casilla a mano, no (sin política de escritura)', !comoWeb(BEA, `insert into adviento_casillas (user_id, anio, dia) values ('${BEA}', 2026, 3)`).ok)
  check('Bea no ve las casillas de Ana', comoWeb(BEA, 'select count(*) from adviento_casillas').out.split('\n').pop() === '0')
  check('Ana ve las suyas (2)', comoWeb(ANA, 'select count(*) from adviento_casillas').out.split('\n').pop() === '2')

  console.log('── Las 24: el logro, una vez ──')
  elDia('2026-12-24')
  let ultima = null
  for (let d = 1; d <= 24; d++) { const x = abrir(BEA, d); if (!x.ok) check(`Bea abre la ${d}`, false, x.err); ultima = x }
  check('la 24.ª da el logro y sus 50 XP (24×10 + 50)', /"logro": "adviento_2026"/.test(ultima.out) && /"abiertas": 24/.test(ultima.out) && /"xp": 60/.test(ultima.out) && xp(BEA) === 290, ultima.out)
  check('  …el logro queda apuntado en su perfil', q(`select 'adviento_2026' = any(achievements) from user_profiles where id = '${BEA}'`).out === 't')
  check('  …y su nivel va con su XP (en el mismo update)', q(`select level from user_profiles where id = '${BEA}'`).out === '1')
  a = abrir(BEA, 24)
  check('abrir otra vez la 24 no lo vuelve a dar', /"logro": null/.test(a.out) && /"xp": 0/.test(a.out) && xp(BEA) === 290, a.out)

  console.log('── Después del 24 y en enero ──')
  elDia('2026-12-31')
  a = abrir(ANA, 20)
  check('el 31 todavía se abren las que faltan', a.ok && /"xp": 10/.test(a.out), a.out + a.err)
  elDia('2027-01-01')
  check('el 1 de enero, ya no', !abrir(ANA, 21).ok)

  console.log('── La función, solo para quien tiene sesión ──')
  check('anon no puede ejecutarla', q(`select has_function_privilege('anon', 'public.adviento_abrir(int)', 'execute')`).out === 'f')
  check('authenticated sí', q(`select has_function_privilege('authenticated', 'public.adviento_abrir(int)', 'execute')`).out === 't')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
