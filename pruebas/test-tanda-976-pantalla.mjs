// Tanda 976 — /admin → Colecciones enseña lo MISMO que la web, y se puede
// mover y borrar.
//
// PINGU: «veo duplicado Silver Tempest Trainer Gallery… en la web no están…
// salió una carta y salió ¿de qué expansión es? y era una Trainer Gallery y
// la misma Trainer Gallery… revísame que lo que hay en el panel de admin es
// lo que hay en colecciones… no te sale un menú de mover… ni las expansiones
// ni las eras se pueden eliminar».
//
// Se mira: que el panel pliegue las galerías dentro de su expansión (y las
// deje editar), que las escondidas vayan aparte y lo de Pocket no salga; que
// las colecciones de cada era sean las de la web; «Mover a…» en cada fila y
// la barra de las marcadas a la vista; borrar una colección y una era; y que
// el reto «¿De qué expansión es?» no ofrezca una galería como opción.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const set = (id, name, release_date, serie_id, extra = {}) => ({ id, name, release_date, serie_id, market: 'WEST', card_count_official: 100, card_count_total: 100, oculto: false, ...extra })
const SETS = [
  set('sv8', 'Chispas Fulgurantes', '2024-11-08', 'sv'),
  set('swsh12', 'Tempestad Plateada', '2022-11-11', 'swsh', { tcggo_id: 100, card_count_official: 195 }),
  set('swsh12tg', 'Silver Tempest Trainer Gallery', '2022-11-11', 'swsh', { tcggo_id: 100, card_count_official: 30 }),
  set('swsh11', 'Origen Perdido', '2022-09-09', 'swsh', { tcggo_id: 99, card_count_official: 196 }),
  set('swsh11tg', 'Lost Origin Trainer Gallery', '2022-09-09', 'swsh', { tcggo_id: 99, card_count_official: 30 }),
  set('vieja', 'Una repetida', '2022-10-01', 'swsh', { oculto: true }),
  set('base1', 'Set Básico', '1999-01-09', 'base'),
  set('A1', 'Genetic Apex', '2024-10-30', 'tcgp'),
]
const ERAS = [
  { market: 'WEST', id: 'sv', nombre: 'Escarlata y Púrpura', orden: 10 },
  { market: 'WEST', id: 'swsh', nombre: 'Espada y Escudo', orden: 20 },
  { market: 'WEST', id: 'base', nombre: 'Base', orden: 90 },
  { market: 'WEST', id: 'vacia', nombre: 'Una era vacía', orden: 95 },
]

console.log('── 1. El reto «¿De qué expansión es?» ──')
{
  const { elegirExpansion } = await import(`${RAIZ}/netlify/functions/que-expansion.mjs`)
  const S = [
    ...['swsh12', 'swsh11', 'swsh10', 'swsh9', 'swsh8', 'swsh7'].map((id, i) => set(id, `Expansión ${id}`, `2022-0${9 - i}-01`, 'swsh', { tcggo_id: 200 + i })),
    ...['swsh12', 'swsh11', 'swsh10', 'swsh9', 'swsh8', 'swsh7'].map((id, i) => set(`${id}tg`, 'Trainer Gallery', `2022-0${9 - i}-01`, 'swsh', { tcggo_id: 200 + i, card_count_official: 30 })),
  ]
  // Todas las cartas son de una galería: la respuesta buena tiene que ser su expansión.
  const CARTAS = Array.from({ length: 30 }, (_, i) => ({ id: `k${i}`, set_id: S[6 + (i % 6)].id, image_path: 'x', tcg_sets: { name: 'Trainer Gallery' } }))
  const hacer = (guardadas) => async (ruta, o = {}) => {
    if (ruta.startsWith('tcg_sets')) return { datos: S }
    if (ruta.startsWith('retos_reto_del_dia')) return { datos: guardadas.length ? [{ datos: guardadas[0].datos }] : [] }
    if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: CARTAS.length }
    const off = /offset=(\d+)/.exec(ruta)
    if (off) return { datos: [CARTAS[Number(off[1])]] }
    const ids = decodeURIComponent(/id=in\.\(([^)]*)\)/.exec(ruta)?.[1] || '').split(',').map((x) => x.replace(/"/g, ''))
    return { datos: CARTAS.filter((c) => ids.includes(c.id)) }
  }
  const gx = []
  const r = await elegirExpansion({ dia: '2026-10-22', pedir: hacer(gx), guardar: async (t, f) => gx.push(f) })
  const opciones = (r.rondas || []).flatMap((x) => x.opciones.map((s) => s.id))
  check('ninguna opción es una galería', r.rondas?.length === 5 && !opciones.some((id) => /tg$/.test(id)), JSON.stringify(r).slice(0, 240))
  check('  …la buena es la expansión de la carta', (r.rondas || []).every((x) => x.set_id === x.carta.set_id.replace(/tg$/, '') && x.opciones.some((s) => s.id === x.set_id)), JSON.stringify((r.rondas || []).map((x) => [x.carta.set_id, x.set_id])))
  check('  …cinco expansiones distintas', new Set((r.rondas || []).map((x) => x.set_id)).size === 5)
  check('  …y sin dos opciones que se llamen igual', (r.rondas || []).every((x) => new Set(x.opciones.map((s) => s.name)).size === x.opciones.length))
  // Lo guardado ANTES de la 976 (con galerías) se pliega al leerlo.
  const viejo = [{ datos: { rondas: [0, 1, 2, 3, 4].map((i) => ({ card_id: `k${i}`, set_ids: [S[6 + i].id, S[i].id, 'swsh7tg', 'swsh7'] })) } }]
  const r2 = await elegirExpansion({ dia: '2026-10-22', pedir: hacer(viejo), guardar: async () => {} })
  check('lo guardado de antes se lee plegado y sin repetidas', r2.rondas?.length === 5 && r2.rondas.every((x) => !x.opciones.some((s) => /tg$/.test(s.id)) && new Set(x.opciones.map((s) => s.id)).size === x.opciones.length && x.opciones.some((s) => s.id === x.set_id)), JSON.stringify(r2).slice(0, 240))
  const { opcionesDeExpansion } = await import(`${RAIZ}/js/que-expansion.js`)
  const iguales = [set('a', 'Uno', '2020-01-01', 'x'), set('b', 'Trainer Gallery', '2020-01-02', 'x'), set('c', 'Trainer Gallery', '2020-01-03', 'x'), set('d', 'Dos', '2020-01-04', 'x'), set('e', 'Tres', '2020-01-05', 'x')]
  const op = opcionesDeExpansion(iguales[0], iguales, '2026-10-22', 0)
  check('opcionesDeExpansion: dos con el mismo nombre no van juntas', op.length === 4 && op.filter((s) => s.name === 'Trainer Gallery').length === 1, op.map((s) => s.id).join())
  const juego = (await import('node:fs')).readFileSync(`${RAIZ}/js/que-expansion-juego.js`, 'utf8')
  check('la página corrige con la expansión de la ronda (`set_id`)', /const buena = \(r\) => r\?\.set_id \|\| r\?\.carta\?\.set_id/.test(juego) && !/=== r\.carta\.set_id|=== rondas\[i\]\.carta\.set_id/.test(juego))
}

