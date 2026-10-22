// Cuánto TARDA cada página (propuesta «Que vaya rápida la segunda vez»,
// PINGU: «si te carga lento la primera vez, ni tan mal, pero que luego vaya
// rápido»). Cada página en un iPhone simulado, con 4G (RTT y ancho limitados
// por CDP), CPU a la mitad, sesión y la base retrasada PD_RETRASO ms por
// consulta. Tres pasadas en el MISMO navegador:
//   1. primera vez (nada guardado),
//   2. segunda vez (service worker y caché llenos), la base igual de lenta,
//   3. segunda vez con la base a 0 ms: el suelo de lo que daría pintar los
//      datos de lo guardado de la última vez.
// Dos cifras: «se ve» es cuando el contenido de la página tiene ya el 90 %
// del texto con el que acaba (un esqueleto no cuenta; lo guardado de la
// última vez, sí), y «al día» es el último elemento que entra o sale del DOM
// (llegó lo nuevo). Las esperas EN FILA salen de la línea de tiempo del doble:
// una consulta pedida cuando la anterior ya había vuelto es una espera más.
// Uso: PD_BASE=http://localhost:8893 node medir-tiempos.mjs [/ruta …]
// (8893 = herramientas/servir-gzip.py: Netlify comprime; sin comprimir se
// cuentan cuatro veces los bytes).
import { writeFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
// La lista de medir-saltos.mjs (importarla lo EJECUTARÍA entero).
const PAGINAS = (await import('node:fs')).readFileSync(new URL('./medir-saltos.mjs', import.meta.url), 'utf8')
  .match(/export const PAGINAS = \[([\s\S]*?)\]/)[1].match(/'[^']+'/g).map((x) => x.slice(1, -1))

const BASE = process.env.PD_BASE || 'http://localhost:8893'
const RETRASO = Number(process.env.PD_RETRASO || 250)
const ESPERA = Number(process.env.PD_ESPERA || 7000)
const RTT = Number(process.env.PD_RTT || 100)
const BAJADA = Number(process.env.PD_MBPS || 5)
const rutas = process.argv.slice(2).length ? process.argv.slice(2) : PAGINAS

const browser = await chromium.launch()
const resultados = []

async function medir(page, ruta) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(ESPERA)
  return page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
    const nav = performance.getEntriesByType('navigation')[0]
    const recursos = performance.getEntriesByType('resource')
    const bytes = recursos.reduce((n, r) => n + (r.transferSize || 0), nav?.transferSize || 0)
    return {
      fcp: Math.round(fcp),
      html: Math.round(nav?.responseEnd || 0),
      listo: Math.round(window.__listo || fcp),
      seVe: (() => {
        const fin = window.__textos.at(-1)?.[1] || 0
        const t = window.__textos.find(([, n]) => n >= fin * 0.9)?.[0]
        return Math.round(Math.max(fcp, t || fcp))
      })(),
      enFila: (() => {
        const ls = (window.__LINEA__ || []).map((x) => x[1]).sort((a, b) => a - b)
        let olas = 0, desde = -Infinity
        for (const t of ls) if (t >= desde + window.__RET * 0.8) { olas++; desde = t }
        return window.__RET ? olas : 0
      })(),
      linea: window.__LINEA__ || [],
      consultas: window.__CONSULTAS__?.n || 0,
      ficheros: recursos.filter((r) => /\/(js|css)\//.test(r.name)).length,
      kb: Math.round(bytes / 1024),
    }
  })
}

for (const ruta of rutas) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'allow' })
  await ctx.addInitScript((ms) => {
    window.__FAKE_SESSION__ = 'user-1'
    let r = ms
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}')
      const m = sessionStorage.getItem('medir-ms'); if (m != null) r = Number(m)
    } catch {}
    const siempre = new Proxy({}, { get: () => r })
    window.__FAKE_RETRASO__ = siempre
    window.__RPC_RETRASO__ = siempre
    window.__listo = 0
    window.__RET = r
    window.__LINEA__ = []
    window.__textos = []
    let pendiente = false
    const medirTexto = () => {
      pendiente = false
      const main = document.querySelector('main, .page-content') || document.body
      if (main) window.__textos.push([performance.now(), (main.innerText || '').replace(/\s+/g, '').length])
    }
    new MutationObserver(() => { if (!pendiente) { pendiente = true; setTimeout(medirTexto, 0) } }).observe(document, { childList: true, subtree: true, characterData: true })
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of [...m.addedNodes, ...m.removedNodes]) {
        if (n.nodeType === 1 && !['SCRIPT', 'LINK', 'STYLE', 'META'].includes(n.tagName)) { window.__listo = performance.now(); return }
      }
    }).observe(document, { childList: true, subtree: true })
  }, RETRASO)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net|images\.pokemontcg/, (r) => setTimeout(() => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }).catch(() => {}), 300))
  await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }).catch(() => {}), RETRASO))
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: (BAJADA * 1e6) / 8, uploadThroughput: (1.5 * 1e6) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 })
  try {
    const primera = await medir(page, ruta)
    await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => {})
    await page.waitForTimeout(1500)
    const segunda = await medir(page, ruta)
    await page.evaluate(() => sessionStorage.setItem('medir-ms', '0'))
    const guardado = await medir(page, ruta)
    const r = { ruta, primera, segunda, guardado }
    resultados.push(r)
    const f = (x) => `${(x.seVe / 1000).toFixed(1)}/${(x.listo / 1000).toFixed(1)}s ${x.enFila}f`
    console.log(`${ruta.padEnd(28)} 1ª ${f(primera)} ${String(primera.kb).padStart(4)}KB ${String(primera.consultas).padStart(3)}q | 2ª ${f(segunda)} ${String(segunda.kb).padStart(4)}KB | guardado ${f(guardado)}`)
  } catch (e) {
    console.log(`  ERROR ${ruta}: ${String(e.message).slice(0, 100)}`)
  }
  await ctx.close()
}
await browser.close()
if (process.env.PD_JSON) writeFileSync(process.env.PD_JSON, JSON.stringify(resultados, null, 1))
