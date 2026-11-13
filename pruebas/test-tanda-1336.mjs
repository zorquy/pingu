// Tanda 1336 — Redes: eventos (cada uno y «Esta semana»), lanzamientos («Sale
// el viernes» y, ya en tiendas, «Las más caras»), lo nuevo del mes (de
// novedades.json) en /admin → Redes; y «Compartir» con imagen en las páginas
// públicas: guía, torneo, evento y el cartel de /lanzamientos.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const FOTOS = process.env.PD_FOTOS || ''
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
const R = await import(`${REPO}/js/redes-textos.js`)
const ahora = new Date('2026-11-13T12:00:00Z') // viernes
check('cuándo sale: hoy, mañana, el día de la semana, la fecha, y «en tiendas desde»', R.cuandoSale('2026-11-13', ahora) === '¡Sale hoy!' && R.cuandoSale('2026-11-14', ahora) === 'Sale mañana' && R.cuandoSale('2026-11-18', ahora) === 'Sale el miércoles' && R.cuandoSale('2026-12-03', ahora) === 'Sale el 3 de diciembre' && R.cuandoSale('2026-11-07', ahora) === 'En tiendas desde el 7 de noviembre')
const EV = { id: 'e1', slug: 'madrid-cs', nombre: 'Madrid Card Show', tipo: 'card_show', publicado: true, empieza: '2026-11-21T09:00:00Z', termina: '2026-11-21T19:00:00Z', horario: [{ dia: '2026-11-21', desde: '10:00', hasta: '20:00' }], ciudad: 'Madrid', sitio: 'IFEMA', entradas: [{ nombre: 'General', precio: 5 }, { nombre: 'VIP', precio: 15 }], color: '#3a5fb8', created_at: '2026-11-10T10:00:00Z' }
const pe = R.piezaDeEvento(EV, { ahora })
check('evento: /eventos/<slug>, tipo, fecha, sitio y «desde 5 €»', pe.url === 'https://pokedoc.es/eventos/madrid-cs' && /^Card show · Sábado, 21 de noviembre/.test(pe.linea) && /IFEMA, Madrid/.test(pe.linea) && /Entrada: desde 5 €/.test(pe.x.texto) && pe.diapositivas[0].datos.precio === 'Desde 5 €', pe.linea + ' | ' + pe.x.texto)
check('  …uno que ya pasó o sin publicar, nada', R.piezaDeEvento({ ...EV, empieza: '2026-11-01T09:00:00Z', termina: '2026-11-01T19:00:00Z' }, { ahora }) === null && R.piezaDeEvento({ ...EV, publicado: false }, { ahora }) === null)
const OTRO = { ...EV, id: 'e2', slug: 'bilbao', nombre: 'Trade night Bilbao', tipo: 'trade_night', empieza: '2026-11-15T17:00:00Z', termina: null, horario: [{ dia: '2026-11-15', desde: '18:00', hasta: '22:00' }], ciudad: 'Bilbao' }
const sem = R.piezaSemanaDeEventos([EV, OTRO, { ...EV, slug: 'lejos', empieza: '2026-12-20T10:00:00Z', horario: [{ dia: '2026-12-20', desde: '10:00', hasta: '14:00' }] }], { ahora: new Date('2026-11-14T10:00:00Z') })
check('«Esta semana»: los de los próximos siete días, en orden, con su clave del lunes', sem?.clave === 'eventos:semana:2026-11-09' && sem.diapositivas[0].datos.filas.map((f) => f.nombre).join() === 'Trade night Bilbao,Madrid Card Show' && sem.titulo === 'Esta semana, 2 eventos', JSON.stringify(sem?.diapositivas[0].datos))
check('  …con uno solo, no hay resumen', R.piezaSemanaDeEventos([EV], { ahora }) === null)
const SET = { id: 'me3', nombre: 'Perfect Order', fecha: '2026-11-07', cartas: 124, imagen: 'https://x/logo.png', href: '/cartas.html?ver=album&set=me3&catalogo=WEST' }
const CARAS = [{ nombre: 'Mega Zygarde ex', precio: 120.4, imagen: null }, { nombre: 'Rosa', precio: 40, imagen: null }, { nombre: 'Lillie', precio: 22.3, imagen: null }]
const pl = R.piezaDeLanzamiento(SET, { ahora, caras: CARAS })
check('lanzamiento ya en tiendas: carrusel con «Las más caras» y los precios', pl.clave === 'lanzamiento:me3:salio' && pl.diapositivas.map((d) => d.pintor).join() === 'lanzamiento,lanzamiento-caras' && pl.diapositivas[1].datos.cartas.map((c) => c.precioTexto).join('|') === '120 €|40 €|22,30 €', JSON.stringify(pl.diapositivas[1]?.datos.cartas.map((c) => c.precioTexto)))
check('  …su enlace es el álbum del set en /cartas', pl.url === 'https://pokedoc.es/cartas?ver=album&set=me3&catalogo=WEST')
const pv = R.piezaDeLanzamiento({ ...SET, id: 'me4', fecha: '2026-11-20' }, { ahora, caras: CARAS })
check('lo que viene: una imagen, «Sale el 20 de noviembre», sin precios', pv.clave === 'lanzamiento:me4:sale' && pv.diapositivas.length === 1 && /Sale el 20 de noviembre/.test(pv.linea))
check('fuera de la ventana (45 días o 14 atrás), nada; con `todos`, sí', R.piezaDeLanzamiento({ ...SET, fecha: '2027-03-01' }, { ahora }) === null && R.piezaDeLanzamiento({ ...SET, fecha: '2027-03-01' }, { ahora, todos: true }) !== null)
const NOV = JSON.parse(readFileSync(`${REPO}/novedades.json`, 'utf8'))
const pn = R.piezaDeNovedadesDelMes(NOV, '2026-10')
check('lo nuevo de octubre: portada y sus tres destacadas', pn?.clave === 'novedades:2026-10' && pn.diapositivas.length === 4 && pn.titulo === 'Lo nuevo de octubre en PokeDoc' && pn.diapositivas[1].datos.titulo === NOV.destacadas.find((d) => d.mes === '2026-10').titulo)
check('  …un mes sin nada, nada', R.piezaDeNovedadesDelMes(NOV, '2019-01') === null)
check('los filtros nuevos: Eventos, Lanzamientos y Novedades', ['evento', 'lanzamiento', 'novedades'].every((k) => R.TIPOS[k]))

