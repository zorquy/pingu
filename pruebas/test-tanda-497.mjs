// Tanda 497 — «Jugar desde aquí»: la mesa de una repetición, en el
// laboratorio.
//
// PINGU, de la lista de ideas: «un botón "Juega desde aquí" que abre el
// laboratorio con la mesa tal cual está en ese momento, para probar otra
// línea».
//
//   1. La posición (repeticiones/posicion.js), en Node, contra los dos
//      registros de verdad, jugada a jugada: cada carta en su sitio, ni una
//      de más ni una de menos, lo que no se vio como «Carta sin ver», y lo
//      que el turno ya gastó (la energía de la mano, el partidario, la
//      retirada) gastado. Y el motor sigue desde ahí: pasar el turno roba.
//   2. La página: el botón, cuándo se puede, y el laboratorio abierto con
//      la mesa de esa jugada; al cerrarlo, la repetición sigue donde
//      estaba (y no se ha movido con las teclas del laboratorio).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos: sacarFotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { cartasVistas } = await import(`${RAIZ}/js/repeticiones/mazos.js`)
const { mazosDeLaPosicion, colocarPosicion, sePuedeJugarDesde, gastadoEnElTurno, premiosPendientes, SIN_VER } = await import(`${RAIZ}/js/repeticiones/posicion.js`)
const { Mesa } = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
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
    // Vida de sobra: con poca, el daño de verdad (460 a un Mega) tumbaría
    // en la prueba a quien en la partida seguía en pie.
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

