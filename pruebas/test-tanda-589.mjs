// Tanda 589 — los precios por idioma desde TCGGO: la fila, la función
// programada, el precio de una copia según su idioma, el bloque de precio
// y la migración. Sin red: TCGGO es el ejemplo de su documentación
// (fixtures/tcggo-cards-ejemplo.json, con cardmarket_id, idiomas y eBay).
import { readFileSync } from 'node:fs'
import { filaDePreciosTcggo, filaDeSetTcggo, resumirEpisodio } from '/home/user/pingu/netlify/lib/tcggo.mjs'
import { procesar, CLAVE_ESTADO } from '/home/user/pingu/netlify/functions/tcggo-precios.mjs'
import { CLAVE_ESTADO as CLAVE_PARES } from '/home/user/pingu/netlify/functions/tcggo-emparejar.mjs'
import {
  precioDeFila, precioParaIdioma, valorDe, valorDeLinea, resumenDePrecio, enlaceTcgplayer, enlaceCardmarket, IDIOMAS_CON_PRECIO, columnaDeIdioma, usdAEuros,
} from '/home/user/pingu/js/cardmarket.js'
import { bloqueDePrecio, gradeadasDe, chapasDeIdiomas, deQueEs } from '/home/user/pingu/js/precio-vista.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ')
const DIR = new URL('./fixtures/', import.meta.url)
const CARTAS = JSON.parse(readFileSync(new URL('tcggo-cards-ejemplo.json', DIR), 'utf8')).data
const AHORA = new Date('2026-10-05T12:00:00Z')

console.log('── 1. De la carta suya a nuestra fila ──')
{
  // El Pikachu ex del ejemplo de búsqueda: con eBay. Se monta a mano con
  // la forma EXACTA de su documentación.
  const pikachu = {
    id: 31508, cardmarket_id: 869668, tcgplayer_id: 675869, tcgid: 'me2pt5-57', card_number: 57,
    prices: {
      cardmarket: { currency: 'EUR', lowest_near_mint: 2.9, lowest_near_mint_EU_only: 2.9, lowest_near_mint_DE: 3.5, lowest_near_mint_FR: 2.95, lowest_near_mint_ES: 3.5, lowest_near_mint_IT: 1, '30d_average': 4.33, '7d_average': 4.45, available_items: 420, graded: [] },
      ebay: { currency: 'USD', graded: { psa: { 10: { median_price: 88.67, sample_size: 1 } } } },
      tcg_player: { currency: 'EUR', market_price: 3.33 },
    },
  }
  const f = filaDePreciosTcggo('me02.5-57', pikachu, { ahora: AHORA })
  check('el mínimo por idioma, cada uno en su columna (y el general es el inglés)', f.cm_low_es === 3.5 && f.cm_low_de === 3.5 && f.cm_low_fr === 2.95 && f.cm_low_it === 1 && f.cm_low_en === 2.9 && f.cm_low === 2.9, JSON.stringify(f))
  check('las medias, cuántas hay, TCGplayer en euros y el id de producto', f.cm_avg30 === 4.33 && f.cm_avg7 === 4.45 && f.cm_disponibles === 420 && f.tp_market_eur === 3.33 && f.cm_id_product === 869668 && f.tcggo_id === 31508)
  check('las gradeadas de Cardmarket vacías (`[]`) son null; las de eBay se guardan', f.cm_gradeadas === null && f.ebay_gradeadas?.psa?.[10]?.median_price === 88.67)
  check('origen tcggo y las dos fechas', f.origen === 'tcggo' && f.tcggo_updated === AHORA.toISOString() && f.checked_at === AHORA.toISOString())
  const tropius = filaDePreciosTcggo('me05-1', CARTAS[0], { ahora: AHORA })
  check('el Tropius del ejemplo: 0,02 en todos los idiomas y sin gradeadas', tropius.cm_low_es === 0.02 && tropius.ebay_gradeadas === null && tropius.cm_gradeadas === null)
  check('un TCGplayer en dólares no se guarda como euros', filaDePreciosTcggo('x', { prices: { tcg_player: { currency: 'USD', market_price: 5 } } }).tp_market_eur === null)
  check('sin cardmarket_id la fila no lleva cm_id_product (no pisa el que haya)', !('cm_id_product' in filaDePreciosTcggo('x', { prices: {} })))
  const set = filaDeSetTcggo('me05', resumirEpisodio({ id: 415, name: 'Pitch Black', code: 'PBL', cards_total: 120, released_at: '2026-07-17', logo: 'https://images.tcggo.com/x.png' }))
  check('la fila del set: id suyo, logo, fecha y total', set.id === 'me05' && set.tcggo_id === 415 && set.logo === 'https://images.tcggo.com/x.png' && set.fecha === '2026-07-17' && set.cartas === 120, JSON.stringify(set))
  check('  …y un logo que no es una URL, null', filaDeSetTcggo('x', { id: 1, logo: 'nada' }).logo === null)
}

