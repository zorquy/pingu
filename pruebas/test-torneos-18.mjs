import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 223, la parte de pantalla: borrar desde la lista y «ver N más»
// en los terminados.

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
  await page.waitForTimeout(2200)
  return { page, errores }
}
const verGrupo = async (page, id) => {
  await page.locator(`[data-grupo="${id}"]`).click()
  await page.waitForTimeout(300)
}

// Catorce torneos terminados: cuatro por encima del corte de diez.
const MUCHOS_TERMINADOS = Array.from({ length: 14 }, (_, i) => ({
  slug: `viejo-${i + 1}`,
  name: `Copa Vieja ${i + 1}`,
  status: 'finished',
  max_players: 8,
  swiss_rounds: 3,
  start_at: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
}))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. «Ver más» en los terminados ──')
{
  const { page, errores } = await abrir('/torneos', { torneos: MUCHOS_TERMINADOS })
  check('la lista no revienta', errores.length === 0, errores[0] || '')
  await verGrupo(page, 'terminados')
  const antes = await page.locator('.torneo-tarjeta').count()
  check('de entrada se enseñan diez', antes === 10, `${antes}`)

  const boton = page.locator('#btnVerMasTerminados')
  check('hay botón de ver más', await boton.count() === 1)
  check('y dice cuántos faltan', /4 m/i.test((await boton.textContent()) || ''), (await boton.textContent()) || '')

  await boton.click()
  await page.waitForTimeout(1200)
  const despues = await page.locator('.torneo-tarjeta').count()
  check('al pulsarlo salen todos', despues === 14, `${despues}`)
  check('y el botón ya no está', (await page.locator('#btnVerMasTerminados').count()) === 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Con diez o menos, no hay botón ──')
{
  const { page } = await abrir('/torneos', { torneos: MUCHOS_TERMINADOS.slice(0, 9) })
  await verGrupo(page, 'terminados')
  check('nueve terminados no piden «ver más»', (await page.locator('#btnVerMasTerminados').count()) === 0)
  check('y se ven los nueve', (await page.locator('.torneo-tarjeta').count()) === 9)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Borrar desde la tarjeta de la lista ──')
{
  const { page } = await abrir('/torneos', {
    torneos: [
      { slug: 'fuera', name: 'Copa Fuera', status: 'draft', max_players: 8, swiss_rounds: 3 },
      { slug: 'queda', name: 'Copa Queda', status: 'draft', max_players: 8, swiss_rounds: 3 },
    ],
  })
  await verGrupo(page, 'borradores')
  const botones = page.locator('[data-borrar]')
  check('cada tarjeta lleva su botón de borrar', (await botones.count()) === 2, `${await botones.count()}`)

  const suyo = page.locator('[data-nombre="Copa Fuera"]')
  await suyo.click()
  await page.waitForTimeout(300)
  check('el primer toque solo avisa', /seguro/i.test((await suyo.textContent()) || ''), (await suyo.textContent()) || '')
  const siguen = await page.locator('.torneo-tarjeta').count()
  check('y no ha borrado nada todavía', siguen === 2, `${siguen}`)

  await suyo.click()
  await page.waitForTimeout(1200)
  const escrito = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tournaments')
  )
  check('el segundo toque borra', escrito.some((e) => e.tipo === 'delete'), JSON.stringify(escrito.map((e) => e.tipo)))
  const borrado = escrito.find((e) => e.tipo === 'delete')
  check('y borra el que era', borrado?.filas?.length === 1 && borrado.filas[0].slug === 'fuera', JSON.stringify(borrado?.filas?.map((f) => f.slug)))
  check('sin llevarse al de al lado', (await page.locator('.torneo-tarjeta').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Con gente dentro, desde la lista también se difiere ──')
{
  const { page } = await abrir('/torneos', {
    torneos: [{ slug: 'llena', name: 'Copa Llena', status: 'registration_open', max_players: 8, swiss_rounds: 3 }],
    inscripciones: ['user-1', 'user-2'].map((u, i) => ({
      id: `i-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`,
    })),
  })
  await verGrupo(page, 'abiertas')
  const boton = page.locator('[data-borrar]').first()
  await boton.click()
  await page.waitForTimeout(300)
  check('avisa de a cuánta gente afecta', /2 inscritos/.test((await boton.textContent()) || ''), (await boton.textContent()) || '')
  await boton.click()
  await page.waitForTimeout(1200)
  const escrito = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tournaments')
  )
  check('no lo borra de golpe', !escrito.some((e) => e.tipo === 'delete'), JSON.stringify(escrito.map((e) => e.tipo)))
  const marca = escrito.find((e) => e.tipo === 'update')
  check('lo deja cancelado y marcado', marca?.filas?.[0]?.status === 'cancelled' && Boolean(marca.filas[0].delete_after_notice_at))

  const aviso = await page.locator('.toast, [class*="toast"]').first().textContent().catch(() => '')
  check('y el aviso lo explica', /avisa a 2/i.test(aviso || ''), aviso || 'sin aviso')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4b. Un torneo YA cancelado y avisado vuelve a avisar ──')
{
  // El caso en el que se ve si la marca se reabre de verdad: este
  // torneo se canceló hace días y sus inscritos ya lo saben. Si ahora
  // además se BORRA y no se reabre el aviso, el barredor lo salta por
  // avisado y desaparece sin que nadie se entere.
  const { page } = await abrir('/torneos', {
    torneos: [{
      slug: 'vieja', name: 'Copa Vieja', status: 'cancelled', max_players: 8, swiss_rounds: 3,
      cancel_notified_at: '2026-08-01T10:00:00Z',
    }],
    inscripciones: [{ id: 'i-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'TCG' }],
  })
  await verGrupo(page, 'terminados')
  const boton = page.locator('[data-borrar]').first()
  await boton.click()
  await page.waitForTimeout(300)
  await boton.click()
  await page.waitForTimeout(1200)
  const fila = await page.evaluate(() => window.__TABLAS__.tournaments.find((t) => t.slug === 'vieja'))
  check('sigue ahí hasta que el barredor pase', Boolean(fila), JSON.stringify(fila?.slug))
  check('marcada para borrar', Boolean(fila?.delete_after_notice_at))
  check('y con el aviso REABIERTO', fila?.cancel_notified_at === null, JSON.stringify(fila?.cancel_notified_at))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Quien no puede borrar, no ve el botón ──')
{
  // La lista es solo-admins hoy, así que el caso que se puede montar es
  // el del admin: lo ve en todas. La regla en sí (dueño / tercero) la
  // prueba test-torneos-16 sobre la función.
  const { page } = await abrir('/torneos', {
    torneos: [{ slug: 'x', name: 'Copa X', status: 'draft', max_players: 8, swiss_rounds: 3 }],
  })
  await verGrupo(page, 'borradores')
  check('el admin ve el botón', (await page.locator('[data-borrar]').count()) === 1)
  await page.close()
}

await browser.close()
console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
