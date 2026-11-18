// Tanda 1366 — «Colección en cuatro» y «Pestañas con iconos» (PINGU: «dale
// con lo recomendado»). El menú de Mi colección pasa a Panel · Cartas ·
// Cambios · Buscar; Expansiones, Pokédex, Álbumes y Productos son las
// pestañas de Cartas (una fila que se muda a la pantalla abierta y no sale
// dentro de un nivel). Las filas de Cartas, Mazos y Partidas llevan icono
// «como la burbuja»: en el móvil, iconos y la puesta con nombre.
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Lo escrito ──')
{
  const menu = leer('mi-coleccion.html').match(/<nav class="mc-pestanias mc-menu" id="mcMenu"[\s\S]*?<\/nav>/)[0]
  const botones = [...menu.matchAll(/data-pestania="([^"]+)"/g)].map((m) => m[1]).join('|')
  check('el menú de Mi colección son cuatro: resumen, album, mercado, buscar', botones === 'resumen|album|mercado|buscar', botones)
  check('  …«Cartas» se enciende también en Pokédex, Álbumes y Productos', /data-pestania="album" data-tambien="pokedex carpetas productos"[^>]*><span class="mc-menu-texto">Cartas</.test(menu))
  const cartas = leer('cartas.html')
  check('/cartas no lleva la fila de Cartas y sigue con sus tres', !cartas.includes('mcCartasPestanas') && [...cartas.match(/<nav class="mc-pestanias mc-menu"[\s\S]*?<\/nav>/)[0].matchAll(/data-pestania="([^"]+)"/g)].map((m) => m[1]).join('|') === 'album|productos|buscar')
  const { generarCartas } = await import(`${RAIZ}/generar-cartas.mjs`)
  check('  …y cartas.html es lo que sale del generador', generarCartas(leer('mi-coleccion.html')) === cartas)
  const { PARTES_DE_LA_COLECCION } = await import(`${RAIZ}/js/barra-lateral.js`)
  check('la lateral fuera de Mi colección lleva las cuatro', PARTES_DE_LA_COLECCION.map((p) => p.texto).join('|') === 'Panel|Cartas|Deseos y cambios|Buscar', PARTES_DE_LA_COLECCION.map((p) => p.texto).join('|'))
  for (const [f, n] of [['meta.html', 3], ['mazos.html', 3], ['laboratorio.html', 3], ['repeticiones.html', 4], ['mis-partidas.html', 5]]) {
    const s = leer(f)
    const fila = s.match(/<(nav|div) class="seg (?:jugar-pestanas|partidas-tabs) seg-iconos"[\s\S]*?<\/\1>/)?.[0] || ''
    check(`${f}: fila con icono en sus ${n} pestañas`, (fila.match(/data-seg-icono="\w+"/g) || []).length === n && (fila.match(/class="seg-txt"/g) || []).length === n)
  }
}

const b = await chromium.launch()
const errores = []
async function abrir(ruta, movil) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(`${ruta}: ${String(e).slice(0, 160)}`))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx }
}
// (/mis-partidas abre en «Resumen» desde la 1390, que va delante: el doble
// tiene partidas sueltas y ningún torneo.)
// Lo que se ve de una fila: el nombre si se lee, «·» si solo está el icono.
const fila = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(`${sel} .seg-btn`)].map((x) => {
  const t = x.querySelector('.seg-txt')
  const visible = t && t.getBoundingClientRect().width > 2
  const icono = x.querySelector('.seg-ico svg')
  const puesta = x.classList.contains('activa') || x.getAttribute('aria-pressed') === 'true' || x.getAttribute('aria-current') === 'page'
  return `${icono ? '' : '!sin-icono:'}${visible ? t.textContent.trim().split(/\s/)[0] : '·'}${puesta ? '*' : ''}`
}).join('|'), sel)

