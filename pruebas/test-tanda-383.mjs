// Tanda 383 — cada versión de una carta, por su lado.
//
// Lo tercero de la lista de PINGU. Y no hace falta preguntarle nada a
// nadie: TCGdex trae `card.variants` y el curador ya lo guarda en
// `tcg_cards.variants` desde la tanda 330.
//
// Lo que esta prueba mira y no supone:
//   · Que se enseñan las versiones que EXISTEN de esa carta, no las
//     cuatro siempre. Ofrecer «1.ª edición» en una carta de 2024 invita
//     a apuntar algo que no se ha impreso nunca.
//   · Que lo que NO se sabe no se inventa: sin `variants` (la carta no
//     se ha engordado) se enseña una sola versión, como antes.
//   · Que el progreso del álbum NO cambia: un bolsillo lo llena
//     cualquier versión.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('\n── 1. Qué versiones tiene una carta ──')
{
  const { variantesDeCarta, tieneVarias, nombreDeVariante } =
    await import('/home/user/pingu/js/mi-coleccion/variantes.js')
  const cortos = (v) => variantesDeCarta({ variants: v }).map((x) => x.corto).join('+')

  check('una común de hoy: normal y reverse',
    cortos({ normal: true, reverse: true, holo: false, firstEdition: false }) === 'N+RH',
    cortos({ normal: true, reverse: true }))
  check('una ultra rara: solo holo',
    cortos({ normal: false, reverse: false, holo: true }) === 'H', cortos({ holo: true }))
  check('una de 1999: normal y primera',
    cortos({ normal: true, firstEdition: true }) === 'N+1.ª', cortos({ normal: true, firstEdition: true }))

  // Lo que NO se sabe no se inventa: sin `variants` se enseña una sola,
  // que es lo que hacía la pantalla antes de esta tanda. Un hueco no
  // puede convertirse en «esta carta solo existe en normal».
  check('sin datos, una sola y la normal', cortos(null) === 'N' && cortos(undefined) === 'N')
  check('  …y con todas a false, igual', cortos({ normal: false, reverse: false }) === 'N')

  // `wPromo` se deja fuera a propósito: es un SELLO impreso, no una
  // versión que se coleccione aparte.
  check('el sello de promo no es una versión',
    cortos({ normal: true, wPromo: true }) === 'N', cortos({ normal: true, wPromo: true }))

  check('con una sola no merece selector', tieneVarias({ variants: { holo: true } }) === false)
  check('  …y con dos sí', tieneVarias({ variants: { normal: true, reverse: true } }) === true)
  check('los nombres largos están', nombreDeVariante('reverse') === 'Reverse holo' &&
    nombreDeVariante('primera') === '1.ª edición' && nombreDeVariante('loquesea') === 'Normal')
}

console.log('\n── 2. En el bolsillo ──')
const browser = await chromium.launch()
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e9ce6a"/></svg>'

async function abrir(viewport = { width: 1280, height: 1200 }) {
  const page = await browser.newPage({ viewport })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 220)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST', serie_id: 'sv', serie_name: 'SV', card_count_official: 4, card_count_total: 4, release_date: '2023-03-31' }]
    const c = (n, variants) => ({
      id: `sv1-${n}`, set_id: 'sv1', local_id: String(n).padStart(3, '0'), name: `C${n}`, name_es: `C${n}`,
      image_path: `x/${n}`, market: 'WEST', variants,
    })
    window.__FAKE_CARTAS__ = [
      c(1, { normal: true, reverse: true }),
      c(2, { holo: true }),
      c(3, null),
      c(4, { normal: true, reverse: true, holo: true, firstEdition: true }),
    ]
    window.__FAKE_COLECCION__ = []
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  return { page, errores }
}

{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  // LAS VERSIONES YA NO VAN EN LA CASILLA (tanda 565): se eligen en la
  // ficha, en un desplegable, como en Dex. Lo que esta prueba mira sigue
  // siendo lo mismo —que se ofrecen las que EXISTEN de esa carta—, pero
  // donde se ofrecen ahora.
  check('ninguna casilla lleva botones de versión', (await page.locator('.mc-variante, .mc-variantes').count()) === 0)
  const abrirFicha = async (id) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.locator(`.mc-bolsillo-enlace[data-carta="${id}"]`).click()
    await page.waitForTimeout(900)
    return page.$$eval('#mcEdAnadirVariante option', (os) => os.map((o) => o.value))
  }
  check('una común de hoy ofrece normal y reverse', (await abrirFicha('sv1-1')).join(',') === 'normal,reverse')
  check('  …y el desplegable se ve', (await page.isVisible('#mcEdAnadirVariante')) === true)
  check('una ultra rara no ofrece nada que elegir', (await abrirFicha('sv1-2')).join(',') === 'holo')
  check('  …y el desplegable se esconde', (await page.isVisible('#mcEdAnadirVariante')) === false)
  check('una de la que no se sabe ofrece las cuatro', (await abrirFicha('sv1-3')).length === 4)
  check('y la que las tiene todas, las cuatro', (await abrirFicha('sv1-4')).length === 4)

  // Elegir reverse y añadir guarda REVERSE, no la primera opción: esa es
  // toda la idea. Si marcar reverse marcara la normal, no serviría de nada.
  await abrirFicha('sv1-1')
  await page.selectOption('#mcEdAnadirVariante', 'reverse')
  await page.locator('#mcEdAnadirVersiones button').click()
  await page.waitForTimeout(1200)
  check('al añadir en reverse, la línea es reverse', (await page.inputValue('#mcEdVariante')) === 'reverse', await page.inputValue('#mcEdVariante'))
  check('  …y el bolsillo pasa a «la tengo»', (await page.locator('.mc-bolsillo').first().getAttribute('class'))?.includes('tengo'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  // Y el progreso del álbum NO se mueve por versiones: un bolsillo lo
  // llena cualquiera de ellas. «Conjunto completo» desde la 417.
  check('el progreso cuenta bolsillos, no versiones',
    /Conjunto completo 1 de 4/.test(limpio(await page.locator('#mcAlbumProgreso').textContent())),
    limpio(await page.locator('#mcAlbumProgreso').textContent()))
  await page.close()
}

console.log('\n── 3. La casilla es la carta ──')
{
  // Sin botones dentro, la carta ocupa la casilla entera: era lo que la
  // tira y el mando se comían (dos filas de 44 px en 154).
  const { page } = await abrir()
  const m = await page.evaluate(() => {
    const b = document.querySelector('.mc-bolsillo').getBoundingClientRect()
    const e = document.querySelector('.mc-bolsillo .mc-bolsillo-enlace').getBoundingClientRect()
    return { bolsillo: Math.round(b.height), enlace: Math.round(e.height) }
  })
  check('el enlace ocupa el bolsillo entero', m.enlace >= m.bolsillo - 2, JSON.stringify(m))
  await page.close()
}

console.log('\n── 4. Con el dedo, nada se sale ──')
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true })
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST', card_count_official: 2, card_count_total: 2, release_date: '2023-03-31' }]
    window.__FAKE_CARTAS__ = [1, 2].map((n) => ({
      id: `sv1-${n}`, set_id: 'sv1', local_id: String(n), name: `C${n}`, name_es: `C${n}`,
      image_path: `x/${n}`, market: 'WEST', variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = []
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  const alto = await page.locator('.mc-bolsillo-enlace').first().evaluate((e) => Math.round(e.getBoundingClientRect().height))
  check('la casilla entera se pulsa y mide de sobra', alto >= 44, `${alto}px`)
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('  …y nada se sale de la pantalla', !desborda)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
