// Tanda 952 — «L-P Promos» y «LEGEND Promos» son el mismo set japonés.
//
// En el foro: «L-P Promos y LEGEND Promos me aparecen duplicados». Contra
// PostgreSQL de verdad: sin los dos sets no toca nada; con ellos, las que
// están en los dos se funden (copias, deseos, avisos, vitrina, álbumes y
// versiones a la buena, con lápida), las demás se mudan con su corrección,
// el pequeño se esconde, y una segunda vez no hace nada.
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
const MIGRACION = join(RAIZ, 'supabase-migration-952-legend-promos-juntas.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_952'])
  psql(['-c', 'create database prueba_952'])
  for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-935.sql'), join(RAIZ, 'supabase-migration-935-ediciones-wizards.sql'), join(AQUI, 'sql-tanda-948.sql')]) {
    const r = psql(['-d', 'prueba_952', '-f', f])
    if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const r = psql(['-t', '-A', '-d', 'prueba_952', '-v', `migracion952=${MIGRACION}`, '-f', join(AQUI, 'sql-tanda-952-casos.sql')])
  const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check('los casos se ejecutan (sin sets, y con ellos dos veces)', r.status === 0 && lineas.length >= 20, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
  psql(['-c', 'drop database if exists prueba_952'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))
check('  …solo toca sets japoneses', (SQL.match(/market = 'JP'/g) || []).length >= 10 && !/market = 'WEST'/.test(SQL))
check('  …y lo borrado lleva lápida (la 934)', /'__borrada'/.test(SQL))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
