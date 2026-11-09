// Tanda 1275 — «Actualizar desde TCGGO» en /admin → Colecciones → un set.
//
// PINGU: «¿puedes desarrollar un botón en el admin, en la parte de
// colecciones, donde ese botón traiga de TCGGO todo lo relacionado con el
// set? Sería como una actu manual». Las tres pasadas (catálogo, precios,
// productos) aceptan UNA expansión y la hacen aunque ya estuviera hecha;
// `tcggo-set-ahora` las encadena por pasos y el panel las llama en orden.
import { procesar as catalogo, CLAVE_ESTADO as CLAVE_CATALOGO, soloDe } from '/home/user/pingu/netlify/functions/tcggo-catalogo.mjs'
import { procesar as precios, CLAVE_ESTADO as CLAVE_PRECIOS } from '/home/user/pingu/netlify/functions/tcggo-precios.mjs'
import { procesar as productos, CLAVE_ESTADO as CLAVE_PRODUCTOS } from '/home/user/pingu/netlify/functions/tcggo-productos.mjs'
import { CLAVE_ESTADO as CLAVE_PARES } from '/home/user/pingu/netlify/functions/tcggo-emparejar.mjs'
import { actualizarSet, episodioDelSet, PASOS } from '/home/user/pingu/netlify/functions/tcggo-set-ahora.mjs'
import { actualizarSetDesdeTcggo, textoDePaso, PASOS_TCGGO, REPETIR } from '/home/user/pingu/admin/js/tcggo-set-ahora.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
const AHORA = new Date('2026-11-09T12:00:00Z')
const DIA = AHORA.toISOString().slice(0, 10)
const sinPausa = async () => {}
const copia = (x) => JSON.parse(JSON.stringify(x))

// La expansión, como la da TCGGO DENTRO de cada carta (respuesta real de
// /cards, pruebas/fixtures/tcggo-cards-ejemplo.json, con los datos de Delta Reign).
const EPISODIO_EN_CARTA = {
  id: 437, name: 'Delta Reign', slug: 'delta-reign', released_at: '2026-11-06', logo: 'https://images.tcggo.com/dlr.png', code: 'DLR',
  cards_total: 129, cards_printed_total: 120, prices: { cardmarket: { total: 830.5, currency: 'EUR' }, tcgplayer: { total: 801, currency: 'EUR' } },
  game: { name: 'Pokémon', slug: 'pokemon' }, series: { id: 17, name: 'Mega Evolution', slug: 'mega-evolution' },
}
const SUYAS_DLR = [
  { id: 60001, card_number: 1, name: 'Mega Rayquaza ex', type: 'singles', cardmarket_id: 900001, image: 'https://images.tcggo.com/60001.png', episode: EPISODIO_EN_CARTA, prices: { cardmarket: { lowest_near_mint: 265, lowest_near_mint_ES: 265 } } },
  { id: 60002, card_number: 2, name: 'Raikou ex', type: 'singles', cardmarket_id: 900002, image: 'https://images.tcggo.com/60002.png', episode: EPISODIO_EN_CARTA, prices: { cardmarket: { lowest_near_mint: 49, lowest_near_mint_ES: 49 } } },
]
const SUYAS_PBL = [{ id: 50001, card_number: 1, type: 'singles', cardmarket_id: 895789, prices: { cardmarket: { lowest_near_mint: 1 } } }]
// La lista GUARDADA es de antes de que TCGGO contara sus cartas: «0 cartas».
const LISTA = [
  { id: 415, nombre: 'Pitch Black', codigo: 'PBL', cartas: 120, fecha: '2026-07-17', logo: 'https://images.tcggo.com/pbl.png', valorCm: 616.4 },
  { id: 437, nombre: 'Delta Reign', codigo: 'DLR', cartas: 0, fecha: '2026-11-06', logo: null, valorCm: null },
]
const respuesta = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
const tcggo = (urls) => async (url) => {
  urls.push(url)
  const ep = Number(new URL(url).searchParams.get('episode_id'))
  return respuesta(ep === 437 ? SUYAS_DLR : ep === 415 ? SUYAS_PBL : [])
}

