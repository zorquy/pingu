// Tanda 362 — la portada enseña lo que la gente usa de verdad.
//
// Cuatro cambios, y los dos primeros salen de la analítica: `/torneo` es
// la segunda página más vista y la tocan 47 de las 55 personas que
// vuelven; el reto diario lleva 103 partidas en toda la historia de la
// web y ocupaba el hueco más caro de la portada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const SETS = [
  { id: 'me05', name: 'Pitch Black', market: 'WEST', serie_id: 'me', serie_name: 'Mega Evolution',
    tcg_online_code: 'PBL', release_date: '2026-09-26', card_count_official: 190 },
  // Sin código de TCG Live y más nuevo: NO tiene que ganar. Es como se
  // dejan fuera los sets de Pokémon TCG Pocket sin arrastrar `esDelTCG`
  // hasta la portada.
  { id: 'A4', name: 'Pocket', market: 'WEST', serie_id: null, tcg_online_code: null,
    release_date: '2026-09-30', card_count_official: 60 },
]
const CARTAS = [
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `me05-${i + 1}`, set_id: 'me05', market: 'WEST', local_id: String(i + 1).padStart(3, '0'),
    name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `me/me05/00${i + 1}`,
  })),
  { id: 'A4-1', set_id: 'A4', market: 'WEST', local_id: '001', name: 'Pocket 1', image_path: 'tcgp/A4/001' },
]
const TORNEOS = [{
  id: 't1', slug: 'pachanga', name: 'Pachanga de inauguración', status: 'registration_open',
  admin_id: 'otro', max_players: 16, swiss_rounds: 4, swiss_bo: 1, format: 'standard',
  start_at: new Date(Date.now() + 3 * 86400e3).toISOString(),
}]

const browser = await chromium.launch()
async function abrir({ ancho = 1280, torneos = TORNEOS } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  // El entorno de pruebas no llega a la CDN de TCGdex: se responde aquí,
  // que lo que se comprueba es que la foto se pide y se coloca.
  await page.route('**/assets.tcgdex.net/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="14"></svg>' }))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = d.sets
    window.__FAKE_CARTAS__ = d.cartas
    window.__FAKE_TORNEOS__ = d.torneos
  }, { sets: SETS, cartas: CARTAS, torneos })
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

console.log('\n── 1. El titular dice a qué se juega aquí ──')
{
  const html = leer('index.html')
  // Desde la 785 (PA3) el escaparate dice las tres cosas en el subtítulo y
  // los botones son «Crear mi cuenta» y «Ver el catálogo»; los torneos y
  // aprender tienen su puerta debajo («Juega», «Aprende»).
  check('los torneos entran en el subtítulo', /y torneos cada semana/.test(html))
  check('y el botón principal es crear la cuenta', /href="\/auth\.html\?registro=1" class="btn-primary">Crear mi cuenta/.test(html))
  check('aprender y jugar tienen su puerta', /<b>Aprende<\/b>/.test(html) && /<b>Juega<\/b>/.test(html))
  // No desaparece: baja a enlace de texto, que es quien lo pregunta.
  check('y «qué es PokeDoc» también', /id="btnWhatIsPokeDoc"/.test(html))
}

