// Tanda 893 — cabeceras de una línea en las once páginas de lista, los
// controles en una fila, el botón principal junto al título y la burbuja
// baja (I1, I2 e I4 de la propuesta «Rápida y limpia»).
//
// Solo cambia el móvil: en el PC las cabeceras siguen como estaban. Lo que
// se mira: que cada una de las once lleve `cab-lista` y su párrafo
// `cab-lema`; que en un iPhone el título quepa en UNA línea, el párrafo no
// se vea y lo primero de la página llegue pronto; que el periodo del meta
// sea un menú junto al título que mueve el selector de abajo; que en Mis
// partidas el botón principal y «Filtrar» se muden (y vuelvan) con la
// pestaña; que en /cartas el catálogo vaya junto al título; y que la
// burbuja mida menos: solo iconos, la activa con su palabra, 44 por hueco.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Las once páginas de lista y, de cada una, dónde está su cabecera y qué
// se ve justo debajo (para medir cuánto baja lo primero de verdad).
const PAGINAS = [
  { ruta: 'cartas', cab: '.mc-hero', lema: '.mc-catalogo-lema', sinClase: true, primero: '.mc-estanteria-barra' },
  { ruta: 'aprender', cab: '.ap-cab', primero: '#categoriesList' },
  { ruta: 'foro', cab: '.foro-cabecera', lema: '#foroSubtitulo', primero: '#foroDestacado, #foroPrincipal' },
  { ruta: 'torneos', cab: '.torneos-heroe', lema: '.torneos-heroe .cab-lema', primero: '#torneoVivo, [data-vista-torneos]' },
  { ruta: 'meta', cab: '.meta-cabecera', lema: '.meta-lema', primero: '.meta-filtros-cab' },
  { ruta: 'retos', cab: '.rt-cabecera', lema: '.rt-cabecera .subtext', primero: '.rt-perfecto' },
  { ruta: 'usuarios', cab: '.page-header', lema: '.page-header .subtext', primero: '.com-cifras' },
  { ruta: 'mis-partidas', cab: '.page-header', lema: '.page-header .cab-lema', primero: '.partidas-mandos' },
  { ruta: 'mazos', cab: '.mz-cabecera', lema: '#mzCuenta', primero: '#mzLista, #mzVacio' },
  { ruta: 'lanzamientos', cab: '.page-header', lema: '.page-header .cab-lema', primero: '.lanz-mandos' },
  { ruta: 'noticias', cab: '.noticias-cabecera-fila', lema: '.noticias-cabecera .cab-lema', primero: '#noticiaTitular, #noticiasRejilla' },
]

