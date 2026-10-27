// Tanda 1058 — evento_lista (la lista del QR del Modo evento), contra
// PostgreSQL de verdad (sobre la base de la 1047).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
const lineas = (r) => `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').map((l) => l.replace(/^psql:[^:]+:\d+: NOTICE:\s*/, '').trim()).filter((l) => /^(ok|MAL) /.test(l))
const sql = readFileSync(join(RAIZ, 'supabase-migration-1058-evento-lista.sql'), 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
check('evento_lista la ejecutan anon y authenticated', /grant execute on function public\.evento_lista\(uuid\) to anon, authenticated/.test(sql))
check('no toca la política de los deseos', !/policy/i.test(sql))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  const bd = 'prueba_1058'
  psql(['-c', `drop database if exists ${bd}`])
  psql(['-c', `create database ${bd}`])
  const r = psql(['-d', bd, '-f', join(AQUI, 'sql-tanda-1058.sql')])
  const errores = (r.stderr || '').split('\n').filter((l) => /ERROR/.test(l))
  check('se carga sin errores (la 1057 y la 1058 dos veces)', !errores.length, errores.join(' | '))
  const mios = lineas(r).filter((l) => /^(ok|MAL) 1058 /.test(l))
  check('salen los casos de la 1058', mios.length >= 4, String(mios.length))
  for (const l of mios) check(l.replace(/^(ok|MAL) 1058 /, ''), l.startsWith('ok'))
  psql(['-c', `drop database if exists ${bd}`])
}
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
