// Tanda 515 — compartir una posición del laboratorio con un enlace.
//
// PINGU, de la lista de ideas: «un enlace que lleve la mesa tal cual, para
// preguntar "¿qué harías aquí?": quien lo abre sigue jugando desde ahí».
//
//   1. Las piezas (constructor/posicion-compartida.js), en Node: lo que
//      viaja es el estado del motor y los mazos EN SU ORDEN; una mesa
//      rehecha desde el enlace es LA MISMA (y roba lo mismo); el estado es
//      de objetos planos (si no, JSON se lo comería en silencio); un enlace
//      roto o que no es una posición no abre nada; y las cartas que el
//      catálogo no tiene se juegan con el nombre que trae el enlace.
//   2. La página: «Compartir» en el laboratorio, el enlace, y abrirlo en
//      otra pestaña — con mesa (desde una repetición) y contra el muñeco
//      (desde el constructor).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const P = await import(`${RAIZ}/js/constructor/posicion-compartida.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos: sacarFotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { cartasVistas } = await import(`${RAIZ}/js/repeticiones/mazos.js`)
const { mazosDeLaPosicion, colocarPosicion } = await import(`${RAIZ}/js/repeticiones/posicion.js`)
const { Mesa, Partida } = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const R481 = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

const PARTIDARIOS = new Set(['Determinación de Lylia', 'Órdenes de Jefes', 'Erin', 'Maya', 'Liza'])
function catalogoDe(lectura, fs) {
  const enJuego = new Set()
  for (const s of fs) for (const p of Object.values(s.jugadores)) for (const x of [p.activo, ...p.banca].filter(Boolean)) x.cartas.forEach((c) => enJuego.add(c))
  const nombres = new Set()
  for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
  for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
  return [...nombres].map((n, i) => ({
    id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H',
    name: n, name_es: n,
    category: enJuego.has(n) ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
    stage: enJuego.has(n) ? 'Basic' : null,
    hp: enJuego.has(n) ? 999 : null,
    trainer_type: PARTIDARIOS.has(n) ? 'Supporter' : enJuego.has(n) || /^Energ/.test(n) ? null : 'Item',
  }))
}
const UI = {
  numero: async ({ valor }) => valor,
  cartas: async ({ opciones, min }) => opciones.slice(0, min),
  pokemon: async ({ opciones, min }) => opciones.slice(0, min),
  confirmar: async () => true,
  opcion: async ({ opciones }) => opciones[0],
  premios: async ({ n, partida }) => partida.s.premios.slice(0, n),
  repartir: async () => ({}),
}
// ¿Solo objetos, listas, textos, números finitos, booleanos y null? Un
// Map, un Set, un undefined o un NaN se pierden por JSON sin dar error.
function soloPlano(x, ruta = 'estado') {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return null
  if (typeof x === 'number') return Number.isFinite(x) ? null : ruta
  if (Array.isArray(x)) {
    for (const [i, v] of x.entries()) {
      const r = soloPlano(v, `${ruta}[${i}]`)
      if (r) return r
    }
    return null
  }
  if (typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    for (const [k, v] of Object.entries(x)) {
      if (v === undefined) continue // JSON lo quita, y al leerlo vale undefined igual
      const r = soloPlano(v, `${ruta}.${k}`)
      if (r) return r
    }
    return null
  }
  return `${ruta} (${Object.prototype.toString.call(x)})`
}
const sinRegistros = (e) => JSON.stringify({ ...e, a: { ...e.a, registro: [] }, b: { ...e.b, registro: [] }, m: { ...e.m, registro: [] } })