console.log('── 1. Lo estático: las once llevan la clase y su párrafo ──')
for (const p of PAGINAS) {
  const html = leer(`${p.ruta === 'cartas' ? 'cartas' : p.ruta}.html`)
  const conClase = new RegExp(`class="[^"]*\\b${p.cab.replace(/^[.#]/, '')}\\b[^"]*cab-lista|class="[^"]*cab-lista[^"]*\\b${p.cab.replace(/^[.#]/, '')}\\b`).test(html)
  // /cartas se genera de mi-coleccion.html y su cabecera (el héroe de Mi
  // colección) no lleva la clase: la estrecha su propia hoja por `data-modo`.
  if (p.sinClase) check(`/${p.ruta}: el título lleva el resto en cab-largo`, /Cartas<span class="cab-largo">/.test(html))
  else check(`/${p.ruta}: la cabecera lleva cab-lista${p.lema ? ' y su párrafo cab-lema' : ''}`, conClase && (!p.lema || /cab-lema/.test(html)))
}
{
  const movil = leer('css/movil.css')
  check('movil.css: cab-lista en una línea (título t-xl, sin párrafo, botón al lado)', /\.cab-lista h1 \{[^}]*font-size: var\(--t-xl\)[^}]*white-space: nowrap/.test(movil) && /\.cab-lema,\s*\.cab-largo \{\s*display: none/.test(movil))
  check('la burbuja: 44 por hueco, iconos de 22 y la palabra escondida para la vista (no para quien escucha)', /\.bm-burbuja-item \{[^}]*min-height: 44px/.test(movil) && /\.bm-burbuja-item:not\(\[aria-current='page'\]\) \.bm-texto \{[^}]*clip: rect/.test(movil) && !/\.bm-texto \{[^}]*display: none/.test(movil))
  check('cartas.html es lo que sale del generador (título «Cartas» + resto largo)', /<h1 id="mcTitulo">Cartas<span class="cab-largo"> de Pokémon TCG<\/span><\/h1>/.test(leer('cartas.html')) && /Cartas<span class="cab-largo">/.test(leer('generar-cartas.mjs')))
  check('style/components no cambian: el PC no se toca', !/cab-lista/.test(leer('css/style.css')) && !/cab-lista/.test(leer('css/components.css')))
  check('partidas: el nombre de la fila de mandos no pisa `.partidas-fila` (la fila de una partida)', /\.partidas-mandos \{/.test(leer('css/partidas.css')) && !/class="partidas-fila">\s*<div class="seg/.test(leer('mis-partidas.html')))
}

const b = await chromium.launch()
const nuevoMovil = async () => {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => { try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  return ctx
}
const abrir = async (ctx, ruta) => {
  const p = await ctx.newPage()
  await p.goto(`${BASE}/${ruta}.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1600)
  return p
}
const vis = (p, sel) => p.locator(sel).first().isVisible().catch(() => false)

console.log('\n── 2. En el iPhone: una línea, sin párrafo, y lo primero pronto ──')
{
  const ctx = await nuevoMovil()
  for (const pg of PAGINAS) {
    const p = await abrir(ctx, pg.ruta)
    const r = await p.evaluate(({ cab, lema, primero }) => {
      const h1 = document.querySelector('h1')
      const rh = h1.getBoundingClientRect()
      const caja = document.querySelector(cab)?.getBoundingClientRect()
      const pri = [...document.querySelectorAll(primero)].find((x) => x.getBoundingClientRect().height > 0)
      const tam = parseFloat(getComputedStyle(h1).fontSize)
      const xl = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-xl')) * parseFloat(getComputedStyle(document.documentElement).fontSize)
      const lemaVisible = lema ? [...document.querySelectorAll(lema)].some((x) => x.getBoundingClientRect().height > 0) : false
      return { h1: h1.textContent.trim(), alto: Math.round(rh.height), tam, xl, cabAbajo: caja ? Math.round(caja.bottom) : null, primeroArriba: pri ? Math.round(pri.getBoundingClientRect().top) : null, lemaVisible, vh: innerHeight }
    }, pg)
    check(`/${pg.ruta}: «${r.h1}» en una línea (${r.alto} px) a t-xl, sin párrafo, y lo primero antes del 25 % de la pantalla`, r.alto <= 32 && Math.abs(r.tam - r.xl) < 0.5 && !r.lemaVisible && r.primeroArriba !== null && r.primeroArriba <= r.vh * 0.25, JSON.stringify(r))
    await p.close()
  }
  await ctx.close()
}

console.log('\n── 3. El meta: el periodo es un menú junto al título ──')
{
  const ctx = await nuevoMovil()
  const p = await abrir(ctx, 'meta')
  check('en el móvil se ve el menú y no el selector de abajo; las cuatro fuentes caben en la fila', (await vis(p, '#metaPeriodoMenu')) && !(await vis(p, '#metaPeriodo')) && (await p.$$eval('#metaFuente .seg-btn', (bs) => bs.every((b) => b.getBoundingClientRect().right <= innerWidth && b.getBoundingClientRect().height >= 40))))
  const antes = await p.$eval('#metaPeriodoMenu', (m) => m.value)
  await p.selectOption('#metaPeriodoMenu', '90')
  await p.waitForTimeout(300)
  const despues = await p.evaluate(() => ({ url: location.search, pulsado: document.querySelector('#metaPeriodo [aria-pressed="true"]')?.dataset.dias, menu: document.getElementById('metaPeriodoMenu').value }))
  check('elegir «90 días» en el menú pulsa el botón de abajo y escribe ?dias=90', antes !== '90' && despues.pulsado === '90' && /dias=90/.test(despues.url) && despues.menu === '90', JSON.stringify(despues))
  await p.close()
  const pc = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  const q = await pc.newPage()
  await q.goto(`${BASE}/meta.html`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(1200)
  check('en el PC, al revés: el selector de abajo y el lema, y el menú no', (await vis(q, '#metaPeriodo')) && (await vis(q, '.meta-lema')) && !(await vis(q, '#metaPeriodoMenu')))
  await pc.close()
  await ctx.close()
}

console.log('\n── 4. Mis partidas: el botón principal se muda con la pestaña ──')
{
  const ctx = await nuevoMovil()
  const p = await abrir(ctx, 'mis-partidas')
  const donde = () => p.evaluate(() => ({
    torneo: document.getElementById('btnApuntarTorneo')?.parentElement.id,
    partida: document.getElementById('btnApuntarPartida')?.parentElement.className,
    filtrarT: document.getElementById('torneoFiltrar')?.parentElement.id,
    filtrarL: document.getElementById('listaFiltrar')?.parentElement.id,
    mandosCaben: document.querySelector('.partidas-mandos').scrollWidth <= document.querySelector('.partidas-mandos').clientWidth + 1,
    filtrarPalabra: document.querySelector('#torneoFiltrar .cab-palabra')?.getBoundingClientRect().width || 0,
  }))
  let r = await donde()
  check('al abrir: «Apuntar un torneo» junto al título, «Filtrar» (solo icono) en la fila de pestañas, y todo cabe sin deslizar', r.torneo === 'partidasAcciones' && r.filtrarT === 'partidasMandosExtra' && r.partida === 'partidas-barra' && r.mandosCaben && r.filtrarPalabra === 0, JSON.stringify(r))
  await p.click('#partidasTabs [data-vista="sueltas"]')
  await p.waitForTimeout(200)
  r = await donde()
  check('en «Partidas»: el de apuntar una partida sube y el de torneos vuelve a su barra', r.partida === 'cab-acciones' && r.torneo === 'vista-torneos' + '' || (r.torneo !== 'partidasAcciones' && r.filtrarL === 'partidasMandosExtra' && r.filtrarT !== 'partidasMandosExtra'), JSON.stringify(r))
  await p.click('#partidasTabs [data-vista="stats"]')
  await p.waitForTimeout(200)
  r = await donde()
  check('en «Estadísticas» no hay botón junto al título y el hueco no ocupa', r.torneo !== 'partidasAcciones' && r.partida === 'partidas-barra' && (await p.$eval('#partidasAcciones', (x) => getComputedStyle(x).display === 'none')), JSON.stringify(r))
  await p.close()
  const pc = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  const q = await pc.newPage()
  await q.goto(`${BASE}/mis-partidas.html`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(1200)
  check('en el PC nada se mueve: los botones en sus barras, con la palabra «Filtrar»', (await q.$eval('#btnApuntarTorneo', (x) => x.parentElement.className)) === 'partidas-barra' && (await q.$eval('#torneoFiltrar .cab-palabra', (x) => x.getBoundingClientRect().width > 10)))
  await pc.close()
  await ctx.close()
}

console.log('\n── 5. /cartas: el catálogo junto al título; la comunidad: cifras en una línea ──')
{
  const ctx = await nuevoMovil()
  const p = await abrir(ctx, 'cartas')
  const r = await p.evaluate(() => {
    const quien = document.querySelector('.mc-hero-quien')
    const seg = quien.querySelector('.seg')
    const h1 = document.querySelector('#mcTitulo')
    return { segEnTitulo: !!seg, botones: seg ? seg.querySelectorAll('.seg-btn').length : 0, segAlto: seg ? Math.round(seg.getBoundingClientRect().height) : 0, cabe: seg ? seg.getBoundingClientRect().right <= innerWidth : false, tituloAncho: Math.round(h1.getBoundingClientRect().width), mandos: getComputedStyle(document.querySelector('.mc-estanteria-barra')).flexWrap }
  })
  check('el catálogo (dos botones con bandera) va a la derecha de «Cartas», en una sola fila de pill', r.segEnTitulo && r.botones === 2 && r.segAlto <= 52 && r.cabe && r.tituloAncho < 120, JSON.stringify(r))
  check('  …y los mandos de la estantería van en una fila que se desliza', r.mandos === 'nowrap')
  await p.close()
  const u = await abrir(ctx, 'usuarios')
  const c = await u.$$eval('.com-cifra', (cs) => cs.map((x) => Math.round(x.getBoundingClientRect().top)))
  check('las cuatro cifras de la comunidad en UNA línea, sin las palabras largas', c.length === 4 && new Set(c).size === 1 && (await u.$eval('.com-cifra .cab-largo', (x) => x.getBoundingClientRect().width === 0)), c.join())
  await u.close()
  await ctx.close()
}

console.log('\n── 6. La burbuja baja ──')
{
  const ctx = await nuevoMovil()
  const p = await abrir(ctx, 'torneos')
  const r = await p.evaluate(() => {
    const bu = document.querySelector('.bm-burbuja')
    const items = [...bu.querySelectorAll('.bm-burbuja-item')]
    const palabraVisible = (a) => { const t = a.querySelector('.bm-texto'); const rr = t.getBoundingClientRect(); return rr.width > 2 && rr.height > 2 }
    return { alto: Math.round(bu.getBoundingClientRect().height), huecos: items.map((a) => ({ w: Math.round(a.getBoundingClientRect().width), h: Math.round(a.getBoundingClientRect().height), activa: a.getAttribute('aria-current') === 'page', palabra: palabraVisible(a), nombre: a.textContent.trim() })), bottom: Math.round(bu.getBoundingClientRect().bottom), barraTop: Math.round(document.querySelector('.bm').getBoundingClientRect().top) }
  })
  check(`la burbuja mide ${r.alto} px (antes 62): cada hueco 44 o más, solo la activa enseña su palabra, las demás solo el icono (pero conservan el nombre)`, r.alto <= 52 && r.huecos.every((h) => h.w >= 44 && h.h >= 44 && h.nombre) && r.huecos.filter((h) => h.palabra).length === 1 && r.huecos.find((h) => h.activa)?.palabra, JSON.stringify(r))
  check('  …y sigue flotando justo encima de la barra', r.bottom <= r.barraTop && r.bottom >= r.barraTop - 24, JSON.stringify({ bottom: r.bottom, barraTop: r.barraTop }))
  await p.close()
  const m = await abrir(ctx, 'mi-coleccion?ver=album')
  const mc = await m.evaluate(() => { const ps = [...document.querySelectorAll('.mc-pestania')]; return ps.map((x) => ({ h: Math.round(x.getBoundingClientRect().height), activa: x.classList.contains('activa'), palabra: (x.querySelector('.mc-menu-texto')?.getBoundingClientRect().width || 0) > 2 })) })
  check('la de Mi colección va igual: 44 de alto, y la palabra solo en la activa', mc.length >= 5 && mc.every((x) => x.h >= 44 && x.h <= 48) && mc.filter((x) => x.palabra).length === 1 && mc.find((x) => x.activa)?.palabra, JSON.stringify(mc))
  await m.close()
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
