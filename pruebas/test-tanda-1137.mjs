// Tanda 1137 — lo que cuenta Gente, «Novato» a la vista y el «Me gusta» de
// una noticia (PINGU: «mensajes en el foro debería ser en total», «en la web
// no hay 58 guías», «los que no tienen experiencia deberían tener el nivel
// mínimo» y «te sale alguien le ha servido tu guía, y es una noticia»).
//
//   1. Lo puro: un «Me gusta» suelto de una noticia guardado como «tu guía»
//      se lee «le ha gustado tu noticia»; el de una guía no cambia.
//   2. /usuarios: «mensajes» cuenta todos (también los de hace un mes) y
//      «guías» no cuenta noticias.
//   3. Una persona sin XP lleva su chapa de «Novato».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Lo puro ──')
globalThis.window = globalThis.window || undefined
const g = await import(`${RAIZ}/js/avisos-grupos.js`).catch((e) => ({ error: e }))
if (g.error) check('se carga avisos-grupos.js', false, g.error)
else {
  const ahora = Date.parse('2026-10-31T12:00:00Z')
  const titulo = (a) => g.agruparAvisos([{ id: 1, created_at: '2026-10-31T10:00:00Z', ...a }], ahora)[0].grupos[0].titulo
  check('noticia vieja: «A alguien le ha gustado tu noticia»', titulo({ type: 'guide_helpful', link: '/noticias/sale-delta-reign', title: 'A alguien le ha servido tu guía' }) === 'A alguien le ha gustado tu noticia')
  check('guía: se queda como estaba', titulo({ type: 'guide_helpful', link: '/guia/como-empezar', title: 'A alguien le ha servido tu guía' }) === 'A alguien le ha servido tu guía')
  check('otro tipo: su título', titulo({ type: 'forum_reply', link: '/noticias/x', title: 'servido tu guía' }) === 'servido tu guía')
}

console.log('\n── 2 y 3. /usuarios ──')
const hace = (dias) => new Date(Date.now() - dias * 86400e3).toISOString()
const MENSAJES = [hace(0), hace(2), hace(20), hace(40), hace(90)].map((created_at, i) => ({ id: `m-${i}`, created_at }))
const GUIAS = [
  { id: 'g1', kind: 'guide', author_id: 'user-1' },
  { id: 'g2', kind: 'guide', author_id: 'user-1' },
  { id: 'n1', kind: 'news', author_id: 'admin-1' },
  { id: 'n2', kind: 'news', author_id: 'admin-1' },
  { id: 'n3', kind: 'news', author_id: 'admin-1' },
]
const PERFILES = [{ id: 'nuevo-1', username: 'recien', display_name: 'Recién llegado', total_xp: 0, xp: 0, level: 'Novato', created_at: hace(0) }]
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, locale: 'es-ES' })
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_MENSAJES__ = d.m
  window.__FAKE_GUIAS__ = d.g
  window.__FAKE_PERFILES__ = d.p
}, { m: MENSAJES, g: GUIAS, p: PERFILES })
await page.goto(`${BASE}/usuarios`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const cifras = await page.evaluate(() => ({ mensajes: document.getElementById('cifraMensajes')?.textContent, guias: document.getElementById('cifraGuias')?.textContent }))
const enBase = await page.evaluate(() => ({ posts: (window.__TABLAS__?.forum_posts || []).length, guias: (window.__TABLAS__?.guides || []).filter((x) => x.kind === 'guide' && x.author_id && x.published_at).length }))
check('«mensajes en el foro» son TODOS, también los de hace meses', Number(cifras.mensajes) === enBase.posts && enBase.posts >= 5, JSON.stringify({ cifras, enBase }))
check('«guías» no cuenta las noticias', Number(cifras.guias) === enBase.guias && enBase.guias >= 2, JSON.stringify({ cifras, enBase }))
const chapa = await page.evaluate(() => {
  const c = document.querySelector('.com-persona[data-user-id="nuevo-1"]')
  return c ? (c.querySelector('.nivel-chapa')?.textContent || '').trim() : null
})
check('quien no tiene XP lleva su «Novato»', chapa === 'Novato', chapa)
check('sin errores', !errores.length, errores.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
