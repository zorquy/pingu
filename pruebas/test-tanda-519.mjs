// Tanda 519 — asociar tu lista entera a una repetición.
//
// PINGU, de la lista de ideas: «elegir tu mazo de /mazos para la partida:
// las probabilidades reales en cada jugada, qué tenías en premios, y
// "Jugar desde aquí" sin "Carta sin ver"».
//
//   1. Las piezas (repeticiones/lista.js), en Node: el mazo con la lista
//      (y lo que la partida enseña que la lista no tiene), lo que queda sin
//      ver en cada jugada (que tiene que cuadrar con mazo + premios), lo que
//      salió de los premios, y la mesa del laboratorio sin «sin ver».
//   2. La página: elegir uno de tus mazos (o pegar la lista), el resumen,
//      el panel de probabilidades jugada a jugada, que se recuerde, y «Jugar
//      desde aquí» con la lista.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const L = await import(`${RAIZ}/js/repeticiones/lista.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos: sacarFotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { cartasVistas } = await import(`${RAIZ}/js/repeticiones/mazos.js`)
const { mazosDeLaPosicion, colocarPosicion, SIN_VER } = await import(`${RAIZ}/js/repeticiones/posicion.js`)
const { Mesa } = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const R481 = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

const PARTIDARIOS = new Set(['Determinación de Lylia', 'Órdenes de Jefes', 'Erin', 'Maya', 'Liza'])
const lectura = leerRegistro(R481)
const fs = sacarFotos(lectura)
const enJuego = new Set()
for (const s of fs) for (const p of Object.values(s.jugadores)) for (const x of [p.activo, ...p.banca].filter(Boolean)) x.cartas.forEach((c) => enJuego.add(c))
const nombres = new Set()
for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
// El catálogo de mentira, más dos cartas que NUNCA salen en la partida (la
// lista las tiene; el registro no las enseña).
const catalogo = [...nombres, 'Caramelo Raro', 'Pokégear 3.0'].map((n, i) => ({
  id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H',
  name: n, name_es: n,
  category: enJuego.has(n) ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
  stage: enJuego.has(n) ? 'Basic' : null,
  hp: enJuego.has(n) ? 999 : null,
  trainer_type: PARTIDARIOS.has(n) ? 'Supporter' : enJuego.has(n) || /^Energ/.test(n) ? null : 'Item',
}))
const cartaDe = (n) => catalogo.find((c) => c.name_es === n) || null
const vistas = cartasVistas(fs, cartaDe)
const ROJO = 'Rojo'
// La lista de Rojo: lo que se le vio, y hasta 60 con las dos que no salen.
const vistoRojo = vistas[ROJO].map((v) => ({ carta: cartaDe(v.nombre), n: v.copias }))
const resto = 60 - vistoRojo.reduce((k, e) => k + e.n, 0)
const LISTA = [...vistoRojo, { carta: cartaDe('Caramelo Raro'), n: Math.ceil(resto / 2) }, { carta: cartaDe('Pokégear 3.0'), n: Math.floor(resto / 2) }]

