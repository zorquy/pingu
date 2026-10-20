// Tanda 856 — volver en Mi colección: un botón que se ve y un historial que
// sube un nivel.
//
// PINGU: «para irme atrás tengo que darle a "Expansiones" arriba y es muy
// poco intuitivo […] si estoy cambiando entre las pestañas y le voy dando
// para atrás, va a la pestaña anterior y no me lleva a las expansiones.
// Pasa en la Pokédex, los álbumes, en todos los sitios de Cartas».
//
// Lo que se mira: el botón «‹ Expansiones» de 44 px en la expansión, el
// Pokémon y el álbum (PC y iPhone); en el PC, la fila de volver arriba de
// la lateral de su era; en el iPhone, la barra pegada al bajar; y el
// historial: las pestañas no dejan rastro, atrás sube un nivel, Esc sube
// un nivel y tocar la pestaña activa sube a su lista.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-callada', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_SETS__ = [
    { id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', release_date: '2025-09-26', card_count_official: 120, card_count_total: 120 },
    { id: 'sv7', name: 'Pitch Black', serie_id: 'sv', market: 'WEST', release_date: '2025-07-18', card_count_official: 100, card_count_total: 100 },
  ]
  const c = (set, n, nombre, dex) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${set}/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [dex], tcg_sets: { id: set, name: set === 'sv8' ? 'Mega Evolution' : 'Pitch Black', serie_id: 'sv' } })
  window.__FAKE_CARTAS__ = Array.from({ length: 60 }, (_, i) => c('sv8', i + 1, `Carta ${i + 1}`, (i % 4) + 1)).concat([c('sv7', 1, 'Bulbasaur', 1)])
  window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }]
}
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1440, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const donde = (page) => page.evaluate(() => location.search)
const largo = (page) => page.evaluate(() => history.length)
const caja = async (page, sel) => page.locator(sel).first().evaluate((n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return { alto: Math.round(r.height), ancho: Math.round(r.width), borde: cs.borderTopWidth, visible: r.height > 0 && cs.visibility !== 'hidden' } })

console.log('── 1. PC: el botón de volver, en la expansión ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await caja(page, '#mcAlbumVolver')
  check('«‹ Expansiones» es un botón de 44 px con contorno y flecha', b.visible && b.alto >= 44 && b.borde === '1px' && (await page.locator('#mcAlbumVolver .mc-miga-flecha').count()) === 1, JSON.stringify(b))
  check('  …con el texto «Expansiones» y sin «›» detrás', (await page.locator('#mcAlbumVolver').innerText()).trim() === 'Expansiones' && (await page.locator('#mcAlbumMigas .mc-miga-sep').count()) === 0)
  check('  …en la misma fila que el logo (no una fila más)', await page.evaluate(() => document.querySelector('#mcAlbumMigas')?.parentElement?.classList.contains('mc-album-barra')))
  const lat = await caja(page, '#mcHermanosVolver')
  check('la lateral de su era lleva arriba su fila «‹ Expansiones», de 44 px', lat.visible && lat.alto >= 44 && (await page.locator('#mcAlbumHermanos > :first-child').getAttribute('id')) === 'mcHermanosVolver', JSON.stringify(lat))
  await page.click('#mcHermanosVolver')
  await page.waitForTimeout(800)
  check('  …y lleva a la estantería', (await donde(page)) === '?ver=album' && !(await page.locator('#mcArchivadorZona').isVisible()), await donde(page))
  await ctx.close()
}