console.log('── 0. Lo que llega del panel ──')
check('una expansión con su set', JSON.stringify(soloDe({ mercado: 'WEST', id: '437', set: 'dlr', nombre: 'Delta Reign' })) === JSON.stringify({ mercado: 'WEST', id: 437, set: 'dlr', nombre: 'Delta Reign' }))
check('  …y lo que no es una expansión, nada', soloDe(null) === null && soloDe({ id: 0 }) === null && soloDe({ id: 'x' }) === null)

console.log('── 1. Precios: una expansión ya hecha hoy se repite, sola ──')
{
  const estados = {
    [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: LISTA }, hechos: { me05: { episodio: 415, pares: 20 } } },
    tcggo_catalogo: {},
    // Todo hecho hoy, y Pitch Black A MEDIAS en la pasada de siempre.
    [CLAVE_PRECIOS]: { dia: DIA, hechos: [437], hechosJp: [], setsApuntados: true, setsConValor: true, versionJp: 832, versionVariantes: 937, gasto: { dia: DIA, peticiones: 10 }, enCurso: { mercado: 'WEST', episodio: 415, pagina: 3, elegidas: {}, suyas: 200, nuestras: 0, escritas: 0 } },
  }
  const urls = []
  const escritas = []
  const sets = []
  const r = await precios({
    env: ENV, ahora: AHORA, pausa: sinPausa, fetchImpl: tcggo(urls),
    soloEpisodio: { mercado: 'WEST', id: 437, set: 'dlr', nombre: 'Delta Reign' },
    restImpl: async (ruta) => {
      if (/^tcg_sets\?/.test(ruta)) return []
      const productos = (ruta.match(/cm_id_product_propio=in\.\(([^)]*)\)/)?.[1] || '').split(',').map(Number)
      return [{ id: 'tcggo-60001', set_id: 'dlr', cm_id_product_propio: 900001 }, { id: 'tcggo-60002', set_id: 'dlr', cm_id_product_propio: 900002 }].filter((c) => /set_id=in\.\("dlr"\)/.test(ruta) && productos.includes(c.cm_id_product_propio))
    },
    guardarImpl: async (f) => { escritas.push(...f) },
    guardarSetsImpl: async (f, mercado) => { sets.push(...f.map((x) => ({ ...x, mercado }))); return f.length },
    guardarVersionesImpl: async () => {}, fotoImpl: async () => {},
    estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = copia(v) },
  })
  const pidio = urls.map((u) => Number(new URL(u).searchParams.get('episode_id')))
  check('pide Delta Reign aunque ya estuviera hecha hoy, y nada más', pidio.length && pidio.every((x) => x === 437), JSON.stringify(pidio))
  check('  …sin pedir la lista de expansiones (son páginas)', !urls.some((u) => /\/episodes/.test(u)), urls.join(' '))
  check('  …con los precios de sus dos cartas', escritas.filter((f) => /^tcggo-6000/.test(f.card_id)).length === 2 && escritas.find((f) => f.card_id === 'tcggo-60001')?.cm_low_es === 265, JSON.stringify(escritas.map((f) => [f.card_id, f.cm_low_es])))
  const fila = sets.find((s) => s.id === 'dlr')
  check('  …y la fila del set con lo que trae la carta: 129 cartas, logo y valor (no el «0» guardado)', fila?.cartas === 129 && fila?.impresas === 120 && /dlr\.png/.test(fila?.logo || '') && fila?.valor_cm === 830.5 && fila?.tcggo_id === 437 && fila?.mercado === 'WEST', JSON.stringify(fila))
  check('  …y la respuesta lo cuenta', r.solo?.terminada === true && r.solo?.filaDelSet?.cartas === 129, JSON.stringify(r.solo))
  check('  …y Pitch Black sigue a medias donde estaba (página 3)', estados[CLAVE_PRECIOS].enCurso?.episodio === 415 && estados[CLAVE_PRECIOS].enCurso?.pagina === 3, JSON.stringify(estados[CLAVE_PRECIOS].enCurso))
  check('  …y no se pisan los sets de todos (sin el bloque del día)', sets.every((s) => s.id === 'dlr'), JSON.stringify(sets.map((s) => s.id)))
}

