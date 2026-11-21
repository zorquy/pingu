// Tanda 1408 — el holo con el giroscopio (PINGU: «en el móvil, al girar el
// móvil, se gira la carta un poquito… en el ordenador sigue como ahora, con el
// ratón… no pongas ningún mensaje»).
//   · En un móvil (dedo como puntero), inclinar el teléfono gira la carta
//     grande un poco (≤ 7°) y enciende el brillo; volver a la postura la
//     devuelve al reposo.
//   · El reposo es la postura con que lo tienes, no el móvil plano.
//   · Con el dedo apoyado en la carta, el sensor no la toca.
//   · En iPhone (requestPermission) no se pide NADA hasta tocar la carta, y
//     al tocarla se pide una vez; ningún texto nuestro en la página.
//   · En el PC, el sensor no hace nada (sigue el ratón, como la 368).
//   · Con «menos movimiento», nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI' }]
const CARTAS = [{ id: 'sv1-25', set_id: 'sv1', local_id: '25', name: 'Pikachu', name_es: 'Pikachu', image_path: 'sv/sv01/25', market: 'WEST', category: 'Pokémon', hp: 60, types: ['Rayo'], rarity: 'Illustration Rare' }]
const browser = await chromium.launch()

async function abrir({ movil = true, permiso = false, quieto = false } = {}) {
  const ctx = await browser.newContext(movil
    ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block', reducedMotion: quieto ? 'reduce' : 'no-preference' }
    : { viewport: { width: 1360, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, permiso }) => {
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__permisos = 0
    // El iPhone: el sensor no llega hasta que alguien dice que sí. Chrome
    // también trae requestPermission (dice que sí sin preguntar): se cuenta
    // igual, para ver que con lecturas llegando no se pide.
    const nativo = window.DeviceOrientationEvent?.requestPermission
    if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = async () => { window.__permisos++; return permiso || !nativo ? 'granted' : nativo.call(DeviceOrientationEvent) }
  }, { SETS, CARTAS, permiso })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/carta?id=sv1-25`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.carta-scan-holo', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const girar = (page, beta, gamma) => page.evaluate(([beta, gamma]) => {
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma }))
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}, [beta, gamma])
const estado = (page) => page.evaluate(() => {
  const c = document.querySelector('.carta-scan-holo')
  return { ry: parseFloat(c.style.getPropertyValue('--holo-ry')) || 0, rx: parseFloat(c.style.getPropertyValue('--holo-rx')) || 0, activo: c.classList.contains('holo-activo'), holo: c.classList.contains('holo') }
})
const textoDe = (page) => page.evaluate(() => document.body.innerText)

console.log('\n── El código ──')
{
  const js = readFileSync(`${RAIZ}/js/carta-holo.js`, 'utf8')
  check('el PC no cambia: el giro solo con el dedo como puntero', /pointer: coarse/.test(js) && /const GRADOS = 12/.test(js))
  check('  …y solo en la carta grande', /contains\('carta-scan-holo'\)/.test(js))
  check('un tope más bajo para el giro (un poquito)', /const GRADOS_GIRO = [4-8]\b/.test(js))
  check('en iPhone se pide al tocar la carta y solo sin lecturas', /addEventListener\('touchend'[\s\S]{0,120}if \(recibido\) return[\s\S]{0,120}permiso\.call/.test(js) && /\{ once: true \}/.test(js))
}

console.log('\n── Móvil (Android: sin permiso) ──')
{
  const { ctx, page, errores } = await abrir()
  const antes = await textoDe(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la carta lleva el holo', (await estado(page)).holo)
  await girar(page, 40, 0) // la postura de partida: la base
  await girar(page, 40, 0)
  let e = await estado(page)
  check('en la postura de partida, reposo', !e.activo && Math.abs(e.ry) < 0.01, JSON.stringify(e))
  await girar(page, 40, 14)
  await page.waitForTimeout(80)
  e = await estado(page)
  check('inclinarlo a la derecha gira la carta', e.activo && e.ry > 2, JSON.stringify(e))
  check('  …un poquito (≤ 7°)', Math.abs(e.ry) <= 7.01 && Math.abs(e.rx) <= 7.01, JSON.stringify(e))
  await girar(page, 40, 60)
  e = await estado(page)
  check('  …y por mucho que lo gires, no pasa del tope', Math.abs(e.ry) <= 7.01, JSON.stringify(e))
  await girar(page, 55, 0)
  e = await estado(page)
  check('hacia ti también (el otro eje)', e.activo && Math.abs(e.rx) > 2, JSON.stringify(e))
  // Un sensor de verdad manda decenas de lecturas por segundo: medio segundo
  // en la postura de partida.
  for (let i = 0; i < 30; i++) await girar(page, 40, 0)
  e = await estado(page)
  check('vuelve a la postura: vuelve al reposo', !e.activo, JSON.stringify(e))
  // Te recuestas: la carta no se queda torcida para siempre.
  for (let i = 0; i < 160; i++) await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 40, gamma: 20 })))
  await page.waitForTimeout(80)
  e = await estado(page)
  check('si cambias de postura, la base la sigue y la carta vuelve al centro', !e.activo, JSON.stringify(e))
  // El dedo manda.
  await girar(page, 40, 0)
  await page.evaluate(() => document.querySelector('.carta-scan-holo').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })))
  await page.evaluate(() => { const c = document.querySelector('.carta-scan-holo'); c.classList.remove('holo-activo'); c.style.setProperty('--holo-ry', '0deg') })
  await girar(page, 40, 0); await girar(page, 40, 16)
  e = await estado(page)
  check('con el dedo apoyado, el sensor no la toca', Math.abs(e.ry) < 0.01, JSON.stringify(e))
  await page.evaluate(() => document.querySelector('.carta-scan-holo').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true })))
  check('ningún mensaje nuevo en la página', (await textoDe(page)) === antes)
  await page.locator('.carta-scan-holo').tap().catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
  check('con lecturas llegando, tocar la carta no pide permiso', (await page.evaluate(() => window.__permisos)) === 0)
  await ctx.close()
}

console.log('\n── iPhone (pide permiso) ──')
{
  const { ctx, page, errores } = await abrir({ permiso: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const antes = await textoDe(page)
  // En el iPhone no llega NINGUNA lectura hasta el sí: aquí no se manda nada.
  await page.waitForTimeout(300)
  let e = await estado(page)
  check('al abrir no se pide permiso ni se mueve', (await page.evaluate(() => window.__permisos)) === 0 && Math.abs(e.ry) < 0.01, JSON.stringify(e))
  await page.locator('.carta-scan-holo').tap()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape').catch(() => {})
  check('al tocarla se pide UNA vez', (await page.evaluate(() => window.__permisos)) === 1)
  await page.locator('.carta-scan-holo').tap().catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
  check('  …y no se vuelve a pedir', (await page.evaluate(() => window.__permisos)) === 1)
  await girar(page, 40, 0); await girar(page, 40, 14)
  e = await estado(page)
  check('con el sí, inclinar gira la carta', e.activo && e.ry > 2, JSON.stringify(e))
  const despues = await textoDe(page)
  check('ningún texto nuestro sobre el sensor', !/inclina|giroscop|sensor|mueve el m[oó]vil/i.test(despues) && !/inclina|giroscop/i.test(antes))
  await ctx.close()
}

console.log('\n── PC ──')
{
  const { ctx, page, errores } = await abrir({ movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await girar(page, 40, 0); await girar(page, 40, 14)
  let e = await estado(page)
  check('el sensor no hace nada en el PC', !e.activo && Math.abs(e.ry) < 0.01, JSON.stringify(e))
  const r = await page.locator('.carta-scan-holo').boundingBox()
  await page.mouse.move(r.x + r.width * 0.9, r.y + r.height * 0.5)
  await page.waitForTimeout(300)
  e = await estado(page)
  check('  …y el ratón sigue como siempre (hasta 12°)', e.activo && e.ry > 7, JSON.stringify(e))
  await ctx.close()
}

console.log('\n── Menos movimiento ──')
{
  const { ctx, page } = await abrir({ quieto: true })
  await girar(page, 40, 0); await girar(page, 40, 14)
  const e = await estado(page)
  check('con «menos movimiento», nada', !e.holo && !e.activo && Math.abs(e.ry) < 0.01, JSON.stringify(e))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n    ❌ ${fails} FALLAN` : '\n    ✅ todo en verde')
process.exit(fails ? 1 : 0)
