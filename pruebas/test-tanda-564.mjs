// Tanda 564 — añadir una carta decidía por ti en qué versión, y la ponía mal.
//
// PINGU, mirando un Spinarak: «puedo añadir con el + o quitar con el −, y
// si le doy a N o a RH añade esa variante, vale, ok. Pero después abro el
// pop-up y dice “todavía no tienes esta carta / añadir a mi colección”:
// ese añadir me la va a poner en español Near Mint, pero ¿qué VERSIÓN?».
//
// La respuesta era «normal», escrita a mano, y de ahí sale lo gordo: el
// Spinarak tiene normal y reverse, así que acierta de casualidad. Una
// ultra rara, una full art o una secreta **solo existen en holo**, y a
// esas el «+» del álbum las guardaba como NORMALES. Sin error y sin que se
// note: la chapa de versión solo sale cuando no es la normal, así que la
// casilla queda igual que una bien puesta.
//
// Las casillas POR VERSIÓN nunca pasaron por ahí —llevan la suya en el
// `data-var`—, y por eso el fallo se escondió seis tandas: justo las
// cartas de las que se ofrecen varias versiones son las que lo hacían
// bien. Las que no ofrecen ninguna son las que lo hacían mal.
//
// Y de paso, las otras dos decisiones mudas de ese botón: el idioma y el
// estado salían de dos desplegables del ÁLBUM que desde la Pokédex o
// desde Buscar ni se ven. Ahora se dicen.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { varianteDeCarta } from '/home/user/pingu/js/mi-coleccion/variantes.js'
import { GRUPOS_FILTRO } from '/home/user/pingu/js/mi-coleccion/filtros.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const CARTAS = [
  // Solo holo: el caso que estaba mal. Es una ultra rara cualquiera.
  { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Lapras', name_es: 'Lapras', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { holo: true } },
  // Normal + reverse: el Spinarak de PINGU, el que acertaba.
  { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Spinarak', name_es: 'Spinarak', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
  // Sin engordar: `variants` a null es «no se sabe», y entonces normal.
  { id: 'sv8-3', market: 'WEST', set_id: 'sv8', local_id: '3', name: 'Snorlax', name_es: 'Snorlax', image_path: 'x/3', rarity: 'Rare', category: 'Pokemon', variants: null },
]

async function abrir(coleccion = [], ver = 'album') {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(([cs, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: 3, card_count_total: 3, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = cs
    window.__FAKE_COLECCION__ = col
  }, [CARTAS, coleccion])
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.goto(`${BASE}/mi-coleccion.html?ver=${ver}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}

const browser = await chromium.launch()

console.log('── 1. El «+» del álbum guarda la versión DE LA CARTA ──')
{
  const { page, errores } = await abrir()
  await page.locator('[data-set="sv8"]').click()
  await page.waitForTimeout(1300)
  check('sin errores', errores.length === 0, errores.join(' | '))
  // El Lapras solo existe en holo. Desde la 565 la casilla no lleva «+»:
  // se abre la ficha y se añade desde ahí, y la versión que entra es la
  // que la ficha propone — que tiene que ser la de la carta.
  await page.locator('.mc-bolsillo-enlace[data-carta="sv8-1"]').click()
  await page.waitForTimeout(900)
  check('la casilla no lleva mando', (await page.locator('[data-anadir]').count()) === 0)
  check('  …y la ficha propone la versión de la carta', (await page.inputValue('#mcEdAnadirVariante')) === 'holo', await page.inputValue('#mcEdAnadirVariante'))
  await page.locator('#mcEdAnadirVersiones button').click()
  await page.waitForTimeout(1400)
  // Lo que importa no es lo propuesto: es lo que acaba en la línea.
  check('la copia guardada es la HOLO', (await page.inputValue('#mcEdVariante')) === 'holo', await page.inputValue('#mcEdVariante'))
  check('  …y la chapa lo dice', /Holo/.test(await page.locator('#mcEdChapas').innerText()), (await page.locator('#mcEdChapas').innerText()).replace(/\n/g, ' '))
  // Y no se cuela la «normal» como opción: no hay ninguna línea vieja que
  // proteger, así que ofrecerla sería ofrecer algo que no se ha impreso.
  const vs = await page.$$eval('#mcEdVariante option', (os) => os.map((o) => o.value))
  check('  …sin ofrecer una versión que no existe', vs.join(',') === 'holo', vs.join(','))
  await page.close()
}

console.log('── 2. La ficha de una que no tienes: la versión en un desplegable ──')
{
  const { page } = await abrir()
  await page.locator('[data-set="sv8"]').click()
  await page.waitForTimeout(1300)
  // El Spinarak, que tiene dos.
  await page.locator('.mc-bolsillo-enlace[data-carta="sv8-2"]').click()
  await page.waitForTimeout(900)
  // Como en Dex (565): un desplegable con las versiones y UN botón.
  const vs = await page.$$eval('#mcEdAnadirVariante option', (os) => os.map((o) => o.value))
  check('dos versiones, un desplegable con las dos', vs.join(',') === 'normal,reverse', vs.join(','))
  check('  …a la vista', (await page.isVisible('#mcEdAnadirVariante')) === true)
  const botones = page.locator('#mcEdAnadirVersiones button')
  check('  …y un solo botón', (await botones.count()) === 1, String(await botones.count()))
  // Y lo que PINGU no veía: con qué idioma y en qué estado entra.
  const con = await page.locator('#mcEdAnadirCon').innerText()
  check('dice con qué idioma y estado entra', /español/i.test(con) && /Near Mint/i.test(con), con)
  // Elegir reverse y pulsar guarda reverse, no la primera opción.
  await page.selectOption('#mcEdAnadirVariante', 'reverse')
  await botones.first().click()
  await page.waitForTimeout(1500)
  check('al pulsar «reverse holo» entra en reverse', (await page.inputValue('#mcEdVariante')) === 'reverse', await page.inputValue('#mcEdVariante'))
  await page.close()
}

console.log('── 3. Con una sola versión sigue siendo un botón y un toque ──')
{
  const { page } = await abrir()
  await page.locator('[data-set="sv8"]').click()
  await page.waitForTimeout(1300)
  await page.locator('.mc-bolsillo-enlace[data-carta="sv8-1"]').click()
  await page.waitForTimeout(900)
  const botones = page.locator('#mcEdAnadirVersiones button')
  check('una sola versión, un solo botón', (await botones.count()) === 1, String(await botones.count()))
  // Y sin desplegable: con una sola versión no hay nada que elegir, y la
  // chapa de arriba ya la dice.
  check('  …y sin desplegable', (await page.isVisible('#mcEdAnadirVariante')) === false)
  check('  …y no nombra la versión', (await botones.first().innerText()).trim() === 'Añadir a mi colección', await botones.first().innerText())
  await botones.first().click()
  await page.waitForTimeout(1500)
  check('  …y entra en holo', (await page.inputValue('#mcEdVariante')) === 'holo', await page.inputValue('#mcEdVariante'))
  await page.close()
}

console.log('── 4. El filtro por casa de gradeo ──')
{
  const { page } = await abrir([
    { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', gradeo: 'PSA 10', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'BGS 9.5', created_at: '2026-10-02T10:00:00Z' },
    { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-03T10:00:00Z' },
  ], 'cartas')
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(700)
  const chips = await page.$$eval('[data-grupo="gradeo"]', (bs) => bs.map((b) => b.dataset.valor))
  check('el grupo ofrece las casas que hay', chips.includes('PSA') && chips.includes('Beckett (BGS)'), chips.join(','))
  check('  …y «Sin gradear», que es un hecho y no una laguna', chips.includes('Sin gradear'), chips.join(','))
  await page.click('[data-grupo="gradeo"][data-valor="PSA"]')
  await page.waitForTimeout(900)
  await page.click('#mcFiltrosVer').catch(() => {})
  await page.waitForTimeout(900)
  check('filtrar por PSA deja una', (await page.locator('#mcCartas .mc-carta').count()) === 1, String(await page.locator('#mcCartas .mc-carta').count()))
  await page.close()
}

await browser.close()

console.log('── 5. En Node ──')
{
  check('la holo-sola se añade en holo', varianteDeCarta(CARTAS[0]) === 'holo', varianteDeCarta(CARTAS[0]))
  check('la de dos, en la primera (normal)', varianteDeCarta(CARTAS[1]) === 'normal', varianteDeCarta(CARTAS[1]))
  // «No se sabe» NO es «solo normal», pero para AÑADIR la normal es la
  // apuesta buena: es la que existe casi siempre.
  check('la que no se sabe, en normal', varianteDeCarta(CARTAS[2]) === 'normal', varianteDeCarta(CARTAS[2]))
  check('  …y sin carta tampoco revienta', varianteDeCarta(null) === 'normal' && varianteDeCarta(undefined) === 'normal')
  const g = GRUPOS_FILTRO.find((x) => x.id === 'gradeo')
  check('el grupo de gradeo agrupa por CASA', g.de({ gradeo: 'PSA 10' })[0] === 'PSA' && g.de({ gradeo: 'PSA 9' })[0] === 'PSA')
  check('  …y lo escrito a mano cae en «Otra casa»', g.de({ gradeo: 'grado 9 propio' })[0] === 'Otra casa', g.de({ gradeo: 'grado 9 propio' })[0])
  check('  …y sin gradeo, «Sin gradear»', g.de({})[0] === 'Sin gradear')
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