console.log('\n── 1. Las piezas ──')
const lectura = leerRegistro(R481)
const fs = sacarFotos(lectura)
const catalogo = catalogoDe(lectura, fs)
const cartaDe = (n) => catalogo.find((c) => c.name_es === n) || null
const vistas = cartasVistas(fs, cartaDe)
const orden = fs[0].orden
const mazos = orden.map((n) => mazosDeLaPosicion(vistas[n], cartaDe))
{
  const mesa = new Mesa({ mazos: mazos.map((m) => m.entradas), nombres: orden, efectos: EFECTOS, semilla: 11, empieza: 0 })
  colocarPosicion(mesa, { lectura, fotos: fs, i: 120, idDe: Object.fromEntries(orden.map((n, k) => [n, mazos[k].idDe])), cartaDe })
  mesa.log(mesa.actual, 'Una línea del registro, que no tiene por qué viajar.')
  const estado = structuredClone({ a: mesa.jugadores[0].s, b: mesa.jugadores[1].s, m: mesa.m })
  check('el estado del motor es de objetos planos (lo que JSON lleva sin perder nada)', soloPlano(estado) === null, soloPlano(estado))
  const posicion = { tipo: 'mesa', nombres: orden, mazos: mazos.map((m, k) => ({ nombre: `Mazo de ${orden[k]}`, entradas: m.entradas })), estado }
  const x = JSON.parse(JSON.stringify(P.compactar(posicion)))
  check('lo compacto es una posición, y sin el registro de la mesa (lo que más pesa)', P.esPosicion(x) && estado.m.registro.length > 0 && !x.e.m.registro.length)
  check('los mazos viajan en su orden, con id, copias, nombre y tipo', JSON.stringify(x.z[0].c[0]) === JSON.stringify([mazos[0].entradas[0].carta.id, mazos[0].entradas[0].n, mazos[0].entradas[0].carta.name, mazos[0].entradas[0].carta.name_es, mazos[0].entradas[0].carta.category]) && x.z.every((m, k) => m.c.map((c) => c[0]).join() === mazos[k].entradas.map((e) => e.carta.id).join()))
  check('al catálogo solo se le piden las de verdad (ni «sin ver» ni las sueltas)', P.idsDelCatalogo(x).every((id) => id.startsWith('fk-')) && P.idsDelCatalogo(x).length === new Set(mazos.flatMap((m) => m.entradas.map((e) => e.carta.id)).filter((id) => id.startsWith('fk-'))).size)

  // La mesa rehecha desde el enlace, con un catálogo al que le FALTA una carta.
  const falta = catalogo[0].id
  const mapa = new Map(catalogo.filter((c) => c.id !== falta).map((c) => [c.id, c]))
  const pos = P.expandir(x, mapa)
  const otra = new Mesa({ mazos: pos.mazos.map((m) => m.entradas), nombres: pos.nombres, efectos: EFECTOS, semilla: 99, empieza: 0 })
  otra.restaurar(structuredClone(pos.estado))
  check('la mesa rehecha es LA MISMA (los dos lados y la mesa)', sinRegistros({ a: otra.jugadores[0].s, b: otra.jugadores[1].s, m: otra.m }) === sinRegistros(estado))
  const nombresMano = (m) => m.actual.s.mano.map((u) => m.actual.carta(u)?.name_es)
  check('  …con las mismas cartas en la mano de quien juega', JSON.stringify(nombresMano(otra)) === JSON.stringify(nombresMano(mesa)) && nombresMano(mesa).length > 0)
  const sinVer = pos.mazos.flatMap((m) => m.entradas).find((e) => e.carta.id === 'sin-ver')
  check('«Carta sin ver» llega con su nombre aunque no esté en el catálogo', sinVer?.carta.name_es === 'Carta sin ver' && sinVer.carta.category === 'Sin ver')
  const suelta = pos.mazos.flatMap((m) => m.entradas).find((e) => e.carta.id === falta)
  check('una carta que el catálogo ya no tiene se juega con el nombre y el tipo del enlace', suelta && suelta.carta.name_es === catalogo[0].name_es && suelta.carta.category === catalogo[0].category && !('set_id' in suelta.carta))
  // Y siguen igual: pasar el turno en las dos da el turno al otro, que
  // roba LA MISMA carta (el azar viaja con el estado).
  await mesa.accion(() => mesa.pasarTurno(UI), UI)
  await otra.accion(() => otra.pasarTurno(UI), UI)
  const robada = (m) => m.actual.carta(m.actual.s.mano.at(-1))?.name_es
  check('pasar el turno en las dos: el otro roba LA MISMA carta (el azar viaja con la mesa)', robada(mesa) && robada(mesa) === robada(otra) && sinRegistros({ a: otra.jugadores[0].s, b: otra.jugadores[1].s, m: otra.m }) === sinRegistros({ a: mesa.jugadores[0].s, b: mesa.jugadores[1].s, m: mesa.m }), `${robada(mesa)} / ${robada(otra)}`)

  // El enlace entero, de ida y vuelta.
  const h = await P.empaquetarPosicion(posicion)
  check('el enlace empieza por «pos=» y se reconoce', h.startsWith('pos=') && P.esEnlaceDePosicion(`#${h}`) && !P.esEnlaceDePosicion('#p=abc'))
  const vuelta = await P.desempaquetarPosicion(`#${h}`)
  check('de ida y vuelta, lo mismo que se compactó', JSON.stringify(vuelta) === JSON.stringify(x))
  check(`  …y cabe en un enlace razonable (${h.length} caracteres)`, h.length < 6000, h.length)
  check('un enlace cortado a medias no abre nada', (await P.desempaquetarPosicion(`#${h.slice(0, Math.floor(h.length / 2))}`)) === null)
  check('  …ni uno de repetición, ni basura', (await P.desempaquetarPosicion('#p=abc')) === null && (await P.desempaquetarPosicion('#pos=%%%')) === null)
  const sinMesa = await P.empaquetarPosicion({ ...posicion, estado: { ...estado, m: {} } })
  const sinLado = await P.empaquetarPosicion({ ...posicion, estado: { ...estado, a: { mazo: 'no' } } })
  check('  …ni uno que descomprime pero no tiene forma de mesa (ni la mesa, ni un lado)', (await P.desempaquetarPosicion(`#${sinMesa}`)) === null && (await P.desempaquetarPosicion(`#${sinLado}`)) === null)
}
{
  // Contra el muñeco: una partida sola.
  const entradas = mazos[0].entradas
  const p = new Partida({ entradas, efectos: EFECTOS, semilla: 5, vaPrimero: true, rival: { plantilla: 'ex', banca: 2 } })
  p.repartir()
  const x = JSON.parse(JSON.stringify(P.compactar({ tipo: 'muneco', mazos: [{ nombre: 'Mío', entradas }], estado: structuredClone(p.s) })))
  check('contra el muñeco: una posición de un mazo, con su muñeco dentro', P.esPosicion(x) && x.z.length === 1 && x.e.rival && x.n === null)
  check('  …y sin su registro (contra el muñeco va en la partida)', p.s.registro.length > 0 && x.e.registro.length === 0)
  const pos = P.expandir(x, new Map(catalogo.map((c) => [c.id, c])))
  const q = new Partida({ entradas: pos.mazos[0].entradas, efectos: EFECTOS, semilla: 1 })
  q.s = structuredClone(pos.estado)
  check('  …y rehecha, la misma mano y los mismos premios', JSON.stringify(q.s.mano) === JSON.stringify(p.s.mano) && q.s.mano.every((u) => q.carta(u).id === p.carta(u).id) && JSON.stringify(q.s.premios) === JSON.stringify(p.s.premios))
}

