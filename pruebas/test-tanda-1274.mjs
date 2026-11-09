// Tanda 1274 — una expansión que sale DESPUÉS de crear su set (Delta Reign).
//
// PINGU: «ha salido Delta Reign… se pueden ver las cartas pero ninguna tiene
// precio, y en /admin no tiene los idiomas; pone 0 cartas». El catálogo creó
// el set antes de que saliera (756) con su `tcggo_id`, y luego metió sus
// cartas (1265); pero los precios, la cuenta de cartas y el logo los pone la
// pasada de precios SOLO a los sets que casó el emparejador, y el emparejador
// lo miró con la expansión vacía. Aquí: la pasada de precios usa la fila del
// set cuando el emparejador no casó nada, lo hace HOY aunque la expansión ya
// estuviera pasada, y el emparejador vuelve a mirar un set casado con su
// expansión vacía (y los sobres sin id de Cardmarket ya no lo paran).
import { procesar as precios, CLAVE_ESTADO as CLAVE_PRECIOS } from '/home/user/pingu/netlify/functions/tcggo-precios.mjs'
import { procesar as emparejar, CLAVE_ESTADO as CLAVE_PARES, HORAS_ENTRE_VACIOS } from '/home/user/pingu/netlify/functions/tcggo-emparejar.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
const AHORA = new Date('2026-11-09T12:00:00Z')
const sinPausa = async () => {}
const copia = (x) => JSON.parse(JSON.stringify(x))

const EPISODIOS = [
  { id: 415, nombre: 'Pitch Black', codigo: 'PBL', cartas: 120, fecha: '2026-07-17', logo: 'https://images.tcggo.com/pbl.png', valorCm: 616.4 },
  { id: 437, nombre: 'Delta Reign', codigo: 'DLR', cartas: 129, impresas: 129, fecha: '2026-11-06', logo: 'https://images.tcggo.com/dlr.png', valorCm: 830.5 },
]
// Las cartas suyas de Delta Reign: dos sueltas con su id de Cardmarket.
const SUYAS_DLR = [
  { id: 60001, card_number: 1, name: 'Mega Rayquaza ex', type: 'singles', cardmarket_id: 900001, prices: { cardmarket: { lowest_near_mint: 265, lowest_near_mint_ES: 265 } } },
  { id: 60002, card_number: 2, name: 'Raikou ex', type: 'singles', cardmarket_id: 900002, prices: { cardmarket: { lowest_near_mint: 49, lowest_near_mint_ES: 49 } } },
]
const SUYAS_PBL = [{ id: 50001, card_number: 1, type: 'singles', cardmarket_id: 895789, prices: { cardmarket: { lowest_near_mint: 1, lowest_near_mint_ES: 1 } } }]
const NUESTRAS = [
  { id: 'tcggo-60001', set_id: 'dlr', local_id: '1', cm_id_product_propio: 900001 },
  { id: 'tcggo-60002', set_id: 'dlr', local_id: '2', cm_id_product_propio: 900002 },
  { id: 'me05-1', set_id: 'me05', local_id: '1', cm_id_product_propio: 895789 },
]
const FILAS_SETS = [{ id: 'me05', tcggo_id: 415 }, { id: 'dlr', tcggo_id: 437 }]

