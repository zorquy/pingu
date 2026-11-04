// Tanda 1236 — las tiendas en el Mercado (PINGU eligió lo recomendado de la
// propuesta, con una cosa: el precio de arriba de la carta se queda como está,
// con su bandera, sin «CM»).
//   · la carta del Mercado: «Desde X € · N tiendas», o «X € · Nombre» con una;
//   · el pop-up: Cardmarket y «En tiendas desde» arriba, Todo · Personas ·
//     Tiendas, una tarjeta por tienda (la más barata marcada, chips, cápsula,
//     «Ver fotos»), «Me interesa» y «Su tienda», tres a la vista y «Ver N más»;
//     sin la migración, con la función de antes y «Me interesa» a su escaparate;
//   · la pestaña «Tiendas»: la franja con TODAS las tiendas y «Ver todas»;
//   · /tiendas: la agenda (buscar, ciudad, con local, de tu lista, «Ver más»)
//     encima de «Pide acceso», y sin la migración, la página de antes.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: `Carta ${i}` }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
const T = (id, username, display_name, extra = {}) => ({ user_id: id, username, display_name, tienda: true, ...extra })
const MERCADO = [
  { card_id: 'carta-1', market: 'WEST', personas: 1, tiendas: 4, copias: 5, idiomas: ['en', 'es'], dan: ['user-1'], gente: [{ user_id: 'user-1', username: 'Ash', display_name: 'Ash' }, T('t1', 'norte', 'Norte Cartas', { precio: 72 }), T('t2', 'ryu', 'RyuCards', { precio: 80 })], desde: 72, ultima: new Date().toISOString(), total: 3 },
  { card_id: 'carta-2', market: 'WEST', personas: 0, tiendas: 1, copias: 1, idiomas: ['en'], dan: null, gente: [T('t2', 'ryu', 'RyuCards', { precio: 1200 })], desde: 1200, ultima: new Date().toISOString(), total: 3 },
  { card_id: 'carta-3', market: 'WEST', personas: 0, tiendas: 2, copias: 2, idiomas: ['es'], dan: null, gente: [T('t3', 'kanto', 'Kanto', { precio: null })], desde: null, ultima: new Date().toISOString(), total: 3 },
]
const CON_LA_CARTA = [
  { stock_id: 'st-1', tienda_id: 't1', username: 'norte', display_name: 'Norte Cartas', avatar_url: null, ciudad: 'Bilbao', con_local: true, idioma: 'en', estado: 'NM', variante: 'holo', gradeo: null, unidades: 1, precio: 72, de_tu_lista: true, precio_antes: null },
  { stock_id: 'st-2', tienda_id: 't2', username: 'ryu', display_name: 'RyuCards', avatar_url: null, ciudad: 'Madrid', con_local: false, idioma: 'en', estado: 'NM', variante: 'normal', gradeo: 'PSA 10', unidades: 1, precio: 80, de_tu_lista: false, precio_antes: 95 },
  { stock_id: 'st-3', tienda_id: 't3', username: 'kanto', display_name: 'Kanto', avatar_url: null, ciudad: 'Valencia', con_local: false, idioma: 'es', estado: 'EX', variante: 'normal', gradeo: null, unidades: 3, precio: 90, de_tu_lista: false, precio_antes: null },
  { stock_id: 'st-4', tienda_id: 't4', username: 'rincon', display_name: 'El Rincón', avatar_url: null, ciudad: 'Sevilla', con_local: false, idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: null, de_tu_lista: false, precio_antes: null },
]
const QUE_TIENEN = CON_LA_CARTA.map(({ stock_id, con_local, ...r }) => r)
const PERSONAS = [{ user_id: 'user-1', username: 'Ash', display_name: 'Ash', card_id: 'carta-1', idioma: 'es', estado: 'NM', variante: 'normal', cambio: 1 }]
const AGENDA = (a = {}) => {
  const todas = [
    { user_id: 't1', username: 'norte', display_name: 'Norte Cartas', avatar_url: null, banner_url: null, ciudad: 'Bilbao', con_local: true, cartas: 1240, productos: 3, de_tu_lista: 2 },
    { user_id: 't2', username: 'ryu', display_name: 'RyuCards', avatar_url: null, banner_url: 'https://ejemplo.supabase.co/storage/v1/object/public/avatars/t2/banner.webp', ciudad: 'Madrid', con_local: false, cartas: 412, productos: 0, de_tu_lista: 1 },
    { user_id: 't3', username: 'kanto', display_name: 'Kanto', avatar_url: null, banner_url: null, ciudad: 'Valencia', con_local: false, cartas: 1, productos: 0, de_tu_lista: 0 },
  ]
  const v = todas.filter((t) => (!a.p_texto || (t.display_name + t.ciudad).toLowerCase().includes(a.p_texto.toLowerCase())) && (!a.p_con_local || t.con_local) && (!a.p_ciudad || t.ciudad === a.p_ciudad) && (!a.p_de_mi_lista || t.de_tu_lista))
  const desde = a.p_desde || 0, cuantas = a.p_cuantas || 24
  return { total: v.length + (a.__muchas ? 30 : 0), ciudades: { Bilbao: 1, Madrid: 1, Valencia: 1 }, tiendas: v.slice(desde, desde + cuantas) }
}
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', rpc = {}, errores = {}, filas = {}, movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1360, height: 900 } })
  await ctx.addInitScript(([s, r, e, f, c, st, agendaFn]) => {
    window.__FAKE_SESSION__ = s
    const resp = {}
    for (const [k, v] of Object.entries(r)) resp[k] = v === '__AGENDA__' ? (a) => (0, eval)(`(${agendaFn})`)(a) : v
    window.__RPC_RESPUESTAS__ = resp
    window.__RPC_ERRORES__ = e
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 't1' }], user_collection: [{ id: 'uc-1', user_id: 'user-1', card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 1 }], ...f }
    window.__FAKE_PERFILES__ = [{ id: 't1', username: 'norte', display_name: 'Norte Cartas', tipo: 'tienda' }, { id: 'user-1', username: 'Ash', display_name: 'Ash' }]
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = st
  }, [sesion, rpc, errores, filas, CARTAS, SETS, AGENDA.toString()])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|ejemplo\.supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const RPC = { mercado_con_tiendas: MERCADO, tiendas_con_la_carta: CON_LA_CARTA, tiendas_agenda: '__AGENDA__', tiendas_con_mis_deseos: [] }

