import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// El foro, parte 2: la vista de un tema — mensajes, responder, citar,
// reacciones y el candado. Es la pantalla más usada del sitio.

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
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
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

const MUNDO = {
  __FAKE_SECCIONES__: [{ name: 'General' }],
  __FAKE_FOROS__: [{ id: 'foro-1', slug: 'dudas', name: 'Dudas de reglas', section_id: 'seccion-1' }],
  __FAKE_TEMAS__: [
    { id: 'tema-1', board_id: 'foro-1', title: '¿Esta Pikachu es legal?', author_id: 'user-1', post_count: 3 },
  ],
  __FAKE_MENSAJES__: [
    { id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Tengo una Pikachu sin marca</p>' },
    { id: 'msg-2', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Enséñala por detrás</p>' },
    { id: 'msg-3', thread_id: 'tema-1', author_id: 'user-3', body_html: '<p>Es de una promo vieja</p>' },
  ],
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El tema se pinta con sus mensajes ──')
{
  const { page, errores } = await abrir('/tema?t=tema-1', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = await page.locator('body').innerText()
  check('sale el título', /Pikachu es legal/.test(texto))
  for (const trozo of ['sin marca', 'por detrás', 'promo vieja']) {
    check(`sale el mensaje «${trozo}»`, texto.includes(trozo))
  }
  check('y en orden de escritura', texto.indexOf('sin marca') < texto.indexOf('promo vieja'))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La visita se cuenta ──')
{
  // El contador va por RPC y a propósito DESPUÉS de pintar: que se vea
  // el tema no puede depender de que el contador funcione.
  const { page } = await abrir('/tema?t=tema-1', MUNDO)
  const rpcs = await page.evaluate(() => window.__RPCS__ || [])
  check('se llama a forum_ver_tema', rpcs.some((r) => r.nombre === 'forum_ver_tema'), JSON.stringify(rpcs.map((r) => r.nombre)))
  check('con el tema que toca', rpcs.find((r) => r.nombre === 'forum_ver_tema')?.args?.p_thread === 'tema-1')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Responder guarda el mensaje ──')
{
  const { page } = await abrir('/tema?t=tema-1', MUNDO)
  const caja = page.locator('[contenteditable="true"]').first()
  check('hay caja de respuesta', (await caja.count()) === 1)
  await caja.click()
  await caja.type('Pues yo la veo legal')
  const boton = page.locator('button:has-text("Responder"), button:has-text("Publicar")').last()
  await boton.click()
  await page.waitForTimeout(1200)

  const puestos = await escrituras(page, 'forum_posts', 'insert')
  check('se guarda un mensaje', puestos.length === 1, JSON.stringify(puestos.length))
  check('con lo que se escribió', /la veo legal/.test(JSON.stringify(puestos[0]?.filas || [])), JSON.stringify(puestos[0]?.filas?.[0]?.body_html))
  check('y en el tema que toca', puestos[0]?.filas?.[0]?.thread_id === 'tema-1')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Un tema cerrado no deja responder ──')
{
  const CERRADO = {
    ...MUNDO,
    __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Tema zanjado', author_id: 'user-1', is_locked: true }],
  }
  // Como miembro normal: cerrado es cerrado.
  const { page, errores } = await abrir('/tema?t=tema-1', { ...CERRADO, __FAKE_SESSION__: 'user-1' })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = await page.locator('body').innerText()
  check('dice que está cerrado', /cerrad|cerrar|candado|bloquead/i.test(texto), texto.slice(0, 200))
  const cajas = await page.locator('[contenteditable="true"]').count()
  check('a un miembro no le deja escribir', cajas === 0, `${cajas} cajas`)
  await page.close()

  // Pero el equipo SÍ puede: cerrar un tema no puede dejar al moderador
  // sin poder decir la última palabra ni corregir nada.
  const { page: staff } = await abrir('/tema?t=tema-1', CERRADO)
  check('al equipo sí le deja', (await staff.locator('[contenteditable="true"]').count()) >= 1)
  await staff.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Las reacciones se guardan y se quitan ──')
{
  const { page } = await abrir('/tema?t=tema-1', MUNDO)
  const boton = page.locator('button[data-reaccion]').first()
  const hay = (await boton.count()) > 0
  check('hay botones de reacción', hay)
  if (hay) {
    await boton.click()
    await page.waitForTimeout(900)
    // Va por UPSERT, no por insert: la clave (post_id, user_id) impone
    // una reacción por persona y mensaje, así que cambiar de 👍 a ❤️
    // pisa la anterior en vez de sumar otra.
    const puestas = await escrituras(page, 'forum_post_reactions', 'upsert')
    check('reaccionar guarda la reacción', puestas.length >= 1, JSON.stringify(puestas.length))
    check('con el tipo que se pulsó', Boolean(puestas[0]?.filas?.[0]?.kind), JSON.stringify(puestas[0]?.filas?.[0]))

    // Segunda pulsada: la quita. Si no, no habría manera de retirarla.
    await boton.click()
    await page.waitForTimeout(900)
    const quitadas = await escrituras(page, 'forum_post_reactions', 'delete')
    check('volver a pulsar la retira', quitadas.length >= 1, JSON.stringify(quitadas.length))
  }
  await page.close()

  // Y en tus propios mensajes no hay botón: reaccionarse a uno mismo no
  // tiene sentido, y ahí se pintan quietas.
  const mio = await abrir('/tema?t=tema-1', {
    ...MUNDO,
    __FAKE_MENSAJES__: [{ id: 'msg-1', thread_id: 'tema-1', author_id: 'admin-1', body_html: '<p>Lo digo yo</p>' }],
    // Con una reacción YA puesta: sin cuenta no se pinta nada de
    // ninguna forma, y la prueba pasaría sin mirar lo que dice mirar.
    __FAKE_REACCIONES__: [{ id: 'r-1', post_id: 'msg-1', user_id: 'user-2', kind: 'like' }],
  })
  const texto = await mio.page.locator('body').innerText()
  check('la reacción de otro sí se ve', /Lo digo yo/.test(texto))
  check('en lo tuyo no hay botón de reacción', (await mio.page.locator('button[data-reaccion]').count()) === 0)
  check('se pinta quieta', (await mio.page.locator('.foro-reaccion-quieta').count()) >= 1)
  await mio.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Un tema que no existe no revienta ──')
{
  const { page, errores } = await abrir('/tema?t=no-existe', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = await page.locator('body').innerText()
  check('lo dice claramente', /no existe|no está|no encontrad/i.test(texto), texto.slice(0, 160))
  await page.close()
}

await browser.close()
console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
