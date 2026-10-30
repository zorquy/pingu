// Tanda 1119 — «Hoy», la entrada de /admin: lo que espera (con la más vieja
// y el aviso de que lleva más de un día), el número en el menú, las pasadas
// automáticas (lo que va mal, delante), la frase de la semana y los errores
// de 24 h. Y lo que se fue: la guía destacada (también de la portada), los
// lanzamientos a mano y las claves push, que pasan a «Base de datos».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ahora = Date.now()
const hace = (h) => new Date(ahora - h * 3600000).toISOString()
const FILAS = {
  tienda_solicitudes: [
    { id: 't1', estado: 'pendiente', nombre: 'Cartas Norte', email: 'a@b.es', created_at: hace(50) },
    { id: 't2', estado: 'pendiente', nombre: 'Otra', email: 'c@d.es', created_at: hace(5) },
    { id: 't3', estado: 'aceptada', nombre: 'Vieja', email: 'e@f.es', created_at: hace(500) },
  ],
  content_reports: [{ id: 'r1', status: 'pending', reporter_id: 'user-2', target_type: 'forum_post', target_id: 'x', reason: 'spam', created_at: hace(3) }],
  client_errors: [
    { id: 'e1', status: 'new', message: 'Boom', page_url: 'https://pokedoc.es/cartas?ver=buscar', created_at: hace(2) },
    { id: 'e2', status: 'new', message: 'Viejo', page_url: 'https://pokedoc.es/foro', created_at: hace(80) },
  ],
  scrydex_estado: [
    { clave: 'tcggo_precios', valor: { hecho: true }, updated_at: hace(0.2) },
    { clave: 'tcggo_catalogo', valor: { parado: 'sin clave' }, updated_at: hace(1) },
  ],
}
const RESUMEN = { medido_desde: '2026-10-01', personas: 1240, personas_antes: 1100, personas_app: 310, activos: 400, activos_antes: 380, acciones: {} }

const browser = await chromium.launch()
const errores = []
async function abrir(ruta, { viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ F, R }) => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_FILAS__ = F; window.__FAKE_RESUMEN__ = R }, { F: FILAS, R: RESUMEN })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  // Las vistas previas de Correos (iframes con `sandbox`): de antes, no de esta tanda.
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return page
}

const page = await abrir('/admin/')
await page.waitForSelector('.hoy-tar', { timeout: 15000 }).catch(() => {})
await page.waitForFunction(() => !/Contando/.test(document.getElementById('hoyErrores')?.textContent || 'Contando'), null, { timeout: 8000 }).catch(() => {})
await page.waitForTimeout(400)

console.log('── La cabecera y el menú ──')
check('«Hoy» saluda a quien entra y dice el día', /^Hola, /.test(await page.textContent('#hoySaludo')) && /\d/.test(await page.textContent('#hoyFecha')), await page.textContent('#hoySaludo'))
const grupos = await page.$$eval('.admin-nav-grupo', (els) => els.map((e) => e.textContent.trim()))
check('el menú va en cuatro grupos', grupos.join('|') === 'Contenido|Comunidad|Catálogo|Sistema', grupos.join('|'))
check('  …y empieza por «Hoy» (no «Dashboard»)', /Hoy/.test(await page.textContent('.admin-nav-item[data-section="dashboard"]')) && !/Dashboard/.test(await page.textContent('.admin-nav')))
const contador = (s) => page.$eval(`.admin-nav-item[data-section="${s}"]`, (b) => b.querySelector('.admin-nav-contador')?.textContent || '')
check('el número de lo que espera, en el menú (Tiendas 2, Reportes 1, Errores 2)', (await contador('tiendas')) === '2' && (await contador('reports')) === '1' && (await contador('errors')) === '2', `${await contador('tiendas')} ${await contador('reports')} ${await contador('errors')}`)
check('  …y nada donde no hay nada (Bajas)', (await contador('account-deletions')) === '')

