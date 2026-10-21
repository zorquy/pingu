// Tanda 929 — Las versiones de TCGGO con su precio (PINGU: «adelante con lo
// recomendado en TCGGO»). Los datos son el EJEMPLO DE SU DOCUMENTACIÓN (la
// 1.4 que pasó PINGU), copiado tal cual en fixtures-929/.
//   1. Lo puro: la URL con `include_variants`, el lote por ids, las filas de
//      versión (sin las columnas por idioma), el símbolo del set.
//   2. La pasada de precios: pide las versiones en la misma petición y las
//      guarda; si guardarlas falla, el precio de la carta se escribe igual.
//   3. El recorrido de ids de la 807 se retira mientras lleguen.
//   4. El precio por idioma de las que alguien tiene: de 20 en 20, solo
//      precio, con sus frenos.
//   5. La sonda: las repetidas por número de un set.
//   6. La estantería pide el símbolo con respaldo (sin la migración, repite
//      sin él).
//   7. En la web: una copia Reverse vale lo de su versión; el símbolo sale
//      delante del nombre; «Completar el maestro».
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const precios = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const versiones = await import(`${RAIZ}/netlify/functions/tcggo-versiones.mjs`)
const idiomas = await import(`${RAIZ}/netlify/functions/tcggo-versiones-idioma.mjs`)
const sonda = await import(`${RAIZ}/netlify/functions/tcggo-sonda.mjs`)
const sets = await import(`${RAIZ}/netlify/functions/sets.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const DOC = JSON.parse(readFileSync(join(AQUI, 'fixtures-929', 'episodio-cartas-con-variantes.json'), 'utf8'))
const AHORA = new Date('2026-10-21T12:00:00Z')
const CON_VERSIONES = DOC.data.filter((c) => (c.variants || []).some((v) => v.id !== c.id)).length
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
const sinPausa = async () => {}

console.log('── 1. Lo puro ──')
{
  check('la lista de una expansión pide las versiones solo si se dice', /include_variants=1$/.test(lib.urlCartasDeEpisodio(431, 2, lib.URL_BASE, { versiones: true })) && !/include_variants/.test(lib.urlCartasDeEpisodio(431, 2)))
  check('el lote: hasta 20 ids', /\/cards\?ids=1,2,3&per_page=20$/.test(lib.urlCartasPorIds([1, 2, 3])) && lib.urlCartasPorIds(Array.from({ length: 30 }, (_, i) => i + 1)).split('ids=')[1].split('&')[0].split(',').length === 20)
  check('etiqueta de un tipo sin rótulo: «Poké Ball», «Master Ball», y lo demás con mayúsculas', lib.etiquetaDeTipo('poke_ball') === 'Poké Ball' && lib.etiquetaDeTipo('master_ball') === 'Master Ball' && lib.etiquetaDeTipo('energy_symbol_pattern') === 'Energy Symbol Pattern' && lib.etiquetaDeTipo('') === null)
  const carta = DOC.data[0]
  const filas = lib.filasDeVariantes(carta, { id: 'por-1', set_id: 'por' }, { ahora: AHORA })
  check('la versión del ejemplo de su documentación: su id, su rótulo y su precio', filas.length === 1 && filas[0].tcggo_id === 35162 && filas[0].etiqueta === 'Reverse Holo' && filas[0].cm_low === 0.03 && filas[0].card_id === 'por-1' && filas[0].set_id === 'por' && filas[0].market === 'WEST', JSON.stringify(filas))
  check('  …SIN las columnas por idioma (no pisa lo que puso el lote)', !Object.keys(filas[0]).some((k) => /^cm_low_/.test(k)))
  check('  …y la que es la carta misma, una repetida o sin id, no es una versión', lib.filasDeVariantes({ ...carta, variants: [{ id: carta.id }, { id: 9, type: 'poke_ball' }, { id: 9 }, { type: 'x' }] }, { id: 'a' }).map((f) => `${f.tcggo_id}:${f.etiqueta}`).join() === '9:Poké Ball')
  const id = lib.filaDeIdiomasDeVersion({ id: 35162, prices: { cardmarket: { lowest_near_mint: 0.03, lowest_near_mint_ES: 0.05, lowest_near_mint_DE: 0.04 } } }, { cardId: 'por-1', ahora: AHORA })
  check('el lote escribe los precios por idioma y NO la etiqueta', id.cm_low_es === 0.05 && id.cm_low_de === 0.04 && id.tcggo_id === 35162 && !('etiqueta' in id) && !('nombre' in id), JSON.stringify(id))
  const ep = lib.resumirEpisodio({ id: 431, name: '30th', symbol: 'https://images.tcggo.com/s.png', logo: 'https://images.tcggo.com/l.png' })
  check('el símbolo de la expansión pasa al resumen y a la fila del set', ep.simbolo === 'https://images.tcggo.com/s.png' && lib.filaDeSetTcggo('30th', ep).simbolo === 'https://images.tcggo.com/s.png' && lib.resumirEpisodio({ id: 1, symbol: 'nada' }).simbolo === null)
  const sql = readFileSync(join(RAIZ, 'supabase-migration-929-simbolos.sql'), 'utf8')
  check('la migración da su columna al símbolo y la función lo escribe', /add column if not exists symbol_tcggo text/.test(sql) && /symbol_tcggo = coalesce\(nullif\(p\.simbolo, ''\), s\.symbol_tcggo\)/.test(sql) && /simbolo text/.test(sql))
}

console.log('── 2. La pasada de precios trae las versiones ──')
const montarPrecios = ({ fallaVersiones = false } = {}) => {
  const estados = {
    [CLAVE_PARES]: { episodios: { fecha: '2026-10-21T10:00:00Z', lista: [{ id: 431, nombre: '30th', codigo: '30C', cartas: 128, fecha: '2026-09-16', logo: 'https://images.tcggo.com/l.png', valorCm: 10 }] }, hechos: { por: { episodio: 431, pares: 3 } } },
    tcggo_catalogo: {},
    [precios.CLAVE_ESTADO]: {},
  }
  const urls = []
  const escritas = []
  const vers = []
  return {
    estados, urls, escritas, vers,
    fetchImpl: async (url) => {
      urls.push(url)
      if (/episode_id=431/.test(url)) return { ok: true, status: 200, text: async () => JSON.stringify({ ...DOC, paging: { current: 1, total: 1, per_page: 100 } }) }
      return { ok: false, status: 404, text: async () => 'no' }
    },
    restImpl: async (ruta) => {
      if (/^tcg_sets\?select=id&market=eq\.WEST/.test(ruta)) return [{ id: 'por' }]
      if (/^tcg_cards\?select=id,set_id,cm_id_product_propio/.test(ruta)) return DOC.data.map((c, i) => ({ id: `por-${i + 1}`, set_id: 'por', cm_id_product_propio: c.cardmarket_id }))
      if (/^tcg_cards/.test(ruta)) return []
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarImpl: async (f) => { escritas.push(...f) },
    guardarSetsImpl: async (f) => f.length,
    fotoImpl: async () => null,
    guardarVersionesImpl: async (f) => { if (fallaVersiones) throw new Error('Supabase 500: tcg_card_versions'); vers.push(...f) },
    estadoImpl: async (clave) => estados[clave],
    guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
  }
}
{
  const b = montarPrecios()
  const r = await precios.procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('la página de la expansión se pide con include_variants=1', b.urls.some((u) => /episode_id=431.*include_variants=1/.test(u)), b.urls.join(' | '))
  check('  …y es UNA petición (las versiones no cuestan nada más)', b.urls.filter((u) => /cards\?/.test(u)).length === 1, String(b.urls.length))
  check('los precios de las cartas, como siempre', r.ok && b.escritas.length === DOC.data.length, JSON.stringify(r).slice(0, 200))
  check('las versiones, guardadas colgando de NUESTRA carta', b.vers.length === CON_VERSIONES && b.vers.every((v) => v.etiqueta === 'Reverse Holo' && /^por-\d+$/.test(v.card_id) && v.set_id === 'por') && b.vers[0].tcggo_id === 35162, JSON.stringify(b.vers.slice(0, 2)))
  const e = b.estados[precios.CLAVE_ESTADO]
  check('  …y el estado lo cuenta y apunta cuándo llegó la última', e.versiones?.escritas === CON_VERSIONES && e.versionesUltimaVista === AHORA.toISOString(), JSON.stringify(e).slice(0,600))
  const b2 = montarPrecios({ fallaVersiones: true })
  const r2 = await precios.procesar({ env: ENV, ...b2, pausa: sinPausa, ahora: AHORA })
  check('si guardar las versiones falla, el precio de las cartas se escribe igual', r2.ok && b2.escritas.length === DOC.data.length && /tcg_card_versions/.test(b2.estados[precios.CLAVE_ESTADO].versiones?.error || '') && !b2.estados[precios.CLAVE_ESTADO].versionesUltimaVista, JSON.stringify(b2.estados[precios.CLAVE_ESTADO].versiones))
}

{
  // 932: lo que ya se hizo HOY antes de las versiones se repite una vez.
  const b = montarPrecios()
  b.estados[precios.CLAVE_ESTADO] = { dia: AHORA.toISOString().slice(0, 10), hechos: [431], hechosJp: [] }
  await precios.procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  check('lo hecho hoy sin versiones se vuelve a pedir (una vez)', b.urls.some((u) => /episode_id=431.*include_variants=1/.test(u)) && b.estados[precios.CLAVE_ESTADO].versionVariantes === precios.VERSION_VARIANTES, b.urls.join(' | '))
  const c = montarPrecios()
  c.estados[precios.CLAVE_ESTADO] = { dia: AHORA.toISOString().slice(0, 10), hechos: [431], hechosJp: [], versionVariantes: precios.VERSION_VARIANTES }
  await precios.procesar({ env: ENV, ...c, pausa: sinPausa, ahora: AHORA })
  check('  …y la segunda vez ya no', !c.urls.some((u) => /episode_id=431/.test(u)), c.urls.join(' | '))
}

console.log('── 3. El recorrido de ids se retira mientras lleguen ──')
{
  const montar = (vista) => ({
    restImpl: async (ruta) => {
      if (/clave=eq\.tcggo_precios/.test(ruta)) return [{ valor: vista ? { versionesUltimaVista: vista } : {} }]
      if (/clave=eq\.tcggo_versiones/.test(ruta)) return [{ valor: {} }]
      throw new Error('para aquí')
    },
    fetchImpl: async () => { throw new Error('no debería pedir a TCGGO') },
  })
  const r = await versiones.procesar({ env: ENV, ...montar('2026-10-20T10:00:00Z'), ahora: AHORA, pausa: sinPausa })
  check('con versiones llegando ayer, no recorre ni pide nada', r.ok && /llegan con los precios/.test(r.saltado || ''), JSON.stringify(r))
  let pidio = false
  const vieja = montar('2026-10-10T10:00:00Z')
  vieja.fetchImpl = async () => { pidio = true; return { ok: false, status: 429, text: async () => 'quota' } }
  const r2 = await versiones.procesar({ env: ENV, ...vieja, ahora: AHORA, pausa: sinPausa })
  check('si hace más de tres días que no llegan, vuelve a recorrer solo', !/llegan con los precios/.test(r2.saltado || '') && pidio, JSON.stringify(r2).slice(0, 200))
}

console.log('── 4. El precio por idioma de las que alguien tiene ──')
{
  const copias = [{ card_id: 'a', variante: 'reverse' }, { card_id: 'b', variante: 'normal' }, { card_id: 'c', variante: 'master-ball' }, { card_id: 'd', market: 'JP', variante: 'reverse' }]
  const filas = [{ tcggo_id: 1, card_id: 'a', etiqueta: 'Reverse Holo' }, { tcggo_id: 2, card_id: 'a', etiqueta: 'Poké Ball' }, { tcggo_id: 3, card_id: 'c', etiqueta: 'Master Ball' }, { tcggo_id: 4, card_id: 'b', etiqueta: 'Reverse Holo' }, { tcggo_id: 5, card_id: 'd', market: 'JP', etiqueta: null }]
  const v = idiomas.versionesQueAlguienTiene(copias, filas)
  check('solo las versiones que alguien tiene (por su etiqueta; sin etiqueta es la Reverse)', v.map((x) => x.tcggo_id).sort().join() === '1,3,5', JSON.stringify(v))
  const lotes = idiomas.lotesPorPedir(v, { hechos: [3] })
  check('  …en lotes por catálogo, sin lo hecho hoy', JSON.stringify(lotes) === JSON.stringify([{ mercado: 'WEST', ids: [1] }, { mercado: 'JP', ids: [5] }]), JSON.stringify(lotes))
  const muchas = Array.from({ length: 50 }, (_, i) => ({ tcggo_id: i + 1, card_id: `x${i}`, market: 'WEST' }))
  check('  …de 20 en 20', idiomas.lotesPorPedir(muchas).map((l) => l.ids.length).join() === '20,20,10')

  const estados = {}
  const escritas = []
  const urls = []
  const base = {
    restImpl: async (ruta) => {
      if (/^scrydex_estado/.test(ruta)) return estados.v ? [{ valor: estados.v }] : []
      if (/^user_collection/.test(ruta)) return /offset=0/.test(ruta) ? copias : []
      if (/^tcg_card_versions/.test(ruta)) return filas
      throw new Error(`ruta ${ruta}`)
    },
    estadoImpl: async () => estados.v || {},
    guardarEstadoImpl: async (v) => { estados.v = JSON.parse(JSON.stringify(v)) },
    guardarImpl: async (f) => { escritas.push(...f) },
    fetchImpl: async (url) => {
      urls.push(url)
      const ids = new URL(url).searchParams.get('ids').split(',').map(Number)
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: ids.map((id) => ({ id, prices: { cardmarket: { lowest_near_mint: 1, lowest_near_mint_ES: 2 } } })) }) }
    },
  }
  const r = await idiomas.procesar({ env: ENV, ...base, ahora: AHORA, pausa: sinPausa })
  check('una pasada: dos lotes (occidental y japonés), tres versiones con su precio en español', r.ok && urls.length === 2 && escritas.length === 3 && escritas.every((f) => f.cm_low_es === 2 && !('etiqueta' in f)) && urls.some((u) => /pokemon-jp\/cards\?ids=5/.test(u)), JSON.stringify([r, urls]))
  const r2 = await idiomas.procesar({ env: ENV, ...base, ahora: AHORA, pausa: sinPausa })
  check('  …la siguiente del día no pide nada', r2.ok && (r2.hecho || /ya están/.test(r2.saltado || '')) && urls.length === 2, JSON.stringify(r2))
  const e3 = {}
  const r3 = await idiomas.procesar({ env: ENV, ...base, estadoImpl: async () => e3.v || {}, guardarEstadoImpl: async (v) => { e3.v = v }, fetchImpl: async () => ({ ok: false, status: 429, text: async () => 'quota exceeded' }), ahora: AHORA, pausa: sinPausa })
  check('un 429 para hasta mañana', /no da más|TCGGO 429/.test(r3.saltado || '') && e3.v?.planBloqueado?.dia === '2026-10-21', JSON.stringify(r3))
  const e4 = {}
  let pidio = false
  const r4 = await idiomas.procesar({ env: ENV, ...base, restImpl: async () => { throw new Error('Supabase 500') }, estadoImpl: async () => e4.v || {}, guardarEstadoImpl: async (v) => { e4.v = v }, fetchImpl: async () => { pidio = true }, ahora: AHORA, pausa: sinPausa })
  check('si falla NUESTRA base, no pide nada a TCGGO', !r4.ok && !pidio, JSON.stringify(r4))
}

console.log('── 5. La sonda ──')
{
  const rep = sonda.repetidasPorNumero([{ id: 'a', local_id: '060' }, { id: 'b', local_id: '60' }, { id: 'c', local_id: '61' }, { id: 'd', local_id: '60' }])
  check('las repetidas por número (sin ceros delante)', rep.length === 1 && rep[0].numero === '60' && rep[0].cartas.map((c) => c.id).join() === 'a,b,d', JSON.stringify(rep))
  const r = await sonda.sondear({ modo: 'duplicados', valor: 'por' }, { env: ENV, pedir: async (ruta) => {
    if (/^tcg_sets\?.*id=eq\.por/.test(ruta)) return [{ id: 'por', name: 'X', tcggo_id: 9 }]
    if (/^tcg_sets\?.*tcggo_id=eq\.9/.test(ruta)) return [{ id: 'por' }, { id: 'tcggo-9' }]
    if (/^tcg_cards/.test(ruta)) return /tcggo-9/.test(decodeURIComponent(ruta)) ? [{ id: 'por-60', local_id: '60', set_id: 'por' }, { id: 'tcggo-1', local_id: '60', set_id: 'tcggo-9' }] : []
    return []
  } })
  check('  …con los sets que comparten su expansión de TCGGO', r.repetidas?.length === 1 && r.sets.length === 2, JSON.stringify(r))
}

console.log('── 6. La estantería pide el símbolo con respaldo ──')
{
  const pedidas = []
  const fetchImpl = async (url) => {
    pedidas.push(url)
    if (/symbol_tcggo/.test(url)) return { ok: false, status: 400, text: async () => '{"code":"42703","message":"column tcg_sets.symbol_tcggo does not exist"}', json: async () => ({}) }
    return { ok: true, status: 200, text: async () => '[]', json: async () => [{ id: 'sv1' }] }
  }
  const filas = await sets.leerSets('WEST', { fetchImpl })
  check('sin la columna, repite la consulta sin ella y no se rompe', filas.length === 1 && pedidas.length === 2 && /symbol_tcggo/.test(pedidas[0]) && !/symbol_tcggo/.test(pedidas[1]), pedidas.join(' | '))
  check('  …y la web pide lo mismo que la función (el mismo nombre de columna)', /COLUMNA_SIMBOLO = 'symbol_tcggo'/.test(readFileSync(join(RAIZ, 'js/sets-catalogo.js'), 'utf8')) && sets.COLUMNA_SIMBOLO === 'symbol_tcggo')
}

console.log('── 7. En la web ──')
const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 3, card_count_total: 3, logo_tcggo: 'https://images.tcggo.com/logo.png', tcg_online_code: 'SSP', symbol_tcggo: 'https://images.tcggo.com/simbolo.png' }]
    window.__FAKE_CARTAS__ = [1, 2, 3].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `sv/sv8/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true, reverse: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }))
    window.__FAKE_PRECIOS__ = [1, 2, 3].map((n) => ({ card_id: `sv8-${n}`, cm_low: 1, cm_low_es: 1, checked_at: new Date().toISOString() }))
    // La Reverse de la 1, con su precio de TCGGO (la de la lista: solo el general).
    window.__FAKE_VERSIONES__ = [{ tcggo_id: 900, market: 'WEST', card_id: 'sv8-1', set_id: 'sv8', etiqueta: 'Reverse Holo', cm_low: 40 }, { tcggo_id: 901, market: 'WEST', card_id: 'sv8-2', set_id: 'sv8', etiqueta: 'Reverse Holo', cm_low: 5 }]
    window.__FAKE_COLECCION__ = [{ id: 'r1', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 1 }]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => ({
    linea: document.getElementById('mcAlbumLinea')?.textContent || document.querySelector('#mcAlbumProgreso .mc-avance-linea')?.textContent,
    simbolo: document.querySelector('#mcAlbumMeta img.mc-simbolo')?.getAttribute('src'),
    cifras: document.getElementById('mcAlbumCifras')?.textContent.replace(/\s+/g, ' '),
  }))
  check('tu copia Reverse vale lo de SU versión (40 €), no lo de la normal (1 €)', /40,00\s€/.test(r.linea || ''), r.linea)
  check('el símbolo del set sale en la cabecera de la expansión', /simbolo\.png/.test(r.simbolo || ''), JSON.stringify(r.simbolo))
  check('«Completar el maestro»: las normales (3 × 1 €) y las reverse que faltan (5 € la 2; la 3 con el de su normal, 1 €)', /Completar el maestro: unos 9\s€(?! ·)/.test(r.cifras || ''), r.cifras)
  await page.click('#mcAlbumVista')
  await page.click('#mcAlbumVistaMenu [data-vista="lista"]')
  await page.waitForTimeout(300)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(400)
  const lista = await page.evaluate(() => [...document.querySelectorAll('#mcAlbum .mc-album-fila')].map((f) => `${f.dataset.carta}:${f.querySelector('small')?.textContent || ''}:${f.querySelector('.mc-album-fila-precio')?.textContent.trim()}`).join(' | '))
  check('en la Lista separada, cada versión con su precio', /sv8-1:Reverse holo:40,00\s€/.test(lista) && /sv8-1:Normal:1,00\s€/.test(lista), lista)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()

  // Sin la migración: la estantería se pinta igual.
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx2.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__COLUMNAS_QUE_FALTAN__ = ['symbol_tcggo']
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 3, card_count_total: 3 }]
    window.__FAKE_CARTAS__ = [{ id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Carta 1', tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }]
    window.__FAKE_COLECCION__ = []
  })
  await ctx2.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p2 = await ctx2.newPage()
  const err2 = []
  p2.on('pageerror', (e) => err2.push(String(e).slice(0, 180)))
  await p2.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(3000)
  check('sin la columna del símbolo (sin migración), la estantería sale igual', (await p2.locator('[data-set="sv8"]').count()) > 0 && err2.length === 0, err2.join(' | '))
  await ctx2.close()
}
await browser.close()

console.log(fails ? `\n✗ ${fails} fallos` : '\n✓ Todo bien')
process.exit(fails ? 1 : 0)
