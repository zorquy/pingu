// Tanda 562 — desde el Panel, una carta abría la página en vez de la ficha.
//
// PINGU: «desde el panel, cuando le das a una carta debería salir el popup
// y no llevarte a la ficha completa».
//
// Y es lo coherente: en el álbum, en la Pokédex y en el buscador una carta
// se abre AHÍ MISMO —con su cantidad, su idioma y su estado, que es lo que
// se va a tocar—, y solo en el Panel te sacaba de la página. Irse de
// /mi-coleccion para ver una carta tuya y tener que volver es justo la
// fricción que esta pantalla lleva seis tandas quitando.
//
// El `href` SE QUEDA, y eso es la mitad de la tanda: con Ctrl, con ⌘ o con
// el botón de en medio sigue abriendo la página entera en otra pestaña,
// que es lo que cualquiera espera de un enlace (la norma de la 418). Lo
// que cambia es el clic normal.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: 2, card_count_total: 2, logo_path: 'x/l' }]
  window.__FAKE_CARTAS__ = [
    { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Lapras', name_es: 'Lapras', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Pikachu ex', name_es: 'Pikachu ex', image_path: 'x/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = [
    // Tres copias de la primera: así el Panel pinta además la lista de «te
    // sobran», que es el otro sitio donde enseña cartas. Sin ella, la
    // tercera comprobación no probaría nada (la lección de la 506).
    { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 3, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
  ]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
// El Panel es la pestaña por defecto desde la 440.
await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3200)

console.log('── 1. La tira «Tus cartas» abre la ficha ──')
{
  const carta = page.locator('.mc-vistazo-carta').first()
  check('la tira está pintada', (await carta.count()) === 1, String(await page.locator('.mc-vistazo-carta').count()))
  // El enlace sigue siendo un enlace: lo que cambia es el clic normal.
  const href = await carta.getAttribute('href')
  check('  …y sigue llevando su `href`', /\/carta\//.test(href || ''), String(href))
  check('  …con `data-carta`, que es lo que la abre aquí', !!(await carta.getAttribute('data-carta')), String(await carta.getAttribute('data-carta')))
  const antes = page.url()
  await carta.click()
  await page.waitForTimeout(1200)
  check('al pulsar NO se va de la página', page.url() === antes, `${antes} → ${page.url()}`)
  const abierto = await page.evaluate(() => {
    const d = document.getElementById('mcEditor')
    return !!d && d.open && getComputedStyle(d).display !== 'none'
  })
  check('  …y se abre la ficha', abierto === true, String(abierto))
  // Y se ve de qué carta es, que es lo que se venía a mirar.
  const texto = await page.locator('#mcEditor').innerText()
  check('  …de la carta que se ha pulsado', /Pikachu|Lapras/.test(texto), texto.slice(0, 120))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
}

console.log('── 2. Con Ctrl sigue siendo un enlace ──')
{
  // Esto es la otra mitad: un enlace que con Ctrl no abre en otra pestaña
  // deja de ser un enlace, y eso es peor que el problema que se arregla.
  const antes = page.url()
  const abierto = await page.evaluate(() => {
    const a = document.querySelector('.mc-vistazo-carta')
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, button: 0 })
    const cancelado = !a.dispatchEvent(e)
    const d = document.getElementById('mcEditor')
    return { cancelado, ficha: !!d && d.open }
  })
  check('el clic con Ctrl no se intercepta', abierto.cancelado === false, JSON.stringify(abierto))
  check('  …y no abre la ficha', abierto.ficha === false, JSON.stringify(abierto))
  check('  …ni cambia de página por su cuenta', page.url() === antes)
}

console.log('── 3. Y las listas del Panel, igual ──')
{
  // «Te sobran» y «las más valiosas» también enseñan cartas, y en la misma
  // pantalla: si una abriera la ficha y la otra se fuera de la página,
  // serían dos reglas distintas en el mismo sitio.
  // Las listas largas viven detrás de «Ver todas» desde la 440, así que
  // hay que abrirlas: un elemento que está en el DOM y no se ve no se
  // puede pulsar (la lección de la 447).
  await page.click('#mcVerTodo')
  await page.waitForTimeout(300)
  const filas = page.locator('#mcPanelResumen .mc-fila-carta a[data-carta]')
  const cuantas = await filas.count()
  // Y que LLEGUE: el fixture tiene tres copias de una carta justo para que
  // el Panel pinte «te sobran». Si no hubiera ninguna fila, esta sección
  // no estaría probando nada y saldría verde igual (la lección de la 307).
  check('hay filas de carta en el Panel', cuantas > 0, String(cuantas))
  if (cuantas === 0) {
    // no hay nada que pulsar
  } else {
    const antes = page.url()
    await filas.first().click()
    await page.waitForTimeout(1200)
    check('una fila abre la ficha y no se va', page.url() === antes)
    check('  …y la ficha está abierta', await page.evaluate(() => !!document.getElementById('mcEditor')?.open))
  }
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