console.log('── 1. La carta del Mercado ──')
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=mercado', { rpc: RPC })
  check('sin errores', !errs.length, errs.join(' | '))
  const linea = async (id) => (await p.locator(`[data-merc="${id}"] .mc-merc-desde`).first().textContent().catch(() => '')).replace(/\s/g, ' ')
  check('varias tiendas: «Desde 72,00 € · 4 tiendas»', (await linea('carta-1')) === 'Desde 72,00 € · 4 tiendas', await linea('carta-1'))
  check('una: su precio y su nombre («1.200,00 € · RyuCards»)', (await linea('carta-2')) === '1.200,00 € · RyuCards', await linea('carta-2'))
  check('sin precio: «En 2 tiendas»', (await linea('carta-3')) === 'En 2 tiendas', await linea('carta-3'))
  check('el precio de arriba, como estaba: sin «CM» y con su bandera', !/CM/.test(await p.locator('[data-merc="carta-1"] .mc-merc-fila').first().textContent()) && (await p.locator('[data-merc="carta-1"] .mc-merc-fila .pv-bandera').count()) >= 1)
  check('  …y ya no dice «En tienda:»', !/En tienda:/.test(await p.textContent('#mcMercadoRejilla')))

  console.log('── 2. El pop-up de la carta ──')
  await p.locator('[data-merc="carta-1"] [data-merc-ficha]').first().click(); await p.waitForTimeout(1800)
  const cajas = await p.$$eval('#mcMercadoFichaCuerpo .mc-merf-precio-caja', (xs) => xs.map((x) => x.innerText.replace(/\s+/g, ' ')))
  check('dos precios arriba: Cardmarket y «En tiendas desde 72,00 €»', cajas.length === 2 && /^Cardmarket/.test(cajas[0]) && /En tiendas desde 72,00\s€/.test(cajas[1]), JSON.stringify(cajas))
  check('«Todo · Personas · Tiendas» con sus cuentas', (await p.locator('[data-merf-ver]').allTextContents()).join('|') === 'Todo · 5|Personas · 1|Tiendas · 4', (await p.locator('[data-merf-ver]').allTextContents()).join('|'))
  const tarjetas = p.locator('#mcMercadoFichaTiendas .ent-tarjeta')
  check('una tarjeta por tienda, la más barata primero y marcada', (await tarjetas.count()) === 4 && /Norte Cartas/.test(await tarjetas.first().textContent()) && (await p.locator('.ent-tarjeta.ent-barata').count()) === 1 && /La más barata/.test(await tarjetas.first().textContent()))
  check('  …con su ciudad y si tiene local', /Bilbao · Con local/.test(await tarjetas.first().textContent()))
  check('  …chips: idioma con bandera, estado, versión y «De tu lista»', (await tarjetas.first().locator('.ent-chip .pv-bandera').count()) === 1 && /Inglés/.test(await tarjetas.first().textContent()) && /NM/.test(await tarjetas.first().textContent()) && /Holo/i.test(await tarjetas.first().textContent()) && /De tu lista/.test(await tarjetas.first().textContent()))
  check('  …la gradeada, con su etiqueta y sin estado; la oferta, tachada', (await tarjetas.nth(1).locator('.chapa-gradeo[data-casa="PSA"]').count()) === 1 && (await tarjetas.nth(1).locator('s.ent-antes').count()) === 1)
  check('  …tres a la vista y «Ver 1 tienda más»', (await p.locator('#mcMercadoFichaTiendas .ent-tarjeta:visible').count()) === 3 && /Ver 1 tienda más/.test(await p.textContent('[data-ent-mas]')))
  await p.click('[data-ent-mas]'); await p.waitForTimeout(200)
  check('  …que enseña la cuarta («Pregunta el precio»)', (await p.locator('#mcMercadoFichaTiendas .ent-tarjeta:visible').count()) === 4 && /Pregunta el precio/.test(await tarjetas.nth(3).textContent()))
  check('«Me interesa»: la conversación con esa línea dentro', (await tarjetas.first().locator('a.btn-primary').getAttribute('href')) === '/mensajes.html?with=t1&carta=st-1' && /Me interesa/.test(await tarjetas.first().locator('a.btn-primary').textContent()))
  check('«Su tienda»: su escaparate en esa carta', (await tarjetas.first().locator('a.btn-secondary').getAttribute('href')) === '/usuario/norte?carta=carta-1')
  check('la persona sigue con su «Proponer cambio»', (await p.locator('.mc-merf-persona [data-merf-proponer]').count()) === 1)
  check('  …y ya no dice «Ahora mismo nadie la da»', !/nadie la da/.test(await p.textContent('#mcMercadoFichaCuerpo')))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1236-ficha.png` })
  await p.click('[data-merf-ver="tiendas"]'); await p.waitForTimeout(300)
  check('«Tiendas»: solo las tiendas', (await p.locator('.mc-merf-persona:visible').count()) === 0 && (await p.locator('#mcMercadoFichaTiendas .ent-tarjeta:visible').count()) >= 3 && (await p.getAttribute('[data-merf-ver="tiendas"]', 'aria-pressed')) === 'true')
  await p.click('[data-merf-ver="personas"]'); await p.waitForTimeout(300)
  check('«Personas»: solo la persona', (await p.locator('.mc-merf-persona:visible').count()) === 1 && !(await p.isVisible('#mcMercadoFichaTiendas')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mi-coleccion.html?ver=mercado', { rpc: RPC, filas: { tienda_stock_fotos: [{ stock_id: 'st-2', frente: 't2/a.webp', dorso: 't2/b.webp' }] } })
  await p.locator('[data-merc="carta-1"] [data-merc-ficha]').first().click(); await p.waitForTimeout(1800)
  check('la tienda con fotos de su copia lleva «Ver fotos»', (await p.locator('[data-ent-fotos="st-2"]').count()) === 1 && (await p.locator('[data-ent-fotos]').count()) === 1)
  await p.click('[data-ent-fotos="st-2"]'); await p.waitForTimeout(700)
  check('  …que abre las dos encima', (await p.isVisible('#tdfVer[open]')) && (await p.locator('#tdfVer .tdf-hueco img').count()) === 2)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mi-coleccion.html?ver=mercado', { sesion: 'none', rpc: RPC })
  await p.locator('[data-merc="carta-1"] [data-merc-ficha]').first().click(); await p.waitForTimeout(1800)
  check('sin cuenta: «Me interesa» lleva a crear cuenta y vuelve a esa conversación', /^\/auth\.html\?registro=1&volver=%2Fmensajes\.html%3Fwith%3Dt1%26carta%3Dst-1/.test(await p.getAttribute('#mcMercadoFichaTiendas .ent-tarjeta a.btn-primary', 'href')))
  await ctx.close()
}
{
  const { tiendas_con_la_carta, ...sin } = RPC
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=mercado', { rpc: { ...sin, tiendas_que_tienen: QUE_TIENEN } })
  await p.locator('[data-merc="carta-1"] [data-merc-ficha]').first().click(); await p.waitForTimeout(1800)
  check('sin la migración: las tiendas de la función de antes', !errs.length && (await llamadas(p, 'tiendas_que_tienen')).length >= 1 && (await p.locator('#mcMercadoFichaTiendas .ent-tarjeta').count()) === 4, errs.join(' | '))
  check('  …y «Me interesa» va a su escaparate en esa carta (donde está el botón)', (await p.getAttribute('#mcMercadoFichaTiendas .ent-tarjeta a.btn-primary', 'href')) === '/usuario/norte?carta=carta-1')
  await ctx.close()
}

console.log('── 3. La pestaña «Tiendas» ──')
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=mercado', { rpc: RPC })
  await p.click('[data-merc-quien="tiendas"]'); await p.waitForTimeout(900)
  check('la franja con todas las tiendas: «Tiendas · 3» y «Ver todas»', !errs.length && (await p.isVisible('#mcMercadoTiendas')) && /Tiendas\s*· 3/.test(await p.textContent('.mc-mercado-tiendas-titulo')) && (await p.getAttribute('#mcMercadoTiendas a.link-btn', 'href')) === '/tiendas', errs.join(' | '))
  const t = await p.$$eval('#mcMercadoTiendas .mc-tienda-tarjeta', (xs) => xs.map((x) => `${x.getAttribute('href')}|${x.innerText.replace(/\s+/g, ' ')}`))
  check('  …las de tu lista primero, con lo que enseñan', t.length === 3 && /^\/usuario\/norte\?lista=1\|/.test(t[0]) && /1\.240 cartas · 2 de tu lista/.test(t[0]) && /^\/usuario\/kanto\|.*1 carta/.test(t[2]), JSON.stringify(t))
  await p.locator('[data-merc="carta-1"] [data-merc-ficha]').first().click(); await p.waitForTimeout(1800)
  check('  …y la ficha que se abre desde aquí sale en «Tiendas»', (await p.getAttribute('[data-merf-ver="tiendas"]', 'aria-pressed')) === 'true' && (await p.locator('.mc-merf-persona:visible').count()) === 0)
  if (process.env.OUT) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.screenshot({ path: `${process.env.OUT}/1236-pestana.png` }) }
  await ctx.close()
}

console.log('── 3b. Dos despliegues mezclados (PINGU: «Importing binding name engancharEnTiendas is not found») ──')
{
  // El primer en-tiendas.js que llega es el de ANTES (sin el export nuevo),
  // como cuando la caché sirve un módulo viejo a uno nuevo: el Mercado no
  // pinta el error, se recarga una vez y sale bien.
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([r, c, st]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__RPC_RESPUESTAS__ = r
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 't1' }] }
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = st
  }, [{ mercado_con_tiendas: MERCADO, tiendas_con_mis_deseos: [] }, CARTAS, SETS])
  let viejo = true
  await ctx.route(/\/js\/en-tiendas\.js/, async (r) => {
    if (!viejo) return r.continue()
    viejo = false
    r.fulfill({ status: 200, contentType: 'text/javascript', body: "export async function tiendasQueTienen() { return [] }\nexport function enTiendasHtml() { return '' }\nexport async function pintarEnTiendas() {}\n" })
  })
  const p = await ctx.newPage()
  let cargas = 0
  p.on('load', () => cargas++)
  await p.goto(`${BASE}/mi-coleccion.html?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(5000)
  const txt = await p.textContent('#mcMercadoRejilla').catch(() => '')
  check('se recarga sola una vez y el Mercado sale (sin el error del navegador)', cargas >= 2 && !/Importing binding|export named/i.test(txt) && (await p.locator('[data-merc="carta-1"]').count()) >= 1 && (await p.evaluate(() => Boolean(sessionStorage.getItem('pd-recarga-despliegue')))), `cargas ${cargas} · ${txt.slice(0, 120)}`)
  await ctx.close()
}

