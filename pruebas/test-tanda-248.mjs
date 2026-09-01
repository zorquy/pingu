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
const verGrupo = async (page, id) => {
  await page.locator(`[data-grupo="${id}"]`).click()
  await page.waitForTimeout(300)
}
const pestanas = (page) =>
  page.locator('[data-grupo]').evaluateAll((n) => n.map((b) => b.dataset.grupo))

// Los cuatro estados que importan, cada uno en su torneo.
const TORNEOS = [
  { id: 'torneo-1', slug: 'inaugural', name: 'Copa Inaugural', status: 'registration_closed', start_at: '2026-09-04T17:00:00Z', swiss_rounds: 3 },
  { id: 'torneo-2', slug: 'abierta', name: 'Copa Abierta', status: 'registration_open', start_at: '2026-09-10T17:00:00Z', swiss_rounds: 3 },
  { id: 'torneo-3', slug: 'viva', name: 'Copa Viva', status: 'in_progress', start_at: '2026-09-01T17:00:00Z', swiss_rounds: 3 },
  { id: 'torneo-4', slug: 'vieja', name: 'Copa Vieja', status: 'finished', start_at: '2026-08-01T17:00:00Z', swiss_rounds: 3 },
]

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La lista tiene su pestaña «Por empezar» ──')
{
  const { page, errores } = await abrir('/torneos', { __FAKE_TORNEOS__: TORNEOS })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const ids = await pestanas(page)
  check('hay pestaña «Por empezar»', ids.includes('porempezar'), ids.join('|'))
  check('y sigue habiendo «En juego»', ids.includes('enjuego'), ids.join('|'))
  check('va entre «Abiertas» y «En juego»',
    ids.indexOf('abiertas') < ids.indexOf('porempezar') && ids.indexOf('porempezar') < ids.indexOf('enjuego'),
    ids.join('|'))
  await page.close()
}

console.log('\n── 2. El torneo con inscripciones cerradas NO está «En juego» ──')
{
  const { page } = await abrir('/torneos', { __FAKE_TORNEOS__: TORNEOS })
  await verGrupo(page, 'enjuego')
  const enJuego = await page.locator('#listaTorneos').innerText()
  check('«En juego» NO trae la Copa Inaugural', !enJuego.includes('Copa Inaugural'), enJuego.slice(0, 120))
  check('pero sí la que se está jugando', enJuego.includes('Copa Viva'), enJuego.slice(0, 120))

  await verGrupo(page, 'porempezar')
  const porEmpezar = await page.locator('#listaTorneos').innerText()
  check('«Por empezar» trae la Copa Inaugural', porEmpezar.includes('Copa Inaugural'), porEmpezar.slice(0, 120))
  check('y NO la que se está jugando', !porEmpezar.includes('Copa Viva'), porEmpezar.slice(0, 120))
  check('ni la que sigue abierta', !porEmpezar.includes('Copa Abierta'), porEmpezar.slice(0, 120))
  await page.close()
}

console.log('\n── 3. La pestaña ya no contradice a la chapa ──')
{
  const { page } = await abrir('/torneos', { __FAKE_TORNEOS__: TORNEOS })
  await verGrupo(page, 'porempezar')
  const texto = await page.locator('#listaTorneos').innerText()
  check('la chapa sigue diciendo «Inscripciones cerradas»', /Inscripciones cerradas/.test(texto), texto.slice(0, 160))
  // Lo que se rompió: la chapa decía una cosa y la pestaña de encima la
  // contraria. Aquí la pestaña activa NO puede ser «En juego».
  const activa = await page.locator('[data-grupo].activa').innerText()
  check('y la pestaña activa no dice «En juego»', !/En juego/.test(activa), activa)
  await page.close()
}

console.log('\n── 4. Las pestañas vacías siguen sin aparecer ──')
{
  const { page } = await abrir('/torneos', {
    __FAKE_TORNEOS__: [TORNEOS[1]], // solo una con inscripciones abiertas
  })
  const ids = await pestanas(page)
  check('sin nada por empezar, no hay pestaña', !ids.includes('porempezar'), ids.join('|'))
  check('ni «En juego»', !ids.includes('enjuego'), ids.join('|'))
  check('pero sí «Abiertas»', ids.includes('abiertas'), ids.join('|'))
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
