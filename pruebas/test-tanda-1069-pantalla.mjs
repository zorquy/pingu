// Tanda 1069 — lo que ve la gente de una tienda, en el navegador: su perfil
// es su escaparate (sin las pestañas de una persona), con lo de tu lista
// arriba, «De tu lista», buscar, ordenar y «?carta=»; Escribir, Cómo llegar
// y Seguir; el QR y el cartel en /tienda → Escaparate; el Mercado con las
// tiendas mezcladas (avatar cuadrado, precio de tienda, «Todos / Personas /
// Tiendas» y la franja), y sin la migración, como antes; y «En tiendas» en
// la ficha del Mercado y en la de Mi colección.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const TIENDA = { id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda', avatar_url: null }
const ESCAPARATE = {
  total: 3, en_escaparate: 3, de_tu_lista: 1, precios: true,
  facetas: { catalogo: { WEST: 2, sellado: 1 }, idioma: { es: 1, en: 2 }, sets: { 'set-0': 2 } },
  filas: [
    { id: 'e1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: 95, de_tu_lista: true },
    { id: 'e2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', idioma: 'en', estado: 'EX', variante: 'reverse', gradeo: null, unidades: 2, precio: 279, de_tu_lista: false },
    { id: 'e3', card_id: null, market: 'WEST', product_id: 501, nombre: 'ETB de prueba', set_id: null, numero: null, idioma: 'en', estado: 'sellado', variante: 'normal', gradeo: null, unidades: 6, precio: 64.95, de_tu_lista: false },
  ],
}
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: `Carta ${i}` }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', rpc = {}, errores = {}, filas = {}, perfiles = [TIENDA], perfil = null, movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1360, height: 900 }, acceptDownloads: true })
  await ctx.addInitScript(([s, r, e, f, ps, p, c, st]) => {
    window.__FAKE_SESSION__ = s
    window.__RPC_RESPUESTAS__ = r
    window.__RPC_ERRORES__ = e
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'tienda-1', ciudad: 'Bilbao', direccion: 'Calle de ejemplo, 12', horario: 'L–S 10:30–20:30', web: '@turincon', precio_visible: true }], tcg_products: [{ id: 501, name: 'ETB de prueba', image: null }], ...f }
    window.__FAKE_PERFILES__ = ps
    if (p) window.__FAKE_PERFIL__ = p
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = st
    window.print = () => { window.__IMPRESO__ = document.documentElement.classList.contains('td-imprimiendo') }
  }, [sesion, rpc, errores, filas, perfiles, perfil, CARTAS, SETS])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

