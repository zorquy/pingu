// Tanda 848 en el navegador: el panel de Analítica de /admin en visual.
// PINGU: «ponme el panel en el admin mucho más bonito y visual».
//
// Se mira: las fichas con su variación, la gráfica de líneas dibujada al
// abrir la sección (nace escondida: la 628) con su tooltip al pasar y con el
// teclado, los orígenes, la pila de aparatos, el mapa de calor (168 celdas),
// las 8 semanas de retención, búsquedas y páginas rotas; que un texto de
// fuera no se ejecute; que sin la función salga lo de antes con el aviso; y
// el tema oscuro.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hoy = new Date()
const dia = (i) => new Date(hoy.getTime() - (29 - i) * 864e5).toISOString().slice(0, 10)
const semana = (i) => new Date(hoy.getTime() - (7 - i) * 7 * 864e5).toISOString().slice(0, 10)
const POR_DIA = Array.from({ length: 30 }, (_, i) => ({ dia: dia(i), personas: 120 + Math.round(60 * Math.sin(i / 3)) + i * 4, con_sesion: 40 + (i % 7) * 6 }))
const HORAS = []
for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) HORAS.push({ dia: d, hora: h, n: Math.max(0, Math.round((h > 8 ? 10 : 1) * (1 + Math.sin((h - 6) / 4)) * (d >= 5 ? 1.6 : 1))) })
HORAS.find((x) => x.dia === 4 && x.hora === 21).n = 99
const DATOS = {
  resumen: { personas: 4680, personas_antes: 3900, entradas: 1620, entradas_antes: 1700, activos: 212, activos_antes: 180, con_sesion: 1500, robots: 2310, altas: 34, altas_antes: 20, registrados: 1290, con_aparato: 3000, movil: 2040 },
  por_dia: POR_DIA,
  origenes: [{ origen: 'google', n: 720 }, { origen: 'directo', n: 410 }, { origen: 'instagram', n: 260 }, { origen: 'telegram', n: 140 }, { origen: 'x', n: 50 }, { origen: 'blog.ejemplo.com', n: 40 }],
  campanas: [{ campana: 'telegram', n: 120 }, { campana: 'instagram', n: 90 }],
  aparatos: [{ aparato: 'movil', n: 2040 }, { aparato: 'pc', n: 840 }, { aparato: 'tablet', n: 120 }],
  paginas: [{ ruta: '/', n: 1500 }, { ruta: '/mi-coleccion', n: 900 }, { ruta: '/retos', n: 600 }, { ruta: '/aprender', n: 300 }],
  retencion: Array.from({ length: 8 }, (_, i) => ({ semana: semana(i), activos: 120 + i * 12, vuelven: i === 7 ? null : 50 + i * 6, altas: 10 + i })),
  horas: HORAS,
  busquedas: { total: 820, vacias: 95, top: [{ q: 'charizard', n: 80, vacias: 0 }, { q: 'mega gardevoir', n: 40, vacias: 12 }, { q: '<img src=x onerror=window.__XSS__=1>', n: 3, vacias: 3 }], sin_resultado: [{ q: 'pokemon pocket', n: 30 }, { q: 'mega gardevoir', n: 12 }] },
  rotos: [{ ruta: '/guia/vieja', n: 9, desde: '/aprender', ultima: hoy.toISOString() }, { ruta: '/wp-admin', n: 4, desde: null, ultima: hoy.toISOString() }],
}

const b = await chromium.launch()
async function abrir({ datos = DATOS, oscuro = false, ancho = 1280 } = {}) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: oscuro ? 'dark' : 'light' })
  await ctx.addInitScript(([d, o]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    if (d) window.__FAKE_ANALITICA__ = d
    try { localStorage.setItem('pokedoc-theme', o ? 'dark' : 'light') } catch {}
  }, [datos, oscuro])
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  await p.locator('[data-section="analytics"]').click()
  await p.waitForTimeout(700)
  return { p, ctx, errores }
}

