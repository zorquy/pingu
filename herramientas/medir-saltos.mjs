// Cuánto SALTA cada página al cargar (tanda 981, PINGU: «empieza y sube y
// baja la pantalla; que no cargue con el esqueleto para luego romperlo»).
//
// Cada página en un iPhone simulado, con sesión, y con la base retrasada
// (todas las tablas y funciones tardan RETRASO ms): lo que se mide son los
// `layout-shift` del navegador sin que nadie toque nada —el CLS, la misma
// cifra que usa Google— y qué elementos se movieron más. Uso:
//
//   node medir-saltos.mjs                 # todas
//   node medir-saltos.mjs /foro /torneos  # solo esas
//   PD_JSON=salida.json node medir-saltos.mjs
import { writeFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RETRASO = Number(process.env.PD_RETRASO || 500)
const ESPERA = Number(process.env.PD_ESPERA || 6000)
export const PAGINAS = [
  '/index.html', '/aprender', '/guia?slug=guia-0', '/curso', '/noticias', '/foro', '/tema?id=tema-1', '/torneos', '/torneo?slug=torneo-0',
  '/mis-partidas', '/mazos', '/constructor', '/meta', '/cartas', '/cartas?ver=album', '/mi-coleccion', '/mi-coleccion?ver=cartas',
  '/mi-coleccion?ver=album', '/mi-coleccion?ver=pokedex', '/mi-coleccion?ver=carpetas', '/carta?id=sv8-1', '/perfil', '/usuario?u=Ash',
  '/usuarios', '/mensajes', '/retos', '/carta-del-dia', '/lanzamientos', '/buscar?q=pikachu', '/ajustes', '/novedades', '/glosario',
]
const rutas = process.argv.slice(2).length ? process.argv.slice(2) : PAGINAS

const browser = await chromium.launch()
const resultados = []
for (const ruta of rutas) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((ms) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
    const siempre = new Proxy({}, { get: () => ms })
    window.__FAKE_RETRASO__ = siempre
    window.__RPC_RETRASO__ = siempre
    window.__saltos = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue
        const fuentes = (e.sources || []).map((s) => {
          const n = s.node
          if (!n || !n.tagName) return '?'
          return `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.classList?.length ? '.' + [...n.classList].slice(0, 2).join('.') : ''}`
        })
        window.__saltos.push({ t: Math.round(e.startTime), v: e.value, fuentes })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  }, RETRASO)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net|images\.pokemontcg/, (r) => setTimeout(() => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }).catch(() => {}), RETRASO))
  await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }).catch(() => {}), RETRASO))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 120)))
  try {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(ESPERA)
    const saltos = await page.evaluate(() => window.__saltos)
    const cls = saltos.reduce((n, s) => n + s.v, 0)
    const porFuente = new Map()
    for (const s of saltos) for (const f of s.fuentes) porFuente.set(f, (porFuente.get(f) || 0) + s.v / Math.max(1, s.fuentes.length))
    const peores = [...porFuente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, v]) => `${f} ${v.toFixed(3)}`)
    resultados.push({ ruta, cls: Number(cls.toFixed(3)), saltos: saltos.length, peores, errores: errores.length })
    console.log(`${cls.toFixed(3).padStart(6)}  ${String(saltos.length).padStart(3)} saltos  ${ruta.padEnd(30)} ${peores.join(' | ')}${errores.length ? `  [${errores.length} errores]` : ''}`)
  } catch (e) {
    console.log(`  ERROR ${ruta}: ${String(e.message).slice(0, 100)}`)
  }
  await ctx.close()
}
await browser.close()
if (process.env.PD_JSON) writeFileSync(process.env.PD_JSON, JSON.stringify(resultados, null, 1))
const total = resultados.reduce((n, r) => n + r.cls, 0)
console.log(`\nSuma: ${total.toFixed(3)} · por encima de 0,1 (lo que Google llama «malo»): ${resultados.filter((r) => r.cls > 0.1).length} de ${resultados.length}`)