console.log('\n── 1. La posición ──')
let porEfectoVistas = 0
for (const [nombre, texto] of Object.entries({ ejemplo: EJEMPLO, 'la 481': R481 })) {
  const lectura = leerRegistro(texto)
  const fs = sacarFotos(lectura)
  const catalogo = catalogoDe(lectura, fs)
  const cartaDe = (n) => catalogo.find((c) => c.name_es === n) || null
  const vistas = cartasVistas(fs, cartaDe)
  const orden = fs[0].orden
  const mazos = orden.map((n) => mazosDeLaPosicion(vistas[n], cartaDe))
  check(`[${nombre}] los dos mazos tienen 60: lo visto y, hasta 60, «Carta sin ver»`, mazos.every((m) => m.entradas.reduce((k, e) => k + e.n, 0) === 60 && m.entradas.at(-1).carta === SIN_VER))
  check(`[${nombre}] desde la preparación y desde el final no se juega`, !sePuedeJugarDesde(lectura, fs, 0) && !sePuedeJugarDesde(lectura, fs, fs.length - 1) && sePuedeJugarDesde(lectura, fs, Math.floor(fs.length / 2)))
  let malas = []
  let probadas = 0
  let pasadas = 0
  for (let i = 1; i < fs.length; i++) {
    if (!sePuedeJugarDesde(lectura, fs, i)) continue
    probadas++
    const mesa = new Mesa({ mazos: mazos.map((m) => m.entradas), nombres: orden, efectos: EFECTOS, semilla: 11, empieza: 0 })
    colocarPosicion(mesa, { lectura, fotos: fs, i, idDe: Object.fromEntries(orden.map((n, k) => [n, mazos[k].idDe])), cartaDe })
    const s = fs[i]
    mesa.jugadores.forEach((partida, k) => {
      const p = s.jugadores[orden[k]]
      const st = partida.s
      const slots = [st.activo, ...st.banca].filter(Boolean)
      const uids = [st.mazo, st.mano, st.premios, st.descarte, ...slots.flatMap((x) => [x.cartas, x.energias, x.herramienta ? [x.herramienta] : []])].flat()
      if (st.estadio && partida.uidsPropios.has(st.estadio)) uids.push(st.estadio)
      const nombreDe = (u) => partida.carta(u)?.name_es
      const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
      const ok =
        uids.length === new Set(uids).size && uids.length === partida.uidsPropios.size &&
        st.mano.length === p.mano && st.premios.length === p.premios && st.mazo.length === p.mazo &&
        igual(st.descarte.map(nombreDe), p.descarte) &&
        igual(slots.map((x) => x.cartas.map(nombreDe)), [p.activo, ...p.banca].filter(Boolean).map((x) => x.cartas)) &&
        igual(slots.map((x) => x.energias.map(nombreDe)), [p.activo, ...p.banca].filter(Boolean).map((x) => x.energias)) &&
        igual(slots.map((x) => x.danio), [p.activo, ...p.banca].filter(Boolean).map((x) => x.danio)) &&
        igual(st.mano.slice(0, Math.min(p.mano, p.manoConocida.length)).map(nombreDe), p.manoConocida.slice(0, p.mano)) &&
        (s.estadio ? nombreDe(st.estadio) === s.estadio.carta || mesa.jugadores[1 - k].carta(st.estadio)?.name_es === s.estadio.carta : st.estadio === null)
      if (!ok) malas.push(`${i}:${orden[k]}`)
    })
    // Cada 9 jugadas, que el motor siga: pasar el turno le da el turno al
    // otro, que roba.
    if (i % 9 === 0) {
      const otro = mesa.actual.oponente
      const mano = otro.s.mano.length
      try {
        await mesa.accion(() => mesa.pasarTurno(UI), UI)
        if (mesa.terminada || (mesa.actual === otro && otro.s.mano.length === mano + 1 && otro.s.fase === 'turno')) pasadas++
        else malas.push(`${i}:no pasa el turno`)
      } catch (err) {
        malas.push(`${i}:${err.message}`)
      }
    }
  }
  check(`[${nombre}] en las ${probadas} jugadas que se pueden jugar, cada carta en su sitio: mesa, descarte, mano, premios y mazo`, probadas > 100 && !malas.length, malas.slice(0, 5).join(' | '))
  check(`[${nombre}]   …y el motor sigue desde ahí (pasar el turno da el turno al otro, que roba)`, pasadas > 10, pasadas)

  // Lo que el turno ya gastó.
  const ev = lectura.eventos
  const turnoDe = (k) => {
    for (let j = k; j >= 0; j--) if (ev[j].tipo === 'turno') return ev[j].jugador
    return null
  }
  let unir = -1
  for (let k = 0, inicio = 0; k < ev.length && unir < 0; k++) {
    if (ev[k].tipo === 'turno') inicio = k
    const e = ev[k]
    const deMano = (x) => x.tipo === 'unir' && !x.sub && /^Energ/.test(x.carta)
    if (deMano(e) && e.jugador === turnoDe(k) && !ev.slice(inicio, k).some((x) => deMano(x) && x.jugador === e.jugador)) unir = k
  }
  if (unir > 0) {
    const j = ev[unir].jugador
    check(`[${nombre}] antes de unir la energía de la mano, no está gastada; después, sí`, !gastadoEnElTurno(ev, unir, j, cartaDe).flags.energia && gastadoEnElTurno(ev, unir + 1, j, cartaDe).flags.energia)
  }
  // Y la que une un EFECTO (una línea de debajo de una carta o habilidad)
  // no gasta la de la mano: con ella unida, aún se puede unir una a mano.
  let porEfecto = -1
  for (let k = 0, inicio = 0; k < ev.length && porEfecto < 0; k++) {
    if (ev[k].tipo === 'turno') inicio = k
    const e = ev[k]
    const deMano = (x) => x.tipo === 'unir' && !x.sub && /^Energ/.test(x.carta)
    if (e.tipo === 'unir' && e.sub && /^Energ/.test(e.carta) && e.jugador === turnoDe(k) && !ev.slice(inicio, k).some((x) => deMano(x) && x.jugador === e.jugador)) porEfecto = k
  }
  if (porEfecto > 0) {
    porEfectoVistas++
    check(`[${nombre}] una energía unida por un efecto NO gasta la de la mano`, !gastadoEnElTurno(ev, porEfecto + 1, ev[porEfecto].jugador, cartaDe).flags.energia, ev[porEfecto].linea)
  }
  const partidario = ev.findIndex((e, k) => e.tipo === 'jugar' && !e.sub && PARTIDARIOS.has(e.carta) && e.jugador === turnoDe(k))
  if (partidario > 0) check(`[${nombre}] jugar un partidario lo gasta (y un objeto no)`, gastadoEnElTurno(ev, partidario + 1, ev[partidario].jugador, cartaDe).flags.partidario && !gastadoEnElTurno(ev, partidario, ev[partidario].jugador, cartaDe).flags.partidario)
  const retirada = ev.findIndex((e) => e.tipo === 'retirar')
  if (retirada > 0) check(`[${nombre}] retirarse gasta la retirada`, gastadoEnElTurno(ev, retirada + 1, ev[retirada].jugador, cartaDe).flags.retirada)
  // Un Pokémon que baja este turno no puede evolucionar todavía.
  const baja = ev.findIndex((e, k) => e.tipo === 'poner' && e.donde === 'banca' && e.jugador === turnoDe(k) && turnoDe(k) && k > 20)
  if (baja > 0) {
    const mesa = new Mesa({ mazos: mazos.map((m) => m.entradas), nombres: orden, efectos: EFECTOS, semilla: 3, empieza: 0 })
    colocarPosicion(mesa, { lectura, fotos: fs, i: baja + 1, idDe: Object.fromEntries(orden.map((n, k) => [n, mazos[k].idDe])), cartaDe })
    const p = mesa.actual
    const nuevo = p.s.banca.find((x) => p.carta(x.cartas.at(-1))?.name_es === ev[baja].carta && x.entroTurno === p.s.turno)
    check(`[${nombre}] el Pokémon que acaba de bajar a la banca es «nuevo» (no evoluciona este turno)`, Boolean(nuevo), ev[baja].linea)
  }
}

