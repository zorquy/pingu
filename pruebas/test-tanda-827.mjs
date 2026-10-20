// Tanda 827 — los precios del japonés: la expansión en curso se sigue página
// a página, y las cartas de un set escondido no salen en el catálogo.
//
// PINGU, con el Charizard de Expansion Pack: «en PokeDoc no sale el precio e
// incluso el enlace a Cardmarket va mal». Dos fallos: la pasada de precios
// llevaba horas en «JP 81» (una expansión grande no cabía en una pasada y se
// volvía a empezar por la página 1), y la ficha era la del Charizard VIEJO
// (`base1_ja-021`, de un set escondido), que el Pokédex seguía enseñando.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const { deSetVisible } = await import(`${RAIZ}/js/catalogo-series.js`)

console.log('── 1. Una expansión de tres páginas, una página por pasada ──')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const AHORA = new Date('2026-10-14T08:00:00Z')
// Página n: 100 cartas con producto 1000·n + i; la 3 trae además una VERSIÓN
// (sin foto) del producto 1001, que ya salió en la página 1 con foto.
const carta = (id, cm, precio, foto = true) => ({ id, card_number: String(id), cardmarket_id: cm, image: foto ? 'https://x/f.png' : null, prices: { cardmarket: { lowest_near_mint: precio } } })
const PAGINAS = {
  1: Array.from({ length: 100 }, (_, i) => carta(10000 + i, 1000 + i, 10)),
  2: Array.from({ length: 100 }, (_, i) => carta(20000 + i, 2000 + i, 20)),
  3: [carta(30000, 3000, 30), carta(30001, 1001, 999, false)],
}
const estados = {
  [CLAVE_PARES]: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'SV', cartas: 1, logo: 'https://x/l.png', valorCm: 1 }] } },
  tcggo_catalogo: { setsPorEpisodio: { JP: {} }, episodiosJp: { lista: [{ id: 723, nombre: 'Expansion Pack', cartas: 201, logo: 'https://x/e.png', valorCm: 1 }] } },
  [CLAVE_ESTADO]: {},
}
const urls = []
const escritas = []
const fetchImpl = async (url) => {
  urls.push(url)
  const u = new URL(url)
  const ep = Number(u.searchParams.get('episode_id'))
  const pg = Number(u.searchParams.get('page') || 1)
  if (/pokemon-jp/.test(u.pathname) && ep === 723) return { ok: true, status: 200, text: async () => JSON.stringify({ data: PAGINAS[pg] || [], paging: { current: pg, total: 3, per_page: 100 } }) }
  if (ep === 10) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [carta(1, 500, 2)], paging: { current: 1, total: 1, per_page: 100 } }) }
  return { ok: false, status: 404, text: async () => 'no' }
}
// Nuestras: una carta por producto del set tg-723 (y la consulta tiene que
// pedirlas POR PRODUCTO: se comprueba).
const porProducto = []
const restImpl = async (ruta) => {
  const r = decodeURIComponent(ruta)
  if (/^tcg_sets\?select=id,tcggo_id(?:,oculto)?&market=eq\.JP/.test(r)) return [{ id: 'tg-723', tcggo_id: 723 }]
  // Las que faltan, por `tcggo_id` en todo el japonés (831): aquí ninguna.
  if (/market=eq\.JP&tcggo_id=in\./.test(r) || /tcggo_id=is\.null/.test(r)) return []
  if (/market=eq\.JP/.test(r)) {
    // Desde la 830 el japonés pregunta por producto O por `tcggo_id`.
    const m = r.match(/cm_id_product_propio(?:=in|\.in)\.\(([^)]*)\)/)
    porProducto.push(Boolean(m))
    const ids = m ? m[1].split(',').map(Number).filter((x) => x > 0) : []
    return ids.map((cm) => ({ id: `tcggo-c${cm}`, cm_id_product_propio: cm }))
  }
  return [{ id: 'sv1-1', cm_id_product_propio: 500 }]
}
const base = {
  env: ENV, fetchImpl, restImpl, pausa: async () => {}, ahora: AHORA,
  guardarImpl: async (filas) => { escritas.push(...filas) }, guardarSetsImpl: async (f) => f.length, fotoImpl: async () => 0,
  estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
}
// Una petición por pasada: la occidental se lleva la primera.
const r1 = await procesar({ ...base, peticiones: 1 })
const r2 = await procesar({ ...base, peticiones: 1 })
const e2 = estados[CLAVE_ESTADO]
check('la página 1 escribe sus precios al llegar y la expansión queda en curso por la 2', e2.enCurso?.episodio === 723 && e2.enCurso.pagina === 2 && escritas.filter((f) => /^tcggo-c1/.test(f.card_id)).length === 100 && !e2.hechosJp.includes(723), JSON.stringify({ enCurso: e2.enCurso && { ...e2.enCurso, elegidas: Object.keys(e2.enCurso.elegidas).length }, r1: r1.hechasAhora, r2: r2.hechasAhora }))
const antes = urls.length
const r3 = await procesar({ ...base, peticiones: 1 })
check('la pasada siguiente SIGUE por la página 2, no vuelve a la 1', urls.slice(antes).some((u) => /page=2/.test(u)) && !urls.slice(antes).some((u) => /episode_id=723(&|$)(?!.*page=2)/.test(u) && !/page=/.test(u)), JSON.stringify(urls.slice(antes)))
const r4 = await procesar({ ...base, peticiones: 1 })
const e4 = estados[CLAVE_ESTADO]
check('con la página 3 la expansión queda hecha, sin nada en curso', e4.hechosJp.includes(723) && !e4.enCurso && r4.hecho === true, JSON.stringify({ hechosJp: e4.hechosJp, enCurso: e4.enCurso, r4: JSON.stringify(r4).slice(0, 200) }))
check('  …y cada página se pidió UNA vez', [1, 2, 3].every((p) => urls.filter((u) => /episode_id=723/.test(u) && (p === 1 ? !/page=[23]/.test(u) : new RegExp(`page=${p}`).test(u))).length === 1), JSON.stringify(urls.filter((u) => /723/.test(u))))
const c1001 = escritas.filter((f) => f.card_id === 'tcggo-c1001')
check('la VERSIÓN de la página 3 (sin foto) no pisa el precio de la principal de la página 1', c1001.length === 1 && c1001[0].cm_low_ja === 10, JSON.stringify(c1001.map((f) => f.cm_low_ja)))
check('nuestras cartas se piden por producto (no el set entero: el tope de mil filas)', porProducto.length > 0 && porProducto.every(Boolean))
check('el resumen japonés cuenta la expansión entera: 201 suyas (la versión cuenta como carta), 201 productos, 201 escritas', e4.resumenJp?.[723]?.suyas === 202 && e4.resumenJp[723].conCm === 201 && e4.resumenJp[723].escritas === 201, JSON.stringify(e4.resumenJp?.[723]))
const otroDia = await procesar({ ...base, peticiones: 1, ahora: new Date('2026-10-15T08:00:00Z') })
check('al cambiar de día no queda nada en curso del anterior', !estados[CLAVE_ESTADO].enCurso || estados[CLAVE_ESTADO].enCurso.pagina === 1 || estados[CLAVE_ESTADO].dia === '2026-10-15', JSON.stringify(otroDia).slice(0, 120))

