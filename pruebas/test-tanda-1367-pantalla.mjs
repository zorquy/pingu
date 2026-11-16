// Tanda 1367 — La franja del evento en Inicio no se podía pulsar (PINGU: «si
// clicas en el banner no hace nada, solo te deja clicar en el nombre»). El
// nombre se estira a toda la franja con ::after (1293), pero el «encogerse al
// pulsar» de style.css (`a[class]:active { transform: scale(.97) }`) hacía del
// enlace la caja de su ::after al apretar: la zona pulsable se encogía al
// nombre en mitad del clic y el clic soltado en la franja caía fuera.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const EVENTO = { id: 'id-tradeitto', slug: 'tradeitto-2', nombre: 'Tradeitto 2', tipo: 'card_show', publicado: true, destacado: true, color: '#c62a5c', empieza: new Date(dia(33) + 'T10:00').toISOString(), termina: new Date(dia(33) + 'T20:00').toISOString(), horario: [{ dia: dia(33), desde: '10:00', hasta: '20:00' }], asistentes: [{ user_id: 'user-2' }, { user_id: 'user-1' }] }

const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([EVENTO])}`)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoPortada .portada-evento', { timeout: 15000 }).catch(() => {})
  // Se pulsa sobre la franja, a 3/5 de su ancho y abajo (la línea de «van» y
  // «faltan», lejos del nombre y del «¡Voy!»), con el ratón apretado un rato.
  const franja = page.locator('#eventoPortada .portada-evento')
  await page.waitForTimeout(1500)
  const r = await franja.boundingBox().catch(() => null)
  check(`${movil ? 'móvil' : 'PC'}: la franja está`, Boolean(r))
  if (!r) { await ctx.close(); continue }
  const debajo = await franja.evaluate((f, p) => { const q = f.getBoundingClientRect(); const e = document.elementFromPoint(q.left + p.x, q.top + p.y); return e?.className || '' }, { x: r.width * 0.6, y: r.height * 0.75 })
  await franja.click({ position: { x: r.width * 0.6, y: r.height * 0.75 }, delay: 120 })
  await page.waitForURL(/\/eventos\/tradeitto-2/, { timeout: 6000 }).catch(() => {})
  check(`${movil ? 'móvil' : 'PC'}: pulsar la franja fuera del nombre (y apretando un rato) abre la ficha`, /\/eventos\/tradeitto-2/.test(page.url()), `${page.url()} (debajo: ${debajo})`)
  await ctx.close()
}
// El «¡Voy!» sigue siendo suyo: no abre la ficha.
{
  const ctx = await contexto(b, false, 'user-1')
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([{ ...EVENTO, asistentes: [] }])}`)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoPortada [data-pe-voy]', { timeout: 15000 }).catch(() => {})
  await page.click('#eventoPortada [data-pe-voy]').catch(() => {})
  await page.waitForTimeout(800)
  check('el «¡Voy!» apunta sin salir de Inicio', new URL(page.url()).pathname === '/' && (await page.$eval('#eventoPortada [data-pe-voy]', (x) => x.getAttribute('aria-pressed')).catch(() => '')) === 'true', page.url())
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