console.log('── 2. PC: el historial sube un nivel ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html')
  const n0 = await largo(page)
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(600)
  await page.click('.mc-set-tarjeta[data-set="sv8"]')
  await page.waitForTimeout(1200)
  // Las pestañas se tocan por JS: en el PC, dentro de una expansión, el
  // menú deja su sitio a la lista de su era (748) y no se ve.
  const pestania = (p) => page.evaluate((x) => document.querySelector(`#mcMenu [data-pestania="${x}"]`).click(), p)
  await pestania('pokedex')
  await page.waitForTimeout(800)
  await pestania('album')
  await page.waitForTimeout(800)
  check('Panel → Expansiones → sv8 → Pokédex → Expansiones: solo UNA entrada más (la expansión)', (await largo(page)) === n0 + 1, `${n0} → ${await largo(page)}`)
  await page.goBack()
  await page.waitForTimeout(1200)
  check('ATRÁS va a la estantería, no a la Pokédex', (await donde(page)) === '?ver=album' && (await page.locator('#mcPanelAlbum').isVisible()) && !(await page.locator('#mcArchivadorZona').isVisible()), await donde(page))
  // Esc sube un nivel.
  await page.click('.mc-set-tarjeta[data-set="sv8"]')
  await page.waitForTimeout(1200)
  check('se abre otra vez', await page.locator('#mcArchivadorZona').isVisible())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  check('Esc cierra la expansión y deja la estantería', !(await page.locator('#mcArchivadorZona').isVisible()) && (await donde(page)) === '?ver=album', await donde(page))
  // Tocar la pestaña en la que ya estás, con algo abierto, sube.
  await page.click('.mc-set-tarjeta[data-set="sv8"]')
  await page.waitForTimeout(1200)
  await pestania('album')
  await page.waitForTimeout(800)
  check('tocar «Expansiones» estando dentro de una sube a la lista', !(await page.locator('#mcArchivadorZona').isVisible()) && (await donde(page)) === '?ver=album', await donde(page))
  await ctx.close()
}

console.log('── 3. PC: la Pokédex y los álbumes, el mismo botón ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=pokedex&dex=1')
  const b = await caja(page, '#pdxVolver')
  check('«‹ Pokédex» es el mismo botón de 44 px', b.visible && b.alto >= 44 && b.borde === '1px' && (await page.locator('#pdxVolver .mc-miga-flecha').count()) === 1, JSON.stringify(b))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  check('Esc cierra el Pokémon', (await donde(page)) === '?ver=pokedex', await donde(page))
  await ctx.close()
}

console.log('── 4. iPhone: el botón, el gesto y la barra pegada ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album', { movil: true })
  const n0 = await largo(page)
  await page.click('.mc-set-tarjeta[data-set="sv8"]')
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await caja(page, '#mcAlbumVolver')
  // Desde la 919 (propuesta «PokeDoc más sencillo»): en el móvil volver es un
  // icono EN LA FILA del nombre, no una línea suya.
  check('«‹ Expansiones» se ve en el móvil, 44 px', b.visible && b.alto >= 44, JSON.stringify(b))
  check('  …en la fila del nombre, como icono (919)', await page.evaluate(() => { const m = document.querySelector('#mcAlbumVolver').getBoundingClientRect(); const t = document.querySelector('#mcAlbumTitulo').getBoundingClientRect(); return Math.abs((m.top + m.height / 2) - (t.top + t.height / 2)) < 16 && m.width <= 52 }))
  check('la barra pegada no está al principio', !(await page.locator('#mcAlbumPegada').isVisible()))
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
  await page.waitForTimeout(700)
  const peg = await page.locator('#mcAlbumPegada').evaluate((n) => { const r = n.getBoundingClientRect(); return { visible: r.height > 0 && getComputedStyle(n).display !== 'none', top: Math.round(r.top), texto: n.innerText.replace(/\s+/g, ' ').trim() } })
  check('al bajar, la barra pegada arriba con la flecha, el nombre y la cuenta', peg.visible && peg.top <= 60 && /Mega Evolution/.test(peg.texto) && /1\/60/.test(peg.texto), JSON.stringify(peg))
  const bv = await caja(page, '#mcAlbumPegadaVolver')
  check('  …y su flecha mide 44', bv.alto >= 44 && bv.ancho >= 44, JSON.stringify(bv))
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(700)
  check('al volver arriba, se esconde', !(await page.locator('#mcAlbumPegada').isVisible()))
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
  await page.waitForTimeout(700)
  await page.click('#mcAlbumPegadaVolver')
  await page.waitForTimeout(900)
  check('tocar la flecha de la barra pegada vuelve a la estantería', !(await page.locator('#mcArchivadorZona').isVisible()) && (await donde(page)) === '?ver=album' && !(await page.locator('#mcAlbumPegada').isVisible()), await donde(page))
  // El gesto de atrás del teléfono (es el historial): un nivel.
  await page.click('.mc-set-tarjeta[data-set="sv8"]')
  await page.waitForTimeout(1200)
  check('abierta, con una entrada más', (await largo(page)) >= n0 + 1)
  await page.goBack()
  await page.waitForTimeout(1200)
  check('ATRÁS (el gesto del iPhone) vuelve a la estantería', !(await page.locator('#mcArchivadorZona').isVisible()) && (await donde(page)) === '?ver=album', await donde(page))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
