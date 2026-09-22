// Tanda 324 — la ficha de una carta, su colección y el índice.
//
// El catálogo ya tenía los datos (tanda 322). Lo que faltaba era la
// pantalla, y con ella tres preguntas que no se contestan solas:
//
//  1. ¿Dice la página lo que SABE, o rellena lo que falta? Es la lección
//     de la 319 otra vez: un Entrenador no tiene 0 PS, tiene «ninguno».
//  2. ¿Coinciden las dos mitades? El texto de un artículo lo pintan el
//     borde y el navegador por separado, y por eso pega un salto. Aquí
//     el molde es UNO y el cliente no repinta: esta prueba es la que
//     vigila que siga siendo así.
//  3. ¿Merece esta página salir en Google? Miles de fichas casi vacías
//     hunden el dominio entero.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import {
  candidatosDeRuta,
  rutaDeCarta,
  nucleoDeCarta,
  subtituloDeCarta,
  mereceIndexarse,
  coleccionMereceIndexarse,
  idDeRutaDeColeccion,
  cabeceraDeColeccion,
  rejillaDeCartas,
} from '/home/user/pingu/js/carta-nucleo.js'
import { inyectarMeta } from '/home/user/pingu/netlify/edge-functions/meta-social.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

const RAIZ = '/home/user/pingu'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const CERULEDGE = {
  id: 'sv5-36', set_id: 'sv5', market: 'WEST', local_id: '36', name: 'Ceruledge ex',
  image_path: 'sv/sv5/36', category: 'Pokemon', stage: 'Stage1', evolve_from: 'Charcadet',
  hp: 270, types: ['Fire'], rarity: 'Double rare', illustrator: 'Shin Nagasawa',
  regulation_mark: 'H', retreat: 1, detalle_at: '2026-09-21T10:00:00Z',
  attacks: [{ cost: ['Fire', 'Colorless'], name: 'Llamas Abismales', effect: 'Hace 20 más por Energía descartada.', damage: '30+' }],
  abilities: [{ type: 'Habilidad', name: 'Fuego Fatuo', effect: 'Una vez por turno.' }],
  weaknesses: [{ type: 'Water', value: '×2' }],
}
// Un Entrenador: ni PS, ni tipos, ni ataques, ni debilidad. Es el caso
// que destapa cualquier valor por defecto que se haya colado.
const ENTRENADOR = {
  id: 'sv5-160', set_id: 'sv5', market: 'WEST', local_id: '160', name: 'Investigación de Iono',
  image_path: 'sv/sv5/160', category: 'Trainer', trainer_type: 'Supporter',
  rarity: 'Uncommon', detalle_at: '2026-09-21T10:00:00Z',
}
// Una sin engordar: solo lo que trae el listado del set.
const PELADA = {
  id: 'sv5-7', set_id: 'sv5', market: 'WEST', local_id: '7', name: 'Charcadet',
  image_path: 'sv/sv5/7', detalle_at: null,
}
const SET = {
  id: 'sv5', name: 'Fuerzas Temporales', market: 'WEST', serie_name: 'Escarlata y Púrpura',
  release_date: '2024-03-22', card_count_official: 162, card_count_total: 218, logo_path: 'sv/sv5/logo',
}