console.log('── 1. El panel nuevo ──')
{
  const { p, ctx, errores } = await abrir()
  check('sin errores', !errores.length, errores.join(' | '))
  check('sale el panel y lo de antes se esconde', await p.locator('#anPanel').isVisible() && !(await p.locator('#anViejo').isVisible()))
  const tiles = await p.$$eval('.an-tile', (ts) => ts.map((t) => t.innerText.replace(/\s+/g, ' ')))
  check('seis fichas', tiles.length === 6, tiles.join(' / '))
  check('  …la grande: 4,7 mil personas, +20 % y su chispa', /4,7 mil/.test(tiles[0]) && /\+20 %/.test(tiles[0]) && (await p.locator('.an-tile-grande .an-chispa polyline').count()) === 1, tiles[0])
  check('  …las entradas bajan y lo dice (▼)', /▼ -5 %/.test(tiles[1]), tiles[1])
  check('  …el 68 % desde el móvil', /68 %/.test(tiles[4]), tiles[4])
  check('  …y vuelven a la semana: el de la última semana entera (92 de 204 = 45 %)', /45 %/.test(tiles[5]), tiles[5])
  const lineas = await p.$$eval('#anLineas path.an-linea', (ps) => ps.map((x) => x.getAttribute('d')?.length || 0))
  check('la gráfica se dibuja al abrir la sección (estaba escondida), con dos líneas', lineas.length === 2 && lineas.every((n) => n > 50), JSON.stringify(lineas))
  check('  …con su leyenda (son dos series)', (await p.locator('#anLineas').locator('xpath=..').locator('.an-leyenda li').count()) === 2)
  const caja = await p.locator('#anLineas .an-toque').boundingBox()
  await p.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height / 2)
  await p.waitForTimeout(150)
  const tip = await p.locator('#anLineas .an-tip').innerText().catch(() => '')
  check('  …al pasar el ratón, el tooltip con las dos cifras del día', /Personas/.test(tip) && /Con sesión/.test(tip), tip)
  await p.mouse.move(5, 5)
  await p.locator('#anLineas .an-toque').focus()
  await p.keyboard.press('ArrowLeft')
  await p.waitForTimeout(100)
  const tipTeclado = await p.locator('#anLineas .an-tip').innerText().catch(() => '')
  check('  …y con el teclado igual (el penúltimo día)', new RegExp(String(POR_DIA[28].personas)).test(tipTeclado.replace(/\./g, '')), tipTeclado)
  const orig = await p.$$eval('.an-card', (cs) => cs.find((c) => /De dónde llegan/.test(c.innerText))?.innerText || '')
  check('orígenes con nombre: Google primero, «Directo» (la app va aparte desde la 1065), y el dominio raro tal cual', /Google/.test(orig) && orig.indexOf('Google') < orig.indexOf('Instagram') && /Directo/.test(orig) && !/Directo o app/.test(orig) && /blog\.ejemplo\.com/.test(orig), orig.slice(0, 200))
  const pila = await p.$$eval('.an-pila i', (is) => is.map((i) => getComputedStyle(i).backgroundColor))
  check('aparatos: tres trozos de colores distintos y con su %', pila.length === 3 && new Set(pila).size === 3 && /Móvil\s*68 %/.test(await p.locator('.an-card', { hasText: 'Con qué lo miran' }).locator('.an-leyenda').innerText()), JSON.stringify(pila))
  check('mapa de calor: 7 × 24 celdas y la hora punta en palabras', (await p.locator('.an-calor-celda').count()) === 168 && /los jueves a las 21 h/.test(await p.locator('.an-titular').innerText()))
  const celda = p.locator('.an-calor-celda').nth(3 * 24 + 21)
  await celda.hover()
  await p.waitForTimeout(120)
  check('  …la celda dice su cifra al pasar', /jueves a las 21 h: 99/.test(await p.locator('.an-card', { hasText: 'Cuándo entra' }).locator('.an-tip').innerText()))
  check('retención: 8 semanas, la última «en curso»', (await p.locator('.an-col').count()) === 8 && /en curso/.test(await p.locator('.an-col').last().innerText()))
  check('  …con su tabla de datos para quien no ve la gráfica', (await p.locator('.an-card', { hasText: 'Quién vuelve' }).locator('details.an-tabla tbody tr').count()) === 8)
  check('búsquedas: lo más buscado y lo que no encontró nada', /charizard/.test(await p.locator('.an-card', { hasText: 'Lo más buscado' }).innerText()) && /pokemon pocket/.test(await p.locator('.an-card', { hasText: 'Buscado sin resultado' }).innerText()))
  check('  …y un texto con HTML se pinta como texto, no se ejecuta', !(await p.evaluate(() => window.__XSS__)) && /<img src=x/.test(await p.locator('.an-card', { hasText: 'Lo más buscado' }).innerText()))
  check('páginas rotas: la que viene de una página nuestra lo dice', /enlace nuestro/.test(await p.locator('.an-rotos').innerText()) && (await p.locator('.an-rotos a[href="/aprender"]').count()) === 1)
  check('campañas, con el utm_source', /telegram/.test(await p.locator('.an-card', { hasText: 'Campañas' }).innerText()))
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('no se sale de la pantalla', sale <= 1, `${sale}px`)
  await p.locator('#section-analytics').screenshot({ path: '/tmp/claude-0/an-848-claro.png' })
  // Cambiar el periodo vuelve a pedir y repinta.
  await p.selectOption('#analyticsDays', '30')
  await p.waitForTimeout(800)
  check('al cambiar el periodo se repinta sin errores', !errores.length && (await p.locator('.an-tile').count()) === 6, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Sin la migración y en oscuro ──')
{
  const { p, ctx, errores } = await abrir({ datos: null })
  check('sin la función: el aviso que dice qué ejecutar, y lo de antes visible', !errores.length && /supabase-migration-analitica\.sql/.test(await p.locator('#anPanel').innerText()) && (await p.locator('#anViejo').isVisible()), errores.join(' | '))
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir({ oscuro: true })
  const s1 = await p.$eval('.an-pila i', (i) => getComputedStyle(i).backgroundColor)
  check('en oscuro, el azul es el de su tema (#3987e5)', !errores.length && s1 === 'rgb(57, 135, 229)', s1)
  await p.locator('#section-analytics').screenshot({ path: '/tmp/claude-0/an-848-oscuro.png' })
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ ancho: 420 })
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('en una pantalla estrecha tampoco se sale', sale <= 1, `${sale}px`)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
