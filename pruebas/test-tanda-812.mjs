// Tanda 812 — dos fallos del foro en el móvil.
//   1. La lupa del buscador de un foro salía rota con dedo (el botón crece a
//      44 px y el dibujo estaba anclado a las esquinas).
//   2. La cita que se escribe con «Citar» salía como texto normal.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`) }
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const FORO = {
  __FAKE_SECCIONES__: [{ id: 's2', name: 'Juego', position: 2 }],
  __FAKE_FOROS__: [{ id: 'f-reg', section_id: 's2', slug: 'dudas-de-reglas', name: 'Dudas de reglas', position: 1, post_policy: 'todos' }],
  __FAKE_TEMAS__: [{ id: 't1', board_id: 'f-reg', title: '¿Iono cuenta para Arven?', author_id: 'user-2', last_post_author_id: 'user-3', post_count: 2, last_post_at: hace(3), created_at: hace(60) }],
  __FAKE_MENSAJES__: [
    { id: 'm1', thread_id: 't1', author_id: 'user-2', body_html: '<p>Pregunta</p>', created_at: hace(60) },
    { id: 'm2', thread_id: 't1', author_id: 'user-3', body_html: '<blockquote>¿cuenta como turno?</blockquote><p>Uno por turno.</p>', created_at: hace(5) },
  ],
}
const browser = await chromium.launch()
const abrir = async (ruta, movil) => {
  const ctx = await browser.newContext(movil ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript((sem) => { window.__FAKE_SESSION__ = 'user-1'; Object.assign(window, sem) }, FORO)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx }
}
for (const movil of [true, false]) {
  const { page, ctx } = await abrir('/foro/dudas-de-reglas', movil)
  const r = await page.locator('.foro-buscador-btn').evaluate((b) => {
    const caja = b.getBoundingClientRect()
    const antes = getComputedStyle(b, '::before')
    const izq = parseFloat(antes.left) + parseFloat(antes.width) / 2
    const arr = parseFloat(antes.top) + parseFloat(antes.height) / 2
    return { ancho: caja.width, alto: caja.height, centroX: izq / caja.width, centroY: arr / caja.height }
  })
  check(`[${movil ? 'móvil' : 'ordenador'}] la lupa va centrada en su botón (${Math.round(r.ancho)} px)`, Math.abs(r.centroX - 0.5) < 0.12 && Math.abs(r.centroY - 0.5) < 0.12, JSON.stringify(r))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/tema/t1', true)
  const borde = await page.locator('.foro-mensaje-texto blockquote').first().evaluate((e) => getComputedStyle(e).borderLeftWidth)
  check('la cita escrita con «Citar» se ve como cita', borde === '3px', borde)
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
