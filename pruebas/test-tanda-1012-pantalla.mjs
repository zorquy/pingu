// Tanda 1012 — la portada en el móvil, de la propuesta del repaso: P1 el
// bloque de retos se queda en la línea «Empieza por…» (los seis ya están en
// la ficha de «Hoy»), P2 textos de las fichas pensados para dos columnas y a
// dos líneas si no caben, P3 el orden: Hoy → retos → torneo → Sigue → foro →
// noticia → Aprende → Primeros pasos → lanzamiento → comunidad.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const { fichasHtml, nombreCorto } = await import(`${RAIZ}/js/hoy.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  check('P2: el nombre del torneo sin corchetes ni paréntesis', nombreCorto('Liga FDN [Oct–Dic]') === 'Liga FDN' && nombreCorto('Copa Delta Reign (online)') === 'Copa Delta Reign' && nombreCorto('Liga FDN') === 'Liga FDN' && nombreCorto('[solo]') === '[solo]', nombreCorto('Liga FDN [Oct–Dic]'))
  const AHORA = Date.parse('2026-10-25T12:00:00Z')
  const h = fichasHtml({ torneo: { slug: 'liga', name: 'Liga FDN [Oct–Dic]', start_at: '2026-10-30T18:00:00Z', jornada: 3 } }, AHORA)
  check('  …y la ficha dice «Liga FDN · jornada 3»', /<span>Liga FDN · jornada 3<\/span>/.test(h), h.match(/<span>[^<]*jornada[^<]*<\/span>/)?.[0])
  check('  …y la de retos sin saber lo de hoy, «quedan N h» a secas', /<span>quedan \d+ h<\/span>/.test(fichasHtml({ retos: null }, AHORA)))
}

const b = await chromium.launch()
async function abrir(sesion) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-ES', serviceWorkers: 'block', isMobile: true, hasTouch: true })
  await ctx.addInitScript((sesion) => { window.__FAKE_SESSION__ = sesion }, sesion)
  await ctx.route(/images\.tcggo\.com|assets\.tcgdex\.net|r2\.limitlesstcg\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  return { p, ctx, errores }
}

console.log('\n── 2. En el móvil, con cuenta ──')
{
  const { p, ctx, errores } = await abrir('user-1')
  check('sin errores', !errores.length, errores.join(' | '))
  const r = await p.evaluate(() => {
    const vis = (sel) => { const el = document.querySelector(sel); return !!el && el.getClientRects().length > 0 }
    return { cabeza: vis('.tr-cabeza'), gente: vis('.tr-gente'), siguiente: vis('.tr-siguiente'), texto: document.querySelector('.tr-siguiente')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) }
  })
  check('P1: del bloque de retos solo queda la línea del siguiente («Empieza por…»), sin la cabecera de los seis', r.siguiente && !r.cabeza && !r.gente && /(Empieza por|El siguiente|Día perfecto)/.test(r.texto || ''), JSON.stringify(r))
  const fichas = await p.$$eval('#hoyPortada .hoy-ficha > span:not(.hoy-ficha-icono):not(.hoy-ficha-logo):not(.hoy-retos-anillo)', (xs) => xs.map((x) => ({ t: x.textContent.trim(), cortada: x.scrollWidth > x.clientWidth + 1, lineas: Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight)), clamp: getComputedStyle(x).webkitLineClamp })))
  check('P2: ningún detalle de las fichas se corta con puntos suspensivos; cabe en una o dos líneas', fichas.length >= 3 && fichas.every((f) => !f.cortada && f.lineas <= 2 && f.clamp === '2'), JSON.stringify(fichas))
  const orden = await p.evaluate(() => Object.fromEntries(['retoSeccion', 'torneoPortadaSeccion', 'sigueSeccion', 'foroVivoSeccion', 'noticiaPortadaSeccion', 'recientesSeccion', 'primerosPasos', 'lanzamientoSeccion', 'clasificacionSeccion', 'homeActivity'].map((id) => [id, Number(getComputedStyle(document.getElementById(id)).order)])))
  const ids = Object.keys(orden)
  check('P3: el orden del móvil es retos → torneo → Sigue → foro → noticia → Aprende → Primeros pasos → lanzamiento → clasificación → comunidad', ids.every((id, i) => i === 0 || orden[id] > orden[ids[i - 1]]), JSON.stringify(orden))
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('  …y nada se sale de la pantalla', sale <= 1, `${sale}px`)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
