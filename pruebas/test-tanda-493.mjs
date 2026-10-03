// Tanda 493 — el vídeo vertical (9:16) y el recorte por turnos.
//
// PINGU, de la lista de ideas: «vídeo vertical 9:16 para TikTok, Reels y
// Shorts» y «recortar el vídeo: eliges "del turno 6 al 8" y te bajas solo
// ese trozo».
//
//   1. Las piezas, en el navegador: el trozo (`tramoDe`), el cierre de un
//      trozo que no acaba en el final, y el dibujo vertical (medidas, quién
//      va arriba y el cartel del final en su sitio).
//   2. La ventana: formato, «desde» y «hasta» con las duraciones al día, el
//      «hasta» que no puede quedar antes del «desde», y un vídeo vertical
//      de los turnos 6 a 8 de verdad: ffprobe dice 720×1280 y lo que dura
//      es lo que dijo la ventana.
//
// La horizontal de siempre la sigue mirando la prueba de la 480 (y el
// cambio de la composición a piezas se comparó al píxel al hacerlo).
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const TMP = mkdtempSync(join(tmpdir(), 'video-vertical-'))
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/><rect x="10" y="10" width="225" height="322" rx="8" fill="#9cc3e0"/></svg>'

const NOMBRES = ['Drakloak', 'Frogadier', 'Fezandipiti ex', 'Shaymin', 'Dreepy', 'Budew', 'Zorua de N', 'Froakie', 'Dragapult ex']
const CARTAS = NOMBRES.map((n, i) => ({ id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', name: n, name_es: n, category: 'Pokemon', hp: 100, image_path: null, regulation_mark: 'H' }))
const SETS = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 99 }]
const browser = await chromium.launch()
async function abrir({ ancho = 1280, alto = 800 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  // Las cartas del catálogo de mentira: con ellas el vídeo pinta DIBUJOS
  // (los de /escaneo, que aquí son un rectángulo claro).
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_SETS__ = sets
  }, { cartas: CARTAS, sets: SETS })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}

