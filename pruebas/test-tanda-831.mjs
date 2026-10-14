// Tanda 831 — las japonesas que viven en OTRO set reciben su precio.
//
// PINGU pegó la pasada de precios: de la #610 hacia atrás (Platinum, DP,
// las barajas…) «0 filas de 0 nuestras» en todas, y Lost Link 10 de 40. El
// calco escribe con `tcggo_guardar_cartas`, que no cambia el `set_id` de una
// «tcggo-…» que ya existía, y solo recolocaba las que estaban en los sets
// que reemplazaba: la que quedó en el set de otra vuelta (escondido después)
// se quedó allí, y la pasada de precios la buscaba en el set de su expansión.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`)
}
const { procesar } = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const reemplazo = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const AHORA = new Date('2026-10-14T12:00:00Z')
const suya = (id, numero, cm, precio) => ({ id, card_number: numero, cardmarket_id: cm, image: `https://x/${id}.png`, prices: { cardmarket: { lowest_near_mint: precio } } })

console.log('── 1. La pasada de precios: lo que está fuera se trae, lo que no está se casa por número ──')
// La #656 (Platinum): pt1_ja es el visible; pt1_viejo lleva el mismo
// `tcggo_id` pero está escondido; tg-656 es de una vuelta anterior y ya no
// lleva ninguno.
const PAGINA = [
  suya(9001, '001', 801, 10), // vive en tg-656 (fuera de la lista de la expansión)
  suya(9002, '002', 802, 20), // vive en pt1_viejo (en la lista, pero escondido)
  suya(9003, '003', 803, 30), // no está en ninguna parte; la nuestra del 3, sin tcggo_id
  suya(9004, '004', 804, 40), // no está en ninguna parte, ni por número
  suya(9005, '005', 805, 50), // ya está bien, en pt1_ja
]
const CARTAS = [
  { id: 'tcggo-9001', set_id: 'tg-656', local_id: '001', name: 'A', cm_id_product_propio: 801, tcggo_id: 9001 },
  { id: 'tcggo-9002', set_id: 'pt1_viejo', local_id: '002', name: 'B', cm_id_product_propio: 1, tcggo_id: 9002 },
  { id: 'pt1_ja-3', set_id: 'pt1_ja', local_id: '3', name: 'C', cm_id_product_propio: null, tcggo_id: null },
  { id: 'pt1_ja-1', set_id: 'pt1_ja', local_id: '1', name: 'A vieja', cm_id_product_propio: null, tcggo_id: null },
  { id: 'tcggo-9005', set_id: 'pt1_ja', local_id: '005', name: 'E', cm_id_product_propio: 805, tcggo_id: 9005 },
]
const montar = ({ sets = [{ id: 'pt1_ja', tcggo_id: 656, oculto: false }, { id: 'pt1_viejo', tcggo_id: 656, oculto: true }] } = {}) => {
  const estados = {
    [CLAVE_PARES]: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'SV', cartas: 1, logo: 'https://x/l.png', valorCm: 1 }] } },
    tcggo_catalogo: { setsPorEpisodio: { JP: {} }, episodiosJp: { lista: [{ id: 656, nombre: 'Galactic’s Conquest', cartas: 5, logo: 'https://x/e.png', valorCm: 1 }] } },
    tcggo_precios: {},
  }
  const precios = []
  const corregidas = []
  const rutas = []
  const fetchImpl = async (url) => {
    const u = new URL(url)
    const ep = Number(u.searchParams.get('episode_id'))
    if (/pokemon-jp/.test(u.pathname) && ep === 656) return { ok: true, status: 200, text: async () => JSON.stringify({ data: PAGINA, paging: { current: 1, total: 1, per_page: 100 } }) }
    if (ep === 10) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, card_number: '1', cardmarket_id: 500, prices: { cardmarket: { lowest_near_mint: 2 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
    return { ok: false, status: 404, text: async () => 'no' }
  }
  const restImpl = async (ruta) => {
    const r = decodeURIComponent(ruta)
    rutas.push(r)
    if (/^tcg_sets\?select=id,tcggo_id,oculto&market=eq\.JP/.test(r)) return sets
    if (/^tcg_cards\?.*market=eq\.JP/.test(r)) {
      // Lo que haría PostgREST con cada filtro de los que se mandan.
      const enSets = /set_id=in\.\(([^)]*)\)/.exec(r)?.[1].split(',').map((x) => x.replace(/"/g, ''))
      const setEq = /set_id=eq\.([^&]+)/.exec(r)?.[1]
      const sinTcggo = /tcggo_id=is\.null/.test(r)
      const porTcggo = /tcggo_id(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number)
      const porCm = /cm_id_product_propio(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number)
      const o = /&or=\(/.test(r)
      return CARTAS.filter((c) => {
        if (enSets && !enSets.includes(c.set_id)) return false
        if (setEq && c.set_id !== setEq) return false
        if (sinTcggo && c.tcggo_id != null) return false
        if (o) return (porTcggo || []).includes(c.tcggo_id) || (porCm || []).includes(c.cm_id_product_propio)
        if (porTcggo && !porTcggo.includes(c.tcggo_id)) return false
        return true
      }).map((c) => ({ ...c }))
    }
    return [{ id: 'sv1-1', cm_id_product_propio: 500 }]
  }
  return {
    estados, precios, corregidas, rutas,
    base: {
      env: ENV, fetchImpl, restImpl, pausa: async () => {}, ahora: AHORA,
      guardarImpl: async (f) => { precios.push(...f) }, corregirImpl: async (f) => { corregidas.push(...f) },
      guardarSetsImpl: async (f) => f.length, fotoImpl: async () => 0,
      estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    },
  }
}
{
  const b = montar()
  const r = await procesar(b.base)
  const precio = (id) => b.precios.find((f) => f.card_id === id)?.cm_low_ja
  check('va bien', r.ok, JSON.stringify(r).slice(0, 300))
  check('las cuatro que tienen carta, con su precio (la de fuera, la del escondido, la casada por número y la que ya estaba)', precio('tcggo-9001') === 10 && precio('tcggo-9002') === 20 && precio('pt1_ja-3') === 30 && precio('tcggo-9005') === 50, JSON.stringify(b.precios.map((f) => [f.card_id, f.cm_low_ja])))
  const c = (id) => b.corregidas.find((x) => x.id === id)
  check('la de tg-656 y la del set escondido se llevan a pt1_ja (el visible)', c('tcggo-9001')?.set_id === 'pt1_ja' && c('tcggo-9002')?.set_id === 'pt1_ja' && c('tcggo-9002').cm_id_product_propio === 802, JSON.stringify(b.corregidas))
  check('  …la nuestra del 3 se queda donde está y gana el tcggo_id y el id de Cardmarket de TCGGO', c('pt1_ja-3')?.set_id === 'pt1_ja' && c('pt1_ja-3').tcggo_id === 9003 && c('pt1_ja-3').cm_id_product_propio === 803)
  check('  …la que ya estaba bien no se toca', !c('tcggo-9005') && !c('pt1_ja-1'))
  const claves = new Set(b.corregidas.map((x) => Object.keys(x).sort().join()))
  check('  …todas las filas con las MISMAS columnas, y las obligatorias repetidas (la 526)', claves.size === 1 && b.corregidas.every((x) => x.id && x.market === 'JP' && x.set_id && x.local_id && x.name), [...claves].join(' | '))
  const res = b.estados.tcggo_precios.resumenJp?.[656]
  check('/admin lo cuenta: 2 traídas (de dónde), 1 casada por número, 1 sin carta, 1 traída con otra de su número', res?.movidas === 2 && res.adoptadas === 1 && res.sinCarta === 1 && res.repetidas === 1 && res.deDonde.includes('tg-656') && res.deDonde.includes('pt1_viejo') && res.nuestras === 4 && res.escritas === 4, JSON.stringify(res))
  check('el occidental no busca fuera de su set', !b.rutas.some((x) => /market=eq\.WEST/.test(x) && /tcggo_id/.test(x)))
}
{
  // Sin un set VISIBLE de la expansión no hay a dónde llevarlas: no se mueve nada.
  const b = montar({ sets: [{ id: 'pt1_ja', tcggo_id: 656, oculto: true }] })
  await procesar(b.base)
  check('sin set visible de la expansión, nada se mueve ni se casa por número', !b.corregidas.some((x) => x.set_id !== CARTAS.find((c) => c.id === x.id)?.set_id) && !b.corregidas.some((x) => x.id === 'pt1_ja-3'), JSON.stringify(b.corregidas))
}

console.log('\n── 2. El reemplazo: la «tcggo-…» que vive en otro set se recoloca ──')
{
  const PAGINA_R = { data: [{ id: 9101, name: 'Gengar', card_number: '015', cardmarket_id: 900, type: 'singles', image: 'https://images.tcggo.com/g.png', attacks: [{}] }, { id: 9102, name: 'Haunter', card_number: '016', cardmarket_id: 901, type: 'singles', image: 'https://images.tcggo.com/h.png', attacks: [{}] }], paging: { current: 1, total: 1, per_page: 100 } }
  const llamadas = []
  const guardadas = []
  const restImpl = async (ruta, opciones = null) => {
    const r = decodeURIComponent(ruta)
    llamadas.push({ ruta: r, metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
    if (opciones) return null
    if (r.startsWith('tcg_sets?')) return [{ id: 'll1_ja', name: 'Lost Link', tcggo_id: 647 }]
    // Por set: nada en ll1_ja. Por id: el Gengar, en tg-647 (de otra vuelta).
    if (r.startsWith('tcg_cards?') && /set_id=in/.test(r)) return []
    if (r.startsWith('tcg_cards?') && /[?&]id=in\./.test(r)) return /"tcggo-9101"/.test(r) ? [{ id: 'tcggo-9101', set_id: 'tg-647', local_id: '015', name: 'ゲンガー', name_en: 'Gengar', tcggo_id: 9101 }] : []
    return []
  }
  const r = await reemplazo.procesar({
    env: ENV, restImpl, fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(PAGINA_R) }),
    guardarCartasImpl: async (f) => { guardadas.push(...f); return f.length },
    sets: ['ll1_ja'], episodio: 647, destino: 'll1_ja', mercado: 'JP', entero: true, pausa: async () => {},
  })
  const ajuste = llamadas.find((l) => l.metodo === 'POST' && l.ruta.startsWith('tcg_cards?on_conflict'))
  const gengar = ajuste?.cuerpo?.find((f) => f.id === 'tcggo-9101')
  check('va bien', r.ok, JSON.stringify(r).slice(0, 300))
  check('el Gengar que vivía en tg-647 pasa a ll1_ja, con las obligatorias repetidas', gengar?.set_id === 'll1_ja' && gengar.local_id === '015' && gengar.name && gengar.market === 'JP', JSON.stringify(ajuste?.cuerpo))
  check('  …el Haunter, nuevo, no necesita ajuste (la RPC ya lo crea en ll1_ja)', !ajuste?.cuerpo?.some((f) => f.id === 'tcggo-9102') && guardadas.find((f) => f.id === 'tcggo-9102')?.set_id === 'll1_ja')
  check('  …y no se borra nada que no fuera del set (el Gengar no es «de los que se van»)', !llamadas.some((l) => l.metodo === 'DELETE' && /tcggo-9101/.test(l.ruta)))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
