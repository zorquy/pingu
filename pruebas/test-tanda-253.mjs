import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 253: el aviso de «te sugieren una corrección» tiene que llevarte
// A LA CORRECCIÓN.
//
// PINGU: «me ha llegado el aviso a la campanita pero al clicarle me ha
// llevado a mi perfil y ya, no sé dónde se miran las correcciones». El
// aviso enlazaba a /perfil#guides y perfil.js solo sabía abrir la
// pestaña con #torneos: cualquier otro hash se ignoraba EN SILENCIO.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const MUNDO = {
  __FAKE_SESSION__: 'admin-1',
  // La guía con corrección va la SEGUNDA a propósito: si fuera la
  // primera, un «coge la primera de la lista» pasaría por bueno y la
  // prueba no probaría que se busca la del aviso (lo pilló el rigor).
  __FAKE_GUIAS__: [
    { id: 'guia-2', slug: 'otra', title: 'Guía sin correcciones', author_id: 'admin-1' },
    { id: 'guia-1', slug: 'marcas', title: 'Cómo leer una marca de regulación', author_id: 'admin-1' },
  ],
  __FAKE_SUGERENCIAS__: [
    { id: 'sug-1', guide_id: 'guia-1', author_id: 'user-1', quote: 'la marca D caduca en 2024', body: 'Eso ya no es así desde el último set.' },
  ],
}

const abrir = async (ruta, semillas = MUNDO) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}
const pestanaActiva = (page) =>
  page.evaluate(() => document.querySelector('#profileTabs .tab-btn.active')?.dataset.ptab || null)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Sin hash, el perfil abre por donde siempre ──')
{
  const { page, errores } = await abrir('/perfil')
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('empieza en el Muro', (await pestanaActiva(page)) === 'wall', String(await pestanaActiva(page)))
  await page.close()
}

console.log('\n── 2. El hash abre SU pestaña, no solo la de torneos ──')
{
  // Esto es lo que estaba roto: solo `#torneos` funcionaba.
  for (const [hash, esperada] of [['#guides', 'guides'], ['#foro', 'foro'], ['#torneos', 'torneos'], ['#about', 'about']]) {
    const { page } = await abrir(`/perfil${hash}`)
    check(`${hash} abre «${esperada}»`, (await pestanaActiva(page)) === esperada, String(await pestanaActiva(page)))
    await page.close()
  }
}

console.log('\n── 3. Un hash inventado no deja la página sin pestaña ──')
{
  const { page, errores } = await abrir('/perfil#loquesea')
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('se queda en el Muro', (await pestanaActiva(page)) === 'wall', String(await pestanaActiva(page)))
  await page.close()
}
{
  // Un hash con comillas no puede reventar el selector.
  const { page, errores } = await abrir('/perfil#%22%5D%2Cscript')
  check('y un hash con caracteres raros tampoco', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 4. Las correcciones se ven en la pestaña de Guías ──')
{
  const { page } = await abrir('/perfil#guides')
  const texto = await page.locator('#myGuidesList').innerText()
  check('la guía con corrección la anuncia', /1 corrección sugerida/.test(texto), texto.slice(0, 140))
  check('y la que no tiene, no', (await page.locator('[data-sugerencias]').count()) === 1)
  await page.close()
}

console.log('\n── 5. Desde la campanita se abre LA corrección ──')
{
  // El enlace que manda el aviso desde la tanda 253.
  const { page, errores } = await abrir('/perfil?sugerencias=guia-1#guides')
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('cae en la pestaña de guías', (await pestanaActiva(page)) === 'guides', String(await pestanaActiva(page)))
  const cuerpo = await page.locator('body').innerText()
  check('y el panel se abre solo', /Eso ya no es así desde el último set/.test(cuerpo), cuerpo.slice(0, 200))
  check('con el trozo citado', /la marca D caduca en 2024/.test(cuerpo))
  // Atado AL PANEL y no al cuerpo entero: el título de la guía sale
  // también en la lista de guías de detrás, así que buscarlo en el
  // `body` daba por bueno un panel de otra guía (lo pilló el rigor).
  const panel = await page.locator('[aria-label="Correcciones sugeridas"]').innerText()
  check('y es el panel de ESA guía', /Cómo leer una marca de regulación/.test(panel), panel.replace(/\n/g, ' ').slice(0, 120))
  check('y no el de la otra', !/Guía sin correcciones/.test(panel), panel.replace(/\n/g, ' ').slice(0, 120))
  // Y la URL se limpia: recargar no puede reabrir algo ya resuelto.
  check('el parámetro se quita de la URL', !page.url().includes('sugerencias='), page.url())
  await page.close()
}

console.log('\n── 6. Un aviso viejo (sin el parámetro) sigue valiendo ──')
{
  const { page } = await abrir('/perfil#guides')
  check('abre la pestaña igual', (await pestanaActiva(page)) === 'guides')
  check('y el botón está ahí para pulsarlo', (await page.locator('[data-sugerencias]').count()) === 1)
  await page.close()
}

console.log('\n── 7. Una guía sin correcciones no abre nada ──')
{
  const { page, errores } = await abrir('/perfil?sugerencias=guia-2#guides')
  const cuerpo = await page.locator('body').innerText()
  check('no se abre ningún panel', !/Eso ya no es así/.test(cuerpo))
  // Y sin reventar: sin esta línea, un error de JavaScript se leía como
  // «no se ha abierto nada» y pasaba por bueno (lo pilló el rigor).
  check('y sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('ni sale la cabecera del panel', !/Correcciones sugeridas/.test(cuerpo))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
