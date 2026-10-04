// Tanda 457 — el pulido de estilos del laboratorio, en el móvil y en el
// ordenador.
//
// PINGU: «sigue trabajando para mejorar los estilos tanto para móviles
// como para ordenadores. Hazlo lo más profesional posible, cuidando los
// detalles y pequeños errores que pueda haber».
//
// Lo que se prueba es la FORMA de cada fallo que se encontró mirando, no
// el caso concreto:
//   1. La mesa entera cabe sin desplazarse en los portátiles comunes
//      (1280×720, 1366×768, 1440×900, 1536×864, 1920×1080).
//   2. La mano va en UNA fila fuera del móvil: con muchas cartas se
//      solapan sin salirse, y la que se señala sube por encima; en el
//      móvil, una tira que se desplaza.
//   3. La banca de cinco cabe en una fila en una tableta en vertical.
//   4. La barra de vida cambia de color al bajar (y lleva su nivel).
//   5. El registro separa los turnos con un separador, sin rayas de texto.
//   6. El cambio de turno se anuncia en el tapete, sin tapar los clics, y
//      se va solo (también con «menos movimiento»).
//   7. El menú del móvil es una hoja con su velo y su asa.
//   8. Antes de empezar, los premios son seis huecos.
//   9. El muñeco: fichas en una sola línea por dato.
//  10. Los detalles: el interruptor de quién empieza en una fila en el
//      móvil, las pestañas de una ventana en una línea, la cabecera de una
//      tableta, el juego junto en una pantalla muy ancha, la chapa de
//      «nueva» visible en la mano solapada, las ventanas que entran sin
//      movimiento si así se pide, y la copa al ganar.
//  11. Sin imágenes (CLAUDE.md, tanda 441: una captura con los datos a
//      medias es OTRA pantalla): el nombre que queda debajo se lee ENTERO
//      en la banca, el estadio y la mano, en el móvil y en el portátil.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.BASE || 'http://localhost:8892'
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)

const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const DRAGAPULT = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
]
const entradas = DRAGAPULT.map(([n, nombre]) => ({ carta: fila(nombre), n }))
const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')