console.log('── Lo que espera ──')
const tars = await page.$$eval('.hoy-tar', (els) => els.map((e) => ({ ir: e.dataset.ir, txt: e.innerText.replace(/\s+/g, ' '), urge: e.classList.contains('urge'), cero: e.classList.contains('cero') })))
const t = (s) => tars.find((x) => x.ir === s) || {}
check('una tarjeta por cosa que espera (seis)', tars.length === 6, JSON.stringify(tars.map((x) => x.ir)))
check('  …las que tienen algo, delante', tars.slice(0, 2).map((x) => x.ir).sort().join() === 'reports,tiendas', tars.map((x) => x.ir).join())
check('  …«2 tiendas que quieren entrar», la más vieja hace 2 días, y urge', /^2 tiendas que quieren entrar la más vieja, hace 2 días/.test(t('tiendas').txt) && t('tiendas').urge, t('tiendas').txt)
check('  …un reporte de hace 3 h no urge todavía', /^1 reporte hace 3 h/.test(t('reports').txt) && !t('reports').urge, t('reports').txt)
check('  …y lo que está a cero, apagado', t('account-deletions').cero && /^0 bajas pendientes/.test(t('account-deletions').txt), t('account-deletions').txt)
await page.click('.hoy-tar[data-ir="tiendas"]')
await page.waitForTimeout(300)
check('tocar una tarjeta lleva a su sección', await page.isVisible('#section-tiendas') && (await page.getAttribute('.admin-nav-item[data-section="tiendas"]', 'class')).includes('active'))
await page.click('.admin-nav-item[data-section="dashboard"]')

console.log('── Las pasadas, la semana y los errores ──')
const sem = await page.textContent('#hoySemaforo')
check('el semáforo cuenta lo que va bien y enseña lo que no', /1 al día · 1 para mirar/.test(sem) && (await page.$$eval('#hoySemaforo > .semaforo .semaforo-pasada', (els) => els.map((e) => e.dataset.luz + ':' + e.querySelector('strong').textContent))).join() === 'rojo:Catálogo', sem.slice(0, 200))
check('  …y las demás, plegadas en «Ver las N»', /Ver las \d+/.test(sem) && !(await page.isVisible('.hoy-sem-todas .semaforo')))
const semana = await page.textContent('#hoySemana')
check('la frase de la semana (la del lunes)', /Esta semana han entrado 1\.240 personas/.test(semana) && (await page.$('#hoySemana .an-frase-sube')) !== null, semana)
const errs = await page.textContent('#hoyErrores')
check('errores en 24 h: uno, el último en /cartas, y dos sin mirar', /1 nuevo · el último en \/cartas · 2 sin mirar en total\./.test(errs), errs)

console.log('── Lo que se fue ──')
check('ni guía destacada ni lanzamientos en /admin', !(await page.$('#destacadaPanel')) && !(await page.$('#lanzamientosPanel')))
check('las claves push están en «Base de datos», no en «Hoy»', (await page.$('#section-database #pushClavesPanel')) !== null && !(await page.$('#section-dashboard #pushClavesPanel')))
// El aviso global se fue a su sección en la 1120; desde «Hoy», un botón.
check('el aviso, en su sección con el botón desde «Hoy» (1120)', (await page.$('#section-avisos')) !== null && (await page.$('#section-dashboard [data-ir="avisos"]')) !== null)
check('sin errores en la página', !errores.length, errores.join(' | '))

console.log('── En el móvil ──')
const movil = await abrir('/admin/', { viewport: { width: 390, height: 844 } })
await movil.waitForSelector('.hoy-tar', { timeout: 15000 }).catch(() => {})
await movil.waitForTimeout(500)
const ancho = await movil.evaluate(() => document.documentElement.scrollWidth)
check('cabe sin desbordar de lado', ancho <= 392, ancho)
await movil.screenshot({ path: '/tmp/1119-movil.png', fullPage: true })
await page.screenshot({ path: '/tmp/1119-pc.png', fullPage: false })

console.log('── La portada, sin la destacada ──')
// «Aprende» entero lo prueba la 844; aquí, que la portada ya no la pide.
const { readFileSync } = await import('node:fs')
const SITIO = process.env.PD_SITIO || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum'
const bloques = readFileSync(`${SITIO}/js/portada-bloques.js`, 'utf8')
check('la portada ya no pide la destacada (ni home_config ni su sello)', !/home_config|pb-sello|destacada:/.test(bloques))

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
