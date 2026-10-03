// Tanda 469 — un bolsillo sin escaneo no es un agujero negro.
//
// PINGU, dos veces: «cuando agregas una carta, mira cómo se queda en la
// lista: se queda negra, no sale la imagen. Y lo que debería salir es, en
// vez de estar así en gris la carta, que se ponga con color».
//
// Las dos cosas eran la misma. TCGdex no tiene escaneo de cientos de
// cartas —las viejas, y casi todas las de los catálogos que no son el
// inglés—, así que la cadena de respaldos se agota, el `onerror` quita el
// `<img>` y lo que queda es el nombre sobre el fondo del bolsillo: en el
// tema oscuro, un rectángulo negro. Y el de la carta que TIENES es el que
// peor sale, porque pierde la sombra interior del bolsillo vacío y gana el
// brillo del plástico encima.
//
// Y «ponerse con color» no se podía arreglar donde se intentó: la regla
// que lo hacía era `.tengo img { filter: none }`, que le quita el gris a
// una imagen… que no está.
//
// LA PRUEBA SIRVE LAS IMÁGENES CAÍDAS A PROPÓSITO. Es la lección de la
// 441: una captura con los datos a medias no es la pantalla, es OTRA
// pantalla — y aquí la pantalla que hay que mirar es justamente esa,
// porque en producción le pasa a cientos de cartas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const browser = await chromium.launch()

const abrir = async (tema = 'dark') => {
  const page = await browser.newPage({ viewport: { width: 414, height: 900 }, colorScheme: tema, hasTouch: true, isMobile: true })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // TODAS caídas: es lo que ve quien colecciona cartas viejas o japonesas.
  for (const d of ['**assets.tcgdex.net/**', '**limitlesstcg**', '**pokemontcg.io**']) {
    await page.route(d, (r) => r.fulfill({ status: 404, body: '' }))
  }
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Erika', serie_id: 'sv', market: 'WEST',
      card_count_official: 4, card_count_total: 4, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = ['Oddish de Erika', 'Gloom de Erika', 'Vileplume de Erika', 'Bellsprout de Erika']
      .map((n, i) => ({ id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
        name: n, name_es: n, image_path: 'x/' + (i + 1), rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = []
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=album', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(2200)
  return { page, errores }
}

console.log('\n── 1. Sin escaneo, el bolsillo sigue pareciendo una carta ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  // El <img> se quita solo al agotarse la cadena: es el caso, no un fallo.
  check('la cadena se ha agotado y no hay imagen',
    (await page.locator('.mc-album-rejilla img').count()) === 0,
    String(await page.locator('.mc-album-rejilla img').count()))
  const m = await page.locator('.mc-bolsillo').first().evaluate((n) => {
    const s = n.querySelector('.mc-carta-sinfoto')
    const cs = getComputedStyle(s)
    return { visible: s.getBoundingClientRect().height > 60, texto: s.textContent.trim().slice(0, 20), marco: cs.boxShadow !== 'none' }
  })
  check('  …y en su sitio está el nombre', m.visible && m.texto.length > 3, JSON.stringify(m))
  // El marco por dentro es lo que hace que un rectángulo parezca una carta
  // en vez de un hueco: sin él, una rejilla sin fotos es una pantalla rota.
  check('  …con el marco de una carta', m.marco, JSON.stringify(m))
  await page.close()
}

console.log('\n── 2. Y la que TIENES se pone con color ──')
{
  const { page } = await abrir()
  const antes = await page.locator('.mc-bolsillo').first().evaluate((n) => getComputedStyle(n.querySelector('.mc-carta-sinfoto')).backgroundImage)
  await page.locator('.mc-bolsillo [data-anadir]').first().click()
  await page.waitForTimeout(1500)
  const m = await page.locator('.mc-bolsillo').first().evaluate((n) => ({
    tengo: n.classList.contains('tengo'),
    fondo: getComputedStyle(n.querySelector('.mc-carta-sinfoto')).backgroundImage,
    // Y el nombre tiene que seguir leyéndose sobre el color nuevo.
    color: getComputedStyle(n.querySelector('.mc-carta-sinfoto')).color,
  }))
  check('al añadirla queda marcada como tuya', m.tengo)
  check('  …y el bolsillo cambia de color', m.fondo !== antes, `${antes.slice(0, 40)} → ${m.fondo.slice(0, 40)}`)
  // Lo que PINGU no podía ver y es el porqué: la regla que «ponía color»
  // era `.tengo img { filter: none }`, y aquí no hay ninguna imagen.
  check('  …aunque no haya ninguna imagen que descolorear',
    (await page.locator('.mc-bolsillo').first().locator('img').count()) === 0)
  await page.close()
}

console.log('\n── 3. En los dos temas ──')
for (const tema of ['dark', 'light']) {
  const { page } = await abrir(tema)
  await page.locator('.mc-bolsillo [data-anadir]').first().click()
  await page.waitForTimeout(1500)
  const m = await page.locator('.mc-bolsillo').first().evaluate((n) => {
    const s = n.querySelector('.mc-carta-sinfoto')
    const cs = getComputedStyle(s)
    // DOS FORMAS, y por eso no vale un `match` de dígitos: un
    // `color-mix` se calcula como `color(srgb 0.10 0.19 0.22)` —de 0 a 1 y
    // con decimales—, y leerlo con /\d+/ daba 10, 19 y 22 sobre 255. La
    // cuenta salía, pero salía 1.258.971, o sea que la prueba pasaba por
    // un número inventado. Un verde que no se puede explicar no es un
    // verde (la lección de las mutaciones que no cambian nada).
    const rgb = (c) => {
      const n = c.match(/-?[\d.]+/g).slice(0, 3).map(Number)
      return c.startsWith('color(') ? n.map((v) => v * 255) : n
    }
    const lum = (c) => {
      const [r, g, b] = rgb(c).map((v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    // Contra el fondo SÓLIDO de debajo del degradado, que es lo que hay
    // detrás de la letra en el peor caso.
    const fondo = cs.backgroundColor
    const a = lum(cs.color)
    const b = lum(fondo)
    const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    return { contraste: Math.round(contraste * 10) / 10, color: cs.color, fondo }
  })
  // 4,5 es lo que pide la WCAG para texto normal, y este es el único dato
  // que queda cuando no hay foto: tiene que leerse.
  check(`en ${tema} el nombre se lee sobre el color`, m.contraste >= 4.5, JSON.stringify(m))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
