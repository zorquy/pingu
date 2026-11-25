// Tandas 1438–1440 — Torneos sin atascos, contra PostgreSQL de verdad:
//  · torneo_ciclo: todo en una consulta; reportes solo de tu mesa (o todos si
//    llevas o arbitras); sin cuenta, ninguno; un borrador ajeno, null.
//  · torneo_difundir: cada cambio sale UNA vez por el canal privado del torneo;
//    lo privado sin contenido; y si Realtime falla, la escritura se guarda igual.
//  · torneos_reclamar_ausencia: la regla del barredor, con la hora de la base.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1438'
const MIG = `${REPO}/supabase-migration-1438-torneos-sin-atascos.sql`
const sql = readFileSync(MIG, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`
const T = '00000000-0000-0000-0000-0000000000a1', TB = '00000000-0000-0000-0000-0000000000b1'
const R1 = '00000000-0000-0000-0000-0000000000c1'
const M1 = '00000000-0000-0000-0000-0000000000d1', M2 = '00000000-0000-0000-0000-0000000000d2'
const base = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  create schema if not exists auth; create schema if not exists realtime;
  grant usage on schema auth, realtime, public to authenticated, anon;
  create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  -- Realtime, de mentira: send apunta lo que manda; con prueba.rt_roto, falla.
  create table realtime.enviados (payload jsonb, event text, topic text, private boolean);
  create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $f$
  begin
    if current_setting('prueba.rt_roto', true) = 'si' then raise exception 'realtime caído'; end if;
    insert into realtime.enviados values (payload, event, topic, private);
  end $f$;
  create table realtime.messages (id bigserial, topic text, extension text, payload jsonb, event text, private boolean);
  alter table realtime.messages enable row level security;
  grant select on realtime.messages to anon, authenticated;
  create or replace function realtime.topic() returns text language sql as $f$ select current_setting('prueba.topic', true) $f$;
  create table tournaments (id uuid primary key, admin_id uuid, status text, current_round_id uuid, checkin_minutes int);
  create table rounds (id uuid primary key, tournament_id uuid, round_number int, phase text default 'swiss', status text, started_at timestamptz);
  create table tournament_matches (id uuid primary key, round_id uuid, table_number int, player_a_id uuid, player_b_id uuid, status text, check_in_a_at timestamptz, check_in_b_at timestamptz, finished_at timestamptz);
  create table match_results (id uuid primary key default gen_random_uuid(), match_id uuid unique, result text, winner_id uuid, score text, resolved_by uuid);
  create table match_reports (id uuid primary key default gen_random_uuid(), match_id uuid, reporter_id uuid, result text);
  create table match_messages (id uuid primary key default gen_random_uuid(), match_id uuid, sender_id uuid, body text);
  create table tournament_registrations (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text, dropped_at timestamptz, dropped_after_round_id uuid, tcg_live_username text);
  create table tournament_updates (id uuid primary key default gen_random_uuid(), tournament_id uuid, body text);
  create table judge_calls (id uuid primary key default gen_random_uuid(), tournament_id uuid, match_id uuid, created_by uuid, status text default 'open');
  create table judge_messages (id uuid primary key default gen_random_uuid(), judge_call_id uuid, sender_id uuid, body text);
  create or replace function torneos_soy_admin() returns boolean language sql as $f$ select false $f$;
  create or replace function torneos_soy_juez(p uuid) returns boolean language sql as $f$ select auth.uid() = '${U(9)}'::uuid $f$;
  create or replace function torneos_mando(p uuid) returns boolean language sql as $f$ select exists (select 1 from tournaments t where t.id = p and t.admin_id = auth.uid()) or torneos_soy_juez(p) $f$;
  grant select on all tables in schema public to anon, authenticated;
  insert into tournaments values ('${T}', '${U(8)}', 'in_progress', '${R1}', 5), ('${TB}', '${U(8)}', 'draft', null, 5);
  insert into rounds values ('${R1}', '${T}', 1, 'swiss', 'active', now() - interval '10 minutes');
  insert into tournament_matches values ('${M1}', '${R1}', 1, '${U(1)}', '${U(2)}', 'active', now() - interval '9 minutes', null, null),
                                        ('${M2}', '${R1}', 2, '${U(3)}', '${U(4)}', 'active', now() - interval '9 minutes', now() - interval '9 minutes', null);
  insert into match_reports (match_id, reporter_id, result) values ('${M1}', '${U(1)}', 'win'), ('${M2}', '${U(3)}', 'win');
  insert into tournament_registrations (tournament_id, user_id, status) select '${T}', u, 'active' from unnest(array['${U(1)}','${U(2)}','${U(3)}','${U(4)}']::uuid[]) u;`])
