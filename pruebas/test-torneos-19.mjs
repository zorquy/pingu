import { REQUISITOS } from '/home/user/pingu/js/torneos/../schema-check.js'
import { readFileSync } from 'node:fs'

// Tanda 225: el comprobador de migraciones de /admin tenía 23 entradas
// y NINGUNA de torneos. Por eso una migración de torneos sin ejecutar no
// se notaba: el barredor aparca el paso en silencio.
//
// Esta prueba vigila que la lista no se quede atrás: cada columna que el
// comprobador dice vigilar tiene que existir de verdad en su fichero de
// migración, y las columnas nuevas de torneos tienen que estar vigiladas.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}
const REPO = '/home/user/pingu'
const lee = (f) => {
  try {
    return readFileSync(`${REPO}/${f}`, 'utf8')
  } catch {
    return null
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Torneos está vigilado ──')
{
  const deTorneos = REQUISITOS.filter((r) => r.fichero.includes('torneos') || r.fichero.includes('cartas-marcas'))
  check('hay entradas de torneos', deTorneos.length >= 3, `${deTorneos.length}`)
  const tablas = deTorneos.map((r) => r.tabla)
  check('se vigila la tabla de torneos', tablas.includes('tournaments'), JSON.stringify(tablas))
  check('y la de llamadas a juez', tablas.includes('judge_calls'), JSON.stringify(tablas))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Cada columna vigilada existe en su fichero ──')
{
  // El fallo silencioso que esto evita: escribir mal el nombre de una
  // columna en la lista. El comprobador diría «falta esta migración»
  // para siempre, aunque estuviera ejecutada — y se dejaría de mirar.
  const rotas = []
  for (const r of REQUISITOS) {
    const sql = lee(r.fichero)
    if (sql === null) {
      rotas.push(`${r.fichero} no existe`)
      continue
    }
    if (!sql.includes(r.columna)) rotas.push(`${r.tabla}.${r.columna} no está en ${r.fichero}`)
  }
  check('todas las columnas vigiladas existen', rotas.length === 0, rotas.slice(0, 4).join(' · '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Las columnas nuevas de esta tanda están vigiladas ──')
{
  // Si se añade una columna al SQL de torneos y no se vigila, volvemos
  // al punto de partida: la migración sin ejecutar no se nota.
  const vigiladas = new Set(REQUISITOS.map((r) => `${r.tabla}.${r.columna}`))
  for (const par of ['tournaments.finish_notified_at', 'judge_calls.notified_at']) {
    check(`vigila ${par}`, vigiladas.has(par))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Cada entrada dice qué se rompe ──')
{
  // Lo importante de la lista no es el nombre técnico sino el «rompe»:
  // sin eso, un aviso de que falta una migración no le dice a nadie si
  // corre prisa o puede esperar.
  const mudas = REQUISITOS.filter((r) => !r.rompe || r.rompe.length < 15)
  check('ninguna entrada se queda muda', mudas.length === 0, JSON.stringify(mudas.map((r) => r.tabla)))
}

console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
