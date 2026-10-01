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
  // Solo las que tienen MÁS DE UNA versión llevan tira.
  check('solo dos bolsillos tienen versiones', (await page.locator('.mc-variantes').count()) === 2,
    String(await page.locator('.mc-variantes').count()))
  check('  …y son las que las tienen',
    (await page.locator('.mc-variante[data-carta="sv1-1"]').count()) === 2 &&
      (await page.locator('.mc-variante[data-carta="sv1-4"]').count()) === 4 &&
      (await page.locator('.mc-variante[data-carta="sv1-2"]').count()) === 0)

  const chip = () => page.locator('.mc-variante[data-carta="sv1-1"][data-variante="reverse"]')
  check('empieza sin marcar', (await chip().getAttribute('aria-pressed')) === 'false')
  await chip().click()
  await page.waitForTimeout(900)
  check('al pulsarla se marca', (await chip().getAttribute('aria-pressed')) === 'true')
  check('  …y el bolsillo cuenta una copia',
    (await page.locator('.mc-bolsillo').first().locator('.mc-bolsillo-cuenta').textContent()) === '1')
  // La OTRA versión de la misma carta sigue sin marcar: esa es toda la
  // idea. Si marcar reverse marcara también normal, no serviría de nada.
  check('  …pero la normal sigue sin marcar',
    (await page.locator('.mc-variante[data-carta="sv1-1"][data-variante="normal"]').getAttribute('aria-pressed')) === 'false')

  // Y el progreso del álbum NO se mueve por versiones: un bolsillo lo
  // llena cualquiera de ellas.
  // Desde la 398 son TRES barras; la de «completo» es la que cuenta
  // bolsillos, que es lo que mira esta comprobación.
  check('el progreso cuenta bolsillos, no versiones',
    /Set completo 1 de 4/.test(limpio(await page.locator('#mcAlbumProgreso').textContent())),
    limpio(await page.locator('#mcAlbumProgreso').textContent()))

  await chip().click()
  await page.waitForTimeout(900)
  check('y al volver a pulsarla se desmarca', (await chip().getAttribute('aria-pressed')) === 'false')
  check('  …y el bolsillo vuelve a cero',
    (await page.locator('.mc-bolsillo').first().locator('.mc-bolsillo-cuenta').textContent()) === '0')
  await page.close()
}

console.log('\n── 3. La tira no se come el bolsillo ──')
{
  const { page } = await abrir()
  const m = await page.evaluate(() => {
    const b = document.querySelector('.mc-bolsillo').getBoundingClientRect()
    const v = document.querySelector('.mc-variantes').getBoundingClientRect()
    const mando = document.querySelector('.mc-bolsillo-mando').getBoundingClientRect()
    return { bolsillo: Math.round(b.height), tira: Math.round(v.height),
             seTocan: v.bottom > mando.top }
  })
  // `.mc-variantes` comparte clase con el mando, que va pegado ABAJO:
  // sin `bottom: auto` la tira se estiraría de borde a borde y taparía
  // la carta entera.
  check('la tira ocupa una franja, no el bolsillo', m.tira < m.bolsillo / 3, JSON.stringify(m))
  check('  …y no se pisa con el mando de copias', !m.seTocan, JSON.stringify(m))
  await page.close()
}

console.log('\n── 4. Con el dedo, 44 px ──')
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
  const alto = await page.locator('.mc-variante').first().evaluate((e) => Math.round(e.getBoundingClientRect().height))
  check('con el dedo miden 44 de alto', alto >= 44, `${alto}px`)
  // El ANCHO no se le pide: son dos en una fila que ya se reparte el
  // bolsillo, y estirarlas sacaría la fila fuera (regla de la 312).
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('  …y nada se sale de la pantalla', !desborda)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
