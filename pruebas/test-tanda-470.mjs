// Tanda 470 — la carta que tienes se veía en negro, y la culpa era de
// `position`.
//
// PINGU, TRES veces: «cuando agregas una carta, mira cómo se queda en la
// lista: se queda negra, no sale la imagen. Yo quiero la carta con color,
// simplemente».
//
// Y no era la imagen. La imagen estaba: cargada, a tamaño completo y con
// opacidad 1. Lo que pasaba es que **se pintaba DEBAJO del nombre**.
//
// El nombre (`.mc-carta-sinfoto`) va a `position: absolute`, y un elemento
// POSICIONADO se pinta por encima del contenido en flujo. La imagen no
// estaba posicionada… pero las de las cartas que NO tienes llevan
// `opacity: 0.55` y un `filter`, y las dos cosas **crean un contexto de
// apilamiento**: eso las promociona a la capa de los posicionados y, por
// orden de DOM, quedan encima del nombre.
//
// O sea que la regla que pone la carta EN COLOR —`.tengo img { filter:
// none; opacity: 1 }`— era justamente la que la escondía. Por eso solo
// pasaba con las que TIENES, que es como lo describía PINGU, y por eso yo
// no lo encontré mirando: en una rejilla, las que no tienes salen bien.
//
// La 441 arregló esto mismo en `.mc-carta-foto img`. Es la lección de los
// DOS PINTADORES DE BOLSILLO (la 458) otra vez.
//
// LA PRUEBA ES UN HIT-TEST, no una comprobación de clases: lo que hay que
// saber es qué se PINTA encima, y eso no se deduce leyendo el CSS — fue
// justo lo que no vi tres veces.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const browser = await chromium.launch()
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

// Qué elemento se pinta en el centro de cada bolsillo. Los dos candidatos
// llevan `pointer-events: none` o son adornos, así que se les devuelve el
// puntero a mano: `elementFromPoint` salta lo que no lo recibe, y sin esto
// contestaría siempre el enlace de debajo.
const quienManda = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((n) => {
  const r = n.getBoundingClientRect()
  // La barra flotante de pestanias vive pegada abajo y la de arriba
  // tambien flota: un bolsillo que caiga debajo de cualquiera de las dos
  // contesta «la barra», que es cierto y no dice nada de lo que se
  // prueba. Se miran los que estan de verdad a la vista.
  if (r.bottom > innerHeight - 150 || r.top < 60) return null
  const s = n.querySelector('.mc-carta-sinfoto')
  const img = n.querySelector('img')
  if (!s) return { q: '?', sin: true }
  const a1 = s.style.pointerEvents
  const a2 = img ? img.style.pointerEvents : null
  s.style.pointerEvents = 'auto'
  if (img) img.style.pointerEvents = 'auto'
  const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  s.style.pointerEvents = a1
  if (img) img.style.pointerEvents = a2
  return {
    q: s.textContent.trim().slice(0, 12),
    mia: n.classList.contains('tengo') || n.classList.contains('mc-carta') ? n.classList.contains('tengo') : false,
    hayFoto: Boolean(img && img.naturalWidth),
    encima: e ? e.tagName : null,
  }
}).filter(Boolean), sel)

