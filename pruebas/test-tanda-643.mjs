// Tanda 643 — el histórico de precios de una carta: las filas que salen de
// la respuesta de TCGGO (el ejemplo de su documentación), la función a
// demanda con su freno, la foto diaria al acabar la pasada de precios, y
// la gráfica en SVG (una función pura). Sin red.
import { readFileSync } from 'node:fs'
import { urlHistorial, filasDeHistorial } from '/home/user/pingu/netlify/lib/tcggo.mjs'
import { procesar as historial, CLAVE_ESTADO, TOPE_DIARIO } from '/home/user/pingu/netlify/functions/tcggo-historial.mjs'
import { procesar as precios } from '/home/user/pingu/netlify/functions/tcggo-precios.mjs'
import { CLAVE_ESTADO as CLAVE_PARES } from '/home/user/pingu/netlify/functions/tcggo-emparejar.mjs'
import { svgDeHistorial, serieDe, valorDeFila, pieDeHistorial, ANCHO, ALTO } from '/home/user/pingu/js/carta-historial.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ')
const AHORA = new Date('2026-10-06T12:00:00Z')
// El ejemplo de /history-prices de su documentación, tal cual (api-1_1.json).
const RESPUESTA = {
  data: {
    '2026-09-11': { cm_low: 0.02, cm_low_de: 0.02, cm_low_fr: 0.02, cm_low_es: 0.02, cm_low_it: 0.02, tcg_player_market: 0.15 },
    '2026-09-01': { cm_low: 0.02, cm_low_de: 0.02, cm_low_fr: 0.02, cm_low_es: 0.02, cm_low_it: 0.02, tcg_player_market: 0.15 },
    '2026-07-19': { cm_low: 0.03, cm_low_de: 0.02, cm_low_fr: 0.02, cm_low_es: 0.02, cm_low_it: 0.02, tcg_player_market: null },
  },
  paging: { current: 1, total: 1, per_page: 30 },
  results: 3,
}

console.log('── 1. De su respuesta a nuestras filas ──')
{
  check('la URL pide por el id de Cardmarket, del más antiguo al más nuevo', urlHistorial(273681, 'https://x/pokemon') === 'https://x/pokemon/history-prices?cardmarket_id=273681&sort=asc')
  const filas = filasDeHistorial('xy5-150', RESPUESTA)
  check('una fila por fecha, ordenadas, con el general como inglés', filas.length === 3 && filas[0].dia === '2026-07-19' && filas[2].dia === '2026-09-11' && filas[0].cm_low_en === 0.03 && filas[0].cm_low_es === 0.02 && filas[0].tp_market_eur === null && filas[2].tp_market_eur === 0.15 && filas[0].origen === 'tcggo' && filas[0].card_id === 'xy5-150', JSON.stringify(filas[0]))
  check('una fecha sin ninguna cifra no se guarda; una respuesta rara, cero filas', filasDeHistorial('x', { data: { '2026-01-01': { cm_low: null }, 'ayer': { cm_low: 2 } } }).length === 0 && filasDeHistorial('x', { data: [] }).length === 0 && filasDeHistorial('x', null).length === 0)
}