console.log('── 2. Cartas: una expansión ya hecha esta semana se repite, sola, en su set ──')
{
  const estados = {
    [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: LISTA }, hechos: {} },
    [CLAVE_CATALOGO]: { semana: Math.floor(AHORA.getTime() / (7 * 86_400_000)), hechos: { WEST: [415, 437], JP: [] }, vacias: { WEST: [437], JP: [] }, gasto: { dia: DIA, peticiones: 0 } },
  }
  const urls = []
  const guardadas = []
  const parches = []
  const r = await catalogo({
    env: ENV, ahora: AHORA, pausa: sinPausa, fetchImpl: tcggo(urls),
    soloEpisodio: { mercado: 'WEST', id: 437, set: 'me3', nombre: 'Delta Reign' },
    restImpl: async (ruta, opciones) => {
      if (opciones?.method === 'PATCH') { parches.push(`${ruta} ${opciones.body}`); return null }
      // Delta Reign SIN `tcggo_id` en la fila, sin par y con un nombre y un id que
      // no casan con los suyos («Dominio Delta», `me3`): el set es el que se pulsó.
      if (/^tcg_sets\?/.test(ruta)) return [{ id: 'me05', name: 'Pitch Black', name_en: 'Pitch Black', tcggo_id: 415 }, { id: 'me3', name: 'Dominio Delta', name_en: '', tcggo_id: null, oculto: true }]
      if (/^tcg_cards\?/.test(ruta)) return []
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarCartasImpl: async (filas) => { guardadas.push(...filas); return filas.length },
    crearSetsImpl: async () => { throw new Error('no debe crear sets') },
    estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = copia(v) },
  })
  const pidio = urls.map((u) => Number(new URL(u).searchParams.get('episode_id')))
  check('pide Delta Reign, y nada más', pidio.length && pidio.every((x) => x === 437), JSON.stringify(pidio))
  check('  …escribe sus dos cartas en el set desde el que se pulsó', guardadas.length === 2 && guardadas.every((f) => f.set_id === 'me3'), JSON.stringify(guardadas.map((f) => [f.id, f.set_id])))
  check('  …y lo enseña si estaba escondido', parches.some((p) => /id=eq\.me3 .*"oculto":false/.test(p)), JSON.stringify(parches))
  const t = (r.esteTurno || []).find((x) => x.episodio === 437)
  check('  …y lo cuenta', t?.suyas === 2 && t?.escritas === 2, JSON.stringify(t))
}

