// Tanda 1185 — «Una portada que cuadra» (PINGU eligió la A). Debajo de las
// cinco tarjetas, la portada va en FILAS: foro y noticias juntos (2/3 y 1/3),
// Aprende a lo ancho con cuatro guías iguales y «Escribe una guía» en su
// cabecera, y retos, clasificación y comunidad en la última fila. Las cajas
// de una fila miden lo mismo. En el móvil, el mismo contenido en una columna
// y las guías en una tira que se desliza.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const medir = (page) => page.evaluate(() => {
  const caja = (id) => { const s = document.getElementById(id); if (!s || getComputedStyle(s).display === 'none') return null; const r = s.getBoundingClientRect(); const h = s.firstElementChild?.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), hDentro: h ? Math.round(h.height) : 0 } }
  return Object.fromEntries(['sigueSeccion', 'torneoPortadaSeccion', 'lanzamientoSeccion', 'foroVivoSeccion', 'noticiaPortadaSeccion', 'recientesSeccion', 'primerosPasos', 'retoSeccion', 'clasificacionSeccion', 'homeActivity'].map((id) => [id, caja(id)]))
})

const b = await chromium.launch()
console.log('── 1. Aprende (en el navegador: el módulo arrastra app.js) ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const B = await import('/js/portada-bloques.js')
    const guias = [1, 2, 3, 4, 5].map((i) => ({ id: `g${i}`, slug: `g${i}`, title: `Guía ${i}`, description: 'Una descripción larga', kind: 'guide' }))
    return { con: B.aprendeHtml({ guias, escribir: true }), sin: B.aprendeHtml({ guias, escribir: false }) }
  })
  check('cuatro tarjetas iguales, sin grande ni lista aparte', (r.con.match(/class="guia-tarjeta"/g) || []).length === 4 && !/pb-aprende-grande|pb-aprende-lista/.test(r.con))
  check('«Escribe una guía» en la cabecera, con cuenta', /class="pb-escribir" href="\/editor-guia.html"/.test(r.con) && r.con.indexOf('pb-escribir') < r.con.indexOf('pb-temas'))
  check('  …y sin cuenta, no', !/pb-escribir/.test(r.sin))
  await ctx.close()
}

console.log('── 2. El PC, con cuenta ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#aprende .guia-tarjeta', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const m = await medir(page)
  const ancho = m.recientesSeccion?.w
  check('Aprende ocupa todo el ancho', ancho > 1000 && m.sigueSeccion?.w === ancho, JSON.stringify({ ancho, sigue: m.sigueSeccion?.w }))
  check('foro y noticias en la misma fila, 2/3 y 1/3', m.foroVivoSeccion.y === m.noticiaPortadaSeccion.y && Math.abs(m.foroVivoSeccion.w - 2 * m.noticiaPortadaSeccion.w) < 40, JSON.stringify([m.foroVivoSeccion, m.noticiaPortadaSeccion]))
  check('  …y miden lo mismo, también la caja de dentro', m.foroVivoSeccion.h === m.noticiaPortadaSeccion.h && Math.abs(m.noticiaPortadaSeccion.hDentro - m.noticiaPortadaSeccion.h) <= 1, JSON.stringify([m.foroVivoSeccion, m.noticiaPortadaSeccion]))
  check('Aprende debajo de esa fila', m.recientesSeccion.y > m.foroVivoSeccion.y + m.foroVivoSeccion.h)
  const guias = await page.$$eval('#aprende .guia-tarjeta', (gs) => gs.map((g) => { const r = g.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width), Math.round(r.height)] }))
  check('cuatro guías en una fila, todas del mismo tamaño', guias.length === 4 && new Set(guias.map((g) => g[0])).size === 1 && new Set(guias.map((g) => g[1])).size === 1 && Math.max(...guias.map((g) => g[2])) - Math.min(...guias.map((g) => g[2])) <= 2, JSON.stringify(guias))
  const desc = await page.$eval('#aprende .guia-desc', (d) => Math.round(d.getBoundingClientRect().height / parseFloat(getComputedStyle(d).lineHeight)))
  check('  …con la descripción en dos líneas como mucho', desc <= 2, desc)
  check('«Escribe una guía» en la cabecera de Aprende y no en una caja suelta', (await page.locator('#aprende .pb-escribir').count()) === 1 && m.lanzamientoSeccion === null)
  const ult = [m.retoSeccion, m.homeActivity].filter(Boolean)
  check('la última fila: retos y comunidad, a la misma altura y del mismo alto', ult.length === 2 && ult[0].y === ult[1].y && ult[0].h === ult[1].h && ult[0].w === ult[1].w && ult[0].y > m.recientesSeccion.y, JSON.stringify(ult))
  // Con la clasificación (en este doble no llega): tres de un tercio.
  await page.evaluate(() => { const s = document.getElementById('clasificacionSeccion'); s.classList.remove('seccion-recogida'); s.style.display = ''; document.getElementById('clasificacion').innerHTML = '<h2>Clasificación</h2>' })
  await page.waitForTimeout(200)
  const t = await medir(page)
  const tres = [t.retoSeccion, t.clasificacionSeccion, t.homeActivity]
  check('  …con la clasificación, tres cajas iguales de un tercio', tres.every(Boolean) && new Set(tres.map((x) => x.y)).size === 1 && new Set(tres.map((x) => x.w)).size === 1 && Math.abs(tres[0].w * 3 - ancho) < 80 && t.clasificacionSeccion.x > t.retoSeccion.x && t.homeActivity.x > t.clasificacionSeccion.x, JSON.stringify(tres))
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('sin desbordar a lo ancho', sobra <= 0, sobra)
  await page.screenshot({ path: '/tmp/1185-pc.png', fullPage: true })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. El móvil ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#aprende .guia-tarjeta', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const tira = await page.evaluate(() => {
    const t = document.querySelector('#aprende .pb-aprende-cuatro')
    const gs = [...t.querySelectorAll('.guia-tarjeta')].map((g) => g.getBoundingClientRect())
    return { desliza: getComputedStyle(t).overflowX === 'auto' && t.scrollWidth > t.clientWidth, enFila: new Set(gs.map((g) => Math.round(g.top))).size === 1, alto: Math.round(t.getBoundingClientRect().height), sobra: document.documentElement.scrollWidth - innerWidth }
  })
  check('las guías en una tira que se desliza, en una fila', tira.desliza && tira.enFila, JSON.stringify(tira))
  check('  …y Aprende no ocupa una pantalla entera', tira.alto < 420, tira.alto)
  check('sin desbordar la página a lo ancho', tira.sobra <= 0, tira.sobra)
  await page.locator('#recientesSeccion').screenshot({ path: '/tmp/1185-movil-aprende.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Sin cuenta, el próximo lanzamiento y el torneo comparten fila ──')
{
  const ctx = await contexto(b, false, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const m = await medir(page)
  const dos = [m.torneoPortadaSeccion, m.lanzamientoSeccion].filter(Boolean)
  check('lo que haya de los dos, sin huecos', dos.length === 2 ? dos[0].y === dos[1].y && dos[0].w === dos[1].w : dos.length === 1 ? dos[0].w === m.recientesSeccion?.w || dos[0].w > 1000 : true, JSON.stringify(dos))
  check('sin «Escribe una guía» en Aprende', (await page.locator('#aprende .pb-escribir').count()) === 0)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
