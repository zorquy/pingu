// Tanda 917 — Los botones, en tres clases (la parte 3 de la propuesta
// «PokeDoc más sencillo», aprobada por PINGU: «todo lo demás está muy bien»).
//   · Principal: relleno de azul (`.btn-primary`), como estaba.
//   · Suave: fondo `--ice` y sin borde — `.btn-secondary` y `.btn-outline`,
//     el Cardmarket de las tarjetas de precio y el enlace SUELTO (`.link-btn`
//     que no va dentro de una frase). El borde queda transparente para que
//     nada cambie de medida.
//   · Icono: el círculo de 44 px de las fichas (`.mc-ficha-redondo`).
// Un `.link-btn` dentro de un párrafo sigue siendo un enlace subrayado.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

console.log('── 1. Lo estático ──')
{
  const st = leer('css/style.css')
  check('secundario y de borde son el mismo «suave»: fondo --ice, borde transparente', /\.btn-secondary,\s*\.btn-outline \{\s*background: var\(--ice\);\s*color: var\(--navy\);\s*border: 1px solid transparent;/.test(st))
  check('  …y ya no hay otro estilo para cada uno', !/\.btn-outline \{\s*background: transparent;/.test(st) && !/\.btn-secondary \{\s*background: var\(--white\);/.test(st))
  const co = leer('css/components.css')
  check('el enlace suelto es suave; dentro de una frase, no', /\.link-btn:where\(:not\(:is\(p, \.subtext, td\) \.link-btn\)\) \{[^}]*background: var\(--ice\);[^}]*text-decoration: none;/.test(co))
  check('  …y con el dedo mide 44', /@media \(pointer: coarse\) \{\s*\.link-btn:where\(:not\(:is\(p, \.subtext, td\) \.link-btn\)\) \{ min-height: 44px; \}/.test(co))
}

const browser = await chromium.launch()
async function abrir(ruta, { oscuro = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((oscuro) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); if (oscuro) localStorage.setItem('pokedoc-theme', 'dark') } catch {}
    window.__FAKE_SETS__ = [{ id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me', market: 'WEST', release_date: '2026-01-30', card_count_official: 217 }]
    window.__FAKE_CARTAS__ = [{ id: 'me2pt5-159', market: 'WEST', set_id: 'me2pt5', local_id: '159', name: 'Drakloak', name_es: 'Drakloak', image_path: 'me/me2pt5/159', rarity: 'Uncommon', category: 'Pokemon', dex_ids: [886], variants: { normal: true }, tcg_sets: { id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me' } }]
    window.__FAKE_PRECIOS__ = [{ card_id: 'me2pt5-159', cm_id_product: 869770, cm_low_es: 0.12, cm_low_en: 0.05, checked_at: new Date().toISOString() }]
  }, oscuro)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
const fondoIce = (page) => page.evaluate(() => {
  const d = document.createElement('i')
  d.style.background = 'var(--ice)'
  document.body.appendChild(d)
  const c = getComputedStyle(d).backgroundColor
  d.remove()
  return c
})

console.log('── 2. Los de borde de la 404, suaves ──')
{
  const { page, ctx, errores } = await abrir('/404.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const ice = await fondoIce(page)
  const r = await page.$$eval('.btn-outline', (bs) => bs.map((b) => { const c = getComputedStyle(b); return { fondo: c.backgroundColor, borde: c.borderTopColor, ancho: c.borderTopWidth } }))
  check('los tres de «Ver las guías, Ir al foro, Volver» van en --ice y con el borde transparente (1 px: no cambian de medida)', r.length === 3 && r.every((x) => x.fondo === ice && /rgba\(0, 0, 0, 0\)|transparent/.test(x.borde) && x.ancho === '1px'), JSON.stringify({ ice, r }))
  await ctx.close()
}

console.log('── 3. En /carta: suelto suave, en una frase subrayado ──')
{
  const { page, ctx, errores } = await abrir('/carta.html?id=me2pt5-159')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const ice = await fondoIce(page)
  const r = await page.evaluate(() => {
    const c = document.getElementById('cmComparar')
    const pie = document.querySelector('.carta-mercado-pie .link-btn')
    const cm = document.querySelectorAll('#cmPrecios .btn-cardmarket, #cmPrecios .pv-botones').length
    const cs = (e) => e && getComputedStyle(e)
    return {
      comparar: c && { fondo: cs(c).backgroundColor, subr: cs(c).textDecorationLine, ancho: Math.round(c.getBoundingClientRect().width), caja: Math.round(c.parentElement.getBoundingClientRect().width) },
      pie: pie && { fondo: cs(pie).backgroundColor, subr: cs(pie).textDecorationLine },
      cm,
    }
  })
  check('«Comparar con otra carta» es un botón suave, sin subrayar y de su ancho (no a lo ancho de la columna)', r.comparar && r.comparar.fondo === ice && r.comparar.subr === 'none' && r.comparar.ancho < r.comparar.caja / 2, JSON.stringify(r))
  // Desde la 926 (la A de la propuesta: «Todas las cartas de…», «Comparar» y
  // «Quién la da» como botones suaves en una fila) ya no va en un párrafo.
  check('«Todas las cartas de Drakloak» es un botón suave en la fila de Comparar (926)', r.pie && r.pie.subr === 'none' && r.pie.fondo === ice, JSON.stringify(r.pie))
  check('y debajo de las tarjetas ya no hay botón de Cardmarket (920: la tarjeta es el enlace)', r.cm === 0, String(r.cm))
  await ctx.close()
}

console.log('── 4. En oscuro ──')
{
  const { page, ctx } = await abrir('/404.html', { oscuro: true })
  const r = await page.evaluate(() => ({ tema: document.documentElement.dataset.theme, fondo: getComputedStyle(document.querySelector('.btn-outline')).backgroundColor, pagina: getComputedStyle(document.body).backgroundColor }))
  check('el suave se distingue del fondo de la página también en oscuro', r.tema === 'dark' && r.fondo !== r.pagina, JSON.stringify(r))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
