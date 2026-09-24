// Tanda 351 — el botón de Editar un torneo no hacía NADA.
//
// PINGU: «acabo de crear un torneo pero no puedo editarlo, quiero meter
// el banner. El botón de editar no hace nada».
//
// Y la prueba de la 296 estaba en verde: comprobaba que el botón SALE.
// Que salga no es que funcione — es la lección de la 313 otra vez (una
// prueba que mira si se llama a algo no prueba lo que ese algo hace).
// Aquí se PULSA.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

async function abrir(estado) {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((st) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFIL__ = { is_admin: false, is_tournament_admin: false }
    window.__FAKE_TORNEOS__ = [{
      id: 'torneo-1', slug: 'copa', name: 'La pachanga', status: st,
      admin_id: 'user-1', max_players: 8, swiss_rounds: 3, swiss_bo: 1,
      format: 'standard', round_time_minutes: 50, top_cut_size: 0,
    }]
  }, estado)
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

// Un torneo recién creado nace en `draft`: es el caso de PINGU.
for (const estado of ['draft', 'registration_open']) {
  console.log(`\n── Un torneo en «${estado}» ──`)
  const { page, errores } = await abrir(estado)
  check('el botón está', (await page.locator('#btnEditarTorneo').count()) === 1)
  await page.click('#btnEditarTorneo')
  await page.waitForTimeout(700)
  check('…y al pulsarlo SALE el formulario', (await page.locator('#torneoEditor').count()) === 1)
  check('…con el campo del banner', (await page.locator('#btnEditarBanner').count()) === 1)
  check('…y el de la imagen', (await page.locator('#btnEditarImagen').count()) === 1)
  // Se ve de verdad: colgado de un sitio que existe y dentro de la
  // página, no detrás de nada.
  check('…y se ve', await page.locator('#torneoEditor').isVisible())
  check('…y guardar está', (await page.locator('#btnGuardarEdicion').count()) === 1)
  // El editor de texto de la descripción carga a demanda: si el
  // formulario se colgó de un sitio que no existe, esto no llegaría.
  check('…y la descripción tiene su editor', (await page.locator('#editarDescBarra .rte-btn, #editarDescBarra button').count()) > 0)
  // Y vuelve a pulsarse para cerrarlo.
  await page.click('#btnEditarTorneo')
  await page.waitForTimeout(300)
  check('se cierra al volver a pulsar', (await page.locator('#torneoEditor').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── Y la caja a la que se cuelga existe ──')
{
  // El fallo era este: `.torneo-ficha` era la tarjeta de antes de la
  // tanda 298, que rehízo la cabecera y se llevó la clase por delante.
  const js = readFileSync('/home/user/pingu/js/torneos/torneo.js', 'utf8')
  const html = readFileSync('/home/user/pingu/torneo.html', 'utf8')
  check('ya no se cuelga de la clase que no existe', !/querySelector\('\.torneo-ficha'\)/.test(js))
  check('se cuelga de un id que SÍ está en el HTML',
    /getElementById\('torneoCabecera'\)/.test(js) && /id="torneoCabecera"/.test(html))
  check('y si algún día tampoco está, no revienta', /\.page-content'\) \|\| document\.body/.test(js))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