const b = await chromium.launch()
const h = (d) => new Date(Date.now() + d * 3600e3).toISOString()
const dia = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10)
const EVENTO = { ...EV, slug: 'iberian', nombre: 'Iberian Card Show', empieza: h(48), termina: h(56), horario: [{ dia: dia(2), desde: '10:00', hasta: '19:00' }], created_at: h(-5) }
const EVENTO2 = { ...OTRO, slug: 'bilbao', empieza: h(96), termina: null, horario: [{ dia: dia(4), desde: '18:00', hasta: '22:00' }], created_at: h(-6) }
const SETS = [
  { id: 'me3', name: 'Perfect Order', market: 'WEST', release_date: dia(-6), card_count_official: 124, serie_id: 'me', logo_path: null, oculto: false },
  { id: 'me4', name: 'Chaos Rising', market: 'WEST', release_date: dia(9), card_count_official: 130, serie_id: 'me', logo_path: null, oculto: false },
]
const CARTAS = [['me3-1', 'Mega Zygarde ex', 120.4], ['me3-2', 'Rosa', 40], ['me3-3', 'Lillie', 22.3], ['me3-4', 'Pikachu', 0.5]]
async function abrir(ruta, { quien = 'admin-1', movil = false, filas = {}, extra = '' } = {}) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block', hasTouch: movil, isMobile: movil, acceptDownloads: true })
  await ctx.addInitScript(({ quien, filas, extra }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_FILAS__ = filas
    if (extra) eval(extra)
  }, { quien, filas, extra })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'|ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { page, ctx, errores }
}
// La hoja de compartir abierta: la imagen dibujada y el enlace de X.
async function hoja(page) {
  await page.waitForSelector('#chPrevia canvas, #chPrevia img', { timeout: 15000 }).catch(() => {})
  return page.evaluate(() => {
    const c = document.querySelector('#chPrevia canvas, #chPrevia img')
    return { titulo: document.querySelector('#chTitulo')?.textContent, imagen: Boolean(c), x: document.querySelector('[data-ch-x]')?.getAttribute('href') || '' }
  })
}

