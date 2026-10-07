// Tanda 517 — el modo stream de /repeticiones, para OBS.
//
// PINGU, de la lista de ideas: «un modo para OBS: la mesa a pantalla
// completa, fondo plano y todo con el teclado».
//
//   1. Entrar: la mesa SOLA, escalada entera a la ventana y centrada, sobre
//      un fondo de un color (el de la mesa, o verde de croma con «B»), sin
//      controles ni registro en la captura — y la nota, si la hay, sí.
//   2. El teclado: reproducir, jugada, siguiente KO, girar, fondo, salir.
//   3. La ayuda asoma al mover el ratón y se va sola (para que no salga en
//      la captura); con el foco dentro, se queda.
//   4. La dirección para OBS: ?r=…&stream (&fondo=verde) entra directo, y
//      la ayuda la enseña cuando la repetición es compartida.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')
const LINEAS = REGISTRO.replace(/\r/g, '').split('\n')
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos: sacarFotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { momentosDe } = await import(`${RAIZ}/js/repeticiones/numeros.js`)
const lectura = leerRegistro(REGISTRO)
const fs = sacarFotos(lectura)
const primerKo = momentosDe(lectura, fs).find((m) => m.tipo === 'ko')
const filaKo = LINEAS.findIndex((l) => /Fuera de Combate/.test(l))
const GUARDADA = { id: 'str1234567', registro: REGISTRO, titulo: 'Para el stream', compartida: true, notas: [{ fila: filaKo, texto: 'Aquí se gira la partida.' }] }
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'

const browser = await chromium.launch()
async function pagina(url = '/repeticiones.html', { ancho = 1920, alto = 1080 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript((repes) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_REPETICIONES__ = repes
  }, [{ ...GUARDADA, user_id: 'user-1' }])
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
const pegar = async (page) => {
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
}
const medir = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('repTapete').getBoundingClientRect()
    const esc = getComputedStyle(document.getElementById('repEscena'))
    const visible = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    return {
      stream: document.documentElement.classList.contains('rep-stream'),
      t: { izq: Math.round(t.left), der: Math.round(innerWidth - t.right), arr: Math.round(t.top), aba: Math.round(innerHeight - t.bottom), w: Math.round(t.width), h: Math.round(t.height) },
      ventana: [innerWidth, innerHeight],
      fondo: esc.backgroundColor,
      posicion: esc.position,
      registro: visible('.rep-registro'),
      botones: visible('.rep-botones'),
      progreso: visible('#repProgreso'),
      momentos: visible('.rep-momentos'),
      cab: (() => {
        // ¿Asoma algo de la cabecera por encima de la escena?
        const c = document.querySelector('.rep-cab').getBoundingClientRect()
        const el = document.elementFromPoint(c.left + 4, c.top + 4)
        return Boolean(el && el.closest('.rep-cab'))
      })(),
      ayuda: getComputedStyle(document.getElementById('repStreamAyuda') || document.body).opacity,
      arriba: document.querySelector('#repLadoArriba .lab-jugador')?.textContent.trim(),
      i: Number(document.getElementById('repProgreso').value),
    }
  })

