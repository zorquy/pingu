// Tanda 924 — La imagen que se comparte de un reto no destripa la respuesta.
//
// PINGU: «en los retos se comparte el resultado como por ejemplo en el de la
// carta de hoy: sale la carta y debería salir blurreada… pueden ser
// spoiler». Lo que se mira:
//   1. Lo estático: «¿Qué carta es?» y «¿Quién es ese Pokémon?» ya no
//      escriben el nombre de la respuesta en la imagen (`detalle`), y el
//      marco tapa la foto por defecto (`tapada = true`).
//   2. En pantalla: con una foto a cuadros (bordes duros), la imagen
//      compartida la pinta DESENFOCADA (casi sin saltos entre píxeles
//      vecinos) y con el «?» encima; con `tapada: false`, nítida. En las
//      dos medidas (historia y la de X).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo estático ──')
{
  for (const [f, nombre] of [['js/carta-del-dia-juego.js', 'nombreDeCarta(respuesta)'], ['js/quien-es-juego.js', 'nombre(buena)']]) {
    const s = leer(f)
    const i = s.indexOf('async function imagenDelResultado')
    const bloque = s.slice(i, s.indexOf('\n}\n', i))
    check(`${f}: la imagen no escribe el nombre de la respuesta`, i > 0 && !/detalle:/.test(bloque) && !bloque.includes(nombre))
    check(`  …ni se destapa a mano`, !/tapada:\s*false/.test(bloque))
  }
  check('el marco tapa la foto si no se dice lo contrario', /chip = '', tapada = true \}\) \{/.test(leer('js/reto-imagen.js')))
}

console.log('\n── 2. En pantalla ──')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/404.html`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/reto-imagen.js')
    // Una «carta» a cuadros de 12 px negros y blancos: nítida, cada pocos
    // píxeles hay un salto de 255; desenfocada, casi ninguno.
    const c = document.createElement('canvas'); c.width = 245; c.height = 342
    const x = c.getContext('2d')
    for (let yy = 0; yy < 342; yy += 12) for (let xx = 0; xx < 245; xx += 12) { x.fillStyle = ((xx + yy) / 12) % 2 ? '#000' : '#fff'; x.fillRect(xx, yy, 12, 12) }
    const foto = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = c.toDataURL() })
    const base = { titulo: '¿Qué carta es?', cuenta: '3/6', numero: 47, filas: [[true, false, true, false], [true, true, true, true]], racha: 2, lema: 'Adivina la carta del día, cada día', enlace: 'pokedoc.es/carta-del-dia', foto, fotoNombre: '' }
    // Los saltos fuertes entre píxeles vecinos dentro de una franja de la
    // foto, lejos del «?» del centro.
    const saltos = (lienzo, x0, x1, y) => {
      const d = lienzo.getContext('2d').getImageData(x0, y, x1 - x0, 1).data
      let n = 0
      for (let i = 4; i < d.length; i += 4) if (Math.abs(d[i] - d[i - 4]) > 120) n++
      return n
    }
    const out = {}
    for (const formato of ['historia', 'apaisada']) {
      const tapada = m.pintarResultadoReto(document.createElement('canvas'), { ...base, formato })
      const nitida = m.pintarResultadoReto(document.createElement('canvas'), { ...base, formato, tapada: false })
      // Dónde cae la foto: historia, centrada desde y = 260; la de X, a la
      // izquierda y centrada en alto.
      const [x0, x1, y] = formato === 'historia' ? [440, 640, 330] : [100, 240, 150]
      const centro = formato === 'historia' ? [540, 260 + 160] : [170, 300]
      const px = tapada.getContext('2d').getImageData(centro[0], centro[1], 1, 1).data
      out[formato] = { tapada: saltos(tapada, x0, x1, y), nitida: saltos(nitida, x0, x1, y), centro: Array.from(px.slice(0, 3)) }
    }
    return out
  })
  for (const f of ['historia', 'apaisada']) {
    check(`[${f}] con la foto nítida se ven los cuadros`, r[f].nitida >= 8, JSON.stringify(r[f]))
    check(`[${f}] la que se comparte, desenfocada`, r[f].tapada <= 1, JSON.stringify(r[f]))
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