console.log('── 2. Mi colección en el móvil ──')
for (const [ver, esperada] of [['album', 'Expansiones*|·|·|·'], ['pokedex', '·|Pokédex*|·|·'], ['carpetas', '·|·|Álbumes*|·'], ['productos', '·|·|·|Productos*']]) {
  const { page, ctx } = await abrir(`/mi-coleccion?ver=${ver}`, true)
  const r = await page.evaluate((ver) => {
    const f = document.getElementById('mcCartasPestanas')
    const panel = { album: 'mcPanelAlbum', pokedex: 'mcPanelPokedex', carpetas: 'mcPanelCarpetas', productos: 'mcPanelProductos' }[ver]
    const caja = f?.getBoundingClientRect()
    return {
      menu: [...document.querySelectorAll('#mcMenu .mc-pestania')].filter((x) => x.offsetParent).map((x) => x.innerText.trim() + (x.classList.contains('activa') ? '*' : '')).join('|'),
      dentro: Boolean(f && document.getElementById(panel).contains(f)),
      arriba: caja ? Math.round(caja.top) : -1,
      ancho: document.documentElement.scrollWidth,
      cabe: f ? f.scrollWidth <= f.clientWidth + 1 : false,
    }
  }, ver)
  check(`?ver=${ver}: la burbuja dice Panel|Cartas*|Cambios|Buscar`, r.menu === 'Panel|Cartas*|Cambios|Buscar', r.menu)
  check(`  …la fila está en su pantalla, arriba (${r.arriba} px), y dice ${esperada}`, r.dentro && r.arriba > 0 && r.arriba < 200 && (await fila(page, '#mcCartasPestanas')) === esperada, `${await fila(page, '#mcCartasPestanas')} ${JSON.stringify(r)}`)
  check('  …sin desbordar la pantalla ni la fila', r.ancho <= 390 && r.cabe, JSON.stringify(r))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion?ver=album', true)
  await page.click('#mcCartasPestanas [data-pestania="pokedex"]')
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => ({ url: location.search, panel: !document.getElementById('mcPanelPokedex').classList.contains('hidden'), dentro: document.getElementById('mcPanelPokedex').contains(document.getElementById('mcCartasPestanas')) }))
  check('tocar «Pokédex» en la fila abre la Pokédex y la fila se muda con ella', r.url.includes('ver=pokedex') && r.panel && r.dentro, JSON.stringify(r))
  check('  …y queda puesta', (await fila(page, '#mcCartasPestanas')) === '·|Pokédex*|·|·', await fila(page, '#mcCartasPestanas'))
  await page.click('#mcMenu [data-pestania="album"]')
  await page.waitForTimeout(700)
  check('tocar «Cartas» desde la Pokédex abre Expansiones', await page.evaluate(() => !document.getElementById('mcPanelAlbum').classList.contains('hidden') && !location.search.includes('ver=pokedex')))
  await page.click('#mcMenu [data-pestania="resumen"]')
  await page.waitForTimeout(700)
  check('en el Panel la fila no se ve', await page.evaluate(() => !document.getElementById('mcCartasPestanas').offsetParent))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion?ver=album&set=sv08&catalogo=WEST', true)
  check('dentro de una expansión la fila no se ve', await page.evaluate(() => !document.getElementById('mcCartasPestanas').offsetParent))
  await ctx.close()
}

console.log('── 3. Mi colección en el PC ──')
{
  const { page, ctx } = await abrir('/mi-coleccion?ver=album', false)
  const r = await page.evaluate(() => {
    const f = document.getElementById('mcCartasPestanas')
    const cab = document.querySelector('.mc-estanteria-cabeza')
    const h = document.querySelector('.mc-estanteria-h')
    const orden = document.getElementById('mcEstanteriaOrdenAbrir').getBoundingClientRect()
    return {
      enCabeza: cab.contains(f),
      titulo: h.getBoundingClientRect().width,
      mismaLinea: Math.abs(f.getBoundingClientRect().top + f.getBoundingClientRect().height / 2 - (orden.top + orden.height / 2)) < 6,
      lateral: [...document.querySelectorAll('.lat-menu-sitio .mc-pestania')].filter((x) => x.offsetParent).map((x) => x.innerText.trim()).join('|'),
    }
  })
  // Desde la 1373 Filtros va en la fila de buscar, debajo de las pestañas.
  check('Expansiones: las pestañas ocupan el sitio del título', r.enCabeza && r.titulo <= 2, JSON.stringify(r))
  check('  …con icono y nombre en las cuatro', (await fila(page, '#mcCartasPestanas')) === 'Expansiones*|Pokédex|Álbumes|Productos', await fila(page, '#mcCartasPestanas'))
  check('  …y la lateral dice Panel|Cartas|Deseos y cambios|Buscar', r.lateral === 'Panel|Cartas|Deseos y cambios|Buscar', r.lateral)
  await ctx.close()
}

console.log('── 4. Jugar ──')
for (const [ruta, sel, movil, esperada] of [
  ['/meta', '.jugar-pestanas', true, 'Meta*|·|·'],
  ['/mazos', '.jugar-pestanas', true, '·|Los*|·'],
  ['/laboratorio', '.jugar-pestanas', true, '·|·|Probar*'],
  ['/repeticiones', '.jugar-pestanas', true, '·|·|·|Repeticiones*'],
  ['/mis-partidas', '#partidasTabs', true, 'Resumen*|·|·|·|·'],
  ['/meta', '.jugar-pestanas', false, 'Meta*|Los|Probar'],
  ['/mis-partidas', '#partidasTabs', false, 'Resumen*|Torneos|Partidas|Estadísticas|Repeticiones'],
]) {
  const { page, ctx } = await abrir(ruta, movil)
  const vista = await fila(page, sel)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
  check(`${ruta} (${movil ? 'móvil' : 'PC'}): ${esperada}`, vista === esperada && ancho <= (movil ? 390 : 1440), `${vista} ancho ${ancho}`)
  if (ruta === '/mis-partidas' && movil) {
    await page.click('#partidasTabs [data-vista="stats"]')
    await page.waitForTimeout(500)
    check('  …tocar Estadísticas le da su nombre', (await fila(page, sel)) === '·|·|·|Estadísticas*|·', await fila(page, sel))
  }
  await ctx.close()
}

check('ninguna página da error', !errores.length, errores.join(' | '))
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