function montarPrecios({ hechosPares, estadoPrecios = {} }) {
  const estados = { [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: EPISODIOS }, hechos: hechosPares }, tcggo_catalogo: {}, [CLAVE_PRECIOS]: copia(estadoPrecios) }
  const escritas = []
  const sets = []
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    const ep = Number(new URL(url).searchParams.get('episode_id'))
    const data = ep === 437 ? SUYAS_DLR : ep === 415 ? SUYAS_PBL : []
    return { ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) }
  }
  const restImpl = async (ruta) => {
    if (/^tcg_sets\?select=id,tcggo_id&market=eq\.WEST&tcggo_id=not\.is\.null/.test(ruta)) return FILAS_SETS
    if (/^tcg_sets\?/.test(ruta)) return []
    const m = ruta.match(/set_id=in\.\(([^)]*)\)/)
    if (!m) throw new Error(`ruta inesperada ${ruta}`)
    const ids = m[1].split(',').map((x) => decodeURIComponent(x.replace(/"/g, '')))
    const productos = (ruta.match(/cm_id_product_propio=in\.\(([^)]*)\)/)?.[1] || '').split(',').map(Number)
    return NUESTRAS.filter((c) => ids.includes(c.set_id) && productos.includes(c.cm_id_product_propio))
  }
  return {
    estados, escritas, sets, urls, fetchImpl, restImpl,
    guardarImpl: async (filas) => { escritas.push(...filas) },
    guardarSetsImpl: async (f) => { sets.push(...f); return f.length },
    guardarVersionesImpl: async () => {},
    fotoImpl: async () => {},
    estadoImpl: async (clave) => estados[clave],
    guardarEstadoImpl: async (clave, valor) => { estados[clave] = copia(valor) },
  }
}

