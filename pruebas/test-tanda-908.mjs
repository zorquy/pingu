// Tanda 908 — lo que se cambia en /admin → Colecciones se ve en la web YA.
//
// PINGU: «en el panel de admin, en colecciones, yo ordeno las eras y meto
// las expansiones o cambio cosas y luego en la web no se ha cambiado».
// Dos causas:
//   1. La estantería sale de una copia de la CDN (813) de diez minutos que
//      luego se sigue sirviendo mientras se renueva. Ahora la respuesta
//      lleva la etiqueta `sets` y /admin la tira al guardar (sets-purgar).
//   2. Arrastrar una colección a otra era escribía `serie_id` a pelo, y la
//      siguiente pasada del catálogo se lo devolvía: el cambio se deshacía
//      solo. Ahora va como corrección (885).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El vaciado de la caché ──')
{
  const { purgarEtiquetas } = await import(`${RAIZ}/netlify/lib/purgar.mjs`)
  const llamadas = []
  const fetchImpl = async (url, op) => { llamadas.push({ url, op }); return new Response('', { status: 202 }) }
  const r = await purgarEtiquetas(['sets'], { env: { NETLIFY_PURGE_API_TOKEN: 'tok', SITE_ID: 'sitio-1' }, fetchImpl })
  const cuerpo = JSON.parse(llamadas[0]?.op?.body || '{}')
  check('pide a Netlify que tire la etiqueta, con su token y su sitio', r.ok && llamadas[0].url === 'https://api.netlify.com/api/v1/purge' && llamadas[0].op.headers.authorization === 'Bearer tok' && cuerpo.site_id === 'sitio-1' && cuerpo.cache_tags.join() === 'sets', JSON.stringify(llamadas[0]?.op))
  const sin = await purgarEtiquetas(['sets'], { env: {}, fetchImpl })
  check('sin el token de Netlify no lo intenta y dice por qué', !sin.ok && /NETLIFY_PURGE_API_TOKEN/.test(sin.error))
  const mal = await purgarEtiquetas(['sets'], { env: { NETLIFY_PURGE_API_TOKEN: 't', SITE_ID: 's' }, fetchImpl: async () => new Response('nope', { status: 403 }) })
  check('un no de Netlify se cuenta con su número', !mal.ok && /403/.test(mal.error))

  const { purgar } = await import(`${RAIZ}/netlify/functions/sets-purgar.mjs`)
  const pedir = (metodo = 'POST') => new Request('https://pokedoc.es/.netlify/functions/sets-purgar', { method: metodo, headers: { authorization: 'Bearer x' } })
  const noAdmin = await purgar(pedir(), { env: { NETLIFY_PURGE_API_TOKEN: 't', SITE_ID: 's' }, fetchImpl, esAdmin: async () => null })
  check('solo un admin puede vaciarla', noAdmin.status === 401)
  check('  …y solo por POST', (await purgar(pedir('GET'), { esAdmin: async () => 'a' })).status === 405)
  const si = await purgar(pedir(), { env: { NETLIFY_PURGE_API_TOKEN: 't', SITE_ID: 's' }, fetchImpl, esAdmin: async () => 'admin-1' })
  check('un admin la vacía', si.status === 200 && (await si.json()).ok === true)

  const { CABECERAS, ETIQUETA_CACHE } = await import(`${RAIZ}/netlify/functions/sets.mjs`)
  check('la estantería lleva la etiqueta que se vacía', CABECERAS['netlify-cache-tag'] === ETIQUETA_CACHE && ETIQUETA_CACHE === 'sets')
  check('  …y el navegador no se la guarda (quien cambia algo lo ve al recargar)', /max-age=0, must-revalidate/.test(CABECERAS['cache-control']) && /max-age=600/.test(CABECERAS['netlify-cdn-cache-control']))
}

console.log('\n── 2. Lo que escribe Colecciones avisa a la web ──')
{
  const c = leer('admin/js/colecciones.js')
  const cuerpo = (nombre) => c.slice(c.indexOf(`async function ${nombre}(`), c.indexOf('\n}\n', c.indexOf(`async function ${nombre}(`)))
  check('guardar una colección avisa', /avisarALaWeb\(\)\n  return true/.test(cuerpo('guardarSet')))
  check('guardar una era avisa', /avisarALaWeb\(\)\n  return true/.test(cuerpo('guardarEra')))
  check('quitar una corrección, borrar y crear también', (c.match(/avisarALaWeb\(\)/g) || []).length >= 6)
  // Desde la 978 el aviso vive en admin/js/avisar-web.js (lo usa también el editor de cartas).
  const aviso = leer('admin/js/avisar-web.js')
  check('  …una vez por tanda de cambios (un segundo después del último)', /clearTimeout\(vaciado\)/.test(aviso) && /\}, 1000\)/.test(aviso) && /import \{ avisarALaWeb \} from '\.\/avisar-web\.js'/.test(c))
  check('arrastrar a otra era la mueve como CORRECCIÓN, y el orden sigue directo', /guardarSet\(s\.id, \{ serie_id: enLaEra \}, \{ comoCorreccion: true \}\)/.test(cuerpo('guardarOrden')) && /guardarSet\(s\.id, campos\)\) tocadas\+\+/.test(cuerpo('guardarOrden')))
}

console.log('\n── 3. En pantalla: renombrar una era vacía la caché ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'base1', name: 'Base Set', serie_id: 'base', market: 'WEST', release_date: '1999-01-09' }, { id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', market: 'WEST', release_date: '2023-03-31' }]
    window.__FAKE_ERAS__ = [{ market: 'WEST', id: 'base', nombre: 'Base', orden: 0 }]
  })
  let vaciados = 0
  let autorizacion = ''
  await page.route('**/.netlify/functions/sets-purgar', (r) => { vaciados++; autorizacion = r.request().headers().authorization || ''; r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) })
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.locator('[data-section="colecciones"]').click()
  await page.waitForTimeout(1000)
  await page.locator('[data-era-editar="base"]').click()
  await page.waitForTimeout(300)
  await page.fill('#colEraNombre', 'Base (WOTC)')
  await page.locator('#colEraGuardar').click()
  await page.waitForTimeout(1800)
  // El doble no da `access_token` (una sesión de verdad sí): la ficha de
  // la sesión se comprueba en el código, y aquí que la cabecera va.
  check('guardar pide vaciar la caché, una vez y con la cabecera de la sesión', vaciados === 1 && /^Bearer/.test(autorizacion) && /authorization: `Bearer \$\{session\?\.access_token \|\| ''\}`/.test(leer('admin/js/avisar-web.js')), `${vaciados} · ${autorizacion}`)
  const avisos = await page.locator('.toast').allInnerTexts().catch(() => [])
  check('  …y lo dice', avisos.some((t) => /La web ya enseña los cambios/.test(t)), avisos.join(' | '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
