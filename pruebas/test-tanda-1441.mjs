// Tanda 1441 — motivo, detalle y nota de una llamada al juez, contra PostgreSQL.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1441'
const MIG = `${REPO}/supabase-migration-1441-juez-con-tickets.sql`
const sql = readFileSync(MIG, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
const js = readFileSync(`${REPO}/js/torneos/jueces.js`, 'utf8')
const enJs = [...js.slice(js.indexOf('export const MOTIVOS'), js.indexOf(']\nconst CORTO')).matchAll(/\['(\w+)'/g)].map((m) => m[1])
const enSql = sql.match(/motivo in \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((x) => x.replace(/'/g, ''))
check('los motivos de la web y los de la base son los mismos', enJs.join() === enSql.join(), `${enJs} | ${enSql}`)
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
check('el andamio', psql(['-d', BD, '-c', `create table judge_calls (id uuid primary key default gen_random_uuid(), tournament_id uuid, match_id uuid, created_by uuid, status text default 'open'); insert into judge_calls (status) values ('open');`]).status === 0)
for (const v of [1, 2]) { const r = psql(['-d', BD, '-f', MIG]); check(`la migración corre (vez ${v})`, r.status === 0, r.stderr) }
const q = (x) => psql(['-At', '-d', BD, '-c', x])
check('una llamada vieja (sin motivo) sigue valiendo', q(`select count(*) from judge_calls where motivo is null`).stdout.trim() === '1')
check('con motivo y detalle', q(`insert into judge_calls (motivo, detalle) values ('desconexion', 'Se me cerró TCG Live')`).status === 0)
check('un motivo que no existe, no', q(`insert into judge_calls (motivo) values ('inventado')`).status !== 0)
check('un detalle de más de 200, no', q(`insert into judge_calls (motivo, detalle) values ('otro', repeat('x', 201))`).status !== 0)
check('una nota de más de 300, no', q(`update judge_calls set nota = repeat('x', 301)`).status !== 0)
psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
