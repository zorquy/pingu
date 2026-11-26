import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 248: «En juego» quiere decir que se está jugando.
//
// PINGU, con la Copa Inaugural ya creada: «pone en juego y no debería
// ponerse en juego hasta que llegue la hora del torneo». Y tenía razón:
// la pestaña «En juego» de /torneos y el grupo «Jugando ahora» del
// perfil metían dentro los torneos con las INSCRIPCIONES CERRADAS, que
// no han empezado. La chapa de la propia tarjeta decía «Inscripciones
// cerradas» mientras la pestaña de encima decía «En juego»: la misma
// pantalla contradiciéndose.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = process.env.PD_BASE || 'http://localhost:8892'
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
// Desde la 1454 no hay pestañas de estado: la agenda va por días y cada fila
// lleva su chapa. Lo que esta prueba vigila sigue igual: un torneo con las
// inscripciones cerradas NO se dice «en juego» en ningún sitio.
const fila = (page, slug) => page.locator(`.torneo-fila[data-torneo-id="${slug}"]`)
// Los cuatro estados que importan, cada uno en su torneo.
const TORNEOS = [
  { id: 'torneo-1', slug: 'inaugural', name: 'Copa Inaugural', status: 'registration_closed', start_at: '2026-09-04T17:00:00Z', swiss_rounds: 3 },
  { id: 'torneo-2', slug: 'abierta', name: 'Copa Abierta', status: 'registration_open', start_at: '2026-09-10T17:00:00Z', swiss_rounds: 3 },
  { id: 'torneo-3', slug: 'viva', name: 'Copa Viva', status: 'in_progress', start_at: '2026-09-01T17:00:00Z', swiss_rounds: 3 },
  { id: 'torneo-4', slug: 'vieja', name: 'Copa Vieja', status: 'finished', start_at: '2026-08-01T17:00:00Z', swiss_rounds: 3 },
]

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1–4. En la agenda, cerrado no es «en juego» (1454) ──')
{
  const { page, errores } = await abrir('/torneos', { __FAKE_TORNEOS__: TORNEOS })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('ni una pestaña de estado', (await page.locator('[data-grupo]').count()) === 0)
  const cerrada = await fila(page, 'torneo-1').innerText()
  check('la Copa Inaugural dice «Inscripciones cerradas»', /Inscripciones cerradas/.test(cerrada), cerrada.slice(0, 160))
  check('y no «En juego» ni «ahora»', !/En juego|ahora/i.test(cerrada), cerrada.slice(0, 160))
  check('su fila no va marcada como viva', !(await fila(page, 'torneo-1').evaluate((f) => f.classList.contains('torneo-fila-viva'))))
  const viva = await fila(page, 'torneo-3').innerText()
  check('la que se juega sí dice «En juego»', /En juego/.test(viva) && (await fila(page, 'torneo-3').evaluate((f) => f.classList.contains('torneo-fila-viva'))), viva.slice(0, 160))
  const orden = await page.locator('#torneosAgenda .torneo-fila').evaluateAll((fs) => fs.map((f) => f.dataset.torneoId))
  check('la que se juega va delante; la terminada, abajo en «Últimos resultados»', orden[0] === 'torneo-3' && orden[orden.length - 1] === 'torneo-4', orden.join('|'))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. En el perfil, «Jugando ahora» es solo lo que se juega ──')
{
  const { page, errores } = await abrir('/perfil', {
    __FAKE_TORNEOS__: TORNEOS,
    __FAKE_INSCRIPCIONES__: [
      { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'admin-1', status: 'active' },
      { id: 'ins-3', tournament_id: 'torneo-3', user_id: 'admin-1', status: 'active' },
    ],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  await page.locator('#profileTabs .tab-btn').filter({ hasText: /torneo/i }).first().click()
  await page.waitForTimeout(1400)
  // OJO con innerText: devuelve el texto TAL COMO SE PINTA, y los
  // títulos de grupo llevan text-transform: uppercase. Buscar «Jugando
  // ahora» tal cual no encuentra nada aunque esté delante.
  const caja = (await page.locator('#misTorneos').innerText()).toLowerCase()
  const donde = (t) => caja.indexOf(t.toLowerCase())

  const iJugando = donde('Jugando ahora')
  const iApuntado = donde('Apuntado')
  check('salen los dos grupos', iJugando >= 0 && iApuntado >= 0, caja.slice(0, 200))
  // El orden de los grupos es fijo: «Jugando ahora» y después «Apuntado».
  // La Copa Viva tiene que caer en el primero y la Inaugural en el segundo.
  check('la Copa Viva está en «Jugando ahora»',
    donde('Copa Viva') > iJugando && donde('Copa Viva') < iApuntado, caja.slice(0, 220))
  check('y la Copa Inaugural en «Apuntado», no jugándose',
    donde('Copa Inaugural') > iApuntado, caja.slice(0, 220))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
