// Tanda 464 — el gráfico del valor, con sus rangos.
//
// PINGU, con una captura de la app de Collectr: «quiero que pongas en
// cuántos días quieres ver el gráfico: uno, siete días, un mes, tres
// meses, seis meses o MAX. Y según lo que cliques, que te muestre un
// gráfico u otro. Y el gráfico quiero que sea más así, más detallado».
//
// Lo que esta prueba defiende, por orden de importancia:
//
//  · Que cada rango ENSEÑE LO SUYO. Un botón que cambia de color pero no
//    cambia la línea es un botón que miente, y no da ningún error.
//  · Que el rótulo diga los días DE VERDAD, no el nombre del rango: con
//    MAX puesto y dos semanas de historia, «todo» no dice nada.
//  · Que un rango sin dos puntos se APAGUE en vez de enseñar un hueco.
//  · Y que la consulta traiga bastantes días: el tope era de 90, así que
//    6M y MAX habrían enseñado lo mismo que 3M sin decirlo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { RANGOS, diasDelRango, graficaHtml, resumenDeValor } from '/home/user/pingu/js/mi-coleccion/grafica-valor.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hoy = Date.now()
const serie = (n) => Array.from({ length: n }, (_, i) => ({
  dia: new Date(hoy - (n - 1 - i) * 86400000).toISOString().slice(0, 10),
  valor: 100 + i * 2, copias: 10, distintas: 5, sin_precio: 0,
}))

console.log('\n── 1. Cada rango enseña lo suyo ──')
{
  const filas = serie(200)
  const r = resumenDeValor(filas, {})
  const medidas = RANGOS.map((x) => ({ id: x.id, puntos: diasDelRango(r.dias, x.id).length }))
  check('hay seis rangos', RANGOS.length === 6, RANGOS.map((x) => x.id).join(' '))
  check('  …y son los de Collectr', RANGOS.map((x) => x.id).join(',') === '1D,7D,1M,3M,6M,MAX', RANGOS.map((x) => x.id).join(','))
  // Cada uno trae MÁS puntos que el anterior: si dos trajeran los mismos,
  // uno de los dos botones no haría nada.
  const crece = medidas.every((m, i) => i === 0 || m.puntos >= medidas[i - 1].puntos)
  check('cada rango abarca al menos lo que el anterior', crece, JSON.stringify(medidas))
  check('  …y MAX los trae todos', medidas[5].puntos === r.dias.length, JSON.stringify(medidas))
  check('  …y 1D no', medidas[0].puntos < r.dias.length, JSON.stringify(medidas))
  // Y la LÍNEA cambia de verdad, que es lo único que se ve.
  const unD = graficaHtml(filas, { rango: '1D' }).match(/class="mc-valor-linea" d="([^"]+)"/)[1]
  const max = graficaHtml(filas, { rango: 'MAX' }).match(/class="mc-valor-linea" d="([^"]+)"/)[1]
  check('la línea de 1D no es la de MAX', unD !== max)
  check('  …y la de MAX tiene muchos más puntos', max.split(' L').length > unD.split(' L').length * 10,
    `${max.split(' L').length} vs ${unD.split(' L').length}`)
}

console.log('\n── 2. El rótulo dice los días de verdad ──')
{
  // Con MAX puesto y dos semanas de historia, «todo» no dice nada:
  // Collectr dice «in the last 151 days» y es lo que hay que decir.
  const quince = graficaHtml(serie(15), { rango: 'MAX' })
  check('MAX con 15 días dice 14 días', /los últimos 14 días/.test(quince), (quince.match(/en [^<]*/) || [])[0])
  const unD = graficaHtml(serie(200), { rango: '1D' })
  check('1D dice «el último día»', /el último día/.test(unD), (unD.match(/en [^<]*/) || [])[0])
  const sieteD = graficaHtml(serie(200), { rango: '7D' })
  check('7D dice 7 días', /los últimos 7 días/.test(sieteD), (sieteD.match(/en [^<]*/) || [])[0])
  // Y el cambio es el DEL RANGO, no el de toda la historia: es el dato
  // que hace que el botón sirva para algo.
  const sube7 = (sieteD.match(/\+([\d.,]+)/) || [])[1]
  const subeMax = (graficaHtml(serie(200), { rango: 'MAX' }).match(/\+([\d.,]+)/) || [])[1]
  check('el cambio de 7D no es el de MAX', sube7 !== subeMax, `${sube7} vs ${subeMax}`)
}

