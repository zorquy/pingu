// Tanda 1358 — «Jugar en tres» (PINGU: «me gusta la propuesta, dale»). Jugar
// pasa de siete páginas a tres en el menú: Torneos, Mazos (/meta, /mazos,
// /laboratorio con sus pestañas Meta · Los míos · Probar) y Partidas
// (/mis-partidas y /repeticiones). El constructor sale del menú y es una
// ficha. Cada mazo tuyo lleva Editar, Probar y «A un torneo».
import { readFileSync, readdirSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. El menú y lo puro ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && /class="nav-grupo nav-jugar/.test(leer(f)))
  const mal = paginas.filter((f) => {
    const s = leer(f)
    const sub = s.match(/<div class="nav-grupo nav-jugar[\s\S]*?<div class="nav-sub">([\s\S]*?)<\/div>/)?.[1] || ''
    const movil = s.match(/<details class="nav-menu-grupo nav-jugar[\s\S]*?<\/details>/)?.[0] || ''
    const tres = (t) => [...t.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => `${m[1]}:${m[2]}`).join('|') === '/torneos.html:Torneos|/meta:Mazos|/mis-partidas:Partidas'
    return !tres(sub) || !tres(movil)
  })
  check(`las ${paginas.length} páginas con menú llevan Torneos, Mazos y Partidas (arriba y en el del móvil)`, paginas.length >= 40 && !mal.length, mal.join(', '))
  const { cubrePagina, HERMANAS } = await import(`${RAIZ}/js/barra-movil.js`)
  check('Mazos cubre /meta, /mazos y /laboratorio; Partidas, /mis-partidas y /repeticiones', ['meta', 'mazos', 'laboratorio'].every((k) => cubrePagina('/meta', k)) && ['mis-partidas', 'repeticiones'].every((k) => cubrePagina('/mis-partidas', k)) && !cubrePagina('/meta', 'constructor') && !cubrePagina('/meta', 'mazo-meta'), JSON.stringify(HERMANAS))
  check('el constructor es una ficha (data-detalle) y las de Mazos y Partidas no', /<html[^>]*data-detalle/.test(leer('constructor.html')) && ['meta', 'mazos', 'laboratorio', 'mis-partidas', 'repeticiones'].every((f) => !/<html[^>]*data-detalle/.test(leer(`${f}.html`))))
}

const b = await chromium.launch()
const errores = []
async function abrir(ruta, movil) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(`${ruta}: ${String(e).slice(0, 160)}`))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx }
}
const pestanas = (page) => page.evaluate(() => [...document.querySelectorAll('.jugar-pestanas a')].map((a) => a.textContent.trim() + (a.getAttribute('aria-current') ? '*' : '')).join('|'))

console.log('── 2. En el móvil: la burbuja y las pestañas ──')
for (const [ruta, burbuja, filas] of [
  ['/meta', 'Torneos|Mazos*|Partidas', 'Meta*|Los míos|Probar'],
  ['/mazos', 'Torneos|Mazos*|Partidas', 'Meta|Los míos*|Probar'],
  ['/laboratorio', 'Torneos|Mazos*|Partidas', 'Meta|Los míos|Probar*'],
  ['/repeticiones', 'Torneos|Mazos|Partidas*', 'Torneos|Partidas|Estadísticas|Repeticiones*'],
]) {
  const { page, ctx } = await abrir(ruta, true)
  const r = await page.evaluate(() => ({
    burbuja: [...document.querySelectorAll('.bm-burbuja a')].map((a) => a.textContent.trim() + (a.getAttribute('aria-current') ? '*' : '')).join('|'),
    ancho: document.documentElement.scrollWidth,
    cabe: [...document.querySelectorAll('.jugar-pestanas a')].every((a) => a.scrollWidth <= a.clientWidth + 1),
  }))
  check(`${ruta}: burbuja ${burbuja}`, r.burbuja === burbuja, r.burbuja)
  check(`  …pestañas ${filas}, sin cortar ni desbordar`, (await pestanas(page)) === filas && r.cabe && r.ancho <= 390, JSON.stringify({ p: await pestanas(page), ...r }))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mis-partidas', true)
  const r = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#partidasTabs .seg-btn')].map((x) => x.textContent.trim()), rep: document.querySelector('#partidasTabs a.seg-btn')?.getAttribute('href') }))
  check('/mis-partidas: «Repeticiones» es su cuarta pestaña, y va a /repeticiones', r.tabs.length === 4 && r.tabs[3] === 'Repeticiones' && r.rep === '/repeticiones', JSON.stringify(r))
  await page.locator('#partidasTabs .seg-btn[data-vista="stats"]').click()
  check('  …y las otras tres siguen cambiando de vista sin salir', /ver=stats/.test(page.url()) && (await page.locator('#vista-stats.active').count()) === 1, page.url())
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/constructor', true)
  const r = await page.evaluate(() => ({ burbuja: document.querySelectorAll('.bm-burbuja').length, volver: document.querySelector('.bm-cab-titulo small')?.textContent.trim() }))
  check('/constructor en el móvil: sin burbuja, con la flecha a «Los míos»', r.burbuja === 0 && r.volver === 'Los míos', JSON.stringify(r))
  await ctx.close()
}

