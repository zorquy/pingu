// Tanda 655 — el catálogo de TCGGO apunta lo que no se deja escribir.
//
// PINGU, con el «Expansion Pack» japonés abierto: «el logo está y te dice
// cuántas cartas contiene, pero cuando entras ves que no hay cartas». El
// set lo creó el catálogo —solo lo crea si TCGGO le dio cartas—, así que
// las cartas se pidieron y no se escribieron, y nada lo decía.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { procesar, CLAVE_ESTADO, MAXIMO_INTENTOS_EPISODIO } = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)

const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
const AHORA = new Date('2026-10-06T00:30:00Z')
// Dos expansiones japonesas: la 1 (Expansion Pack) y la 2 (Jungle).
const EPS_JP = [
  { id: 1, name: 'Expansion Pack', code: 'BASE1_', cards_total: 2, released_at: '1996-10-20', logo: null },
  { id: 2, name: 'Jungle', code: 'BASE2_', cards_total: 1, released_at: '1997-03-05', logo: null },
]
function montar({ guardar } = {}) {
  const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-10-05T10:00:00Z', lista: [] }, hechos: {} }, [CLAVE_ESTADO]: {} }
  const cartas = []
  const sets = []
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    const u = new URL(url)
    const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
    if (u.pathname.endsWith('/episodes')) return page(/pokemon-jp/.test(u.pathname) ? EPS_JP : [])
    const ep = Number(u.searchParams.get('episode_id'))
    if (ep === 1) return page([{ id: 101, name: 'フシギダネ', card_number: '001', cardmarket_id: null, type: 'singles' }, { id: 102, name: 'フシギソウ', card_number: '002', cardmarket_id: null, type: 'singles' }])
    if (ep === 2) return page([{ id: 201, name: 'ピカチュウ', card_number: '001', cardmarket_id: null, type: 'singles' }])
    return { ok: false, status: 404, text: async () => 'no' }
  }
  const restImpl = async (ruta) => {
    if (ruta.startsWith('tcg_sets?')) return sets.map((s) => ({ id: s.id, name: s.name, name_en: s.name_en, tcg_online_code: s.tcg_online_code, serie_id: null }))
    if (/set_id=in\./.test(ruta)) return []
    throw new Error(`ruta inesperada ${ruta}`)
  }
  return {
    estados, cartas, sets, urls,
    b: {
      env: ENV, fetchImpl, restImpl, pausa: async () => {}, ahora: AHORA,
      guardarCartasImpl: guardar || (async (filas, mercado) => { cartas.push(...filas.map((f) => ({ ...f, market: mercado }))); return filas.length }),
      crearSetsImpl: async (filas, mercado) => { sets.push(...filas.map((f) => ({ ...f, market: mercado }))); return filas.length },
      estadoImpl: async (clave) => estados[clave],
      guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
    },
  }
}

console.log('── 1. Una expansión que no se deja escribir se apunta, se cuenta y a la tercera se salta ──')
{
  // La base rechaza SIEMPRE la expansión 1 (como pasó con el Expansion
  // Pack) y acepta la 2.
  const m = montar({
    guardar: async (filas, mercado) => {
      if (filas.some((f) => f.tcggo_id === 101)) throw new Error('Supabase 400: null value in column "x" violates not-null constraint (23502)')
      m.cartas.push(...filas.map((f) => ({ ...f, market: mercado })))
      return filas.length
    },
  })
  const r1 = await procesar(m.b)
  const est = () => m.estados[CLAVE_ESTADO]
  check('la primera pasada se para en la 1 y lo APUNTA con su error', r1.ok === false && /intento 1 de 3/.test(r1.error) && est().fallidos.JP[1]?.intentos === 1 && /23502/.test(est().fallidos.JP[1].error) && est().ultimoError?.episodio === 1, JSON.stringify(est().fallidos))
  check('  …y el set se creó igual (así es como se ve el «0 de 102»)', m.sets.length === 1 && m.sets[0].tcg_online_code === 'BASE1_')
  const r2 = await procesar(m.b)
  check('la segunda, igual: dos intentos', r2.ok === false && est().fallidos.JP[1].intentos === 2)
  const r3 = await procesar(m.b)
  check(`a la ${MAXIMO_INTENTOS_EPISODIO}.ª se salta y SIGUE con la 2`, r3.ok === true && est().hechos.JP.includes(1) && est().hechos.JP.includes(2) && m.cartas.some((c) => c.tcggo_id === 201), JSON.stringify(r3.esteTurno))
  check('  …con la saltada en el turno, rotulada', r3.esteTurno.some((t) => t.episodio === 1 && t.fallido && t.intentos === 3))
  check('  …y el resumen dice cuántas fallaron', r3.fallidos.JP === 1 && r3.vacios.JP === 0 && r3.ultimoError.episodio === 1)
  const antes = m.urls.length
  await procesar(m.b)
  check('después no se vuelve a pedir la 1 a TCGGO (no es una factura)', m.urls.length === antes)
  // A la semana siguiente, los fallidos se olvidan y se vuelve a intentar.
  const r5 = await procesar({ ...m.b, ahora: new Date('2026-10-14T00:30:00Z') })
  check('a la semana siguiente se vuelve a intentar', r5.ok === false && est().fallidos.JP[1]?.intentos === 1)
}

console.log('\n── 2. Una escritura que escribe CERO filas se apunta ──')
{
  const m = montar({ guardar: async () => 0 })
  const r = await procesar(m.b)
  const est = m.estados[CLAVE_ESTADO]
  check('no es un error, y por eso se apunta: las dos expansiones en `vacios`', r.ok === true && est.vacios.JP[1]?.filas === 2 && est.vacios.JP[2]?.filas === 1 && r.vacios.JP === 2, JSON.stringify(est.vacios))
  check('  …y el turno dice las escritas', r.esteTurno.every((t) => t.escritas === 0))
  // Y si la semana siguiente sí escribe, deja de estar.
  const m2 = montar()
  m2.estados[CLAVE_ESTADO] = { ...m.estados[CLAVE_ESTADO], semana: 0 }
  const r2 = await procesar(m2.b)
  check('si después escribe, sale de la lista', r2.ok && Object.keys(m2.estados[CLAVE_ESTADO].vacios.JP).length === 0)
}

console.log('\n── 3. /admin lo enseña ──')
{
  const html = readFileSync(`${RAIZ}/admin/index.html`, 'utf8')
  const js = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('hay un botón de solo lectura con el estado', /id="btnTcggoEstado"/.test(html) && /btnTcggoEstado'\)\?\.addEventListener\('click', tcggoEstado\)/.test(js))
  check('  …que lee los cuatro estados y pinta el último error, los fallidos y los vacíos', /from\('scrydex_estado'\)[^]*?'tcggo_catalogo', 'tcggo_pares', 'tcggo_precios', 'tcggo_reemplazos'/.test(js) && /ultimoError/.test(js) && /fallidos/.test(js) && /vacios/.test(js))
  check('  …y no escribe nada', !/async function tcggoEstado\(\)[^]*?\.(insert|update|delete|upsert)\(/.test(js.slice(js.indexOf('async function tcggoEstado'), js.indexOf('async function tcggoEmparejar'))))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