console.log('── /admin → Redes con lo nuevo ──')
{
  const { page, ctx, errores } = await abrir('/admin/?ver=redes', {
    filas: {
      eventos: [EVENTO, EVENTO2],
      tcg_sets: SETS,
      tcg_cards: CARTAS.map(([id, name]) => ({ id, name, set_id: 'me3', local_id: id.split('-')[1], market: 'WEST', image_path: null })),
      tcg_card_prices: CARTAS.map(([card_id, , p]) => ({ card_id, cm_trend: p })),
      guides: [], tournaments: [], redes_compartido: [],
    },
  })
  await page.waitForSelector('.rd-fila', { timeout: 15000 }).catch(() => {})
  const claves = await page.evaluate(() => [...document.querySelectorAll('.rd-fila')].map((f) => f.dataset.clave))
  check('salen los dos eventos y «Esta semana»', ['evento:iberian', 'evento:bilbao'].every((k) => claves.includes(k)) && claves.some((k) => k.startsWith('eventos:semana:')), claves.join())
  check('salen el que salió (con sus caras) y el que viene', claves.includes('lanzamiento:me3:salio') && claves.includes('lanzamiento:me4:sale'), claves.join())
  check('sale lo nuevo del mes de novedades.json', claves.some((k) => /^novedades:\d{4}-\d{2}$/.test(k)), claves.join())
  check('los filtros nuevos, con sus cuentas', (await page.locator('[data-rd-filtro="evento"] b').textContent()) === '3' && (await page.locator('[data-rd-filtro="lanzamiento"] b').textContent()) === '2')
  const sal = page.locator('.rd-fila[data-clave="lanzamiento:me3:salio"]')
  check('  …el lanzamiento ya en tiendas es un carrusel de 2', /carrusel de 2/.test(await sal.locator('.rd-linea').textContent()))
  await sal.locator('[data-rd-ig]').click()
  await page.waitForFunction(() => document.querySelectorAll('.rd-fila[data-clave="lanzamiento:me3:salio"] canvas.rd-previa').length === 2, null, { timeout: 15000 }).catch(() => {})
  check('  …y dibuja sus dos imágenes', (await sal.locator('canvas.rd-previa').count()) === 2)
  check('  …el texto lleva las tres más caras con su precio', /1\. Mega Zygarde ex: 120 €/.test(await sal.locator('.rd-texto').textContent()))
  if (FOTOS) {
    mkdirSync(FOTOS, { recursive: true })
    const sacar = async (clave, nombre) => {
      const f = page.locator(`.rd-fila[data-clave="${clave}"]`)
      if ((await f.locator('.rd-cajon').isHidden())) await f.locator('[data-rd-ig]').click()
      await page.waitForTimeout(1500)
      const datos = await f.evaluate((el) => [...el.querySelectorAll('canvas.rd-previa')].map((c) => c.toDataURL('image/png')))
      datos.forEach((d, i) => writeFileSync(`${FOTOS}/${nombre}-${i + 1}.png`, Buffer.from(d.split(',')[1], 'base64')))
    }
    await sacar('lanzamiento:me3:salio', 'lanz')
    await sacar('evento:iberian', 'evento')
    const semana = (await page.evaluate(() => document.querySelector('.rd-fila[data-clave^="eventos:semana"]')?.dataset.clave))
    if (semana) await sacar(semana, 'semana')
    const nov = (await page.evaluate(() => document.querySelector('.rd-fila[data-clave^="novedades:"]')?.dataset.clave))
    if (nov) await sacar(nov, 'novedades')
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── «Compartir» en las páginas ──')
{
  const { page, ctx, errores } = await abrir('/eventos/iberian', { quien: 'user-1', extra: `window.__FAKE_EVENTOS__ = ${JSON.stringify([EVENTO])}` })
  await page.waitForSelector('#evCompartir', { timeout: 15000 }).catch(() => {})
  await page.click('#evCompartir').catch(() => {})
  const r = await hoja(page)
  check('evento: la hoja con su imagen y «Publicar en X» con el enlace de la ficha', r.imagen && r.titulo === 'Compartir el evento' && r.x.includes(encodeURIComponent('https://pokedoc.es/eventos/iberian')), JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const GUIA = { id: 'g1', slug: 'dragapult-ex', title: 'Cómo jugar Dragapult ex', description: 'La lista y el plan.', kind: 'guide', published_at: h(-30), reference_blocks: [{ type: 'richtext', html: '<h2>La lista</h2><p>Cuatro Dreepy.</p><h2>El plan</h2><p>Rápido.</p>' }] }
  const { page, ctx, errores } = await abrir('/guia/dragapult-ex', { quien: 'user-1', extra: `window.__FAKE_GUIAS__ = ${JSON.stringify([GUIA])}` })
  await page.waitForSelector('#btnCompartir', { timeout: 15000 }).catch(() => {})
  await page.click('#btnCompartir').catch(() => {})
  const r = await hoja(page)
  check('guía: la hoja con la portada dibujada y su enlace /guia/<slug>', r.imagen && r.titulo === 'Compartir la guía' && r.x.includes(encodeURIComponent('https://pokedoc.es/guia/dragapult-ex')), JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const T = { id: 't1', slug: 'copa-delta', name: 'Copa Delta Reign', status: 'registration_open', format: 'swiss', swiss_rounds: 4, max_players: 16, start_at: h(24 * 5), admin_id: 'admin-1' }
  const { page, ctx, errores } = await abrir('/torneo?slug=copa-delta', { quien: 'user-1', extra: `window.__FAKE_TORNEOS__ = ${JSON.stringify([T])}; window.__FAKE_INSCRIPCIONES__ = []` })
  await page.waitForSelector('#btnCompartirTorneo', { timeout: 15000 }).catch(() => {})
  await page.click('#btnCompartirTorneo').catch(() => {})
  const r = await hoja(page)
  check('torneo: la hoja con el anuncio (las plazas) y el enlace de la ficha', r.imagen && r.titulo === 'Compartir el torneo' && r.x.includes(encodeURIComponent('https://pokedoc.es/torneo?slug=copa-delta')) && /Quedan%2016%20plazas/.test(r.x), JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir('/lanzamientos', { quien: 'user-1', filas: { tcg_sets: SETS } })
  await page.waitForSelector('[data-lanz-compartir]', { timeout: 15000 }).catch(() => {})
  check('lanzamientos: el cartel del siguiente lleva «Compartir»', (await page.locator('#proximoDestacado [data-lanz-compartir]').count()) === 1)
  await page.click('[data-lanz-compartir]').catch(() => {})
  const r = await hoja(page)
  check('  …y abre la hoja con su imagen y el álbum del set', r.imagen && r.titulo === 'Compartir el lanzamiento' && r.x.includes(encodeURIComponent('set=me4')), JSON.stringify(r))
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/lanz-pagina.png` })
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
