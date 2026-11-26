// Tanda 1446 — Torneos en persona, contra PostgreSQL de verdad:
//  · las columnas y sus `check`; la migración corre dos veces;
//  · apuntarse: en persona sin TCG Live; online lo sigue pidiendo; con
//    «organizador» nadie se apunta solo;
//  · la puerta: dar entrada (al apuntado, al de la cola si hay sitio, al que
//    llega sin plaza si hay sitio), solo quien lleva el torneo; quitarla antes
//    de empezar; cerrar la puerta deja fuera a quien no entró (y con «libre»
//    no hace nada);
//  · el canal cuenta si alguien ha entrado.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } })
const BD = 'prueba_1446'
const MIG = `${REPO}/supabase-migration-1446-torneos-en-persona.sql`
const sql = readFileSync(MIG, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`
const ORG = U(8)
const P = '00000000-0000-0000-0000-0000000000a1' // en persona, «pedir», 3 plazas
const O = '00000000-0000-0000-0000-0000000000a2' // en persona, «organizador»
const L = '00000000-0000-0000-0000-0000000000a3' // en persona, «libre»
const N = '00000000-0000-0000-0000-0000000000a4' // online
const base = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  create schema if not exists auth; create schema if not exists realtime;
  grant usage on schema auth, realtime, public to authenticated, anon;
  create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  create table realtime.enviados (payload jsonb, event text, topic text, private boolean);
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $f$
  begin insert into realtime.enviados values (payload, event, topic, private); end $f$;
  create table user_profiles (id uuid primary key, username text);
  insert into user_profiles select ('00000000-0000-0000-0000-00000000000' || g)::uuid, 'u' || g from generate_series(1, 9) g;
  create table tournaments (id uuid primary key, admin_id uuid, status text, current_round_id uuid, checkin_minutes int, max_players int,
    is_private boolean default false, format text default 'standard');
  create table tournament_join_codes (tournament_id uuid, code text);
  create table tournament_matchday_closures (tournament_id uuid, matchday int);
  create or replace function torneos_num_jornadas(p uuid) returns int language sql as $f$ select 1 $f$;
  create or replace function torneos_jornada_con_rondas(p uuid, n int) returns boolean language sql as $f$ select false $f$;
  create table rounds (id uuid primary key, tournament_id uuid, round_number int, phase text default 'swiss', status text, started_at timestamptz);
  create table tournament_matches (id uuid primary key, round_id uuid, player_a_id uuid, player_b_id uuid, status text);
  create table match_results (id uuid primary key default gen_random_uuid(), match_id uuid unique, result text);
  create table match_reports (id uuid primary key default gen_random_uuid(), match_id uuid);
  create table match_messages (id uuid primary key default gen_random_uuid(), match_id uuid);
  create table tournament_registrations (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid,
    status text default 'active', tcg_live_username text not null, registered_at timestamptz default now(),
    dropped_at timestamptz, dropped_after_round_id uuid, participation_confirmed_at timestamptz);
  create table tournament_updates (id uuid primary key default gen_random_uuid(), tournament_id uuid);
  create table judge_calls (id uuid primary key default gen_random_uuid(), tournament_id uuid, match_id uuid, created_by uuid, status text);
  create table judge_messages (id uuid primary key default gen_random_uuid(), judge_call_id uuid);
  create or replace function torneos_mando(p uuid) returns boolean language sql stable as $f$ select exists (select 1 from tournaments t where t.id = p and t.admin_id = auth.uid()) $f$;
  grant select on all tables in schema public to anon, authenticated;
  insert into tournaments (id, admin_id, status, checkin_minutes, max_players) values
    ('${P}', '${ORG}', 'registration_open', 0, 3), ('${O}', '${ORG}', 'registration_open', 0, null),
    ('${L}', '${ORG}', 'registration_open', 0, null), ('${N}', '${ORG}', 'registration_open', 5, null);`])
