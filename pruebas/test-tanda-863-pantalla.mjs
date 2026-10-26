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
const cabecera = (page) => page.evaluate(() => {
  const c = document.getElementById('apTemaCab')
  const migas = document.querySelector('.breadcrumb')
  const ultimo = [...(migas?.querySelectorAll('a') || [])].pop()
  const r = ultimo?.getBoundingClientRect()
  return c && {
    h1: c.querySelector('h1')?.textContent, desc: c.querySelector('p')?.textContent, cuenta: c.querySelector('.ap-tema-cuenta')?.textContent,
    aro: c.querySelector('.ap-tema-aro b')?.textContent, vuelta: c.querySelector('.ap-tema-aro')?.style.getPropertyValue('--vuelta'),
    icono: Boolean(c.querySelector('.ap-tema-icono')),
    migas: migas?.textContent.replace(/\s+/g, ' ').trim(), volver: ultimo?.textContent.trim(), volverHref: ultimo?.getAttribute('href'), volverAlto: r ? Math.round(r.height) : 0,
    sinMedallero: document.getElementById('medallero')?.classList.contains('hidden') !== false,
    titulo: document.title, cartas: !/Cartas/.test(migas?.textContent || ''),
  }
})
const lista = (page) => page.evaluate(() => ({
  titulos: [...document.querySelectorAll('#apLista .guia-titulo, #apLista .gf-titulo, #apLista a')].map((x) => x.textContent.trim()).filter(Boolean),
  n: document.querySelectorAll('#apLista .guia-tarjeta, #apLista .guia-fila').length,
  cuenta: document.getElementById('apCuenta')?.textContent,
  chipsTema: document.querySelectorAll('#apChips [data-cat]').length,
  seg: [...document.querySelectorAll('#apSeg [data-vista]')].map((b) => `${b.dataset.vista}:${b.getAttribute('aria-pressed')}`),
}))

console.log('── 1. El tema en el PC ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html?tema=mazos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await cabecera(page)
  check('migas «Inicio › Aprender › Mazos & estrategia», sin ningún «Cartas»', c?.migas === 'Inicio › Aprender › Mazos & estrategia' && c.cartas, JSON.stringify(c))
  check('cabecera compacta: icono, nombre, descripción, «2 de 3 guías leídas · 1 de 1 curso hecho» y el aro 2/3', c?.icono && c.h1 === 'Mazos & estrategia' && /por qué funcionan/.test(c.desc || '') && c.cuenta === '2 de 3 guías leídas · 1 de 1 curso hecho' && c.aro === '2/3' && Math.abs(parseFloat(c.vuelta) - 0.667) < 0.01, JSON.stringify(c))
  check('  …el medallero no sale y el título de la pestaña es el tema', c?.sinMedallero && /Mazos & estrategia · Aprender/.test(c.titulo))
  let l = await lista(page)
  check('las tres guías del tema, en tarjetas, en el orden del temario (1, 2, luego la nueva); sin chips de tema', l.n === 3 && l.chipsTema === 0, JSON.stringify(l))
  check('  …y Guías · Cursos como segmentado, Guías puesto', l.seg.join() === 'guias:true,cursos:false', JSON.stringify(l.seg))
  await page.click('#apSeg [data-vista="cursos"]')
  await page.waitForTimeout(300)
  l = await lista(page)
  check('Cursos: solo la que tiene curso', l.n === 1 && l.seg.join() === 'guias:false,cursos:true', JSON.stringify(l))
  await page.click('#apSeg [data-vista="guias"]')
  // «Sin leer» y la cuenta «3 guías» se fueron en la 1039: lo leído ya lo
  // dicen la cabecera («2 de 3 guías leídas») y cada tarjeta.
  check('sin chips de nivel ni «Sin leer» (1039)', (await page.locator('[data-nivel], [data-sinleer]').count()) === 0)
  await page.fill('#apBuscar', 'mental')
  await page.waitForTimeout(300)
  l = await lista(page)
  check('buscar dentro del tema', l.n === 1 && /claves mentales/.test(l.titulos.join(' ')), JSON.stringify(l))
  await ctx.close()
}

console.log('── 2. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html?tema=mazos', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await cabecera(page)
  check('el botón «‹ Aprender» de 44 px (la pieza de la 857) y la cabecera', c?.volver === 'Aprender' && c.volverHref === '/aprender' && c.volverAlto >= 44 && c.h1 === 'Mazos & estrategia', JSON.stringify(c))
  const l = await lista(page)
  check('las guías en filas', l.n === 3, JSON.stringify(l))
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }))
  await page.waitForTimeout(700)
  const b = await page.evaluate(() => {
    const b = document.getElementById('barraPegada')
    const r = b?.getBoundingClientRect()
    return b && { visible: getComputedStyle(b).display !== 'none' && r.height > 0, titulo: b.querySelector('.barra-pegada-titulo')?.textContent, cifra: b.querySelector('.barra-pegada-cifra')?.textContent, href: b.querySelector('.barra-pegada-volver')?.getAttribute('href') }
  })
  check('al bajar, la barra pegada: flecha a Aprender, el tema y «2 de 3 leídas»', b?.visible && b.titulo === 'Mazos & estrategia' && b.cifra === '2 de 3 leídas' && b.href === '/aprender', JSON.stringify(b))
  await ctx.close()
}

console.log('── 3. Sin cuenta, y un tema que no existe ──')
{
  const { page, ctx } = await abrir('/aprender.html?tema=mazos', { sesion: 'none' })
  const c = await cabecera(page)
  check('sin cuenta: «3 guías · 1 curso», sin aro ni «Sin leer»', c?.cuenta === '3 guías · 1 curso' && !c.aro && (await page.locator('#apChips [data-sinleer]').count()) === 0, JSON.stringify(c))
  await ctx.close()
  const otro = await abrir('/aprender.html?tema=no-existe')
  const l = await lista(otro.page)
  // (Desde la 865 la lista ya no lleva chips de tema: son las baldosas.)
  check('un tema que no existe: la lista de siempre, con todas', l.n === 4 && !(await cabecera(otro.page)), JSON.stringify(l))
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