const abrir = async (tema = 'dark') => {
  const page = await browser.newPage({ viewport: { width: 414, height: 900 }, colorScheme: tema })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // La 2 SIN escaneo y las demás con él: la mezcla de verdad de un set
  // viejo o japonés. Y la carta de mentira es OPACA y con la proporción
  // real (la lección de la 441): con una medio transparente, el fondo del
  // bolsillo se ve a través y una captura no distingue las dos cosas.
  await page.route('**assets.tcgdex.net/**', (r) =>
    /\/x\/2\//.test(r.request().url())
      ? r.fulfill({ status: 404, body: '' })
      : r.fulfill({ path: SC + '/visual/carta-real.png', contentType: 'image/png' }))
  for (const d of ['**limitlesstcg**', '**pokemontcg.io**']) await page.route(d, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Neo', serie_id: 'sv', market: 'WEST',
      card_count_official: 4, card_count_total: 4, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = ['Ariados', 'Shaymin', 'Spinarak', 'Celebi'].map((n, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: n, name_es: n,
      image_path: 'x/' + (i + 1), rarity: 'Rare', category: 'Pokemon', variants: { normal: true, reverse: true },
    }))
    // La 1 TUYA y con foto —el caso que fallaba—, la 2 tuya y sin foto.
    window.__FAKE_COLECCION__ = [
      { id: 'a', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() },
      { id: 'c', card_id: 'sv8-2', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() },
    ]
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=album', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('\n── 1. La foto se pinta ENCIMA del nombre, la tengas o no ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await quienManda(page, '.mc-album-rejilla .mc-bolsillo')
  const conFoto = b.filter((x) => x.hayFoto)
  check('hay bolsillos con foto que mirar', conFoto.length >= 1, JSON.stringify(b))
  const tapados = conFoto.filter((x) => x.encima !== 'IMG')
  check('en ninguno con foto manda otra cosa que la IMAGEN', tapados.length === 0, JSON.stringify(tapados))
  // Y EL CASO QUE FALLABA, dicho con su nombre: la que TIENES y tiene foto.
  const mia = conFoto.find((x) => x.mia)
  check('  …incluida la que TIENES, que es la que fallaba', mia && mia.encima === 'IMG', JSON.stringify(mia))
  await page.close()
}

console.log('\n── 2. Y sin foto sigue mandando el nombre ──')
{
  // El otro lado de la misma pareja: si la imagen se quitó por agotarse la
  // cadena, lo que tiene que verse es el nombre. Sin esta mitad, «poner la
  // imagen siempre encima» también pasaría… con el bolsillo en blanco.
  const { page } = await abrir()
  const b = await quienManda(page, '.mc-album-rejilla .mc-bolsillo')
  const sinFoto = b.filter((x) => !x.hayFoto)
  check('hay bolsillos sin foto que mirar', sinFoto.length >= 1, JSON.stringify(b))
  check('en ellos manda el nombre', sinFoto.every((x) => x.encima === 'SPAN' || x.encima === 'svg'), JSON.stringify(sinFoto))
  await page.close()
}

console.log('\n── 3. Lo mismo en «Cartas», que es el otro pintador ──')
{
  // La 441 arregló este y dejó el otro: son DOS pintadores de bolsillo, y
  // arreglar uno deja el otro con el fallo sin que se note.
  const { page } = await abrir()
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(900)
  await page.locator('[data-ir-a="cartas"]').click()
  await page.waitForTimeout(1500)
  const b = await quienManda(page, '#mcCartas .mc-carta-foto')
  const conFoto = b.filter((x) => x.hayFoto)
  check('hay cartas con foto', conFoto.length >= 1, JSON.stringify(b))
  check('  …y manda la imagen', conFoto.every((x) => x.encima === 'IMG'), JSON.stringify(conFoto))
  await page.close()
}

console.log('\n── 4. En los dos temas ──')
for (const tema of ['dark', 'light']) {
  const { page } = await abrir(tema)
  const b = await quienManda(page, '.mc-album-rejilla .mc-bolsillo')
  const conFoto = b.filter((x) => x.hayFoto)
  const mal = conFoto.filter((x) => x.encima !== 'IMG')
  // Con el guardia delante: «ninguna tapada» sobre CERO fotos es cierto y
  // no dice nada, que es la trampa de la 307 — de una pantalla de la que
  // no recoges nada no puedes decir que este bien.
  check(`en ${tema} hay fotos que mirar`, conFoto.length >= 1, JSON.stringify(b))
  check(`  ...y ninguna queda tapada`, mal.length === 0, JSON.stringify(mal))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
