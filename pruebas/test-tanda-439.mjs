// Tanda 439 — fuera lo que se decía dos veces.
//
// PINGU: «hay cosas que sobran, hay cosas que son demasiado grandes». Lo
// que más sobraba era literal: el listón de cifras de arriba y las dos
// primeras diapositivas del panel daban los MISMOS cuatro números, con el
// total en cuerpo gigante dos veces en la misma pantalla.
//
// Nada de esto da error al romperse: vuelve a salir un número repetido, o
// una tira deja de avisar de que se desliza. Se ve igual de bien.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = () => {
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
    market: 'WEST', logo_path: 'sv/sv8/logo', card_count_official: 191, card_count_total: 191,
    release_date: '2024-11-08' }]
  window.__FAKE_CARTAS__ = [...Array(12)].map((_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8',
    local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv8/${i + 1}`,
    rarity: 'Rare', category: 'Pokemon', dex_ids: [25], variants: { normal: true } }))
  // Con REPETIDAS, para que el carrusel tenga más de una diapositiva.
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 9).map((c, i) => ({ id: `l${i}`, card_id: c.id,
    market: 'WEST', cantidad: i < 3 ? 2 : 1, idioma: 'es', estado: 'NM', variante: 'normal',
    precio_compra: 4, created_at: `2026-09-1${i}T00:00:00Z` }))
}
const abrir = async (ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  // `?ver=cambios`: desde la tanda 451 los cambios tienen SU pantalla y ya
  // no están al final del Panel — eran una pantalla entera puesta debajo
  // de otra y había que bajar demasiado.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cambios`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El panel no repite lo que ya dice el listón ──')
{
  const { page, errores } = await abrir()
  const arriba = await page.locator('#mcResumen .mc-cifra dt').allTextContents()
  // «Valor» a secas desde la 440: en una fila sin cajas, un rótulo que
  // parte en dos líneas estira la fila entera.
  check('el listón sigue dando las cuatro cifras',
    ['Cartas', 'Distintas', 'Colecciones', 'Valor'].every((t) => arriba.includes(t)), arriba.join(' | '))

  const titulos = await page.locator('.mc-diapo-titulo').allTextContents()
  // «Tu colección» era copia exacta de las tres primeras cifras del
  // listón, y se llevaba el primer sitio del carrusel, que es el único
  // que se ve sin deslizar.
  check('ya no hay una diapositiva «Tu colección»', !titulos.some((t) => /tu colecci/i.test(t)), titulos.join(' | '))
  check('  …y la primera dice algo que no está arriba',
    !/^\s*(tu colección|lo que vale)\s*$/i.test(titulos[0] || ''), titulos.join(' | '))

  // El valor total salía en el listón Y en cuerpo gigante en el carrusel.
  const valorArriba = (await page.locator('#mcResumen .mc-cifra-valor dd').textContent()).trim()
  const gigantes = (await page.locator('.mc-diapo-cifra').allTextContents()).map((t) => t.trim())
  check('el valor total no vuelve a salir en cuerpo gigante',
    !gigantes.includes(valorArriba), `arriba ${valorArriba} | diapos ${gigantes.join(' / ')}`)

  // La nota repetía, palabra por palabra, la explicación que ya lleva la
  // diapositiva del valor, dos renglones encima de la primera carta.
  const nota = (await page.locator('#mcResumenNota').textContent()).trim()
  check('la nota ya no explica cómo se calcula el valor', !/Cardmarket/i.test(nota), nota)
  check('  …pero sigue avisando de las que no tienen precio', /precio todav/i.test(nota), nota)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Tres ceros no informan ──')
{
  const { page } = await abrir()
  await page.waitForTimeout(900)
  const texto = (await page.locator('#mcCambiosPanel').textContent()) || ''
  check('sin nada apuntado, no salen las chapas de cifras',
    (await page.locator('#mcCambiosPanel .mc-cambio-cifras').count()) === 0)
  check('  …y sí los tres pasos, que son los que explican', /Marca lo que das/.test(texto), texto.slice(0, 80))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// AQUÍ VIVÍA el bloque 3, sobre la tira de cifras del móvil y la máscara
// que avisaba de que se deslizaba. Las dos se fueron en la tanda 440: las
// cifras perdieron el recuadro, caben en una fila y no hay nada que
// deslizar — y el carrusel del panel se convirtió en una rejilla. Lo que
// aquella máscara disimulaba lo arregló quitar la caja, así que no queda
// nada que comprobar. Lo que SÍ queda vivo es la lección, y está escrita
// en la bitácora: el aviso era un parche sobre un problema de tamaño.

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
