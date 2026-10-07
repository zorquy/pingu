// Tanda 495 — las notas del dueño en jugadas concretas de una repetición.
//
// PINGU, de la lista de ideas: «notas en jugadas concretas ("aquí tenía
// que haber retirado"), que se vean al llegar a esa jugada y en la tira de
// momentos, y que las vea quien abra la repetición compartida».
//
//   1. El ancla: una nota va a la LÍNEA del registro (`fila`), que no
//      cambia el día que el lector aprende a leer otra; y si su línea deja
//      de ser una jugada, cae en la de antes.
//   2. El dueño: añadir, cambiar y borrar; la nota sale al llegar a su
//      jugada, en la tira de momentos y como marca en el deslizador, y la
//      reproducción se para lo que se tarda en leerla.
//   3. Quien la abre con el enlace la lee, sin botón de escribir; y una
//      partida pegada lleva a guardarla primero.
//   4. Lo estático: la base solo acepta notas bien formadas.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')
const LINEAS = REGISTRO.replace(/\r/g, '').split('\n')

console.log('\n── 1. El ancla ──')
const lectura = leerRegistro(REGISTRO)
check('cada jugada sabe de qué línea del texto sale', lectura.eventos.every((e) => Number.isInteger(e.fila) && e.fila >= 0 && e.fila < LINEAS.length))
{
  // Lo que importa del ancla, dicho sencillo: la línea de la jugada empieza
  // por el texto de la jugada.
  // (Las del resumen de daño llevan pegadas sus viñetas de debajo: se
  // compara el principio, que es la línea.)
  const malas = lectura.eventos.filter((e) => LINEAS[e.fila].trim().replace(/^-\s*/, '').slice(0, 15) !== e.linea.slice(0, 15))
  check('  …la línea de cada jugada es la suya (empieza igual)', !malas.length, malas.slice(0, 2).map((e) => `${e.fila}: ${e.linea}`).join(' | '))
  check('  …y van en orden, como el texto', lectura.eventos.every((e, i, a) => !i || a[i - 1].fila < e.fila))
}
const filaKo = LINEAS.findIndex((l) => /Fuera de Combate/.test(l))
const fotoKo = lectura.eventos.findIndex((e) => e.fila === filaKo) + 1
const filaRobo = lectura.eventos[40].fila
check('el registro de la prueba tiene un KO con su línea', filaKo > 0 && fotoKo > 1)

// ═════════════════════════════════════════════════════════════════════
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
const GUARDADA = { id: 'abc1234567', registro: REGISTRO, titulo: 'Con notas', compartida: true, notas: [{ fila: filaKo, texto: 'Aquí tenía que haber retirado.\nY guardar el Boss.' }] }
async function pagina({ quien = 'user-1', url = `/repeticiones.html?r=${GUARDADA.id}`, repes = [GUARDADA], ancho = 1280, alto = 800 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ quien, repes }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_REPETICIONES__ = repes
  }, { quien, repes })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
const sala = (page) => page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 }).then(() => true).catch(() => false)
const parar = (page) =>
  page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
const irA = (page, f) =>
  page.evaluate((f) => {
    const r = document.getElementById('repProgreso')
    r.value = String(f)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, f)
const notaVisible = async (page) => ((await page.isVisible('#repNota')) ? (await page.textContent('#repNotaTexto')).trim() : null)
const notasGuardadas = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'replays').map((e) => e.filas[0]?.notas))

