// Tanda 865 — la puerta de Aprender en cuatro capas.
//
// PINGU, con la 864 delante: «ahora es más lío incluso». Eran nueve
// bloques antes de la primera guía. Ahora: la cabecera (el título con el
// medallero de píldora al lado, sin texto), lo tuyo («sigue donde lo
// dejaste»), los temas en UNA fila compacta, y las guías con UNA fila de
// mandos (buscador, «N guías», nivel, sin leer, con curso). Sin chips de
// tema (tocar una baldosa es eso) y sin títulos de sección. El glosario,
// que perdía su único enlace, va al menú de Aprender (PC y burbuja) y al
// pie de todas las páginas.
import { readFileSync, readdirSync } from 'node:fs'
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
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conMenu = paginas.filter((f) => /href="\/guardados\.html">Guardados<\/a>/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
  const sinGlosario = conMenu.filter((f) => (readFileSync(`${RAIZ}/${f}`, 'utf8').match(/href="\/glosario">Glosario<\/a>/g) || []).length < 3)
  check(`«Glosario» va detrás de «Guardados» en el menú de Aprender (PC y móvil) y en el pie de las ${conMenu.length} páginas`, conMenu.length >= 40 && sinGlosario.length === 0, sinGlosario.join(', '))
  const html = readFileSync(`${RAIZ}/aprender.html`, 'utf8')
  check('la cabecera de /aprender es el título y el medallero, sin texto de bienvenida', /<div class="page-header ap-cab cab-lista">\s*<h1>Aprender<\/h1>\s*<a class="medallero hidden" id="medallero"/.test(html) && !/Guías y cursos gratis/.test(html))
}

