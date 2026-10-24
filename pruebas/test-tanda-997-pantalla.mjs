// Tanda 997 — compartir una partida o un torneo de /mis-partidas en una imagen.
//
// PINGU: «al lado de cada partida suelta o cada torneo, si lo abres, debería
// haber un botón de compartir que genere una imagen con el resultado, así
// bonito, que ponga PokeDoc». Lo que se mira: lo puro (textos, récord,
// marcador, rondas que caben); que el botón está en cada partida suelta y en
// cada torneo con rondas (no en uno vacío); que abre la hoja de compartir con
// su texto y una imagen que se puede exportar (con los sprites, que pasan por
// /sprite); y las imágenes en los dos formatos, guardadas para mirarlas.
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo puro ──')
const P = await import(`${RAIZ}/js/partida-imagen.js`)
check('récord sin empates «3-1», con empates «3-1-1»', P.recordDe([{ resultado: 'win' }, { resultado: 'win' }, { resultado: 'win' }, { resultado: 'loss' }]).texto === '3-1' && P.recordDe([{ resultado: 'win' }, { resultado: 'draw' }, { resultado: 'loss' }]).texto === '1-1-1')
check('marcador de un mejor de tres', P.marcadorDe([{ r: 'W' }, { r: 'L' }, { r: 'W' }]) === '2-1' && P.marcadorDe(null) === '')
const tp = P.textoDePartida({ mio: { nombre: 'Dragapult ex' }, rival: { nombre: 'Gardevoir ex' }, resultado: 'win', formato: 'bo3', juegos: [{ r: 'W' }, { r: 'L' }, { r: 'W' }], donde: 'Liga de Cádiz', fecha: '2026-10-24' })
check('el texto de una partida dice resultado, marcador, mazos, sitio y el enlace', /✅ Victoria 2-1 con Dragapult ex contra Gardevoir ex/.test(tp) && /Liga de Cádiz · 24 de octubre de 2026/.test(tp) && /pokedoc\.es/.test(tp), tp)
check('  …y un bye no tiene rival', /con Dragapult ex bye/.test(P.textoDePartida({ mio: { nombre: 'Dragapult ex' }, resultado: 'win', tipo: 'bye' })))
const tt = P.textoDeTorneo({ nombre: 'Liga del jueves', donde: 'Tienda', fecha: '2026-10-23', mazo: { nombre: 'Dragapult ex' }, rondas: [{ resultado: 'win' }, { resultado: 'loss' }] })
check('el texto de un torneo dice el récord y el mazo', /🏆 Liga del jueves: 1-1 con Dragapult ex/.test(tt) && /pokedoc\.es/.test(tt), tt)
const r = P.rondasQueCaben(Array.from({ length: 12 }, (_, i) => ({ i })), 9)
check('si no caben todas las rondas, se enseñan 8 y «y 4 más»', r.visibles.length === 8 && r.fuera === 4)
check('mis-partidas.js lo carga por import() (la página no lo baja hasta pulsar)', /import\('\.\/partida-imagen\.js'\)/.test(readFileSync(`${RAIZ}/js/mis-partidas.js`, 'utf8')) && !/from '\.\/partida-imagen\.js'/.test(readFileSync(`${RAIZ}/js/mis-partidas.js`, 'utf8')))

const SPRITE = readFileSync(`${RAIZ}/assets/app-icon-192.png`)
const TORNEO = { id: 'logt-1', nombre: 'Liga del jueves', donde: 'Tienda de Cádiz', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult ex', jugado_el: '2026-10-23' }
const VACIO = { id: 'logt-2', nombre: 'Torneo sin rondas', donde: 'Casa', mi_mazo_nombre: 'Pikachu ex', jugado_el: '2026-10-20' }
const rond = (id, rival, resultado, extra = {}) => ({ id, user_id: 'admin-1', torneo_id: 'logt-1', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult ex', rival_mazo_nombre: rival, resultado, tipo: 'normal', jugada_el: '2026-10-23', created_at: `2026-10-23T1${id.slice(-1)}:00:00Z`, ...extra })
const PARTIDAS = [
  rond('r1', 'Gardevoir ex', 'win', { formato: 'bo3', juegos: [{ r: 'W', s: '1' }, { r: 'L', s: '2' }, { r: 'W', s: '1' }] }),
  rond('r2', 'Charizard ex', 'loss'),
  rond('r3', 'Raging Bolt ex', 'win'),
  rond('r4', 'Lugia VSTAR', 'draw', { tipo: 'id' }),
  rond('r5', 'Gholdengo ex', 'win'),
  { id: 's1', user_id: 'admin-1', torneo_id: null, mi_mazo_nombre: 'Dragapult ex', rival_mazo_nombre: 'Gardevoir ex', resultado: 'win', tipo: 'normal', jugada_el: '2026-10-24', donde: 'Escalera de TCG Live', formato: 'bo3', juegos: [{ r: 'W', s: '1' }, { r: 'L', s: '2' }, { r: 'W', s: '1' }] },
]
const browser = await chromium.launch()
async function abrir(movil = false) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((s) => {
    Object.assign(window, s)
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 })) } catch {}
  }, { __FAKE_SESSION__: 'admin-1', __FAKE_LOG_TORNEOS__: [TORNEO, VACIO], __FAKE_PARTIDAS__: PARTIDAS })
  // Los sprites: ni Limitless ni las de respaldo se alcanzan desde aquí.
  const pedidos = []
  await ctx.route(/r2\.limitlesstcg\.net|\/sprite\/|jsdelivr|githubusercontent/, (ruta) => { pedidos.push(ruta.request().url()); ruta.fulfill({ status: 200, contentType: 'image/png', body: SPRITE, headers: { 'access-control-allow-origin': '*' } }) })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { ctx, page, errores, pedidos }
}