console.log('\n── 1. Las piezas ──')
{
  check('(la lista de la prueba tiene 60 y dos cartas que no salen)', LISTA.reduce((k, e) => k + e.n, 0) === 60 && resto >= 2, resto)
  const m = L.mazoConLista(LISTA, vistas[ROJO], cartaDe)
  check('con la lista de verdad, nada se queda fuera y el mazo es la lista', !m.fuera.length && m.entradas.reduce((k, e) => k + e.n, 0) === 60 && !m.entradas.some((e) => e.carta === SIN_VER))
  check('  …y cada nombre del registro sabe de qué entrada es', vistas[ROJO].every((v) => m.idDe(v.nombre) === cartaDe(v.nombre).id))
  const corta = LISTA.filter((e) => e.carta.name_es !== 'Ultra Ball')
  const mc = L.mazoConLista(corta, vistas[ROJO], cartaDe)
  const ultra = vistas[ROJO].find((v) => v.nombre === 'Ultra Ball')
  check('si la partida enseña algo que la lista no tiene, se dice (y se mete para que la mesa cuadre)', ultra && mc.fuera.some((f) => f.nombre === 'Ultra Ball' && f.copias === ultra.copias) && mc.idDe('Ultra Ball') === cartaDe('Ultra Ball').id, JSON.stringify(mc.fuera))
  const media = L.mazoConLista(LISTA.slice(0, 3), [], cartaDe)
  const n3 = LISTA.slice(0, 3).reduce((k, e) => k + e.n, 0)
  check('una lista a medias se completa con «sin ver» hasta 60', media.entradas.at(-1).carta === SIN_VER && media.entradas.at(-1).n === 60 - n3)

  // Lo que queda sin ver, jugada a jugada, tiene que cuadrar con lo que la
  // mesa dice que hay escondido: mazo + premios + la mano que no se ve.
  const malas = []
  for (let i = 30; i < fs.length; i += 7) {
    const p = fs[i].jugadores[ROJO]
    const { total, cartas } = L.sinVerEnLaFoto(LISTA, fs[i], ROJO)
    const escondido = p.mazo + p.premios + Math.max(0, p.mano - Math.min(p.mano, p.manoConocida.length))
    if (total !== escondido || cartas.reduce((k, c) => k + c.n, 0) !== total) malas.push(`${i}: ${total} vs ${escondido}`)
  }
  check('lo que queda sin ver cuadra, en cada jugada, con mazo + premios + la mano que no se ve', !malas.length, malas.slice(0, 4).join(' | '))
  const fin = L.sinVerEnLaFoto(LISTA, fs.at(-1), ROJO)
  check('  …y las dos cartas que nunca salieron siguen sin ver al final', ['Caramelo Raro', 'Pokégear 3.0'].every((n) => fin.cartas.some((c) => c.nombre === n)))
  const p = L.premiosCogidos(lectura.eventos, ROJO)
  check('de los premios de Rojo salieron las que el registro enseña al cogerlos', JSON.stringify(p) === JSON.stringify({ cartas: ['Zoroark ex de N', 'Órdenes de Jefes', 'Mochi Cadena', 'Zoroark ex de N', 'Energía Oscura', 'Ultra Ball'], ocultas: 0 }), JSON.stringify(p))
  check('  …y de los de Azul, nada con nombre (el registro no enseña su mano)', JSON.stringify(L.premiosCogidos(lectura.eventos, 'Azul')) === JSON.stringify({ cartas: [], ocultas: 5 }))
  check('la probabilidad de robar: lo que queda de ella entre lo que no se ha visto', L.probabilidadDeRobar(3, 40) === 0.075 && L.probabilidadDeRobar(1, 0) === 0)

  // La mesa del laboratorio: con la lista, Rojo no tiene ni una «sin ver».
  const orden = fs[0].orden
  const i = 120
  const conLista = orden.map((n) => (n === ROJO ? L.mazoConLista(LISTA, vistas[n], cartaDe) : mazosDeLaPosicion(vistas[n], cartaDe)))
  const mesa = new Mesa({ mazos: conLista.map((m) => m.entradas), nombres: orden, efectos: EFECTOS, semilla: 3, empieza: 0 })
  colocarPosicion(mesa, { lectura, fotos: fs, i, idDe: Object.fromEntries(orden.map((n, k) => [n, conLista[k].idDe])), cartaDe })
  const rojo = mesa.jugadores[orden.indexOf(ROJO)]
  const sinVerRojo = [...rojo.s.mazo, ...rojo.s.premios, ...rojo.s.mano].filter((u) => rojo.carta(u)?.id === SIN_VER.id).length
  const tieneCaramelo = [...rojo.s.mazo, ...rojo.s.premios].some((u) => rojo.carta(u)?.name_es === 'Caramelo Raro')
  check('«Jugar desde aquí» con la lista: Rojo sin una sola «Carta sin ver», y con lo que no salió en su mazo o premios', sinVerRojo === 0 && tieneCaramelo, `${sinVerRojo} sin ver`)
}

