// Tanda 382 — la vista de una colección, y una barra que marcaba cero.
//
// Lo segundo de las cuatro cosas que PINGU quiere de la app de TCGdex.
// En un set de 200 cartas, «enséñame solo las ultra raras que me
// faltan» es la pregunta de quien colecciona, y hasta ahora había que ir
// pasando páginas del archivador.
//
// Y de camino, un fallo de la 381: la barra de progreso de la Pokédex
// escribía `--i` y la hoja lee `--ancho`. Se pintaba SIEMPRE al 0 % sin
// dar ningún error — o sea que parecía «todavía no tienes ninguna» en
// todos los Pokémon.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('\n── 1. Ninguna barra se pinta con la variable equivocada ──')
{
  // LA FORMA, no el caso: se busca en TODO el JavaScript cada `.mc-barra`
  // que se rellena desde una plantilla y se comprueba que usa la MISMA
  // variable que lee la hoja. Comprobar solo el de la Pokédex dejaría
  // pasar el siguiente.
  const css = leer('css/mi-coleccion.css')
  const cual = (css.match(/\.mc-barra i \{[^}]*width: var\((--[\w-]+)/) || [])[1]
  check('la hoja lee una variable con nombre', Boolean(cual), String(cual))

  const malas = []
  const ficheros = []
  const barrer = (dir) => {
    for (const f of readdirSync(`${RAIZ}/${dir}`, { withFileTypes: true })) {
      if (f.isDirectory()) barrer(`${dir}/${f.name}`)
      else if (f.name.endsWith('.js')) ficheros.push(`${dir}/${f.name}`)
    }
  }
  barrer('js')
  for (const f of ficheros) {
    const txt = leer(f)
    for (const m of txt.matchAll(/class="mc-barra"[^]{0,120}?style="(--[\w-]+):/g)) {
      if (m[1] !== cual) malas.push(`${f}: ${m[1]} (la hoja lee ${cual})`)
    }
  }
  check(`ninguna de las barras usa otra variable`, malas.length === 0, malas.join(' | '))
  // Y que el barrido LLEGUE: si no encuentra ninguna barra, lo de arriba
  // sale verde por vacío (la lección de la 307).
  const cuantas = ficheros.reduce((n, f) => n + (leer(f).match(/class="mc-barra"/g) || []).length, 0)
  check('  …y se han mirado varias de verdad', cuantas >= 4, `${cuantas} barras`)
}

console.log('\n── 2. Los filtros de una colección ──')
const browser = await chromium.launch()
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e9ce6a"/></svg>'

const RAREZAS = ['Common', 'Rare Holo', 'Ultra Rare', 'Common', 'Rare Holo', 'Common']
const CATS = ['Pokemon', 'Pokemon', 'Pokemon', 'Trainer', 'Trainer', 'Energy']

async function abrir(opciones = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 220)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.addInitScript(([rarezas, cats, sinDetalle, cuantas]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{
      id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'SV',
      card_count_official: cuantas, card_count_total: cuantas, release_date: '2023-03-31', logo_path: 'sv1/logo',
    }]
    window.__FAKE_CARTAS__ = [...Array(cuantas)].map((_, i) => ({
      id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1).padStart(3, '0'),
      name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}`, market: 'WEST',
      rarity: sinDetalle ? null : rarezas[i % 6],
      category: sinDetalle ? null : cats[i % 6],
    }))
    window.__FAKE_COLECCION__ = [1, 2, 3].map((n) => ({
      id: `c${n}`, user_id: 'admin-1', card_id: `sv1-${n}`, market: 'WEST', idioma: 'es', estado: 'NM',
      variante: 'normal', cantidad: 1, cambio: 0, gradeo: null, valor_manual: null, precio_compra: null,
      notas: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }))
  }, [RAREZAS, CATS, opciones.sinDetalle === true, opciones.cuantas || 18])
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  return { page, errores }
}

{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Las opciones salen de las cartas que hay DE VERDAD, no de una lista
  // escrita a mano: un set con rareza nueva la trae solo (lección 323).
  const rarezas = await page.locator('#mcAlbumRareza option').allTextContents()
  check('las rarezas salen de la colección', rarezas.length === 4, rarezas.join(' | '))
  check('  …y en español', rarezas.includes('Rara Ultra'), rarezas.join(' | '))
  check('  …con «cualquiera» la primera', /Cualquier rareza/.test(rarezas[0]), rarezas[0])

  const bolsillos = () => page.locator('.mc-bolsillo:not(.mc-hoja-fantasma .mc-bolsillo)').count()
  // LOS FILTROS VIVEN DENTRO DEL PANEL desde la tanda 473, así que se abre
  // una vez y se queda abierto durante toda esta parte: encontrar un
  // elemento no es poder pulsarlo (la lápida de la 447). Leer un texto o
  // contar elementos SÍ funciona con el panel delante — no es una
  // comprobación de que se vea, es de lo que dice.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumRareza', 'Rara Ultra')
  await page.waitForTimeout(700)
  // 18 cartas, una de cada seis es Rara Ultra → 3.
  check('filtrar por rareza deja 3', /3 de 18 cartas a la vista/.test(limpio(await page.locator('#mcAlbumCuenta').textContent())),
    limpio(await page.locator('#mcAlbumCuenta').textContent()))

  // EL PROGRESO NO CAMBIA al filtrar: «llevas 3 de 18» no puede
  // depender de lo que estés mirando, o la cifra deja de significar
  // nada.
  check('  …y el progreso sigue siendo el de la colección entera',
    // Desde la 398 son tres barras; la de «completo» es la que dice
    // cuántos bolsillos llevas, que es lo que mira esto.
    // Desde la 417 el progreso vive en la tira de la colección, y la
    // primera tarjeta se llama «Conjunto completo».
    /Conjunto completo 3 de 18/.test(limpio(await page.locator('#mcAlbumProgreso').textContent())),
    limpio(await page.locator('#mcAlbumProgreso').textContent()))

  await page.selectOption('#mcAlbumRareza', '')
  await page.selectOption('#mcAlbumTipo', 'Entrenador')
  await page.waitForTimeout(700)
  check('y por categoría también', /6 de 18/.test(limpio(await page.locator('#mcAlbumCuenta').textContent())),
    limpio(await page.locator('#mcAlbumCuenta').textContent()))
  check('  …sin cuenta cuando no filtras nada', await page.selectOption('#mcAlbumTipo', '').then(async () => {
    await page.waitForTimeout(500)
    return limpio(await page.locator('#mcAlbumCuenta').textContent()) === ''
  }))
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(300)
  await page.close()
}

console.log('\n── 3. Filtrar no deja la pantalla en blanco ──')
{
  // Esto comprobaba que filtrar volvía a la página 1: seguir en la
  // página 7 de una lista que ahora tiene 3 cartas dejaba el archivador
  // EN BLANCO y sin ningún error. Desde la tanda 417 una expansión no
  // tiene páginas —es una rejilla— así que ese fallo ya no PUEDE pasar.
  // Lo que se sigue comprobando es el efecto: que al filtrar se ve lo
  // filtrado.
  const { page } = await abrir({ cuantas: 54 })
  // El control vive DENTRO del panel de «Filtros» desde la tanda 473,
  // así que hay que abrirlo: encontrar un elemento no es poder pulsarlo.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumRareza', 'Rara Ultra')
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  await page.waitForTimeout(700)
  check('se ve lo filtrado', (await page.locator('.mc-bolsillo').count()) > 0,
    String(await page.locator('.mc-bolsillo').count()))
  check('  …y no la colección entera', (await page.locator('.mc-bolsillo').count()) < 54,
    String(await page.locator('.mc-bolsillo').count()))
  await page.close()
}

console.log('\n── 4. Sin rareza guardada, el filtro no estorba ──')
{
  // Las cartas se engordan por tandas: una colección recién importada no
  // tiene ni rareza ni categoría. Un desplegable con UNA opción que no
  // hace nada es peor que no tenerlo.
  const { page, errores } = await abrir({ sinDetalle: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el filtro de rareza se esconde', !(await page.locator('#mcAlbumRareza').isVisible()))
  check('  …y el de categoría también', !(await page.locator('#mcAlbumTipo').isVisible()))
  check('  …pero la rejilla sigue ahí', (await page.locator('.mc-album-rejilla').count()) === 1)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
