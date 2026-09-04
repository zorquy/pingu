import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 256: moderar desde la LISTA de temas.
//
// Van a entrar moderadores en el foro y hasta hoy todo lo de moderación
// vivía DENTRO de cada tema: para etiquetar diez hilos había que abrir
// diez hilos, y mover uno de foro no se podía hacer de ninguna manera.
//
// Lo que hay que vigilar aquí es de tres clases:
//   · que las herramientas salgan SOLO para el equipo;
//   · que hagan lo que dicen (mover es mover, no copiar ni tocar otro);
//   · y que cuando la base diga que no —que no da error, solo no toca
//     nada— la pantalla se entere y lo diga.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const SECCIONES = [
  { id: 's1', name: 'Comunidad', position: 0 },
  { id: 's2', name: 'Juego', position: 1 },
]
const FOROS = [
  { id: 'foro-1', section_id: 's1', slug: 'general', name: 'General', position: 0 },
  { id: 'foro-2', section_id: 's1', slug: 'presentaciones', name: 'Presentaciones', parent_id: 'foro-1', position: 1 },
  { id: 'foro-3', section_id: 's2', slug: 'torneos', name: 'Torneos', position: 0 },
  { id: 'foro-4', section_id: 's2', slug: 'intercambios', name: 'Intercambios', position: 1, is_hidden: true },
]
const TEMAS = [
  { id: 't1', board_id: 'foro-1', author_id: 'user-1', title: 'Mi primer mazo', prefix: null, post_count: 4 },
  { id: 't2', board_id: 'foro-1', author_id: 'user-2', title: 'Duda con Dragapult', prefix: 'Duda', post_count: 2 },
  { id: 't3', board_id: 'foro-1', author_id: 'user-3', title: 'Hola a todos', prefix: null, post_count: 1 },
]
const MUNDO = { __FAKE_SECCIONES__: SECCIONES, __FAKE_FOROS__: FOROS, __FAKE_TEMAS__: TEMAS }

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, errores }
}

// Lo que el doble apuntó que se escribió de verdad. Vive en
// sessionStorage porque estas acciones recargan la página.
const escrituras = (page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]'))

// La fila de un tema, por su título: los ids no se ven en la pantalla y
// una prueba que busca por posición se rompe al cambiar el orden.
const filaDe = (page, titulo) => page.locator('.foro-tema-fila', { hasText: titulo })

const abrirMenuDe = async (page, titulo) => {
  await filaDe(page, titulo).locator('[data-mod-menu]').click()
  await page.waitForTimeout(250)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las herramientas son SOLO del equipo ──')
{
  for (const [quien, sesion] of [
    ['sin cuenta', 'none'],
    ['con una cuenta normal', 'user-1'],
  ]) {
    const { page, errores } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: sesion })
    check(`${quien}: sin errores`, errores.length === 0, errores[0] || '')
    check(`${quien}: no hay casillas`, (await page.locator('[data-mod-sel]').count()) === 0)
    check(`${quien}: no hay menú de moderar`, (await page.locator('[data-mod-menu]').count()) === 0)
    // Ni la barra existe: se crea al enganchar la moderación, y a quien no
    // es del equipo no se le engancha nada. Sin esto, todo el mundo se
    // llevaría un cacho de DOM y dos escuchas de teclado y ratón para una
    // barra que no va a salirle nunca.
    check(`${quien}: ni se crea la barra`, (await page.locator('#foroModBarra').count()) === 0)
    // Y la lista se sigue viendo entera: quitar las herramientas no puede
    // quitar el foro.
    check(`${quien}: pero los temas están`, (await page.locator('.foro-tema-fila').count()) === 3)
    await page.close()
  }
}

console.log('\n── 2. Un moderador sí las tiene ──')
{
  const { page, errores } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('una casilla por tema', (await page.locator('[data-mod-sel]').count()) === 3)
  check('y un menú por tema', (await page.locator('[data-mod-menu]').count()) === 3)
  await abrirMenuDe(page, 'Mi primer mazo')
  const opciones = await page.locator('.foro-mod-menu button').allInnerTexts()
  for (const q of ['Editar título y etiqueta', 'Mover a otro foro', 'Editar el primer mensaje', 'Borrar tema']) {
    check(`el menú ofrece «${q}»`, opciones.some((o) => o.includes(q)), opciones.join(' | '))
  }
  await page.close()
}

