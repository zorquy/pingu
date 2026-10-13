// Tanda 819 (FO4) — las cartas dentro del foro: [[Nombre]] se pinta al leer
// como minicarta con foto y precio, de la impresión más nueva; lo que no se
// encuentra se queda en un enlace a buscarlo; lo guardado no cambia.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
console.log('── Lo puro ──')
{
  const { nombresEnCorchetes, laMasNueva } = await import(`${RAIZ}/js/foro-cartas.js`)
  check('saca los nombres, sin repetir', nombresEnCorchetes('[[Arven]] y [[Iono]] y otra vez [[Arven]]').join() === 'Arven,Iono')
  check('  …y no más de seis por mensaje', nombresEnCorchetes(Array.from({ length: 9 }, (_, i) => `[[Carta ${i}]]`).join(' ')).length === 6)
  check('  …ni corchetes vacíos o de una letra', nombresEnCorchetes('[[]] [[a]] [[ ]]').length === 0)
  check('la más nueva de las impresiones', laMasNueva([{ id: 'a', tcg_sets: { release_date: '2023-03-31' } }, { id: 'b', tcg_sets: { release_date: '2025-01-17' } }]).id === 'b')
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const SEM = {
  __FAKE_FOROS__: [{ id: 'f', section_id: 's', slug: 'reglas', name: 'Reglas', position: 1, post_policy: 'todos' }],
  __FAKE_SECCIONES__: [{ id: 's', name: 'Juego', position: 1 }],
  __FAKE_TEMAS__: [{ id: 't1', board_id: 'f', title: 'Arven', author_id: 'user-2', post_count: 2, last_post_at: hace(5), created_at: hace(60) }],
  __FAKE_MENSAJES__: [
    { id: 'm1', thread_id: 't1', author_id: 'user-2', body_html: '<p>¿Puedo buscar con [[Arven]] una [[Herramienta Inventada]]?</p>', created_at: hace(60) },
    { id: 'm2', thread_id: 't1', author_id: 'user-1', body_html: '<p>Sí, y mira <a href="https://example.com/x">[[Arven]]</a>: un enlace que puso el autor no se toca.</p>', created_at: hace(5) },
  ],
  __FAKE_CARTAS__: [
    { id: 'sv1-166', set_id: 'sv1', market: 'WEST', local_id: '166', name: 'Arven', name_es: 'Arven', image_path: 'sv/sv01/166' },
    { id: 'sv4-235', set_id: 'sv4', market: 'WEST', local_id: '235', name: 'Arven', name_es: 'Arven', image_path: 'sv/sv04/235' },
  ],
  __FAKE_SETS__: [
    { id: 'sv1', market: 'WEST', name: 'Scarlet & Violet', release_date: '2023-03-31' },
    { id: 'sv4', market: 'WEST', name: 'Paradox Rift', release_date: '2023-11-03' },
  ],
  __FAKE_PRECIOS__: [{ card_id: 'sv4-235', cm_low: 0.4, cm_trend: 0.5, cm_low_es: 0.4 }],
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
await page.addInitScript((sem) => { window.__FAKE_SESSION__ = 'user-1'; Object.assign(window, sem) }, SEM)
await page.route(/assets\.tcgdex\.net|images\.pokemontcg\.io|limitlesstcg|tcggo/, (r) => r.fulfill({ status: 404, body: '' }))
await page.goto(`${BASE}/tema/t1`, { waitUntil: 'domcontentloaded' })
// El tema se repinta al abrir (y con el sondeo): se lee todo de UNA vez, en
// el mismo pintado, cuando las dos ya están marcadas.
const cartas = await (await page.waitForFunction(() => {
  const as = [...document.querySelectorAll('[data-mensaje="m1"] .foro-carta')]
  if (!as.some((a) => a.classList.contains('foro-carta-lista')) || !as.some((a) => a.dataset.cartaNombre === 'Herramienta Inventada')) return null
  return as.map((a) => ({ n: a.dataset.cartaNombre, lista: a.classList.contains('foro-carta-lista'), href: a.getAttribute('href'), texto: a.textContent.replace(/\s+/g, ' ').trim() }))
}, null, { timeout: 20000, polling: 100 }).catch(() => ({ jsonValue: async () => [] }))).jsonValue()
if (!cartas.length) console.log('DEPURA', await page.$eval('[data-mensaje="m1"] .foro-mensaje-texto', (e) => e.innerHTML).catch((e) => String(e)), errores)
console.log('\n── En el tema ──')
check('sin errores', errores.length === 0, errores.join(' | '))
const arven = cartas.find((c) => c.n === 'Arven')
check('[[Arven]] es una minicarta que lleva a la ficha de la impresión MÁS NUEVA', arven?.lista && /sv4-235/.test(arven.href), JSON.stringify(arven))
check('  …con su precio', /0,40\s*€/.test(arven?.texto || ''), arven?.texto)
const otra = cartas.find((c) => c.n === 'Herramienta Inventada')
check('la que no existe se queda en un enlace a buscarla', otra && !otra.lista && /^\/buscar\?en=cartas&q=Herramienta/.test(otra.href), JSON.stringify(otra))
check('dentro de un enlace del autor no se toca', (await page.$$eval('[data-mensaje="m2"] .foro-carta', (as) => as.length)) === 0 && /\[\[Arven\]\]/.test(await page.$eval('[data-mensaje="m2"] .foro-mensaje-texto a', (c) => c.textContent)))
const ayuda = await page.$eval('#temaResponder .foro-ayuda-cartas', (e) => e.textContent).catch(() => '')
check('la caja de responder lo cuenta (al abrirla)', /\[\[Arven\]\]/.test(ayuda), ayuda)
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