console.log('── 1. Los botones ──')
{
  const { ctx, page, errores } = await abrir()
  await page.locator('[data-abrir-torneo="logt-1"]').click()
  await page.waitForTimeout(300)
  check('un torneo abierto con rondas tiene «Compartir»', (await page.locator('[data-compartir-torneo="logt-1"]').count()) === 1)
  await page.locator('[data-abrir-torneo="logt-2"]').click()
  await page.waitForTimeout(300)
  check('  …uno sin rondas, no', (await page.locator('[data-compartir-torneo="logt-2"]').count()) === 0)
  await page.locator('[data-vista="sueltas"]').click()
  await page.waitForTimeout(400)
  check('cada partida suelta tiene «Compartir»', (await page.locator('[data-compartir="s1"]').count()) === 1)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La hoja y la imagen ──')
for (const movil of [false, true]) {
  const que = movil ? 'móvil' : 'PC'
  const { ctx, page, errores, pedidos } = await abrir(movil)
  await page.locator('[data-abrir-torneo="logt-1"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-compartir-torneo="logt-1"]').click()
  await page.waitForSelector('dialog[open]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const hoja = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]')
    return d ? { texto: d.innerText.replace(/\s+/g, ' ').slice(0, 400), imgs: [...d.querySelectorAll('img')].map((i) => ({ src: i.src.slice(0, 30), w: i.naturalWidth, h: i.naturalHeight })) } : null
  })
  check(`${que}: «Compartir» del torneo abre la hoja`, !!hoja, '')
  check(`${que}:   …con su título y las formas de Instagram`, hoja && /Compartir el torneo/.test(hoja.texto) && /Historia/.test(hoja.texto) && /Publicación/.test(hoja.texto), hoja?.texto)
  check(`${que}:   …y la imagen ya dibujada (vertical 1080 de ancho)`, hoja && hoja.imgs.some((i) => i.w === 1080), JSON.stringify(hoja?.imgs))
  check(`${que}: los sprites pasan por /sprite (el lienzo se puede exportar)`, pedidos.some((u) => /\/sprite\//.test(u)), pedidos.slice(0, 3).join(' '))
  if (!movil) await page.screenshot({ path: '/tmp/997-hoja.png' })
  check(`${que}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Las imágenes, en los dos formatos ──')
{
  const { ctx, page } = await abrir()
  const fotos = await page.evaluate(async () => {
    const m = await import('/js/partida-imagen.js')
    const cargar = (u) => new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok({ img: i }); i.onerror = () => ok(null); i.src = u })
    const s = await cargar('/sprite/dragapult')
    const mazo = (nombre) => ({ nombre, sprites: s ? [s] : [] })
    const partida = { mio: mazo('Dragapult ex'), rival: mazo('Gardevoir ex'), resultado: 'win', formato: 'bo3', juegos: [{ r: 'W' }, { r: 'L' }, { r: 'W' }], donde: 'Escalera de TCG Live', fecha: '2026-10-24' }
    const rivales = ['Gardevoir ex', 'Charizard ex', 'Raging Bolt ex', 'Lugia VSTAR', 'Gholdengo ex', 'Terapagos ex']
    const torneo = { nombre: 'Liga del jueves', donde: 'Tienda de Cádiz', fecha: '2026-10-23', mazo: mazo('Dragapult ex'), rondas: rivales.map((n, i) => ({ rival: mazo(n), resultado: ['win', 'loss', 'win', 'draw', 'win', 'win'][i], tipo: i === 3 ? 'id' : 'normal', formato: i === 0 ? 'bo3' : null, juegos: i === 0 ? [{ r: 'W' }, { r: 'L' }, { r: 'W' }] : null, ronda: i + 1 })) }
    const largo = { ...torneo, nombre: 'Regional de Madrid con un nombre muy largo', rondas: Array.from({ length: 14 }, (_, i) => ({ ...torneo.rondas[i % 6], ronda: i + 1 })) }
    const fuera = {}
    for (const f of ['historia', 'apaisada']) {
      fuera[`partida-${f}`] = m.pintarPartida(document.createElement('canvas'), partida, f).toDataURL('image/png')
      fuera[`torneo-${f}`] = m.pintarTorneo(document.createElement('canvas'), torneo, f).toDataURL('image/png')
    }
    fuera['torneo-largo'] = m.pintarTorneo(document.createElement('canvas'), largo, 'historia').toDataURL('image/png')
    fuera['partida-bye'] = m.pintarPartida(document.createElement('canvas'), { mio: mazo('Dragapult ex'), resultado: 'win', tipo: 'bye', donde: 'Liga', fecha: '2026-10-23' }, 'historia').toDataURL('image/png')
    return fuera
  })
  for (const [k, v] of Object.entries(fotos)) {
    writeFileSync(`/tmp/997-${k}.png`, Buffer.from(v.split(',')[1], 'base64'))
  }
  check('salen las seis imágenes y se pueden exportar', Object.keys(fotos).length === 6 && Object.values(fotos).every((v) => v.startsWith('data:image/png') && v.length > 20000), Object.keys(fotos).join())
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
