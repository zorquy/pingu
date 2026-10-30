// Tanda 1122 — /admin → Correos en pantalla: la lista de los correos por
// familia, el elegido con sus textos editables y la vista previa que cambia
// mientras escribes (la plantilla de verdad), guardar, «cambiado» en la
// lista, «Volver al de siempre», «Enviarme una prueba» y, sin la migración,
// los correos se ven igual y el panel lo dice.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const browser = await chromium.launch()
const errores = []
async function abrir({ sin = false, viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { window.__FAKE_SESSION__ = 'admin-1'; if (s) { window.__SIN_TABLAS__ = ['correo_textos']; window.__SIN_1122__ = true } }, sin)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  // Ese error sale de Playwright (`serviceWorkers: 'block'` toca el navegador
  // dentro del iframe con sandbox); sin él, una persona no lo ve (1122).
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  await page.goto(`${BASE}/admin/?ver=correos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.co-item', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(300)
  return page
}
const previa = (page) => page.$eval('#coPrevia', (f) => f.srcdoc)

console.log('── La lista y el editor ──')
const page = await abrir()
const items = await page.$$eval('.co-item', (els) => els.map((e) => e.dataset.co))
const grupos = await page.$$eval('.co-grupo', (els) => els.map((e) => e.textContent))
check('los veinte correos, por familia', items.length === 20 && grupos.includes('Torneo') && grupos.includes('Foro'), `${items.length} · ${grupos.join(', ')}`)
check('una sola vista previa a la vez (no veinte iframes)', (await page.$$('#section-correos iframe')).length === 1)
check('el primero abierto, con su asunto y su botón de siempre de pista', /Ibai te ha enviado un mensaje/.test(await page.textContent('#coAsuntoFinal')) && (await page.getAttribute('#coCta', 'placeholder')) === 'Leer el mensaje')
await page.click('.co-item[data-co="forum_reply"]')
await page.waitForTimeout(150)
const asuntoEj = await page.textContent('#coAsuntoFinal')
await page.fill('#coAsunto', 'PokeDoc · {asunto}')
await page.fill('#coIntro', 'Alguien ha contestado en un tema que sigues.')
await page.fill('#coCta', 'Ir al tema')
check('la vista previa cambia mientras escribes', (await page.textContent('#coAsuntoFinal')) === `PokeDoc · ${asuntoEj}` && /Alguien ha contestado en un tema que sigues\./.test(await previa(page)) && />Ir al tema</.test(await previa(page)))
await page.fill('#coAsunto', 'Asunto fijo')
check('sin {asunto} avisa de que todos llevarán el mismo', await page.isVisible('#coAsuntoNota'))
await page.fill('#coAsunto', 'PokeDoc · {asunto}')
await page.click('#coForm button[type="submit"]')
await page.waitForTimeout(500)
const fila = await page.evaluate(() => window.__TABLAS__.correo_textos.find((f) => f.tipo === 'forum_reply'))
check('guardar escribe solo lo de ese tipo', fila?.asunto === 'PokeDoc · {asunto}' && fila.intro === 'Alguien ha contestado en un tema que sigues.' && fila.cta === 'Ir al tema' && !fila.pie, JSON.stringify(fila))
check('  …y en la lista sale «cambiado»', /cambiado/.test(await page.textContent('.co-item[data-co="forum_reply"]')) && !/cambiado/.test(await page.textContent('.co-item[data-co="private_message"]')))
await page.click('[data-co-prueba]')
await page.waitForTimeout(400)
const cola = await page.evaluate(() => window.__TABLAS__.email_outbox)
check('«Enviarme una prueba» la mete en la cola para mí', cola.length === 1 && cola[0].type === 'forum_reply' && cola[0].recipient_id === 'admin-1' && /En la cola/.test(await page.textContent('body')), JSON.stringify(cola))
await page.click('[data-co-siempre]')
await page.waitForTimeout(400)
check('«Volver al de siempre» borra la fila y vacía los campos', !(await page.evaluate(() => window.__TABLAS__.correo_textos.some((f) => f.tipo === 'forum_reply'))) && (await page.inputValue('#coCta')) === '' && !/cambiado/.test(await page.textContent('.co-item[data-co="forum_reply"]')))
await page.screenshot({ path: '/tmp/1122-pc.png' })

console.log('── Sin la migración ──')
const sin = await abrir({ sin: true })
check('se ven los correos, los campos apagados y lo dice', (await sin.$$('.co-item')).length === 20 && (await sin.isDisabled('#coCta')) && /supabase-migration-1122-correos\.sql/.test(await sin.textContent('#coEditor')) && /<html/i.test(await previa(sin)))

console.log('── En el móvil ──')
const movil = await abrir({ viewport: { width: 390, height: 844 } })
check('cabe sin desbordar de lado', (await movil.evaluate(() => document.documentElement.scrollWidth)) <= 392)
check('sin errores en las páginas', !errores.length, errores.join(' | '))

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
