// Tanda 1158 — las MEP que faltan (de TCGdex), el pack de McDonald's de 2002
// a mano y los precios de Cardmarket para lo japonés hecho a mano.
import { pasada as rellenar, filasDeTcgdex, CARDMARKET, RELLENOS } from '/home/user/pingu/netlify/functions/tcgdex-rellenar-set.mjs'
import { pasada as aMano, DECKS, filasDelDeck } from '/home/user/pingu/netlify/functions/decks-jp-a-mano.mjs'
import { procesar, claveDeEstado, filtroDeOrigen } from '/home/user/pingu/netlify/functions/cardmarket-precios.mjs'
import { PASADAS } from '/home/user/pingu/admin/js/semaforo.js'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const env = { SUPABASE_SERVICE_ROLE_KEY: 'x' }
const pad = (n) => String(n).padStart(3, '0')

console.log('── Las MEP de TCGdex ──')
{
  check('el id de Cardmarket de la 90 (Mega Darkrai ex) es el 903676', CARDMARKET.mep.get('90') === 903676 && CARDMARKET.mep.size === 111)
  check('la MEP se repasa cada semana', RELLENOS[0].tcgdex === 'mep' && RELLENOS[0].cadaDias === 7)
  check('el semáforo de /admin lee las tres claves nuevas', ['tcgdex_rellenar_set', 'cardmarket_guia', 'cardmarket_guia_jp'].every((k) => PASADAS.some(([c]) => c === k)))
  const suyas = [...Array.from({ length: 110 }, (_, i) => i + 1), 120].map((n) => ({ id: `mep-${pad(n)}`, localId: pad(n), name: `Carta ${n}`, ...(n === 90 ? { name: 'Mega Darkrai ex', image: 'https://assets.tcgdex.net/en/me/mep/090' } : {}) }))
  // Lo nuestro (de TCGGO): del 1 al 88 y del 93 al 110, con su número pelado.
  const nuestras = Array.from({ length: 110 }, (_, i) => i + 1).filter((n) => n < 89 || n > 92).map((n) => ({ id: `tcggo-${9000 + n}`, local_id: String(n) }))
  const escritas = []
  let estado = {}
  const restImpl = async (ruta, op) => {
    if (op?.method === 'POST' && ruta.startsWith('tcg_cards')) { escritas.push(...JSON.parse(op.body)); return null }
    if (ruta.startsWith('tcg_sets')) return [{ id: 'mep', name: 'MEP Black Star Promos', tcggo_id: 1, card_count_total: 110 }]
    if (ruta.startsWith('tcg_cards?select=id,local_id')) return nuestras
    if (ruta.startsWith('tcg_cards?select=id&')) return [{ id: 'mep-120' }] // la 120 ya existe en otro set: no se pisa
    return []
  }
  const fetchImpl = async (url) => ({ ok: true, json: async () => (/\/es\//.test(url) ? { cards: [{ localId: '090', name: 'Mega-Darkrai ex' }] } : { cards: suyas }) })
  const ahora = new Date('2026-11-01T12:00:00Z')
  const r = await rellenar({ env, fetchImpl, restImpl, estadoImpl: async () => estado, guardarEstadoImpl: async (k, v) => { estado = v }, ahora })
  check('escribe solo las que faltan por número (89–92), sin pisar un id que ya existe', r.ok && escritas.map((f) => f.local_id).join(',') === '089,090,091,092', JSON.stringify(r))
  const d = escritas.find((f) => f.local_id === '090')
  check('  …la 90 con su nombre, su español, su foto de TCGdex y su Cardmarket', d && d.name === 'Mega Darkrai ex' && d.name_es === 'Mega-Darkrai ex' && d.image_path === 'me/mep/090' && d.cm_id_product_propio === 903676 && d.origen === 'relleno' && d.set_id === 'mep', JSON.stringify(d))
  check('  …y las demás sin foto inventada (TCGdex no la dio)', escritas.filter((f) => f.local_id !== '090').every((f) => f.image_path === null))
  check('  …todas las filas con las mismas claves (upsert)', new Set(escritas.map((f) => Object.keys(f).sort().join())).size === 1)
  check('queda apuntado en el estado', estado.hechos?.['mep-tcgdex']?.escritas === 4 && estado.hechos['mep-tcgdex'].numeros === '089, 090, 091, 092', JSON.stringify(estado.hechos))
  escritas.length = 0
  const r2 = await rellenar({ env, fetchImpl, restImpl, estadoImpl: async () => estado, guardarEstadoImpl: async (k, v) => { estado = v }, ahora: new Date('2026-11-03T12:00:00Z') })
  check('a los dos días no vuelve a pedir nada (cada semana)', r2.saltado === 'nada pendiente' && escritas.length === 0, JSON.stringify(r2))
  const r3 = await rellenar({ env, fetchImpl, restImpl, estadoImpl: async () => estado, guardarEstadoImpl: async (k, v) => { estado = v }, ahora: new Date('2026-11-09T12:00:00Z') })
  check('a la semana sí repasa', r3.ok && r3.hecho, JSON.stringify(r3))
  let estadoMal = {}
  const r4 = await rellenar({ env, fetchImpl: async () => ({ ok: false, status: 503 }), restImpl, estadoImpl: async () => estadoMal, guardarEstadoImpl: async (k, v) => { estadoMal = v }, ahora })
  check('si TCGdex falla, cuenta un intento y lo deja en el estado', !r4.ok && estadoMal.intentos['mep-tcgdex'] === 1 && /TCGdex 503/.test(estadoMal.ultimoError.error), JSON.stringify(estadoMal))
}

console.log('── El pack de McDonald\'s, a mano ──')
{
  const d = DECKS.find((x) => x.clave === 'mcd-e-minimum_ja')
  const { filas } = filasDelDeck(d, {})
  check('18 cartas, del 001 al 018, en japonés con su inglés', filas.length === 18 && filas[0].name === 'フシギダネ' && filas[0].name_en === 'Bulbasaur' && filas[17].name_en === 'Larvitar' && filas[17].local_id === '018')
  check('  …Holo las seis de Dex (Chikorita, Charmander, Squirtle, Pikachu, Slowpoke, Larvitar)', filas.filter((f) => f.variants.holo).map((f) => f.name_en).join() === 'Chikorita,Charmander,Squirtle,Pikachu,Slowpoke,Larvitar')
  check('  …con su tipo, sus PS y su Pokédex, y sin foto inventada', filas[3].types[0] === 'Fire' && filas[3].hp === 50 && filas[3].dex_ids[0] === 4 && filas.every((f) => !f.image_path))
  // No espera a Scrydex (no es un deck): con la lista de Scrydex vacía, crea.
  let estado = { hechos: Object.fromEntries(DECKS.filter((x) => x !== d).map((x) => [x.clave, { estado: 'creado' }])) }
  const creados = []
  const restImpl = async (ruta, op) => {
    if (op?.method === 'POST') { creados.push([ruta.split('?')[0], JSON.parse(op.body)]); return null }
    if (ruta.startsWith('tcg_sets')) return [{ id: 'E1', name: '基本拡張パック', name_en: 'Expedition Expansion Pack', release_date: '2001-12-01', serie_id: 'e', serie_name: 'e', serie_name_en: 'e-Card' }]
    return []
  }
  const r = await aMano({ env, restImpl, estadoImpl: async (k) => (k === 'decks_jp_a_mano' ? estado : {}), guardarEstadoImpl: async (k, v) => { if (k === 'decks_jp_a_mano') estado = v }, ahora: new Date('2026-11-01T12:00:00Z') })
  const set = creados.find(([t]) => t === 'tcg_sets')?.[1]?.[0]
  check('se crea el set (en la era e-Card) y sus 18 cartas, sin esperar a Scrydex', r.ok && set?.id === 'mcd-e-minimum_ja' && set.serie_id === 'e' && set.origen === 'mano' && creados.find(([t]) => t === 'tcg_cards')?.[1]?.length === 18, JSON.stringify(r))
}

console.log('── Los precios de Cardmarket del japonés a mano ──')
{
  check('estado propio y solo lo hecho a mano o de relleno', claveDeEstado('JP') === 'cardmarket_guia_jp' && claveDeEstado('WEST') === 'cardmarket_guia' && filtroDeOrigen('JP') === '&origen=in.(mano,relleno)' && filtroDeOrigen('WEST') === '')
  const rutas = []
  const guardadas = []
  const r = await procesar({
    env, mercado: 'JP', hoy: '2026-11-01',
    guia: [{ idProduct: 111, low: 12.5, trend: 14 }],
    restImpl: async (ruta) => { rutas.push(ruta); return rutas.length === 1 ? [{ id: 'mcd-e-minimum_ja-004', cm_id_product_propio: 111 }] : [] },
    guardarImpl: async (f) => guardadas.push(...f), estadoImpl: async () => ({}), guardarEstadoImpl: async () => {},
  })
  check('pide solo las del japonés a mano y escribe su precio de la guía', r.ok && /market=eq\.JP/.test(rutas[0]) && /origen=in\.\(mano,relleno\)/.test(rutas[0]) && guardadas[0]?.card_id === 'mcd-e-minimum_ja-004' && guardadas[0].cm_low === 12.5, JSON.stringify({ r, rutas, guardadas }))
}

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
