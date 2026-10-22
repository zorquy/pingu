// Tanda 866 — el mapa de enlaces de Aprender: todo lo que lleva a una
// guía o a un tema acaba en la puerta o en el tema.
//   · La chapa del tema de la tarjeta es un ENLACE a /aprender?tema=… (fuera
//     del <a> de la tarjeta), en /aprender y en el bloque «Aprende» de la
//     portada; la fila lleva el tema de texto delante del nivel.
//   · Al acabar una guía, «Más de este tema»: hasta tres del mismo tema
//     (nunca ella misma) y «Todo el tema →».
//   · El curso, al terminar, vuelve al tema.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo estático ──')
{
  const curso = readFileSync(`${RAIZ}/js/curso.js`, 'utf8')
  check('el curso, al acabar, vuelve al tema («Más de este tema →») y sin tema a /aprender', /categorySlug \? `\/aprender\?tema=\$\{encodeURIComponent\(categorySlug\)\}` : '\/aprender'/.test(curso) && /Más de este tema →/.test(curso))
  const tarjeta = readFileSync(`${RAIZ}/js/guia-tarjeta.js`, 'utf8')
  check('la chapa-enlace va FUERA del <a> de la tarjeta (un enlace dentro de otro no existe)', tarjeta.indexOf('guia-chapa-tema') > tarjeta.indexOf('</a>'))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_CATEGORIAS__ = [
    { id: 'cat-mazos', name: 'Mazos & estrategia', slug: 'mazos', description: 'Mazos', order_pos: 1, guide_count: 4 },
    { id: 'cat-reglas', name: 'Reglas', slug: 'reglas', description: 'Reglas', order_pos: 2, guide_count: 1 },
  ]
  const g = (i, titulo, cat) => ({ id: `g-${i}`, slug: `guia-${i}`, title: titulo, description: `Descripción ${i}`, published_at: `2026-10-${String(i).padStart(2, '0')}T10:00:00Z`, category_id: cat, level: 'beginner', estimated_mins: 4, blocks: [{ type: 'paragraph', text: 'Un párrafo.' }], reference_blocks: [{ type: 'paragraph', text: 'Un párrafo de la guía.' }] })
  window.__FAKE_GUIAS__ = [g(1, 'Arquetipo Beedrill ex', 'cat-mazos'), g(2, '3 claves mentales', 'cat-mazos'), g(3, 'Cómo jugar Charizard ex', 'cat-mazos'), g(4, 'Dragapult en octubre', 'cat-mazos'), g(5, 'Qué es el mulligan', 'cat-reglas')]
  window.__FAKE_PROGRESO__ = []
}
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const chapas = (page, raiz) => page.evaluate((raiz) => [...document.querySelectorAll(`${raiz} .guia-tarjeta`)].map((t) => {
  const a = t.querySelector('a.guia-chapa-tema')
  const r = a?.getBoundingClientRect()
  const arte = t.querySelector('.guia-arte')?.getBoundingClientRect()
  return { texto: a?.textContent.trim(), href: a?.getAttribute('href'), dentroDelEnlace: Boolean(a?.closest('.guia-tarjeta-enlace')), sobreElArte: a && arte ? r.top >= arte.top && r.bottom <= arte.bottom && r.left >= arte.left : null, alto: r ? Math.round(r.height) : 0, textoViejo: t.querySelector('.guia-arte-info span.guia-chapa-cat')?.textContent.trim() || null }
}), raiz)

console.log('── 1. /aprender: la chapa del tema es un enlace ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await chapas(page, '#apLista')
  check('cada tarjeta lleva la chapa de su tema como enlace a /aprender?tema=…, fuera del enlace de la tarjeta y encima del arte', c.length === 5 && c.every((x) => x.href && /^\/aprender\?tema=(mazos|reglas)$/.test(x.href) && !x.dentroDelEnlace && x.sobreElArte && x.alto >= 24 && !x.textoViejo) && c[0].texto === 'Reglas', JSON.stringify(c.slice(0, 2)))
  await page.click('#apLista .guia-tarjeta:first-child a.guia-chapa-tema')
  await page.waitForTimeout(1800)
  check('  …y tocarla abre el tema, no la guía', (await page.evaluate(() => [location.search, document.querySelector('#apTemaCab h1')?.textContent])).join('|') === '?tema=reglas|Reglas')
  await ctx.close()
  // En el móvil, las filas llevan el tema de texto delante del nivel.
  const m = await abrir('/aprender.html', { movil: true })
  const filas = await m.page.evaluate(() => [...document.querySelectorAll('#apLista .guia-fila small')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()))
  check('en el móvil, cada fila dice su tema delante del nivel', filas.length === 4 && filas.every((f) => /^(Mazos & estrategia|Reglas) · Principiante · 4 min/.test(f)), JSON.stringify(filas))
  await m.ctx.close()
}

console.log('── 2. La portada: el bloque «Aprende» ──')
{
  const { page, ctx, errores } = await abrir('/index.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await chapas(page, '#aprende')
  check('la tarjeta grande lleva la chapa del tema como enlace', c.length >= 1 && /^\/aprender\?tema=/.test(c[0].href || '') && !c[0].dentroDelEnlace, JSON.stringify(c))
  await ctx.close()
}

console.log('── 3. La guía: «Más de este tema» ──')
{
  const { page, ctx, errores } = await abrir('/guia.html?slug=guia-2')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const c = document.getElementById('guiaMasDelTema')
    // 974: la caja de valoración se fue; «Más de este tema» va tras «Me ha servido».
    const servido = document.getElementById('guideHelpful')
    return c && { visible: getComputedStyle(c).display !== 'none', titulo: c.querySelector('.guia-mas-tema-titulo')?.textContent, filas: [...c.querySelectorAll('.guia-fila')].map((f) => f.getAttribute('href')), todo: c.querySelector('.guia-mas-tema-todo')?.getAttribute('href'), despuesDeServir: servido ? c.compareDocumentPosition(servido) & Node.DOCUMENT_POSITION_PRECEDING : null }
  })
  check('«Más de Mazos & estrategia»: tres del tema, nunca ella misma, y «Todo el tema →», después de «Me ha servido»', r?.visible && r.titulo === 'Más de Mazos & estrategia' && r.filas.length === 3 && !r.filas.some((h) => /guia-2$/.test(h)) && r.filas.every((h) => /^\/guia\/guia-/.test(h)) && r.todo === '/aprender?tema=mazos' && r.despuesDeServir, JSON.stringify(r))
  await ctx.close()
  const sola = await abrir('/guia.html?slug=guia-5')
  check('una guía sola en su tema no enseña el bloque', await sola.page.evaluate(() => document.getElementById('guiaMasDelTema')?.classList.contains('hidden')))
  await sola.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
