// Tanda 1325 — Ninguna página vacía sin salida (D2 del plan): el molde común
// (`vacioHtml`, la mascota, qué irá aquí y dos salidas) en la agenda de
// eventos vacía o sin cargar, y salidas cuando «¿Qué carta es?» no puede
// traer la carta del día.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const { vacioHtml } = await import(`${REPO}/js/vacio.js`)
const h = vacioHtml({ titulo: 'Aún no hay <b>nada</b>', texto: 'Qué irá aquí', salidas: [{ texto: 'Una', href: '/a' }, { texto: 'Dos', href: '/b' }, { texto: 'Tres', href: '/c' }] })
check('el molde: mascota, título (escapado), texto y como mucho dos salidas, la primera principal', /vacio-mascota/.test(h) && /Aún no hay &lt;b&gt;nada&lt;\/b&gt;/.test(h) && (h.match(/<a /g) || []).length === 2 && /class="btn-primary" href="\/a"/.test(h) && /class="btn-secondary" href="\/b"/.test(h))
check('  …sin salidas no pinta la fila de botones', !/vacio-salidas/.test(vacioHtml({ titulo: 'x' })))

const b = await chromium.launch()
const botonesALaVista = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(`${s} a.btn-primary, ${s} a.btn-secondary, ${s} button.btn-primary`)].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height >= 40 && r.top < innerHeight }).map((x) => x.textContent.trim()), sel)
for (const [nombre, disp] of [['PC', { viewport: { width: 1280, height: 900 } }], ['móvil', devices['iPhone 13']]]) {
  const ctx = await b.newContext({ ...disp, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; window.__RPC_RESPUESTAS__ = { eventos_lista: [] } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/eventos.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.vacio', { timeout: 6000 }).catch(() => {})
  const bs = await botonesALaVista(p, '.vacio')
  check(`${nombre}: /eventos sin eventos dice qué irá aquí y tiene dos salidas a la vista`, /Aún no hay eventos|llega muy pronto/.test(await p.locator('.vacio').textContent().catch(() => '')) && bs.length === 2, JSON.stringify(bs))
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; window.__FAKE_FALLA__ = { eventos: true } })
  const p = await ctx.newPage()
  await p.route('**/rest/v1/rpc/eventos_lista*', (r) => r.abort())
  await p.goto(`${BASE}/eventos.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const txt = await p.locator('#evAgenda, main').first().textContent().catch(() => '')
  check('si la agenda no carga o no está: también con salidas, no una frase suelta', (await p.locator('.vacio .btn-primary, .vacio .btn-secondary').count()) >= 1 || /Aún no hay eventos/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 200))
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  await p.route('**/.netlify/functions/carta-del-dia*', (r) => r.fulfill({ status: 500, body: 'no' }))
  await p.goto(`${BASE}/carta-del-dia.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const bs = await botonesALaVista(p, '#cdSub + .vacio-salidas')
  check('«¿Qué carta es?» sin carta: «Otros retos de hoy» y «Reintentar»', JSON.stringify(bs) === '["Otros retos de hoy","Reintentar"]', JSON.stringify(bs) + ' — ' + (await p.locator('#cdSub').textContent().catch(() => '')))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
