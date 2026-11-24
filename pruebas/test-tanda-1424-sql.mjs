// Tanda 1424 — el SQL que devuelve las rachas perdidas con protectores
// guardados, contra PostgreSQL de verdad y sentencia a sentencia (cada una en
// su conexión, como el SQL Editor; la 631).
//   · Quien faltó dos días con dos protectores recupera lo que llevaba y se
//     queda sin protectores (sergio.m).
//   · Quien no faltó, o faltó más días que protectores, no cambia.
//   · Una tienda (racha 0) no se toca.
//   · La sentencia 1 solo mira.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
execFileSync('psql', [...BASE, '-c', 'drop database if exists t1424'], { stdio: 'ignore' })
execFileSync('psql', [...BASE, '-c', 'create database t1424'], { stdio: 'ignore' })
const PSQL = [...BASE, '-d', 't1424']
const psql = (sql) => execFileSync('psql', [...PSQL, '-c', sql], { encoding: 'utf8' })
const leer = (sql) => execFileSync('psql', [...PSQL, '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim()

// Días seguidos (UTC) de `desde` a `hasta`, ambos incluidos.
const dias = (desde, hasta) => {
  const out = []
  for (let t = Date.parse(desde); t <= Date.parse(hasta); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}
const PERSONAS = {
  // 30 días seguidos, fuera el 19 y el 20 con dos protectores, vuelve 4 días.
  sergio: { id: '00000000-0000-0000-0000-000000000001', racha: 4, esc: 2, dias: [...dias('2026-10-20', '2026-11-18'), ...dias('2026-11-21', '2026-11-24')] },
  constante: { id: '00000000-0000-0000-0000-000000000002', racha: 40, esc: 2, dias: dias('2026-10-16', '2026-11-24') },
  // Tres días fuera con dos: no alcanzaba con ninguna regla.
  tres: { id: '00000000-0000-0000-0000-000000000003', racha: 3, esc: 2, dias: [...dias('2026-10-20', '2026-11-18'), ...dias('2026-11-22', '2026-11-24')] },
  tienda: { id: '00000000-0000-0000-0000-000000000004', racha: 0, esc: 0, dias: [...dias('2026-10-20', '2026-11-18'), ...dias('2026-11-21', '2026-11-24')] },
  // Un día fuera con un protector: la regla de antes ya lo salvaba.
  uno: { id: '00000000-0000-0000-0000-000000000005', racha: 34, esc: 1, dias: [...dias('2026-10-20', '2026-11-08'), ...dias('2026-11-10', '2026-11-24')] },
}
psql(`create table user_profiles (id uuid primary key, username text, current_streak int not null default 0, last_active_date date, streak_shields int not null default 0);
create table page_views (id serial, user_id uuid, path text, created_at timestamptz);`)
for (const [nombre, p] of Object.entries(PERSONAS)) {
  psql(`insert into user_profiles values ('${p.id}', '${nombre}', ${p.racha}, '${p.dias.at(-1)}', ${p.esc})`)
  // Dos visitas por día, una a última hora UTC (el día es el UTC, no el de España).
  const filas = p.dias.flatMap((d) => [`('${p.id}', '/', '${d} 09:00:00+00')`, `('${p.id}', '/foro', '${d} 23:30:00+00')`])
  psql(`insert into page_views (user_id, path, created_at) values ${filas.join(',')}`)
}
// Una visita sin sesión no cuenta para nadie.
psql(`insert into page_views (user_id, path, created_at) values (null, '/', '2026-11-19 10:00:00+00')`)

const sql = readFileSync(`${RAIZ}/supabase-migration-1424-rachas-devueltas.sql`, 'utf8')
const sentencias = sql.replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)
check('dos sentencias, sin tablas temporales', sentencias.length === 2 && !/create\s+(temp|temporary)/i.test(sql), sentencias.length)

const antes = leer('select username, current_streak, streak_shields from user_profiles order by username')
const vista = leer(sentencias[0])
check('la 1 enseña solo a sergio: de 4 a 34, sin protectores, y cuadra con la web', vista === 'sergio|4|2|30|34|0|t', vista)
check('la 1 no cambia nada', leer('select username, current_streak, streak_shields from user_profiles order by username') === antes)

psql(sentencias[1])
const fila = (n) => leer(`select current_streak || '/' || streak_shields from user_profiles where username = '${n}'`)
check('sergio recupera la racha (34) y gasta los dos protectores', fila('sergio') === '34/0', fila('sergio'))
check('quien no faltó, igual', fila('constante') === '40/2', fila('constante'))
check('tres días fuera con dos, igual', fila('tres') === '3/2', fila('tres'))
check('la tienda, igual', fila('tienda') === '0/0', fila('tienda'))
check('un día fuera con uno (ya se salvaba), igual', fila('uno') === '34/1', fila('uno'))
psql(sentencias[1])
check('ejecutarla otra vez no suma dos veces', fila('sergio') === '34/0', fila('sergio'))

execFileSync('psql', [...BASE, '-c', 'drop database t1424'], { stdio: 'ignore' })
console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
