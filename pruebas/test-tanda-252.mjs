import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 252: LA APERTURA. La sección de torneos deja de ser solo para
// admins.
//
// Lo que se juega aquí es que el viernes se pueda jugar: con la RLS fina
// puesta, un jugador normal ya NO escribe directamente en las tablas del
// torneo — lo hacen tres RPC. Y un INSERT que la política rechaza NO da
// error: no toca nada y vuelve como si todo hubiera ido bien. Si el
// cliente no llama a la RPC, la persona pulsa el botón y no pasa nada.

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
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const rpcs = (page) => page.evaluate(() => (window.__RPCS__ || []).map((r) => r.nombre))
const rpcCon = (page) => page.evaluate(() => window.__RPCS__ || [])
const escrituras = (page, tabla, tipo) =>
  page.evaluate(
    ([t, k]) => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === t && e.tipo === k),
    [tabla, tipo]
  )

const TORNEO = {
  id: 'torneo-1', slug: 'copa', name: 'Copa Inaugural PokeDoc', status: 'registration_open',
  admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, description: 'Ven a jugar.',
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La sección ya no echa a nadie ──')
{
  const { page, errores } = await abrir('/torneos', { __FAKE_SESSION__: 'user-1', __FAKE_TORNEOS__: [TORNEO] })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('un miembro normal se queda en /torneos', page.url().includes('/torneos'), page.url())
  check('y ve el torneo', /Copa Inaugural/.test(await page.locator('#listaTorneos').innerText()))
  check('pero NO puede crear uno', await page.locator('#btnNuevoTorneo').isHidden())
  await page.close()
}
{
  // Con INSCRIPCIONES a propósito: lo que reventaba sin sesión era el
  // bucle que las recorre buscando la tuya, y sin ninguna fila el bucle
  // no se ejecuta y la prueba no prueba nada (lo pilló el rigor).
  const { page, errores } = await abrir('/torneos', {
    __FAKE_SESSION__: 'none',
    __FAKE_TORNEOS__: [TORNEO],
    __FAKE_INSCRIPCIONES__: [{ id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active' }],
  })
  // Antes de la 252 esto reventaba con `session.user.id` en cuanto
  // entraba alguien sin cuenta, y daba igual porque la página le echaba.
  check('sin cuenta tampoco revienta', errores.length === 0, errores[0] || '')
  check('y también ve la lista', /Copa Inaugural/.test(await page.locator('#listaTorneos').innerText()))
  await page.close()
}
{
  const { page } = await abrir('/torneos', { __FAKE_SESSION__: 'admin-1', __FAKE_TORNEOS__: [TORNEO] })
  check('el equipo sí puede crear', await page.locator('#btnNuevoTorneo').isVisible())
  await page.close()
}

console.log('\n── 2. El enlace «Jugar» sale para todos ──')
{
  const { page } = await abrir('/', { __FAKE_SESSION__: 'user-1' })
  const jugar = page.locator('.nav-jugar').first()
  check('un miembro normal ve «Jugar»', await jugar.isVisible())
  check('y lleva a los torneos', (await jugar.getAttribute('href')) === 'torneos.html')
  await page.close()
}

console.log('\n── 3. Apuntarse va por la RPC ──')
{
  const { page } = await abrir('/torneo?slug=copa', { __FAKE_SESSION__: 'user-1', __FAKE_TORNEOS__: [TORNEO] })
  await page.fill('#inscripcionTcgLive', 'AshKetchum')
  await page.click('#formInscripcion button[type="submit"]')
  await page.waitForTimeout(1200)
  const llamadas = await rpcCon(page)
  const inscribir = llamadas.find((r) => r.nombre === 'torneos_inscribirse')
  check('se llama a torneos_inscribirse', !!inscribir, JSON.stringify(await rpcs(page)))
  check('con el torneo y el usuario de TCG Live',
    inscribir?.args?.p_torneo === 'torneo-1' && inscribir?.args?.p_tcg_live === 'AshKetchum',
    JSON.stringify(inscribir?.args))
  // Y NO se escribe la fila a mano: la política lo rechazaría en
  // silencio y la persona se quedaría sin plaza creyendo que la tiene.
  check('y NO se inserta la fila a mano', (await escrituras(page, 'tournament_registrations', 'insert')).length === 0)
  await page.close()
}

console.log('\n── 4. Pero si la migración aún no está, se hace lo de siempre ──')
{
  // El rato entre que sale este código y se ejecuta el SQL: la RPC no
  // existe y hay que seguir funcionando.
  const { page } = await abrir('/torneo?slug=copa', {
    __FAKE_SESSION__: 'user-1', __FAKE_TORNEOS__: [TORNEO], __SIN_RPC__: ['torneos_inscribirse'],
  })
  await page.fill('#inscripcionTcgLive', 'AshKetchum')
  await page.click('#formInscripcion button[type="submit"]')
  await page.waitForTimeout(1200)
  const ins = await escrituras(page, 'tournament_registrations', 'insert')
  check('se cae al insert de siempre', ins.length === 1, JSON.stringify(ins).slice(0, 110))
  check('con su usuario de TCG Live', ins[0]?.filas[0]?.tcg_live_username === 'AshKetchum')
  await page.close()
}

console.log('\n── 5. Un error de la RPC NO se cae al camino viejo ──')
{
  // Esto es lo importante del puente: solo se cae cuando la función NO
  // EXISTE. Si la RPC dice «torneo lleno», insertar a mano se saltaría
  // justo la comprobación que la RPC existe para hacer.
  const { page } = await abrir('/torneo?slug=copa', {
    __FAKE_SESSION__: 'user-1', __FAKE_TORNEOS__: [TORNEO], __RPC_ERROR__: { torneos_inscribirse: 'Torneo lleno.' },
  })
  await page.fill('#inscripcionTcgLive', 'AshKetchum')
  await page.click('#formInscripcion button[type="submit"]')
  await page.waitForTimeout(1200)
  check('NO se inserta nada por detrás', (await escrituras(page, 'tournament_registrations', 'insert')).length === 0)
  check('y se dice lo que pasó', /Torneo lleno/.test(await page.locator('body').innerText()))
  await page.close()
}

console.log('\n── 6. Las DOS formas de reconocer «no existe esa función» ──')
{
  // El puente mira el CÓDIGO y el MENSAJE, y son dos cinturones a
  // propósito: PostgREST manda PGRST202, PostgreSQL manda 42883, y el
  // texto puede cambiar entre versiones. Probarlos juntos no vale — con
  // los dos puestos, romper uno lo tapa el otro (lo pilló el rigor).
  for (const [etiqueta, error] of [
    ['solo por el código', { code: 'PGRST202', message: 'algo que no dice nada' }],
    ['solo por el mensaje', { code: 'P0001', message: 'Could not find the function public.torneos_inscribirse' }],
    ['por el código de PostgreSQL', { code: '42883', message: 'vete a saber' }],
  ]) {
    const { page } = await abrir('/torneo?slug=copa', {
      __FAKE_SESSION__: 'user-1', __FAKE_TORNEOS__: [TORNEO], __RPC_ERROR__: { torneos_inscribirse: error },
    })
    await page.fill('#inscripcionTcgLive', 'AshKetchum')
    await page.click('#formInscripcion button[type="submit"]')
    await page.waitForTimeout(1100)
    const ins = await escrituras(page, 'tournament_registrations', 'insert')
    check(`se cae al camino viejo ${etiqueta}`, ins.length === 1, JSON.stringify(ins).slice(0, 90))
    await page.close()
  }
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
