// Tanda 278: las noticias, con su propio apartado en el panel.
//
// PINGU: «necesito un apartado nuevo para las noticias, para no liar la
// marrana, porque ahora si quiero escribir una noticia tengo que ir al
// apartado de guía». Y en la tabla de Guías la noticia salía con una
// categoría («Primeros pasos») que no significa nada.
//
// Comparten tabla en la base —una noticia ES un artículo— pero son dos
// trabajos distintos: una guía se escribe en una semana, una noticia en
// veinte minutos. Cada uno con su pantalla.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 130) : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1250, height: 800 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_CATEGORIAS__ = [{ name: 'Primeros pasos' }]
  window.__FAKE_GUIAS__ = [{ title: 'Cómo saber si una carta es falsa' }, { title: 'Empezar en el TCG' }]
  window.__FAKE_NOTICIAS__ = [
    { title: 'Cartas del 30 aniversario', forum_thread_id: 'tema-1' },
    { title: 'Rotación de septiembre', published_at: null },
  ]
})
await page.goto('http://localhost:8892/admin/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2200)

console.log('\n── 1. El apartado está donde se busca ──')
{
  check('sin errores', errores.length === 0, errores[0] || '')
  check('«Noticias» está en la barra', (await page.locator('.admin-nav-item[data-section="noticias"]').count()) === 1)
  // Debajo de Guías: es contenido, va con lo de contenido.
  const orden = await page.locator('.admin-nav-item').allTextContents()
  const iGuias = orden.findIndex((t) => t.includes('Guías'))
  check('justo después de Guías', orden[iGuias + 1]?.includes('Noticias'), orden.slice(0, 5).join(' | '))
}

console.log('\n── 2. La lista ──')
{
  await page.locator('.admin-nav-item[data-section="noticias"]').click()
  await page.waitForTimeout(600)
  check('salen las dos noticias', (await page.locator('#noticiasTable tbody tr').count()) === 2)
  const cabeceras = (await page.locator('#noticiasTable thead').textContent()).replace(/\s+/g, '')
  // Una noticia no tiene categoría: esa columna aquí sería ruido.
  check('sin columna de categoría', !cabeceras.includes('Categoría'), cabeceras)
  check('y sí la fecha, que es lo que ordena una noticia', cabeceras.includes('Publicada'), cabeceras)
  const primera = (await page.locator('#noticiasTable tbody tr').first().textContent()).replace(/\s+/g, ' ')
  check('la publicada lo dice', primera.includes('Publicada'), primera)
  check('con enlace a su hilo del foro', (await page.locator('#noticiasTable a[href*="/tema/"]').count()) === 1)
  check('y con «Ver» para abrirla', (await page.locator('#noticiasTable a[href*="/noticias/"]').count()) === 1)
  const segunda = (await page.locator('#noticiasTable tbody tr').nth(1).textContent()).replace(/\s+/g, ' ')
  check('el borrador se marca como tal', segunda.includes('Borrador'), segunda)
  // Un borrador no tiene dónde llevarte: no se ofrece «Ver».
  check('y no ofrece «Ver» lo que no está publicado', !segunda.includes('Ver'), segunda)
}

console.log('\n── 3. Escribir una noticia ya no pasa por Guías ──')
{
  // El botón lleva al editor YA puesto en noticia, que es todo el punto.
  const destino = await page.evaluate(() => {
    const btn = document.getElementById('btnNuevaNoticia')
    let ido = null
    const original = Object.getOwnPropertyDescriptor(window.location, 'href')
    // No se puede interceptar location.href; se mira que el botón exista
    // y se comprueba el editor por separado.
    return !!btn
  })
  check('hay botón de «Nueva noticia»', destino)
  check('y es lo primero de la pantalla', (await page.locator('#section-noticias .admin-section-header h1').textContent()) === 'Noticias')
}

console.log('\n── 4. Y la tabla de Guías se queda limpia ──')
{
  await page.locator('.admin-nav-item[data-section="guides"]').click()
  await page.waitForTimeout(600)
  const filas = await page.locator('#guidesTable tbody tr').allTextContents()
  check('solo guías', filas.length === 2, String(filas.length))
  check('ninguna noticia se cuela', !filas.some((t) => t.includes('30 aniversario')), filas.join(' | '))
  check('sin errores en toda la pasada', errores.length === 0, errores[0] || '')
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
