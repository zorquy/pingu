// Tanda 863 — la página de un tema, renovada y dentro de /aprender.
//
// PINGU: «si el botón de para atrás te lleva a la categoría, deberíamos
// tener la categoría renovada, no con la vista antigua». /categoria.html se
// va (redirige en Netlify) y el tema es /aprender?tema=<slug>: migas (en el
// móvil «‹ Aprender»), cabecera compacta con icono, nombre, descripción,
// cuenta y aro de lo leído, Guías · Cursos, chips de nivel y «Sin leer», la
// tarjeta de guía de siempre, y la barra pegada al bajar. Y el «‹ Cartas»
// colado en las migas de la vieja se va con ella.
import { readFileSync, existsSync } from 'node:fs'
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
  check('categoria.html, su JS y su CSS ya no existen', !existsSync(`${RAIZ}/categoria.html`) && !existsSync(`${RAIZ}/js/categoria.js`) && !existsSync(`${RAIZ}/css/categoria.css`))
  const toml = readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
  check('Netlify redirige /categoria.html?slug=x a /aprender?tema=x (301) y sin slug a /aprender', /from = "\/categoria\.html"\s+query = \{slug = ":slug"\}\s+to = "\/aprender\?tema=:slug"\s+status = 301/.test(toml) && /from = "\/categoria\.html"\s+to = "\/aprender"\s+status = 301/.test(toml))
  const nadie = ['js', 'netlify/functions', 'netlify/edge-functions'].flatMap((d) => [])
  for (const f of ['js/guia.js', 'js/curso.js', 'netlify/edge-functions/meta-social.js', 'netlify/functions/sitemap.mjs']) {
    const t = readFileSync(`${RAIZ}/${f}`, 'utf8')
    check(`${f} ya no enlaza a categoria.html`, !/categoria\.html\?slug=/.test(t))
  }
  check('la cabecera vieja de categoría ya no la baja todo el mundo (components.css)', !/\.category-header/.test(readFileSync(`${RAIZ}/css/components.css`, 'utf8')))
}