console.log('\n── 1. Entrar ──')
{
  const { page, ctx, errores } = await pagina()
  await pegar(page)
  const boton = page.locator('[data-accion="stream"]')
  check('la cabecera ofrece «Modo stream»', (await boton.count()) === 1)
  await boton.click()
  await page.waitForTimeout(300)
  let m = await medir(page)
  check('entra: la escena tapa la página entera (fija)', m.stream && m.posicion === 'fixed' && !m.cab, JSON.stringify(m))
  check('  …sin controles, ni registro, ni momentos en la captura', !m.registro && !m.botones && !m.progreso && !m.momentos)
  check('  …la mesa ENTERA dentro de la ventana, centrada', m.t.izq >= 0 && m.t.der >= 0 && m.t.arr >= 0 && m.t.aba >= 0 && Math.abs(m.t.izq - m.t.der) <= 2 && Math.abs(m.t.arr - m.t.aba) <= 2, JSON.stringify(m.t))
  check('  …y GRANDE: llena el ancho o el alto (menos el margen)', m.t.w >= m.ventana[0] - 34 || m.t.h >= m.ventana[1] - 34, JSON.stringify(m.t))
  check('  …sobre el fondo de la mesa (--navy-solid-dark, que no cambia con el tema)', m.fondo === 'rgb(22, 61, 89)', m.fondo)
  const fondoMesa = m.fondo
  await page.keyboard.press('b')
  m = await medir(page)
  check('«B» lo pone verde de croma', m.fondo === 'rgb(0, 177, 64)', m.fondo)
  await page.keyboard.press('b')
  check('  …y otra vez, el de la mesa', (await medir(page)).fondo === fondoMesa)

  console.log('\n── 2. El teclado ──')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  check('→ avanza jugada a jugada', (await medir(page)).i === 2)
  await page.keyboard.press('n')
  check('«N» va al siguiente KO', (await medir(page)).i === primerKo.foto, `${(await medir(page)).i} / ${primerKo.foto}`)
  const antes = (await medir(page)).arriba
  await page.keyboard.press('g')
  const despues = (await medir(page)).arriba
  check('«G» gira la mesa', antes && despues && antes !== despues, `${antes} → ${despues}`)
  const i0 = (await medir(page)).i
  await page.keyboard.press(' ')
  await page.waitForTimeout(2500)
  check('Espacio reproduce', (await medir(page)).i > i0)
  await page.keyboard.press(' ')

  console.log('\n── 3. La ayuda ──')
  await page.mouse.move(400, 400)
  await page.mouse.move(420, 410)
  await page.waitForTimeout(400)
  check('al mover el ratón asoma la ayuda, con las teclas y «Salir»', (await medir(page)).ayuda === '1' && /Esc: salir/.test(await page.textContent('#repStreamAyuda')) && (await page.locator('#repStreamAyuda [data-accion="salirStream"]').count()) === 1)
  await page.waitForTimeout(3400)
  check('  …y se va sola a los tres segundos (no sale en la captura)', (await medir(page)).ayuda === '0')
  await page.mouse.move(500, 500)
  await page.locator('#repStreamAyuda [data-accion="salirStream"]').focus()
  await page.waitForTimeout(3400)
  check('  …pero con el foco dentro se queda', (await medir(page)).ayuda === '1')
  check('  …y sin la dirección para OBS: esta partida no está guardada', !(await page.textContent('#repStreamAyuda')).includes('&stream'))
  await page.keyboard.press('Escape')
  m = await medir(page)
  check('Esc sale: la escena vuelve a su sitio y la ayuda se va', !m.stream && m.posicion !== 'fixed' && m.botones && (await page.locator('#repStreamAyuda').count()) === 0)
  check('  …y el foco vuelve al botón', await page.evaluate(() => document.activeElement?.dataset.accion === 'stream'))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. La dirección para OBS ──')
{
  const { page, ctx, errores } = await pagina(`/repeticiones.html?r=${GUARDADA.id}&stream&fondo=verde`)
  await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  await page.waitForTimeout(400)
  let m = await medir(page)
  check('?r=…&stream&fondo=verde entra directo, en verde', m.stream && m.fondo === 'rgb(0, 177, 64)', JSON.stringify([m.stream, m.fondo]))
  await page.mouse.move(300, 300)
  const ayuda = await page.textContent('#repStreamAyuda')
  check('  …y la ayuda da la dirección para OBS (es compartida)', ayuda.includes(`/repeticiones?r=${GUARDADA.id}&stream&fondo=verde`), ayuda.slice(0, 200))
  // La nota sale en la captura, dentro de la ventana.
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  const fotoNota = lectura.eventos.filter((e) => e.fila <= filaKo).length
  await page.evaluate((f) => {
    const r = document.getElementById('repProgreso')
    r.value = String(f)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, fotoNota)
  await page.waitForTimeout(300)
  const nota = await page.evaluate(() => {
    const el = document.getElementById('repNota')
    const r = el.getBoundingClientRect()
    return { ve: !el.classList.contains('hidden') && r.height > 0, dentro: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, texto: el.textContent }
  })
  check('la nota de esa jugada sale en la captura, dentro de la ventana', nota.ve && nota.dentro && /Aquí se gira la partida/.test(nota.texto), JSON.stringify(nota))
  // Cambiar el tamaño de la ventana la vuelve a encajar.
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(400)
  m = await medir(page)
  check('al cambiar la ventana, la mesa vuelve a encajar entera', m.t.izq >= 0 && m.t.der >= 0 && m.t.arr >= 0 && m.t.aba >= 0 && (m.t.w >= 1280 - 34 || m.t.h >= 720 - 34), JSON.stringify(m.t))
  // Solo el ALTO, como al estirar hacia abajo la fuente de OBS, y sin cruzar
  // ningún punto de corte (los del laboratorio van por alto hasta 880): la
  // mesa por dentro no cambia, así que solo se entera quien mire la escena.
  await page.setViewportSize({ width: 1280, height: 960 })
  await page.waitForTimeout(400)
  await page.setViewportSize({ width: 1280, height: 1200 })
  await page.waitForTimeout(400)
  const juego = await page.evaluate(() => {
    const r = document.querySelector('.rep-juego').getBoundingClientRect()
    return { arr: Math.round(r.top), aba: Math.round(innerHeight - r.bottom), izq: Math.round(r.left), der: Math.round(innerWidth - r.right) }
  })
  check('  …también si solo cambia el alto: encaja y sigue centrada', juego.arr >= 0 && juego.aba >= 0 && Math.abs(juego.arr - juego.aba) <= 2 && Math.abs(juego.izq - juego.der) <= 2 && (juego.izq <= 17 || juego.arr <= 17), JSON.stringify(juego))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Sin &stream, la de siempre.
  const { page, ctx } = await pagina(`/repeticiones.html?r=${GUARDADA.id}`)
  await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  check('sin &stream, se abre como siempre', !(await medir(page)).stream)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
