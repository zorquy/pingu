// Tanda 1451 — Los tickets del juez se cierran solos, contra PostgreSQL:
//  · una mesa que termina cierra sus tickets abiertos y en curso (con nota, y
//    respetando la del juez); una que sigue viva no toca nada;
//  · el torneo terminado o cancelado cierra los que queden;
//  · la migración limpia lo colgado de antes y corre dos veces.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } })
const BD = 'prueba_1451'
const MIG = `${REPO}/supabase-migration-1451-tickets-que-se-cierran.sql`
const sql = readFileSync(MIG, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const q = (s) => { const r = psql(['-d', BD, '-c', s]); if (r.status !== 0) console.log(r.stderr); return (r.stdout || '').trim() }
q(`create table tournaments (id text primary key, status text);
  create table tournament_matches (id text primary key, status text);
  create table judge_calls (id text primary key, tournament_id text, match_id text, status text, resolved_at timestamptz, nota text);
  insert into tournaments values ('T1', 'in_progress'), ('T2', 'in_progress'), ('V', 'finished');
  insert into tournament_matches values ('m1', 'active'), ('m2', 'active'), ('m3', 'active'), ('v1', 'finished');
  insert into judge_calls (id, tournament_id, match_id, status, nota) values
    ('c1', 'T1', 'm1', 'open', null), ('c2', 'T1', 'm1', 'in_progress', 'Le di dos minutos'), ('c3', 'T1', 'm2', 'open', null),
    ('c4', 'T2', 'm3', 'open', null), ('c5', 'T2', 'm3', 'resolved', 'hecho'),
    ('viejo', 'V', 'v1', 'open', null);`)

const corre = (n) => psql(['-d', BD, '-f', MIG])
const r1 = corre(1)
check('la migración corre', r1.status === 0, r1.stderr)
check('  …y otra vez', corre(2).status === 0)
const estado = (id) => q(`select status || '|' || coalesce(nota, '') || '|' || (resolved_at is not null) from judge_calls where id = '${id}'`)
check('lo colgado de antes (torneo terminado) se cierra al migrar', estado('viejo').startsWith('resolved|Se cerró solo') && estado('viejo').endsWith('true'), estado('viejo'))

q(`update tournament_matches set status = 'finished' where id = 'm1'`)
check('la mesa termina: su ticket abierto se cierra solo, con nota', estado('c1') === 'resolved|Se cerró solo: la mesa terminó.|true', estado('c1'))
check('  …el que se atendía también, con la nota del juez', estado('c2') === 'resolved|Le di dos minutos|true', estado('c2'))
check('  …y el de otra mesa sigue abierto', estado('c3').startsWith('open|'), estado('c3'))
q(`update tournament_matches set status = 'disputed' where id = 'm2'`)
check('una mesa en disputa no cierra nada', estado('c3').startsWith('open|'), estado('c3'))
q(`update tournament_matches set status = 'forfeit_both' where id = 'm2'`)
check('nadie se presentó: también la cierra', estado('c3').startsWith('resolved|'), estado('c3'))

q(`update tournaments set status = 'cancelled' where id = 'T2'`)
check('torneo cancelado: cierra lo que quede', estado('c4') === 'resolved|Se cerró solo: el torneo se canceló.|true', estado('c4'))
check('  …y el ya resuelto no se toca', estado('c5') === 'resolved|hecho|false', estado('c5'))

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
