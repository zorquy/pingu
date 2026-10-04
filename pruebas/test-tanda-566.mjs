// Tanda 566 — «Mis 9 cartas»: nueve huecos, un buscador y una imagen.
//
// PINGU: «un minijuego de elegir tus nueve cartas preferidas. Nueve huecos
// con un más; le das y sale un buscador con los dos catálogos; cuando lo
// rellenas, un botón que genere una imagen con pokedoc.es para compartir
// en Twitter o Instagram. Entrará gente y se quedará».
//
// Lo que se mira, y por qué:
//   · Se juega SIN cuenta y lo elegido sobrevive a recargar.
//   · El buscador encuentra en los DOS catálogos (hay promos japonesas
//     exclusivas): una japonesa se encuentra por su nombre inglés.
//   · La imagen se GENERA de verdad: un canvas con fotos de otro dominio
//     se queda «sucio» y no se puede guardar; se comprueba que con el
//     permiso puesto sale, y que sin él se pide por nuestra función.
//   · Compartir exige las nueve: una imagen con huecos no es «mis 9».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { esDireccionPermitida, traerFoto } from '/home/user/pingu/netlify/functions/imagen-carta.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'

const SETS = [
  { id: 'sv8', name: 'Surging Sparks', market: 'WEST', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191, tcg_online_code: 'SSP' },
  { id: 'me1', name: 'Mega Evolution', market: 'WEST', serie_id: 'me', release_date: '2026-09-26', card_count_official: 132, tcg_online_code: 'MEG' },
  { id: 'sv8a', name: 'テラスタルフェスex', name_en: 'Terastal Festival ex', market: 'JP', serie_id: 'sv', release_date: '2024-12-06', card_count_official: 187 },
]
const nombres = ['Pikachu', 'Charizard ex', 'Lapras', 'Eevee', 'Snorlax', 'Gardevoir ex', 'Mewtwo', 'Bulbasaur', 'Lucario', 'Ampharos']
const CARTAS = nombres.map((n, i) => ({
  id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: n, name_es: n, image_path: `sv/sv8/${i + 1}`, category: 'Pokemon',
}))
// La japonesa, con su nombre inglés: así es como la encuentra quien no
// escribe japonés.
CARTAS.push({ id: 'sv8a-25', market: 'JP', set_id: 'sv8a', local_id: '025', name: 'ピカチュウ', name_en: 'Pikachu', image_scrydex: 'https://images.scrydex.com/pokemon/sv8a-25/large', category: 'Pokemon' })

