// Tanda 463 — las rarezas, con su nombre oficial y su marca.
//
// PINGU mandó la tabla de rarezas de la web oficial de Pokémon en español,
// con sus dibujos: «te voy a pasar las imágenes de la web oficial para que
// lo veas, y con sus iconos».
//
// ── LO QUE ARREGLA, Y NO ES COSMÉTICO ──
//
// Nosotros decíamos «Doble rara», «Ultra rara», «Ilustración rara»; el
// oficial —y el que devuelve TCGdex cuando se le pide en español, que es
// como está guardada media base— es «Rara Doble», «Rara Ultra», «Rara
// Ilustración». Mientras no coincidieran, un filtro de rareza mandaba a la
// consulta la clave inglesa y NUESTRA palabra, y las filas guardadas con
// la palabra de TCGdex se quedaban fuera: el filtro enseñaba la mitad y
// **no daba ningún error**.
//
// Por eso la prueba mira la FORMA y no la lista: para cada rareza, todas
// sus escrituras conocidas tienen que llevar al mismo nombre canónico, y
// la consulta tiene que mandarlas TODAS.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { RAREZAS_ES, OTRAS_FORMAS, MARCAS, rarezaEs, formasDeRareza, marcaDeRarezaHtml } from '/home/user/pingu/js/rarezas.js'
import { familiaDeBrillo } from '/home/user/pingu/js/carta-traducciones.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Una rareza, un nombre, se escriba como se escriba ──')
{
  const malas = []
  for (const [canonica, otras] of Object.entries(OTRAS_FORMAS)) {
    for (const forma of [canonica, ...otras]) {
      if (rarezaEs(forma) !== canonica) malas.push(`${forma} → ${rarezaEs(forma)} (debía ser ${canonica})`)
    }
  }
  check('todas las escrituras llevan a la misma', malas.length === 0, malas.join(' | '))
  // Y la tabla inglesa tiene que caer en una canónica DE LA LISTA: una
  // entrada que solo exista en inglés no tendría sus otras formas, así que
  // el filtro volvería a dejar fuera las filas en español.
  const sueltas = Object.entries(RAREZAS_ES)
    .filter(([, es]) => !(es in OTRAS_FORMAS) && es !== 'Promo')
    .map(([en, es]) => `${en} → ${es}`)
  check('ninguna rareza inglesa se queda sin sus otras formas', sueltas.length === 0, sueltas.join(' | '))
  // Lo que no conocemos sale TAL CUAL: una rareza nueva es un dato, no un
  // hueco (y mucho menos un «Sin rareza», que afirma otra cosa).
  check('una rareza nueva sale tal cual', rarezaEs('Mega Secret Rare') === 'Mega Secret Rare', rarezaEs('Mega Secret Rare'))
  check('  …y sin rareza es null', rarezaEs(null) === null && rarezaEs('') === null)
}

console.log('\n── 2. La consulta manda TODAS las formas ──')
{
  // Es lo que hacía que el filtro enseñara la mitad: el catálogo está
  // importado en varios idiomas y la misma rareza está escrita de hasta
  // tres maneras.
  const dobles = formasDeRareza('Double rare')
  check('«Double rare» va con sus tres escrituras',
    dobles.includes('Double rare') && dobles.includes('Rara Doble') && dobles.includes('Doble rara'), dobles.join(' | '))
  // Y entra por cualquiera de ellas, no solo por la inglesa: el chip de un
  // filtro guarda la clave que tenga a mano.
  for (const entrada of ['Rara Doble', 'Doble rara', 'Double rare']) {
    const f = formasDeRareza(entrada)
    check(`  …y entrando por «${entrada}» salen las mismas`,
      ['Double rare', 'Rara Doble', 'Doble rara'].every((x) => f.includes(x)), f.join(' | '))
  }
  check('una desconocida se manda a sí misma', JSON.stringify(formasDeRareza('Lo que sea')) === '["Lo que sea"]',
    JSON.stringify(formasDeRareza('Lo que sea')))
}

