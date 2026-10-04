// Tanda 526 — la noche entera escribiendo CERO cartas.
//
// PINGU se despertó con el panel diciendo «0 de 21.476» en las tres
// barras y, en la fila de la pasada: `23502`, que es `not_null_violation`.
// La fila que fallaba era `(sv10-001, sv10, null, null, …`.
//
// LA CAUSA: `tcg_cards` tiene `local_id` y `name` a `not null`, y esto es
// un UPSERT. PostgREST manda `insert … on conflict do update`, así que
// **Postgres forma la fila que insertaría ANTES de ver que ya existe** —y
// una fila sin `local_id` no se puede formar—. Resultado: 23502 y la
// sentencia rechazada ENTERA, las 250 cartas de la página, aunque las 250
// existieran ya y aquello fuera a ser un update.
//
// LA SEGUNDA MITAD, que es la que lo hizo caro: anoche junté el fallo
// SUYO y el NUESTRO en el mismo manejador, y saltarse la página a la
// quinta solo vale para el suyo. Si el que falla es nuestro Supabase, la
// página no tiene nada que ver: saltarla es pagar un crédito por página
// para no escribir nada. Cinco intentos × 101 páginas = 505 créditos para
// un barrido en blanco, y el panel enseñando «página 42» como si fuera
// progreso.
import { readFileSync } from 'node:fs'
import { filaDeCartaConScrydex } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-relleno.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

// ── LAS COLUMNAS OBLIGATORIAS SALEN DE LA MIGRACIÓN, NO DE MI MEMORIA ──
//
// Si se escriben a mano aquí, esta prueba dice lo que yo me crea y no lo
// que la base exige — y el día que alguien añada otra `not null` seguirá
// en verde mientras producción se cae. Se leen de
// `supabase-migration-cartas.sql`, que es quien crea la tabla.
function obligatoriasDeLaTabla(tabla) {
  const sql = readFileSync('/home/user/pingu/supabase-migration-cartas.sql', 'utf8')
  const cuerpo = new RegExp(`create table if not exists ${tabla} \\(([\\s\\S]*?)\\n\\);`).exec(sql)?.[1]
  if (!cuerpo) throw new Error(`no encuentro la tabla ${tabla}`)
  const obligatorias = []
  for (const linea of cuerpo.split('\n')) {
    const sinComentario = linea.replace(/--.*$/, '').trim()
    const col = /^([a-z_]+)\s+/.exec(sinComentario)?.[1]
    if (!col) continue
    // Una columna con DEFAULT no hace falta mandarla: la pone la base.
    if (/\bdefault\b/i.test(sinComentario)) continue
    if (/\bnot null\b/i.test(sinComentario) || /\bprimary key\b/i.test(sinComentario)) obligatorias.push(col)
  }
  return obligatorias
}

const OBLIGATORIAS = obligatoriasDeLaTabla('tcg_cards')

console.log('── 1. Qué exige la tabla ──')
{
  check('se leen de la migración, no de mi cabeza', OBLIGATORIAS.length >= 4, OBLIGATORIAS.join(','))
  check('y están las dos que faltaban', OBLIGATORIAS.includes('local_id') && OBLIGATORIAS.includes('name'), OBLIGATORIAS.join(','))
}

console.log('── 2. La fila del relleno las lleva TODAS ──')
{
  // LOS DOS VALORES TIENEN QUE SER DISTINTOS o esto no prueba nada: con
  // «Pikachu» a los dos lados, mandar el suyo y mandar el nuestro dan el
  // mismo resultado y el rigor lo canta como «sin detectar». Y la
  // diferencia importa de verdad: `name` es la CLAVE con la que se cruzan
  // las decklists (tandas 334 y 335), y pisarla con la suya en TODAS las
  // cartas —no solo en las ~1.890 que llevan el español mal metido— es
  // justo lo que la 509 se cuidó de no hacer.
  const nuestra = { id: 'sv10-001', market: 'WEST', set_id: 'sv10', local_id: '001', name: "Boss's Orders", name_es: 'Órdenes del Jefe' }
  const suya = { id: 'sv10-1', name: 'Jefe mal traducido', number: '0001', rarity: 'Rare', artist: 'A', hp: '60', national_pokedex_numbers: [25], expansion: { id: 'sv10', code: 'SV10' } }
  const f = filaDeCartaConScrydex(nuestra, suya)
  const faltan = OBLIGATORIAS.filter((c) => f[c] === undefined || f[c] === null)
  check('ninguna columna obligatoria va vacía', faltan.length === 0, `faltan: ${faltan.join(', ')}`)
  // Y no son valores nuevos: son los que la fila YA tiene, repetidos para
  // que Postgres pueda formarla.
  check('`local_id` es el nuestro, no el suyo', f.local_id === '001', f.local_id)
  check('`name` es el nuestro, no el suyo', f.name === "Boss's Orders", f.name)
}

