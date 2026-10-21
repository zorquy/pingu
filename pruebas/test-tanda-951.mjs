// Tanda 951 — la 1.ª edición y la Unlimited de todos los sets japoneses de
// julio de 2001 a septiembre de 2016, de una vez.
//
// PINGU: «¿por qué no lo haces tú automáticamente para todos los sets
// previos a esas fechas? Si no, tengo que ir de uno en uno».
// Contra PostgreSQL de verdad: el tramo (VS en 2001 entra, neo no; CP6 el
// 30-9-2016 entra, Sol y Luna no), sin promos ni escondidos ni lo ya hecho,
// las copias a Unlimited, y que una segunda vez no hace nada.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MIGRACION = join(RAIZ, 'supabase-migration-951-ediciones-japonesas-hasta-2016.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_951'])
  psql(['-c', 'create database prueba_951'])
  for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-935.sql'), join(RAIZ, 'supabase-migration-935-ediciones-wizards.sql'), join(AQUI, 'sql-tanda-948.sql')]) {
    const r = psql(['-d', 'prueba_951', '-f', f])
    if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const r = psql(['-t', '-A', '-d', 'prueba_951', '-v', `migracion948b=${join(RAIZ, 'supabase-migration-948b-ediciones-japonesas-faltan.sql')}`, '-v', `migracion951=${MIGRACION}`, '-f', join(AQUI, 'sql-tanda-951-casos.sql')])
  const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check('los casos se ejecutan (con la 948b antes y la 951 dos veces)', r.status === 0 && lineas.length >= 15, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
  psql(['-c', 'drop database if exists prueba_951'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))
check('  …pide la 935 antes de tocar nada', /Falta ejecutar antes supabase-migration-935/.test(SQL))
check('  …y el tramo es el de PINGU: de julio de 2001 al 30 de septiembre de 2016', /release_date >= date '2001-07-01'/.test(SQL) && /release_date <= date '2016-09-30'/.test(SQL))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
