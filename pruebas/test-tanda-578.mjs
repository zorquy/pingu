// Tanda 578 — en un álbum soñado, la carta se ARRASTRA a otro hueco.
//
// PINGU: «deberías poder coger una carta y arrastrarla al hueco de al lado
// o a cualquier hueco. Pero claro, si la clicas te da como para descargar
// la imagen». Dos cosas, y las dos sin error: el arrastre que no existía,
// y el que SÍ existía y era el del navegador —la foto, que se descarga—.
//
// Lo que más vigila esta prueba es la frontera entre clic y arrastre: un
// arrastre que acabe abriendo la ficha de la carta soltada, o un dedo que
// quiera desplazar la página y mueva una carta, son peores que no tener
// arrastre. Y que lo que se mueve se GUARDA: una pantalla reordenada que
// vuelve al orden viejo al recargar es la peor versión de «funciona».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

const browser = await chromium.launch()

async function abrirAlbum({ viewport, cuantas = 20, hasTouch = false }) {
  const page = await browser.newPage({ viewport, hasTouch })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((n) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: n, card_count_total: n, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: n }, (_, i) => ({
      id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`,
      image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_ALBUMES__ = [{
      id: 'alb-1', user_id: 'admin-1', nombre: 'Mis Eevees', descripcion: 'Un álbum de prueba', is_public: false,
      cartas: Array.from({ length: n }, (_, i) => ({ id: `sv8-${i + 1}` })), updated_at: '2026-10-01T10:00:00Z',
    }]
  }, cuantas)
  // La foto se SIRVE, no se aborta (651): abortada, la cadena de respaldos
  // salía a la red real por el proxy y, según lo rápido que fallara, la
  // imagen ya se había quitado del bolsillo antes de mirarla — la prueba
  // iba y venía sin que cambiara nada (la lección de la 441: llena la
  // pantalla antes de mirarla).
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#888"/></svg>' }))
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas&album=alb-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-bolsillo[data-indice]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  return { page, errores }
}

// El orden tal como se ve: el número de cada bolsillo, por índice.
const numeros = (page) => page.$$eval('#mcAlbArchivador .mc-bolsillo[data-indice]', (els) => els.map((e) => e.querySelector('.mc-bolsillo-num')?.textContent || ''))
// Y el orden tal como se GUARDÓ en la base (el doble).
const guardado = (page) => page.evaluate(() => (window.__TABLAS__?.user_albums?.[0]?.cartas || []).map((c) => c.id))

// Arrastrar con el ratón, en pasos: el umbral de 8 px pide movimiento de
// verdad, y `elementFromPoint` mira dónde está el puntero en cada paso.
async function arrastrar(page, desde, hasta, { pasos = 12, soltar = true } = {}) {
  const a = await desde.boundingBox()
  const b = await hasta.boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= pasos; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / pasos, a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * i) / pasos)
  }
  if (soltar) await page.mouse.up()
}

console.log('── 1. Lo que el navegador arrastraba SOLO, apagado ──')
{
  const { page, errores } = await abrirAlbum({ viewport: { width: 1200, height: 1000 } })
  const n = (await numeros(page)).length
  check('el álbum está abierto con sus cartas', n === 18, `${n} bolsillos a la vista (dos pliegos de 9)`)
  const fotos = await page.$$eval('#mcAlbArchivador .mc-bolsillo img', (els) => els.map((e) => e.getAttribute('draggable')))
  check('toda foto de bolsillo lleva `draggable="false"`', fotos.length > 0 && fotos.every((d) => d === 'false'), JSON.stringify(fotos.slice(0, 3)))
  const enlaces = await page.$$eval('#mcAlbArchivador a.mc-bolsillo', (els) => els.map((e) => e.getAttribute('draggable')))
  check('  …y el enlace del bolsillo también', enlaces.length > 0 && enlaces.every((d) => d === 'false'), JSON.stringify(enlaces.slice(0, 3)))
  const css = readFileSync(`${RAIZ}/css/mi-coleccion.css`, 'utf8')
  check('el bolsillo no ofrece «guardar imagen» al dejar el dedo (`-webkit-touch-callout: none`)', /\.mc-bolsillo \{[^}]*-webkit-touch-callout: none/s.test(css))
  check('  …ni se selecciona (`user-select: none`)', /\.mc-bolsillo \{[^}]*user-select: none/s.test(css))
  // Y el `dragstart` que se escapara, cancelado: así se comprueba, no
  // mirando si hay un listener (la lección de la 313).
  const cancelado = await page.evaluate(() => {
    const img = document.querySelector('#mcAlbArchivador .mc-bolsillo img')
    const e = new DragEvent('dragstart', { bubbles: true, cancelable: true })
    return !img.dispatchEvent(e)
  })
  check('un `dragstart` dentro del archivador se cancela', cancelado === true, String(cancelado))

  console.log('── 2. Con el ratón se arrastra sin entrar en «Ordenar y quitar» ──')
  const antes = await numeros(page)
  const b0 = page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="0"]')
  const b2 = page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="2"]')
  const url = page.url()
  await arrastrar(page, b0, b2, { soltar: false })
  await page.waitForTimeout(100)
  const enVuelo = await page.evaluate(() => ({
    fantasma: !!document.querySelector('.mc-arrastre'),
    origen: !!document.querySelector('#mcAlbArchivador .mc-bolsillo[data-indice="0"].mc-arrastrando'),
    destino: document.querySelector('#mcAlbArchivador .mc-destino')?.dataset.indice,
  }))
  check('mientras se arrastra hay una carta fantasma', enVuelo.fantasma === true, JSON.stringify(enVuelo))
  check('  …el hueco de origen se atenúa', enVuelo.origen === true, JSON.stringify(enVuelo))
  check('  …y el hueco de destino se marca', enVuelo.destino === '2', JSON.stringify(enVuelo))
  if (CAPS) await page.screenshot({ path: `${CAPS}/escritorio-arrastre.png` })
  await page.mouse.up()
  await page.waitForTimeout(900)
  const despues = await numeros(page)
  check('al soltar, las dos cartas se INTERCAMBIAN (huecos, no una lista)', despues[0] === antes[2] && despues[2] === antes[0] && despues[1] === antes[1], `${antes.slice(0, 4)} → ${despues.slice(0, 4)}`)
  check('  …sin fantasma ni marcas que se queden', await page.evaluate(() => !document.querySelector('.mc-arrastre, .mc-destino, .mc-arrastrando')))
  check('  …y sin irse a la ficha: el clic de después del arrastre no cuenta', page.url() === url, page.url())
  const g = await guardado(page)
  check('  …y el orden nuevo se GUARDA', g[0] === 'sv8-3' && g[2] === 'sv8-1', JSON.stringify(g.slice(0, 4)))
  check('  …con «Guardado» en el estado', /Guardado/.test(await page.locator('#mcAlbEstado').innerText()))

  console.log('── 3. Un clic sin arrastre sigue siendo un clic ──')
  // El umbral: bajar y subir casi en el mismo sitio es el clic de siempre,
  // y el bolsillo de un álbum soñado es un enlace a la página de la carta.
  // Se mira si el clic LLEGA sin cancelar —que es lo que lo convierte en
  // navegación— y se frena ahí mismo para no irse de la página.
  const antesClic = await numeros(page)
  await page.evaluate(() => {
    window.__clics = []
    document.querySelector('#mcAlbArchivador .mc-bolsillo[data-indice="0"]').addEventListener('click', (e) => {
      window.__clics.push(e.defaultPrevented)
      e.preventDefault()
    })
  })
  const caja = await b0.boundingBox()
  await page.mouse.move(caja.x + 20, caja.y + 20)
  await page.mouse.down()
  await page.mouse.move(caja.x + 23, caja.y + 22)
  await page.mouse.up()
  await page.waitForTimeout(900)
  check('un clic con el pulso flojo (3 px) no mueve nada', JSON.stringify(await numeros(page)) === JSON.stringify(antesClic))
  const clics = await page.evaluate(() => window.__clics)
  check('  …y el clic llega al enlace sin cancelar: sigue llevando a la carta', JSON.stringify(clics) === '[false]', JSON.stringify(clics))
  check('  …sin irse de la página en la prueba', /mi-coleccion/.test(page.url()), page.url())

  console.log('── 4. Al hueco vacío: al final; y a la flecha: pasa de página ──')
  // 20 cartas son 3 pliegos: en escritorio se ven dos (18 huecos) y el
  // tercero tiene 2 cartas y 7 vacíos.
  await page.click('#mcAlbSiguiente')
  await page.waitForTimeout(400)
  const paginas = await page.locator('#mcAlbPaginas').innerText()
  check('el tercer pliego está a la vista', /3/.test(paginas), paginas)
  const vacio = page.locator('#mcAlbArchivador .mc-bolsillo-vacio').first()
  const b18 = page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="18"]')
  check('  …con bolsillos vacíos', (await vacio.count()) > 0)
  await arrastrar(page, b18, vacio)
  await page.waitForTimeout(900)
  const g2 = await guardado(page)
  check('soltar en un hueco vacío manda la carta al FINAL', g2[g2.length - 1] === 'sv8-19' && g2[18] === 'sv8-20', JSON.stringify(g2.slice(17)))
  // Y de vuelta al principio llevando la carta hasta la flecha «‹».
  const b19 = page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="19"]')
  await arrastrar(page, b19, page.locator('#mcAlbAnterior'), { soltar: false })
  await page.waitForTimeout(900)
  const pag = await page.locator('#mcAlbPaginas').innerText()
  check('quedarse sobre la flecha con la carta en la mano pasa de página', /^Página 1\b/.test(pag), pag)
  const sigueEnVuelo = await page.evaluate(() => !!document.querySelector('.mc-arrastre'))
  check('  …sin soltar la carta', sigueEnVuelo === true)
  const b1 = page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="1"]')
  const c1 = await b1.boundingBox()
  await page.mouse.move(c1.x + c1.width / 2, c1.y + c1.height / 2, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  const g3 = await guardado(page)
  check('  …y se suelta en el pliego nuevo', g3[1] === 'sv8-19' && g3[19] === 'sv8-2', JSON.stringify([g3[1], g3[19]]))

  console.log('── 5. Dentro de un álbum, las carpetas de encima no se ven ──')
  const carpetas = await page.evaluate(() => {
    const v = (id) => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0 }
    return { mandos: v('mcCarpetasMandos'), panel: v('mcCarpetasPanel'), album: v('mcAlbArchivador') }
  })
  check('«Nueva carpeta» y su panel están escondidos', carpetas.mandos === false && carpetas.panel === false, JSON.stringify(carpetas))
  check('  …y el álbum se ve', carpetas.album === true)
  await page.click('#mcAlbVolver')
  await page.waitForTimeout(500)
  // 759: «Nueva carpeta» ya no existe; al volver se ve la rejilla de álbumes.
  const vuelta = await page.evaluate(() => document.getElementById('mcAlbumesRejilla').getClientRects().length > 0)
  check('al volver a «Tus álbumes» se ve la rejilla', vuelta === true)
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('── 6. En «Ordenar y quitar», el dedo arrastra; fuera, desplaza ──')
{
  const { page, errores } = await abrirAlbum({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const antes = await numeros(page)
  check('en el móvil se ve un pliego', antes.length === 9, String(antes.length))
  // Un dedo que se mueve sobre un bolsillo SIN estar ordenando: es el
  // gesto de desplazar, y el navegador lo cancela. Se simula tal como lo
  // manda el navegador: pointerdown, un move y un pointercancel.
  const dedo = (tipo, x, y, extra = {}) => page.evaluate(([tipo, x, y, extra]) => {
    const el = document.elementFromPoint(x, y)
    el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, ...extra }))
  }, [tipo, x, y, extra])
  const c0 = await page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="0"]').boundingBox()
  const c1 = await page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="1"]').boundingBox()
  await dedo('pointerdown', c0.x + 30, c0.y + 40)
  await dedo('pointermove', c0.x + 60, c0.y + 40)
  await dedo('pointermove', c1.x + 30, c1.y + 40)
  const sinOrdenar = await page.evaluate(() => !!document.querySelector('.mc-arrastre'))
  check('sin «Ordenar y quitar», el dedo NO coge la carta', sinOrdenar === false)
  await dedo('pointercancel', c1.x + 30, c1.y + 40)
  check('  …y el orden no cambia', JSON.stringify(await numeros(page)) === JSON.stringify(antes))
  const tocable = await page.evaluate(() => getComputedStyle(document.querySelector('#mcAlbArchivador .mc-bolsillo[data-indice="0"]')).touchAction)
  check('  …porque el bolsillo deja desplazar (`touch-action` no es `none`)', tocable !== 'none', tocable)

  await page.click('#mcAlbEditar')
  await page.waitForTimeout(400)
  const ayuda = page.locator('#mcAlbAyuda')
  check('al ordenar se explica cómo (arrastra, flechas, pasar de página)', (await ayuda.isVisible()) && /[Aa]rrastra/.test(await ayuda.innerText()))
  const ta = await page.evaluate(() => getComputedStyle(document.querySelector('#mcAlbArchivador .mc-bolsillo[data-indice="0"]')).touchAction)
  check('ordenando, el bolsillo se queda el gesto (`touch-action: none`)', ta === 'none', ta)
  // Por el CENTRO del bolsillo: en una esquina está el botón de quitar,
  // y un botón se pulsa, no se coge.
  const d0 = await page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="0"]').boundingBox()
  const d1 = await page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="1"]').boundingBox()
  await dedo('pointerdown', d0.x + d0.width / 2, d0.y + d0.height / 2)
  await dedo('pointermove', d0.x + d0.width / 2 + 30, d0.y + d0.height / 2)
  await dedo('pointermove', d1.x + d1.width / 2, d1.y + d1.height / 2)
  const enVuelo = await page.evaluate(() => ({ fantasma: !!document.querySelector('.mc-arrastre'), destino: document.querySelector('.mc-destino')?.dataset.indice }))
  check('ordenando, el dedo SÍ coge la carta', enVuelo.fantasma === true && enVuelo.destino === '1', JSON.stringify(enVuelo))
  if (CAPS) await page.screenshot({ path: `${CAPS}/movil-arrastre.png` })
  await dedo('pointerup', d1.x + d1.width / 2, d1.y + d1.height / 2)
  await page.waitForTimeout(900)
  const despues = await numeros(page)
  check('  …y las intercambia', despues[0] === antes[1] && despues[1] === antes[0], `${antes.slice(0, 3)} → ${despues.slice(0, 3)}`)
  // Los mandos de teclado siguen ahí y a 44 px con el dedo.
  const quitar = await page.locator('#mcAlbArchivador .mc-bolsillo-quitar').first().boundingBox()
  const flecha = await page.locator('#mcAlbArchivador [data-mover="1"]').first().boundingBox()
  check('«quitar» y las flechas se quedan, y miden 44 px con el dedo', quitar.width >= 44 && quitar.height >= 44 && flecha.height >= 44, JSON.stringify([quitar.width, quitar.height, flecha.height]))
  // Pulsar un mando no es coger la carta.
  await page.locator('#mcAlbArchivador .mc-bolsillo[data-indice="0"] [data-mover="1"]').click()
  await page.waitForTimeout(700)
  const trasFlecha = await numeros(page)
  check('la flecha → sigue intercambiando con el de al lado', trasFlecha[1] === despues[0] && trasFlecha[0] === despues[1], `${despues.slice(0, 3)} → ${trasFlecha.slice(0, 3)}`)
  check('  …sin fantasma suelto', await page.evaluate(() => !document.querySelector('.mc-arrastre')))
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