const browser = await chromium.launch()
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_CATEGORIAS__ = [
    { id: 'cat-mazos', name: 'Mazos & estrategia', slug: 'mazos', description: 'Mazos, builds, por qué funcionan y cómo jugarlos', emoji: '🃏', order_pos: 1 },
    { id: 'cat-reglas', name: 'Reglas', slug: 'reglas', description: 'Las reglas del juego', order_pos: 2 },
  ]
  const g = (i, titulo, cat, extra = {}) => ({ id: `g-${i}`, slug: `guia-${i}`, title: titulo, description: `Descripción ${i}`, published_at: `2026-10-0${i}T10:00:00Z`, category_id: cat, level: i % 2 ? 'basico' : 'medio', estimated_mins: 4, blocks: [{ type: 'paragraph', text: 'x' }], ...extra })
  window.__FAKE_GUIAS__ = [
    g(1, 'Arquetipo Beedrill ex', 'cat-mazos', { blocks: [{ type: 'paragraph', text: 'x' }, { type: 'quiz', question: '¿?', options: ['a', 'b'], answer: 0 }], collection_order: 1 }),
    g(2, '3 claves mentales para competir mejor', 'cat-mazos', { collection_order: 2 }),
    g(3, 'Cómo jugar Charizard ex', 'cat-mazos'),
    g(4, 'Qué es el mulligan', 'cat-reglas'),
  ]
  window.__FAKE_PROGRESO__ = sesion === 'none' ? [] : [
    { user_id: 'user-1', guide_id: 'g-1', status: 'completed', read_at: '2026-10-10T10:00:00Z', current_block: 2 },
    { user_id: 'user-1', guide_id: 'g-2', status: 'in_progress', read_at: '2026-10-10T10:00:00Z', current_block: 1 },
  ]
}
async function abrir(ruta, { movil = false, sesion = 'user-1' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { sesion })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
// Desde la 1338 el tema ya no tiene página propia: es un FILTRO de Aprender
// (las baldosas se quedan, la elegida con su color) y una línea con su nombre,
// su descripción, «N de M leídas» y «Quitar».
const linea = (page) => page.evaluate(() => {
  const c = document.getElementById('apTemaLinea')
  return c && !c.hidden && {
    nombre: c.querySelector('.ap-tema-linea-nombre')?.textContent, desc: c.querySelector('.ap-tema-linea-desc')?.textContent,
    leidas: c.querySelector('.ap-tema-linea-leidas')?.textContent ?? null, quitar: Boolean(c.querySelector('[data-ap-quitar]')),
    on: document.querySelector('#apTemas .ap-baldosa.on')?.dataset.tema, baldosas: document.querySelectorAll('#apTemas .ap-baldosa').length,
    titulo: document.title,
  }
})
const lista = (page) => page.evaluate(() => ({
  titulos: [...document.querySelectorAll('#apLista .guia-portada-sobre strong, #apLista .gf-titulo, #apLista .guia-titulo')].map((x) => x.textContent.trim()).filter(Boolean),
  n: document.querySelectorAll('#apLista .guia-portada, #apLista .guia-tarjeta, #apLista .guia-fila').length,
}))

console.log('── 1. El tema en el PC ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html?tema=mazos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await linea(page)
  check('el tema puesto como filtro: su baldosa marcada, las dos siguen, y la línea con nombre, descripción, «2 de 3 leídas» y Quitar', c && c.on === 'mazos' && c.baldosas === 2 && c.nombre === 'Mazos & estrategia' && /por qué funcionan/.test(c.desc || '') && c.leidas === '2 de 3 leídas' && c.quitar, JSON.stringify(c))
  check('  …y el título de la pestaña es el tema', /Mazos & estrategia · Aprender/.test(c?.titulo || ''))
  let l = await lista(page)
  check('las tres guías del tema', l.n === 3, JSON.stringify(l))
  check('sin chips de nivel ni «Sin leer» (1039)', (await page.locator('[data-nivel], [data-sinleer]').count()) === 0)
  await page.fill('#apBuscar', 'mental')
  await page.waitForTimeout(400)
  l = await lista(page)
  check('buscar dentro del tema', l.n === 1, JSON.stringify(l))
  await ctx.close()
}

console.log('── 2. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html?tema=mazos', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await linea(page)
  check('el filtro puesto y su línea', c?.on === 'mazos' && c.nombre === 'Mazos & estrategia' && c.quitar, JSON.stringify(c))
  const l = await lista(page)
  check('las guías en filas', l.n === 3 && (await page.locator('#apLista .guia-fila').count()) === 3, JSON.stringify(l))
  await ctx.close()
}

console.log('── 3. Sin cuenta, y un tema que no existe ──')
{
  const { page, ctx } = await abrir('/aprender.html?tema=mazos', { sesion: 'none' })
  const c = await linea(page)
  check('sin cuenta: la línea sin «leídas»', c?.nombre === 'Mazos & estrategia' && c.leidas === null, JSON.stringify(c))
  await ctx.close()
  const otro = await abrir('/aprender.html?tema=no-existe')
  const l = await lista(otro.page)
  check('un tema que no existe: la lista de siempre, con todas y sin filtro', l.n === 4 && !(await linea(otro.page)), JSON.stringify(l))
  await otro.ctx.close()
}

console.log('── 4. La guía vuelve al tema nuevo ──')
{
  const { page, ctx } = await abrir('/guia.html?slug=guia-2', { movil: true })
  const href = await page.evaluate(() => [...document.querySelectorAll('.breadcrumb a')].pop()?.getAttribute('href'))
  check('el «‹ Mazos & estrategia» de la guía lleva a /aprender?tema=mazos', href === '/aprender?tema=mazos', String(href))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
