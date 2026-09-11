// Tanda 275: entrar en una noticia desde su dirección limpia.
//
// EL FALLO, en producción y con la primera noticia publicada: el listado
// salía perfecto, pinchabas, y la noticia decía «Guía no encontrada».
//
// LA CAUSA: en /noticias/<slug> la dirección del NAVEGADOR no lleva
// `?slug=`. La reescritura a guia.html la hace Netlify en el servidor, y
// el navegador no se entera: sigue viendo /noticias/<slug>, con la query
// vacía. `js/guia.js` leía solo la query.
//
// Y el daño doble: el servidor YA había pintado el artículo bien (tanda
// 270) y el JavaScript lo sustituyó por el mensaje de error. O sea que
// el fallo del cliente se cargó una página que estaba bien.
//
// La casa ya tenía resuelto esto para /usuario/<nombre>, con
// `profileParamsFromLocation`. Solo había que hacer lo mismo.
import { slugDeArticuloEnLaUrl } from '/home/user/pingu/js/articulos.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 120) : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = (await import('/opt/node22/lib/node_modules/playwright/index.mjs')).chromium

console.log('\n── 1. De dónde se saca el slug ──')
{
  const donde = (pathname, search = '') => slugDeArticuloEnLaUrl({ pathname, search })
  // El caso que se rompió: dirección limpia, sin query ninguna.
  check('de la ruta limpia', donde('/noticias/cartas-30') === 'cartas-30')
  check('aunque la query venga vacía', donde('/noticias/cartas-30', '') === 'cartas-30')
  // Los enlaces viejos y la búsqueda siguen entrando por la query.
  check('de la query, como siempre', donde('/guia.html', '?slug=mi-guia') === 'mi-guia')
  check('y de la dirección limpia de guía', donde('/guia', '?slug=mi-guia') === 'mi-guia')
  // La ruta manda: si llegan las dos, es una noticia.
  check('la ruta gana a la query', donde('/noticias/la-buena', '?slug=la-otra') === 'la-buena')
  check('sin nada, no se inventa un slug', donde('/guia.html') === null)
  // Acentos y signos: el slug va codificado en la dirección.
  check('se descodifica', donde('/noticias/rotaci%C3%B3n-de-septiembre') === 'rotación-de-septiembre')
  // Un % suelto rompe decodeURIComponent: vale más el slug a medias que
  // una página en blanco.
  check('un % suelto no tumba la página', donde('/noticias/roto-%-aqui') === 'roto-%-aqui')
}

console.log('\n── 2. La noticia se abre de verdad ──')
{
  const navegador = await browser.launch()
  const NOTICIAS = [{ title: 'Reveladas las cartas del 30 aniversario', description: 'Todas, una por una.' }]
  const abrir = async (ruta) => {
    const page = await navegador.newPage({ viewport: { width: 1100, height: 800 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
    await page.addInitScript((n) => {
      window.__FAKE_SESSION__ = 'none'
      window.__FAKE_NOTICIAS__ = n
    }, NOTICIAS)
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    return { page, errores }
  }

  // Se entra por la dirección limpia, SIN query: como al pinchar en el
  // listado. El servidor de pruebas no reescribe como Netlify, así que se
  // pide guia.html directamente pero con la ruta de noticia falseada —
  // que es exactamente el estado en el que llega el navegador.
  const { page, errores } = await abrir('/guia?slug=noticia-1')
  check('la noticia abre', (await page.locator('.article-header h1').textContent()) === NOTICIAS[0].title)
  check('sin errores', errores.length === 0, errores[0] || '')
  check('y no dice que no la encuentra', !(await page.locator('#articleMain').textContent()).includes('no encontrada'))
  // Y tras abrirla, la dirección queda limpia. Si ahora se recarga —cosa
  // que hace la gente— la página tiene que seguir funcionando: eso es lo
  // que la ruta arregla.
  check('la barra queda en la dirección de noticia', new URL(page.url()).pathname === '/noticias/noticia-1', page.url())
  await page.close()
  await navegador.close()
}

console.log('\n── 3. Entrar directo en /noticias/<slug>, como al recargar ──')
{
  // ESTE es el caso que se rompió, y hay que reproducirlo tal cual: la
  // reescritura de Netlify es del SERVIDOR —sirve guia.html pero el
  // navegador sigue viendo /noticias/<slug>, sin query—. El servidor de
  // pruebas no reescribe, así que se hace aquí: se intercepta la petición
  // y se responde con guia.html, dejando la dirección intacta.
  const navegador = await browser.launch()
  const page = await navegador.newPage({ viewport: { width: 1100, height: 800 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.route('**/noticias/**', async (route) => {
    const r = await route.fetch({ url: `${BASE}/guia.html` })
    await route.fulfill({ response: r })
  })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_NOTICIAS__ = [{ title: 'Reveladas las cartas del 30 aniversario', description: 'Todas, una por una.' }]
  })
  await page.goto(`${BASE}/noticias/noticia-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1600)
  const texto = await page.locator('#articleMain').textContent()
  check('la noticia abre entrando directo, sin ?slug=',
    texto.includes('Reveladas las cartas del 30 aniversario'), texto.slice(0, 90))
  check('y no dice «Guía no encontrada»', !texto.includes('no encontrada'))
  check('con su chapa de Noticia', (await page.locator('.guide-label').textContent()) === 'Noticia')
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
  await navegador.close()
}

console.log('\n── 4. El cliente no pisa lo que el servidor pintó bien ──')
{
  const navegador = await browser.launch()
  const page = await navegador.newPage()
  // Se simula lo que sirve la edge function: el artículo ya pintado. Y un
  // slug que no existe, para forzar el fallo del cliente.
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    document.addEventListener('DOMContentLoaded', () => {
      const main = document.getElementById('articleMain')
      if (main) main.innerHTML = '<h1>Lo que pintó el servidor</h1><p>El texto de la noticia.</p>'
    })
  })
  await page.goto(`${BASE}/guia?slug=no-existe-esta`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const texto = await page.locator('#articleMain').textContent()
  check('el artículo del servidor sigue ahí', texto.includes('Lo que pintó el servidor'), texto.slice(0, 90))
  check('y no se ha puesto el mensaje de error encima', !texto.includes('no encontrada'))
  await page.close()

  // Sin nada pintado, el mensaje sí sale: no vamos a dejar una página en
  // blanco a quien de verdad ha llegado a una dirección que no existe.
  const p2 = await navegador.newPage()
  await p2.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  await p2.goto(`${BASE}/guia?slug=no-existe-esta`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(1500)
  check('sin nada pintado, sí se avisa', (await p2.locator('#articleMain').textContent()).includes('no encontrada'))
  await p2.close()
  await navegador.close()
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
