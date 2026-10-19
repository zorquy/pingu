// Tanda 903 — /admin → Redes: el carrusel de presentación, dibujado con las
// cartas y los logos del catálogo.
//
// Lo puro sin navegador (qué cartas y qué set sirven, los textos); y en
// pantalla, con el doble: abrir Redes, generar, y que salgan diez lienzos de
// 1080 × 1350 pintados (ni uno en blanco), con su botón de descarga.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
const { DIAPOSITIVAS, cartasQueSirven, setQueSirve, guiasQueSirven, urlDelLogo, FONDOS } = await import(`${RAIZ}/js/redes-carrusel.js`)
{
  check('diez diapositivas: portada, ocho bloques y cierre', DIAPOSITIVAS.length === 10 && DIAPOSITIVAS[0].tipo === 'portada' && DIAPOSITIVAS[9].tipo === 'cierre' && DIAPOSITIVAS.slice(1, 9).every((d) => d.puntos?.length === 3))
  check('  …cada una con un fondo de la casa', DIAPOSITIVAS.every((d) => FONDOS[d.fondo]))
  const precios = [{ card_id: 'a', cm_trend: 230 }, { card_id: 'b', cm_trend: 12 }, { card_id: 'c', cm_low: 300 }, { card_id: 'd', cm_trend: 50 }, { card_id: 'e', cm_trend: 90 }]
  const cartas = [
    { id: 'a', name: 'Charizard ex', image_path: 'x/1', market: 'WEST' },
    { id: 'b', name: 'Pikachu', image_path: 'x/2', market: 'WEST' },
    { id: 'c', name: 'Umbreon ex', image_path: 'x/3', market: 'WEST' },
    { id: 'd', name: 'Charizard ex', image_path: 'x/4', market: 'WEST' },
    { id: 'e', name: 'Mew ex', image_path: null, market: 'WEST' },
    { id: 'f', name: 'Lugia', image_path: 'x/6', market: 'JP' },
  ]
  const s = cartasQueSirven(cartas, precios, 8)
  check('las cartas: con foto, occidentales, las más valiosas primero y sin repetir nombre', s.map((c) => c.id).join(',') === 'c,a,b', s.map((c) => `${c.id}:${c.precio}`).join(','))
  check('  …sin precio para una carta no revienta', cartasQueSirven(cartas, null, 2).length === 2)
  const sets = [{ id: 's1', name: 'Sin logo', market: 'WEST' }, { id: 's2', name: 'Con logo', market: 'WEST', logo_tcggo: 'https://x/logo.png' }, { id: 's3', logo_scrydex: 'y' }]
  check('el set: el primero (más reciente) que tenga logo', setQueSirve(sets)?.id === 's2' && setQueSirve([{ id: 'z' }]) === null)
  check('  …y su logo pasa por urlDeLogo', typeof urlDelLogo(sets[1]) === 'string' && urlDelLogo(sets[1]).includes('logo.png') && urlDelLogo(null) === null)
  const g = guiasQueSirven([{ title: 'N1', kind: 'news', published_at: '1' }, { title: 'G1', kind: 'guide', published_at: '1' }, { title: 'G2', kind: 'guide', published_at: '1' }, { title: 'G3', kind: 'guide', published_at: '1' }, { title: 'B', kind: 'guide', published_at: null }])
  check('las guías: dos guías y una noticia, publicadas', g.map((x) => x.title).join(',') === 'G1,G2,N1', g.map((x) => x.title).join(','))
}

console.log('\n── 2. Lo estático ──')
{
  const html = leer('admin/index.html')
  check('/admin tiene la sección Redes con su botón, el aviso y la rejilla', /data-section="redes"/.test(html) && /id="section-redes"/.test(html) && /id="btnRedesCarrusel"/.test(html) && /id="redesLienzos"/.test(html) && /id="redesAviso"/.test(html))
  const admin = leer('admin/js/admin.js')
  check('  …y el módulo entra por import() al abrirla', /btn\.dataset\.section === 'redes'\) import\('\.\/redes\.js'\)/.test(admin))
  check('el dibujo no está en admin.js ni en app.js: vive en js/redes-carrusel.js', !/redes-carrusel/.test(leer('js/app.js')) && /dibujarCarrusel/.test(leer('js/redes-carrusel.js')))
  const css = leer('admin/css/admin.css')
  check('la rejilla y el lienzo tienen su CSS, con el hueco reservado (4:5)', /\.redes-rejilla \{/.test(css) && /\.redes-lienzo \{[^}]*aspect-ratio: 4 \/ 5/.test(css))
}