console.log('── 3. Productos: los de UNA expansión, aunque ya se miraran ──')
{
  const urls = []
  const escritos = []
  let estado = { revision: 808, revisionSueltos: 1195, hechos: { 437: DIA, 415: '2026-11-01' }, fallidos: {}, ruta: '/episodes/{id}/products?page={pagina}' }
  const r = await productos({
    env: ENV, ahora: AHORA, soloExpansion: { id: 437, mercado: 'WEST' },
    fetchImpl: async (url) => { urls.push(url); return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 7001, name: 'Delta Reign Booster Box', type: 'booster box', episode: { id: 437 }, prices: { cardmarket: { lowest: 140 } } }], paging: { current: 1, total: 1 } }) } },
    restImpl: async (ruta, o) => {
      if (/^scrydex_estado\?select/.test(ruta)) return [{ valor: estado }]
      if (ruta === 'scrydex_estado') { estado = JSON.parse(o.body)[0].valor; return null }
      if (/^tcg_sets\?/.test(ruta)) return [{ id: 'dlr', market: 'WEST', tcggo_id: 437, release_date: '2026-11-06' }, { id: 'me05', market: 'WEST', tcggo_id: 415, release_date: '2026-07-17' }]
      if (o?.method === 'POST' && ruta === 'tcg_products') { escritos.push(...JSON.parse(o.body)); return null }
      return []
    },
  })
  check('pide la 437 aunque estuviera hecha hoy, y no la 415 que tocaba', urls.length >= 1 && urls.every((u) => /\/episodes\/437\//.test(u)), urls.join(' '))
  check('  …y escribe sus productos', escritos.some((p) => p.id === 7001) && r.productos >= 1, JSON.stringify(r))
}

console.log('── 4. Qué expansión es el set ──')
{
  const pares = { hechos: { a: { episodio: 10, pares: 5 }, b: { episodio: 11, pares: 0 }, c: { episodio: 12, pares: 3, sospechoso: 'x' } } }
  check('el emparejador manda si casó algo', episodioDelSet({ id: 'a', tcggo_id: 99 }, 'WEST', pares) === 10)
  check('  …si casó cero, la fila', episodioDelSet({ id: 'b', tcggo_id: 437 }, 'WEST', pares) === 437)
  check('  …sin fila, lo que eligiera aunque fuera vacío', episodioDelSet({ id: 'b', tcggo_id: null }, 'WEST', pares) === 11)
  check('  …un sospechoso no vale', episodioDelSet({ id: 'c', tcggo_id: null }, 'WEST', pares) === null)
  check('  …en el japonés, la fila o el mapa del catálogo', episodioDelSet({ id: 'SV9', tcggo_id: 700 }, 'JP') === 700 && episodioDelSet({ id: 'SV9' }, 'JP', null, { setsPorEpisodio: { JP: { 701: ['SV9'] } } }) === 701)
}

console.log('── 5. La función: solo admin, un paso cada vez, y cada paso a su pasada ──')
{
  const llamadas = []
  const deps = (extra = {}) => ({
    env: ENV, esAdmin: async (t) => t === 'buena',
    restImpl: async (ruta) => {
      if (/^tcg_sets\?/.test(ruta)) return /id=eq\.dlr/.test(ruta) ? [{ id: 'dlr', name: 'Delta Reign', tcggo_id: 437, oculto: false }] : []
      if (/clave=eq\.tcggo_pares/.test(ruta)) return [{ valor: { hechos: { dlr: { episodio: 437, pares: 0, vacio: true } } } }]
      return []
    },
    emparejarImpl: async (o) => { llamadas.push(['emparejar', o]); return { estado: 200, cuerpo: { esteTurno: [{ set: 'dlr', episodio: 437, episodioNombre: 'Delta Reign', pares: 2, nuestras: 2, suyas: 2, escritas: 2 }], quedanIds: [] } } },
    catalogoImpl: async (o) => { llamadas.push(['cartas', o]); return { ok: true, esteTurno: [{ mercado: 'WEST', episodio: 437, suyas: 2, casadas: 2, nuevas: 0, escritas: 2 }] } },
    preciosImpl: async (o) => { llamadas.push(['precios', o]); return { ok: true, hechasAhora: [{ mercado: 'WEST', episodio: 437, suyas: 2, nuestras: 2, escritas: 2 }], solo: { terminada: true, filaDelSet: { cartas: 129 } } } },
    productosImpl: async (o) => { llamadas.push(['productos', o]); return { productos: 3 } },
    purgarImpl: async (etiquetas) => { llamadas.push(['purgar', etiquetas]); return { ok: true } },
    ...extra,
  })
  const pedir = (cuerpo, token = 'buena') => new Request('https://x/.netlify/functions/tcggo-set-ahora', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(cuerpo) })
  const sinAdmin = await actualizarSet(pedir({ set: 'dlr', paso: 'cartas' }, 'mala'), deps())
  check('sin admin, 401 y nada se pide', sinAdmin.status === 401 && !llamadas.length)
  const sinPaso = await actualizarSet(pedir({ set: 'dlr', paso: 'todo' }), deps())
  check('un paso que no existe, 400', sinPaso.status === 400)
  check('los pasos son los cuatro, en orden', JSON.stringify(PASOS) === JSON.stringify(['emparejar', 'cartas', 'precios', 'productos']) && JSON.stringify(PASOS_TCGGO.map((p) => p.paso)) === JSON.stringify(PASOS))
  const r1 = await (await actualizarSet(pedir({ set: 'dlr', paso: 'emparejar' }), deps())).json()
  check('emparejar: solo ese set', llamadas.at(-1)?.[0] === 'emparejar' && JSON.stringify(llamadas.at(-1)[1].soloSets) === '["dlr"]' && r1.ok && r1.turno?.pares === 2, JSON.stringify(r1))
  const r2 = await (await actualizarSet(pedir({ set: 'dlr', paso: 'cartas' }), deps())).json()
  const o2 = llamadas.at(-1)?.[1]
  check('cartas: su expansión por la fila (el par era de cero) y su set', o2?.soloEpisodio?.id === 437 && o2.soloEpisodio.set === 'dlr' && r2.ok && !r2.sigue, JSON.stringify(o2?.soloEpisodio))
  const r3 = await (await actualizarSet(pedir({ set: 'dlr', paso: 'precios' }), deps())).json()
  check('precios: la misma expansión, y la fila del set de vuelta', llamadas.at(-1)?.[1]?.soloEpisodio?.id === 437 && r3.filaDelSet?.cartas === 129 && !r3.sigue, JSON.stringify(r3))
  const r4 = await (await actualizarSet(pedir({ set: 'dlr', paso: 'productos' }), deps())).json()
  check('productos: los de esa expansión, y se vacía la copia de la CDN', llamadas.some(([q, o]) => q === 'productos' && o.soloExpansion?.id === 437) && llamadas.at(-1)?.[0] === 'purgar' && r4.productos === 3, JSON.stringify(r4))
  const aMedias = await (await actualizarSet(pedir({ set: 'dlr', paso: 'precios' }), deps({ preciosImpl: async () => ({ ok: true, hechasAhora: [], solo: { terminada: false } }) }))).json()
  check('una pasada que se queda sin tiempo dice «sigue»', aMedias.sigue === true)
  const noEsta = await actualizarSet(pedir({ set: 'nada', paso: 'cartas' }), deps())
  check('un set que no está, 404', noEsta.status === 404)
  const jp = await (await actualizarSet(pedir({ set: 'dlr', mercado: 'JP', paso: 'emparejar' }), deps())).json()
  check('el japonés no tiene emparejador (lo casa el catálogo)', jp.ok && /japonés/.test(jp.nota || ''), JSON.stringify(jp))
}