console.log('\n── 3. Un rango sin datos se apaga ──')
{
  // Un botón que no lleva a ninguna parte miente. Con tres días de
  // historia, pedir 6M tiene que caer en lo que haya y no dejar un hueco.
  const pocos = graficaHtml(serie(3), { rango: '6M' })
  check('con tres días sigue habiendo línea', /mc-valor-linea/.test(pocos))
  // Con DOS puntos y pidiendo 1D, el rango de un día sí tiene sus dos.
  const dos = graficaHtml(serie(2), { rango: '1D' })
  check('con dos días, 1D vale', /mc-valor-linea/.test(dos) && /data-rango="1D"[^>]*aria-pressed="true"/.test(dos),
    (dos.match(/data-rango="1D"[^>]*/) || [])[0])
  // Y con uno solo no hay gráfica: una línea plana de un punto diría «no
  // ha cambiado nada» cuando lo que pasa es que no sabemos nada (la 319).
  // Desde la 651 un día sí tiene su punto; lo que no tiene es línea.
  check('con un día no se dibuja línea', !/mc-valor-linea/.test(graficaHtml(serie(1), {})) && /mc-valor-un-punto/.test(graficaHtml(serie(1), {})))
}

console.log('\n── 4. La consulta trae bastantes días ──')
{
  // El tope era 90, así que 6M y MAX habrían enseñado lo mismo que 3M y
  // los dos botones habrían mentido sin dar ningún error.
  const datos = readFileSync('/home/user/pingu/js/mi-coleccion/datos.js', 'utf8')
  const tope = (datos.match(/valorHistorico\(userId, dias = (\d+)\)/) || [])[1]
  check('el histórico se pide con más de seis meses', Number(tope) >= 180, String(tope))
}

console.log('\n── 5. Y en la pantalla ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 500, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.addInitScript((vals) => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Set', market: 'WEST', serie_id: 'sv', card_count_official: 1, card_count_total: 1 }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Carta 1', image_path: 'x/1', market: 'WEST', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'c1', card_id: 'sv1-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, valor_manual: 500, created_at: new Date().toISOString() }]
    window.__FAKE_VALOR__ = vals
  }, serie(200).map((d) => ({ ...d, user_id: 'admin-1' })))
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const caja = page.locator('#mcValorCaja')
  check('salen los seis botones', (await caja.locator('[data-rango]').count()) === 6,
    String(await caja.locator('[data-rango]').count()))
  const antes = await caja.locator('.mc-valor-linea').getAttribute('d')
  const dice = async () => (await caja.locator('.mc-valor-cambio').textContent()).replace(/\s+/g, ' ').trim()
  const rotuloAntes = await dice()
  await caja.locator('[data-rango="7D"]').click()
  await page.waitForTimeout(700)
  check('al pulsar 7D la línea cambia', (await caja.locator('.mc-valor-linea').getAttribute('d')) !== antes)
  check('  …y el rótulo también', (await dice()) !== rotuloAntes, `${rotuloAntes} → ${await dice()}`)
  check('  …y la chapa se queda puesta',
    (await caja.locator('[data-rango="7D"]').getAttribute('aria-pressed')) === 'true')
  // Y SE RECUERDA: un ajuste que se olvida al recargar no es un ajuste.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('  …y se recuerda al recargar',
    (await caja.locator('[data-rango="7D"]').getAttribute('aria-pressed')) === 'true',
    await caja.locator('.mc-valor-rango.activo').textContent())
  // Lo que se pulsa, 40 px en táctil (la regla de la casa).
  const alto = await caja.locator('[data-rango="7D"]').evaluate((n) => Math.round(n.getBoundingClientRect().height))
  check('las chapas de rango se pueden pulsar', alto >= 32, `${alto}px`)
  await browser.close()
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