console.log('\n── 3. La marca ──')
{
  // Cada rareza con marca tiene que tener su figura y su acabado, y los
  // acabados son CUATRO: más de cuatro ya no se distinguen de un vistazo.
  const acabados = new Set(Object.values(MARCAS).map((m) => m.acabado))
  check('hay cuatro acabados y no más', acabados.size === 4, [...acabados].join(' | '))
  check('la común es un círculo', /circle/.test(marcaDeRarezaHtml('Common')), marcaDeRarezaHtml('Common').slice(0, 90))
  check('la infrecuente, un diamante', /M12 5\.2/.test(marcaDeRarezaHtml('Uncommon')))
  check('la rara, una estrella', (marcaDeRarezaHtml('Rare').match(/<path/g) || []).length === 1)
  check('la rara doble, dos', (marcaDeRarezaHtml('Double rare').match(/<path/g) || []).length === 2)
  // Una promo NO lleva marca impresa: dibujarle una estrella sería decir
  // que es rara. El vacío es la respuesta.
  check('una promo no lleva marca', marcaDeRarezaHtml('Promo') === '', marcaDeRarezaHtml('Promo'))
  check('  …ni una rareza que no conocemos', marcaDeRarezaHtml('Lo que sea') === '')
  // La marca no se lee en voz alta: el nombre va al lado.
  check('la marca está escondida del lector de pantalla', /aria-hidden="true"/.test(marcaDeRarezaHtml('Rare')))
  // Y el color lo pone el CSS, que es quien sabe del tema: un negro a
  // fuego desaparece en el tema oscuro (la 315).
  check('  …y el color no va a fuego dentro del SVG',
    !/#[0-9a-f]{3,6}/i.test(marcaDeRarezaHtml('Rare')), marcaDeRarezaHtml('Rare').slice(0, 120))
}

console.log('\n── 4. El brillo sigue a la rareza, venga en el idioma que venga ──')
{
  // La tabla de brillos estaba en INGLÉS y la misma carta puede estar
  // guardada en español: media base se quedaba sin brillo, sin dar error.
  const pares = [['Double rare', 'Rara Doble'], ['Hyper rare', 'Rara Híper'], ['Ultra Rare', 'Rara Ultra'],
    ['Illustration rare', 'Rara Ilustración'], ['Common', 'Común']]
  const malas = pares.filter(([en, es]) => familiaDeBrillo(en) !== familiaDeBrillo(es))
    .map(([en, es]) => `${en}:${familiaDeBrillo(en)} vs ${es}:${familiaDeBrillo(es)}`)
  check('el brillo es el mismo en inglés y en español', malas.length === 0, malas.join(' | '))
  check('  …y una común no brilla', familiaDeBrillo('Común') === null && familiaDeBrillo('Common') === null)
  check('  …y una hiperrara sí', familiaDeBrillo('Rara Híper') === 'dorada', String(familiaDeBrillo('Rara Híper')))
}

console.log('\n── 5. Y en la pantalla ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 500, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  const RAR = ['Common', 'Uncommon', 'Rare', 'Double rare', 'Hyper rare', 'Promo']
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.addInitScript((RAR) => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'MEV', serie_id: 'sv', market: 'WEST', card_count_official: RAR.length, card_count_total: RAR.length, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = RAR.map((r, i) => ({ id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: 'Carta ' + (i + 1), image_path: 'x/' + (i + 1), rarity: r, category: 'Pokemon', types: ['Grass'], dex_ids: [1], variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: 'l' + i, card_id: c.id, market: 'WEST',
      cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z' }))
  }, RAR)
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=cartas', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(700)
  const chips = await page.locator('[data-grupo="rareza"]').allTextContents()
  check('los chips llevan el nombre oficial', chips.includes('Rara Doble') && chips.includes('Rara Híper'), chips.join(' | '))
  check('  …y ninguno el viejo', !chips.some((c) => /Doble rara|Hiperrara|Poco común/.test(c)), chips.join(' | '))
  const marcas = await page.locator('[data-grupo="rareza"] .rareza-marca').count()
  check('  …con su marca, menos la promo', marcas === chips.length - 1, `${marcas} marcas / ${chips.length} chips`)
  // La marca tiene que VERSE: un SVG de 0 px es lo mismo que no estar.
  const medidas = await page.locator('[data-grupo="rareza"] .rareza-marca').evaluateAll((ns) =>
    ns.map((n) => Math.round(n.getBoundingClientRect().width)))
  check('  …y ninguna mide cero', medidas.every((m) => m >= 10), JSON.stringify(medidas))
  await browser.close()
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
