import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 247, las dos cosas que pidió PINGU el 2026-09-01:
//
//   1. Borrar un tema del foro. No se podía: la base lo permitía desde
//      siempre (política `forum_threads_delete`) pero no había botón.
//   2. El anuncio de un torneo tiene que caer en «Juego → Torneos» y no
//      en el primer foro de la lista, que era pura casualidad del orden.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((s) => {
    for (const [clave, valor] of Object.entries(s)) window[clave] = valor
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

const escrituras = (page, tabla, tipo) =>
  page.evaluate(
    ([t, k]) => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === t && e.tipo === k),
    [tabla, tipo]
  )

// ═════════════════════════════════════════════════════════════════════
// PARTE 1 — Borrar un tema
// ═════════════════════════════════════════════════════════════════════

const FORO = {
  __FAKE_SECCIONES__: [{ id: 'seccion-1', name: 'Comunidad', position: 0 }],
  __FAKE_FOROS__: [{ id: 'foro-1', slug: 'dudas', name: 'Dudas de reglas', section_id: 'seccion-1' }],
}
// Un tema con dos respuestas encima del primer mensaje: post_count 3.
const CON_RESPUESTAS = {
  ...FORO,
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Duda con Dragapult', author_id: 'user-1', post_count: 3 }],
  __FAKE_MENSAJES__: [
    { id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>La primera</p>' },
    { id: 'msg-2', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>La segunda</p>' },
    { id: 'msg-3', thread_id: 'tema-1', author_id: 'user-3', body_html: '<p>La tercera</p>' },
  ],
}
// Un tema recién abierto, sin que nadie haya contestado: post_count 1.
const SIN_RESPUESTAS = {
  ...FORO,
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Me presento', author_id: 'user-1', post_count: 1 }],
  __FAKE_MENSAJES__: [{ id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Hola</p>' }],
}

console.log('\n── 1. Quién ve el botón de borrar ──')
{
  const { page, errores } = await abrir('/tema?t=tema-1', { ...CON_RESPUESTAS, __FAKE_SESSION__: 'admin-1' })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('el equipo lo ve', (await page.locator('#btnBorrarTema').count()) === 1)
  check('y sigue viendo fijar y cerrar', (await page.locator('#btnFijar').count()) === 1 && (await page.locator('#btnCerrar').count()) === 1)
  await page.close()
}
{
  // user-2 no es del equipo ni escribió el tema: no puede borrarlo.
  const { page } = await abrir('/tema?t=tema-1', { ...CON_RESPUESTAS, __FAKE_SESSION__: 'user-2' })
  check('un cualquiera NO lo ve', (await page.locator('#btnBorrarTema').count()) === 0)
  await page.close()
}
{
  // El autor, pero con gente ya metida en el hilo: tampoco. Es la misma
  // condición que la política de la base (post_count <= 1).
  const { page } = await abrir('/tema?t=tema-1', { ...CON_RESPUESTAS, __FAKE_SESSION__: 'user-1' })
  check('el autor con respuestas NO lo ve', (await page.locator('#btnBorrarTema').count()) === 0)
  await page.close()
}
{
  const { page } = await abrir('/tema?t=tema-1', { ...SIN_RESPUESTAS, __FAKE_SESSION__: 'user-1' })
  check('el autor de un tema sin contestar SÍ lo ve', (await page.locator('#btnBorrarTema').count()) === 1)
  check('y sin ser del equipo no le salen fijar ni cerrar', (await page.locator('#btnFijar').count()) === 0)
  await page.close()
}
{
  const { page } = await abrir('/tema?t=tema-1', { ...SIN_RESPUESTAS, __FAKE_SESSION__: 'none' })
  check('sin sesión no hay botón', (await page.locator('#btnBorrarTema').count()) === 0)
  await page.close()
}

console.log('\n── 2. El primer clic pregunta y NO borra ──')
{
  const { page } = await abrir('/tema?t=tema-1', { ...CON_RESPUESTAS, __FAKE_SESSION__: 'admin-1' })
  await page.locator('#btnBorrarTema').click()
  await page.waitForTimeout(300)
  const texto = await page.locator('#btnBorrarTema').innerText()
  check('el botón pasa a pedir confirmación', /seguro/i.test(texto), texto)
  check('y dice cuántas respuestas se llevan por delante', /2 respuestas/.test(texto), texto)
  check('todavía NO se ha borrado nada', (await escrituras(page, 'forum_threads', 'delete')).length === 0)
  check('y seguimos en el tema', page.url().includes('tema-1'), page.url())
  await page.close()
}
{
  // Un tema sin respuestas no puede decir «se van también 0 respuestas».
  const { page } = await abrir('/tema?t=tema-1', { ...SIN_RESPUESTAS, __FAKE_SESSION__: 'user-1' })
  await page.locator('#btnBorrarTema').click()
  await page.waitForTimeout(300)
  const texto = await page.locator('#btnBorrarTema').innerText()
  check('sin respuestas, no habla de respuestas', !/respuesta/i.test(texto), texto)
  check('pero sigue avisando de que no hay vuelta atrás', /vuelta atr/i.test(texto), texto)
  await page.close()
}

console.log('\n── 3. El segundo clic borra y te devuelve al foro ──')
{
  const { page } = await abrir('/tema?t=tema-1', { ...CON_RESPUESTAS, __FAKE_SESSION__: 'admin-1' })
  await page.locator('#btnBorrarTema').click()
  await page.waitForTimeout(250)
  await page.locator('#btnBorrarTema').click()
  await page.waitForTimeout(1600)
  const borrados = await escrituras(page, 'forum_threads', 'delete')
  check('se borra el tema', borrados.length === 1 && borrados[0].filas[0]?.id === 'tema-1', JSON.stringify(borrados).slice(0, 120))
  check('y acabamos en el foro del que colgaba', /\/foro\/dudas|f=dudas/.test(page.url()), page.url())
  await page.close()
}

console.log('\n── 4. Si la base dice que no, la página se entera ──')
{
  // Un DELETE que la política rechaza NO da error: se va sin tocar nada.
  // Sin pedir de vuelta lo borrado (`.select()`), la página creería que
  // ha borrado y te mandaría a un foro donde el tema sigue estando.
  const { page } = await abrir('/tema?t=tema-1', {
    ...CON_RESPUESTAS,
    __FAKE_SESSION__: 'admin-1',
    __RLS_SIN_BORRAR__: ['forum_threads'],
  })
  await page.locator('#btnBorrarTema').click()
  await page.waitForTimeout(250)
  await page.locator('#btnBorrarTema').click()
  await page.waitForTimeout(1500)
  check('NO nos manda al foro', page.url().includes('tema-1'), page.url())
  const cuerpo = await page.locator('body').innerText()
  check('y lo dice en pantalla', /no se ha podido borrar/i.test(cuerpo), cuerpo.slice(0, 160))
  check('el botón vuelve a su sitio', /borrar tema/i.test(await page.locator('#btnBorrarTema').innerText()))
  check('y se puede volver a intentar', !(await page.locator('#btnBorrarTema').isDisabled()))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// PARTE 2 — El anuncio del torneo cae en «Juego → Torneos»
// ═════════════════════════════════════════════════════════════════════

// Las secciones a propósito EN ESTE ORDEN: «Comunidad» va primera, así
// que su foro «Anuncios» es el que salía elegido antes de la tanda.
const MUNDO_TORNEO = {
  __FAKE_SESSION__: 'admin-1',
  __FAKE_TORNEOS__: [
    { id: 'torneo-1', slug: 'copa', name: 'Copa Inaugural', status: 'registration_open', admin_id: 'admin-1', swiss_rounds: 3 },
  ],
  __FAKE_SECCIONES__: [
    { id: 'seccion-1', name: 'Comunidad', position: 0 },
    { id: 'seccion-2', name: 'Juego', position: 1 },
  ],
  __FAKE_FOROS__: [
    // El subforo llega ANTES que su padre, como los devuelve la consulta
    // ordenada por `position` a secas.
    { id: 'foro-web', slug: 'web', name: 'Web', section_id: 'seccion-1', parent_id: 'foro-sug', position: 0 },
    { id: 'foro-anuncios', slug: 'anuncios', name: 'Anuncios', section_id: 'seccion-1', position: 1 },
    { id: 'foro-sug', slug: 'sugerencias', name: 'Sugerencias', section_id: 'seccion-1', position: 2 },
    { id: 'foro-torneos', slug: 'torneos', name: 'Torneos', section_id: 'seccion-2', position: 0 },
  ],
}

console.log('\n── 5. El desplegable llega con «Torneos» elegido ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', MUNDO_TORNEO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const select = page.locator('#anuncioForoDestino')
  check('hay desplegable de destino', (await select.count()) === 1)
  check('y viene con el foro de torneos puesto', (await select.inputValue()) === 'foro-torneos', await select.inputValue())

  const grupos = await page.locator('#anuncioForoDestino optgroup').evaluateAll((n) => n.map((g) => g.label))
  check('está agrupado por secciones', grupos.join('|') === 'Comunidad|Juego', grupos.join('|'))

  const opciones = await page.locator('#anuncioForoDestino option').evaluateAll((n) => n.map((o) => o.textContent.trim()))
  check('los subforos van marcados con guion', opciones.includes('— Web'), opciones.join(' / '))
  check('y detrás de su padre', opciones.indexOf('Sugerencias') < opciones.indexOf('— Web'), opciones.join(' / '))
  await page.close()
}

console.log('\n── 5b. Con dos foros que se llaman «Torneos», manda el de Juego ──')
{
  // El señuelo va en «Comunidad», que es la PRIMERA sección: quien mire
  // solo el nombre y no la sección se lleva este y no el bueno.
  const conSenuelo = {
    ...MUNDO_TORNEO,
    __FAKE_FOROS__: [
      { id: 'foro-senuelo', slug: 'torneos-viejos', name: 'Torneos (archivo)', section_id: 'seccion-1', position: 0 },
      { id: 'foro-torneos', slug: 'torneos', name: 'Torneos', section_id: 'seccion-2', position: 0 },
    ],
  }
  const { page } = await abrir('/torneo?slug=copa', conSenuelo)
  check('gana el de la sección Juego', (await page.locator('#anuncioForoDestino').inputValue()) === 'foro-torneos', await page.locator('#anuncioForoDestino').inputValue())
  await page.close()
}

console.log('\n── 6. Y el hilo se abre ahí de verdad ──')
{
  const { page } = await abrir('/torneo?slug=copa', MUNDO_TORNEO)
  await page.locator('#btnAnunciarForo').click()
  await page.waitForTimeout(1500)
  const hilos = await escrituras(page, 'forum_threads', 'insert')
  check('se abre un hilo', hilos.length === 1, JSON.stringify(hilos).slice(0, 120))
  check('en el foro de torneos', hilos[0]?.filas[0]?.board_id === 'foro-torneos', hilos[0]?.filas[0]?.board_id || '')
  check('con el título que lo reencuentra', hilos[0]?.filas[0]?.title === 'Torneo: Copa Inaugural', hilos[0]?.filas[0]?.title || '')
  await page.close()
}

console.log('\n── 7. Sin foro de torneos, el botón NO se queda sin destino ──')
{
  const sinTorneos = {
    ...MUNDO_TORNEO,
    __FAKE_SECCIONES__: [{ id: 'seccion-1', name: 'Comunidad', position: 0 }],
    __FAKE_FOROS__: [
      { id: 'foro-anuncios', slug: 'anuncios', name: 'Anuncios', section_id: 'seccion-1', position: 0 },
      { id: 'foro-sug', slug: 'sugerencias', name: 'Sugerencias', section_id: 'seccion-1', position: 1 },
    ],
  }
  const { page, errores } = await abrir('/torneo?slug=copa', sinTorneos)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('cae en el primero, como antes', (await page.locator('#anuncioForoDestino').inputValue()) === 'foro-anuncios')
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
