// Tanda 514 — las notas y los momentos dentro del vídeo.
//
// PINGU, de la lista de ideas: «que el vídeo lleve las notas como rótulos,
// y marcas de los KO y del número de turno».
//
//   1. Las piezas: la nota alarga su foto lo que se tarda en LEERLA (y eso
//      no va con el ritmo, como en el reproductor), la barra de momentos
//      sabe dónde cae cada turno y cada KO, y lo que se pinta: el rótulo de
//      la nota, el cartel del KO, el del turno con su número y la barra.
//   2. La ventana: las dos casillas (la barra, y las notas si las hay), las
//      duraciones que cuentan las notas, y un vídeo de verdad con la nota
//      dentro que dura lo que dijo la ventana.
import { readFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const TMP = mkdtempSync(join(tmpdir(), 'video-notas-'))
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')
const LINEAS = REGISTRO.replace(/\r/g, '').split('\n')
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const lectura = leerRegistro(REGISTRO)
const filaKo = LINEAS.findIndex((l) => /Fuera de Combate/.test(l))
// El turno en que cae la nota (la del KO): el vídeo se hace SOLO de ese
// trozo, que es donde una nota mal contada (desde el principio de la
// partida y no del trozo) se nota.
const fotoNota = Math.max(1, lectura.eventos.filter((e) => e.fila <= filaKo).length)
const turnoNota = lectura.eventos.slice(0, fotoNota).filter((e) => e.tipo === 'turno').length
const NOTA = 'Aquí tenía que haber retirado y guardar el Boss para el turno siguiente.'

console.log('\n── 0. El código ──')
{
  const v = readFileSync(`${RAIZ}/js/repeticiones/video.js`, 'utf8')
  check('la nota NO se divide por el ritmo (se lee igual de deprisa a 4×)', /\+ \(extraDe \? extraDe\(i\) \/ 1000 : 0\)/.test(v) && !/extraDe\(i\) \/ 1000 \/ ritmo/.test(v))
  check('el KO anima su cartel como el turno', /'habilidad', 'ko'\]\.includes\(s\.foco\?\.tipo\)/.test(v))
  check('hay un registro con un KO para probar', filaKo > 0 && lectura.eventos.some((e) => e.tipo === 'ko'))
}

const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina({ url = '/repeticiones.html', repes = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ repes }) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_REPETICIONES__ = repes
    // Lo que se escribe en los lienzos, para saber QUÉ dice el vídeo sin
    // tener que leerlo de los píxeles.
    window.__textos__ = new Set()
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...resto) {
      if (window.__textos__.size < 5000) window.__textos__.add(String(t))
      return original.call(this, t, ...resto)
    }
  }, { repes })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}

