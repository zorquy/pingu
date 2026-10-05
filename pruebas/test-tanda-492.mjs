// Tanda 492 — los momentos clave y la partida en números, en /repeticiones.
//
// PINGU, de la lista de ideas: «marcas en el deslizador para cada KO,
// premio y ataque gordo, y un botón de "siguiente KO"» y «la carrera de
// premios turno a turno, el daño total de cada uno, las cartas más jugadas
// y quién robó más».
//
//   1. Lo que se cuenta (repeticiones/numeros.js), en Node, contra el
//      registro de la 481 —que acaba por premios y tiene de todo: un doble
//      KO, contadores, un golpe que pega a dos— con los números contados a
//      mano leyendo el registro.
//   2. La página: la tira de momentos y sus marcas, «Siguiente KO», la
//      tabla, la carrera de premios (con su tabla) y lo que más jugó cada
//      uno; en el móvil, sin desbordar y con botones de 44 px.
//   3. Lo estático: sin DOM en lo que cuenta, y los nombres del registro
//      nunca pegados a un innerHTML en el gráfico.
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
const { fotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { momentosDe, numerosDe, siguienteKo, GOLPE_GORDO } = await import(`${RAIZ}/js/repeticiones/numeros.js`)
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

console.log('\n── 1. Lo que se cuenta ──')
const lectura = leerRegistro(REGISTRO)
const fs = fotos(lectura)
const ms = momentosDe(lectura, fs)
const resumen = (m) => `${m.foto}:${m.tipo}:${(m.caidos || []).join('+')}:${m.danio || ''}:${m.premios?.n || ''}`
check(
  'los momentos: cinco KO, un golpe gordo que no tumba a nadie y el final, en orden',
  ms.map(resumen).join(' ') === '57:ko:Budew:20:1 80:ko:Zorua de N+Zorua de N:200:2 139:golpe::200: 160:ko:Mega-Greninja ex:460:3 185:ko:Zoroark ex de N+Zorua de N:120:3 202:ko:Fezandipiti ex:250:2 208:fin:::',
  ms.map(resumen).join(' ')
)
check('  …el doble KO de Picado Fantasma es UN momento, en la foto del golpe', ms[1].foto === ev(80).foto && ev(80).tipo === 'ataque' && ms[1].victima === 'Rojo' && ms[1].jugador === 'Azul')
function ev(foto) {
  return { foto, tipo: lectura.eventos[foto - 1]?.tipo }
}
check('  …y cada KO sabe quién coge los premios', ms.filter((m) => m.tipo === 'ko').every((m) => m.premios && m.premios.jugador !== m.victima))
check('el final dice por qué', ms.at(-1).tipo === 'fin' && ms.at(-1).jugador === 'Rojo' && ms.at(-1).porque === 'premios')
check('un golpe gordo es de 200 o más, y sin KO', GOLPE_GORDO === 200 && ms.filter((m) => m.tipo === 'golpe').every((m) => m.danio >= 200))
check('«siguiente KO» va al siguiente, y después del último no hay', siguienteKo(ms, 0)?.foto === 57 && siguienteKo(ms, 57)?.foto === 80 && siguienteKo(ms, 202) === null)

const n = numerosDe(lectura, fs)
const R = n.por.Rojo
const A = n.por.Azul
// Contado a mano en el registro: Rojo pega 20 + 20 + 170 + 460 + 250;
// Azul 20 + 20, dos Picados Fantasma de 200 con 60 en contadores cada uno,
// y una Ráfaga Espejismo de 120 a dos.
check('el daño hecho cuenta ataques, contadores y el segundo golpe', R.danio === 920 && A.danio === 800, `${R.danio} y ${A.danio}`)
check('el golpe más fuerte de cada uno', R.golpeMax?.danio === 460 && R.golpeMax.ataque === 'Bromista Nocturno' && A.golpeMax?.danio === 200 && A.golpeMax.ataque === 'Picado Fantasma')
check('los Pokémon que tumba cada uno (el doble KO cuenta dos)', R.kos === 3 && A.kos === 4, `${R.kos} y ${A.kos}`)
check('los premios cogidos', R.premios === 6 && A.premios === 5)
check('lo jugado: Más PP de N tres veces, y usar la Fábrica no cuenta como jugarla', R.masJugadas[0]?.carta === 'Más PP de N' && R.masJugadas[0].veces === 3 && A.masJugadas.find((x) => x.carta === 'Fábrica del Team Rocket')?.veces === 1, JSON.stringify(A.masJugadas))
check(
  'la carrera: seis cada uno al empezar, 5/4 tras el doble KO y 0/1 al final',
  n.carrera.length === 12 && n.carrera[0].premios.Rojo === 6 && n.carrera[0].premios.Azul === 6 && n.carrera[6].premios.Rojo === 5 && n.carrera[6].premios.Azul === 4 && n.carrera[11].premios.Rojo === 0 && n.carrera[11].premios.Azul === 1,
  n.carrera.map((c) => `${c.turno}:${c.premios.Rojo}/${c.premios.Azul}`).join(' ')
)
{
  // Un KO que el registro NO escribe: la mesa lo deduce de la vida al
  // subir otro (estado.js). También cuenta.
  const mini = `Preparación
Rojo ha robado 7 cartas de la mano inicial.
Azul ha robado 7 cartas de la mano inicial.
Rojo ha puesto en juego a Pikachu en el Puesto Activo.
Azul ha puesto en juego a Eevee en el Puesto Activo.
Azul ha puesto en juego a Snorlax en la Banca.

Turno de Rojo
Rojo ha robado Ultra Ball.
El Pikachu de Rojo ha infligido 60 puntos de daño usando Impactrueno contra el Eevee de Azul.
El Snorlax de Azul pasa a estar en el Puesto Activo.
Rojo ha cogido una carta de Premio.

Turno de Azul
Azul ha robado una carta.`
  const l = leerRegistro(mini)
  const f = fotos(l, { psDe: (x) => ({ Eevee: 60, Pikachu: 60, Snorlax: 150 })[x] || null })
  check('un KO que se deduce de la vida (sin línea de KO) también cuenta', numerosDe(l, f).por.Rojo.kos === 1, numerosDe(l, f).por.Rojo.kos)
}

console.log('\n── 2. La página ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/><rect x="10" y="10" width="225" height="322" rx="8" fill="#9cc3e0"/></svg>'
const browser = await chromium.launch()
async function abrir({ ancho = 1440, alto = 900, tacto = false } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, hasTouch: tacto })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
  })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  return { page, errores }
}
const jugada = (page) => page.evaluate(() => Number(document.getElementById('repProgreso').value))
{
  const { page, errores } = await abrir()
  const chips = await page.$$eval('.rep-momento', (xs) => xs.map((x) => ({ foto: Number(x.dataset.foto), tipo: x.dataset.tipo, texto: x.textContent.replace(/\s+/g, ' ').trim() })))
  check('la tira tiene un botón por momento, con su foto', chips.map((c) => c.foto).join(',') === ms.map((m) => m.foto).join(','), chips.map((c) => c.foto).join(','))
  check('  …y dice de quién era el que cae, qué lo tumbó y quién coge los premios', /Turno 6 Rojo KO de Zorua de N y Zorua de N Picado Fantasma, 200 · Azul coge 2 premios/.test(chips[1].texto), chips[1].texto)
  check('  …el golpe gordo y el final', /Golpe de 200 Picado Fantasma de Dragapult ex/.test(chips[2].texto) && /Final Gana Rojo por premios/.test(chips.at(-1).texto), `${chips[2].texto} | ${chips.at(-1).texto}`)
  const marcas = await page.$$eval('#repMarcas .rep-marca', (xs) => xs.map((x) => ({ tipo: x.dataset.tipo, p: Number(x.style.getPropertyValue('--p')) })))
  const ultimo = fs.length - 1
  check('una marca en el deslizador por momento, en su sitio', marcas.length === ms.length && marcas.every((m, i) => Math.abs(m.p - ms[i].foto / ultimo) < 0.001 && m.tipo === ms[i].tipo), JSON.stringify(marcas.slice(0, 3)))
  // Que la marca caiga donde cae el pulgar: se mide en la pantalla.
  {
    await page.evaluate((f) => {
      const r = document.getElementById('repProgreso')
      r.value = String(f)
      r.dispatchEvent(new Event('input', { bubbles: true }))
    }, ms[3].foto)
    const caja = await page.locator('#repProgreso').boundingBox()
    const marca = await page.locator('#repMarcas .rep-marca').nth(3).boundingBox()
    const esperado = caja.x + 8 + (caja.width - 16) * (ms[3].foto / ultimo)
    check('  …y la marca cae debajo del pulgar (al píxel)', Math.abs(marca.x + marca.width / 2 - esperado) <= 1.5, `${marca.x + marca.width / 2} vs ${esperado}`)
  }
  await page.evaluate(() => {
    const r = document.getElementById('repProgreso')
    r.value = '0'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('[data-accion="siguienteKo"]')
  check('«Siguiente KO» desde el principio va al primer KO', (await jugada(page)) === 57)
  await page.click('[data-accion="siguienteKo"]')
  check('  …y otra vez, al siguiente', (await jugada(page)) === 80)
  check('  …y el botón del momento en el que estás queda marcado', (await page.getAttribute('.rep-momento[data-foto="80"]', 'aria-current')) === 'step' && (await page.locator('.rep-momento[aria-current]').count()) === 1)
  await page.click('.rep-momento[data-tipo="golpe"]')
  check('pulsar un momento lleva a su jugada', (await jugada(page)) === 139)
  await page.evaluate((f) => {
    const r = document.getElementById('repProgreso')
    r.value = String(f)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, 202)
  check('después del último KO, «Siguiente KO» se apaga', await page.isDisabled('[data-accion="siguienteKo"]'))

  // Los números.
  const tabla = await page.$$eval('.rep-tabla-numeros tbody tr', (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim())))
  const fila = (t) => tabla.find((f) => f[0] === t)
  check('la tabla: daño, golpe más fuerte, KO y premios de cada uno', fila('Daño hecho')?.join('|') === 'Daño hecho|920|800' && /^460 Bromista Nocturno$/.test(fila('Golpe más fuerte')?.[1]) && fila('Pokémon noqueados')?.join('|') === 'Pokémon noqueados|3|4' && fila('Premios cogidos')?.join('|') === 'Premios cogidos|6|5', JSON.stringify(tabla))
  check('  …con las columnas en el orden de los jugadores', (await page.$$eval('.rep-tabla-numeros thead th', (xs) => xs.map((x) => x.textContent.trim()))).slice(1).join() === 'Rojo,Azul')
  const carreraTabla = await page.$$eval('.rep-numeros-detalle tbody tr', (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()).join('|')))
  check('la carrera también en tabla: una fila por turno, más el inicio', carreraTabla.length === 12 && carreraTabla[0] === 'Inicio|6|6' && carreraTabla[11] === '11 de Rojo|0|1', carreraTabla.slice(-2).join(' / '))
  const lineas = await page.$$eval('#repCarrera path.rep-carrera-linea', (ps) => ps.map((p) => ({ d: p.getAttribute('d'), color: getComputedStyle(p).stroke })))
  check('el gráfico tiene las dos líneas, distintas y de dos colores', lineas.length === 2 && lineas[0].d !== lineas[1].d && lineas[0].color !== lineas[1].color, JSON.stringify(lineas.map((l) => l.color)))
  // El contraste de cada línea contra el fondo de la caja, medido.
  {
    const fondo = await page.$eval('#repNumeros', (x) => getComputedStyle(x).backgroundColor)
    const rgb = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a, b) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const ratios = lineas.map((l) => ratio(l.color, fondo))
    check('  …y cada línea se ve contra su fondo (3:1 o más)', ratios.every((r) => r >= 3), ratios.map((r) => r.toFixed(2)).join(', '))
  }
  check('el gráfico es dibujo: lo lee la tabla', (await page.getAttribute('#repCarrera svg', 'aria-hidden')) === 'true')
  {
    await page.locator('#repNumeros').scrollIntoViewIfNeeded()
    const caja = await page.locator('#repCarrera svg').boundingBox()
    await page.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height / 2)
    const nota = await page.textContent('.rep-carrera-nota')
    check('al pasar por encima, la nota dice el turno y los premios de los dos', !(await page.isHidden('.rep-carrera-nota')) && /Al acabar el turno \d+/.test(nota) && /premios?\s*·\s*Rojo/.test(nota) && /premios?\s*·\s*Azul/.test(nota), nota)
    // Desde el principio, para que llegar al turno 10 u 11 sea cosa del clic.
    await page.evaluate(() => {
      const r = document.getElementById('repProgreso')
      r.value = '0'
      r.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.mouse.click(caja.x + caja.width - 40, caja.y + caja.height / 2)
    const t = await page.textContent('#repCuenta')
    check('  …y un clic lleva la repetición a ese turno', /^Turno 1[01] /.test(t), t)
  }
  const listas = await page.$$eval('.rep-numeros-lista', (xs) => xs.map((x) => x.innerText.replace(/\s+/g, ' ').trim()))
  check('lo que más jugó cada uno, de más a menos', /^Rojo Más PP de N ×3 Órdenes de Jefes ×2/.test(listas[0]) && /^Azul /.test(listas[1]), listas[0])
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page, errores } = await abrir({ ancho: 390, alto: 844, tacto: true })
  check('[móvil] la página no se sale de lado', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  // Con las dos mitades de la suite a la vez, a veces se medía antes de que
  // la tira estuviera pintada (todo a 0): se espera a que lo esté.
  await page.waitForFunction(() => [...document.querySelectorAll('.rep-momento')].some((x) => x.getBoundingClientRect().height > 0), null, { timeout: 4000 }).catch(() => {})
  const altos = await page.$$eval('.rep-momento, [data-accion="siguienteKo"], .rep-numeros-detalle summary', (xs) => xs.map((x) => Math.round(x.getBoundingClientRect().height)))
  check('[móvil] los momentos y «Siguiente KO» miden 44 px o más', altos.every((h) => h >= 44), altos.join(','))
  const tira = await page.$eval('#repMomentosLista', (x) => ({ desliza: x.scrollWidth > x.clientWidth, estilo: getComputedStyle(x).overflowX }))
  check('[móvil] la tira se desliza dentro de su caja', tira.desliza && tira.estilo === 'auto', JSON.stringify(tira))
  check('[móvil] el gráfico cabe en su caja', await page.$eval('#repCarrera', (c) => c.querySelector('svg').getBoundingClientRect().width <= c.getBoundingClientRect().width + 0.5))
  check('[móvil] sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Lo estático ──')
{
  const num = leer('js/repeticiones/numeros.js')
  check('lo que se cuenta no toca el DOM (se prueba en Node)', !/document\.|window\./.test(num) && !/^import /m.test(num))
  // Sin los comentarios: el que explica la regla nombra lo que prohíbe.
  const car = leer('js/repeticiones/carrera.js').replace(/^\s*\/\/.*$/gm, '')
  check('los nombres del registro entran en el gráfico con textContent, nunca con innerHTML', !/innerHTML/.test(car) && /textContent = n\b/.test(car))
  const css = leer('css/repeticiones.css')
  check('el gráfico va sobre un fondo que no cambia con el tema', /\.rep-numeros \{[^}]*background: var\(--navy-solid-dark\)/.test(css))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