const browser = await chromium.launch()
async function abrir({ ancho = 1440, alto = 900, prefs = {}, movimiento = 'no-preference' } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, reducedMotion: movimiento })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets, prefs }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' }, ...prefs }))
  }, { cartas, sets, prefs })
  await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(300)
  return { page, errores }
}
// Una mesa a dos, ya empezada.
async function aDos(page) {
  await page.click('[data-modo="mesa"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.click('#labDialogo [data-usar="este"]')
  await page.check('#labDialogo input[name="labEmpieza"][value="0"]')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  for (let k = 0; k < 2; k++) {
    await page.click('[data-accion="auto"]')
    await page.click('[data-accion="empezar"]')
    await page.waitForTimeout(200)
  }
  while (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
}
async function empezarMuneco(page) {
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(250)
}
async function traer(page, nombre, { destino = 'mano', n = 1 } = {}) {
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator(`#labDialogo [data-opcion="${destino}"]`).click()
  await page.waitForTimeout(100)
  for (let i = 0; i < n; i++) await page.locator(`#labDialogo [data-elige][aria-label="${nombre}"][aria-pressed="false"]:not([disabled])`).first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
}
// Muchas cartas a la mano de golpe (de cualquier clase).
async function llenarMano(page, n) {
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator('#labDialogo [data-opcion="mano"]').click()
  await page.waitForTimeout(100)
  for (let i = 0; i < n; i++) await page.locator('#labDialogo [data-elige][aria-pressed="false"]:not([disabled])').first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
}
const sobra = (page) => page.evaluate(() => document.querySelector('.lab-mesa').scrollHeight - document.querySelector('.lab-mesa').clientHeight)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La mesa entera cabe, sin desplazarse ──')
for (const [ancho, alto] of [[1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]]) {
  const { page } = await abrir({ ancho, alto })
  await aDos(page)
  const s = await sobra(page)
  check(`[${ancho}×${alto}] a dos, sin desplazar`, s <= 1, `${s}px de más`)
  await page.close()
}
{
  const { page } = await abrir({ ancho: 1366, alto: 768 })
  await empezarMuneco(page)
  const s = await sobra(page)
  check('[1366×768] contra el muñeco, también', s <= 1, `${s}px de más`)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La mano: una fila ──')
for (const [ancho, alto] of [[768, 1024], [1440, 900]]) {
  const { page } = await abrir({ ancho, alto, prefs: { panelAbierto: false } })
  await empezarMuneco(page)
  await llenarMano(page, 12)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(150)
  const r = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('#labMano .lab-carta')].map((n) => n.getBoundingClientRect())
    const m = document.querySelector('#labMano').getBoundingClientRect()
    return { n: cs.length, filas: new Set(cs.map((c) => Math.round(c.top))).size, ultima: cs.at(-1).right, mano: m.right, solapan: cs.some((c, i) => i && c.left < cs[i - 1].right - 1) }
  })
  check(`[${ancho}] ${r.n} cartas en UNA fila`, r.n >= 18 && r.filas === 1, JSON.stringify(r))
  check(`[${ancho}]   …sin salirse por la derecha`, r.ultima <= r.mano + 1, `${Math.round(r.ultima)} > ${Math.round(r.mano)}`)
  if (ancho === 768) {
    check('[768]   …y se solapan para caber', r.solapan)
    // La que se señala sube por encima de la de al lado: el punto que
    // antes tapaba la siguiente ahora es de ella.
    const quinta = page.locator('#labMano .lab-mano-carta').nth(4)
    const caja = await quinta.locator('.lab-carta').boundingBox()
    await quinta.hover({ position: { x: 4, y: 20 } })
    await page.waitForTimeout(200)
    const encima = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.lab-mano-carta') === document.querySelectorAll('#labMano .lab-mano-carta')[4], { x: caja.x + caja.width - 6, y: caja.y + caja.height / 2 })
    check('[768]   …y la que se señala sube por encima de la siguiente', encima)
  }
  await page.close()
}
{
  const { page } = await abrir({ ancho: 390, alto: 844 })
  await empezarMuneco(page)
  await llenarMano(page, 6)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(150)
  const r = await page.evaluate(() => {
    const m = document.querySelector('#labMano')
    const cs = [...m.querySelectorAll('.lab-carta')].map((n) => Math.round(n.getBoundingClientRect().top))
    return { filas: new Set(cs).size, desplaza: m.scrollWidth > m.clientWidth }
  })
  check('[390] en el móvil, una tira que se desplaza', r.filas === 1 && r.desplaza, JSON.stringify(r))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La banca de cinco, en una fila en la tableta ──')
for (const [ancho, alto] of [[768, 1024], [800, 1280]]) {
  const { page } = await abrir({ ancho, alto, prefs: { panelAbierto: false } })
  await empezarMuneco(page)
  // La banca, llena: buscar en el mazo «a la banca» y coger básicos
  // hasta cinco.
  const hay = await page.locator('#labLadoPropio .lab-zona-banca .lab-slot').count()
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator('#labDialogo [data-opcion="banca"]').click()
  await page.waitForTimeout(100)
  for (let i = hay; i < 5; i++) await page.locator('#labDialogo [data-elige][aria-pressed="false"]:not([disabled])').first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  const r = await page.evaluate(() => {
    const ss = [...document.querySelectorAll('#labLadoPropio .lab-zona-banca .lab-slot')].map((n) => Math.round(n.getBoundingClientRect().top))
    return { n: ss.length, filas: new Set(ss).size }
  })
  check(`[${ancho}×${alto}] cinco en la banca, en una fila`, r.n === 5 && r.filas === 1, JSON.stringify(r))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La barra de vida, con su color ──')
{
  const { page } = await abrir()
  await empezarMuneco(page)
  await traer(page, 'Dreepy', { destino: 'banca', n: 2 })
  const ponerDanio = async (i, n) => {
    await page.locator('#labLadoPropio .lab-zona-banca [data-slot-carta]').nth(i).click()
    await page.locator('#labMenu [data-op]', { hasText: 'Poner o quitar daño' }).click()
    await page.locator('#labDialogo input[type="number"]').fill(String(n))
    await page.click('#labDialogo [data-dlg="ok"]')
    await page.waitForTimeout(200)
  }
  await ponerDanio(0, 40)
  await ponerDanio(1, 60)
  const r = await page.evaluate(() => {
    const barras = [...document.querySelectorAll('#labLadoPropio .lab-zona-banca .lab-ps')].slice(0, 2)
    const activo = document.querySelector('#labLadoPropio .lab-slot-activo .lab-ps')
    const color = (b) => getComputedStyle(b.querySelector('span')).backgroundColor
    return { niveles: [activo, ...barras].map((b) => b.dataset.vida), colores: [activo, ...barras].map(color) }
  })
  check('el nivel de la vida va en la barra (entera · por debajo de la mitad · el último cuarto)', r.niveles.join() === 'alta,media,baja', r.niveles.join())
  check('  …y cada nivel tiene su color', new Set(r.colores).size === 3, r.colores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5 y 6. El registro y el cambio de turno ──')
{
  const { page, errores } = await abrir()
  await aDos(page)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(250)
  const aviso = await page.evaluate(() => {
    const a = document.querySelector('#labCambio')
    return { visible: !a.hidden && a.getClientRects().length > 0, texto: a.textContent, clics: getComputedStyle(a).pointerEvents }
  })
  check('al pasar el turno, el tapete dice a quién le toca', aviso.visible && /Turno de Jugador 2/.test(aviso.texto), JSON.stringify(aviso))
  check('  …sin quedarse con los clics', aviso.clics === 'none')
  // Y los clics pasan: se puede terminar el turno al momento.
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(150)
  check('  …se puede jugar con él delante', /Jugador 1/.test(await page.locator('#labTurno').innerText()))
  await page.waitForTimeout(1600)
  check('  …y se va solo', await page.evaluate(() => document.querySelector('#labCambio').hidden))
  if (await page.locator('#labPanel').isHidden()) await page.click('.lab-barra [data-accion="panel"]')
  await page.click('#labPanel [data-panel-pestania="registro"]')
  await page.waitForTimeout(150)
  const r = await page.evaluate(() => {
    const ts = [...document.querySelectorAll('#labRegistro .lab-registro-turno')]
    return { n: ts.length, rayas: ts.some((x) => /──/.test(x.textContent)), linea: ts[0] ? getComputedStyle(ts[0], '::before').borderTopWidth : '' }
  })
  check('el registro separa los turnos con una línea, no con rayas de texto', r.n >= 2 && !r.rayas && r.linea === '1px', JSON.stringify(r))
  check('sin errores de JavaScript', errores.length === 0, errores[0])
  await page.close()
}
{
  const { page } = await abrir({ movimiento: 'reduce' })
  await aDos(page)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(200)
  const r = await page.evaluate(() => ({ animacion: getComputedStyle(document.querySelector('#labCambio')).animationName, visible: !document.querySelector('#labCambio').hidden }))
  check('con «menos movimiento», el aviso sale sin animar…', r.visible && r.animacion === 'none', JSON.stringify(r))
  await page.waitForTimeout(1600)
  check('  …y se va igual (no espera a una animación que no corre)', await page.evaluate(() => document.querySelector('#labCambio').hidden))
  await page.locator('#labLadoPropio [data-pila="mazo"]').click()
  check('  …y las ventanas y el menú entran sin moverse', await page.evaluate(() => getComputedStyle(document.querySelector('#labMenu')).animationName === 'none'))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. El menú del móvil ──')
{
  const { page } = await abrir({ ancho: 390, alto: 844 })
  await empezarMuneco(page)
  await page.locator('#labMano [data-mas]').first().click()
  await page.waitForTimeout(200)
  const r = await page.evaluate(() => {
    const m = document.querySelector('#labMenu')
    const b = m.getBoundingClientRect()
    const sombra = getComputedStyle(m).boxShadow
    const extension = Math.max(...[...sombra.matchAll(/0px 0px 0px (\d+)px/g)].map((x) => Number(x[1])), 0)
    // El asa se mide por el SITIO que ocupa: el título empieza más abajo
    // (sin ella, a 4 px del borde).
    const titulo = m.querySelector('.lab-menu-titulo').getBoundingClientRect().top - b.top
    return { abajo: Math.round(innerHeight - b.bottom), ancho: Math.round(b.width), velo: extension >= Math.max(innerWidth, innerHeight), asa: getComputedStyle(m, '::before').content !== 'none' && titulo >= 12 ? 'sí' : `no (${Math.round(titulo)})` }
  })
  check('[390] el menú es una hoja pegada abajo, de lado a lado', r.abajo === 0 && r.ancho === 390, JSON.stringify(r))
  check('[390]   …con su velo detrás', r.velo)
  check('[390]   …y su asa', r.asa === 'sí', r.asa)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8 y 9. Los premios antes de empezar, y el muñeco ──')
{
  const { page } = await abrir()
  check('antes de empezar, tus premios son seis huecos', (await page.locator('#labLadoPropio .lab-zona-premios .lab-hueco-premio').count()) === 6)
  await empezarMuneco(page)
  check('  …y al empezar, seis cartas boca abajo', (await page.locator('#labLadoPropio .lab-zona-premios [data-premio]').count()) === 6 && (await page.locator('#labLadoPropio .lab-hueco-premio').count()) === 0)
  const r = await page.evaluate(() => {
    // Una línea: menos de línea y media de alto (con `normal`, la línea
    // es ~1,3 veces la letra).
    const una = (el) => {
      const cs = getComputedStyle(el)
      const linea = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3
      return el.getBoundingClientRect().height < linea * 1.5
    }
    const entera = (el) => el.scrollWidth <= el.clientWidth + 1
    return [...document.querySelectorAll('.lab-maniqui')].map((m) => [m.querySelector('.lab-maniqui-nombre'), m.querySelector('.lab-maniqui-vida')].every((el) => una(el) && entera(el)))
  })
  check('el muñeco: nombre y vida en una línea, sin cortar, en cada ficha', r.length >= 2 && r.every(Boolean), JSON.stringify(r))
  await page.close()
}
{
  const { page } = await abrir({ ancho: 360, alto: 740 })
  check('[360] la frase de los premios no se pone en el móvil (bastan los huecos)', await page.locator('#labLadoPropio .lab-cuenta-prep').isHidden())
  const filas = await page.locator('[data-primero]').evaluateAll((ns) => new Set(ns.map((n) => Math.round(n.getBoundingClientRect().top))).size)
  check('[360] «Vas primero / segundo / moneda», en una fila', filas === 1, `${filas} filas`)
  await page.click('[data-modo="mesa"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.waitForTimeout(150)
  // Las líneas del texto de cada pestaña, contadas por el navegador.
  const pest = await page.locator('#labDialogo [data-fuente]').evaluateAll((ns) =>
    ns.map((n) => {
      const r = document.createRange()
      r.selectNodeContents(n)
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size
    })
  )
  check('[360] las pestañas de una ventana, en una línea cada una', pest.every((l) => l === 1), pest.join(', '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 10. Los detalles ──')
{
  const { page } = await abrir({ ancho: 768, alto: 1024 })
  await aDos(page)
  const r = await page.evaluate(() => {
    const b = document.querySelector('.lab-barra').getBoundingClientRect()
    const t = document.querySelector('#labTurno')
    const lh = parseFloat(getComputedStyle(t).lineHeight)
    return { alto: b.height, lineas: Math.round(t.getBoundingClientRect().height / lh), titulo: document.querySelector('.lab-titulo').getBoundingClientRect().width }
  })
  check('[768] en la tableta, el turno en dos líneas como mucho y la barra baja', r.lineas <= 2 && r.alto <= 72, JSON.stringify(r))
  await page.close()
}
{
  const { page } = await abrir({ ancho: 1920, alto: 1080 })
  await aDos(page)
  const w = await page.evaluate(() => [...document.querySelectorAll('.lab-tapete > .lab-lado, .lab-tapete > .lab-centro-mesa')].map((n) => Math.round(n.getBoundingClientRect().width)))
  check('[1920] el juego se queda junto (no se desparrama por el tapete)', w.every((x) => x <= 1281), w.join(', '))
  await page.close()
}
{
  const { page } = await abrir({ ancho: 1024, alto: 768, prefs: { panelAbierto: false } })
  await empezarMuneco(page)
  await llenarMano(page, 14)
  const r = await page.evaluate(() => {
    const ch = document.querySelector('#labMano .lab-chapa-nueva')
    const carta = ch.closest('.lab-carta').getBoundingClientRect()
    const c = ch.getBoundingClientRect()
    return { izq: Math.round(c.left - carta.left), visible: document.elementFromPoint(c.left + 4, c.top + c.height / 2)?.closest('.lab-chapa-nueva') === ch }
  })
  check('la chapa de «nueva» va a la izquierda: en la mano solapada se sigue viendo', r.izq < 12 && r.visible, JSON.stringify(r))
  await page.close()
}
{
  // La copa al ganar: coge cinco premios a mano y deja KO al muñeco.
  const { page } = await abrir({ prefs: { panelAbierto: false } })
  await empezarMuneco(page)
  for (let i = 0; i < 5; i++) {
    await page.locator('#labLadoPropio [data-premio]').first().click()
    await page.locator('#labMenu [data-op]', { hasText: 'Coger este premio' }).click()
    await page.waitForTimeout(100)
  }
  await page.click('[data-accion="atacar"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Atacar a mano' }).click()
  await page.locator('#labDialogo input[type="number"]').fill('990')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(300)
  // Los premios se cogen tocándolos en la mesa (tanda 594).
  for (let k = 0; k < 3 && (await page.locator('[data-elegir]').count()); k++) {
    await page.locator('[data-elegir]').first().click()
    if (await page.locator('[data-elegir-accion="ok"]:not([disabled])').count()) await page.click('[data-elegir-accion="ok"]')
    await page.waitForTimeout(200)
  }
  check('al ganar, la ventana del final lleva su copa', (await page.locator('#labFin:not(.hidden) .lab-fin-icono svg').count()) === 1 && /Victoria/.test(await page.locator('#labFin').innerText()))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 11. Sin imágenes, el nombre se lee entero ──')
// Aquí las imágenes se cortan todas (`abrir` las aborta), que es lo que
// pasa en producción cuando no responde ningún sitio de la cadena. Lo que
// queda es el nombre, y una palabra larga («Determination», «Fezandipiti»)
// no cabía en la ranura y salía cortada por los dos lados.
for (const [ancho, alto] of [[360, 740], [1280, 720]]) {
  const { page } = await abrir({ ancho, alto, prefs: { panelAbierto: false } })
  await aDos(page)
  await traer(page, 'Fezandipiti ex', { destino: 'banca' })
  await traer(page, 'Munkidori', { destino: 'banca' })
  await traer(page, 'Risky Ruins')
  await page.locator('#labMano [data-mano][aria-label^="Risky Ruins"]').first().click()
  await page.waitForTimeout(150)
  await traer(page, "Lillie's Determination")
  const r = await page.evaluate(() =>
    [...document.querySelectorAll('#labLadoPropio .lab-sin-imagen, #labMano .lab-sin-imagen, .lab-estadio .lab-sin-imagen')]
      .filter((e) => e.offsetParent && !e.parentElement.querySelector('img'))
      .map((e) => {
        const rg = document.createRange()
        rg.selectNodeContents(e)
        return {
          n: e.textContent,
          cortado: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
          lineas: new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size,
          estadio: !!e.closest('.lab-estadio'),
        }
      })
  )
  const nombres = new Set(r.map((x) => x.n))
  check(`[${ancho}×${alto}] están los nombres que se miran (banca, estadio, mano)`, ['Fezandipiti ex', 'Munkidori', 'Risky Ruins', "Lillie's Determination"].every((n) => nombres.has(n)), [...nombres].join(', '))
  const cortados = r.filter((x) => x.cortado).map((x) => x.n)
  check(`[${ancho}×${alto}] ningún nombre sale cortado`, r.length > 0 && !cortados.length, [...new Set(cortados)].join(', '))
  const est = r.find((x) => x.estadio)
  check(`[${ancho}×${alto}] en el estadio, «Risky Ruins» en dos líneas (sin partir «Risky»)`, est?.lineas === 2, JSON.stringify(est))
  await page.close()
}
await browser.close()

console.log('\n── 12. Lo que no se ve ──')
{
  const css = leer('css/laboratorio.css')
  check('la paleta de energías sigue intacta (once colores)', [...css.matchAll(/\.lab-energia\[data-tipo='\w'\] \{ --tipo-energia: #[0-9a-f]{6}; \}/g)].length === 11)
  check('las animaciones nuevas se apagan con «menos movimiento»', /prefers-reduced-motion[\s\S]*\.lab-dialogo,\s*\.lab-menu,\s*\.lab-cambio \{\s*animation: none/.test(css))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