console.log('── 1. El perfil de una tienda es su escaparate ──')
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=rincon', { rpc: { tienda_escaparate: ESCAPARATE } })
  check('sin errores', !errs.length, errs.join(' | '))
  check('sin el perfil de una persona (ni pestañas, ni vitrina)', (await p.locator('#profileTabs').count()) === 0 && (await p.locator('#perfilVitrina').count()) === 0)
  check('su nombre es el <h1>, con la chapa «Tienda» y su ciudad', (await p.textContent('h1')) === 'El Rincón' && /Tienda/.test(await p.textContent('.pt-chapa')) && /@rincon · Bilbao/.test(await p.textContent('.pt-quien small')))
  check('Escribir lleva a sus mensajes', (await p.getAttribute('.pt-botones a.btn-primary', 'href')) === '/mensajes.html?with=tienda-1')
  check('Cómo llegar, al mapa con su dirección', (await p.getAttribute('.pt-botones a[target="_blank"]', 'href')) === 'https://www.google.com/maps/search/?api=1&query=Calle%20de%20ejemplo%2C%2012%2C%20Bilbao')
  check('dirección, horario y web', /Calle de ejemplo, 12, Bilbao/.test(await p.textContent('.pt-datos')) && /L–S 10:30–20:30/.test(await p.textContent('.pt-datos')) && /@turincon/.test(await p.textContent('.pt-datos')))
  const pedido = (await llamadas(p, 'tienda_escaparate'))[0]
  check('pide SU escaparate', pedido?.p_tienda === 'tienda-1' && JSON.stringify(pedido.p_filtros) === '{}')
  check('arriba, lo que tiene de tu lista', /Tiene 1 carta de tu lista/.test(await p.textContent('.pt-tuyas')) && (await p.isVisible('.pt-tuyas')))
  const cartas = await p.$$eval('.pt-carta', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' ')))
  check('la rejilla: precio, nombre e idioma · estado', cartas.length === 3 && /95,00 €/.test(cartas[0]) && /Carta 1/.test(cartas[0]) && /ES · NM/.test(cartas[0]), cartas.join(' | '))
  check('  …la versión y las unidades', /EN · EX · Reverse holo · 2 uds\./.test(cartas[1]), cartas[1])
  check('  …lo sellado', /ETB de prueba/.test(cartas[2]) && /Sellado/.test(cartas[2]))
  check('  …la de tu lista, con su corazón', (await p.locator('.pt-carta.tuya .pt-tuya').count()) === 1)
  check('  …la carta enlaza a su ficha (el pop-up de siempre) y lleva sus marcas', /^\/carta\//.test(await p.getAttribute('.pt-carta:first-child .pt-foto', 'href')) && (await p.getAttribute('.pt-carta:first-child .pt-foto', 'data-marca-carta')) === 'carta-1')
  check('  …y el sellado, a su producto', (await p.getAttribute('.pt-carta:nth-child(3) .pt-foto', 'href')) === '/cartas?ver=productos&producto=501')
  await p.click('.seg [data-pt-ver="tuyas"]'); await p.waitForTimeout(400)
  check('«De tu lista»', JSON.stringify((await ultima(p, 'tienda_escaparate')).p_filtros) === '{"de_tu_lista":true}')
  await p.click('.seg [data-pt-ver="sellado"]'); await p.waitForTimeout(400)
  check('«Sellado»', JSON.stringify((await ultima(p, 'tienda_escaparate')).p_filtros) === '{"catalogo":["sellado"]}')
  await p.fill('[data-pt-q]', 'char'); await p.waitForTimeout(700)
  check('buscar', (await ultima(p, 'tienda_escaparate')).p_filtros.q === 'char')
  await p.selectOption('[data-pt-orden]', 'precio_asc'); await p.waitForTimeout(400)
  check('ordenar por precio', (await ultima(p, 'tienda_escaparate')).p_orden === 'precio_asc')
  await p.selectOption('[data-pt-idioma]', 'en'); await p.waitForTimeout(400)
  check('el idioma (hay dos)', JSON.stringify((await ultima(p, 'tienda_escaparate')).p_filtros.idioma) === '["en"]')
  await p.click('[data-pt-seguir]'); await p.waitForTimeout(500)
  check('Seguir la sigue', (await p.evaluate(() => window.__TABLAS__.user_follows?.some((f) => f.follower_id === 'user-2' && f.following_id === 'tienda-1'))) && (await p.textContent('[data-pt-seguir]')) === 'Dejar de seguir')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&carta=carta-2', { rpc: { tienda_escaparate: ESCAPARATE } })
  check('?carta= (desde «En tiendas»): pide solo esa y lo dice', JSON.stringify((await llamadas(p, 'tienda_escaparate'))[0].p_filtros) === '{"carta":"carta-2"}' && (await p.isVisible('.pt-solo')))
  await p.click('.pt-solo [data-pt-ver="todo"]'); await p.waitForTimeout(400)
  check('  …y «Ver todo el stock» lo quita', JSON.stringify((await ultima(p, 'tienda_escaparate')).p_filtros) === '{}')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&lista=1', { rpc: { tienda_escaparate: ESCAPARATE } })
  check('?lista=1 (desde la franja del Mercado): ya con «De tu lista»', JSON.stringify((await llamadas(p, 'tienda_escaparate'))[0].p_filtros) === '{"de_tu_lista":true}')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon', { sesion: 'none', rpc: { tienda_escaparate: { ...ESCAPARATE, de_tu_lista: 0, precios: false, filas: ESCAPARATE.filas.map((f) => ({ ...f, precio: null, de_tu_lista: false })) } } })
  check('sin cuenta: sin «de tu lista», Escribir lleva a crear cuenta', !(await p.isVisible('.pt-tuyas')) && /^\/auth\.html\?registro=1/.test(await p.getAttribute('.pt-botones a.btn-primary', 'href')) && (await p.locator('.seg [data-pt-ver="tuyas"]').isHidden()))
  check('  …y una tienda sin precios a la vista dice «Pregunta en la tienda»', (await p.locator('.pt-pregunta').count()) === 3 && /Pregunta en la tienda/.test(await p.textContent('.pt-pregunta')))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=Misty', { rpc: { tienda_escaparate: ESCAPARATE } })
  check('el perfil de una persona sigue igual (con sus pestañas, sin escaparate)', !errs.length && (await p.locator('#profileTabs').count()) === 1 && (await p.locator('.pt').count()) === 0 && !(await llamadas(p, 'tienda_escaparate')).length)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon', { movil: true, rpc: { tienda_escaparate: ESCAPARATE } })
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  check('en el móvil: sin salirse de ancho, a tres por fila', ancho <= 390 && (await p.evaluate(() => getComputedStyle(document.querySelector('.pt-rejilla')).gridTemplateColumns.split(' ').length)) === 3, ancho)
  await ctx.close()
}