console.log('\n── 2. Las cartas de un set escondido, fuera del catálogo ──')
check('deSetVisible: fuera la de un set escondido; dentro la visible y la que no dice nada', !deSetVisible({ tcg_sets: { oculto: true } }) && deSetVisible({ tcg_sets: { oculto: false } }) && deSetVisible({ tcg_sets: {} }) && deSetVisible({}))
for (const [f, patron] of [
  ['js/mi-coleccion/datos.js', /return \(data \|\| \[\]\)\.filter\(deSetVisible\)/],
  ['js/catalogo-buscar.js', /\.filter\(deSetVisible\)/],
]) {
  const src = readFileSync(`${RAIZ}/${f}`, 'utf8')
  check(`${f}: filtra y pide \`oculto\` en el embebido`, patron.test(src) && /tcg_sets\([^)]*oculto\)/.test(src))
}
// Desde la 909 Cartas y el buscador de arriba buscan con js/buscar-cartas.js:
// el filtro vive ahí y cada pantalla pide `oculto` en sus columnas.
check('js/buscar-cartas.js: filtra con deSetVisible', /&& deSetVisible\(c\)/.test(readFileSync(`${RAIZ}/js/buscar-cartas.js`, 'utf8')))
for (const [f, patron] of [
  ['js/mi-coleccion.js', /const COLUMNAS_BUSCAR = '[^']*tcg_sets\([^)]*oculto\)/],
  ['js/buscador.js', /const COLUMNAS_CARTA = '[^']*tcg_sets\([^)]*oculto\)/],
]) {
  const src = readFileSync(`${RAIZ}/${f}`, 'utf8')
  check(`${f}: filtra y pide \`oculto\` en el embebido`, patron.test(src) && /tcg_sets\([^)]*oculto\)/.test(src))
}

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    { id: 'tg-723', name: 'Expansion Pack', market: 'JP', serie_id: 'original', release_date: '1996-10-20', card_count_official: 102, tcggo_id: 723 },
    { id: 'base1_ja', name: 'Expansion Pack (viejo)', market: 'JP', serie_id: 'base', release_date: '1996-10-20', card_count_official: 102, oculto: true },
    { id: 'base2_ja', name: 'Jungle (viejo)', market: 'JP', serie_id: 'base', release_date: '1997-03-05', card_count_official: 48, oculto: true },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'tcggo-73805', set_id: 'tg-723', market: 'JP', local_id: '021', name: 'Charizard', dex_ids: [6] },
    { id: 'base1_ja-021', set_id: 'base1_ja', market: 'JP', local_id: '021', name: 'Charizard', dex_ids: [6] },
    { id: 'base2_ja-006', set_id: 'base2_ja', market: 'JP', local_id: '006', name: 'Charizard', dex_ids: [6] },
  ]
  // La del Jungle viejo es TUYA: esa sí sale.
  window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'base2_ja-006', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal' }]
})
const page = await ctx.newPage()
await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex&dex=6&catalogo=JP`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.querySelectorAll('#mcPokedexPanel [data-carta]').length > 0, null, { timeout: 15000 }).catch(() => {})
const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll('#mcPokedexPanel [data-carta]')].map((e) => e.dataset.carta))])
check('el Pokédex de Charizard enseña el de TCGGO y NO el viejo del set escondido', ids.includes('tcggo-73805') && !ids.includes('base1_ja-021'), JSON.stringify(ids))
check('  …pero la tuya del set escondido sí sale (lo tuyo sale siempre)', ids.includes('base2_ja-006'), JSON.stringify(ids))
await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
