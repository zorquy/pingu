// Tanda 475 — los cuatro mandos de la cabecera, detrás de un ⋮.
//
// PINGU: «estás ocupando mucho espacio arriba… he pensado en poner tres
// puntos como pasa en la aplicación de Dex».
//
// La cabecera de una expansión llevaba cuatro iconos en fila: marcar
// varias, favorita, compartir y el engranaje de «al añadir». Cuatro
// iconos seguidos sin una palabra al lado son un acertijo —hay que
// pulsarlos para saber qué hacen— y además empujaban el título a media
// cabecera.
//
// Dentro del menú caben con su nombre escrito, que es lo que hace Dex y
// lo que hace que se entiendan.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 10, card_count_total: 10, logo_path: 'x/l', release_date: '2026-09-26' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 10 }, (_, i) => ({
      id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: `Bulbasaur ${i + 1}`, name_es: `Bulbasaur ${i + 1}`, image_path: `x/${i + 1}`,
      rarity: 'Rare', category: 'Pokemon', variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 3).map((c, i) => ({
      id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM',
      variante: 'normal', created_at: new Date().toISOString(),
    }))
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  return { page, errores }
}

const menu = '#mcAlbumMenu'
const boton = '#mcAlbumMenu > summary'

const { page, errores } = await abrir()

console.log('── 1. La cabecera se queda en el título y UN botón ──')
check('se ha abierto la expansión', await page.locator('#mcArchivadorZona').isVisible())
const enLaBarra = await page.evaluate(() =>
  [...document.querySelectorAll('.mc-album-barra > *')].map((e) => e.id || e.tagName))
check('dos cosas y nada más', enLaBarra.length === 2, enLaBarra.join(','))
check('el título y el menú', enLaBarra.includes('mcAlbumTitulo') && enLaBarra.includes('mcAlbumMenu'), enLaBarra.join(','))
// La fila de cuatro iconos ya no existe.
check('ya no hay fila de iconos', (await page.locator('.mc-album-iconos').count()) === 0)
check('ni el engranaje suelto de «al añadir»', (await page.locator('#mcTocarCaja').count()) === 0)

console.log('\n── 2. Cerrado, no se ve nada de dentro ──')
// Encontrar un elemento no es verlo (la lápida de la 447): los cuatro
// EXISTEN en el DOM desde el primer momento, escondidos.
for (const id of ['#mcMarcarAbrir', '#mcFaltanCopiar', '#mcTocarOpciones']) {
  check(`${id} existe pero no se ve`, (await page.locator(id).count()) === 1 && (await page.locator(id).isHidden()), id)
}
check('el menú empieza cerrado', (await page.locator(menu).evaluate((n) => n.open)) === false)

console.log('\n── 3. Al abrirlo, los tres mandos con su NOMBRE ──')
await page.click(boton)
await page.waitForTimeout(400)
const opciones = await page.locator('#mcAlbumMenu .mc-menu-opcion').evaluateAll((ns) =>
  ns.filter((n) => n.getBoundingClientRect().height > 0).map((n) => ({ id: n.id, texto: n.textContent.trim() })))
check('salen los tres', opciones.length === 3, JSON.stringify(opciones.map((o) => o.id)))
check('  …en el orden de Dex', opciones.map((o) => o.id).join(',') === 'mcMarcarAbrir,mcAlbumFavorito,mcFaltanCopiar',
  JSON.stringify(opciones.map((o) => o.id)))
// LO QUE ARREGLA EL MENÚ: cuatro iconos seguidos no dicen qué hacen. Aquí
// cada uno lleva su frase, y la de compartir dice CUÁNTAS son — que era lo
// que PINGU echaba de menos («es un botón que no hace nada»).
check('  …cada uno con su frase', opciones.every((o) => o.texto.length > 4), JSON.stringify(opciones.map((o) => o.texto)))
check('  …y la de compartir dice cuántas faltan', /Copiar las 7 que me faltan/.test(opciones[2].texto), opciones[2].texto)
check('y el ajuste de «al añadir» también está', await page.locator('#mcTocarOpciones').isVisible())