console.log('\n── 2. El torneo ocupa el sitio caro ──')
{
  const { page, errores } = await abrir()
  // La tanda 368 se llevó la fila de «hoy» (medía lo que medía su caja
  // más alta y dejaba 250 px de hueco debajo del torneo). Lo que esta
  // tanda defendía sigue igual y por eso la comprobación se queda, dicha
  // contra lo que hay ahora: el torneo ABRE la columna ancha —por
  // delante de la guía destacada— y el reto se queda en la lateral.
  const enHoy = await page.evaluate(() => {
    const t = document.getElementById('torneoPortadaSeccion')
    const d = document.getElementById('destacadaSeccion')
    // Desde la 785 (PA2) el torneo abre la columna de la derecha.
    const l = t?.closest('.portada-lateral')
    if (!t || !d || !l) return 0
    return l.querySelector(':scope > section') === t ? 1 : 0
  })
  const enLateral = await page.locator('.portada-lateral #retoSeccion').count()
  check('el torneo abre la columna de la derecha (785)', enHoy === 1)
  check('y el reto en la lateral', enLateral === 1)
  // Lo que cazó el fallo: las reglas del estirón estaban escritas con el
  // id del reto, así que al cambiarlos la caja se encogió. Desde la 368
  // no hay fila y se mide contra la COLUMNA, que es lo que ahora tiene
  // que llenar — la pregunta es la misma: que la caja de arriba no salga
  // a media anchura con un claro al lado.
  const [fila, caja, panel] = await page.evaluate(() => [
    document.querySelector('.portada-principal').getBoundingClientRect().width,
    document.querySelector('.portada-principal > section:not(.seccion-recogida) > *').getBoundingClientRect().width,
    document.querySelector('.foro-vivo')?.getBoundingClientRect().right ?? null,
  ])
  check('la caja se estira en su columna', caja > fila * 0.9, `${Math.round(caja)} de ${Math.round(fila)}`)
  // Con `> 0`: en este fixture el foro está vacío y su caja mide cero, y
  // comparar contra un cero es comparar contra nada.
  if (panel > 0) {
    const dcho = await page.evaluate(() =>
      document.querySelector('.portada-principal > section:not(.seccion-recogida) > *').getBoundingClientRect().right)
    check('…y cuadra con lo de abajo', Math.abs(dcho - panel) <= 2, `${Math.round(dcho)} vs ${Math.round(panel)}`)
  }
  // Y las reglas van por POSICIÓN, no por el id de quien las ocupa: quien
  // se ponga ahí mañana las hereda sin que nadie se acuerde. Era la
  // lección de esta tanda y sigue valiendo con la fila quitada (368).
  const css = leer('css/portada.css').replace(/\/\*[\s\S]*?\*\//g, '')
  check('las reglas no llevan el id del reto', !/#retoSeccion/.test(css), (css.match(/[^\n]*#retoSeccion[^\n]*/) || [])[0])
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. El número que no puede avergonzarte ──')
{
  // SIN COMENTARIOS: el HTML explica por qué se quitó «mensajes esta
  // semana», así que buscar esa frase a pelo casa con la explicación y
  // la prueba falla sola. Es la trampa de la 312 y la 313, tercera vez.
  const html = leer('index.html').replace(/<!--[\s\S]*?-->/g, '')
  check('fuera «mensajes esta semana»', !/heroStatMensajes/.test(html) && !/mensajes esta semana/.test(html))
  check('y entra el catálogo', /id="heroStatCartas"/.test(html) && /cartas en español/.test(html))
  const { page } = await abrir()
  const valor = (await page.locator('#heroStatCartas').textContent()) || ''
  check('con una cifra de verdad', /^\d/.test(valor.trim()), valor.trim())
}

console.log('\n── 4. Las cartas del héroe son fotos ──')
{
  const { page, errores } = await abrir()
  const fotos = page.locator('.card-stack .tcg-card img.tcg-card-foto')
  check('se pintan dentro del rectángulo de siempre', (await fotos.count()) >= 3,
    String(await fotos.count()))
  const src = (await fotos.first().getAttribute('src')) || ''
  // Del set con código de TCG Live, que además deja fuera a Pocket sin
  // importar `esDelTCG` en la portada.
  check('del set moderno, no del de Pocket', /\/me\/me05\//.test(src) && !/tcgp/.test(src), src)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. Y si la CDN no contesta, la portada se ve igual ──')
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.abort())
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = d.sets
    window.__FAKE_CARTAS__ = d.cartas
    window.__FAKE_TORNEOS__ = d.torneos
  }, { sets: SETS, cartas: CARTAS, torneos: TORNEOS })
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  // La foto se quita sola y queda el rectángulo: ni hueco roto ni salto.
  check('la foto rota se quita', (await page.locator('.tcg-card-foto').count()) === 0)
  check('…y el rectángulo sigue ahí', (await page.locator('.card-stack .tcg-card').count()) >= 3)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 6. Y la copia de la dirección de imágenes, vigilada ──')
{
  // Se copió a propósito: importar `carta-ruta.js` metía su peso en la
  // portada, que va al límite. Una copia sin vigilar se separa (322).
  const home = leer('js/home.js')
  const ruta = leer('js/carta-ruta.js')
  const deHome = (home.match(/const ASSETS_CARTAS = '([^']+)'/) || [])[1]
  const deRuta = (ruta.match(/const ASSETS = '([^']+)'/) || [])[1]
  check('las dos apuntan al mismo sitio', deHome && deHome === deRuta, `${deHome} vs ${deRuta}`)
  check('y la portada no importa el módulo entero',
    !/from '\.\/carta-ruta\.js'/.test(home) && !/from '\.\/catalogo-series\.js'/.test(home))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
