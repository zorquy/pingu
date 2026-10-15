// Tanda 864 — la puerta de Aprender: los temas como baldosas.
//
// Segunda tanda de «Aprender por temas»: encima de la lista, cada tema
// con su icono, «N guías · M cursos» y, con cuenta, la barra de lo leído.
// Tocarlo abre la página del tema (863). En el móvil, una fila que se
// desliza, para que la lista siga cerca (la 846); en el PC, en rejilla. Un
// tema sin guías no sale, y la página del tema no lleva baldosas.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const browser = await chromium.launch()
const document_sinSeccion = (n) => n === 0
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_CATEGORIAS__ = [
    { id: 'cat-pasos', name: 'Primeros pasos', slug: 'primeros-pasos', description: 'Para empezar', order_pos: 1 },
    { id: 'cat-mazos', name: 'Mazos & estrategia', slug: 'mazos', description: 'Mazos', emoji: '🃏', order_pos: 2 },
    { id: 'cat-reglas', name: 'Reglas', slug: 'reglas', description: 'Reglas', order_pos: 3 },
    { id: 'cat-vacia', name: 'Sin nada todavía', slug: 'vacia', description: '', order_pos: 4 },
  ]
  const curso = [{ type: 'paragraph', text: 'x' }, { type: 'quiz', question: '¿?', options: ['a', 'b'], answer: 0 }]
  const g = (i, titulo, cat, extra = {}) => ({ id: `g-${i}`, slug: `guia-${i}`, title: titulo, description: `Descripción ${i}`, published_at: `2026-10-${String(i).padStart(2, '0')}T10:00:00Z`, category_id: cat, level: 'basico', estimated_mins: 4, blocks: [{ type: 'paragraph', text: 'x' }], ...extra })
  window.__FAKE_GUIAS__ = [
    g(1, 'Cómo leer una carta', 'cat-pasos'), g(2, 'Tu primer mazo', 'cat-pasos', { blocks: curso }),
    g(3, 'Arquetipo Beedrill ex', 'cat-mazos', { blocks: curso }), g(4, '3 claves mentales', 'cat-mazos'), g(5, 'Cómo jugar Charizard ex', 'cat-mazos'),
    g(6, 'Qué es el mulligan', 'cat-reglas'),
  ]
  window.__FAKE_PROGRESO__ = sesion === 'none' ? [] : [
    { user_id: 'user-1', guide_id: 'g-1', status: 'completed', read_at: '2026-10-10T10:00:00Z', current_block: 1 },
    { user_id: 'user-1', guide_id: 'g-2', status: 'completed', read_at: '2026-10-10T10:00:00Z', current_block: 2 },
    { user_id: 'user-1', guide_id: 'g-3', status: 'in_progress', read_at: '2026-10-10T10:00:00Z', current_block: 1 },
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
const baldosas = (page) => page.evaluate(() => {
  const z = document.getElementById('apTemas')
  const lista = document.getElementById('apLista')
  return {
    hay: Boolean(z),
    temas: [...(z?.querySelectorAll('.ap-baldosa') || [])].map((b) => ({ nombre: b.querySelector('.ap-baldosa-nombre')?.textContent, sub: b.querySelector('.ap-baldosa-sub')?.textContent, href: b.getAttribute('href'), barra: b.querySelector('.ap-baldosa-barra i')?.style.width ?? null, icono: Boolean(b.querySelector('.ap-baldosa-icono')) })),
    desliza: z ? z.scrollWidth > z.clientWidth + 10 : null,
    alto: z ? Math.round(z.getBoundingClientRect().height) : 0,
    listaY: lista ? Math.round(lista.getBoundingClientRect().top) : null,
  }
})

console.log('── 1. La puerta en el PC ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await baldosas(page)
  check('tres baldosas (la vacía no sale), en el orden de los temas, con icono, «N guías · M cursos» y el enlace al tema', b.hay && b.temas.map((t) => t.nombre).join('|') === 'Primeros pasos|Mazos & estrategia|Reglas' && b.temas[0].sub === '2 guías · 1 curso' && b.temas[1].sub === '3 guías · 1 curso' && b.temas[2].sub === '1 guía' && b.temas[1].href === '/aprender?tema=mazos' && b.temas.every((t) => t.icono), JSON.stringify(b.temas))
  check('  …con la barra de lo leído: 100 %, 33 % y 0 %', b.temas.map((t) => t.barra).join() === '100%,33%,0%', JSON.stringify(b.temas.map((t) => t.barra)))
  // Desde la 865 no hay títulos de sección: las baldosas, la fila de mandos y las guías.
  check('  …y debajo, la lista de siempre, sin títulos de sección', document_sinSeccion(await page.evaluate(() => document.querySelectorAll('.ap-seccion').length)) && (await page.locator('#apLista .guia-tarjeta').count()) === 6)
  await page.click('#apTemas .ap-baldosa[href="/aprender?tema=mazos"]')
  await page.waitForTimeout(1800)
  const t = await page.evaluate(() => ({ h1: document.querySelector('#apTemaCab h1')?.textContent, baldosas: Boolean(document.getElementById('apTemas')) }))
  check('tocar una abre su página, sin baldosas', t.h1 === 'Mazos & estrategia' && !t.baldosas, JSON.stringify(t))
  await ctx.close()
}

console.log('── 2. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/aprender.html', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await baldosas(page)
  check('una fila que se desliza, de menos de 80 px (865), y la lista empieza en la primera pantalla', b.hay && b.desliza && b.alto < 80 && b.listaY < 700, JSON.stringify({ desliza: b.desliza, alto: b.alto, listaY: b.listaY }))
  const toca = await page.evaluate(() => { const r = document.querySelector('#apTemas .ap-baldosa').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })
  check('  …y cada baldosa se puede tocar (≥ 44 px)', toca[0] >= 44 && toca[1] >= 44, toca.join('×'))
  await ctx.close()
}

console.log('── 3. Sin cuenta ──')
{
  const { page, ctx } = await abrir('/aprender.html', { sesion: 'none' })
  const b = await baldosas(page)
  check('sin cuenta: las baldosas con sus cuentas y sin barra', b.temas.length === 3 && b.temas.every((t) => t.barra === null), JSON.stringify(b.temas))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