const browser = await chromium.launch()
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  const nombres = ['Primeros pasos', 'Comprar, vender & mercado', '¿Es real o fake?', 'Identificar cartas', 'Historia & curiosidades', 'Mazos & estrategia']
  window.__FAKE_CATEGORIAS__ = nombres.map((name, i) => ({ id: `cat-${i}`, name, slug: `tema-${i}`, description: name, order_pos: i }))
  const curso = [{ type: 'paragraph', text: 'x' }, { type: 'quiz', question: '¿?', options: ['a', 'b'], answer: 0 }]
  window.__FAKE_GUIAS__ = Array.from({ length: 12 }, (_, i) => ({ id: `g-${i}`, slug: `guia-${i}`, title: `Guía número ${i + 1}`, description: `Descripción ${i}`, published_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`, category_id: `cat-${i % 6}`, level: 'basico', estimated_mins: 4, blocks: i % 2 ? curso : [{ type: 'paragraph', text: 'x' }] }))
  window.__FAKE_PROGRESO__ = sesion === 'none' ? [] : [
    { user_id: 'user-1', guide_id: 'g-1', status: 'completed', read_at: '2026-10-10T10:00:00Z', current_block: 2, medal: 'oro' },
    { user_id: 'user-1', guide_id: 'g-3', status: 'in_progress', read_at: null, current_block: 1, started_at: '2026-10-12T10:00:00Z' },
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
const capas = (page) => page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), alto: Math.round(b.height), visible: getComputedStyle(el).display !== 'none' && b.height > 0 } }
  const m = document.getElementById('medallero')
  return {
    h1: r('.ap-cab h1'), medallero: r('#medallero'), medalleroDentro: Boolean(m?.closest('.ap-cab')), medalleroTexto: m?.textContent.replace(/\s+/g, ' ').trim(), medalleroEtiqueta: m?.getAttribute('aria-label'), medalleroHref: m?.getAttribute('href'),
    seguir: r('.aprender-seguir'), temas: r('#apTemas'), buscar: r('.ap-buscar'), chips: r('#apChips'), lista: r('#apLista'), primeraGuia: r('#apLista .guia-tarjeta, #apLista .guia-fila'),
    secciones: document.querySelectorAll('.ap-seccion, #categoriesList h2').length, chipsTema: document.querySelectorAll('[data-cat]').length,
    baldosas: [...document.querySelectorAll('#apTemas .ap-baldosa')].map((b) => Math.round(b.getBoundingClientRect().top)),
    cuenta: document.getElementById('apCuenta')?.textContent, texto: document.querySelector('.page-header p')?.textContent || null,
  }
})

console.log('── 1. El PC: cuatro capas ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await capas(page)
  check('la cabecera: el título con el medallero de píldora al lado, con sus cifras y su texto para quien no ve los colores, y sin párrafo', c.medalleroDentro && c.medallero?.visible && Math.abs(c.medallero.top - c.h1.top) < 24 && /^0 0 0 6 por jugar$/.test(c.medalleroTexto || '') && /Medallero: 0 oros, 0 platas, 0 bronces; 6 cursos por jugar/.test(c.medalleroEtiqueta || '') && c.medalleroHref === '/perfil?ver=medallas' && c.texto === null, JSON.stringify({ t: c.medalleroTexto, e: c.medalleroEtiqueta, h: c.medalleroHref, top: [c.h1?.top, c.medallero?.top] }))
  check('lo tuyo: «sigue donde lo dejaste»', c.seguir?.visible)
  check('los temas: las seis en UNA fila (misma altura), de menos de 70 px', c.baldosas.length === 6 && new Set(c.baldosas).size === 1 && c.temas.alto < 70, JSON.stringify({ tops: c.baldosas, alto: c.temas?.alto }))
  check('una sola fila de mandos: el buscador y los chips a la misma altura; sin chips de tema; «12 guías» de rótulo', c.buscar && c.chips && Math.abs(c.buscar.top - c.chips.top) < 30 && c.chipsTema === 0 && c.cuenta === '12 guías', JSON.stringify({ b: c.buscar, ch: c.chips, tema: c.chipsTema, cuenta: c.cuenta }))
  check('sin títulos de sección, y la primera guía antes de los 520 px', c.secciones === 0 && c.primeraGuia && c.primeraGuia.top < 520, JSON.stringify({ secciones: c.secciones, y: c.primeraGuia?.top }))
  // Los mandos siguen funcionando.
  await page.click('#apChips [data-concurso]')
  await page.waitForTimeout(300)
  check('«Con curso» filtra', (await page.locator('#apLista .guia-tarjeta').count()) === 6 && (await page.locator('#apCuenta').textContent()) === '6 guías')
  await page.click('#apChips [data-concurso]')
  await page.fill('#apBuscar', 'número 7')
  await page.waitForTimeout(300)
  check('el buscador también', (await page.locator('#apLista .guia-tarjeta').count()) === 1)
  // El menú de Aprender lleva Glosario.
  const menu = await page.evaluate(() => [...document.querySelectorAll('.nav-grupo .nav-sub a')].map((a) => a.textContent.trim()))
  check('el menú «Aprender» del PC: Guías y cursos · Retos diarios · Guardados · Glosario', menu.slice(0, 4).join('|') === 'Guías y cursos|Retos diarios|Guardados|Glosario', menu.join('|'))
  await ctx.close()
}

console.log('── 2. El iPhone ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const c = await capas(page)
  check('la primera guía empieza antes de los 620 px (antes, fuera de la pantalla)', c.primeraGuia && c.primeraGuia.top < 620, String(c.primeraGuia?.top))
  check('los temas en una fila que se desliza', (await page.evaluate(() => { const z = document.getElementById('apTemas'); return z.scrollWidth > z.clientWidth + 10 })))
  const burbuja = await page.evaluate(() => [...document.querySelectorAll('.bm-burbuja a')].map((a) => a.textContent.trim()))
  check('la burbuja de Aprender: Guías · Retos · Guardados · Glosario', burbuja.join('|') === 'Guías|Retos|Guardados|Glosario', burbuja.join('|'))
  await ctx.close()
}

console.log('── 3. Sin cuenta ──')
{
  const { page, ctx } = await abrir('/aprender.html', { sesion: 'none' })
  const c = await capas(page)
  check('sin cuenta: ni medallero ni «sigue»; los temas y las guías igual', !c.medallero?.visible && !c.seguir && c.baldosas.length === 6 && c.primeraGuia, JSON.stringify({ m: c.medallero, s: c.seguir, b: c.baldosas.length }))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