console.log('\n── 1. Las piezas ──')
{
  const { page, ctx, errores } = await abrir()
  const r = await page.evaluate(async (REG) => {
    const { leerRegistro } = await import('/js/repeticiones/registro.js')
    const { fotos } = await import('/js/repeticiones/estado.js')
    const V = await import('/js/repeticiones/video.js')
    const fs = fotos(leerRegistro(REG))
    const espera = () => 1000
    const t = V.tramoDe(fs, 10, 20)
    const entero = V.tramoDe(fs, 0, fs.length - 1)
    const suma = (l) => l.reduce((a, x) => a + x.duracion, 0)
    const conCierre = suma(V.lineaDeTiempo(t.fotos, espera, 1, { cierre: t.cierre }))
    const sinCierre = suma(V.lineaDeTiempo(t.fotos, espera, 1))
    const M = { abajo: 'Rojo', psDe: () => null, letraDe: () => 'D', colorDe: (n) => (n === 'Rojo' ? 0 : 1), fuentesDe: () => [], esperaDe: espera }
    const v = await V.dibujarUna({ foto: fs.at(-1), M, t: 1, formato: 'vertical' })
    const h = await V.dibujarUna({ foto: fs.at(-1), M, t: 1 })
    const px = (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3)
    // El cartel del final, centrado en la caja del centro: una fila que lo
    // cruza tiene que tener el oro de su borde.
    const fila = v.getContext('2d').getImageData(180, 584, 120, 1).data
    let oro = false
    for (let k = 0; k < fila.length; k += 4) if (fila[k] > 200 && fila[k + 1] > 160 && fila[k + 2] < 150) oro = true
    return {
      tramo: [t.fotos.length, t.fotos[0] === fs[10], t.fotos.at(-1) === fs[20], t.cierre],
      entero: [entero.fotos.length === fs.length, entero.cierre],
      revuelto: V.tramoDe(fs, 30, 5).fotos.length,
      duraciones: [conCierre, sinCierre],
      medidas: [v.width, v.height, h.width, h.height],
      formatos: V.FORMATOS,
      chapaArriba: px(v, 30, 124),
      chapaAbajo: px(v, 30, 1030),
      oro,
    }
  }, REGISTRO)
  check('el trozo va de la foto «desde» a la «hasta», las dos dentro', r.tramo.join() === '11,true,true,1', r.tramo.join())
  check('  …un trozo que no acaba en el final lleva un segundo de cierre (si no, se corta en seco)', Math.abs(r.duraciones[0] - r.duraciones[1] - 1) < 0.001, r.duraciones.join(' vs '))
  check('  …y la partida entera no lo lleva (ya tiene el cartel del final)', r.entero.join() === 'true,0')
  check('  …y un «hasta» antes del «desde» no da un trozo vacío', r.revuelto === 1)
  check('el vertical mide 720×1280 y el horizontal sigue en 1280×720', r.medidas.join() === '720,1280,1280,720' && r.formatos.vertical.ancho === 720)
  const cerca = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 12)
  check('en el vertical el rival va ARRIBA (su chapa ámbar) y el que mira, abajo (la azul)', cerca(r.chapaArriba, [245, 207, 122]) && cerca(r.chapaAbajo, [159, 208, 240]), `${r.chapaArriba} / ${r.chapaAbajo}`)
  check('el cartel de quién gana sale en el centro del vertical', r.oro)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. La ventana y un vídeo de verdad ──')
{
  const { page, ctx, errores } = await abrir()
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.click('[data-accion="video"]')
  await page.waitForSelector('[data-dlg="hacer-video"]')
  const texto = await page.textContent('#repDialogoCuerpo')
  check('la ventana ofrece horizontal y vertical, y dice para qué es cada uno', /Horizontal · 16:9/.test(texto) && /Vertical · 9:16, para TikTok, Reels y Shorts/.test(texto))
  const desdes = await page.$$eval('#repDesde option', (xs) => xs.map((x) => x.textContent))
  const hastas = await page.$$eval('#repHasta option', (xs) => xs.map((x) => x.textContent))
  check('«desde» va del principio al último turno y «hasta» acaba en «el final»', desdes[0] === 'El principio' && desdes.length === 12 && /^Turno 6 · Azul$/.test(desdes[6]) && hastas.length === 11 && hastas.at(-1) === 'El final (turno 11)', `${desdes.length} / ${hastas.at(-1)}`)
  const entero = await page.textContent('[data-dura="4"]')
  await page.selectOption('#repDesde', '9')
  check('un «desde» después del «hasta» lo arrastra', (await page.inputValue('#repHasta')) === '11')
  await page.selectOption('#repHasta', '7')
  check('  …y un «hasta» antes del «desde» lo arrastra también', (await page.inputValue('#repDesde')) === '7')
  await page.selectOption('#repDesde', '6')
  await page.selectOption('#repHasta', '8')
  const trozo = await page.textContent('[data-dura="4"]')
  check('las duraciones se cuentan con el trozo', entero !== trozo && /^0:\d\d$/.test(trozo), `${entero} → ${trozo}`)
  await page.check('input[name="repFormato"][value="vertical"]')
  await page.check('input[name="repRitmo"][value="4"]')
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('[data-dlg="hacer-video"]')])
  check('el fichero dice que es vertical y qué turnos lleva', descarga.suggestedFilename() === 'repeticion-rojo-contra-azul-vertical-turnos-6-8.mp4', descarga.suggestedFilename())
  const fichero = join(TMP, descarga.suggestedFilename())
  await descarga.saveAs(fichero)
  const sonda = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', fichero], { encoding: 'utf8' })
  const p = JSON.parse(sonda.stdout || '{}')
  const s = p.streams?.[0]
  const [m, seg] = trozo.split(':').map(Number)
  check('ffprobe: 720×1280', s?.width === 720 && s?.height === 1280, JSON.stringify(s))
  check('  …y dura lo que dijo la ventana para ese trozo', Math.abs(Number(p.format?.duration) - (m * 60 + seg)) <= 1, `${p.format?.duration} s, dijo ${trozo}`)
  check('  …y se decodifica entero', spawnSync('ffmpeg', ['-v', 'error', '-i', fichero, '-f', 'null', '-']).status === 0)
  // El primer fotograma es el del turno 6 y no el de la preparación: al
  // empezar la partida la banca de arriba está VACÍA (huecos oscuros), y en
  // el turno 6 tiene tres cartas (las de mentira, claras). Se mide el
  // brillo medio de ese trozo de la banca.
  const crudo = join(TMP, 'primero.rgb')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', fichero, '-frames:v', '1', '-vf', 'crop=174:100:126:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', crudo])
  const bytes = existsSync(crudo) ? readFileSync(crudo) : Buffer.alloc(0)
  const brillo = bytes.length ? bytes.reduce((a, x) => a + x, 0) / bytes.length : 0
  check('  …y empieza en el turno 6, con la banca de arriba llena (no en la preparación)', brillo > 110, brillo.toFixed(1))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