console.log('── 2. La función a demanda ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }
  function montar({ filasGuardadas = [], historialAt = null, idProduct = 273681, existe = true, estadoInicial = {} } = {}) {
    const estados = { [CLAVE_ESTADO]: estadoInicial }
    const guardadas = []
    const parches = []
    const urls = []
    const restImpl = async (ruta, opciones) => {
      if (ruta.startsWith('tcg_card_history?')) return filasGuardadas
      if (ruta.startsWith('tcg_cards?')) return existe ? [{ id: 'xy5-150', cm_id_product_propio: idProduct }] : []
      if (ruta.startsWith('tcg_card_prices?') && opciones?.method === 'PATCH') { parches.push(JSON.parse(opciones.body)); return null }
      if (ruta.startsWith('tcg_card_prices?')) return [{ historial_at: historialAt }]
      throw new Error(`ruta inesperada ${ruta}`)
    }
    const fetchImpl = async (url) => { urls.push(url); return { ok: true, status: 200, text: async () => JSON.stringify(RESPUESTA) } }
    return {
      estados, guardadas, parches, urls, restImpl, fetchImpl,
      guardarImpl: async (f) => { guardadas.push(...f) },
      estadoImpl: async () => estados[CLAVE_ESTADO],
      guardarEstadoImpl: async (v) => { estados[CLAVE_ESTADO] = JSON.parse(JSON.stringify(v)) },
    }
  }
  const b = montar()
  const r = await historial({ env: ENV, ...b, ahora: AHORA, cardId: 'xy5-150' })
  check('sin histórico y sin pedirlo nunca: se pide (una petición), se guarda y se devuelve', r.estado === 200 && r.cuerpo.pedido === true && r.cuerpo.nuevas === 3 && r.cuerpo.filas.length === 3 && b.urls.length === 1 && /cardmarket_id=273681/.test(b.urls[0]) && b.guardadas.length === 3, JSON.stringify(r.cuerpo).slice(0, 200))
  check('  …y queda apuntado cuándo se pidió, y una petición en el día', b.parches[0]?.historial_at === AHORA.toISOString() && b.estados[CLAVE_ESTADO].peticiones === 1 && b.estados[CLAVE_ESTADO].dia === '2026-10-06')
  const b2 = montar({ filasGuardadas: [{ dia: '2026-10-01', cm_low: 1 }, { dia: '2026-10-02', cm_low: 2 }], historialAt: '2026-10-03T00:00:00Z' })
  const r2 = await historial({ env: ENV, ...b2, ahora: AHORA, cardId: 'xy5-150' })
  check('pedido hace tres días: se sirve lo guardado y no se pide nada', r2.cuerpo.pedido === false && r2.cuerpo.filas.length === 2 && b2.urls.length === 0 && /menos de una semana/.test(r2.cuerpo.porque))
  const b3 = montar({ filasGuardadas: [{ dia: '2026-10-01', cm_low: 1 }], historialAt: '2026-09-20T00:00:00Z' })
  const r3 = await historial({ env: ENV, ...b3, ahora: AHORA, cardId: 'xy5-150' })
  check('pedido hace dos semanas: se vuelve a pedir y se juntan las filas sin repetir', r3.cuerpo.pedido === true && r3.cuerpo.filas.length === 4 && r3.cuerpo.filas[0].dia === '2026-07-19' && r3.cuerpo.filas[3].dia === '2026-10-01', JSON.stringify(r3.cuerpo.filas.map((f) => f.dia)))
  const b4 = montar({ estadoInicial: { dia: '2026-10-06', peticiones: TOPE_DIARIO } })
  const r4 = await historial({ env: ENV, ...b4, ahora: AHORA, cardId: 'xy5-150' })
  check('con el tope diario gastado se sirve lo que haya y NO se pide', r4.cuerpo.pedido === false && b4.urls.length === 0 && /tope diario/.test(r4.cuerpo.porque), r4.cuerpo.porque)
  const b5 = montar({ idProduct: null })
  const r5 = await historial({ env: ENV, ...b5, ahora: AHORA, cardId: 'xy5-150' })
  check('sin id de Cardmarket no hay a quién pedir', r5.cuerpo.pedido === false && /sin id de Cardmarket/.test(r5.cuerpo.porque))
  check('un id de carta raro se rechaza antes de tocar nada', (await historial({ env: ENV, ...montar(), cardId: 'x y; drop' })).estado === 400)
  check('una carta que no existe, 404', (await historial({ env: ENV, ...montar({ existe: false }), ahora: AHORA, cardId: 'nada-1' })).estado === 404)
  const b6 = montar()
  b6.restImpl = async () => { throw new Error('relation "public.tcg_card_history" does not exist (42P01)') }
  const r6 = await historial({ env: ENV, ...b6, ahora: AHORA, cardId: 'xy5-150' })
  check('sin la migración, filas vacías y la nota, sin romper la ficha', r6.estado === 200 && r6.cuerpo.filas.length === 0 && /tcggo-historial\.sql/.test(r6.cuerpo.nota))
}

console.log('── 3. La foto diaria, al acabar la pasada de precios ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
  const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-10-05T10:00:00Z', lista: [{ id: 415, nombre: 'Pitch Black', codigo: 'PBL', logo: 'https://images.tcggo.com/pbl.png' }] }, hechos: { me05: { episodio: 415 } } }, tcggo_catalogo: {}, tcggo_precios: {} }
  const fotos = []
  const r = await precios({
    env: ENV, ahora: AHORA, pausa: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, card_number: '1', cardmarket_id: 895789, prices: { cardmarket: { lowest_near_mint: 1 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }),
    restImpl: async () => [{ id: 'me05-1', cm_id_product_propio: 895789 }],
    guardarImpl: async () => {}, guardarSetsImpl: async () => 1,
    fotoImpl: async (dia) => { fotos.push(dia); return 1234 },
    estadoImpl: async (clave) => estados[clave], guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
  })
  check('al cerrar el día se toma la foto del histórico, con la fecha del día', r.hecho === true && fotos.length === 1 && fotos[0] === '2026-10-06' && r.fotoHistorial === 1234, JSON.stringify([r.hecho, fotos, r.fotoHistorial]))
  const r2 = await precios({
    env: ENV, ahora: AHORA, pausa: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, card_number: '1', cardmarket_id: 895789, prices: { cardmarket: { lowest_near_mint: 1 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }),
    restImpl: async () => [{ id: 'me05-1', cm_id_product_propio: 895789 }],
    guardarImpl: async () => {}, guardarSetsImpl: async () => 1,
    fotoImpl: async () => { throw new Error('Could not find the function public.historial_foto_diaria (PGRST202)') },
    estadoImpl: async (clave) => (clave === 'tcggo_precios' ? {} : estados[clave]), guardarEstadoImpl: async () => {},
  })
  check('  …y sin su migración, lo dice y la pasada sale bien igual', r2.ok && r2.hecho === true && /tcggo-historial\.sql/.test(r2.fotoHistorial))
}