console.log('\n── 3. En pantalla: generar el carrusel con el doble ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1250, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  const CARTAS = [...Array(10)].map((_, i) => ({ id: `sv4-${i + 1}`, market: 'WEST', set_id: 'sv4', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv4/${i + 1}`, rarity: 'Rare' }))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv4', name: 'Paradox Rift', market: 'WEST', release_date: '2023-11-03', logo_tcggo: 'https://cdn.ejemplo/logo.png', card_count_official: 182, card_count_total: 266 }]
    window.__FAKE_CARTAS__ = d.cartas
    window.__FAKE_PRECIOS__ = d.cartas.map((c, i) => ({ card_id: c.id, cm_trend: 100 - i * 7, cm_low: 90 - i * 7 }))
    window.__FAKE_GUIAS__ = [{ id: 'g1', title: 'Cómo detectar una carta falsa', kind: 'guide', estimated_mins: 8, published_at: '2026-10-01T00:00:00Z', slug: 'falsa' }, { id: 'g2', title: 'Las rarezas, explicadas', kind: 'guide', estimated_mins: 6, published_at: '2026-09-01T00:00:00Z', slug: 'rarezas' }]
    window.__FAKE_NOTICIAS__ = [{ id: 'n1', title: 'Sale hoy: Mega Evolución', kind: 'news', published_at: '2026-10-10T00:00:00Z', slug: 'mega' }]
  }, { cartas: CARTAS })
  // Las fotos de fuera no llegan aquí: se sirven como un rectángulo de la
  // proporción de una carta (la lección de la 441) para que haya algo que
  // dibujar; lo que no, 404 y el respaldo pinta el nombre.
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
  await page.route(/assets\.tcgdex\.net|limitlesstcg|cdn\.ejemplo|imagen-carta/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png1x1 }))
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.locator('[data-section="redes"]').click()
  await page.waitForTimeout(500)
  check('la sección se abre con su botón a la vista', await page.locator('#btnRedesCarrusel').isVisible())
  await page.locator('#btnRedesCarrusel').click()
  await page.waitForFunction(() => document.querySelectorAll('#redesLienzos canvas').length === 10, null, { timeout: 60000 }).catch(() => {})
  const r = await page.evaluate(() => {
    const lienzos = [...document.querySelectorAll('#redesLienzos canvas')]
    return lienzos.map((c) => {
      const ctx = c.getContext('2d')
      // Pintado de verdad: muestreamos píxeles por toda la superficie y
      // contamos cuántos colores distintos hay. Un lienzo en blanco da uno.
      const colores = new Set()
      for (let y = 20; y < c.height; y += 90) for (let x = 20; x < c.width; x += 90) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
        colores.add(`${r >> 4},${g >> 4},${b >> 4}`)
      }
      return { w: c.width, h: c.height, colores: colores.size, etiqueta: c.getAttribute('aria-label') }
    })
  })
  check('salen diez lienzos', r.length === 10, String(r.length))
  check('  …de 1080 × 1350', r.every((x) => x.w === 1080 && x.h === 1350))
  check('  …y todos pintados (fondo, texto, paneles)', r.every((x) => x.colores >= 6), JSON.stringify(r.map((x) => x.colores)))
  check('  …cada uno con su título accesible', r.every((x, i) => x.etiqueta?.startsWith(`Diapositiva ${i + 1}:`)), JSON.stringify(r.map((x) => x.etiqueta)))
  const botones = await page.locator('#redesLienzos figcaption button').count()
  check('cada diapositiva tiene su botón de descarga, y el de las diez aparece', botones === 10 && (await page.locator('#btnRedesDescargarTodas').isVisible()))
  // La descarga de verdad: pulsar «Descargar» en la primera baja un PNG con su nombre.
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator('#redesLienzos figcaption button').first().click()])
  check('«Descargar» baja pokedoc-carrusel-01.png', descarga?.suggestedFilename() === 'pokedoc-carrusel-01.png', descarga?.suggestedFilename())
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  // Una captura para mirarla, por si acaso.
  await page.screenshot({ path: `${process.env.PD_CAPTURAS || '/tmp'}/903-redes.png`, fullPage: true }).catch(() => {})
  await browser.close()
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
