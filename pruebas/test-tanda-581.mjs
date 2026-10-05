// Tanda 581 — la bienvenida en tres pasos y el estado vacío del Panel.
//
// Lo que más vigila: que la bienvenida ACABE en algo que hacer (no en la
// portada), que lo elegido se guarde, y que quien llega a /mi-coleccion
// sin cartas vea una acción y no una frase gris.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const browser = await chromium.launch()

console.log('── 1. La bienvenida ──')
{
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_PERFIL__ = { onboarding_completed: false, display_name: null, username: null }
  })
  await page.goto(`${BASE}/onboarding.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  check('se ve la bienvenida', await page.locator('#onbStep1').isVisible())
  check('hay TRES pasos arriba', (await page.locator('.onb-paso').count()) === 3)
  check('  …y no hay nivel ni categorías', (await page.locator('#onbLevelOptions, #onbInterestsGrid').count()) === 0)
  await page.click('#btnStep1Next')
  await page.waitForTimeout(300)
  check('paso 2: el nombre', await page.locator('#onbStep2').isVisible())
  await page.fill('#onbNameInput', 'Pingu')
  await page.click('#btnStep2Next')
  await page.waitForTimeout(300)
  check('paso 3: qué te trae, con tres opciones', await page.locator('#onbStep3').isVisible() && (await page.locator('#onbQue .onb-option-card').count()) === 3)
  check('  …con sus iconos pintados', (await page.locator('#onbQue .onb-option-icono svg').count()) === 3)
  check('  …y no se puede seguir sin elegir', await page.locator('#btnStep3Next').isDisabled())
  await page.click('#onbQue [data-value="jugar"]')
  check('elegir marca la tarjeta', (await page.locator('#onbQue [data-value="jugar"]').getAttribute('aria-pressed')) === 'true')
  await page.click('#btnStep3Next')
  await page.waitForTimeout(300)
  check('paso 4: el primer paso', await page.locator('#onbStep4').isVisible())
  const primera = page.locator('#onbAcciones .onb-accion').first()
  check('  …con lo elegido (jugar) PRIMERO y recomendado', (await primera.getAttribute('data-para')) === 'jugar' && (await primera.evaluate((e) => e.classList.contains('recomendada'))), await primera.getAttribute('data-para'))
  check('  …y las otras dos siguen ahí', (await page.locator('#onbAcciones .onb-accion').count()) === 3)
  check('  …más la puerta de importar un CSV', /Impórtala/.test(await page.locator('.onb-importar').innerText()))
  if (CAPS) await page.screenshot({ path: `${CAPS}/movil-onboarding.png` })
  await primera.click()
  await page.waitForTimeout(1500)
  check('al elegir se va ALLÍ, no a la portada', /\/reto/.test(page.url()), page.url())
  // Lo guardado: vuelve a abrir la bienvenida y mira el doble.
  await page.goto(`${BASE}/onboarding.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('── 2. Lo que se guarda ──')
{
  // Mismo viaje, pero mirando la base antes de irse.
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_PERFIL__ = { onboarding_completed: false }
  })
  await page.goto(`${BASE}/onboarding.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await page.click('#btnStep1Next')
  await page.fill('#onbNameInput', 'Pingu')
  await page.click('#btnStep2Next')
  await page.click('#onbQue [data-value="coleccionar"]')
  await page.click('#onbQue [data-value="aprender"]')
  await page.click('#btnStep3Next')
  await page.waitForTimeout(300)
  // Se frena la salida para poder leer el doble: `location` no se puede
  // redefinir en Chromium, así que al botón se le cambia el destino por
  // uno que no navega. Adónde iba de verdad se lee del atributo.
  const destino = await page.getAttribute('.onb-luego', 'data-ir')
  await page.evaluate(() => { document.querySelector('.onb-luego').dataset.ir = 'javascript:void 0' })
  await page.click('.onb-luego')
  await page.waitForTimeout(1200)
  // El doble apunta un upsert como una fila más: la ÚLTIMA es la que vale.
  const perfil = await page.evaluate(() => (window.__TABLAS__?.user_profiles || []).filter((p) => p.id === 'admin-1').pop())
  check('el perfil queda completado', perfil?.onboarding_completed === true, JSON.stringify(perfil))
  check('  …con el nombre', perfil?.display_name === 'Pingu')
  check('  …y con lo que te trae en `interests`', JSON.stringify(perfil?.interests) === '["coleccionar","aprender"]', JSON.stringify(perfil?.interests))
  check('«Ahora no» lleva a la portada', /index\.html/.test(destino || ''), String(destino))
  await page.close()
}

console.log('── 3. El Panel sin cartas ──')
{
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = []
    window.__FAKE_CARTAS__ = []
    window.__FAKE_COLECCION__ = []
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const vacio = page.locator('#mcResumenPanel .mc-vacio')
  check('hay un estado vacío con dibujo y título', (await vacio.count()) === 1 && (await vacio.locator('.mc-vacio-icono svg').count()) === 1 && /vacía/.test(await vacio.innerText()))
  const boton = vacio.locator('a.btn-primary')
  check('  …con UNA acción principal que lleva a buscar', (await boton.count()) === 1 && /ver=buscar/.test(await boton.getAttribute('href')))
  check('  …y la puerta de importar', (await vacio.locator('.mc-importar-abrir').count()) === 1)
  if (CAPS) await page.screenshot({ path: `${CAPS}/movil-panel-vacio.png` })
  await vacio.locator('.mc-importar-abrir').click()
  await page.waitForTimeout(800)
  check('pulsarla abre la bandeja de importar', await page.evaluate(() => !!document.getElementById('mcImportarDialogo')?.open))
  await page.click('#mcImportarCerrar')
  // Y desde la bienvenida, ?importar=1 la abre sola.
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen&importar=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  check('con ?importar=1 se abre nada más llegar', await page.evaluate(() => !!document.getElementById('mcImportarDialogo')?.open))
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