console.log('\n── 2. El dueño ──')
{
  const { page, ctx, errores } = await pagina()
  check('la guardada se abre', await sala(page))
  await parar(page)
  const momento = await page.$$eval('.rep-momento[data-tipo="nota"]', (xs) => xs.map((x) => `${x.dataset.foto}|${x.textContent.replace(/\s+/g, ' ').trim()}`))
  check('la nota es un momento de la tira, en la jugada de su línea', momento.length === 1 && momento[0].startsWith(`${fotoKo}|`) && /Nota Aquí tenía que haber retirado/.test(momento[0]), momento.join(' '))
  check('  …y una marca en el deslizador', (await page.locator('#repMarcas .rep-marca[data-tipo="nota"]').count()) === 1)
  await irA(page, fotoKo - 1)
  check('en la jugada de antes no hay nota', (await notaVisible(page)) === null)
  await irA(page, fotoKo)
  check('al llegar a su jugada, la nota se lee (con su salto de línea)', (await notaVisible(page)) === 'Aquí tenía que haber retirado.\nY guardar el Boss.', await notaVisible(page))
  check('  …y el botón dice «Cambiar la nota»', (await page.textContent('[data-accion="nota"]')).trim() === 'Cambiar la nota')

  // Una nota nueva en otra jugada.
  await irA(page, 41)
  check('en otra jugada, «Añadir una nota aquí»', (await page.textContent('[data-accion="nota"]')).trim() === 'Añadir una nota aquí' && (await page.isVisible('[data-accion="nota"]')))
  await page.click('[data-accion="nota"]')
  check('  …la ventana dice en qué jugada y qué pasó en ella', new RegExp(`En la jugada 41: «${lectura.eventos[40].linea.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(await page.textContent('#repDialogoCuerpo')))
  check('  …y que, compartida, la verá quien la abra', /La verá también quien abra la repetición con su enlace/.test(await page.textContent('#repDialogoCuerpo')))
  await page.fill('#repNotaCampo', 'Buen robo')
  await page.click('#repFormNota [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open)
  const tras = (await notasGuardadas(page)).at(-1)
  check('se guardan TODAS las notas, cada una con su línea, en orden', JSON.stringify(tras) === JSON.stringify([{ fila: filaRobo, texto: 'Buen robo' }, { fila: filaKo, texto: GUARDADA.notas[0].texto }].sort((a, b) => a.fila - b.fila)), JSON.stringify(tras))
  check('  …y sale al momento', (await notaVisible(page)) === 'Buen robo' && (await page.locator('.rep-momento[data-tipo="nota"]').count()) === 2)

  // Cambiarla y borrarla.
  await page.click('[data-accion="nota"]')
  check('cambiarla abre con su texto', (await page.inputValue('#repNotaCampo')) === 'Buen robo')
  await page.fill('#repNotaCampo', 'Robo justo')
  await page.click('#repFormNota [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open)
  check('  …y queda cambiada, sin duplicarse', (await notaVisible(page)) === 'Robo justo' && (await notasGuardadas(page)).at(-1).length === 2)
  await page.click('[data-accion="nota"]')
  await page.fill('#repNotaCampo', '   ')
  await page.click('#repFormNota [type=submit]')
  check('una nota en blanco no se guarda: se dice', /Escribe algo/.test(await page.textContent('.rep-dialogo-estado')) && (await page.evaluate(() => document.getElementById('repDialogo').open)))
  await page.click('[data-dlg="borrar-nota"]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open)
  check('«Borrar la nota» la quita, y deja la otra', (await notaVisible(page)) === null && JSON.stringify((await notasGuardadas(page)).at(-1)) === JSON.stringify(GUARDADA.notas))

  // Reproduciendo, se para lo que se tarda en leerla (y a 4× también).
  await page.selectOption('#repVelocidad', '4')
  await irA(page, fotoKo - 1)
  await page.click('[data-accion="reproducir"]')
  await page.waitForFunction((f) => Number(document.getElementById('repProgreso').value) === f, fotoKo, { timeout: 5000 })
  const t0 = Date.now()
  await page.waitForFunction((f) => Number(document.getElementById('repProgreso').value) > f, fotoKo, { timeout: 10000 })
  const quieta = Date.now() - t0
  await parar(page)
  check('reproduciendo a 4×, la jugada con nota se queda lo que se tarda en leerla', quieta > 2000, `${quieta} ms`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Quien la abre con el enlace ──')
{
  const { page, ctx, errores } = await pagina({ quien: 'user-2' })
  check('otra persona la abre (está compartida)', await sala(page))
  await parar(page)
  await irA(page, fotoKo)
  check('  …y lee la nota', (await notaVisible(page)) === GUARDADA.notas[0].texto)
  check('  …pero no tiene botón de escribir', !(await page.isVisible('[data-accion="nota"]')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Una partida pegada: el botón está, y lleva a guardarla primero.
  const { page, ctx } = await pagina({ url: '/repeticiones.html', repes: [] })
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await sala(page)
  await parar(page)
  await page.click('[data-accion="nota"]')
  check('pegada, «Añadir una nota» explica que va con la guardada', /Guárdala primero/.test(await page.textContent('#repDialogoCuerpo')))
  await page.click('[data-dlg="guardar"]')
  check('  …y su botón abre la ventana de guardar', await page.waitForSelector('#repFormGuardar', { timeout: 3000 }).then(() => true).catch(() => false))
  await ctx.close()
}
{
  // Si el lector deja de leer la línea de una nota, la nota cae en la
  // jugada de antes: se simula con una nota en una línea en blanco.
  const blanca = LINEAS.findIndex((l, i) => i > filaKo && !l.trim())
  const antes = lectura.eventos.filter((e) => e.fila < blanca).length
  const { page, ctx } = await pagina({ repes: [{ ...GUARDADA, notas: [{ fila: blanca, texto: 'En una línea que no es jugada' }] }] })
  await sala(page)
  await parar(page)
  const foto = Number(await page.getAttribute('.rep-momento[data-tipo="nota"]', 'data-foto'))
  check('una nota cuya línea no es jugada cae en la jugada de antes (no se pierde)', foto === antes, `${foto} vs ${antes}`)
  await ctx.close()
}

console.log('\n── 4. Lo estático ──')
{
  const SQL = leer('supabase-migration-repeticiones.sql')
  check('la base solo acepta notas bien formadas: lista, ≤300, fila y texto de 1 a 500', /create or replace function public\.replays_notas_validas/.test(SQL) && /jsonb_array_length\(n\) <= 300/.test(SQL) && /e -> 'fila'\) = 'number'/.test(SQL) && /char_length\(e ->> 'texto'\) between 1 and 500/.test(SQL) && /add constraint replays_notas check \(public\.replays_notas_validas\(notas\)\)/.test(SQL))
  check('  …y quien abre el enlace las recibe (repeticiones_leer las devuelve)', /returns table \(registro text, titulo text, jugador_a text, jugador_b text, turnos int, created_at timestamptz, mia boolean, compartida boolean, notas jsonb, mazo_a text, mazo_b text\)/.test(SQL))
  const JS = leer('js/repeticiones.js')
  check('la nota se pinta con textContent (la escribe una persona)', /\$\('repNotaTexto'\)\.textContent = n \? n\.texto : ''/.test(JS))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