console.log('── 4. La gráfica ──')
{
  const filas = [
    { dia: '2026-09-01', cm_low: 39, cm_low_es: 140, cm_low_en: 194, tp_market_eur: 171 },
    { dia: '2026-09-15', cm_low: 40, cm_low_es: 150, cm_low_en: 190, tp_market_eur: 160 },
    { dia: '2026-10-01', cm_low: 41, cm_low_es: 160, cm_low_en: 199, tp_market_eur: null },
  ]
  check('el valor de una fila: el del idioma, y si no el general', valorDeFila(filas[0], 'es') === 140 && valorDeFila(filas[0], 'de') === 39 && valorDeFila({ dia: 'x' }, 'es') === null)
  check('una serie solo lleva los días con cifra', serieDe(filas, (f) => f.tp_market_eur).length === 2)
  const svg = svgDeHistorial(filas, { idioma: 'es' })
  check('un SVG con la línea del español (3 puntos) y la de TCGplayer a trazos (2)', /<svg viewBox="0 0 600 200"/.test(svg) && (svg.match(/<polyline class="carta-historial-linea"[ >]/g) || []).length === 1 && /carta-historial-linea-tp/.test(svg) && ANCHO === 600 && ALTO === 200, svg.slice(0, 200))
  check('  …con el mínimo y el máximo de las dos líneas en el eje (140 del español, 171 de TCGplayer) y las dos fechas abajo', /140,00 €/.test(limpio(svg)) && /199,00 €/.test(limpio(svg)) === false && /171,00 €/.test(limpio(svg)) && /1 sept/.test(svg) && /1 oct/.test(svg), limpio(svg).match(/<text[^>]*>[^<]*/g)?.join(' | '))
  check('  …y un rótulo accesible', /aria-label="Histórico: de 140,00 € a 171,00 €/.test(limpio(svg)))
  // Los puntos: el español sube de 140 a 160, así que el primero está más
  // abajo (y mayor) que el último en pantalla.
  // Desde la 661 la línea lleva `data-idioma` entre la clase y los puntos.
  const puntos = svg.match(/<polyline class="carta-historial-linea"[^>]*? points="([^"]*)"/)[1].split(' ').map((p) => p.split(',').map(Number))
  check('  …y la línea sube: el primer punto está más abajo que el último', puntos.length === 3 && puntos[0][1] > puntos[2][1] && puntos[0][0] < puntos[2][0], JSON.stringify(puntos))
  check('en inglés, otra línea: el máximo pasa a ser el 199 del inglés', /199,00 €/.test(limpio(svgDeHistorial(filas, { idioma: 'en' }))) && /140,00 €/.test(limpio(svgDeHistorial(filas, { idioma: 'en' }))) === false)
  check('con menos de dos puntos no hay gráfica', svgDeHistorial(filas.slice(0, 1), { idioma: 'es' }) === '' && svgDeHistorial([], {}) === '')
  check('el pie dice qué líneas hay y de qué idioma', /mínimo en Cardmarket en español/.test(pieDeHistorial(filas, 'es')) && /a trazos, TCGplayer/.test(pieDeHistorial(filas, 'es')) && /3 días/.test(pieDeHistorial(filas, 'es')) && /cualquier idioma/.test(pieDeHistorial(filas, 'de')), pieDeHistorial(filas, 'de'))
  const sql = readFileSync('/home/user/pingu/supabase-migration-tcggo-historial.sql', 'utf8')
  check('la migración: la tabla con su clave, lectura pública, historial_at y la foto solo para service_role', /create table if not exists public\.tcg_card_history/.test(sql) && /primary key \(card_id, dia\)/.test(sql) && /for select using \(true\)/.test(sql) && /add column if not exists historial_at/.test(sql) && /grant execute on function public\.historial_foto_diaria\(date\) to service_role/.test(sql))
  check('  …y la foto solo de las cartas que alguien tiene', /exists \(select 1 from public\.user_collection c where c\.card_id = p\.card_id\)/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