console.log('\n── 3. La barra de lo seleccionado ──')
{
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  check('sin nada marcado, no hay barra', await page.locator('#foroModBarra').isHidden())
  await filaDe(page, 'Mi primer mazo').locator('[data-mod-sel]').check()
  await page.waitForTimeout(200)
  check('con uno marcado, sale', await page.locator('#foroModBarra').isVisible())
  check('y lo dice en singular', (await page.locator('.foro-mod-cuenta').innerText()) === '1 tema seleccionado')
  check('la fila marcada se ve marcada', await filaDe(page, 'Mi primer mazo').evaluate((f) => f.classList.contains('foro-tema-marcado')))
  await filaDe(page, 'Hola a todos').locator('[data-mod-sel]').check()
  await page.waitForTimeout(200)
  check('con dos, en plural', (await page.locator('.foro-mod-cuenta').innerText()) === '2 temas seleccionados')
  await page.locator('[data-lote="nada"]').click()
  await page.waitForTimeout(200)
  check('«quitar selección» la cierra', await page.locator('#foroModBarra').isHidden())
  check('y desmarca las casillas', (await page.locator('[data-mod-sel]:checked').count()) === 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Mover un tema de foro ──')
{
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  await abrirMenuDe(page, 'Duda con Dragapult')
  await page.locator('.foro-mod-menu [data-uno="mover"]').click()
  await page.waitForTimeout(500)
  const destinos = await page.locator('.foro-mod-form select[name=destino] option').allInnerTexts()
  check('los subforos van con su guion', destinos.includes('— Presentaciones'), destinos.join(' | '))
  check('y agrupados por sección', (await page.locator('.foro-mod-form optgroup').count()) === 2)
  await page.locator('.foro-mod-form select[name=destino]').selectOption('foro-3')
  await page.locator('.foro-mod-form button[type=submit]').click()
  await page.waitForTimeout(900)
  const w = await escrituras(page)
  const movida = w.find((e) => e.tabla === 'forum_threads' && e.tipo === 'update')
  check('se escribió el cambio', !!movida, JSON.stringify(w.map((x) => `${x.tabla}:${x.tipo}`)))
  check('el tema movido es ESE', movida?.filas?.length === 1 && movida.filas[0].id === 't2', JSON.stringify(movida?.filas))
  check('y va al foro elegido', movida?.filas?.[0]?.board_id === 'foro-3', String(movida?.filas?.[0]?.board_id))
  check('sin tocarle el título', movida?.filas?.[0]?.title === 'Duda con Dragapult')
  await page.close()
}

console.log('\n── 4b. Mover al foro donde ya está no hace nada ──')
{
  // El desplegable llega con el foro ACTUAL marcado, así que darle a
  // «Mover» sin tocar nada es el resbalón más fácil de todos.
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  await abrirMenuDe(page, 'Hola a todos')
  await page.locator('.foro-mod-menu [data-uno="mover"]').click()
  await page.waitForTimeout(500)
  check('viene marcado el foro de ahora', (await page.locator('.foro-mod-form select[name=destino]').inputValue()) === 'foro-1')
  await page.locator('.foro-mod-form button[type=submit]').click()
  await page.waitForTimeout(600)
  const w = (await escrituras(page)).filter((e) => e.tabla === 'forum_threads')
  check('no se escribe nada', w.length === 0, JSON.stringify(w.map((x) => x.tipo)))
  const aviso = await page.locator('.toast, #toast, [class*="toast"]').first().innerText().catch(() => '')
  check('y se dice por qué', /ya está en este foro/i.test(aviso), aviso)
  await page.close()
}

console.log('\n── 5. Mover VARIOS de una vez ──')
{
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  await filaDe(page, 'Mi primer mazo').locator('[data-mod-sel]').check()
  await filaDe(page, 'Hola a todos').locator('[data-mod-sel]').check()
  await page.waitForTimeout(200)
  await page.locator('[data-lote="mover"]').click()
  await page.waitForTimeout(500)
  check('el panel dice cuántos son', /Mover 2 temas a:/.test(await page.locator('#foroModPanel').innerText()))
  await page.locator('#foroModPanel select[name=destino]').selectOption('foro-2')
  await page.locator('#foroModPanel button[type=submit]').click()
  await page.waitForTimeout(900)
  const w = await escrituras(page)
  const movida = w.find((e) => e.tabla === 'forum_threads' && e.tipo === 'update')
  check('se mueven los DOS', movida?.filas?.length === 2, String(movida?.filas?.length))
  check('y los dos al mismo sitio', movida?.filas?.every((f) => f.board_id === 'foro-2'))
  check('el que no estaba marcado se queda', !movida?.filas?.some((f) => f.id === 't2'), JSON.stringify(movida?.filas?.map((f) => f.id)))
  await page.close()
}

console.log('\n── 6. La etiqueta, en lote ──')
{
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  await filaDe(page, 'Mi primer mazo').locator('[data-mod-sel]').check()
  await page.waitForTimeout(200)
  await page.locator('[data-lote="etiqueta"]').click()
  await page.waitForTimeout(300)
  await page.locator('#foroModPanel select[name=etiqueta]').selectOption('Mazo')
  await page.locator('#foroModPanel button[type=submit]').click()
  await page.waitForTimeout(900)
  const w = await escrituras(page)
  const puesta = w.find((e) => e.tabla === 'forum_threads' && e.tipo === 'update')
  check('se pone la etiqueta', puesta?.filas?.[0]?.prefix === 'Mazo', String(puesta?.filas?.[0]?.prefix))
  check('y solo al marcado', puesta?.filas?.length === 1)
  await page.close()
}

console.log('\n── 7. Fijar y cerrar, desde el menú de un tema ──')
{
  const { page } = await abrir('/foro?f=general', {
    ...MUNDO,
    __FAKE_SESSION__: 'mod-1',
    __FAKE_TEMAS__: [{ ...TEMAS[0], is_pinned: true, is_locked: false }],
  })
  await abrirMenuDe(page, 'Mi primer mazo')
  const opciones = await page.locator('.foro-mod-menu button').allInnerTexts()
  // El menú dice lo que va a HACER, no el estado: en un tema ya fijado
  // pone «quitar de arriba», no «fijar».
  check('un tema fijado ofrece quitarlo de arriba', opciones.some((o) => /Quitar de arriba/.test(o)), opciones.join(' | '))
  check('y uno abierto ofrece cerrarlo', opciones.some((o) => /^\s*Cerrar/.test(o)), opciones.join(' | '))
  await page.locator('.foro-mod-menu [data-uno="fijar"]').click()
  await page.waitForTimeout(900)
  const w = await escrituras(page)
  const cambio = w.find((e) => e.tabla === 'forum_threads' && e.tipo === 'update')
  check('quitar de arriba lo DESFIJA', cambio?.filas?.[0]?.is_pinned === false, String(cambio?.filas?.[0]?.is_pinned))
  await page.close()
}

console.log('\n── 8. Borrar pide confirmación ──')
{
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  await abrirMenuDe(page, 'Mi primer mazo')
  const boton = page.locator('.foro-mod-menu [data-uno="borrar"]')
  await boton.click()
  await page.waitForTimeout(300)
  const borradosYa = (w) => w.filter((e) => e.tabla === 'forum_threads' && e.tipo === 'delete')
  check('al primer clic no borra nada', borradosYa(await escrituras(page)).length === 0)
  check('y avisa de lo que se pierde', /Se pierden 3 respuestas/.test(await boton.innerText()), await boton.innerText())
  await boton.click()
  await page.waitForTimeout(900)
  const w = await escrituras(page)
  const borrado = w.find((e) => e.tabla === 'forum_threads' && e.tipo === 'delete')
  check('al segundo sí', !!borrado)
  check('y borra el que era', borrado?.filas?.[0]?.id === 't1', JSON.stringify(borrado?.filas?.map((f) => f.id)))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. Los foros escondidos son cosa de administración ──')
{
  const { page } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'mod-1' })
  await abrirMenuDe(page, 'Mi primer mazo')
  await page.locator('.foro-mod-menu [data-uno="mover"]').click()
  await page.waitForTimeout(500)
  const paraElMod = await page.locator('.foro-mod-form select[name=destino] option').allInnerTexts()
  check('un moderador no ve el foro escondido', !paraElMod.some((o) => /Intercambios/.test(o)), paraElMod.join(' | '))
  await page.close()

  const { page: admin } = await abrir('/foro?f=general', { ...MUNDO, __FAKE_SESSION__: 'admin-1' })
  await abrirMenuDe(admin, 'Mi primer mazo')
  await admin.locator('.foro-mod-menu [data-uno="mover"]').click()
  await admin.waitForTimeout(500)
  const paraElAdmin = await admin.locator('.foro-mod-form select[name=destino] option').allInnerTexts()
  check('administración sí', paraElAdmin.some((o) => /Intercambios/.test(o)), paraElAdmin.join(' | '))
  check('y va marcado como oculto', paraElAdmin.some((o) => /Intercambios \(oculto\)/.test(o)), paraElAdmin.join(' | '))
  await admin.close()
}

console.log('\n── 10. Cuando la base dice que no, se dice ──')
{
  // El caso de verdad: a alguien le quitan la moderación con la lista
  // abierta. El UPDATE no da error — simplemente no toca nada — así que
  // sin comprobarlo la pantalla diría «movido» y no habría movido nada.
  const { page } = await abrir('/foro?f=general', {
    ...MUNDO,
    __FAKE_SESSION__: 'mod-1',
    __RLS_SIN_TOCAR__: ['forum_threads'],
  })
  await abrirMenuDe(page, 'Mi primer mazo')
  await page.locator('.foro-mod-menu [data-uno="mover"]').click()
  await page.waitForTimeout(500)
  await page.locator('.foro-mod-form select[name=destino]').selectOption('foro-3')
  await page.locator('.foro-mod-form button[type=submit]').click()
  await page.waitForTimeout(700)
  const aviso = await page.locator('.toast, #toast, [class*="toast"]').first().innerText().catch(() => '')
  check('no dice que lo ha movido', !/movido/i.test(aviso), aviso)
  check('dice que la base no le deja', /no te deja/i.test(aviso), aviso)
  await page.close()
}

console.log('\n── 11. Y lo mismo al borrar ──')
{
  const { page } = await abrir('/foro?f=general', {
    ...MUNDO,
    __FAKE_SESSION__: 'mod-1',
    __RLS_SIN_BORRAR__: ['forum_threads'],
  })
  await abrirMenuDe(page, 'Hola a todos')
  const boton = page.locator('.foro-mod-menu [data-uno="borrar"]')
  await boton.click()
  await boton.click()
  await page.waitForTimeout(700)
  const aviso = await page.locator('.toast, #toast, [class*="toast"]').first().innerText().catch(() => '')
  check('no canta un borrado que no ha pasado', !/borrado/i.test(aviso), aviso)
  check('y lo explica', /no te deja/i.test(aviso), aviso)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 12. «Editar el primer mensaje» lleva al tema con el editor abierto ──')
{
  const { page, errores } = await abrir('/tema?t=t1&editar=primero', {
    ...MUNDO,
    __FAKE_SESSION__: 'mod-1',
    __FAKE_MENSAJES__: [
      { id: 'm1', thread_id: 't1', author_id: 'user-1', body_html: 'El mazo es este', created_at: '2026-09-01T10:00:00Z' },
      { id: 'm2', thread_id: 't1', author_id: 'user-2', body_html: 'Buena lista', created_at: '2026-09-01T11:00:00Z' },
    ],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('el editor está abierto', (await page.locator('[data-texto="m1"] .rte-surface').count()) === 1)
  check('y es el del PRIMER mensaje', (await page.locator('[data-texto="m2"] .rte-surface').count()) === 0)
  check('la URL se limpia sola', !page.url().includes('editar='), page.url())
  await page.close()
}

console.log('\n── 12b. Pero solo en la primera página ──')
{
  // El mensaje que abre el hilo solo está en la página 1. En la 2, «el
  // primero de la lista» es otro cualquiera, y abrirle el editor a quien
  // pidió el de arriba sería peor que no abrir nada.
  const { page } = await abrir('/tema?t=t1&p=2&editar=primero', {
    ...MUNDO,
    __FAKE_SESSION__: 'mod-1',
    __FAKE_MENSAJES__: Array.from({ length: 30 }, (_, i) => ({
      id: `m${i + 1}`,
      thread_id: 't1',
      author_id: 'user-1',
      body_html: `Mensaje ${i + 1}`,
      created_at: new Date(Date.UTC(2026, 8, 1, 10, i)).toISOString(),
    })),
  })
  check('no abre ningún editor de mensaje', (await page.locator('[data-texto] .rte-surface').count()) === 0)
  check('el cajón de responder sigue estando', (await page.locator('.rte-surface').count()) === 1)
  await page.close()
}

console.log('\n── 13. Sin el parámetro, el editor no se abre solo ──')
{
  const { page } = await abrir('/tema?t=t1', {
    ...MUNDO,
    __FAKE_SESSION__: 'mod-1',
    __FAKE_MENSAJES__: [{ id: 'm1', thread_id: 't1', author_id: 'user-1', body_html: 'El mazo es este' }],
  })
  check('el tema se lee, no se edita', (await page.locator('[data-texto] .rte-surface').count()) === 0)
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