console.log('\n── 4. Se cierra solo al elegir ──')
// Un <details> se queda abierto hasta que alguien lo cierra, y un menú
// abierto encima de lo que acabas de cambiar tapa justo lo que has venido
// a mirar.
await page.click('#mcMarcarAbrir')
await page.waitForTimeout(500)
check('al elegir, se cierra', (await page.locator(menu).evaluate((n) => n.open)) === false)
check('  …y la acción ha ocurrido', await page.locator('#mcMarcarBarra').isVisible())
// Se apaga otra vez para lo que sigue.
await page.click(boton)
await page.waitForTimeout(300)
await page.click('#mcMarcarAbrir')
await page.waitForTimeout(500)
check('  …y se puede volver a apagar', (await page.locator('#mcMarcarBarra').isHidden()))

console.log('\n── 5. Pero NO al tocar los desplegables de «al añadir» ──')
// Son un ajuste y no una acción: ahí se suelen cambiar los dos seguidos, y
// cerrar el menú en el primero obligaría a abrirlo otra vez.
await page.click(boton)
await page.waitForTimeout(300)
await page.selectOption('#mcTocarIdioma', 'en')
await page.waitForTimeout(300)
check('el menú sigue abierto', (await page.locator(menu).evaluate((n) => n.open)) === true)
await page.selectOption('#mcTocarEstado', 'LP')
await page.waitForTimeout(300)
check('  …y al segundo también', (await page.locator(menu).evaluate((n) => n.open)) === true)
check('  …y lo elegido se queda', (await page.inputValue('#mcTocarIdioma')) === 'en')

console.log('\n── 6. Y se cierra al tocar fuera ──')
await page.mouse.click(30, 700)
await page.waitForTimeout(400)
check('cerrado', (await page.locator(menu).evaluate((n) => n.open)) === false)

console.log('\n── 7. La estrella dice el estado ──')
{
  await page.click(boton)
  await page.waitForTimeout(300)
  const fav = page.locator('#mcAlbumFavorito')
  const texto = () => fav.textContent().then((t) => t.trim())
  check('empieza en «Marcar como favorita»', (await texto()) === 'Marcar como favorita', await texto())
  await fav.click()
  await page.waitForTimeout(600)
  await page.click(boton)
  await page.waitForTimeout(300)
  check('  …y al marcarla lo dice al revés', (await texto()) === 'Quitar de favoritas', await texto())
  check('  …y queda pulsada', (await fav.getAttribute('aria-pressed')) === 'true')
  await page.click(boton)
  await page.waitForTimeout(250)
}

console.log('\n── 8. Sin errores en consola ──')
check('ninguno', errores.length === 0, errores.join(' | '))
await page.close()

console.log('\n── 9. En el móvil el menú no se sale de la pantalla ──')
{
  const { page: p2 } = await abrir(390)
  await p2.click(boton)
  await p2.waitForTimeout(500)
  const caja = await p2.locator('#mcAlbumMenu .mc-menu').evaluate((n) => {
    const r = n.getBoundingClientRect()
    return { izq: Math.round(r.left), der: Math.round(r.right), ancho: document.documentElement.clientWidth,
      pos: getComputedStyle(n).position }
  })
  // Pegado por la DERECHA: el botón está al final de la cabecera, así que
  // un panel anclado por la izquierda se saldría por el otro lado.
  check('cabe entero', caja.izq >= 0 && caja.der <= caja.ancho + 1, JSON.stringify(caja))
  // Y flotando: si empujara la fila, al abrirlo se movería todo lo de
  // debajo y se perdería de vista lo que estabas mirando.
  check('y flota, no empuja', caja.pos === 'absolute', caja.pos)
  const r = await p2.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  check('la página no se va de ancho', r.s <= r.c + 1, `${r.s} > ${r.c}`)
  await p2.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