check('el andamio', base.status === 0, base.stderr)
for (const v of [1, 2]) { const r = psql(['-d', BD, '-f', MIG]); check(`la migración corre (vez ${v})`, r.status === 0, r.stderr) }
// El disparador de la 1438 (ya ejecutada en producción), puesto en las inscripciones.
psql(['-d', BD, '-c', `create trigger torneo_difundir after insert or update or delete on public.tournament_registrations for each row execute function public.torneo_difundir();`])
const como = (uid, q) => { const r = psql(['-At', '-d', BD, '-c', `set prueba.uid = '${uid}'; set role authenticated; ${q}`]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const admin = (q) => { const r = psql(['-At', '-d', BD, '-c', q]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
admin(`update tournaments set modalidad = 'presencial', inscripcion = 'pedir', lugar = 'Cartas Bilbao', direccion = 'Calle Ercilla 12' where id = '${P}';
  update tournaments set modalidad = 'presencial', inscripcion = 'organizador' where id = '${O}';
  update tournaments set modalidad = 'presencial', inscripcion = 'libre' where id = '${L}';`)

console.log('── Las columnas ──')
check('un torneo nuevo es online y «libre» por defecto', admin(`select modalidad || '|' || inscripcion from tournaments where id = '${N}'`).out === 'online|libre')
check('una modalidad que no existe no entra', !admin(`update tournaments set modalidad = 'marte' where id = '${N}'`).ok)
check('una manera de apuntarse que no existe no entra', !admin(`update tournaments set inscripcion = 'cola' where id = '${N}'`).ok)
check('un sitio de más de 80 no entra', !admin(`update tournaments set lugar = repeat('x', 81) where id = '${N}'`).ok)

console.log('\n── Apuntarse ──')
const ins = (uid, t, tcg = '') => como(uid, `select public.torneos_inscribirse('${t}', '${tcg}') is not null`)
check('en persona, sin TCG Live: entra', ins(U(1), P).out === 't')
check('…y guarda el usuario de TCG Live vacío', admin(`select tcg_live_username = '' and entrada_at is null from tournament_registrations where user_id = '${U(1)}' and tournament_id = '${P}'`).out === 't')
check('online, sin TCG Live: no', /TCG Live/.test(ins(U(1), N).err))
check('online, con él: sí', ins(U(1), N, 'Ash_TCG').out === 't')
check('con «organizador», nadie se apunta solo', /te apunta quien lo organiza/.test(ins(U(1), O).err))
ins(U(2), P); ins(U(3), P); ins(U(4), P)
check('con 3 plazas, el cuarto va a la cola', admin(`select status from tournament_registrations where user_id = '${U(4)}' and tournament_id = '${P}'`).out === 'waitlisted')

console.log('\n── La puerta ──')
const dar = (uid, t, u) => como(uid, `select public.torneos_dar_entrada('${t}', '${u}')`)
check('un jugador no puede dar entrada', /Solo quien lleva/.test(dar(U(1), P, U(2)).err))
check('al apuntado: «entrada»', dar(ORG, P, U(1)).out === 'entrada')
check('otra vez: «ya_estaba»', dar(ORG, P, U(1)).out === 'ya_estaba')
check('quien está en la cola, sin sitio: no', /lista de espera/.test(dar(ORG, P, U(4)).err))
check('quien llega sin plaza pedida, sin sitio: no', /No quedan plazas/.test(dar(ORG, P, U(5)).err))
check('en un torneo online no hay puerta', /online/.test(dar(ORG, N, U(1)).err))
check('con «organizador», quien llega entra apuntado: «nuevo»', dar(ORG, O, U(6)).out === 'nuevo')
check('…activo, con la entrada y sin TCG Live', admin(`select status || '|' || (entrada_at is not null) || '|' || (entrada_por = '${ORG}') from tournament_registrations where user_id = '${U(6)}' and tournament_id = '${O}'`).out === 'active|true|true')
check('una cuenta que no existe, no', /No existe/.test(dar(ORG, O, '00000000-0000-0000-0000-000000000099').err))
check('quitar la entrada antes de empezar', como(ORG, `select public.torneos_quitar_entrada('${P}', '${U(1)}')`).out === 't' && admin(`select entrada_at is null from tournament_registrations where user_id = '${U(1)}' and tournament_id = '${P}'`).out === 't')
dar(ORG, P, U(1)); dar(ORG, P, U(2))

console.log('\n── Cerrar la puerta al empezar ──')
check('un jugador no puede cerrarla', /Solo quien lleva/.test(como(U(1), `select public.torneos_cerrar_puerta('${P}')`).err))
const n = como(ORG, `select public.torneos_cerrar_puerta('${P}')`).out
check('se quedan fuera los que no entraron: el 3 (apuntado) y el 4 (en la cola)', n === '2', n)
const est = admin(`select string_agg(right(user_id::text, 1) || ':' || status, ',' order by user_id) from tournament_registrations where tournament_id = '${P}'`).out
check('…el 1 y el 2 juegan; el 3 y el 4, fuera', est === '1:active,2:active,3:dropped,4:dropped', est)
ins(U(7), L)
check('con «libre» no deja a nadie fuera', como(ORG, `select public.torneos_cerrar_puerta('${L}')`).out === '0' && admin(`select status from tournament_registrations where tournament_id = '${L}'`).out === 'active')
admin(`insert into rounds (id, tournament_id, round_number, status) values (gen_random_uuid(), '${P}', 1, 'active')`)
check('empezado, ya no se quita una entrada', /ya ha empezado/.test(como(ORG, `select public.torneos_quitar_entrada('${P}', '${U(1)}')`).err))
check('quien se retiró no vuelve a entrar', /retiró/.test(dar(ORG, P, U(3)).err))

console.log('\n── El canal ──')
admin(`truncate realtime.enviados`)
dar(ORG, O, U(9))
const env = admin(`select payload->'fila'->>'entro' from realtime.enviados where payload->>'t' = 'tournament_registrations'`).out
check('dar entrada se cuenta por el canal («entro»: true), sin la hora', env === 'true', env)

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