check('alguno de los dos registros tiene una energía unida por un efecto antes que la de la mano', porEfectoVistas > 0)
{
  // La foto de un KO llega antes que la línea de sus premios: se le dejan
  // a la mesa como pendientes, y no se cuentan dos veces.
  const lectura = leerRegistro(R481)
  const ev = lectura.eventos
  const ko = ev.findIndex((e) => e.tipo === 'ko')
  const premio = ev.findIndex((e, k) => k > ko && e.tipo === 'premio')
  const p = premiosPendientes(ev, ko + 1)
  check('en la foto de un KO, sus premios quedan pendientes para quien los coge', p.length === 1 && p[0].jugador === ev[premio].jugador && p[0].n === ev[premio].n, JSON.stringify(p))
  check('  …antes del golpe no hay nada pendiente (el KO lo resolverá el motor por la vida)', !premiosPendientes(ev, ko).length)
  check('  …y después de cogerlos, tampoco', !premiosPendientes(ev, premio + 1).length)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La página ──')
const lectura = leerRegistro(R481)
const fs481 = sacarFotos(lectura)
const catalogo = catalogoDe(lectura, fs481)
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina({ ancho = 1280, alto = 800 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
    window.__FAKE_CARTAS__ = cartas
  }, { cartas: catalogo })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  return { page, errores }
}
const irA = (page, f) =>
  page.evaluate((f) => {
    const r = document.getElementById('repProgreso')
    r.value = String(f)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, f)
{
  const { page, errores } = await pagina()
  const boton = page.locator('[data-accion="jugar"]')
  await irA(page, 0)
  check('en la preparación, «Jugar desde aquí» está apagado y dice por qué', (await boton.isDisabled()) && /no hay partida que seguir/.test(await boton.getAttribute('title')))
  await irA(page, fs481.length - 1)
  check('  …y al final, también', await boton.isDisabled())
  const i = 120
  await irA(page, i)
  check('a mitad de partida, se puede', !(await boton.isDisabled()))
  const s = fs481[i]
  const deQuien = (() => {
    let q = null
    for (const e of lectura.eventos.slice(0, i)) if (e.tipo === 'turno') q = e.jugador
    return q
  })()
  const otro = s.orden.find((n) => n !== deQuien)
  await boton.click()
  const abierto = await page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 }).then(() => true).catch(() => false)
  check('abre el laboratorio', abierto)
  check('  …en «Tú contra ti»', (await page.getAttribute('#laboratorio [data-modo="mesa"]', 'aria-checked')) === 'true')
  const turno = (await page.textContent('#labTurno')).trim()
  const global = lectura.eventos.slice(0, i).filter((e) => e.tipo === 'turno').length
  check('  …en el turno de esa jugada, y le toca a quien le tocaba', turno.startsWith(`Turno ${global} · ${deQuien}`), turno)
  const activo = async (lado) => (await page.getAttribute(`#${lado} .lab-slot-activo [data-slot-carta], #${lado} .lab-slot-activo [data-rival-carta]`, 'aria-label')) || ''
  check('  …con los activos de esa jugada, y el daño que llevaban', (await activo('labLadoPropio')).startsWith(`${s.jugadores[deQuien].activo.cartas.at(-1)}, activo`) && (await activo('labLadoRival')).startsWith(`${s.jugadores[otro].activo.cartas.at(-1)}, activo`), `${await activo('labLadoPropio')} | ${await activo('labLadoRival')}`)
  const vida = (await activo('labLadoRival')).match(/(\d+) de (\d+) PS/)
  check('  …el daño, como en la repetición', vida && Number(vida[2]) - Number(vida[1]) === s.jugadores[otro].activo.danio, vida?.[0])
  check('  …y la mano de quien juega, con sus cartas', (await page.locator('#labMano [data-uid]').count()) === s.jugadores[deQuien].mano)
  // Las teclas del laboratorio no mueven la repetición de debajo.
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  check('las flechas, con el laboratorio encima, no mueven la repetición', Number(await page.inputValue('#repProgreso')) === i)
  await page.click('#laboratorio [data-accion="cerrar"]')
  check('al cerrarlo, la repetición sigue en la misma jugada', (await page.isHidden('#laboratorio')) && Number(await page.inputValue('#repProgreso')) === i)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Desde la jugada de un KO: la mesa cobra enseguida los premios
  // pendientes (y pregunta cuál, como en el laboratorio).
  const { page, errores } = await pagina()
  const ko = lectura.eventos.findIndex((e) => e.tipo === 'ko')
  const premio = lectura.eventos.find((e, k) => k > ko && e.tipo === 'premio')
  await irA(page, ko + 1)
  await page.click('[data-accion="jugar"]')
  // Desde la 594 los premios se cogen tocándolos en la mesa: lo pide la
  // barra de abajo, y no una ventana.
  const pide = await page.waitForFunction((j) => new RegExp(`${j}: coge 1 premio`).test(document.querySelector('#labApuntar.lab-elegir-barra:not(.hidden)')?.textContent || ''), premio.jugador, { timeout: 10000 }).then(() => true).catch(() => false)
  check('desde la jugada de un KO, la mesa pide coger sus premios', pide)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Lo estático ──')
{
  const JS = leer('js/repeticiones.js')
  check('el laboratorio se baja al pulsar, no con la página', !/^import .*constructor\/laboratorio\.js/m.test(JS) && /await import\('\.\/constructor\/laboratorio\.js'\)/.test(JS))
  check('posicion.js no toca el DOM ni la base, ni importa el motor', !/document\.|supabase|partida\.js|efectos\.js/.test(leer('js/repeticiones/posicion.js').replace(/^\s*\/\/.*$/gm, '')))
  check('la página carga la hoja del laboratorio (sus clases las pinta él)', /href="\/css\/laboratorio\.css/.test(leer('repeticiones.html')))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