console.log('\n── 2. La página ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
const MAZO = { id: 'mazo-1', user_id: 'user-1', name: 'Mi Zoroark', cards: LISTA.map((e) => ({ id: e.carta.id, n: e.n })) }
async function pagina(ctx) {
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, mazo }) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_SETS__ = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_MAZOS__ = [mazo]
  }, { cartas: catalogo, mazo: MAZO })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  await page.waitForSelector('#repMazos:not(.hidden) [data-lista-de]', { timeout: 10000 }).catch(() => null)
  return { page, errores }
}
const irA = (page, f) =>
  page.evaluate((f) => {
    const r = document.getElementById('repProgreso')
    r.value = String(f)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, f)
const prob = (page) => page.evaluate(() => ({ visible: !document.getElementById('repProb').classList.contains('hidden'), texto: document.getElementById('repProb').textContent.replace(/\s+/g, ' ').trim() }))
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const { page, errores } = await pagina(ctx)
  check('cada mazo ofrece «Es mi lista»', (await page.locator('[data-lista-de]').count()) === 2)
  check('  …y sin lista no hay panel de probabilidades', !(await prob(page)).visible)
  await page.click(`[data-lista-de="${ROJO}"]`)
  await page.waitForSelector('[data-dlg="lista-mio"]', { timeout: 5000 })
  check('la ventana ofrece tus mazos guardados', (await page.textContent('[data-dlg="lista-mio"]')).includes('Mi Zoroark'))
  await page.click('[data-dlg="lista-mio"]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open, null, { timeout: 8000 }).catch(() => null)
  const bloque = (await page.textContent('#repMazosCuerpo')).replace(/\s+/g, ' ')
  check('el mazo de Rojo dice su lista y qué salió de sus premios', /Con su lista: Mi Zoroark/.test(bloque) && /De sus premios salieron: Zoroark ex de N, Órdenes de Jefes, Mochi Cadena, Zoroark ex de N, Energía Oscura, Ultra Ball\./.test(bloque), bloque.slice(0, 300))
  check('  …lo que quedó sin ver al acabar (con las dos que nunca salieron)', /Sin ver al acabar/.test(bloque) && /Caramelo Raro/.test(bloque) && /Pokégear 3\.0/.test(bloque))
  check('  …y no avisa de nada raro (la lista es la de la partida)', !/no están? en esta lista/.test(bloque))
  const i = 120
  await irA(page, i)
  let pr = await prob(page)
  const esperado = L.sinVerEnLaFoto(LISTA, fs[i], ROJO)
  check('el panel de probabilidades sale, con lo que le queda sin ver en ESA jugada', pr.visible && pr.texto.includes(`Le quedan ${esperado.total} cartas sin ver`), pr.texto.slice(0, 200))
  const top = esperado.cartas[0]
  const pctTop = `${((top.n / esperado.total) * 100).toFixed(0)} %`
  const primera = await page.$eval('#repProb .rep-prob-lista li', (li) => [...li.children].map((x) => x.textContent.trim()).filter(Boolean).join(' | '))
  check('  …y la probabilidad de cada una en su próximo robo', primera === `${top.nombre} | ${top.n} de ${esperado.total} · ${pctTop}`, `${primera} vs ${top.nombre} | ${top.n} de ${esperado.total} · ${pctTop}`)
  await irA(page, 60)
  const otra = L.sinVerEnLaFoto(LISTA, fs[60], ROJO)
  pr = await prob(page)
  check('  …y cambia con la jugada', pr.texto.includes(`Le quedan ${otra.total} cartas sin ver`) && otra.total !== esperado.total, `${otra.total} / ${esperado.total}`)

  // «Jugar desde aquí» con la lista: el mazo de Rojo, sin «Carta sin ver».
  const turnoDeRojo = fs.findIndex((s, k) => k > 100 && s.foco?.tipo === 'turno' && s.deQuien === ROJO)
  await irA(page, turnoDeRojo + 1)
  await page.click('[data-accion="jugar"]')
  await page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 })
  await page.click('#laboratorio [data-accion="panel"]').catch(() => null)
  await page.click('#laboratorio [data-panel-pestania="mazo"]').catch(() => null)
  await page.waitForTimeout(300)
  const panel = await page.textContent('#labPanel')
  check('«Jugar desde aquí» con la lista: el mazo de Rojo en el laboratorio no tiene «Carta sin ver»', /Caramelo Raro/.test(panel) && !/Carta sin ver/.test(panel), panel.slice(0, 200))
  await page.click('#laboratorio [data-accion="cerrar"]')

  // Se recuerda: la misma partida pegada otra vez sale con su lista.
  const otraPag = await pagina(ctx)
  await otraPag.page.waitForFunction(() => /Con su lista/.test(document.getElementById('repMazosCuerpo')?.textContent || ''), null, { timeout: 10000 }).catch(() => null)
  check('se recuerda: la misma partida, otra vez, sale con su lista', /Con su lista: Mi Zoroark/.test(await otraPag.page.textContent('#repMazosCuerpo')))
  await otraPag.page.click('[data-lista-quitar]')
  check('  …y «Quitar» la quita (y el panel se va)', !/Con su lista/.test(await otraPag.page.textContent('#repMazosCuerpo')) && !(await prob(otraPag.page)).visible)
  const guardadas = await otraPag.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('pokedoc-rep-listas') || '{}')).length)
  check('  …también de la memoria', guardadas === 0)
  check('sin errores', !errores.length && !otraPag.errores.length, [...errores, ...otraPag.errores].join(' | '))
  await ctx.close()
}
{
  // Pegada, y una lista que no es la de la partida.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const { page } = await pagina(ctx)
  await page.click(`[data-lista-de="${ROJO}"]`)
  await page.waitForSelector('#repListaTexto')
  await page.fill('#repListaTexto', '4 Caramelo Raro FK 999\n4 Pokégear 3.0 FK 998')
  await page.click('[data-dlg="lista-texto"]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open || /No /.test(document.querySelector('#repDialogo .rep-dialogo-estado')?.textContent || ''), null, { timeout: 8000 }).catch(() => null)
  const bloque = (await page.textContent('#repMazosCuerpo')).replace(/\s+/g, ' ')
  check('pegar una lista vale también, y si no es la de la partida lo dice', /Con su lista: Lista pegada/.test(bloque) && /de la partida no están en esta lista/.test(bloque), bloque.slice(0, 300))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
