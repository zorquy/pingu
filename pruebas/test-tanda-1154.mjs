// Tanda 1154 — de «Cuatro pantallas que se pueden aprovechar mejor» (ronda 7):
//   E1 · Retos en el PC con la liga al lado: los retos a dos columnas y, a la
//        derecha, los cinco primeros de la semana y tú, tu racha y «Ver la
//        clasificación». En el móvil no sale.
//   E4 · Aprender sin repetirse: la destacada del móvil nunca es la guía que
//        sale en «Sigue donde lo dejaste» (pasa a la siguiente de su tema),
//        es más baja (52 px de franja) y la fila de seguir lleva su barra.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()
const CLAS = () => {
  const p = (n, nombre, xp, tu = false) => ({ puesto: n, display_name: nombre, username: nombre.toLowerCase(), xp, tu })
  window.__FAKE_CLASIFICACION__ = { semana: { ranking: [p(1, 'Brock', 640), p(2, 'Jesus', 590), p(3, 'Cynthia', 515), p(4, 'Misty', 480), p(5, 'Gary', 410), p(6, 'Oak', 380)], tu: { puesto: 7, xp: 320 } } }
}

console.log('── E1 · Retos con la liga al lado ──')
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1', CLAS)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/retos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const r = await page.evaluate(() => {
    const aside = document.getElementById('rtLigaLado')
    const lista = document.getElementById('rtLista')
    const cols = getComputedStyle(lista).gridTemplateColumns.split(' ').length
    const filas = [...(aside?.querySelectorAll('.rt-ll-lista li') || [])].map((li) => li.textContent.replace(/\s+/g, ' ').trim())
    const ab = aside?.getBoundingClientRect()
    const lb = lista.getBoundingClientRect()
    return { visible: !!aside && getComputedStyle(aside).display !== 'none' && ab.width > 0, cols, filas, alLado: ab && ab.left >= lb.right - 1 && Math.abs(ab.top - lb.top) < 40, ver: aside?.querySelector('.rt-ll-ver')?.getAttribute('href'), anchoPagina: document.documentElement.scrollWidth <= innerWidth }
  })
  if (!movil) {
    check('PC: la liga sale a la derecha de los retos', r.visible && r.alLado, JSON.stringify(r))
    check('  …los retos van a dos columnas', r.cols === 2, r.cols)
    check('  …con los cinco primeros y tú, aparte', r.filas.length === 6 && r.filas[0] === '1BBrock640' && r.filas[5] === '7TTú320', JSON.stringify(r.filas))
    check('  …y «Ver la clasificación» lleva a la de /retos (1188: salió de la portada)', r.ver === '/retos#clasificacion')
  } else {
    check('móvil: la liga no sale y los retos siguen a dos columnas', !r.visible && r.cols === 2, JSON.stringify(r))
  }
  check(`${movil ? 'móvil' : 'PC'}: la página no se sale de lado y sin errores`, r.anchoPagina && !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── E4 · Aprender sin repetirse ──')
{
  const semilla = () => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    const nombres = ['Primeros pasos', 'Comprar', 'Real o fake', 'Identificar', 'Historia', 'Mazos']
    window.__FAKE_CATEGORIAS__ = nombres.map((name, i) => ({ id: `cat-${i}`, name, slug: `tema-${i}`, description: name, order_pos: i }))
    const curso = [{ type: 'paragraph', text: 'x' }, { type: 'quiz', question: '¿?', options: ['a', 'b'], answer: 0 }]
    window.__FAKE_GUIAS__ = Array.from({ length: 12 }, (_, i) => ({ id: `g-${i}`, slug: `guia-${i}`, title: `Guía número ${i + 1}`, description: `Descripción ${i}`, published_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`, category_id: `cat-${i % 6}`, level: 'basico', estimated_mins: 4, blocks: i % 2 ? curso : [{ type: 'paragraph', text: 'x' }] }))
    // La más nueva (g-11, la primera de la lista) es la que estás siguiendo.
    window.__FAKE_PROGRESO__ = [{ user_id: 'user-1', guide_id: 'g-11', status: 'in_progress', read_at: null, current_block: 1, started_at: '2026-10-20T10:00:00Z' }]
  }
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/aprender`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const r = await page.evaluate(() => {
    const seguir = document.querySelector('.aprender-seguir')
    const dest = document.querySelector('#apLista > .guia-tarjeta')
    return {
      seguir: seguir?.querySelector('strong')?.textContent,
      barra: seguir?.querySelector('.aprender-seguir-barra i')?.style.width,
      destacada: dest?.querySelector('.guia-titulo')?.textContent,
      arte: Math.round(dest?.querySelector('.guia-arte')?.getBoundingClientRect().height || 0),
    }
  })
  check('«Sigue donde lo dejaste» es la guía que sigues', r.seguir === 'Guía número 12', JSON.stringify(r))
  check('  …y lleva su barra (50 %)', r.barra === '50%', r.barra)
  check('la destacada no la repite: la siguiente de su tema', r.destacada === 'Guía número 6', r.destacada)
  check('  …y su franja mide 52 px', r.arte === 52, r.arte)
  await page.fill('#apBuscar', 'número 12')
  await page.waitForTimeout(500)
  const buscando = await page.locator('#apLista > .guia-tarjeta .guia-titulo').first().textContent().catch(() => '')
  check('buscándola, sí sale arriba (manda lo que buscas)', buscando === 'Guía número 12', buscando)
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
