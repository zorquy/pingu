import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { puedeBorrarTorneo } from '/home/user/pingu/js/torneos/comun.js'

// Tanda 222: borrar un torneo. Solo el admin del sitio o quien lo creó
// (la regla de verdad está en la política torneos_borrar de la base;
// aquí se prueba la parte que se ve y el camino de vuelta).

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
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.addInitScript((s) => {
    if (s.sesion) window.__FAKE_SESSION__ = s.sesion
    if (s.torneos) window.__FAKE_TORNEOS__ = s.torneos
    if (s.inscripciones) window.__FAKE_INSCRIPCIONES__ = s.inscripciones
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

const SEMILLA = {
  // DOS torneos y del MISMO estado a propósito: si el borrado filtrara
  // por cualquier otra cosa que no sea el id, se llevaría los dos por
  // delante y con uno solo sembrado nadie se enteraría.
  torneos: [
    { slug: 'borrame', name: 'Copa Para Borrar', status: 'registration_open', max_players: 16, swiss_rounds: 4 },
    { slug: 'dejame', name: 'Copa Que Se Queda', status: 'registration_open', max_players: 16, swiss_rounds: 4 },
  ],
  inscripciones: ['user-1', 'user-2'].map((u, i) => ({
    id: `i-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`,
  })),
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El botón está, y pide confirmación antes de nada ──')
{
  const { page, errores } = await abrir('/torneo?slug=borrame', SEMILLA)
  const btn = page.locator('#btnBorrarTorneo')
  check('el organizador ve «Borrar torneo»', await btn.count() === 1)
  check('la ficha no revienta', errores.length === 0, errores[0] || '')

  // Primer toque: NO borra, avisa. Y dice cuánta gente hay dentro, que
  // no es lo mismo borrar un torneo vacío que uno con inscritos.
  await btn.click()
  await page.waitForTimeout(300)
  const texto = (await btn.textContent()).trim()
  check('el primer toque solo avisa', /seguro/i.test(texto), texto)
  check('y dice cuántos inscritos se lleva', /2 inscritos/.test(texto), texto)
  check('sigue en la ficha (no ha borrado)', page.url().includes('/torneo'), page.url())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El segundo toque borra y te devuelve a la lista ──')
{
  const { page } = await abrir('/torneo?slug=borrame', SEMILLA)
  const btn = page.locator('#btnBorrarTorneo')
  await btn.click()
  await page.waitForTimeout(300)
  await btn.click()
  await page.waitForTimeout(1200)
  check('acaba en /torneos', /\/torneos/.test(page.url()), page.url())

  // Las escrituras del doble sobreviven a la navegación en
  // sessionStorage — que es justo lo que hace falta aquí: la ficha
  // borra y se va.
  //
  // Con gente dentro el borrado es DIFERIDO (tanda 223): no se borra la
  // fila, se cancela y se marca. Si se borrara en el acto, la lista de
  // inscritos se iría con ella y no habría a quién avisar.
  const escrito = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tournaments')
  )
  check('no borra la fila de golpe', !escrito.some((e) => e.tipo === 'delete'), JSON.stringify(escrito.map((e) => e.tipo)))
  const marca = escrito.find((e) => e.tipo === 'update')
  check('la deja cancelada', marca?.filas?.[0]?.status === 'cancelled', JSON.stringify(marca?.filas?.[0]?.status))
  check('y marcada para borrar tras avisar', Boolean(marca?.filas?.[0]?.delete_after_notice_at))
  check('con el aviso de cancelación sin dar', marca?.filas?.[0]?.cancel_notified_at === null)
  check('sobre UNA fila, no más', marca?.filas?.length === 1, `${marca?.filas?.length} filas`)
  check('y era el torneo que tocaba', marca?.filas?.[0]?.slug === 'borrame', JSON.stringify(marca?.filas?.map((f) => f.slug)))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2b. Un torneo VACÍO se borra en el acto ──')
{
  // Sin inscritos no hay a quién avisar: no hay nada que diferir.
  const { page } = await abrir('/torneo?slug=vacio', {
    torneos: [{ slug: 'vacio', name: 'Copa Vacia', status: 'draft', max_players: 8, swiss_rounds: 3 }],
  })
  const btn = page.locator('#btnBorrarTorneo')
  await btn.click()
  await page.waitForTimeout(300)
  const texto = (await btn.textContent()).trim()
  check('el aviso no habla de inscritos', /no hay vuelta atr/i.test(texto), texto)
  await btn.click()
  await page.waitForTimeout(1200)
  const escrito = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tournaments')
  )
  check('esta vez sí borra de verdad', escrito.some((e) => e.tipo === 'delete'), JSON.stringify(escrito.map((e) => e.tipo)))
  check('y no lo deja cancelado por ahí', !escrito.some((e) => e.tipo === 'update'), JSON.stringify(escrito.map((e) => e.tipo)))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La lista avisa de lo que acaba de pasar ──')
{
  // El aviso no cabe en la ficha: la página que lo diría ya no existe.
  // Lo deja en sessionStorage y lo recoge la lista.
  const page = await browser.newPage()
  await page.addInitScript(() => sessionStorage.setItem('torneo-borrado', 'Copa Para Borrar'))
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const aviso = await page.locator('.toast, [class*="toast"]').first().textContent().catch(() => '')
  check('sale el aviso con el nombre', /Copa Para Borrar/.test(aviso || ''), aviso || 'sin aviso')
  const quedaMarca = await page.evaluate(() => sessionStorage.getItem('torneo-borrado'))
  check('y la marca se gasta (no repite)', quedaMarca === null, String(quedaMarca))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Quien ni es admin ni lo creó, no ve el botón ──')
{
  // La comprobación se hace sobre la MISMA regla que usa la ficha. Hoy
  // la ficha ni siquiera deja entrar a quien no es admin (los torneos
  // están en pruebas), así que esto vigila la regla para el día en que
  // se abran: sin ser admin y sin ser el dueño, no hay botón.
  // Se prueba la función DE VERDAD, importada del módulo: una copia de
  // la regla escrita aquí probaría la copia, no el código que corre.
  check('el admin del sitio puede', puedeBorrarTorneo({ is_admin: true }, { admin_id: 'otro' }, 'user-9'))
  check('el que lo creó puede', puedeBorrarTorneo({ is_admin: false }, { admin_id: 'user-9' }, 'user-9'))
  check('un tercero NO puede', !puedeBorrarTorneo({ is_admin: false }, { admin_id: 'otro' }, 'user-9'))
  check('sin sesión, tampoco', !puedeBorrarTorneo({ is_admin: false }, { admin_id: 'otro' }, null))
  check('sin perfil cargado, tampoco', !puedeBorrarTorneo(null, { admin_id: 'otro' }, 'user-9'))
  check('un torneo sin dueño no es de nadie', !puedeBorrarTorneo({ is_admin: false }, { admin_id: null }, null))
  check('ni con el id a undefined', !puedeBorrarTorneo({ is_admin: false }, {}, undefined))
}

await browser.close()
console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