console.log('── 1. Precios: el set que el emparejador no casó entra por su fila ──')
{
  // Delta Reign SIN veredicto del emparejador (lo apuntó sin expansión).
  const b = montarPrecios({ hechosPares: { me05: { episodio: 415, pares: 20 } } })
  const r = await precios({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  const dlr = b.escritas.filter((f) => String(f.card_id).startsWith('tcggo-6000'))
  check('sus dos cartas tienen precio (265 € y 49 € en español)', dlr.length === 2 && dlr.find((f) => f.card_id === 'tcggo-60001')?.cm_low_es === 265, JSON.stringify(dlr.map((f) => [f.card_id, f.cm_low_es])))
  const fila = b.sets.find((s) => s.id === 'dlr')
  check('  …y el set, su logo, su expansión y su cuenta de cartas (129)', fila?.tcggo_id === 437 && fila?.cartas === 129 && /dlr\.png/.test(fila?.logo || ''), JSON.stringify(fila))
  check('  …sin dejar fuera a los demás', b.escritas.some((f) => f.card_id === 'me05-1') && r.ok !== false, JSON.stringify(r).slice(0, 200))
}

console.log('── 2. Si la expansión ya se había pasado HOY sin ese set, se repite ──')
{
  const dia = AHORA.toISOString().slice(0, 10)
  const antes = { dia, hechos: [415, 437], hechosJp: [], setsApuntados: true, setsConValor: true, versionJp: 832, versionVariantes: 937, gasto: { dia, peticiones: 10 } }
  const b = montarPrecios({ hechosPares: { me05: { episodio: 415, pares: 20 } }, estadoPrecios: antes })
  await precios({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  const pidio = b.urls.map((u) => Number(new URL(u).searchParams.get('episode_id')))
  check('se vuelve a pedir Delta Reign (y no Pitch Black, que ya estaba bien)', pidio.includes(437) && !pidio.includes(415), JSON.stringify(pidio))
  check('  …con sus precios y la fila de su set', b.escritas.some((f) => f.card_id === 'tcggo-60001') && b.sets.some((s) => s.id === 'dlr' && s.cartas === 129))
  // Y la pasada siguiente, el mismo día, ya no la repite.
  const urlsAntes = b.urls.length
  await precios({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('  …una sola vez: la pasada siguiente no la vuelve a pedir', b.urls.length === urlsAntes, `${urlsAntes} → ${b.urls.length}`)
}

console.log('── 3. Un veredicto de cero pares con OTRA expansión no lo ata ──')
{
  const b = montarPrecios({ hechosPares: { me05: { episodio: 415, pares: 20 }, dlr: { episodio: 999, pares: 0 } } })
  await precios({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  const pidio = b.urls.map((u) => Number(new URL(u).searchParams.get('episode_id')))
  check('se piden sus cartas por su fila (437), no por la otra (999)', pidio.includes(437) && !pidio.includes(999), JSON.stringify(pidio))
  check('  …y la fila del set lleva SU expansión', b.sets.filter((s) => s.id === 'dlr').every((s) => s.tcggo_id === 437) && b.sets.some((s) => s.id === 'dlr'))
  // Pero si el emparejador SÍ casó cartas, manda él (la fila no lo pisa).
  const b2 = montarPrecios({ hechosPares: { me05: { episodio: 415, pares: 20 }, dlr: { episodio: 437, pares: 2 }, otro: { episodio: 415, pares: 5 } } })
  await precios({ env: ENV, ...b2, pausa: sinPausa, ahora: AHORA })
  check('  …un set casado con pares no cambia de expansión', b2.sets.filter((s) => s.id === 'dlr').every((s) => s.tcggo_id === 437))
  // Y un sospechoso sigue fuera aunque tenga fila.
  const b3 = montarPrecios({ hechosPares: { me05: { episodio: 415, pares: 20 }, dlr: { episodio: 437, pares: 0, sospechoso: 'otro' } } })
  await precios({ env: ENV, ...b3, pausa: sinPausa, ahora: AHORA })
  check('  …y un sospechoso no entra por su fila', !b3.escritas.some((f) => String(f.card_id).startsWith('tcggo-6000')))
}

console.log('── 4. El emparejador vuelve a mirar un set casado con su expansión vacía ──')
{
  const SETS = [{ id: 'dlr', name: 'Delta Reign', name_en: 'Delta Reign', tcg_online_code: 'DLR', release_date: '2026-11-06' }]
  let fase = 'sobres'
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    const ep = Number(new URL(url).searchParams.get('episode_id'))
    if (ep !== 437) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [], paging: { current: 1, total: 1, per_page: 100 } }) }
    // Antes de salir: solo un sobre y una caja, sin id de Cardmarket.
    const data = fase === 'sobres'
      ? [{ id: 1, name: 'Delta Reign Booster', type: 'booster' }, { id: 2, name: 'Delta Reign Booster Box', type: 'booster box' }]
      : SUYAS_DLR
    return { ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) }
  }
  const estados = { [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: EPISODIOS }, hechos: {} } }
  const escrituras = []
  const base = {
    restImpl: async (ruta) => {
      if (ruta.startsWith('tcg_sets?')) return SETS
      if (/scrydex_estado/.test(ruta)) return []
      if (/set_id=eq\.dlr/.test(ruta)) return [{ id: 'tcggo-60001', local_id: '1', cm_id_product_propio: null }, { id: 'tcggo-60002', local_id: '2', cm_id_product_propio: null }]
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarImpl: async (p) => { escrituras.push(...p); return p.length },
    estadoImpl: async () => estados[CLAVE_PARES],
    guardarEstadoImpl: async (clave, valor) => { estados[clave] = copia(valor) },
    fetchImpl,
  }
  const correr = async (ahora) => emparejar({ env: ENV, ...base, pausa: sinPausa, ahora, peticiones: 9 })
  const r1 = await correr(AHORA)
  const h1 = estados[CLAVE_PARES].hechos.dlr
  check('solo sobres y cajas: no para el emparejador («sin cardmarket_id»)', !r1.cuerpo?.parado && !/cardmarket_id/.test(JSON.stringify(r1.cuerpo || {})), JSON.stringify(r1.cuerpo).slice(0, 300))
  check('  …lo casa con su expansión, apuntado como VACÍO', h1?.episodio === 437 && h1?.pares === 0 && h1?.vacio === true && h1?.vecesVacio === 1, JSON.stringify(h1))
  fase = 'cartas'
  const pedidasAntes = urls.length
  await correr(new Date(AHORA.getTime() + 3_600_000))
  check('una hora después no se vuelve a pedir', urls.length === pedidasAntes, `${pedidasAntes} → ${urls.length}`)
  await correr(new Date(AHORA.getTime() + (HORAS_ENTRE_VACIOS + 1) * 3_600_000))
  const h2 = estados[CLAVE_PARES].hechos.dlr
  check(`a las ${HORAS_ENTRE_VACIOS} horas se vuelve a mirar y, con sus cartas, se casan (dos pares) y deja de estar vacío`, h2?.pares === 2 && !h2?.vacio, JSON.stringify(h2))
  check('  …y sus cartas reciben su id de Cardmarket', escrituras.some((e) => e.id === 'tcggo-60001' && e.id_product === 900001), JSON.stringify(escrituras).slice(0, 200))
  const deDlr = () => urls.filter((u) => new URL(u).searchParams.get('episode_id') === '437').length
  // Un casado con CERO pares de antes de la marca (sin `vacio`), reciente,
  // también se vuelve a mirar; uno viejo, no.
  estados[CLAVE_PARES].hechos = { dlr: { episodio: 437, pares: 0, fecha: AHORA.toISOString() } }
  const viejo = { id: 'base1', name: 'Base Set', name_en: 'Base Set', tcg_online_code: 'BS', release_date: '1999-01-09' }
  SETS.push(viejo)
  estados[CLAVE_PARES].hechos.base1 = { episodio: 1, pares: 0, fecha: AHORA.toISOString() }
  await correr(new Date(AHORA.getTime() + (HORAS_ENTRE_VACIOS + 1) * 3_600_000))
  check('uno RECIENTE casado con cero pares (de antes de la marca) se vuelve a mirar y se casa', estados[CLAVE_PARES].hechos.dlr?.pares === 2, JSON.stringify(estados[CLAVE_PARES].hechos.dlr))
  check('  …uno viejo con cero pares, no', estados[CLAVE_PARES].hechos.base1?.episodio === 1 && estados[CLAVE_PARES].hechos.base1?.pares === 0 && !urls.some((u) => new URL(u).searchParams.get('episode_id') === '1'))
  const pedidas = deDlr()
  await correr(new Date(AHORA.getTime() + (2 * HORAS_ENTRE_VACIOS + 2) * 3_600_000))
  check('  …y ya casado no se vuelven a pedir sus cartas', deDlr() === pedidas, `${pedidas} → ${deDlr()}`)
}

console.log('── 5. Uno reciente que no casó con ninguna expansión se vuelve a decidir ──')
{
  const estados = { [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: EPISODIOS }, hechos: {}, sinEpisodio: { dlr: { porque: 'ninguna expansión suya…', fecha: AHORA.toISOString() } } } }
  const base = {
    restImpl: async (ruta) => {
      if (ruta.startsWith('tcg_sets?')) return [{ id: 'dlr', name: 'Delta Reign', name_en: 'Delta Reign', tcg_online_code: 'DLR', release_date: '2026-11-06' }]
      if (/scrydex_estado/.test(ruta)) return []
      if (/set_id=eq\.dlr/.test(ruta)) return [{ id: 'tcggo-60001', local_id: '1', cm_id_product_propio: 900001 }]
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarImpl: async (p) => p.length,
    estadoImpl: async () => estados[CLAVE_PARES],
    guardarEstadoImpl: async (clave, valor) => { estados[clave] = copia(valor) },
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: SUYAS_DLR, paging: { current: 1, total: 1, per_page: 100 } }) }),
  }
  await emparejar({ env: ENV, ...base, pausa: sinPausa, ahora: new Date(AHORA.getTime() + 3_600_000), peticiones: 9 })
  check('una hora después sigue sin repetirse', !estados[CLAVE_PARES].hechos.dlr)
  await emparejar({ env: ENV, ...base, pausa: sinPausa, ahora: new Date(AHORA.getTime() + (HORAS_ENTRE_VACIOS + 1) * 3_600_000), peticiones: 9 })
  check(`a las ${HORAS_ENTRE_VACIOS} horas se decide de nuevo y casa con Delta Reign`, estados[CLAVE_PARES].hechos.dlr?.episodio === 437, JSON.stringify(estados[CLAVE_PARES].hechos.dlr))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