console.log('── 6. El panel: encadena, repite lo que se queda a medias y para en un fallo ──')
{
  const vistos = []
  let precioVuelta = 0
  const fetchImpl = async (url, o) => {
    const { paso } = JSON.parse(o.body)
    vistos.push(paso)
    const r = paso === 'precios' ? (++precioVuelta < 3 ? { ok: true, paso, sigue: true } : { ok: true, paso, hecha: { escritas: 2, nuestras: 2, suyas: 2 } }) : { ok: true, paso }
    return { status: 200, json: async () => r }
  }
  const pasos = []
  const fin = await actualizarSetDesdeTcggo({ set: 'dlr', mercado: 'WEST', token: 't', fetchImpl, alPaso: (p, r, i) => pasos.push(`${p}:${i}`) })
  check('los cuatro pasos, y precios hasta que acaba (tres vueltas)', vistos.join() === 'emparejar,cartas,precios,precios,precios,productos', vistos.join())
  check('  …con cada vuelta contada', pasos.includes('precios:3') && Object.keys(fin).join() === 'emparejar,cartas,precios,productos', pasos.join())
  const otro = []
  await actualizarSetDesdeTcggo({ set: 'dlr', mercado: 'WEST', fetchImpl: async (u, o) => { const { paso } = JSON.parse(o.body); otro.push(paso); return { status: 200, json: async () => (paso === 'cartas' ? { ok: false, error: 'nuestra base' } : { ok: true }) } } })
  check('un fallo de nuestra base para ahí', otro.join() === 'emparejar,cartas', otro.join())
  const siempre = []
  await actualizarSetDesdeTcggo({ set: 'dlr', mercado: 'WEST', fetchImpl: async (u, o) => { const { paso } = JSON.parse(o.body); siempre.push(paso); return { status: 200, json: async () => ({ ok: true, sigue: paso === 'cartas' }) } } })
  check(`  …y lo que nunca acaba se deja a la ${REPETIR}.ª vuelta`, siempre.filter((p) => p === 'cartas').length === REPETIR, siempre.join())
}