console.log('── 2. /tienda → Escaparate: el QR y el cartel ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=escaparate', { perfil: { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }, filas: { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao' }] } })
  await p.waitForTimeout(600)
  check('sin errores', !errs.length, errs.join(' | '))
  check('el cartel con su QR, su nombre y el enlace', (await p.locator('#tdQr svg').count()) === 1 && (await p.textContent('#tdCartelNombre')) === 'El Rincón' && (await p.textContent('#tdEnlace')) === 'pokedoc.es/usuario/rincon')
  await p.click('#tdImprimir')
  check('«Imprimir el cartel» imprime con la clase que deja solo el cartel', (await p.evaluate(() => window.__IMPRESO__)) === true)
  const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#tdBajarQr')])
  check('«Descargar el QR» baja un SVG', descarga?.suggestedFilename() === 'qr-rincon.svg')
  await p.click('[data-td="hoy"]')
  // Desde la 1073, imprimir o descargar el cartel da el paso por hecho.
  check('imprimir el cartel da por hecho el paso del QR', (await p.locator('[data-td-ir="escaparate"]').count()) === 0 && /Imprimir el QR/.test(await p.textContent('.td-pasos li.hecho:last-child')))
  await ctx.close()
}

console.log('── 3. El Mercado, con las tiendas ──')
const MERCADO = [
  { card_id: 'carta-1', market: 'WEST', personas: 1, tiendas: 1, copias: 2, idiomas: ['es'], dan: ['user-1'], gente: [{ user_id: 'user-1', username: 'Ash', display_name: 'Ash' }, { user_id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tienda: true, precio: 95, ciudad: 'Bilbao' }], desde: 95, ultima: new Date().toISOString(), total: 2 },
  { card_id: 'carta-2', market: 'WEST', personas: 0, tiendas: 1, copias: 2, idiomas: ['en'], dan: null, gente: [{ user_id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tienda: true, precio: 279 }], desde: 279, ultima: new Date().toISOString(), total: 2 },
]
const FRANJA = [{ tienda_id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', avatar_url: null, ciudad: 'Bilbao', cartas: 2 }]
const QUE_TIENEN = [{ tienda_id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', avatar_url: null, ciudad: 'Bilbao', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: 95, de_tu_lista: true }]
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=mercado', { rpc: { mercado_con_tiendas: MERCADO, tiendas_con_mis_deseos: FRANJA, tiendas_que_tienen: QUE_TIENEN } })
  await p.waitForTimeout(800)
  check('sin errores', !errs.length, errs.join(' | '))
  const pedido = (await llamadas(p, 'mercado_con_tiendas'))[0]
  check('pide el Mercado con tiendas, «todos»', pedido?.p_quien === 'todos' && pedido.p_market === 'WEST')
  check('«Todos / Personas / Tiendas», con Todos puesto', (await p.isVisible('#mcMercadoQuien')) && (await p.getAttribute('[data-merc-quien="todos"]', 'aria-pressed')) === 'true')
  const b1 = p.locator('[data-merc="carta-1"]').first()
  check('la carta que dan una persona y una tienda: los dos avatares, el de la tienda cuadrado', (await b1.locator('.mc-gente-av').count()) === 2 && (await b1.locator('.mc-gente-av.tienda').count()) === 1)
  check('  …lo dice en la etiqueta («la da 1 · 1 tienda») y el precio de tienda', /la da 1 · 1 tienda/.test(await b1.locator('[data-merc-ficha]').first().getAttribute('aria-label')) && /En tienda: 95,00\s€/.test(await b1.textContent()))
  const b2 = p.locator('[data-merc="carta-2"]').first()
  check('la que solo tiene una tienda: «Tiendas 1» y «en 1 tienda»', /Tiendas\s*1/.test(await b2.locator('.mc-merc-texto').textContent()) && /en 1 tienda/.test(await b2.locator('[data-merc-ficha]').first().getAttribute('aria-label')))
  check('la franja: la tienda con cartas de tu lista, a su perfil con «De tu lista»', (await p.isVisible('#mcMercadoTiendas')) && (await p.getAttribute('.mc-tienda-tarjeta', 'href')) === '/usuario/rincon?lista=1' && /2 de tu lista/.test(await p.textContent('.mc-tienda-tarjeta')))
  await p.click('[data-merc-quien="tiendas"]'); await p.waitForTimeout(500)
  check('«Tiendas» pide solo las tiendas', (await ultima(p, 'mercado_con_tiendas')).p_quien === 'tiendas' && (await p.getAttribute('[data-merc-quien="tiendas"]', 'aria-pressed')) === 'true')
  await p.click('[data-merc-quien="personas"]'); await p.waitForTimeout(500)
  check('«Personas»: solo personas, y la franja se va', (await ultima(p, 'mercado_con_tiendas')).p_quien === 'personas' && !(await p.isVisible('#mcMercadoTiendas')))
  await p.click('[data-merc-quien="todos"]'); await p.waitForTimeout(500)
  await p.locator('[data-merc="carta-1"] [data-merc-ficha]').first().click(); await p.waitForTimeout(1500)
  check('la ficha del Mercado: «En tiendas», con la tienda, su precio y «de tu lista»', /En tiendas/.test(await p.textContent('#mcMercadoFichaTiendas')) && /El Rincón/.test(await p.textContent('#mcMercadoFichaTiendas')) && /95,00\s€/.test(await p.textContent("#mcMercadoFichaTiendas")) && /de tu lista/.test(await p.textContent('#mcMercadoFichaTiendas')))
  check('  …que lleva a la tienda con esa carta', (await p.getAttribute('#mcMercadoFichaTiendas .ent-fila', 'href')) === '/usuario/rincon?carta=carta-1')
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=mercado', { errores: { mercado_con_tiendas: { code: 'PGRST202', message: 'Could not find the function public.mercado_con_tiendas' } } })
  await p.waitForTimeout(800)
  check('sin la migración: el Mercado de siempre, sin «Personas / Tiendas» ni franja', !errs.length && (await llamadas(p, 'intercambios_mercado')).length >= 1 && !(await p.isVisible('#mcMercadoQuien')) && !(await p.isVisible('#mcMercadoTiendas')), errs.join(' | '))
  await ctx.close()
}

{
  const { p, ctx } = await abrir('/mi-coleccion.html?ver=mercado', { rpc: { mercado_con_tiendas: MERCADO.slice(0, 1).map((m) => ({ ...m, tiendas: 0, gente: m.gente.slice(0, 1), desde: null })) }, filas: { tiendas: [] } })
  await p.waitForTimeout(800)
  check('con la migración y sin ninguna tienda dada de alta: sin «Personas / Tiendas»', !(await p.isVisible('#mcMercadoQuien')) && (await llamadas(p, 'mercado_con_tiendas')).length >= 1)
  await ctx.close()
}

console.log('── 4. «En tiendas» en la ficha de Mi colección ──')
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=cartas', { rpc: { tiendas_que_tienen: QUE_TIENEN } })
  await p.evaluate(() => window.pokedocAbrirCarta({ id: 'carta-1', market: 'WEST' }))
  await p.waitForTimeout(2000)
  check('la ficha abierta enseña las tiendas que la tienen', !errs.length && (await p.isVisible('#mcEdTiendas')) && /El Rincón/.test(await p.textContent('#mcEdTiendas')) && (await llamadas(p, 'tiendas_que_tienen'))[0]?.p_card_id === 'carta-1', errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mi-coleccion.html?ver=cartas', { rpc: { tiendas_que_tienen: [] } })
  await p.evaluate(() => window.pokedocAbrirCarta({ id: 'carta-1', market: 'WEST' }))
  await p.waitForTimeout(1500)
  check('  …y sin ninguna, el bloque no sale', !(await p.isVisible('#mcEdTiendas')))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
