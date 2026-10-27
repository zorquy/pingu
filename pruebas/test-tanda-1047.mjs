// Tanda 1047 — los deseos con versión, contra PostgreSQL de verdad.
//
// Dos bases:
//   · la de los cruces (sql-tanda-1047.sql, sobre la de la 942): la columna,
//     el índice de no repetir, quién tiene / quién busca, el Mercado, el
//     aviso y el cambio que tacha el deseo; la migración, dos veces;
//   · la de juntar repetidas (la 885, 934, 987 y 996, más
//     sql-tanda-1047-repetidas.sql): los casos de la 987 tal cual con las
//     funciones nuevas, y que los deseos pasan con su versión y vuelven.
// Y que la migración no usa tablas temporales (CLAUDE.md, tanda 631).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const M = (n) => join(RAIZ, `supabase-migration-${n}.sql`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
const lineas = (r) => `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').map((l) => l.replace(/^psql:[^:]+:\d+: NOTICE:\s*/, '').trim()).filter((l) => /^(ok|MAL) /.test(l))

check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(M('1047-deseos-con-version'), 'utf8')))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  console.log('── Los cruces ──')
  {
    const bd = 'prueba_1047'
    psql(['-c', `drop database if exists ${bd}`])
    psql(['-c', `create database ${bd}`])
    const r = psql(['-d', bd, '-f', join(AQUI, 'sql-tanda-1047.sql')])
    check('se carga, con la migración dos veces', !/ERROR/.test(r.stderr || ''), (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)))
    const ls = lineas(r)
    check('salen los casos', ls.length >= 17, String(ls.length))
    for (const l of ls) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    psql(['-c', `drop database if exists ${bd}`])
  }
  console.log('── Juntar repetidas ──')
  {
    const bd = 'prueba_1047r'
    psql(['-c', `drop database if exists ${bd}`])
    psql(['-c', `create database ${bd}`])
    let e = null
    for (const f of [join(AQUI, 'sql-tanda-885.sql'), M('885-catalogo-correcciones'), join(AQUI, 'sql-tanda-934.sql'), M('934-versiones-a-mano'), join(AQUI, 'sql-tanda-987.sql'), M('987-repetidas-en-versiones'), M('996-repetidas-promos'), join(AQUI, 'sql-tanda-1047-repetidas.sql')]) {
      const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', bd, '-f', f])
      if (r.status !== 0) { e = `${f.split('/').pop()}: ${(r.stderr || '').split('\n').find((l) => /ERROR/.test(l))}`; break }
    }
    check('carga la 987, la 996 y la 1047 (dos veces)', !e, e)
    if (!e) {
      const c987 = psql(['-t', '-A', '-d', bd, '-f', join(AQUI, 'sql-tanda-987-casos.sql')])
      const l987 = lineas(c987)
      check('los casos de la 987, con las funciones de la 1047', l987.length >= 30 && l987.every((l) => l.startsWith('ok')), l987.filter((l) => !l.startsWith('ok')).join(' | ') || String(l987.length))
      const c = psql(['-d', bd, '-f', join(AQUI, 'sql-tanda-1047-repetidas-casos.sql')])
      const ls = lineas(c)
      check('salen los casos de la 1047', ls.length >= 2, (c.stderr || '').slice(0, 200))
      for (const l of ls) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    }
    psql(['-c', `drop database if exists ${bd}`])
  }
}
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
