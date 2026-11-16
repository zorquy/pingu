// Tanda 1381 — el idioma en un slide y la lupa que crece (PINGU: «mejor que
// sea un slide entre occidental y japonés, como antes… y en móvil que el
// buscar sea una barra más pequeña y cuando lo uses se amplíe mientras
// escribes»; «dale con lo recomendado»):
//   · en las filas con catálogo (Expansiones, Pokédex, Un Pokémon, Buscar) se
//     ve la cápsula de dos banderas y NO el desplegable;
//   · PC: bandera y nombre; móvil: solo la bandera;
//   · tocar la otra bandera cambia de catálogo;
//   · móvil: la lupa es un círculo de 44, al enfocarla ocupa la fila, con
//     texto se queda a media fila; Buscar no la recoge;
//   · todo cabe a 360 px.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const FOTOS = process.env.FOTOS_1381 || ''
const b = await chromium.launch()
async function abrir(ancho, ruta) {
  const movil = ancho < 700
  const ctx = await b.newContext({ viewport: { width: ancho, height: movil ? 800 : 900 }, isMobile: movil, hasTouch: movil, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|cdn\.jsdelivr|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { ctx, page, errores }
}
const fila = (page, sel) => page.evaluate((sel) => {
  const f = document.querySelector(sel)
  if (!f) return null
  const r = (e) => (e ? e.getBoundingClientRect() : null)
  const seg = f.querySelector('select.mc-mercado + .seg')
  const select = f.querySelector('select.mc-mercado')
  const busca = f.querySelector('.mc-buscador')
  const vis = [...f.querySelectorAll('.mc-buscador, .mc-mandos > *')].filter((e) => e.getBoundingClientRect().width > 2 && getComputedStyle(e).display !== 'none')
  const rs = vis.map(r)
  const textos = seg ? [...seg.querySelectorAll('.seg-btn > span')].map((s) => s.getBoundingClientRect().width > 2) : []
  return {
    seg: seg ? Math.round(r(seg).width) : 0,
    segAlto: seg ? Math.round(r(seg).height) : 0,
    select: select ? (getComputedStyle(select).clip === 'auto' ? Math.round(r(select).width) : 0) : -1,
    textos,
    busca: busca ? Math.round(r(busca).width) : 0,
    filaAncho: Math.round(r(f).width),
    mandosVisibles: [...f.querySelectorAll('.mc-mandos')].some((m) => getComputedStyle(m).display !== 'none'),
    centros: rs.map((x) => Math.round(x.top + x.height / 2)),
    derecha: Math.round(Math.max(...rs.map((x) => x.right))),
    ancho: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }
}, sel)

const PANTALLAS = [
  { nombre: 'Expansiones', ruta: '/mi-coleccion?ver=album', fila: '#mcEstanteriaFila', input: '#mcEstanteriaBuscar', crece: true },
  { nombre: 'Expansiones de /cartas', ruta: '/cartas', fila: '#mcEstanteriaFila', input: '#mcEstanteriaBuscar', crece: true },
  { nombre: 'Pokédex', ruta: '/mi-coleccion?ver=pokedex', fila: '#mcPdxMandos', input: '#mcPdxBuscar', crece: true, estrecha: true },
  { nombre: 'Un Pokémon', ruta: '/mi-coleccion?ver=pokedex&dex=6', fila: '#mcPokedexPanel .mc-una-fila', input: '#pdxEspecieBuscar', crece: true, estrecha: true },
  { nombre: 'Una expansión', ruta: '/mi-coleccion?ver=album&set=sv08&catalogo=WEST', fila: '.mc-album-busca', input: '#mcAlbumBuscar', crece: true, sinCatalogo: true },
  { nombre: 'Buscar', ruta: '/mi-coleccion?ver=buscar', fila: '#mcBuscarBarra', input: '#mcBuscarTodo', crece: false },
]

for (const p of PANTALLAS) {
  for (const ancho of [360, 390, 1440]) {
    const movil = ancho < 700
    const quien = `${p.nombre} · ${ancho}`
    const { ctx, page, errores } = await abrir(ancho, p.ruta)
    await page.waitForSelector(p.input, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(600)
    const m = await fila(page, p.fila)
    if (!m) { check(`${quien}: hay fila`, false); await ctx.close(); continue }
    if (!p.sinCatalogo) {
    check(`${quien}: el slide de banderas se ve y el desplegable no`, m.seg > 40 && m.select <= 1, JSON.stringify(m))
    check(`${quien}: ${movil ? 'solo las banderas' : 'bandera y nombre'}`, m.textos.length === 2 && m.textos.every((t) => t === !movil), JSON.stringify(m.textos))
    check(`${quien}: el slide mide lo que los mandos (${movil ? 44 : 40})`, Math.abs(m.segAlto - (movil ? 44 : 40)) <= 1, m.segAlto)
    }
    check(`${quien}: la fila cabe, en una línea y sin desbordar`, Math.max(...m.centros) - Math.min(...m.centros) <= 4 && m.derecha <= m.ancho + 1 && m.scroll <= m.ancho + 1, JSON.stringify(m))
    if (FOTOS && ancho !== 360) await page.screenshot({ path: `${FOTOS}-${p.nombre.replace(/\W+/g, '')}-${ancho}.png`, clip: { x: 0, y: 0, width: ancho, height: movil ? 420 : 520 } })
    if (movil) {
      if (p.crece) {
        // 1381b (PINGU: «la barra de búsqueda lo ha reducido a nada y hay
        // mucho espacio en la mitad»): la caja llena el hueco, sin vacío.
        // Donde la fila lleva más mandos (Kanto, Apilar, Seleccionar) es más
        // estrecha, pero llena el hueco y al tocarla ocupa la fila.
        const minimo = p.estrecha ? 48 : 100
        check(`${quien}: vacía, la caja de buscar llena el hueco (≥ ${minimo} px y la fila sin hueco)`, m.busca >= minimo && m.derecha >= m.ancho - 24 - 2, JSON.stringify(m))
        check(`${quien}: Filtros es la rueda, sin texto`, await page.$eval(`${p.fila} [data-icono="settings"] .mc-chip-texto`, (t) => t.getBoundingClientRect().width <= 2).catch(() => true))
        await page.tap(p.input)
        await page.waitForTimeout(350)
        const f = await fila(page, p.fila)
        check(`${quien}: al tocarla ocupa la fila y los mandos se apartan`, f.busca >= f.filaAncho - 2 && !f.mandosVisibles, JSON.stringify(f))
        await page.keyboard.type('a')
        await page.waitForTimeout(300)
        if (FOTOS && ancho === 390) await page.screenshot({ path: `${FOTOS}-${p.nombre.replace(/\W+/g, '')}-escribiendo.png`, clip: { x: 0, y: 0, width: ancho, height: 420 } })
        await page.evaluate(() => document.activeElement?.blur())
        await page.waitForTimeout(350)
        const g = await fila(page, p.fila)
        check(`${quien}: con texto y sin foco, a media fila y los mandos vuelven`, g.busca >= (p.estrecha ? 48 : 60) && g.busca < g.filaAncho - 60 && g.mandosVisibles, JSON.stringify(g))
        if (FOTOS && ancho === 390) await page.screenshot({ path: `${FOTOS}-${p.nombre.replace(/\W+/g, '')}-con-texto.png`, clip: { x: 0, y: 0, width: ancho, height: 420 } })
      } else {
        check(`${quien}: Buscar no recoge su caja`, m.busca > 100, m.busca)
      }
    }
    if (p.sinCatalogo) { check(`${quien}: sin errores`, errores.length === 0, errores.join(' | ')); await ctx.close(); continue }
    // Tocar la otra bandera cambia de catálogo
    const antes = await page.$eval(`${p.fila} select.mc-mercado`, (s) => s.value)
    const otro = await page.$eval(`${p.fila} select.mc-mercado + .seg`, (s) => s.querySelector('.seg-btn[aria-pressed="false"]')?.dataset.vista)
    await page.click(`${p.fila} select.mc-mercado + .seg [data-vista="${otro}"]`)
    await page.waitForTimeout(1200)
    const despues = await page.$eval(`${p.fila} select.mc-mercado`, (s) => s.value)
    const pulsado = await page.$eval(`${p.fila} select.mc-mercado + .seg`, (s) => s.querySelector('.seg-btn[aria-pressed="true"]')?.dataset.vista)
    check(`${quien}: tocar la otra bandera cambia de catálogo`, antes !== despues && despues === otro && pulsado === otro, `${antes} → ${despues} (${pulsado})`)
    check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