console.log('── 3. Y TODAS las sentencias que se mandan, no solo esa ──')
{
  // La de los nombres se arma a mano dentro de la función y tenía el
  // mismo agujero: una prueba que mirara solo el ayudante puro habría
  // salido verde con producción cayéndose igual.
  const escrito = []
  const restImpl = async (ruta) => {
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 1 } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) return [{ id: 'sm10', scrydex_id: 'sm10' }]
    // `name` igual que `name_es` = nuestra fila lleva el español metido en
    // la clave, que es lo que dispara el arreglo del nombre (tanda 509).
    return [{ id: 'sm10-9', market: 'WEST', set_id: 'sm10', local_id: '9', name: 'Órdenes del Jefe', name_es: 'Órdenes del Jefe' }]
  }
  const fetchImpl = async (url) => {
    const pag = Number(/[?&]page=(\d+)/.exec(url)?.[1] || 1)
    if (pag > 1) return { ok: true, json: async () => ({ data: [], page: pag, page_size: 250, total_count: 1 }) }
    return {
      ok: true,
      json: async () => ({
        data: [{ id: 'sm10-9', name: "Boss's Orders", number: '9', rarity: 'Rare', expansion: { id: 'sm10', code: 'UNB' } }],
        page: 1, page_size: 250, total_count: 1,
      }),
    }
  }
  await procesar({
    env: ENV, restImpl, fetchImpl, paginas: 2,
    escribirImpl: async (tabla, filas) => { escrito.push({ tabla, filas }) },
    guardarEstadoImpl: async () => {},
  })
  check('se han mandado las dos sentencias', escrito.length === 2, JSON.stringify(escrito.map((e) => Object.keys(e.filas[0]))))
  const malas = []
  for (const { filas } of escrito) {
    for (const fila of filas) {
      for (const col of OBLIGATORIAS) if (fila[col] === undefined || fila[col] === null) malas.push(`${fila.id}: sin ${col}`)
    }
  }
  check('ninguna fila de ninguna sentencia se deja una obligatoria', malas.length === 0, malas.join(' | '))
  // Y la de los nombres sigue haciendo lo suyo: pisar `name` con el inglés.
  const nombres = escrito.find((e) => e.filas[0].name === "Boss's Orders")
  check('el arreglo del nombre sigue mandando el inglés', !!nombres, JSON.stringify(escrito.map((e) => e.filas[0].name)))
}

console.log('── 4. Un fallo NUESTRO para; no se salta la página ──')
{
  const estados = []
  const paginasPedidas = []
  const conFalloNuestro = async (ruta) => {
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 7, fallos: 4 } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) return [{ id: 'sm10', scrydex_id: 'sm10' }]
    throw new Error('Supabase 400: {"code":"23502","details":"Failing row contains (sv10-001, sv10, null, null,')
  }
  const fetchImpl = async (url) => {
    paginasPedidas.push(Number(/[?&]page=(\d+)/.exec(url)?.[1] || 1))
    return {
      ok: true,
      json: async () => ({
        data: [{ id: 'sm10-1', name: 'X', number: '1', expansion: { id: 'sm10', code: 'UNB' } }],
        page: 7, page_size: 250, total_count: 25000,
      }),
    }
  }
  const r = await procesar({
    env: ENV, restImpl: conFalloNuestro, fetchImpl, paginas: 3,
    escribirImpl: async () => {}, guardarEstadoImpl: async (v) => { estados.push(v) },
  })
  const ultimo = estados[estados.length - 1]
  check('a la quinta se PARA', !!ultimo?.parado, JSON.stringify(ultimo))
  check('  …y NO se salta la página', ultimo.pagina === 7, ultimo.pagina)
  check('  …ni se apunta como saltada', !ultimo.saltadas, JSON.stringify(ultimo.saltadas))
  check('  …y lo dice en la respuesta', !!r.cuerpo.PARADO, JSON.stringify(r.cuerpo))
  check('la página se pidió UNA vez, no tres', paginasPedidas.length === 1, JSON.stringify(paginasPedidas))
}

console.log('── 5. Parado es parado: ni un crédito más ──')
{
  let peticionesAScrydex = 0
  const restImpl = async (ruta) => {
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 7, parado: 'Nuestra base: Supabase 400: 23502' } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) return [{ id: 'sm10', scrydex_id: 'sm10' }]
    return []
  }
  const r = await procesar({
    env: ENV, restImpl, paginas: 3,
    fetchImpl: async () => { peticionesAScrydex++; return { ok: true, json: async () => ({ data: [] }) } },
    escribirImpl: async () => {}, guardarEstadoImpl: async () => {},
  })
  check('no se le pide NADA a Scrydex', peticionesAScrydex === 0, peticionesAScrydex)
  check('y lo dice con el motivo delante', /23502/.test(String(r.cuerpo.PARADO)), JSON.stringify(r.cuerpo))
  check('creditos: 0', r.cuerpo.creditos === 0, r.cuerpo.creditos)
}

console.log('── 6. Un fallo SUYO sigue saltándose la página ──')
{
  // Lo de arriba no puede haberse llevado por delante el freno del otro
  // lado: una página suya que falla siempre no puede bloquear el barrido.
  const estados = []
  const restImpl = async (ruta) => {
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 7, fallos: 4 } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) return [{ id: 'sm10', scrydex_id: 'sm10' }]
    return []
  }
  const r = await procesar({
    env: ENV, restImpl, paginas: 3,
    fetchImpl: async () => ({ ok: false, status: 500 }),
    escribirImpl: async () => {}, guardarEstadoImpl: async (v) => { estados.push(v) },
  })
  const ultimo = estados[estados.length - 1]
  check('se salta la página', ultimo.pagina === 8, ultimo.pagina)
  check('  …y queda apuntada', JSON.stringify(ultimo.saltadas) === '[7]', JSON.stringify(ultimo.saltadas))
  check('  …y NO se para por un fallo suyo', !ultimo.parado && !r.cuerpo.PARADO, JSON.stringify(ultimo))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