console.log('── 4. /tiendas: la agenda ──')
{
  const { p, ctx, errs } = await abrir('/tiendas', { rpc: { tiendas_agenda: '__AGENDA__' } })
  check('sin errores; el <h1> es «Tiendas»', !errs.length && (await p.textContent('h1')).trim() === 'Tiendas', errs.join(' | '))
  const t = await p.$$eval('#tagRejilla .tag-tarjeta', (xs) => xs.map((x) => `${x.getAttribute('href')}|${x.innerText.replace(/\s+/g, ' ')}`))
  check('las tres tiendas, a su escaparate (con lo de tu lista si tienen)', t.length === 3 && /^\/usuario\/norte\?lista=1\|N Norte Cartas Bilbao · Con local 1\.240 cartas · 3 productos 2 de tu lista/.test(t[0]) && /^\/usuario\/kanto\|/.test(t[2]), JSON.stringify(t))
  check('  …la portada de la que la tiene', /banner\.webp/.test(await p.getAttribute('#tagRejilla .tag-tarjeta:nth-child(2) .tag-portada', 'style')))
  check('  …«3 tiendas» y las ciudades en el desplegable', (await p.textContent('#tagCuenta')) === '3 tiendas' && (await p.locator('#tagCiudad option').count()) === 4)
  check('  …y «De tu lista» se ofrece con cuenta', await p.isVisible('[data-tag-filtro="lista"]'))
  await p.fill('#tagBusca', 'ryu'); await p.waitForTimeout(600)
  check('buscar', (await llamadas(p, 'tiendas_agenda')).at(-1).p_texto === 'ryu' && (await p.locator('#tagRejilla .tag-tarjeta').count()) === 1)
  await p.fill('#tagBusca', ''); await p.waitForTimeout(600)
  await p.click('[data-tag-filtro="local"]'); await p.waitForTimeout(400)
  check('«Con local»', (await llamadas(p, 'tiendas_agenda')).at(-1).p_con_local === true && (await p.locator('#tagRejilla .tag-tarjeta').count()) === 1 && (await p.getAttribute('[data-tag-filtro="local"]', 'aria-pressed')) === 'true')
  await p.click('[data-tag-filtro="local"]'); await p.waitForTimeout(400)
  await p.selectOption('#tagCiudad', 'Madrid'); await p.waitForTimeout(400)
  check('la ciudad', (await llamadas(p, 'tiendas_agenda')).at(-1).p_ciudad === 'Madrid' && (await p.locator('#tagRejilla .tag-tarjeta').count()) === 1)
  await p.selectOption('#tagCiudad', ''); await p.fill('#tagBusca', 'zzz'); await p.waitForTimeout(600)
  check('ninguna: lo dice, con «Quitar los filtros»', /Ninguna tienda cumple esto/.test(await p.textContent('#tagRejilla')))
  await p.click('[data-tag-limpiar]'); await p.waitForTimeout(400)
  check('  …que las vuelve a enseñar', (await p.locator('#tagRejilla .tag-tarjeta').count()) === 3 && (await p.inputValue('#tagBusca')) === '')
  check('«Pide acceso» sigue debajo, con su formulario', (await p.isVisible('#tiendasForm')) && /¿Tienes una tienda/.test(await p.textContent('#para-tiendas')))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1236-agenda.png` })
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas', { sesion: 'none', movil: true, rpc: { tiendas_agenda: '__AGENDA__' } })
  check('sin cuenta, en el móvil: sin «De tu lista» y sin salirse de ancho', !(await p.isVisible('[data-tag-filtro="lista"]')) && (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390 && (await p.locator('#tagRejilla .tag-tarjeta').count()) === 3)
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1236-agenda-movil.png`, fullPage: true })
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tiendas', {})
  check('sin la migración: sin agenda, y la página de pedir acceso como antes', !errs.length && !(await p.isVisible('#tiendasAgenda')) && !(await p.isVisible('#tagLema')) && (await p.isVisible('#tiendasForm')), errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