const browser = await chromium.launch()
async function abrir(ruta, opciones = { viewport: { width: 1280, height: 900 } }) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES' })
  await ctx.addInitScript(([s, e]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = s
    window.__FAKE_FILAS__ = { tcg_eras: e }
    window.__FAKE_CARTAS__ = []
    window.__FAKE_COLECCION__ = []
  }, [SETS, ERAS])
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }))
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="40"/>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  page.on('dialog', (d) => d.accept())
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (ruta.startsWith('/admin')) {
    await page.evaluate(() => document.querySelector('[data-section="colecciones"]')?.click())
    await page.waitForTimeout(1200)
    await page.click('#coleccionesDesplegar')
    await page.waitForTimeout(300)
  }
  return { page, ctx, errores }
}
const tabla = (page, t) => page.evaluate((t) => window.__TABLAS__[t] || [], t)
const idsDeEra = (page, era) => page.$$eval(`#coleccionesLista > [data-era="${era}"] .col-sets > [data-set]`, (xs) => xs.map((x) => x.dataset.set))

console.log('\n── 2. El panel enseña lo que enseña la web ──')
let deLaWeb = []
{
  const { page, ctx, errores } = await abrir('/cartas?ver=album')
  check('la web sin errores', errores.length === 0, errores.join(' | '))
  deLaWeb = [...new Set(await page.$$eval('#mcEstanteriaRejilla [data-set]', (xs) => xs.map((x) => x.dataset.set)))].sort()
  check('la web pliega las galerías y quita escondidas y Pocket', deLaWeb.join() === 'base1,sv8,swsh11,swsh12', deLaWeb.join())
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir('/admin/')
  check('el panel sin errores', errores.length === 0, errores.join(' | '))
  const enEras = (await page.$$eval('#coleccionesLista > [data-era] .col-sets > [data-set]', (xs) => xs.map((x) => x.dataset.set))).sort()
  check('las colecciones de las eras son las de la web', enEras.join() === deLaWeb.join(), `${enEras.join()} ≠ ${deLaWeb.join()}`)
  check('  …la Trainer Gallery va DENTRO de su expansión', (await page.locator('[data-set="swsh12"] .col-hijo[data-editar="swsh12tg"]').count()) === 1 && (await page.locator('[data-set="swsh11"] .col-hijo[data-editar="swsh11tg"]').count()) === 1)
  check('  …y la expansión cuenta sus cartas con las de la galería', /225 cartas/.test(await page.locator('[data-set="swsh12"] .col-set-nombre').innerText()))
  check('la escondida va aparte, en «Escondidas»', (await page.locator('[data-escondidas] [data-set="vieja"]').count()) === 1 && (await page.locator('[data-era] [data-set="vieja"]').count()) === 0)
  check('Pocket no sale, y el resumen lo cuenta', (await page.locator('[data-set="A1"]').count()) === 0 && /1 de TCG Pocket/.test(await page.textContent('#coleccionesResumen')), await page.textContent('#coleccionesResumen'))
  await page.fill('#coleccionesFiltro', 'silver tempest trainer')
  await page.waitForTimeout(300)
  check('buscar la galería encuentra su expansión', (await idsDeEra(page, 'swsh')).join() === 'swsh12', (await idsDeEra(page, 'swsh')).join())
  await page.fill('#coleccionesFiltro', '')
  await page.waitForTimeout(300)
  await page.click('[data-set="swsh12"] .col-hijo')
  await page.waitForTimeout(300)
  check('la galería se edita sola, y el editor dice dónde se ve', /dentro de «Tempestad Plateada»/.test(await page.locator('.col-nota-padre').innerText()) && (await page.inputValue('#colNombre')) === 'Silver Tempest Trainer Gallery')
  await page.click('[data-cerrar-hoja]')

  console.log('\n── 3. Mover ──')
  await page.click('[data-mover="sv8"]')
  await page.waitForTimeout(300)
  check('cada fila tiene su «Mover a…»', await page.locator('.col-destino').count() >= 3)
  await page.check('input[name="colDestino"][value="swsh"]')
  await page.click('#colMoverAqui')
  await page.waitForTimeout(1200)
  check('  …y la mueve', (await tabla(page, 'tcg_sets')).find((s) => s.id === 'sv8')?.serie_id === 'swsh' && (await idsDeEra(page, 'swsh')).includes('sv8'))
  await page.check('[data-marcar="base1"]')
  const barra = await page.$eval('#coleccionesSeleccion', (b) => { const r = b.getBoundingClientRect(); return { pos: getComputedStyle(b).position, dentro: r.bottom <= innerHeight && r.top >= 0 && r.height > 0 } })
  check('la barra de las marcadas está fija y a la vista', barra.pos === 'fixed' && barra.dentro, JSON.stringify(barra))
  await page.click('#colQuitarMarcas')

  console.log('\n── 4. Borrar ──')
  await page.click('[data-borrar="vieja"]')
  await page.waitForTimeout(400)
  check('borrar enseña lo que se lleva y la salida de esconder', /se quedan sin carta/.test(await page.locator('.col-impacto').innerText()) && (await page.locator('#colBorrarYa').isDisabled()))
  await page.fill('#colBorrarConfirma', 'vieja')
  check('  …y solo se activa con el id escrito', await page.locator('#colBorrarYa').isEnabled())
  await page.click('#colBorrarYa')
  await page.waitForTimeout(1000)
  check('  …y la borra', !(await tabla(page, 'tcg_sets')).some((s) => s.id === 'vieja') && (await page.locator('[data-set="vieja"]').count()) === 0)
  await page.click('[data-borrar="swsh11"]')
  await page.waitForTimeout(400)
  check('una con galería avisa de que la galería se queda', /Lost Origin Trainer Gallery/.test(await page.locator('.col-impacto').innerText()) && /puede volver a crearla/.test(await page.locator('.col-impacto').innerText()))
  await page.click('#colBorrarEsconder')
  await page.waitForTimeout(1000)
  check('  …y «Mejor esconderla» la esconde como corrección', (await tabla(page, 'tcg_correcciones')).some((c) => c.id === 'swsh11' && c.columna === 'oculto'))

  await page.click('[data-era-editar="base"]')
  await page.waitForTimeout(300)
  await page.click('#colEraBorrar')
  await page.waitForTimeout(300)
  check('borrar una era pide adónde van sus colecciones', await page.locator('input[name="colEraDestino"]').count() >= 2)
  await page.check('input[name="colEraDestino"][value="swsh"]')
  await page.click('#colEraBorrarYa')
  await page.waitForTimeout(1200)
  check('  …las mueve y la borra', (await tabla(page, 'tcg_sets')).find((s) => s.id === 'base1')?.serie_id === 'swsh' && !(await tabla(page, 'tcg_eras')).some((e) => e.id === 'base') && (await page.locator('[data-era="base"]').count()) === 0)
  await page.click('[data-era-editar="vacia"]')
  await page.waitForTimeout(300)
  await page.click('#colEraBorrar')
  await page.waitForTimeout(300)
  check('una era vacía se borra sin preguntar destino', (await page.locator('input[name="colEraDestino"]').count()) === 0)
  await page.click('#colEraBorrarYa')
  await page.waitForTimeout(800)
  check('  …y se va', !(await tabla(page, 'tcg_eras')).some((e) => e.id === 'vacia') && (await page.locator('[data-era="vacia"]').count()) === 0)
  check('sin errores en todo el recorrido', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. En el móvil ──')
{
  const { page, ctx, errores } = await abrir('/admin/', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
  check('no se sale a lo ancho', ancho <= 390, String(ancho))
  check('  …y los botones de la fila caben', await page.$$eval('[data-set="swsh12"] .col-set-acciones button', (bs) => bs.every((b) => b.getBoundingClientRect().right <= 390)))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
