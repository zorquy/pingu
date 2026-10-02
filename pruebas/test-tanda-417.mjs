// Tanda 417 — una expansión es una rejilla, no un archivador.
//
// PINGU, con la pantalla de Dex delante: «mira las expansiones cómo se
// muestran, quiero lo mismo. El formato álbum dejémoslo solamente para
// los álbumes soñados y punto».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const browser = await chromium.launch()
const abrir = async (ruta = '/mi-coleccion.html?ver=album') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP',
      market: 'WEST', card_count_official: 12, card_count_total: 12, release_date: '2023-03-31', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({ id: 'sv1-' + (i + 1), set_id: 'sv1',
      local_id: String(i + 1), name: 'Carta ' + (i + 1), image_path: 'x/' + i, market: 'WEST',
      rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 6).map((c, i) => ({ id: 'l' + i,
      card_id: c.id, cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

console.log('\n── 1. Dentro de una expansión, todas las cartas de una vez ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(900)
  // Un archivador de pliegos ordena lo que TÚ montas, carta a carta. Una
  // expansión ya viene ordenada y lo que se quiere es verla entera: con
  // pliegos había que pasar 22 páginas para mirar un set de 200.
  check('es una rejilla', (await page.locator('.mc-album-rejilla').count()) === 1)
  check('  …y no un archivador', (await page.locator('#mcAlbum .mc-pliego, #mcAlbum .mc-archivador').count()) === 0)
  check('  …con las doce cartas a la vez', (await page.locator('.mc-album-rejilla .mc-bolsillo').count()) === 12,
    await page.locator('.mc-album-rejilla .mc-bolsillo').count())
  check('  …y sin mandos de página', (await page.locator('#mcAlbumAnterior, #mcAlbumSiguiente, #mcAlbumSalto').count()) === 0)
  await page.close()
}

console.log('\n── 2. Los datos de la colección ──')
{
  const { page } = await abrir()
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(900)
  const titulos = await page.locator('#mcAlbumProgreso .mc-diapo-titulo').allTextContents()
  check('hay tres tarjetas', titulos.length === 3, titulos.join(' | '))
  check('  …y la primera es el conjunto', /conjunto/i.test(titulos[0] || ''), titulos[0])
  check('  …con su anillo', (await page.locator('#mcAlbumProgreso .mc-anillo').count()) === 1)
  // Es la misma pieza que la del panel: misma clase, misma rejilla. Las
  // flechas se fueron en la 459 con la tira —sus tres tarjetas no se
  // deslizaban, se encogían— y aquí se comprueba que no han vuelto.
  check('  …en una rejilla y no en una tira', (await page.locator('#mcAlbumProgreso .mc-diapos').count()) === 1)
  check('  …sin flechas que no llevan a ninguna parte',
    (await page.locator('#mcAlbumProgreso .mc-tira-flecha, #mcTiraSetDer, #mcTiraSetIzq').count()) === 0)
  await page.close()
}

console.log('\n── 3. El buscador de dentro ──')
{
  const { page } = await abrir()
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(900)
  await page.fill('#mcAlbumBuscar', 'Carta 7')
  await page.waitForTimeout(500)
  check('se busca por nombre', (await page.locator('.mc-album-rejilla .mc-bolsillo').count()) === 1,
    await page.locator('.mc-album-rejilla .mc-bolsillo').count())
  // Y por NÚMERO, que es como se busca una carta dentro de un set.
  await page.fill('#mcAlbumBuscar', '11')
  await page.waitForTimeout(500)
  check('  …y por número', (await page.locator('.mc-album-rejilla .mc-bolsillo').count()) === 1,
    await page.locator('.mc-album-rejilla .mc-bolsillo').count())
  await page.fill('#mcAlbumBuscar', 'zzz')
  await page.waitForTimeout(500)
  check('  …y sin resultados se dice', /encaja con esos filtros/.test(
    (await page.locator('#mcAlbum').textContent()) || ''), await page.locator('#mcAlbum').textContent())
  await page.close()
}

console.log('\n── 4. El archivador sigue vivo donde SÍ tiene sentido ──')
{
  // El formato álbum se queda para los álbumes soñados, que es donde el
  // orden lo pones tú carta a carta. Y la tapa se muda con él.
  const { page, errores } = await abrir('/mi-coleccion.html?ver=carpetas')
  await page.locator('#mcAlbNuevoAbrir').click()
  await page.waitForTimeout(600)
  await page.fill('#mcDlgNombre', 'Mi álbum')
  await page.locator('#mcDlgGuardar').click()
  await page.waitForTimeout(1300)
  check('el álbum soñado se abre', await page.locator('#mcAlbumesDetalle').evaluate((e) => !e.classList.contains('hidden')))
  check('  …con su archivador', (await page.locator('#mcAlbArchivador').count()) === 1)
  check('  …y con el «Personalizar» de la tapa, que se mudó aquí',
    (await page.locator('#mcAlbumTapa').count()) === 1)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
