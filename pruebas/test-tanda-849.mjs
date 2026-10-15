// Tanda 849 — rondas por jornada: las cuentas puras, la migración contra
// PostgreSQL (sql-tanda-849.sql) y que las comprobaciones de la 635
// (sql-jornadas.sql) siguen saliendo con la migración nueva encima: con una
// ronda por jornada, todo tiene que seguir igual que antes.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const AQUI = new URL('.', import.meta.url).pathname
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Las cuentas ──')
{
  const m = await import(`${REPO}/js/torneos/rondas-jornada.js`)
  const t3 = { swiss_rounds: 30, rounds_per_matchday: 3 }
  const t1 = { swiss_rounds: 10 }
  check('10 × 3: 10 jornadas', m.numJornadas(t3) === 10)
  check('sin la columna, una ronda por jornada (como antes)', m.rondasPorJornada(t1) === 1 && m.numJornadas(t1) === 10 && m.jornadaDeRonda(t1, 7) === 7)
  check('la ronda 4 es la ronda 1 de la jornada 2; la 6, la 3 de la 2; la 7, la 1 de la 3', m.jornadaDeRonda(t3, 4) === 2 && m.rondaEnJornada(t3, 4) === 1 && m.jornadaDeRonda(t3, 6) === 2 && m.rondaEnJornada(t3, 6) === 3 && m.jornadaDeRonda(t3, 7) === 3 && m.rondaEnJornada(t3, 7) === 1)
  check('la primera ronda de la jornada 3 es la 7', m.primeraRondaDe(t3, 3) === 7)
  check('nombres: «ronda 2 de la jornada 2» y «jornada 4» (una por jornada)', m.nombreDeRondaDeLiga(t3, 5) === 'ronda 2 de la jornada 2' && m.nombreDeRondaDeLiga(t1, 4) === 'jornada 4' && m.nombreDeRondaDeLiga(t3, 5, { corto: true }) === 'J2·R2')
  check('un valor raro (0, texto) es 1', m.rondasPorJornada({ rounds_per_matchday: 0 }) === 1 && m.rondasPorJornada({ rounds_per_matchday: 'x' }) === 1)
  const tg = await import(`${REPO}/netlify/lib/telegram.mjs`)
  check('Telegram: «liga de 10 jornadas de 3 rondas»', tg.comoSeJuega({ format: 'league', swiss_rounds: 30, rounds_per_matchday: 3 }) === 'liga de 10 jornadas de 3 rondas')
  check('  …y una de antes, igual que siempre', tg.comoSeJuega({ format: 'league', swiss_rounds: 8 }) === 'liga de 8 jornadas')
  const mig = readFileSync(`${REPO}/supabase-migration-torneos-rondas-jornada.sql`, 'utf8')
  check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(mig))
  check('  …y quita el límite viejo por lo que comprueba, no por su nombre', /pg_get_constraintdef\(oid\) ilike '%swiss_rounds%'/.test(mig))
  check('la cuenta de la base es la misma que la del navegador (ceil y rangos)', /ceil\(t\.swiss_rounds::numeric/.test(mig) && /\(p_jornada - 1\) \* greatest/.test(mig))
}

console.log('── La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres']
  const hay = spawnSync('psql', [...PG, '-c', 'select 1'], { encoding: 'utf8' })
  if (hay.status !== 0) check('hay un PostgreSQL en /var/tmp:5433', false, hay.stderr)
  else {
    const correr = (ruta) => {
      const r = spawnSync('psql', [...PG, '-f', ruta], { encoding: 'utf8', timeout: 60000 })
      const salida = `${r.stdout || ''}${r.stderr || ''}`
      return { oks: (salida.match(/ {2}ok {2}/g) || []).length, fallos: salida.split('\n').filter((l) => /FALLA|ERROR/.test(l)) }
    }
    const a = correr(join(AQUI, 'sql-tanda-849.sql'))
    check(`sql-tanda-849.sql: ${a.oks} comprobaciones, ninguna falla`, a.oks >= 20 && !a.fallos.length, a.fallos.slice(0, 3).join(' | '))
    // La 635 con la migración nueva puesta encima de la suya.
    const vieja = readFileSync(join(AQUI, 'sql-jornadas.sql'), 'utf8')
    const marca = '\\i /home/user/pingu/supabase-migration-torneos-jornadas.sql\n\ngrant usage'
    check('sql-jornadas.sql tiene donde enganchar', vieja.includes(marca))
    const dir = mkdtempSync(join(tmpdir(), 'j849-'))
    const ruta = join(dir, 'sql-jornadas-849.sql')
    writeFileSync(ruta, vieja.replace(marca, '\\i /home/user/pingu/supabase-migration-torneos-jornadas.sql\n\\i /home/user/pingu/supabase-migration-torneos-rondas-jornada.sql\n\ngrant usage'))
    const b = correr(ruta)
    check(`la 635 con la 849 encima: ${b.oks} comprobaciones, ninguna falla`, b.oks >= 37 && !b.fallos.length, b.fallos.slice(0, 3).join(' | '))
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