console.log('── 2. La función programada ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
  // El estado de los pares, como lo deja tcggo-emparejar: dos sets en la
  // expansión 415 (Pitch Black y una «galería» ficticia) y uno sospechoso.
  const PARES = {
    episodios: { fecha: '2026-10-05T10:00:00Z', lista: [{ id: 415, nombre: 'Pitch Black', codigo: 'PBL', cartas: 120, fecha: '2026-07-17', logo: 'https://images.tcggo.com/pbl.png' }, { id: 413, nombre: 'Chaos Rising', codigo: 'CRI', cartas: 122, fecha: '2026-05-22', logo: null }] },
    hechos: { me05: { episodio: 415, pares: 20 }, 'me05-g': { episodio: 415, pares: 1 }, ex7: { episodio: 413, pares: 100, sospechoso: 'pl2' }, me04: { episodio: 413, pares: 1 } },
  }
  const NUESTRAS = {
    415: [{ id: 'me05-1', cm_id_product_propio: 895789 }, { id: 'me05-2', cm_id_product_propio: 895790 }, { id: 'me05-g-1', cm_id_product_propio: 895808 }, { id: 'me05-99', cm_id_product_propio: 1 }],
    413: [{ id: 'me04-1', cm_id_product_propio: 700000 }],
  }
  const CATALOGO = { setsPorEpisodio: { JP: { 701: ['SV1a'] } } }
  const montar = (estadoInicial = {}) => {
    const estados = { [CLAVE_PARES]: JSON.parse(JSON.stringify(PARES)), tcggo_catalogo: JSON.parse(JSON.stringify(CATALOGO)), [CLAVE_ESTADO]: estadoInicial }
    const escritas = []
    const sets = []
    const urls = []
    const fetchImpl = async (url, { headers }) => {
      urls.push(url)
      if (headers['x-rapidapi-host'] !== 'cardmarket-api-tcg.p.rapidapi.com') return { ok: false, status: 403, text: async () => 'host' }
      const u = new URL(url)
      const ep = Number(u.searchParams.get('episode_id'))
      if (ep === 415) return { ok: true, status: 200, text: async () => JSON.stringify({ data: CARTAS, paging: { current: 1, total: 1, per_page: 100 } }) }
      if (ep === 413) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 5000, card_number: '1', cardmarket_id: 700000, prices: { cardmarket: { lowest_near_mint: 9, lowest_near_mint_ES: 8 }, tcg_player: { currency: 'EUR', market_price: 7 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
      if (ep === 701 && /pokemon-jp/.test(u.pathname)) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 70001, card_number: '001', cardmarket_id: 700001, prices: { cardmarket: { lowest_near_mint: 15, lowest_near_mint_JP: 12 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
      return { ok: false, status: 404, text: async () => 'no' }
    }
    const restImpl = async (ruta) => {
      const m = ruta.match(/set_id=in\.\(([^)]*)\)/)
      if (!m) throw new Error(`ruta inesperada ${ruta}`)
      const ids = m[1].split(',').map((x) => decodeURIComponent(x.replace(/"/g, '')))
      if (/market=eq\.JP/.test(ruta)) return ids.includes('SV1a') ? [{ id: 'SV1a-001', cm_id_product_propio: 700001 }] : []
      return Object.values(NUESTRAS).flat().filter((c) => ids.some((id) => c.id.startsWith(id + '-')))
    }
    return {
      estados, escritas, sets, urls, fetchImpl, restImpl,
      guardarImpl: async (filas) => { escritas.push(...filas) },
      guardarSetsImpl: async (f) => { sets.push(...f); return f.length },
      estadoImpl: async (clave) => estados[clave],
      guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
    }
  }
  const sinPausa = async () => {}

  const b = montar()
  const r = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('una pasada: las dos expansiones occidentales (el set sospechoso no cuenta) y la japonesa, 3 peticiones', r.ok && r.hecho === true && r.episodios === 3 && r.peticionesEstaPasada === 3 && r.quedan === 0, JSON.stringify(r).slice(0, 300))
  check('escribe una fila por carta nuestra con carta suya: 3 de Pitch Black + 1 de Chaos Rising + 1 japonesa', r.escritas === 5 && b.escritas.length === 5 && r.sinPar === 1, JSON.stringify([r.escritas, r.sinPar]))
  check('  …la japonesa con su mínimo japonés (12) por la puerta /pokemon-jp', b.escritas.find((f) => f.card_id === 'SV1a-001')?.cm_low_ja === 12 && b.urls.some((u) => /pokemon-jp\/cards\?episode_id=701/.test(u)), JSON.stringify(b.escritas.find((f) => f.card_id === 'SV1a-001')))
  const tropius = b.escritas.find((f) => f.card_id === 'me05-1')
  check('  …el Tropius con sus idiomas y su origen', tropius?.cm_low_es === 0.02 && tropius.cm_id_product === 895789 && tropius.origen === 'tcggo', JSON.stringify(tropius))
  check('  …la de la «galería» (otro set, misma expansión) también', b.escritas.some((f) => f.card_id === 'me05-g-1' && f.cm_id_product === 895808))
  check('  …y la de Chaos Rising con TCGplayer en euros', b.escritas.find((f) => f.card_id === 'me04-1')?.tp_market_eur === 7)
  check('los sets quedan apuntados con el logo suyo (3 filas: me05, me05-g, me04; ex7 no)', r.setsApuntados === 3 && b.sets.find((s) => s.id === 'me05')?.logo === 'https://images.tcggo.com/pbl.png' && !b.sets.some((s) => s.id === 'ex7'), JSON.stringify(b.sets))
  check('el estado marca el día hecho con las dos expansiones y la japonesa aparte', b.estados[CLAVE_ESTADO].dia === '2026-10-05' && b.estados[CLAVE_ESTADO].hecho === true && b.estados[CLAVE_ESTADO].hechos.length === 2 && b.estados[CLAVE_ESTADO].hechosJp.length === 1)
  const antes = b.urls.length
  const r2 = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('la segunda pasada del día no pide nada', r2.ok && /ya están puestos/.test(r2.saltado) && b.urls.length === antes, JSON.stringify(r2))
  const r3 = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: new Date('2026-10-06T12:00:00Z') })
  check('al día siguiente vuelve a empezar (y los sets se vuelven a apuntar)', r3.ok && r3.peticionesEstaPasada === 3 && r3.hecho === true && r3.setsApuntados === 3, JSON.stringify([r3.peticionesEstaPasada, r3.setsApuntados]))

  // Sin tiempo: hace una y deja la otra para la siguiente.
  let tic = 0
  const b4 = montar()
  const r4 = await procesar({ env: ENV, ...b4, pausa: sinPausa, ahora: AHORA, reloj: () => (tic++ > 2 ? 1e9 : 0) })
  check('sin tiempo, deja expansiones para la próxima y lo dice', r4.ok && r4.hecho === false && r4.quedan >= 1 && /próxima pasada/.test(r4.nota || ''), JSON.stringify([r4.hecho, r4.quedan, r4.nota]))
  const r5 = await procesar({ env: ENV, ...b4, pausa: sinPausa, ahora: AHORA })
  check('  …y la siguiente las acaba', r5.ok && r5.hecho === true && b4.escritas.length === 5)

  // Sin pares todavía, sin clave, sin la migración.
  const b6 = montar()
  b6.estados[CLAVE_PARES] = {}
  check('sin sets emparejados se salta diciéndolo', /Emparejar con TCGGO/.test((await procesar({ env: ENV, ...b6, pausa: sinPausa, ahora: AHORA })).saltado || ''))
  check('sin TCGGO_API_KEY se salta', /TCGGO_API_KEY/.test((await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's' }, ...montar(), pausa: sinPausa, ahora: AHORA })).saltado || ''))
  const b7 = montar()
  b7.guardarImpl = async () => { throw new Error("Could not find the 'cm_low_es' column of 'tcg_card_prices' in the schema cache (PGRST204)") }
  check('sin la migración se salta nombrándola', /tcggo-precios\.sql/.test((await procesar({ env: ENV, ...b7, pausa: sinPausa, ahora: AHORA })).saltado || ''))
  // Una expansión sin cardmarket_id: para, no escribe, no la da por hecha.
  const b8 = montar()
  const fetch8 = async (url, o) => {
    const r = await b8.fetchImpl(url, o)
    if (!/episode_id=415/.test(url)) return r
    const j = JSON.parse(await r.text())
    j.data = j.data.map((c) => ({ ...c, cardmarket_id: null }))
    return { ok: true, status: 200, text: async () => JSON.stringify(j) }
  }
  const r8 = await procesar({ env: ENV, ...b8, fetchImpl: fetch8, pausa: sinPausa, ahora: AHORA })
  check('cartas sin cardmarket_id: para diciéndolo y no da la expansión por hecha', /sin cardmarket_id/.test(r8.parado || '') && !b8.estados[CLAVE_ESTADO].hechos.includes(415) && b8.escritas.length === 0, JSON.stringify(r8.parado))
}

console.log('── 3. El precio de una copia según su idioma ──')
{
  const fila = {
    card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_trend: 196.68, cm_avg30: 131.56, cm_avg7: 144.25,
    cm_low_en: 194, cm_low_de: null, cm_low_fr: 150, cm_low_es: 140, cm_low_it: null, cm_disponibles: 12,
    tp_market_eur: 171.08, tp_mid_eur: 180, tp_holo_market: 150, tp_holo_low: 120,
    cm_gradeadas: { psa: { psa10: 2621, psa9: 184 }, cgc: { cgc10: 900 } },
    ebay_gradeadas: { psa: { 10: { median_price: 2941, sample_size: 5 }, 8: { median_price: 700, sample_size: 2 } }, bgs: { 10: { median_price: 3500, sample_size: 3 } }, tag: { 10: { median_price: 999, sample_size: 1 } } },
    tcggo_updated: '2026-10-05T12:00:00Z', cm_updated: '2026-10-04T00:40:55Z',
  }
  const p = precioDeFila(fila, { variante: 'holo' })
  check('la fila trae los idiomas, TCGplayer en euros y las gradeadas', p.porIdioma?.es === 140 && p.porIdioma.en === 194 && !('de' in p.porIdioma) && p.tpEur === 171.08 && p.disponibles === 12 && p.gradeadas?.cardmarket?.psa?.psa10 === 2621, JSON.stringify(p.porIdioma))
  check('en español vale 140 (su mínimo)', precioParaIdioma(p, 'es')?.valor === 140 && precioParaIdioma(p, 'es').origen === 'cardmarket-idioma' && valorDe(p, 'es') === 140)
  check('en inglés, 194', valorDe(p, 'en') === 194)
  check('en alemán, sin mínimo alemán, cae al general: el mínimo 39 (no la tendencia 196)', valorDe(p, 'de') === 39 && precioParaIdioma(p, 'de').origen === 'cardmarket', String(valorDe(p, 'de')))
  check('sin idioma, el español por defecto', valorDe(p) === 140)
  check('una línea en español de 2 copias suma 280; en francés, 300', valorDeLinea({ cantidad: 2, idioma: 'es' }, p) === 280 && valorDeLinea({ cantidad: 2, idioma: 'fr' }, p) === 300)
  check('el manual sigue mandando', valorDeLinea({ cantidad: 1, idioma: 'es', valor_manual: 999 }, p) === 999)
  check('la frase: «Desde 140,00 € en español»', limpio(resumenDePrecio(p, 'es')) === 'Desde 140,00 € en español' && limpio(resumenDePrecio(p, 'de')) === 'Desde 39,00 € en Cardmarket', limpio(resumenDePrecio(p, 'de')))
  // Sin Cardmarket: TCGplayer en euros antes que en dólares.
  const soloTp = precioDeFila({ card_id: 'x', tp_market_eur: 12.5, tp_holo_market: 20 }, { variante: 'holo' })
  check('sin Cardmarket, TCGplayer en euros de TCGGO (12,50), no los dólares convertidos', valorDe(soloTp, 'es') === 12.5 && precioParaIdioma(soloTp, 'es').origen === 'tcgplayer' && limpio(resumenDePrecio(soloTp)) === 'TCGplayer: 12,50 €', limpio(resumenDePrecio(soloTp)))
  const soloUsd = precioDeFila({ card_id: 'x', tp_holo_market: 20 }, { variante: 'holo' })
  check('  …y sin euros, los dólares convertidos, con el ≈', valorDe(soloUsd) === usdAEuros(20) && /≈/.test(resumenDePrecio(soloUsd)))
  check('sin nada, null y «Sin precio.»', precioDeFila({ card_id: 'x' }) === null && resumenDePrecio(null) === 'Sin precio.')
  check('los idiomas con precio, en orden, con su columna (el japonés desde la 642)', JSON.stringify(IDIOMAS_CON_PRECIO) === '["es","en","de","fr","it","ja"]' && columnaDeIdioma('es') === 'cm_low_es' && columnaDeIdioma('ja') === 'cm_low_ja' && columnaDeIdioma('pt') === null)
  // El japonés (642): su columna, su valor, y el enlace al producto sin filtro de idioma.
  const jp = precioDeFila({ card_id: 'SV1a-001', cm_id_product: 777, cm_low_ja: 12, cm_low: 20 })
  check('una copia japonesa vale su mínimo japonés (12), no el general (20)', valorDe(jp, 'ja') === 12 && precioParaIdioma(jp, 'ja').origen === 'cardmarket-idioma' && limpio(resumenDePrecio(jp, 'ja')) === 'Desde 12,00 € en japonés', limpio(resumenDePrecio(jp, 'ja')))
  check('  …y el botón va al producto aunque el japonés no tenga filtro de idioma en Cardmarket', /idProduct=777/.test(enlaceCardmarket({ idProduct: 777, idioma: 'ja' })) && !/language=/.test(enlaceCardmarket({ idProduct: 777, idioma: 'ja' })))
  check('  …la fila de una carta del mercado JP coge el general como japonés si no hay _JP', filaDePreciosTcggo('x', { prices: { cardmarket: { lowest_near_mint: 9 } } }, { mercado: 'JP' }).cm_low_ja === 9 && filaDePreciosTcggo('x', { prices: { cardmarket: { lowest_near_mint: 9, lowest_near_mint_JP: 7 } } }, { mercado: 'JP' }).cm_low_ja === 7 && filaDePreciosTcggo('x', { prices: { cardmarket: { lowest_near_mint: 9 } } }).cm_low_ja === null)
  check('el enlace a TCGplayer va directo al producto', enlaceTcgplayer(96048) === 'https://www.tcgplayer.com/product/96048' && enlaceTcgplayer(null) === null && enlaceTcgplayer('x') === null)

  console.log('── 4. El bloque de precio ──')
  const html = bloqueDePrecio(p, { idioma: 'es', estado: 'NM', variante: 'holo', nombre: 'Groudon-EX', tcgplayerId: 96048 })
  check('la cifra es la del español, y el renglón dice de qué es', /<p class="pv-cifra">140,00 €<\/p>/.test(limpio(html)) && /mínimo en español en Cardmarket · NM · 5 oct/.test(html), limpio(html).slice(0, 300))
  check('una chapa por idioma con precio, la española marcada, y TCGplayer en euros', /pv-chapa pv-activa"[^>]*><b>ES<\/b> 140,00 €/.test(limpio(html)) && /<b>EN<\/b> 194,00 €/.test(limpio(html)) && !/<b>DE<\/b>/.test(html) && /<b>TCGplayer<\/b> 171,08 €/.test(limpio(html)))
  check('los dos botones: Cardmarket al producto con el español, TCGplayer al suyo', /btn-cardmarket[^>]*href="https:\/\/www\.cardmarket\.com\/es\/Pokemon\/Products\?idProduct=273681&amp;language=4&amp;minCondition=2"/.test(html) && /btn-tcgplayer[^>]*href="https:\/\/www\.tcgplayer\.com\/product\/96048"/.test(html), html.match(/href="[^"]*"/g)?.join(' '))
  const g = gradeadasDe(p.gradeadas)
  check('las gradeadas aplanadas: Cardmarket en euros primero, eBay en dólares, por casa y nota', g.length === 6 && g[0].casa === 'PSA' && g[0].nota === '10' && g[0].valor === 2621 && g[0].moneda === 'EUR' && g.find((x) => x.casa === 'BGS')?.moneda === 'USD' && g.find((x) => x.casa === 'TAG')?.nota === '10', JSON.stringify(g))
  check('  …sin repetir la PSA 10 de eBay (ya está la de Cardmarket)', g.filter((x) => x.casa === 'PSA' && x.nota === '10').length === 1)
  check('las chapas llevan la casa en data-casa y los dólares se dicen', /pv-gradeada" data-casa="PSA"[^>]*><b>PSA 10<\/b> 2621,00 €/.test(limpio(html)) && /data-casa="BGS"/.test(html) && /Los dólares son ventas en eBay/.test(html))
  const sinNada = bloqueDePrecio(null, { idioma: 'es', nombre: 'Carta' })
  check('sin precio: «Sin precio», el botón de buscar en Cardmarket y nada más', /pv-sin/.test(sinNada) && /Products\/Search\?searchString=Carta/.test(sinNada) && !/btn-tcgplayer/.test(sinNada) && !/pv-gradeadas/.test(sinNada) && !/pv-idiomas/.test(sinNada))
  check('sin TCGGO no hay chapas de idioma', chapasDeIdiomas(precioDeFila({ card_id: 'x', cm_low: 3 }), 'es') === '')
  check('de qué es, en tres versiones', /cualquier idioma/.test(deQueEs({ origen: 'cardmarket' }, { idioma: 'es' })) && /convertidos a ojo/.test(deQueEs({ origen: 'tcgplayer', dolares: 20 }, { idioma: 'es' })) && /en euros/.test(deQueEs({ origen: 'tcgplayer' }, { idioma: 'es' })))
  check('el HTML no cuela nada: el nombre se escapa', /searchString=%3Cb%3E/.test(bloqueDePrecio(null, { nombre: '<b>' })) && !/<b>" /.test(bloqueDePrecio(null, { nombre: '<b>' })))
}

console.log('── 5. La migración ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-tcggo-precios.sql', 'utf8')
  for (const c of ['cm_low_en', 'cm_low_de', 'cm_low_fr', 'cm_low_es', 'cm_low_it', 'cm_disponibles', 'tp_market_eur', 'tp_mid_eur', 'cm_gradeadas', 'ebay_gradeadas', 'tcggo_id', 'tcggo_updated']) check(`añade ${c}`, sql.includes(`add column if not exists ${c}`))
  const sqlJp = readFileSync('/home/user/pingu/supabase-migration-tcggo-japones.sql', 'utf8')
  check('la del japonés (642): la columna, el caso «ja» en la regla, la firma de la 589 borrada y la foto con la columna', /add column if not exists cm_low_ja/.test(sqlJp) && /when 'ja' then p_low_ja/.test(sqlJp) && /drop function if exists public\.valor_de_linea\(numeric, int, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric/.test(sqlJp) && /pr\.cm_low_it, pr\.cm_low_ja,/.test(sqlJp))
  check('tp_id_product_propio en tcg_cards, logo_tcggo en tcg_sets', /tcg_cards add column if not exists tp_id_product_propio/.test(sql) && /tcg_sets add column if not exists logo_tcggo/.test(sql))
  check('la función de pares guarda el id de TCGplayer sin cambiar de firma', /tp_id_product_propio = coalesce\(p\.tp_id_product, c\.tp_id_product_propio\)/.test(sql) && /p\(id text, id_product int, por text, tp_id_product int\)/.test(sql))
  check('tcggo_guardar_sets solo rellena fecha y total si están vacíos', /release_date = coalesce\(s\.release_date, p\.fecha\)/.test(sql) && /card_count_total = coalesce\(s\.card_count_total, nullif\(p\.cartas, 0\)\)/.test(sql))
  check('valor_de_linea: el idioma decide antes que el general, y el general va mínimo → tendencia → media', sql.indexOf("when 'es' then p_low_es") < sql.indexOf('nullif(p_low, 0), nullif(p_trend, 0), nullif(p_avg30, 0)') && /del_idioma,\s*case when general/.test(sql))
  check('  …y TCGplayer en euros antes que los dólares', sql.indexOf('nullif(p_tp_market_eur, 0)') < sql.indexOf('round(usd * public.eur_por_usd(), 2)'))
  check('la foto diaria pasa el idioma y las cinco columnas', /c\.valor_manual, c\.cantidad, c\.variante, c\.idioma,/.test(sql) && /pr\.cm_low_es, pr\.cm_low_en, pr\.cm_low_de, pr\.cm_low_fr, pr\.cm_low_it,/.test(sql))
  check('la firma vieja se borra (dos valor_de_linea serían una ambigüedad)', /drop function if exists public\.valor_de_linea\(numeric, int, text, numeric/.test(sql))
  check('las dos funciones nuevas solo para service_role', /grant execute on function public\.tcggo_guardar_sets\(jsonb, text\) to service_role/.test(sql) && /revoke all on function public\.cardmarket_guardar_pares\(jsonb, text\) from public, anon, authenticated/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
