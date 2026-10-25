// Tanda 996 — «Posibles repetidas» ve las promos de TCGGO («SVP 205» es
// «205») y lo que se junta no pierde sus versiones (se mudan a la principal
// y vuelven al deshacer). Contra PostgreSQL de verdad, encima de la 987, y
// los casos de la 987 siguen saliendo con la 996 puesta. Y la 1007 encima.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const M987 = join(RAIZ, 'supabase-migration-987-repetidas-en-versiones.sql')
const M996 = join(RAIZ, 'supabase-migration-996-repetidas-promos.sql')
const M1007 = join(RAIZ, 'supabase-migration-1007-repetidas-nombres.sql')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(M996, 'utf8')))
const montar = (bd, extra = []) => {
  psql(['-c', `drop database if exists ${bd}`])
  psql(['-c', `create database ${bd}`])
  for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-987.sql'), M987, M996, M996, ...extra]) {
    const r = psql(['-d', bd, '-f', f])
    if (r.status !== 0) return `${f.split('/').pop()}: ${(r.stderr || '').split('\n').find((l) => /ERROR/.test(l))}`
  }
  return null
}
const casos = (bd, fichero, minimo) => {
  const r = psql(['-t', '-A', '-d', bd, '-f', join(AQUI, fichero)])
  const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check(`${fichero} se ejecuta`, r.status === 0 && lineas.length >= minimo, (r.stderr || '').slice(0, 300))
  for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
}
if (hay.status === 0) {
  console.log('── 1. La 996 ──')
  let e = montar('prueba_996')
  check('carga la 987 y la 996 (dos veces)', !e, e)
  if (!e) casos('prueba_996', 'sql-tanda-996-casos.sql', 12)
  psql(['-c', 'drop database if exists prueba_996'])
  console.log('── 2. Los casos de la 987, con la 996 puesta ──')
  e = montar('prueba_996b')
  if (!e) casos('prueba_996b', 'sql-tanda-987-casos.sql', 30)
  else check('carga para los casos de la 987', false, e)
  psql(['-c', 'drop database if exists prueba_996b'])
  // La 1007 (nombres sin guiones ni signos) encima: sus casos, y los de la 987
  // y la 996 siguen saliendo con ella.
  console.log('── 3. La 1007, y lo de antes con ella puesta ──')
  check('la 1007 no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(M1007, 'utf8')))
  for (const [bd, fichero, minimo] of [['prueba_1007', 'sql-tanda-1007-casos.sql', 7], ['prueba_1007b', 'sql-tanda-996-casos.sql', 12], ['prueba_1007c', 'sql-tanda-987-casos.sql', 30]]) {
    e = montar(bd, [M1007, M1007])
    if (!e) casos(bd, fichero, minimo)
    else check(`carga la 1007 para ${fichero}`, false, e)
    psql(['-c', `drop database if exists ${bd}`])
  }
}
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