check('el andamio', base.status === 0, base.stderr)
for (const v of [1, 2]) { const r = psql(['-d', BD, '-f', MIG]); check(`la migración corre (vez ${v})`, r.status === 0, r.stderr) }
const como = (uid, q, rol = 'authenticated', extra = '') => { const r = psql(['-At', '-d', BD, '-c', `set prueba.uid = '${uid}'; ${extra} set role ${rol}; ${q}`]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const admin = (q) => { const r = psql(['-At', '-d', BD, '-c', q]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }

console.log('── 1438. torneo_ciclo ──')
const ciclo = (uid, rol = 'authenticated') => { const r = como(uid, `select public.torneo_ciclo('${T}')`, rol); return r.ok ? JSON.parse(r.out) : { error: r.err } }
const j1 = ciclo(U(1))
check('trae rondas, mesas, resultados, reportes y bajas', j1.rondas?.length === 1 && j1.mesas?.length === 2 && Array.isArray(j1.resultados) && j1.bajas?.length === 4, JSON.stringify(j1).slice(0, 200))
check('un jugador ve SOLO los reportes de su mesa', j1.reportes?.length === 1 && j1.reportes[0].match_id === M1, JSON.stringify(j1.reportes))
check('quien organiza los ve todos', ciclo(U(8)).reportes?.length === 2)
check('un juez, también', ciclo(U(9)).reportes?.length === 2)
check('sin cuenta: las mesas sí, los reportes no', (() => { const a = ciclo('', 'anon'); return a.mesas?.length === 2 && a.reportes?.length === 0 })())
check('un borrador ajeno no se ve', como(U(1), `select public.torneo_ciclo('${TB}') is null`).out === 't')
check('las bajas no traen columnas privadas (solo las públicas)', Object.keys(j1.bajas[0]).sort().join() === 'dropped_after_round_id,dropped_at,id,status,user_id', Object.keys(j1.bajas[0]).join())

console.log('\n── 1439. El canal del torneo ──')
admin(`truncate realtime.enviados`)
admin(`update tournament_matches set check_in_b_at = now() where id = '${M1}'`)
let env = admin(`select topic || '|' || event || '|' || private || '|' || (payload->>'t') || '|' || (payload->'fila'->>'id') from realtime.enviados`).out
check('un cambio en una mesa sale UNA vez por «torneo:<id>», privado', env === `torneo:${T}|cambio|true|tournament_matches|${M1}`, env)
admin(`truncate realtime.enviados`)
como(U(1), `insert into match_messages (match_id, sender_id, body) values ('${M1}', '${U(1)}', 'secreto')`, 'postgres')
env = admin(`select payload::text from realtime.enviados`).out
check('un mensaje de chat avisa de QUÉ mesa, sin el texto', /"match_id"/.test(env) && !/secreto/.test(env), env)
admin(`truncate realtime.enviados`)
admin(`insert into match_reports (match_id, reporter_id, result) values ('${M2}', '${U(4)}', 'loss')`)
env = admin(`select payload::text from realtime.enviados`).out
check('un reporte avisa de la mesa, sin el resultado', /"match_id"/.test(env) && !/loss/.test(env), env)
admin(`truncate realtime.enviados`)
admin(`update tournament_registrations set status = 'dropped', tcg_live_username = 'privado' where user_id = '${U(4)}'`)
env = admin(`select payload::text from realtime.enviados`).out
check('una baja sale con su estado y sin columnas privadas', /"dropped"/.test(env) && !/privado/.test(env), env)
admin(`truncate realtime.enviados`)
const roto = psql(['-At', '-d', BD, '-c', `set prueba.rt_roto = 'si'; update tournament_matches set table_number = 7 where id = '${M2}'; select table_number from tournament_matches where id = '${M2}'`])
check('con Realtime caído la escritura se guarda igual', roto.status === 0 && roto.stdout.trim() === '7', roto.stderr)
admin(`update tournament_matches set table_number = 2 where id = '${M2}'`)
const pol = admin(`select count(*) from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'torneos_canal_leer' and cmd = 'SELECT'`).out
check('el canal tiene política de LEER y ninguna de escribir', pol === '1' && admin(`select count(*) from pg_policies where schemaname='realtime' and tablename='messages' and cmd <> 'SELECT'`).out === '0')
const lee = como('', `select count(*) from realtime.messages`, 'anon', `set prueba.topic = 'torneo:${T}'; insert into realtime.messages (topic, extension) values ('torneo:${T}', 'broadcast'), ('otro:1', 'broadcast');`)
check('sin cuenta se leen los avisos de un torneo', lee.ok && lee.out === '2', lee.out || lee.err)
const otro = como('', `select count(*) from realtime.messages`, 'anon', `set prueba.topic = 'mensajes:1';`)
check('…pero no los de otro canal', otro.ok && otro.out === '0', otro.out || otro.err)

console.log('\n── 1440. torneos_reclamar_ausencia ──')
check('quien no es de la mesa no puede', !como(U(3), `select public.torneos_reclamar_ausencia('${M1}')`).ok)
admin(`update tournament_matches set check_in_b_at = null where id = '${M1}'`)
admin(`update rounds set started_at = now() - interval '2 minutes' where id = '${R1}'`)
check('con el check-in aún abierto: «pronto»', como(U(1), `select public.torneos_reclamar_ausencia('${M1}')`).out === 'pronto')
admin(`update rounds set started_at = now() - interval '10 minutes' where id = '${R1}'`)
check('los dos presentes: no se cierra', como(U(3), `select public.torneos_reclamar_ausencia('${M2}')`).out === 'presentes')
const gana = como(U(1), `select public.torneos_reclamar_ausencia('${M1}')`)
check('vencido y el rival sin check-in: forfeit_b', gana.out === 'forfeit_b', gana.out || gana.err)
check('…con su resultado (gana A, motivo check_in)', admin(`select result || '|' || winner_id || '|' || score from match_results where match_id = '${M1}'`).out === `forfeit_b|${U(1)}|check_in`)
check('…y la mesa cerrada', admin(`select status from tournament_matches where id = '${M1}'`).out === 'forfeit_b')
check('pedirlo otra vez no duplica nada', como(U(2), `select public.torneos_reclamar_ausencia('${M1}')`).out === 'forfeit_b' && admin(`select count(*) from match_results where match_id = '${M1}'`).out === '1')
admin(`update tournaments set checkin_minutes = 0 where id = '${T}'`)
admin(`update tournament_matches set status = 'active', check_in_b_at = null where id = '${M2}'`)
check('sin ventana de check-in, no se cierra desde aquí', como(U(3), `select public.torneos_reclamar_ausencia('${M2}')`).out === 'sin_checkin')
check('sin cuenta no se puede llamar', !como('', `select public.torneos_reclamar_ausencia('${M2}')`, 'anon').ok)

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