const abrir = async (ruta, cartas = [CERULEDGE], sets = [SET]) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((s) => {
    window.__FAKE_CARTAS__ = s.c
    window.__FAKE_SETS__ = s.s
    // Las marcas de la temporada, para que la chapa de legalidad de la
    // tanda 335 salga igual en las dos mitades y esta prueba compare
    // manzanas con manzanas.
    window.__FAKE_AJUSTES__ = [{ key: 'torneos_reglas', value: { marcas_legales: ['H', 'I', 'J'] } }]
  }, { c: cartas, s: sets })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La ficha dice lo que la carta es ──')
{
  const { page, errores } = await abrir('/carta.html?id=sv5-36')
  check('sin errores de consola', errores.length === 0, errores.join(' | '))
  check('el título de la pestaña lleva la carta y su colección',
    /Ceruledge ex .*Fuerzas Temporales/.test(await page.title()), await page.title())
  check('un solo h1, y es el nombre',
    (await page.locator('#cartaNucleo h1').count()) === 1 &&
    limpio(await page.locator('#cartaNucleo h1').textContent()) === 'Ceruledge ex')
  check('el subtítulo contesta de un vistazo',
    limpio(await page.locator('.carta-sub').textContent()) === 'Fase 1 · Evoluciona de Charcadet · 270 PS · Tipo Fuego',
    await page.locator('.carta-sub').textContent())

  const ficha = limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))
  check('la ficha trae el número sobre el total', ficha.includes('36 / 162'), ficha)
  check('…la rareza en español', ficha.includes('Doble rara'), ficha)
  check('…y quién la ilustró', ficha.includes('Shin Nagasawa'), ficha)

  const combate = limpio((await page.locator('.carta-combate div').allTextContents()).join(' | '))
  // Desde la 328 la debilidad es un ICONO con su multiplicador, como en
  // la carta de verdad. El NOMBRE del tipo no desaparece: se va al
  // `title` y al `aria-label`, que es donde lo encuentra quien no ve el
  // color. Eso es lo que se comprueba, no la posición del punto.
  const puntoDebilidad = page.locator('.carta-combate div').first().locator('.carta-energia')
  check('la debilidad sale con el icono de su tipo', (await puntoDebilidad.count()) === 1, combate)
  check('…y el tipo, traducido, se puede oír',
    (await puntoDebilidad.getAttribute('aria-label')) === 'Agua',
    await puntoDebilidad.getAttribute('aria-label'))
  check('…con su multiplicador al lado', combate.includes('×2'), combate)
  check('la resistencia que no hay es una raya, no un cero', combate.includes('Resistencia—'), combate)
  // La retirada, en puntos incoloros: tantos como cuesta, igual que
  // está impreso. Un «1» obliga a traducir algo que ya era un dibujo.
  check('la retirada son puntos, no un número',
    (await page.locator('.carta-combate div').nth(2).locator('.carta-energia').count()) === 1)

  const movs = (await page.locator('.carta-mov-nombre').allTextContents()).map(limpio)
  check('la habilidad va la primera', /Habilidad Fuego Fatuo/.test(movs[0] || ''), movs.join(' | '))
  check('el ataque lleva su daño', /Llamas Abismales 30\+/.test(movs[1] || ''), movs.join(' | '))
  check('y su coste, con un punto por energía',
    (await page.locator('.carta-mov').nth(1).locator('.carta-energia').count()) === 2)
  // Se mira el punto DEL ATAQUE, no «el primero de la página»: desde la
  // 328 el cuadro de combate va antes y el primero es el de la
  // debilidad. Una prueba que depende del orden de pintado se rompe
  // cada vez que se mueve un bloque y no prueba nada.
  check('cada punto de energía se puede oír, no solo ver',
    (await page.locator('.carta-mov').nth(1).locator('.carta-energia').first().getAttribute('aria-label')) === 'Fuego')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Lo que no se sabe no se inventa ──')
{
  // La lección de la 319: un defecto que convierte «no me lo han dado»
  // en «me han dado cero» miente, y no da error en ninguna parte.
  const { page } = await abrir('/carta.html?id=sv5-160', [ENTRENADOR])
  const texto = limpio(await page.locator('#cartaNucleo').textContent())
  check('un Entrenador se presenta como Partidario',
    limpio(await page.locator('.carta-sub').textContent()) === 'Partidario', texto)
  check('…y NO dice que tenga 0 PS', !/\bPS\b/.test(texto), texto)
  check('…ni enseña el cuadro de combate', (await page.locator('.carta-combate').count()) === 0)
  check('…ni una lista de ataques vacía', (await page.locator('.carta-ataques').count()) === 0)
  await page.close()

  const { page: p2 } = await abrir('/carta.html?id=sv5-7', [PELADA])
  const t2 = limpio(await p2.locator('#cartaNucleo').textContent())
  check('una carta sin engordar enseña lo que hay', /Charcadet/.test(t2), t2)
  check('…y ni una palabra de lo que no', !/PS|Ataques|Debilidad/.test(t2), t2)
  check('…pero su número sí, que eso sí se sabe', /7/.test(t2), t2)
  await p2.close()

  // Y en el molde, sin navegador: el subtítulo de algo vacío es vacío,
  // no una ristra de separadores.
  check('sin datos, el subtítulo no existe', subtituloDeCarta({}) === '')
  check('una carta sin nada no revienta el molde', typeof nucleoDeCarta({ name: 'X' }) === 'string')
  check('y sin carta no se pinta nada', nucleoDeCarta(null) === '')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Las DOS mitades dicen lo mismo, y no se pisan ──')
{
  // El problema conocido del texto de un artículo: lo pintan el borde y
  // el navegador por separado, con dos códigos, y si se separan la
  // página pega un salto. Aquí el molde es uno y el cliente no repinta
  // — pero eso hay que comprobarlo, no suponerlo.
  const html = readFileSync(`${RAIZ}/carta.html`, 'utf8')
  const desdeElBorde = inyectarMeta(html, {
    url: 'u', titulo: 'Ceruledge ex', descripcion: 'd', imagen: 'i', imagenCuadrada: true,
    // Con la misma legalidad que va a calcular el cliente: en producción
    // el borde también la consulta, y si aquí se le pasara `null` las
    // dos mitades dirían cosas distintas por culpa de la prueba y no del
    // código (tanda 335).
    nucleo: nucleoDeCarta(CERULEDGE, SET, null, { marcas: ['H', 'I', 'J'], reimpresion: false }),
  })
  writeFileSync(`${SC}/test-forum/t324-borde.html`, desdeElBorde)
  check('el borde marca la caja', /id="cartaNucleo" data-servidor="1"/.test(desdeElBorde))
  check('…y se lleva el esqueleto por delante', !desdeElBorde.includes('carta-esqueleto-scan'))

  // Servida por el borde y SIN la carta en la base: si el cliente
  // repintara, la pantalla se quedaría en «no encontrada».
  const { page } = await abrir('/t324-borde.html?id=sv5-36', [])
  const delBorde = limpio(await page.locator('#cartaNucleo').textContent())
  check('el cliente no repinta lo que ya está', /Ceruledge ex/.test(delBorde), delBorde)
  check('…y sigue habiendo un solo h1', (await page.locator('#cartaNucleo h1').count()) === 1)
  // La 332 quitó el enlace «Ver en grande»: ahora se amplía pulsando la
  // imagen, con el visor de toda la web. Lo que importa sigue siendo lo
  // mismo —que lo que se pulsa funcione aunque el borde haya pintado—,
  // así que se comprueba el visor y no el enlace que ya no existe.
  await page.locator('.carta-scan img').click()
  await page.waitForTimeout(400)
  check('…y el escaneo se amplía al pulsarlo', (await page.locator('.lightbox').count()) === 1)
  await page.keyboard.press('Escape')
  await page.close()

  // Y ahora la misma carta pintada por el CLIENTE. Las dos mitades
  // tienen que decir lo mismo: si algún día alguien duplica el molde,
  // esto se pone rojo.
  const { page: p2 } = await abrir('/carta.html?id=sv5-36')
  const delCliente = limpio(await p2.locator('#cartaNucleo').textContent())
  check('el borde y el cliente pintan el mismo texto', delBorde === delCliente,
    `borde: ${delBorde.slice(0, 90)} || cliente: ${delCliente.slice(0, 90)}`)
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La dirección lleva el nombre, y se sabe leer al revés ──')
{
  check('la ruta se arma con el nombre delante', rutaDeCarta(CERULEDGE) === '/carta/ceruledge-ex-sv5-36',
    rutaDeCarta(CERULEDGE))
  check('y se lee al revés', candidatosDeRuta(rutaDeCarta(CERULEDGE))[0] === 'sv5-36',
    JSON.stringify(candidatosDeRuta(rutaDeCarta(CERULEDGE))))

  // La forma del problema: el nombre lleva guiones él también, así que
  // no se puede saber dónde acaba. Por eso van varios candidatos.
  const largo = { id: 'sv5-99', name: "Team Rocket's Mewtwo ex" }
  check('un nombre con guiones y apóstrofos no despista',
    candidatosDeRuta(rutaDeCarta(largo))[0] === 'sv5-99', rutaDeCarta(largo))
  // Y un identificador de set con un guion dentro: el primer candidato
  // falla y el segundo acierta. Por eso se preguntan TODOS a la vez.
  const raro = { id: 'sm-p-12', name: 'Pikachu' }
  check('un set con guion en el identificador también se resuelve',
    candidatosDeRuta(rutaDeCarta(raro)).includes('sm-p-12'),
    JSON.stringify(candidatosDeRuta(rutaDeCarta(raro))))
  check('una ruta que no es de carta no da candidatos', candidatosDeRuta('/foro/general').length === 0)
  check('la tildes y las mayúsculas caen del slug', rutaDeCarta({ id: 'a-1', name: 'Piedra Pómez' }) === '/carta/piedra-pomez-a-1')

  // La otra dirección.
  check('la colección se lee de su ruta', idDeRutaDeColeccion('/coleccion/sv5') === 'sv5')
  check('…y una que no lo es, no', idDeRutaDeColeccion('/cartas') === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Quién merece salir en Google ──')
{
  // «Miles de páginas casi vacías hunden el dominio, no lo suben.» Una
  // ficha sin engordar es lo mismo que tienen otras quince webs, y en
  // inglés: esa no se ofrece hasta que tenga algo que las demás no.
  // OJO: el listón lo subió la tanda 325. Aquí se comprueba lo que
  // sigue siendo de esta tanda —que sin engordar NO se indexa— y la
  // condición nueva se prueba entera en test-tanda-325.mjs.
  const JUGADA = { decks: 9, total_copies: 22, tournaments: 3, archetypes: [] }
  check('una carta engordada Y jugada se indexa', mereceIndexarse(CERULEDGE, JUGADA))
  check('una sin engordar, no', !mereceIndexarse(PELADA, JUGADA))
  check('y una que no existe, tampoco', !mereceIndexarse(null, JUGADA))

  const html = readFileSync(`${RAIZ}/carta.html`, 'utf8')
  const conNoindex = inyectarMeta(html, { url: 'u', titulo: 't', descripcion: 'd', imagen: 'i', robots: 'noindex,follow', nucleo: 'x' })
  const sinNoindex = inyectarMeta(html, { url: 'u', titulo: 't', descripcion: 'd', imagen: 'i', robots: null, nucleo: 'x' })
  check('el noindex llega al documento', /<meta name="robots" content="noindex,follow"/.test(conNoindex))
  check('…y es FOLLOW: sus enlaces siguen valiendo', /noindex,follow/.test(conNoindex))
  check('…y no aparece cuando no toca', !/name="robots"/.test(sinNoindex))

  // La colección es otra cosa: doscientas cartas con su número y su
  // imagen no es una página escasa, y es por donde se llega a las
  // fichas. Esa sí se indexa.
  check('una colección con cartas se indexa', coleccionMereceIndexarse(SET, 60))
  check('…pero una vacía no', !coleccionMereceIndexarse(SET, 0))
  check('…ni una que no existe', !coleccionMereceIndexarse(null, 60))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La colección y el índice ──')
{
  const cartas = Array.from({ length: 9 }, (_, i) => ({
    id: `sv5-${i + 1}`, set_id: 'sv5', market: 'WEST', local_id: String(i + 1),
    name: `Carta ${i + 1}`, image_path: `sv/sv5/${i + 1}`, name_search: `carta ${i + 1}`,
  }))
  const { page, errores } = await abrir('/coleccion.html?set=sv5', cartas)
  check('la colección se abre sin errores', errores.length === 0, errores.join(' | '))
  check('con su nombre de h1', limpio(await page.locator('.coleccion-cabecera h1').textContent()) === 'Fuerzas Temporales')
  check('y su serie, su fecha y su cuenta',
    limpio(await page.locator('.coleccion-datos').textContent()) === 'Escarlata y Púrpura · 22 de marzo de 2024 · 162 cartas',
    await page.locator('.coleccion-datos').textContent())
  check('están las nueve cartas', (await page.locator('.coleccion-carta').count()) === 9)
  check('y cada una enlaza a su ficha con el nombre dentro',
    (await page.locator('.coleccion-carta').first().getAttribute('href')) === '/carta/carta-1-sv5-1',
    await page.locator('.coleccion-carta').first().getAttribute('href'))
  check('«ver más» no sale si no hay más',
    ((await page.locator('#verMas').getAttribute('class')) || '').includes('hidden'))
  await page.close()

  const { page: p2, errores: e2 } = await abrir('/cartas.html', cartas, [SET, { id: 'sv4', name: 'Destinos de Paldea', market: 'WEST', release_date: '2024-01-26' }])
  check('el índice se abre sin errores', e2.length === 0, e2.join(' | '))
  // Desde la 328 son filas de una lista agrupada por serie, no
  // tarjetas con logo: la mitad de las colecciones no tiene logo y una
  // rejilla de logos no deja comparar ni fecha ni tamaño.
  check('lista las colecciones', (await p2.locator('.serie-fila').count()) === 2)
  check('lo más nuevo primero',
    limpio(await p2.locator('.serie-nombre').first().textContent()) === 'Fuerzas Temporales')
  await p2.fill('#buscarCarta', 'carta 3')
  await p2.waitForTimeout(800)
  check('el buscador encuentra', (await p2.locator('#resultados .coleccion-carta').count()) === 1)
  check('…y aparta la lista de colecciones mientras busca',
    ((await p2.locator('#seccionColecciones').getAttribute('class')) || '').includes('hidden'))
  // Dos letras no buscan: con 23.000 cartas, «ch» devuelve ruido y una
  // consulta por cada tecla.
  await p2.fill('#buscarCarta', 'ca')
  await p2.waitForTimeout(700)
  check('con dos letras no busca', (await p2.locator('#resultados .coleccion-carta').count()) === 0)
  check('…y vuelven las colecciones',
    !((await p2.locator('#seccionColecciones').getAttribute('class')) || '').includes('hidden'))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. «/cartas» no es «/carta» ──')
{
  // La trampa de siempre, la misma que «/torneos» y «/torneo»: un
  // `startsWith('/carta')` se traga el índice entero y le pone las
  // etiquetas de una ficha que no existe.
  const fuente = readFileSync(`${RAIZ}/netlify/edge-functions/meta-social.js`, 'utf8')
  check('la ficha se reconoce por una ruta exacta o por barra',
    /\/\^\\\/carta\(\\\.html\)\?\$\/\.test\(ruta\) \|\| ruta\.startsWith\('\/carta\/'\)/.test(fuente),
    'el despachador no distingue /cartas de /carta')
  check('y la colección igual',
    /\/\^\\\/coleccion\(\\\.html\)\?\$\/\.test\(ruta\) \|\| ruta\.startsWith\('\/coleccion\/'\)/.test(fuente))

  // Y que el índice se sirva de verdad, que es lo que esa trampa rompía.
  const { page } = await abrir('/cartas.html')
  check('el índice tiene su propio h1',
    limpio(await page.locator('main h1').textContent()) === 'Cartas de Pokémon TCG',
    await page.locator('main h1').textContent())
  await page.close()

  // Las tres páginas van en el sitio y llevan su pie: son enlaces
  // internos y es lo que recorre Google (tanda 312).
  for (const f of ['carta.html', 'coleccion.html', 'cartas.html']) {
    const p = readFileSync(`${RAIZ}/${f}`, 'utf8')
    check(`${f} lleva el pie`, /class="pie-rejilla"/.test(p))
    // Absoluta: en /coleccion/tr una relativa pide /coleccion/css/… (327).
    check(`  …y su hoja propia, con ruta absoluta`, /href="\/css\/carta\.css"/.test(p))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. El hueco de cada imagen, reservado ──')
{
  // Una colección son doscientas imágenes: sin el hueco reservado la
  // lista entera baila mientras cargan.
  const rejilla = rejillaDeCartas([{ id: 'a-1', name: 'X', local_id: '1', image_path: 'a/b/1' }])
  check('la miniatura declara sus medidas', /width="245" height="337"/.test(rejilla), rejilla)
  const nucleo = nucleoDeCarta(CERULEDGE, SET)
  check('el escaneo grande también', /width="600" height="825"/.test(nucleo))
  check('la carta de arriba NO es diferida: es lo primero que se mira',
    /loading="eager"/.test(nucleo))
  check('y las de la rejilla sí', /loading="lazy"/.test(rejilla))
  // Sin imagen hay que dejar el hueco igual, o la página se encoge.
  check('sin imagen queda el hueco', /carta-scan-vacio/.test(nucleoDeCarta({ name: 'X' })))
  const cab = cabeceraDeColeccion(SET, 9)
  check('el logo del set no se inventa medidas', !/width="\d+" height="\d+"/.test(cab), cab)
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