console.log('── 3. En el PC: el lateral ──')
for (const [ruta, marcada] of [['/laboratorio', 'Mazos'], ['/repeticiones', 'Partidas'], ['/torneos.html', 'Torneos']]) {
  const { page, ctx } = await abrir(ruta, false)
  const r = await page.evaluate(() => ({ hijos: [...document.querySelectorAll('.lat-seccion.lat-activa .lat-paginas a, .lat-activa li a')].map((a) => a.textContent.trim()), marcada: [...document.querySelectorAll('.lat a[aria-current]')].map((a) => a.textContent.trim()) }))
  check(`${ruta}: Jugar abre Torneos, Mazos y Partidas, con «${marcada}» marcada`, [...new Set(r.hijos)].join('|') === 'Torneos|Mazos|Partidas' && r.marcada.join() === marcada, JSON.stringify(r))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/laboratorio', false)
  const r = await page.evaluate(() => { const n = document.querySelector('.jugar-pestanas').getBoundingClientRect(); const b = document.querySelector('.lp-bloque').getBoundingClientRect(); return { alto: Math.round(n.height), encima: n.bottom <= b.top } })
  check('/laboratorio: las pestañas en su fila, encima de los tres pasos (no dentro de la rejilla)', r.alto <= 52 && r.encima, JSON.stringify(r))
  await ctx.close()
}

console.log('── 4. Cada mazo: Editar, Probar y «A un torneo» ──')
{
  const { page, ctx } = await abrir('/mazos', false)
  const botones = await page.evaluate(() => [...document.querySelectorAll('.cm-mazo-tarjeta')][0] ? [...document.querySelectorAll('.cm-mazo-tarjeta')[0].querySelectorAll('.cm-mazo-pie > a.cm-btn')].map((a) => a.textContent.trim()) : [])
  check('la tarjeta lleva Editar, Probar y A un torneo a la vista', botones.join('|') === 'Editar|Probar|A un torneo', botones.join('|'))
  const nombre = await page.locator('.cm-mazo-tarjeta .cm-mazo-nombre').first().innerText()
  await Promise.all([page.waitForURL(/torneos/), page.locator('.cm-mazo-tarjeta [data-a-torneo]').first().click()])
  await page.waitForTimeout(2000)
  const linea = await page.evaluate(() => { const c = document.getElementById('torneosMazoElegido'); return c && !c.hidden ? c.textContent.trim() : null })
  check('«A un torneo» lleva a /torneos, que dice qué mazo llevas', linea && linea.includes(nombre.trim()) && /al inscribirte, su lista va puesta/.test(linea), linea)
  await page.locator('#torneosMazoElegido button').click()
  const quitado = await page.evaluate(() => ({ oculta: document.getElementById('torneosMazoElegido').hidden, guardado: sessionStorage.getItem('pd-mazo-a-torneo') }))
  check('  …y «Quitar» lo olvida', quitado.oculta && quitado.guardado === null, JSON.stringify(quitado))
  await ctx.close()
}
check('la ficha del torneo pone la lista del mazo pedido (cargarMazo → ponerMazoEnLista) y borra el pedido', /pd-mazo-a-torneo[\s\S]{0,400}cargarMazo\(pedido\)\)\.then\(ponerMazoEnLista\)/.test(leer('js/torneos/torneo.js')) && /removeItem\('pd-mazo-a-torneo'\)/.test(leer('js/torneos/torneo.js')))

check('sin errores', !errores.length, errores.join(' | '))
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