const browser = await chromium.launch()
async function abrir({ conPermiso = true, guardado = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('request', (r) => pedidas.push(r.url()))
  // Las fotos: con o sin permiso CORS, que es lo que decide si el canvas
  // se puede guardar.
  // «Sin permiso» se simula ABORTANDO la foto grande (la del canvas): una
  // respuesta servida por Playwright pasa el CORS aunque no lleve la
  // cabecera —comprobado: el píxel salía pintado—, así que no se puede
  // fingir «el navegador la rechaza» con `fulfill`. Y para el código es
  // lo mismo: un rechazo CORS y una foto que no carga son el mismo
  // `onerror`, y por ahí se va a nuestra función. La pequeña (la de los
  // huecos) se sirve siempre.
  await page.route('**/assets.tcgdex.net/**', (r) =>
    !conPermiso && /high\.webp$/.test(r.request().url())
      ? r.abort()
      : r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA })
  )
  await page.route('**/images.scrydex.com/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA }))
  await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
  await page.route('**/images.pokemontcg.io/**', (r) => r.abort())
  // Nuestra función, que siempre da permiso.
  await page.route('**/.netlify/functions/imagen-carta**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA }))
  await page.addInitScript(([sets, cartas, g]) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_COLECCION__ = []
    // Se limpia UNA vez por pestaña, no en cada navegación: la primera
    // sección recarga la página justo para ver que lo elegido sobrevive,
    // y un `removeItem` en cada carga se lo llevaría por delante.
    if (g) localStorage.setItem('pokedoc-nueve', JSON.stringify(g))
    else if (!sessionStorage.getItem('nv-limpio')) {
      localStorage.removeItem('pokedoc-nueve')
      sessionStorage.setItem('nv-limpio', '1')
    }
  }, [SETS, CARTAS, guardado])
  await page.goto(`${BASE}/nueve.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores, pedidas }
}

console.log('── 1. Nueve huecos, y se elige una carta ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('hay nueve huecos', (await page.locator('.nv-hueco').count()) === 9)
  check('  …y los nueve vacíos', (await page.locator('.nv-hueco.lleno').count()) === 0)
  check('compartir está apagado con huecos vacíos', await page.locator('#nvCompartir').isDisabled())
  await page.locator('.nv-hueco').first().click()
  await page.waitForTimeout(500)
  check('tocar un hueco abre el buscador', await page.evaluate(() => document.getElementById('nvElegir').open))
  check('  …con los dos catálogos', (await page.$$eval('#nvMercado option', (os) => os.map((o) => o.value))).join(',') === 'WEST,JP')
  await page.fill('#nvBuscar', 'pika')
  await page.waitForTimeout(900)
  const resultados = await page.locator('.nv-resultado').count()
  check('buscar «pika» encuentra la carta', resultados === 1, String(resultados))
  await page.locator('.nv-resultado').first().click()
  await page.waitForTimeout(600)
  check('elegirla llena el hueco', (await page.locator('.nv-hueco.lleno').count()) === 1)
  check('  …y cierra el buscador', !(await page.evaluate(() => document.getElementById('nvElegir').open)))
  check('  …y sigue apagado compartir (falta el resto)', await page.locator('#nvCompartir').isDisabled())
  // Sobrevive a recargar: se juega sin cuenta y no se puede perder.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  check('al recargar, la carta sigue en su hueco', (await page.locator('.nv-hueco.lleno').count()) === 1)
  await page.close()
}

console.log('── 2. El catálogo japonés, por el nombre inglés ──')
{
  const { page } = await abrir()
  await page.locator('.nv-hueco').nth(1).click()
  await page.waitForTimeout(400)
  await page.selectOption('#nvMercado', 'JP')
  await page.waitForTimeout(700)
  const sets = await page.$$eval('#nvSet option', (os) => os.map((o) => o.value))
  check('las expansiones son las japonesas', sets.includes('sv8a') && !sets.includes('sv8'), sets.join(','))
  await page.fill('#nvBuscar', 'pikachu')
  await page.waitForTimeout(900)
  const r = page.locator('.nv-resultado')
  check('«pikachu» encuentra la japonesa', (await r.count()) === 1 && (await r.first().getAttribute('data-elegir')) === 'sv8a-25', await r.first().getAttribute('data-elegir'))
  await page.close()
}

console.log('── 3. Con las nueve, la imagen se genera de verdad ──')
{
  const nueve = CARTAS.slice(0, 9).map((c) => ({ ...c, tcg_sets: { name: 'Surging Sparks', tcg_online_code: 'SSP' } }))
  const { page, errores } = await abrir({ conPermiso: true, guardado: nueve })
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('los nueve llenos', (await page.locator('.nv-hueco.lleno').count()) === 9)
  check('compartir se enciende', !(await page.locator('#nvCompartir').isDisabled()))
  check('  …y la previsualización se ve', !(await page.evaluate(() => document.getElementById('nvVista').hidden)))
  // Lo que importa: que el canvas se pueda EXPORTAR. Con una foto sin
  // permiso, `toDataURL` revienta con SecurityError.
  const exporta = await page.evaluate(() => {
    try {
      return document.getElementById('nvLienzo').toDataURL('image/png').length > 1000
    } catch (e) {
      return String(e)
    }
  })
  check('el canvas se puede exportar', exporta === true, String(exporta))
  check('  …y mide 1080 × 1350 (retrato de Instagram)', await page.evaluate(() => {
    const c = document.getElementById('nvLienzo')
    return c.width === 1080 && c.height === 1350
  }))
  await page.close()
}

console.log('── 4. Si el navegador rechaza la foto, se pide por nuestra función ──')
{
  const nueve = CARTAS.slice(0, 9).map((c) => ({ ...c, tcg_sets: { name: 'Surging Sparks', tcg_online_code: 'SSP' } }))
  const { page, pedidas } = await abrir({ conPermiso: false, guardado: nueve })
  await page.waitForTimeout(2500)
  const porLaFuncion = pedidas.filter((u) => u.includes('/.netlify/functions/imagen-carta?u=')).length
  check('cada foto rechazada pasa por imagen-carta', porLaFuncion >= 9, String(porLaFuncion))
  check('  …con la dirección original dentro', pedidas.some((u) => u.includes('imagen-carta?u=https%3A%2F%2Fassets.tcgdex.net')))
  const exporta = await page.evaluate(() => {
    try {
      return document.getElementById('nvLienzo').toDataURL('image/png').length > 1000
    } catch (e) {
      return String(e)
    }
  })
  check('  …y el canvas sigue limpio', exporta === true, String(exporta))
  await page.close()
}

console.log('── 5. Un hueco lleno: quitar y mover ──')
{
  const nueve = CARTAS.slice(0, 9).map((c) => ({ ...c, tcg_sets: { name: 'Surging Sparks', tcg_online_code: 'SSP' } }))
  const { page } = await abrir({ guardado: nueve })
  await page.locator('.nv-hueco').nth(1).click()
  await page.waitForTimeout(400)
  check('tocar un hueco lleno abre su menú', await page.evaluate(() => document.getElementById('nvHuecoMenu').open))
  await page.locator('#nvHuecoMenu [value="izquierda"]').click()
  await page.waitForTimeout(500)
  const primero = await page.locator('.nv-hueco').first().getAttribute('aria-label')
  check('«mover a la izquierda» lo pone el primero', /Charizard/.test(primero || ''), primero)
  await page.locator('.nv-hueco').first().click()
  await page.waitForTimeout(400)
  await page.locator('#nvHuecoMenu [value="quitar"]').click()
  await page.waitForTimeout(500)
  check('«quitar» vacía el hueco', (await page.locator('.nv-hueco.lleno').count()) === 8)
  check('  …y compartir se apaga otra vez', await page.locator('#nvCompartir').isDisabled())
  await page.close()
}

console.log('── 6. Escondida, por ahora (tanda 567) ──')
{
  // PTCGenius sacó «My 9 Cards» la misma semana y PINGU no quiso parecer
  // la copia: la página se queda para reaprovecharla, pero sin entrada
  // desde la portada y sin indexar. Si algún día vuelve, estas dos
  // comprobaciones se dan la vuelta.
  check('la portada NO enlaza a /nueve', !/href="\/nueve"/.test(leer('index.html')))
  check('  …ni el pie de ninguna página', !/href="\/nueve"/.test(leer('lanzamientos.html')))
  check('nueve.html va en noindex', /name="robots"[^>]*noindex/.test(leer('nueve.html')))
  check('  …y sigue cargando su hoja y su módulo', /css\/nueve\.css/.test(leer('nueve.html')) && /js\/nueve\.js/.test(leer('nueve.html')))
}

await browser.close()

console.log('── 7. La función, en Node: no es un proxy abierto ──')
{
  check('deja pasar TCGdex', esDireccionPermitida('https://assets.tcgdex.net/en/sv/sv8/1/high.webp'))
  check('  …y Scrydex', esDireccionPermitida('https://images.scrydex.com/pokemon/sv8a-25/large'))
  check('no deja pasar otro sitio', !esDireccionPermitida('https://example.com/foto.png'))
  check('  …ni http a secas', !esDireccionPermitida('http://assets.tcgdex.net/x.webp'))
  check('  …ni basura', !esDireccionPermitida('no es una url') && !esDireccionPermitida(null))
  let motivo = ''
  const nada = await traerFoto('https://example.com/x.png', { fetchImpl: async () => ({ ok: true }), alFallar: (m) => (motivo = m) })
  check('traerFoto rechaza antes de pedir', nada === null && motivo === 'direccion', motivo)
  const noImagen = await traerFoto('https://assets.tcgdex.net/x.webp', {
    fetchImpl: async () => ({ ok: true, headers: new Map([['content-type', 'text/html']]), arrayBuffer: async () => new ArrayBuffer(1) }),
    alFallar: (m) => (motivo = m),
  })
  check('  …y rechaza lo que no es imagen', noImagen === null && /tipo/.test(motivo), motivo)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
