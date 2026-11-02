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

// Seis noticias: más de las que caben al lado del foro (1186).
const masNoticias = () => {
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
  window.__FAKE_NOTICIAS__ = [...(window.__FAKE_NOTICIAS__ || []), ...[5, 6].map((i) => ({ id: `n-extra-${i}`, slug: `extra-${i}`, title: `Noticia de relleno ${i}`, kind: 'news', published_at: hace(200 + i * 24), created_at: hace(200 + i * 24) }))]
}

console.log('── 2. El PC, con cuenta ──')
{
  const ctx = await contexto(b, false, 'user-1', masNoticias)
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
  // 1186: la comunidad ocupa el doble que los retos (sin la clasificación, 2/3).
  check('la última fila: retos y comunidad, a la misma altura, la comunidad el doble', ult.length === 2 && ult[0].y === ult[1].y && ult[0].h === ult[1].h && Math.abs(ult[1].w - 2 * ult[0].w) < 40 && ult[0].y > m.recientesSeccion.y, JSON.stringify(ult))
  const noticias = await page.evaluate(() => {
    const caja = document.getElementById('noticiaPortada')
    const lis = [...caja.querySelectorAll('.pb-noticias-mas li')]
    const vistas = lis.filter((l) => l.style.display !== 'none')
    const abajo = caja.getBoundingClientRect().bottom
    return { total: lis.length, vistas: vistas.length, dentro: vistas.every((l) => l.getBoundingClientRect().bottom <= abajo), sobra: Math.round(abajo - (vistas.at(-1)?.getBoundingClientRect().bottom || 0)) }
  })
  check('las noticias llenan su caja con las que caben, sin cortar ninguna (1186)', noticias.vistas >= 3 && noticias.vistas < noticias.total && noticias.dentro && noticias.sobra < 90, JSON.stringify(noticias))
  // Con la clasificación (en este doble no llega): tres de un tercio.
  await page.evaluate(() => { const s = document.getElementById('clasificacionSeccion'); s.classList.remove('seccion-recogida'); s.style.display = ''; document.getElementById('clasificacion').innerHTML = '<h2>Clasificación</h2>' })
  await page.waitForTimeout(200)
  const t = await medir(page)
  const tres = [t.retoSeccion, t.clasificacionSeccion, t.homeActivity]
  // Con la clasificación: retos ¼, comunidad ½ y clasificación ¼, en ese orden.
  check('  …con la clasificación: retos, comunidad (el doble) y clasificación a la derecha', tres.every(Boolean) && new Set(tres.map((x) => x.y)).size === 1 && tres[0].w === tres[1].w && Math.abs(tres[2].w - 2 * tres[0].w) < 40 && t.homeActivity.x > t.retoSeccion.x && t.clasificacionSeccion.x > t.homeActivity.x, JSON.stringify(tres))
  // De dónde se entra a los retos (1186): la ficha de arriba y la caja de abajo.
  const desde = await page.evaluate(() => {
    const salida = []
    for (const sel of ['.hoy-retos', '#retoTarjetas a[href]']) {
      const a = document.querySelector(sel)
      if (!a) { salida.push('sin ' + sel); continue }
      a.addEventListener('click', (e) => e.preventDefault(), { once: true })
      a.click()
      salida.push(sessionStorage.getItem('pd-desde'))
    }
    return salida
  })
  check('un clic en la ficha de arriba o en la caja de abajo apunta desde dónde (1186)', desde[0] === 'portada-retos-arriba' && desde[1] === 'portada-retos-abajo', desde.join(' | '))
  // …y la visita siguiente lo guarda como su campaña, que /admin ya cuenta.
  await page.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const visita = await page.evaluate(() => (window.__TABLAS__?.page_views || []).map((v) => v.campana).filter(Boolean))
  check('  …y la visita a los retos lo guarda como su campaña, una vez', visita.includes('portada-retos-abajo') && (await page.evaluate(() => sessionStorage.getItem('pd-desde'))) === null, JSON.stringify(visita))
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