console.log('\n── 2. La página ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina(url, { cartas = catalogo, sets = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }], prefs = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, sets, prefs }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    // Las cartas, solo con las columnas que se piden, como en la base: si
    // no, una consulta que NO pide una columna la recibe igual y aquí no se
    // nota que falta (el tipo de entrenador, por ejemplo).
    window.__PROYECTAR__ = ['tcg_cards']
    // El enlace LARGO (lo que prueba esta tanda): el corto de la 591 se
    // guarda en la base del doble, que es de cada pestaña, y abrirlo en
    // otra no lo encontraría. El corto lo prueba la 591.
    window.__SIN_RPC__ = ['enlace_corto_crear']
    if (prefs) localStorage.setItem('pokedoc-laboratorio', JSON.stringify(prefs))
  }, { cartas, sets, prefs })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
const foto = (page) =>
  page.evaluate(() => ({
    turno: document.getElementById('labTurno')?.textContent.trim().split(' — ')[0],
    mano: [...document.querySelectorAll('#labMano [data-uid]')].map((b) => b.getAttribute('aria-label').replace(' (nueva)', '')),
    activos: [...document.querySelectorAll('#labLadoPropio .lab-slot-activo [data-slot-carta], #labLadoRival .lab-slot-activo [data-slot-carta], #labLadoRival .lab-slot-activo [data-rival-carta]')].map((b) => b.getAttribute('aria-label')),
    mesa: document.querySelector('#laboratorio [data-modo="mesa"]')?.getAttribute('aria-checked'),
    // Las cartas con su dibujo: las del catálogo lo tienen; una que llegara
    // solo con el nombre del enlace, no.
    dibujos: [...document.querySelectorAll('#labMano [data-uid] img')].map((i) => i.getAttribute('src')).join(' '),
  }))