console.log('── 7. Lo que dice cada renglón ──')
{
  check('emparejar', /Delta Reign.*2 de 2 cartas casadas/.test(textoDePaso('emparejar', { ok: true, turno: { episodio: 437, episodioNombre: 'Delta Reign', pares: 2, nuestras: 2, suyas: 2 } })))
  check('  …sin expansión', /No se encuentra/.test(textoDePaso('emparejar', { ok: true, turno: { sinEpisodio: 'sin código' } })))
  check('cartas', /TCGGO tiene 129 cartas: 120 ya estaban, 9 nuevas; 129 escritas/.test(textoDePaso('cartas', { ok: true, turno: { suyas: 129, casadas: 120, nuevas: 9, escritas: 129 } })))
  check('  …todavía sin sueltas', /todavía no da cartas sueltas/.test(textoDePaso('cartas', { ok: true, turno: { suyas: 0 } })))
  const tp = textoDePaso('precios', { ok: true, hecha: { escritas: 129, nuestras: 129, suyas: 129 }, filaDelSet: { cartas: 129, impresas: 120, fecha: '2026-11-06', valorCm: 830.5, logo: true } })
  check('precios y la fila del set', /129 precios escritos/.test(tp) && /129 cartas \(120 impresas\)/.test(tp) && /830,5 €/.test(tp) && /con logo/.test(tp), tp)
  check('  …sin id de Cardmarket', /sin id de Cardmarket/.test(textoDePaso('precios', { ok: true, sinCm: true })))
  check('productos y la web', /3 productos\. La web ya lo enseña/.test(textoDePaso('productos', { ok: true, productos: 3, web: { ok: true } })))
  check('un fallo, tal cual', textoDePaso('cartas', { ok: false, error: 'Supabase 500' }) === 'No se ha podido: Supabase 500.')
  check('parado por el plan', /^Parado: RapidAPI 429/.test(textoDePaso('precios', { ok: true, parado: 'RapidAPI 429: el plan no da más por ahora' })))
}

console.log('── 8. El botón está en el editor del set ──')
{
  const col = readFileSync('/home/user/pingu/admin/js/colecciones.js', 'utf8')
  check('«Actualizar desde TCGGO» en el editor, con su lista de pasos', /id="colTcggoAhora">Actualizar desde TCGGO</.test(col) && /id="colTcggoRes"/.test(col))
  check('  …y entra por import() (no pesa al abrir Colecciones)', /import\('\.\/tcggo-set-ahora\.js'\)/.test(col) && !/from '\.\/tcggo-set-ahora\.js'/.test(col))
  check('  …y avisa a la web al acabar', /colTcggoAhora[\s\S]{0,2500}avisarALaWeb\(\)/.test(col))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTodo verde')
process.exit(fails ? 1 : 0)
