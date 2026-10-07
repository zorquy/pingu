// Tanda 653 — el Panel de /mi-coleccion, más prieto y con la gráfica
// más visual.
//
// PINGU, con la gráfica de TCGGO delante: «me gustaría aplicar algo así
// más colorido en lo de mi colección… tiene demasiado espacio todo y es
// muy grande… el texto que hay abajo en el gráfico… todo eso lo
// quitaría».
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const { graficaHtml, RANGOS } = await import(`${RAIZ}/js/mi-coleccion/grafica-valor.js`)

const dia = (hace, valor) => ({ dia: new Date(Date.now() - hace * 86400000).toISOString().slice(0, 10), valor, copias: 4, sin_precio: 0 })
const serie = (n, f) => Array.from({ length: n }, (_, i) => dia(n - 1 - i, f(i)))

console.log('── 1. La gráfica, en puro ──')
{
  const sube = graficaHtml(serie(40, (i) => 100 + i), { ahora: 139 })
  const baja = graficaHtml(serie(40, (i) => 200 - i), { ahora: 161 })
  check('el lienzo lleva el tono del tramo: sube', /class="mc-valor-lienzo sube"/.test(sube))
  check('  …y baja', /class="mc-valor-lienzo baja"/.test(baja))
  check('hay tres rayas con su cifra (máximo, medio, mínimo)', (sube.match(/mc-valor-raya/g) || []).length === 3 && (sube.match(/<span style="--py:/g) || []).length === 3)
  // Con todos los días iguales, tres rótulos dirían tres veces lo mismo.
  const plana = graficaHtml(serie(10, () => 50), { ahora: 50 })
  check('  …y una sola si la línea es plana', (plana.match(/mc-valor-raya/g) || []).length === 1, String((plana.match(/mc-valor-raya/g) || []).length))
  check('las fechas de los extremos van debajo', /class="mc-valor-fechas"/.test(sube) && (sube.match(/mc-valor-fechas[^]*?<\/div>/)[0].match(/<span>/g) || []).length === 3)
  check('  …y con un tramo corto, solo dos', (graficaHtml(serie(3, (i) => 10 + i)).match(/mc-valor-fechas[^]*?<\/div>/)[0].match(/<span>/g) || []).length === 2)
  check('la marca del último día es HTML (un círculo del SVG saldría ovalado)', /<span class="mc-valor-punto" style="--px:[\d.]+%;--py:[\d.]+%"/.test(sube) && !/<circle/.test(sube))
  // Los chips de 7 y 30 días son lecturas FIJAS: no dependen del rango.
  const chips = (h) => (h.match(/mc-valor-chip (sube|baja|igual)">([^<]+)<b>([^<]+)<\/b>/g) || [])
  check('hay chips de 7 y 30 días', chips(sube).length === 2 && /7 d/.test(chips(sube)[0]) && /30 d/.test(chips(sube)[1]), chips(sube).join(' | '))
  check('  …con su signo y su porcentaje', /\+5,3 %/.test(chips(sube)[0]) && /\+27,5 %/.test(chips(sube)[1]), chips(sube).join(' | '))
  check('  …y los mismos con 1D puesto', chips(graficaHtml(serie(40, (i) => 100 + i), { ahora: 139, rango: '1D' })).join() === chips(sube).join())
  check('  …y con solo tres días no sale ninguno: no cubren sus días', chips(graficaHtml(serie(3, (i) => 10 + i))).length === 0, chips(graficaHtml(serie(3, (i) => 10 + i))).join(' | '))
  check('  …y con ocho, solo el de 7', chips(graficaHtml(serie(8, (i) => 10 + i))).length === 1 && /7 d/.test(chips(graficaHtml(serie(8, (i) => 10 + i)))[0]), chips(graficaHtml(serie(8, (i) => 10 + i))).join(' | '))
  // Los puntos para la lectura al pasar el dedo.
  const puntos = JSON.parse(sube.match(/data-puntos="([^"]+)"/)[1].replace(/&quot;/g, '"'))
  check('los puntos de lectura son los días dibujados', puntos.length === 40 && puntos[39][1] === 139 && puntos[0][2] === 0 && puntos[39][2] < 100, JSON.stringify(puntos.slice(-1)))
  check('  …y hay sitio para el globo', /class="mc-valor-lectura" hidden/.test(sube))
  // El punto solo: sin párrafo debajo.
  const solo = graficaHtml([dia(0, 100)])
  check('con un punto, nada que leer debajo', !/subtext/.test(solo) && /mc-valor-un-punto/.test(solo) && /mc-valor-punto/.test(solo))
  check('nada de esto rompe los rangos', RANGOS.length === 6 && (sube.match(/data-rango="/g) || []).length === 6)
}

console.log('\n── 2. La hoja ──')
{
  const css = readFileSync(`${RAIZ}/css/mi-coleccion.css`, 'utf8')
  check('el tono es una propiedad del lienzo y cambia con la tendencia', /\.mc-valor-lienzo\.sube \{\s*--valor-tono: var\(--success\)/.test(css) && /\.mc-valor-lienzo\.baja \{\s*--valor-tono: var\(--danger\)/.test(css))
  check('  …y la línea, el relleno y la marca lo usan', /\.mc-valor-linea \{[^}]*stroke: var\(--valor-tono\)/.test(css) && /\.mc-valor-arriba \{[^}]*stop-color: var\(--valor-tono\)/.test(css) && /\.mc-valor-punto \{[^}]*background: var\(--valor-tono\)/.test(css))
  check('la nota vacía de la cabecera no ocupa', /\.mc-nota:empty \{\s*display: none/.test(css))
  check('la gráfica de un punto mide la mitad', /\.mc-valor-un-punto \{\s*height: 96px/.test(css))
}

const browser = await chromium.launch()
const semilla = ({ valor }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681 }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 139, cm_low_es: 139, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
  window.__FAKE_VALOR__ = valor || []
}
async function abrir({ ancho = 1200, valor = null } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla, { valor })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

console.log('\n── 3. En pantalla: la lectura al pasar el dedo ──')
{
  const { page, errores } = await abrir({ valor: serie(30, (i) => 100 + i * 2) })
  const lienzo = page.locator('.mc-valor-lienzo')
  check('la gráfica sube en verde', (await lienzo.getAttribute('class')) === 'mc-valor-lienzo sube')
  const tono = await lienzo.evaluate((n) => getComputedStyle(n).getPropertyValue('--valor-tono').trim())
  const verde = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--success').trim())
  check('  …con el verde de la casa', tono === `var(--success)` || tono === verde, `${tono} vs ${verde}`)
  const linea = await page.locator('.mc-valor-linea').evaluate((n) => getComputedStyle(n).stroke)
  const marca = await page.locator('.mc-valor-punto').evaluate((n) => getComputedStyle(n).backgroundColor)
  check('  …en la línea y en la marca', linea === marca && linea !== 'none', `${linea} / ${marca}`)
  check('la lectura empieza escondida', await page.locator('.mc-valor-lectura').isHidden())
  const b = await lienzo.boundingBox()
  await page.mouse.move(b.x + b.width * 0.43, b.y + b.height * 0.5)
  await page.waitForTimeout(150)
  const globo = limpio(await page.locator('.mc-valor-lectura-globo').textContent())
  check('al pasar el ratón sale el globo con el día y lo que valía', await page.locator('.mc-valor-lectura').isVisible() && /€/.test(globo), globo)
  // En la cartera del Panel (748) la línea va de borde a borde (acaba en
  // el 98,3 %): el 43 % del lienzo es el punto 13 de 30, 100 + 13 × 2.
  check('  …y es el punto más cercano, no el primero', /126,00 €/.test(globo), globo)
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.5)
  await page.waitForTimeout(100)
  check('  …y cambia al moverse', !/126,00 €/.test(limpio(await page.locator('.mc-valor-lectura-globo').textContent())))
  check('  …pegado a la izquierda del punto cuando está a la derecha', await page.locator('.mc-valor-lectura.a-la-izquierda').count() === 1)
  await page.mouse.move(10, 10)
  await page.waitForTimeout(100)
  check('al salir se esconde', await page.locator('.mc-valor-lectura').isHidden())
  // La rejilla con sus cifras sigue en el módulo (la sección 1), pero la
  // cartera de su maqueta (748) va limpia: lo exacto lo dice el globo.
  check('la cartera va sin rejilla', (await page.locator('#mcValorCaja .mc-valor-rotulos, #mcValorCaja .mc-valor-raya').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. En pantalla: más prieto ──')
{
  const { page, errores } = await abrir()
  // Desde la 748, en el Panel de tu colección la cabecera no ocupa nada:
  // manda la cartera, con lo que vale ARRIBA del todo.
  const hero = await page.locator('#mcHero').evaluate((n) => n.getBoundingClientRect().height)
  const cifra = await page.locator('#mcValorCaja .mc-cartera-cifra').boundingBox()
  check('la cabecera no ocupa y lo que vale va arriba', hero === 0 && cifra && cifra.y < 160, JSON.stringify({ hero, cifra }))
  check('la nota vacía no ocupa', await page.locator('#mcResumenNota').evaluate((n) => n.textContent === '' && getComputedStyle(n).display === 'none'))
  const grafica = await page.locator('.mc-valor-un-punto').evaluate((n) => n.getBoundingClientRect().height)
  // En la cartera (748) mide lo que su hueco, 128: así no salta al llegar.
  check('con un punto, la gráfica mide lo que su hueco', grafica === 128, String(grafica))
  check('  …y no hay párrafo debajo', (await page.locator('#mcValorCaja p.subtext').count()) === 0)
  const huecos = await page.locator('#mcVistazos').evaluate((n) => getComputedStyle(n).gap)
  check('los vistazos van a un paso menos', huecos === '24px', huecos)
  // Lo que se pulsa sigue midiendo 44 (las losetas son más bajas, no más
  // pequeñas que la regla).
  const loseta = await page.locator('.mc-accion-loseta').first().boundingBox()
  check('las losetas siguen pulsables', loseta.height >= 44 && loseta.height <= 88, String(loseta.height))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