async function compartir(page) {
  await page.click('#laboratorio [data-accion="compartir"]')
  await page.waitForFunction(() => document.getElementById('labEnlace')?.value, null, { timeout: 8000 }).catch(() => null)
  return {
    url: await page.inputValue('#labEnlace').catch(() => ''),
    texto: (await page.textContent('#labDialogo')).replace(/\s+/g, ' '),
  }
}
{
  // Con mesa: desde una repetición.
  const { page, ctx, errores } = await pagina('/repeticiones.html')
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
    const r = document.getElementById('repProgreso')
    r.value = '120'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('[data-accion="jugar"]')
  await page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 })
  const antes = await foto(page)
  check('el laboratorio ofrece «Compartir» en la barra', (await page.locator('#laboratorio .lab-barra [data-accion="compartir"]').count()) === 1)
  const { url, texto } = await compartir(page)
  // Desde la 621 va a /laboratorio: al cerrar la mesa se queda uno allí.
  check('el enlace va al laboratorio y lleva la mesa detrás del #', url.startsWith(`${BASE}/laboratorio#pos=`), url.slice(0, 80))
  check('  …y la ventana dice qué lleva: las dos manos, y que robará lo mismo', /con los dos mazos y las dos manos tal cual están ahora, y el mazo en su orden: robará lo mismo que robarías tú/.test(texto), texto.slice(0, 200))
  await page.click('#labDialogo [data-dlg="copiar"]')
  const copiado = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('«Copiar» lo copia', copiado === url)
  check('sin errores al compartir', !errores.length, errores.join(' | '))
  await ctx.close()

  const otra = await pagina(url.slice(BASE.length))
  const abre = await otra.page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 }).then(() => true).catch(() => false)
  check('abrir el enlace abre el laboratorio solo', abre)
  await otra.page.waitForTimeout(300)
  const despues = await foto(otra.page)
  check('  …en «Tú contra ti», en el mismo turno y le toca al mismo', despues.mesa === 'true' && despues.turno === antes.turno, `${antes.turno} / ${despues.turno}`)
  check('  …con los mismos activos y la misma mano', JSON.stringify(despues.activos) === JSON.stringify(antes.activos) && JSON.stringify(despues.mano) === JSON.stringify(antes.mano) && antes.mano.length > 0, JSON.stringify([antes.mano, despues.mano]).slice(0, 200))
  check('  …y las cartas son las del catálogo, con SU dibujo', despues.dibujos === antes.dibujos && antes.dibujos.length > 0, `${antes.dibujos.slice(0, 120)} / ${despues.dibujos.slice(0, 120)}`)
  await otra.page.click('#laboratorio [data-accion="panel"]').catch(() => null)
  const registro = await otra.page.evaluate(() => document.getElementById('laboratorio').textContent)
  check('  …y el registro dice de dónde sale', /Posición que te han pasado con un enlace/.test(registro))
  check('sin errores al abrirlo', !otra.errores.length, otra.errores.join(' | '))
  await otra.ctx.close()
}
{
  // Contra el muñeco: desde el constructor.
  const FICHA = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
  const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
  const D = [[4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [4, 'Ultra Ball'], [4, 'Crushing Hammer'], [4, 'Crispin'], [8, 'Fire Energy'], [8, 'Psychic Energy']]
  const entradas = D.map(([n, nombre]) => ({ carta: FICHA.find((x) => x.name === nombre), n }))
  const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
  const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
  const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
  const prefs = { opciones: { primero: 'primero', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' } }
  const { page, ctx, errores } = await pagina(`/constructor?l=${lista}`, { cartas, sets, prefs })
  await page.waitForTimeout(1400)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 8000 })
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(300)
  const antes = await foto(page)
  const { url, texto } = await compartir(page)
  check('contra el muñeco también: el enlace, y dice que lleva tu mano y el muñeco', url.includes('/laboratorio#pos=') && /con tu mazo, tu mano y el muñeco tal cual están ahora/.test(texto), texto.slice(0, 160))
  await page.click('#labDialogo [data-dlg="cancelar"]')
  // Sigue jugando aquí: pasar el turno (el muñeco no hace nada) y robar.
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  const robaAqui = (await foto(page)).mano
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()

  const otra = await pagina(url.slice(BASE.length), { cartas, sets, prefs: { opciones: { ...prefs.opciones, modo: 'mesa' } } })
  await otra.page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 }).catch(() => null)
  await otra.page.waitForTimeout(300)
  const despues = await foto(otra.page)
  check('abierto en otra pestaña: contra el muñeco (aunque allí se jugara a dos), la misma mano', despues.mesa === 'false' && JSON.stringify(despues.mano) === JSON.stringify(antes.mano) && antes.mano.length > 0 && despues.turno === antes.turno, JSON.stringify([antes, despues]).slice(0, 300))
  await otra.page.click('[data-accion="pasar"]')
  await otra.page.waitForTimeout(300)
  check('  …y al pasar el turno roba LO MISMO que habría robado quien lo mandó', JSON.stringify((await foto(otra.page)).mano) === JSON.stringify(robaAqui), JSON.stringify(robaAqui).slice(0, 160))
  const guardadas = await otra.page.evaluate(() => JSON.parse(localStorage.getItem('pokedoc-laboratorio') || '{}').opciones?.modo)
  check('  …sin cambiarle a quien lo abre su forma de jugar guardada', guardadas === 'mesa', guardadas)
  check('sin errores al abrirlo', !otra.errores.length, otra.errores.join(' | '))
  await otra.ctx.close()
}
// Roto, en los dos sitios que abren posiciones: el constructor (por los
// enlaces que ya se mandaron) y /laboratorio (desde la 621).
for (const donde of ['/constructor', '/laboratorio']) {
  const { page, ctx } = await pagina(`${donde}#pos=esto-no-es-nada`)
  const toast = await page.waitForFunction(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '), null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => '')
  check(`[${donde}] un enlace roto lo dice, y no abre una mesa a medias`, /El enlace de la posición está roto o incompleto/.test(toast) && (await page.locator('#laboratorio:not([hidden])').count()) === 0, toast)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
