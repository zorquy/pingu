// Tanda 468 — el botón de atrás, que no volvía.
//
// PINGU: «en el PC estoy en mi colección, abro una expansión o un Pokémon,
// le doy para atrás y no me lleva para atrás: me saca al inicio».
//
// Y era eso exactamente. TODA la navegación de la página usaba
// `history.replaceState`, que CAMBIA la entrada actual en vez de añadir
// una: el historial nunca tenía dónde volver dentro de la página, así que
// el botón de atrás —y el gesto de deslizar en el móvil— salían de ella.
//
// Peor: abrir una expansión no tocaba la dirección SIQUIERA. Recargar te
// devolvía a la estantería y no se podía compartir el enlace de una
// colección abierta.
//
// Esto se prueba con el navegador DE VERDAD (`goBack`/`goForward`), no
// comprobando que se llame a `pushState`: una prueba que mira si se llama
// a una función no prueba lo que la función hace (la lección de la 313).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta = '/mi-coleccion.html') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 3, card_count_total: 3, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = ['Bulbasaur', 'Charmander', 'Squirtle'].map((n, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: n, name_es: n,
      image_path: 'x/' + (i + 1), rarity: 'Rare', category: 'Pokemon', dex_ids: [[1, 4, 7][i]], variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: 'l' + i, card_id: c.id,
      market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() }))
  })
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}
const donde = (page) => page.evaluate(() => location.search)

console.log('\n── 1. Atrás vuelve, y no sale de la página ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('se entra al Panel, sin `?ver=`', (await donde(page)) === '')
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(1200)
  check('la pestaña está en la dirección', (await donde(page)) === '?ver=album', await donde(page))
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  check('  …y la expansión abierta también', (await donde(page)) === '?ver=album&set=sv8', await donde(page))
  check('  …con el archivador a la vista', await page.locator('#mcArchivadorZona').isVisible())

  // ESTO es lo que fallaba: atrás se iba de /mi-coleccion.
  await page.goBack()
  await page.waitForTimeout(1500)
  check('ATRÁS vuelve a la estantería', (await donde(page)) === '?ver=album', await donde(page))
  check('  …y se ve la estantería, no el archivador',
    (await page.locator('#mcEstanteriaZona').isVisible()) && !(await page.locator('#mcArchivadorZona').isVisible()))
  check('  …sin salir de la página', /mi-coleccion/.test(page.url()), page.url())

  await page.goBack()
  await page.waitForTimeout(1200)
  check('ATRÁS otra vez vuelve al Panel', (await donde(page)) === '' && (await page.locator('#mcPanelResumen').isVisible()), await donde(page))

  // Y adelante, que es la otra mitad: un historial que solo va hacia atrás
  // está a medias.
  await page.goForward()
  await page.waitForTimeout(1200)
  check('ADELANTE vuelve a Expansiones', (await donde(page)) === '?ver=album' && (await page.locator('#mcPanelAlbum').isVisible()), await donde(page))
  await page.close()
}

console.log('\n── 2. Lo mismo dentro de la Pokédex ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=pokedex')
  await page.locator('[data-dex="1"]').first().click()
  await page.waitForTimeout(1500)
  check('la especie está en la dirección', (await donde(page)) === '?ver=pokedex&dex=1', await donde(page))
  await page.goBack()
  await page.waitForTimeout(1500)
  check('ATRÁS vuelve a la rejilla', (await donde(page)) === '?ver=pokedex', await donde(page))
  check('  …con su región entera y las pestañas (748)', (await page.locator('.pdx-especie').count()) === 151 && (await page.locator('.pdx-region').count()) === 9,
    String(await page.locator('.pdx-especie').count()))
  await page.close()
}

console.log('\n── 3. El enlace de una expansión abierta LLEVA ahí ──')
{
  // Es la otra mitad de meter `?set=` en la dirección: sin esto, el enlace
  // llevaría a la estantería, y al dar atrás desde dentro la dirección
  // diría una cosa y la pantalla otra.
  const { page } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  check('se abre la expansión directamente', await page.locator('#mcArchivadorZona').isVisible())
  check('  …y es la suya', (await page.locator('#mcAlbumTitulo').textContent()) === 'Mega Evolution',
    await page.locator('#mcAlbumTitulo').textContent())
  await page.close()
}
{
  const { page } = await abrir('/mi-coleccion.html?ver=pokedex&dex=4')
  check('y el de un Pokémon, igual', (await donde(page)) === '?ver=pokedex&dex=4', await donde(page))
  check('  …con su ficha abierta', (await page.locator('.pdx-especie').count()) < 100,
    String(await page.locator('.pdx-especie').count()))
  await page.close()
}

console.log('\n── 4. Al cambiar de pestaña se cierra lo que había dentro ──')
{
  // Un `?set=` colgando en la pestaña de la Pokédex no significa nada, y
  // al volver abriría una expansión que no habías pedido.
  const { page } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  await page.click('[data-pestania="pokedex"]')
  await page.waitForTimeout(1200)
  check('la dirección se queda sin `set`', (await donde(page)) === '?ver=pokedex', await donde(page))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