console.log('\n── 1. Las piezas ──')
{
  const { page, ctx, errores } = await pagina()
  const r = await page.evaluate(async (REG) => {
    const { leerRegistro } = await import('/js/repeticiones/registro.js')
    const { fotos } = await import('/js/repeticiones/estado.js')
    const V = await import('/js/repeticiones/video.js')
    const fs = fotos(leerRegistro(REG))
    const espera = () => 1000
    const suma = (l) => l.reduce((a, x) => a + x.duracion, 0)
    const extraDe = (i) => (i === 3 ? 2500 : 0)
    const lento = suma(V.lineaDeTiempo(fs, espera, 1, { extraDe })) - suma(V.lineaDeTiempo(fs, espera, 1))
    const rapido = suma(V.lineaDeTiempo(fs, espera, 4, { extraDe })) - suma(V.lineaDeTiempo(fs, espera, 4))
    const linea = V.lineaDeTiempo(fs, espera, 2)
    const barra = V.barraDeMomentos(fs, linea)
    const nKo = fs.filter((s) => s.foco?.tipo === 'ko').length
    const nTurnos = fs.filter((s) => s.foco?.tipo === 'turno').length
    // Lo que se pinta: una foto de KO (con su cartel), una de turno y una
    // cualquiera con nota y barra.
    const M = { abajo: 'Rojo', psDe: () => null, letraDe: () => 'D', colorDe: (n) => (n === 'Rojo' ? 0 : 1), fuentesDe: () => [], esperaDe: espera }
    const iKo = fs.findIndex((s) => s.foco?.tipo === 'ko')
    const iTurno = fs.findIndex((s) => s.foco?.tipo === 'turno' && s.turno === 3)
    window.__textos__.clear()
    await V.dibujarUna({ foto: fs[iKo], M, t: 0.5 })
    const textosKo = [...window.__textos__]
    window.__textos__.clear()
    await V.dibujarUna({ foto: fs[iTurno], M, t: 0.5 })
    const textosTurno = [...window.__textos__]
    const quieta = fs[5]
    const sin = await V.dibujarUna({ foto: quieta, M, t: 1 })
    window.__textos__.clear()
    const con = await V.dibujarUna({ foto: quieta, M, t: 1, nota: 'Una nota de prueba', barra: { total: 10, turnos: [1, 3], kos: [2, 8] }, tiempo: 5 })
    const textosNota = [...window.__textos__]
    const vert = await V.dibujarUna({ foto: quieta, M, t: 1, nota: 'Una nota de prueba', formato: 'vertical' })
    // ¿Hay oro (el brillo, #ffd166) en una fila del lienzo, entre x0 y x1?
    const oro = (c, y, x0, x1) => {
      const d = c.getContext('2d').getImageData(x0, y, x1 - x0, 1).data
      let n = 0
      for (let k = 0; k < d.length; k += 4) if (d[k] > 230 && d[k + 1] > 190 && d[k + 1] < 225 && d[k + 2] < 130) n++
      return n
    }
    const gris = (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3)
    return {
      lento,
      rapido,
      barra: { total: barra.total, ok: Math.abs(barra.total - suma(linea)) < 1e-9, kos: barra.kos.length, turnos: barra.turnos.length, orden: barra.kos.every((x, i, a) => !i || a[i - 1] <= x) },
      nKo,
      nTurnos,
      cartaKo: fs[iKo].foco.carta,
      turnoDe: fs[iTurno].deQuien,
      textosKo,
      textosTurno,
      textosNota,
      notaH: [oro(sin, 560, 30, 990), oro(con, 560, 30, 990)],
      notaV: oro(vert, 128, 30, 690),
      // La barra (horizontal, y 704 a 710, de x 24 a 1000): a la mitad del
      // tiempo, lo de antes va claro y lo de después apagado; los KO, en oro.
      barraAntes: gris(con, 24 + 976 * 0.4, 707),
      barraDespues: gris(con, 24 + 976 * 0.7, 707),
      koEnBarra: oro(con, 707, Math.round(24 + 976 * 0.2) - 4, Math.round(24 + 976 * 0.2) + 4),
      sinBarra: oro(sin, 707, Math.round(24 + 976 * 0.2) - 4, Math.round(24 + 976 * 0.2) + 4),
    }
  }, REGISTRO)
  check('una nota alarga su foto lo que se tarda en leerla…', Math.abs(r.lento - 2.5) < 1e-9, r.lento)
  check('  …y a 4× lo mismo: lo que corre es la partida, no quien lee', Math.abs(r.rapido - 2.5) < 1e-9, r.rapido)
  check('la barra dura lo que el vídeo y tiene un sitio por cada turno y cada KO', r.barra.ok && r.barra.kos === r.nKo && r.barra.turnos === r.nTurnos && r.nKo > 0 && r.barra.orden, JSON.stringify(r.barra))
  check('un KO tiene su cartel con el Pokémon que cae', r.textosKo.includes(`KO · ${r.cartaKo}`), r.textosKo.join(' | '))
  check('el cartel del turno lleva su número', r.textosTurno.includes(`Turno 3 de ${r.turnoDe}`), r.textosTurno.join(' | '))
  check('la nota sale como rótulo (la palabra NOTA y su texto)', r.textosNota.includes('NOTA') && r.textosNota.includes('Una nota de prueba'), r.textosNota.join(' | '))
  check('  …con su marco de oro sobre la mano en el horizontal (y sin nota, nada)', r.notaH[0] === 0 && r.notaH[1] > 400, r.notaH.join(' vs '))
  check('  …y arriba en el vertical, dentro de lo que las redes no tapan', r.notaV > 300, r.notaV)
  const claro = (c) => c.every((x) => x > 150)
  check('la barra: hasta donde va, clara; lo que falta, apagado', claro(r.barraAntes) && !claro(r.barraDespues), `${r.barraAntes} / ${r.barraDespues}`)
  check('  …y el KO marcado en oro en su sitio (sin barra, nada)', r.koEnBarra > 2 && r.sinBarra === 0, `${r.koEnBarra} / ${r.sinBarra}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. La ventana ──')
{
  // Sin notas: solo la casilla de la barra.
  const { page, ctx } = await pagina()
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.click('[data-accion="video"]')
  await page.waitForSelector('[data-dlg="hacer-video"]')
  check('la barra se ofrece marcada', await page.isChecked('#repVideoBarra'))
  check('  …y sin notas no hay casilla de notas', (await page.locator('#repVideoNotas').count()) === 0)
  await ctx.close()
}
{
  const GUARDADA = { id: 'vid1234567', registro: REGISTRO, titulo: 'Con nota', compartida: true, notas: [{ fila: filaKo, texto: NOTA }] }
  const { page, ctx, errores } = await pagina({ url: `/repeticiones.html?r=${GUARDADA.id}`, repes: [GUARDADA] })
  await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  await page.click('[data-accion="video"]')
  await page.waitForSelector('[data-dlg="hacer-video"]')
  const etiqueta = (await page.locator('label:has(#repVideoNotas)').textContent()).replace(/\s+/g, ' ').trim()
  check('con una nota, se ofrece meterla (marcada) y dice cuánto se queda', (await page.isChecked('#repVideoNotas')) && etiqueta === 'La nota de la repetición, cada una el rato que se tarda en leerla', etiqueta)
  const con = await page.textContent('[data-dura="4"]')
  await page.uncheck('#repVideoNotas')
  const sin = await page.textContent('[data-dura="4"]')
  const seg = (x) => x.split(':').map(Number).reduce((a, b) => a * 60 + b)
  // 1,5 s + 40 ms por letra, con su tope de 8.
  const espera = Math.min(8, 1.5 + NOTA.length * 0.04)
  check('quitar la nota acorta el vídeo justo lo que se tardaba en leerla', Math.abs(seg(con) - seg(sin) - espera) <= 1, `${con} → ${sin} (nota: ${espera} s)`)
  await page.check('#repVideoNotas')
  await page.check('input[name="repRitmo"][value="4"]')
  // Solo el turno de la nota.
  await page.selectOption('#repDesde', String(turnoNota))
  await page.selectOption('#repHasta', String(turnoNota))
  const trozoCon = await page.textContent('[data-dura="4"]')
  await page.uncheck('#repVideoNotas')
  const trozoSin = await page.textContent('[data-dura="4"]')
  await page.check('#repVideoNotas')
  check(`(el trozo es el turno ${turnoNota}, y la nota cae dentro)`, turnoNota > 1 && seg(trozoCon) - seg(trozoSin) >= 3, `${trozoCon} / ${trozoSin}`)
  await page.evaluate(() => window.__textos__.clear())
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('[data-dlg="hacer-video"]')])
  const textos = await page.evaluate(() => [...window.__textos__])
  check('el vídeo lleva la nota escrita dentro', textos.includes('NOTA') && textos.some((t) => NOTA.startsWith(t) && t.length > 10), textos.filter((t) => /NOTA|retirado/.test(t)).join(' | '))
  check('  …y los carteles de turno con número y de KO', textos.some((t) => /^Turno \d+ de (Rojo|Azul)$/.test(t)) && textos.some((t) => /^KO · /.test(t)))
  const fichero = join(TMP, descarga.suggestedFilename())
  await descarga.saveAs(fichero)
  const p = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', fichero], { encoding: 'utf8' }).stdout || '{}')
  check('ffprobe: el trozo dura lo que dijo la ventana, con la nota', Math.abs(Number(p.format?.duration) - seg(trozoCon)) <= 1, `${p.format?.duration} s, dijo ${trozoCon}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
