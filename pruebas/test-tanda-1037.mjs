// Tanda 1037 — «Posibles repetidas» junta también por el nombre inglés y el
// español, y el Zekrom de N (MEP 031) se junta en una sola carta con la
// función de /admin y un admin prestado. Contra PostgreSQL de verdad, encima
// de la 987, la 996 y la 1007, ejecutando la migración dos veces.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const M = (n) => join(RAIZ, `supabase-migration-${n}.sql`)
const M1037 = M('1037-repetidas-por-idioma')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(M1037, 'utf8')))
if (hay.status === 0) {
  const bd = 'prueba_1037'
  psql(['-c', `drop database if exists ${bd}`])
  psql(['-c', `create database ${bd}`])
  let e = null
  for (const f of [join(AQUI, 'sql-tanda-885.sql'), M('885-catalogo-correcciones'), join(AQUI, 'sql-tanda-934.sql'), M('934-versiones-a-mano'), join(AQUI, 'sql-tanda-987.sql'), M('987-repetidas-en-versiones'), M('996-repetidas-promos'), M('1007-repetidas-nombres'), join(AQUI, 'sql-tanda-1037-datos.sql')]) {
    const r = psql(['-d', bd, '-f', f])
    if (r.status !== 0) { e = `${f.split('/').pop()}: ${(r.stderr || '').split('\n').find((l) => /ERROR/.test(l))}`; break }
  }
  check('carga la 987, la 996, la 1007 y los datos', !e, e)
  if (!e) {
    const r1 = psql(['-d', bd, '-f', M1037])
    check('la 1037 se ejecuta', r1.status === 0, r1.stderr)
    check('  …y dice que ha juntado el Zekrom', /tcggo-33636 juntada en mep-031/.test(r1.stderr), r1.stderr)
    check('  …y su consulta final enseña una sola MEP 031', (r1.stdout.match(/mep-031/g) || []).length === 1 && !/tcggo-33636 \|/.test(r1.stdout), r1.stdout)
    const r2 = psql(['-d', bd, '-f', M1037])
    check('una segunda vez no hace nada y lo dice', r2.status === 0 && /ya estaba resuelto/.test(r2.stderr), r2.stderr)
    const r = psql(['-t', '-A', '-d', bd, '-f', join(AQUI, 'sql-tanda-1037-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('sql-tanda-1037-casos.sql se ejecuta', r.status === 0 && lineas.length >= 12, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
  }
  psql(['-c', `drop database if exists ${bd}`])
}
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
