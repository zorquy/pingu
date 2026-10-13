// Tanda 806 — el catálogo japonés, entero de TCGGO.
//
// PINGU: «TCGGO ha metido TODOS los sets japoneses que faltaban, con todas
// sus cartas, sus precios y todo —hasta las Miscellaneous Promos de 1996,
// Expansion Pack, Jungle, Rocket—. Sustituye todos los sets que tenemos y
// coge el japonés siempre de la API». Lo que se mira:
//   1. `procesar` en el modo entero recoloca lo que la gente tiene por
//      NÚMERO (nuestras cartas de Scrydex se llaman en japonés y por el
//      nombre no casarían) y, con `borrarSinDestino: false`, una carta con
//      dueño sin pareja se queda en vez de irse con sus líneas.
//   2. El calco empieza la VUELTA 2: guarda la anterior, vuelve a pedir la
//      lista y rehace cada expansión en el modo entero; lo dudoso se crea;
//      los sets con su mismo tcggo_id se juntan; y al final se esconde todo
//      set japonés sin tcggo_id.
//   3. El espejo y el japonés de scrydex-huecos, apagados.
import { readFileSync, existsSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { procesar } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }

// El doble de la base para `procesar` (el de la 755, con las líneas que se borran).
const montar = ({ cartas, lineas = [], sets }) => {
  const llamadas = []
  const guardadas = []
  const db = { cartas: cartas.map((c) => ({ ...c })), lineas: lineas.map((l) => ({ ...l })), sets: sets.map((s) => ({ ...s })) }
  return {
    llamadas, guardadas, db,
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      llamadas.push({ ruta: r, metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      const ids = (k) => ((r.match(new RegExp(`${k}=in\\.\\(([^)]*)\\)`)) || [])[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
      if (!opciones || !opciones.method || opciones.method === 'GET') {
        if (r.startsWith('tcg_sets?')) return db.sets.filter((s) => ids('id').includes(s.id))
        if (r.startsWith('tcg_cards?')) return db.cartas.filter((c) => ids('set_id').includes(c.set_id))
        if (r.startsWith('user_collection?')) return db.lineas.filter((l) => ids('card_id').includes(l.card_id))
        return []
      }
      if (opciones.method === 'PATCH' && r.startsWith('user_collection?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; Object.assign(db.lineas.find((l) => l.id === id), JSON.parse(opciones.body)) }
      if (opciones.method === 'DELETE' && r.startsWith('user_collection?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; db.lineas = db.lineas.filter((l) => l.id !== id) }
      if (opciones.method === 'DELETE' && r.startsWith('tcg_cards?')) db.cartas = db.cartas.filter((c) => !ids('id').includes(c.id))
      if (opciones.method === 'DELETE' && r.startsWith('tcg_sets?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; db.sets = db.sets.filter((s) => s.id !== id) }
      return null
    },
    guardarCartasImpl: async (filas) => {
      guardadas.push(...filas)
      for (const f of filas) if (!db.cartas.some((c) => c.id === f.id)) db.cartas.push({ ...f, cm_id_product_propio: f.cm_id_product })
      return filas.length
    },
  }
}
const SUYAS = [
  { id: 501, name: 'Pikachu', card_number: '1', cardmarket_id: 7001, image: 'https://images.tcggo.com/501.png', type: 'singles' },
  { id: 502, name: 'Bulbasaur', card_number: '2', cardmarket_id: 7002, type: 'singles' },
  { id: 503, name: 'Mew', card_number: '3', cardmarket_id: 7003, type: 'singles' },
]
const fetchTcggo = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: SUYAS, paging: { current: 1, total: 1 } }) })
const SCRYDEX = () => ({
  sets: [{ id: 'base1_ja', name: '拡張パック' }],
  cartas: [
    { id: 'scrydex-1', set_id: 'base1_ja', local_id: '001', name: 'ピカチュウ', name_en: null, tcggo_id: null },
    { id: 'scrydex-2', set_id: 'base1_ja', local_id: '2', name: 'フシギダネ', name_en: null, tcggo_id: null },
    { id: 'scrydex-99', set_id: 'base1_ja', local_id: '099', name: 'なにか', name_en: null, tcggo_id: null },
    { id: 'scrydex-98', set_id: 'base1_ja', local_id: '098', name: 'だれか', name_en: null, tcggo_id: null },
  ],
  lineas: [{ id: 'l1', card_id: 'scrydex-1', user_id: 'u', cantidad: 2 }, { id: 'l2', card_id: 'scrydex-98', user_id: 'u', cantidad: 1 }],
})

console.log('── 1. `procesar` entero, recolocando por número ──')
{
  const b = montar(SCRYDEX())
  const r = await procesar({ env: ENV, fetchImpl: fetchTcggo, ...b, sets: ['base1_ja'], destino: 'base1_ja', mercado: 'JP', episodio: 900, entero: true, recolocarPorNumero: true, borrarSinDestino: false, pausa: async () => {} })
  const de = (id) => b.db.cartas.find((c) => c.id === id)
  check('sale bien', r.ok, JSON.stringify(r).slice(0, 300))
  check('entran TODAS como las tiene TCGGO («tcggo-<id>», su número, su foto y su Cardmarket)', ['tcggo-501', 'tcggo-502', 'tcggo-503'].every((id) => de(id)) && de('tcggo-501').local_id === '1' && de('tcggo-501').image_tcggo === 'https://images.tcggo.com/501.png' && de('tcggo-501').cm_id_product_propio === 7001)
  check('la línea de la nuestra nº 001 (nombre en japonés) pasa a la suya nº 1, POR NÚMERO', b.db.lineas.find((l) => l.id === 'l1')?.card_id === 'tcggo-501' && r.recolocadasPorNumero >= 1, JSON.stringify(r.equivalencias))
  check('lo nuestro con pareja o sin dueño se va (con su precio y su histórico)', !de('scrydex-1') && !de('scrydex-2') && !de('scrydex-99'))
  check('una nuestra CON dueño y sin pareja se queda, con su línea, y se dice', de('scrydex-98') && b.db.lineas.some((l) => l.id === 'l2' && l.card_id === 'scrydex-98') && r.seQuedan.some((c) => c.id === 'scrydex-98'), JSON.stringify(r.seQuedan))
  check('no se borra ninguna línea de nadie', !b.llamadas.some((l) => l.metodo === 'DELETE' && /^user_collection/.test(l.ruta)))

  const viejo = montar(SCRYDEX())
  await procesar({ env: ENV, fetchImpl: fetchTcggo, ...viejo, sets: ['base1_ja'], destino: 'base1_ja', mercado: 'JP', episodio: 900, entero: true, pausa: async () => {} })
  check('el entero de antes (por el nombre) habría BORRADO la línea de la carta en japonés: por eso el número', !viejo.db.lineas.some((l) => l.id === 'l1'))

  const otra = montar({ sets: [{ id: 'dpd' }], cartas: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, set_id: 'dpd', local_id: String(i + 10), name: 'ディアルガ', tcggo_id: null })) })
  const ro = await procesar({ env: ENV, fetchImpl: fetchTcggo, ...otra, sets: ['dpd'], destino: 'dpd', mercado: 'JP', episodio: 900, entero: true, recolocarPorNumero: true, borrarSinDestino: false, comprobarQueEsLaMisma: true, pausa: async () => {} })
  check('elegido por la huella y no es la misma: en el entero tampoco se toca nada', ro.ok === false && ro.noEsLaMisma === true && otra.guardadas.length === 0 && otra.db.cartas.length === 6)

  const dos = montar({ ...SCRYDEX(), sets: [{ id: 'base1_ja' }, { id: 'tcggo-900' }], cartas: [...SCRYDEX().cartas, { id: 'tcggo-503', set_id: 'tcggo-900', local_id: '3', name: 'Mew', tcggo_id: 503 }] })
  const rd = await procesar({ env: ENV, fetchImpl: fetchTcggo, ...dos, sets: ['base1_ja', 'tcggo-900'], destino: 'base1_ja', mercado: 'JP', episodio: 900, entero: true, recolocarPorNumero: true, borrarSinDestino: false, mismaExpansion: true, pausa: async () => {} })
  check('dos sets con el mismo tcggo_id se juntan sin comprobar el nombre (lo dice TCGGO), y el otro se borra', rd.ok && rd.setsBorrados.includes('tcggo-900'), JSON.stringify(rd).slice(0, 200))
}

console.log('\n── 2. El calco, vuelta 2 ──')
{
  const EPIS = [
    { id: 900, name: 'Expansion Pack', code: 'PMCG1', cards_total: 102, released_at: '1996-10-20' },
    { id: 902, name: 'Entry Pack', code: null, cards_total: 30, released_at: '2007-12-07' },
  ]
  const sets = [
    { id: 'base1_ja', name: '拡張パック', name_en: 'Expansion Pack', release_date: '1996-10-20', card_count_total: 102, tcggo_id: 900, oculto: false },
    { id: 'tcggo-9000', name: 'Expansion Pack', name_en: 'Expansion Pack', release_date: '1996-10-20', card_count_total: 102, tcggo_id: 900, oculto: false },
    { id: 'dpd', name: 'x', name_en: 'Dialga LV.X Constructed Standard Deck', release_date: '2007-12-07', card_count_total: 30, tcggo_id: null, oculto: false },
    { id: 'dpp', name: 'y', name_en: 'Palkia LV.X Constructed Standard Deck', release_date: '2007-12-07', card_count_total: 30, tcggo_id: null, oculto: false },
  ]
  const estados = { [calco.CLAVE_ESTADO]: { hechos: { 900: { fecha: '2026-10-01T00:00:00Z', set: 'base1_ja', por: 'fecha' } }, dudosos: { 902: { fecha: '2026-10-12T00:00:00Z' } }, lista: { fecha: '2026-10-13T00:00:00Z', episodios: [{ id: 900, nombre: 'Expansion Pack', codigo: 'PMCG1', cartas: 102, fecha: '1996-10-20' }] } } }
  const urls = []
  const hechas = []
  const parches = []
  const creados = []
  const sinTcggo = [{ id: 'dpd', name: 'x' }, { id: 'dpp', name: 'y' }]
  const b = {
    fetchImpl: async (url) => { urls.push(url); return { ok: true, status: 200, text: async () => JSON.stringify({ data: EPIS, paging: { current: 1, total: 1 } }) } },
    restImpl: async (ruta, opciones = null) => {
      if (opciones?.method === 'PATCH') { parches.push({ ruta: decodeURIComponent(ruta), cuerpo: JSON.parse(opciones.body) }); return null }
      if (/tcggo_id=is\.null&oculto=is\.false/.test(ruta)) return sinTcggo.filter((s) => !parches.some((p) => p.ruta.includes(`id=eq.${s.id}`) && p.cuerpo.oculto === true))
      if (ruta.startsWith('tcg_sets?')) return sets
      if (ruta.startsWith('tcg_cards?')) return [{ id: 'una' }]
      return []
    },
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    crearSetsImpl: async (filas) => { creados.push(...filas); return filas.length },
    procesarImpl: async (o) => { hechas.push(o); return { ok: true, suyas: 100, escritas: 100, recolocadasPorNumero: 7, lineasMovidas: 3, borradas: 90, seQuedan: [], setsBorrados: o.sets.slice(1) } },
  }
  const AHORA = new Date('2026-10-13T18:00:00Z')
  const pasar = () => calco.pasada({ env: ENV, ...b, ahora: AHORA, pausa: async () => {}, vuelta: 2 })
  const e = () => estados[calco.CLAVE_ESTADO]
  check('la vuelta 2 sigue existiendo (la 3 es la de la 810)', calco.VUELTA >= 2)
  const r1 = await pasar()
  check('empieza la vuelta 2: lo de la 1 se guarda y se vuelve a pedir la lista de HOY', e().vuelta === 2 && e().vueltas?.[1]?.hechas === 1 && urls.filter((u) => /episodes/.test(u)).length === 1 && e().lista.episodios.length === 2, JSON.stringify(r1).slice(0, 200))
  check('la que ya estaba «hecha» se vuelve a hacer, ENTERA', hechas[0]?.episodio === 900 && hechas[0]?.entero === true && hechas[0]?.recolocarPorNumero === true && hechas[0]?.borrarSinDestino === false, JSON.stringify(hechas[0] && { e: hechas[0].entero, r: hechas[0].recolocarPorNumero }))
  check('  …juntando los sets con su mismo tcggo_id en el destino', JSON.stringify(hechas[0]?.sets) === '["base1_ja","tcggo-9000"]' && hechas[0]?.mismaExpansion === true && JSON.stringify(e().hechos[900]?.juntados) === '["tcggo-9000"]')
  const r2 = await pasar()
  check('la dudosa (dos barajas ese día) no se queda fuera: se CREA la de TCGGO', creados.length === 1 && hechas[1]?.destino === creados[0].id && hechas[1]?.entero === true && e().dudosos[902]?.creada === true && e().hechos[902]?.por === 'nuevo', JSON.stringify(r2).slice(0, 200))
  const r3 = await pasar()
  check('con todas hechas, se esconden los sets japoneses sin tcggo_id', parches.filter((p) => p.cuerpo.oculto === true).length === 2 && e().escondidosAlFinal?.dpd && e().escondidosAlFinal?.dpp && e().cascarones.listo === true, JSON.stringify(r3).slice(0, 200))
  const r4 = await pasar()
  check('y después una pasada es leer el estado', r4.hecho === true && hechas.length === 2)
  check('no se ha fundido nada (en la vuelta entera lo creado ES lo de TCGGO)', !r1.fusion && !r2.fusion && !r3.fusion)
}

console.log('\n── 4. Las versiones de una carta (el Snorlax de PINGU) ──')
{
  const { separarVersiones, esMasPrincipal } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
  // Las dos fichas que pasó PINGU, con lo que las distingue (y lo que no).
  const normal = { id: 12774, name: 'Snorlax', card_number: 101, type: 'singles', cardmarket_id: 280841, tcgplayer_id: 89396, image: 'https://images.tcggo.com/tcggo/storage/12873/snorlax-pls-101-plasma-storm-pokemon.png', attacks: [{ name: 'Teampact' }], abilities: [{ name: 'Block' }], prices: { cardmarket: { lowest_near_mint: 24.95 } } }
  const reverse = { id: 43552, name: 'Snorlax', card_number: 101, type: 'singles', cardmarket_id: 280841, tcgplayer_id: 89396, image: null, attacks: null, abilities: null, prices: { cardmarket: { lowest_near_mint: 90.24 } } }
  const otra = { id: 12775, name: 'Snorlax', card_number: 102, cardmarket_id: 1, image: 'x' }
  for (const orden of [[normal, reverse], [reverse, normal]]) {
    const r = separarVersiones([...orden, otra])
    check(`la Reverse no es otra carta (orden ${orden[0].id} primero): la principal es la normal`, r.principales.length === 2 && r.principales.some((c) => c.id === 12774) && !r.principales.some((c) => c.id === 43552) && r.versiones.length === 1 && r.versiones[0].de === 12774 && r.versiones[0].id === 43552, JSON.stringify(r.versiones))
  }
  check('la principal: foto, luego ataques, luego el id más bajo', esMasPrincipal(normal, reverse) && !esMasPrincipal(reverse, normal) && esMasPrincipal({ id: 1 }, { id: 2 }))
  check('dos cartas distintas con el mismo número (otro nombre) siguen siendo dos', separarVersiones([normal, { id: 99, name: 'Pikachu', card_number: 101, cardmarket_id: 280841 }]).principales.length === 2)
  check('con OTRO producto de Cardmarket (un sello de staff) son dos cartas', separarVersiones([normal, { ...reverse, cardmarket_id: 999 }]).principales.length === 2)
  // En `procesar`: el set sale con UN Snorlax 101, el de la normal.
  const fetchSnorlax = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [reverse, normal], paging: { current: 1, total: 1 } }) })
  const b = montar({ sets: [{ id: 'bw8' }], cartas: [] })
  const r = await procesar({ env: ENV, fetchImpl: fetchSnorlax, ...b, sets: ['bw8'], destino: 'bw8', mercado: 'WEST', episodio: 93, entero: true, pausa: async () => {} })
  check('`procesar` escribe UN Snorlax 101, el de la normal, y lo dice', r.ok && b.guardadas.length === 1 && b.guardadas[0].tcggo_id === 12774 && r.versiones === 1, JSON.stringify(b.guardadas.map((g) => g.id)))
  const precios = readFileSync(`${RAIZ}/netlify/functions/tcggo-precios.mjs`, 'utf8')
  check('la pasada de precios elige la principal y no la primera que llega', /esMasPrincipal\(s, ya\)/.test(precios))
  const catalogo = readFileSync(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`, 'utf8')
  check('el catálogo semanal tampoco crea la Reverse como carta nueva', /separarVersiones\(suyas\)/.test(catalogo))
}

console.log('\n── 3. Las fuentes viejas del japonés, apagadas ──')
{
  // Retirados en la 806 y BORRADOS en la 817.
  check('el espejo y scrydex-huecos ya no existen', !existsSync(`${RAIZ}/netlify/functions/precios-espejo.mjs`) && !existsSync(`${RAIZ}/netlify/functions/scrydex-huecos.mjs`))
  const mercados = await import(`${RAIZ}/js/mercados.js`)
  check('y el japonés sigue fuera de las importaciones de TCGdex (es de TCGGO)', mercados.esDeTcggo('JP'))
  const admin = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('/admin enseña la vuelta y lo escondido al final', /vuelta/.test(admin) && /escondidosAlFinal/.test(admin))
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
