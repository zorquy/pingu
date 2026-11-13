// Tanda 1338 — Aprender: los temas como filtro que se queda. El título pasa a
// «Aprende Pokémon TCG»; al elegir un tema no se cambia de página: la baldosa
// elegida conserva su color (aro y ✕), las demás se ponen en gris, sale la
// línea del tema y la misma rejilla, solo con las suyas, «En orden» y con sus
// grupos. En el móvil, los temas en cuadrados de 3 × 2, las guías en filas
// (sin la grande) y sin «Sigue donde lo dejaste».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const FOTOS = process.env.PD_FOTOS || ''
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()

const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_CATEGORIAS__ = [
    { id: 'cat-pasos', name: 'Primeros pasos', slug: 'primeros-pasos', description: 'Vocabulario esencial y mecánicas fundamentales', order_pos: 1 },
    { id: 'cat-compra', name: 'Comprar, vender & mercado', slug: 'mercado', description: 'Precios y tiendas', order_pos: 2 },
    { id: 'cat-fake', name: '¿Es real o fake?', slug: 'fake', description: 'Detectar falsificaciones', order_pos: 3 },
    { id: 'cat-ident', name: 'Identificar cartas', slug: 'identificar', description: 'Leer una carta', order_pos: 4 },
    { id: 'cat-hist', name: 'Historia & curiosidades', slug: 'historia', description: 'La historia del TCG', order_pos: 5 },
    { id: 'cat-mazos', name: 'Mazos & estrategia', slug: 'mazos', description: 'Listas, arquetipos y cómo jugarlas', order_pos: 6 },
  ]
  window.__FAKE_FILAS__ = { guide_collections: [{ id: 'col-basico', title: 'Lo básico', category_id: 'cat-mazos' }, { id: 'col-arq', title: 'Arquetipos', category_id: 'cat-mazos' }] }
  const curso = [{ type: 'paragraph', text: 'x' }, { type: 'quiz', question: '¿?', options: ['a', 'b'], answer: 0 }]
  const g = (i, titulo, cat, extra = {}) => ({ id: `g-${i}`, slug: `guia-${i}`, title: titulo, description: `Descripción ${i}`, published_at: `2026-10-${String(i).padStart(2, '0')}T10:00:00Z`, category_id: cat, level: 'basico', estimated_mins: 4 + i, blocks: [{ type: 'paragraph', text: 'x' }], ...extra })
  window.__FAKE_GUIAS__ = [
    g(1, 'Cómo leer una carta', 'cat-pasos'), g(2, 'Tu primer mazo', 'cat-pasos', { blocks: curso }),
    g(3, 'Arquetipo Beedrill ex', 'cat-mazos', { blocks: curso, collection_id: 'col-arq', collection_order: 3 }),
    g(4, '3 claves mentales', 'cat-mazos', { collection_id: 'col-basico', collection_order: 1 }),
    g(5, 'Cómo jugar Charizard ex', 'cat-mazos', { collection_id: 'col-arq', collection_order: 4 }),
    g(6, 'El mulligan', 'cat-mazos', { collection_id: 'col-basico', collection_order: 2 }),
    g(7, 'Cuánto vale una caja', 'cat-compra'), g(8, 'Cómo detectar una falsa', 'cat-fake'), g(9, 'Los símbolos de rareza', 'cat-ident'), g(10, 'Las Vending de 1998', 'cat-hist'),
  ]
  window.__FAKE_PROGRESO__ = sesion === 'none' ? [] : [
    { user_id: 'user-1', guide_id: 'g-4', status: 'completed', read_at: '2026-10-10T10:00:00Z', current_block: 1 },
    { user_id: 'user-1', guide_id: 'g-3', status: 'in_progress', read_at: null, current_block: 1, started_at: '2026-10-11T10:00:00Z' },
  ]
}
async function abrir(ruta, { movil = false, sesion = 'user-1' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { sesion })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#apLista .guia-portada, #apLista .guia-fila, #apLista a', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { page, ctx, errores }
}
const estado = (page) => page.evaluate(() => ({
  url: location.pathname + location.search,
  titulo: document.title,
  h1: document.querySelector('.ap-cab h1')?.textContent,
  baldosas: [...document.querySelectorAll('#apTemas .ap-baldosa')].map((b) => ({ slug: b.dataset.tema, on: b.classList.contains('on'), gris: getComputedStyle(b).filter.includes('grayscale') })),
  linea: document.getElementById('apTemaLinea')?.hidden ? null : document.getElementById('apTemaLinea')?.textContent.replace(/\s+/g, ' ').trim(),
  guias: [...document.querySelectorAll('#apLista .guia-portada strong, #apLista .guia-fila-titulo, #apLista .guia-fila strong')].map((x) => x.textContent.trim()),
  grupos: [...document.querySelectorAll('#apLista .ap-grupo')].map((x) => x.textContent),
  orden: [...document.querySelectorAll('[data-ap-orden]')].filter((b) => !b.hidden).map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`),
  buscar: document.getElementById('apBuscar')?.placeholder,
}))

console.log('── PC ──')
{
  const { page, ctx, errores } = await abrir('/aprender')
  let e = await estado(page)
  check('el título es «Aprende Pokémon TCG»', e.h1 === 'Aprende Pokémon TCG', e.h1)
  check('sin tema: las seis en color, sin línea del tema, sin «En orden»', e.baldosas.length === 6 && e.baldosas.every((b) => !b.on && !b.gris) && e.linea === null && !e.orden.some((o) => o.startsWith('En orden')), JSON.stringify(e))
  check('  …y las diez guías', e.guias.length === 10, e.guias.length)
  await page.click('#apTemas .ap-baldosa[data-tema="mazos"]')
  await page.waitForTimeout(700)
  e = await estado(page)
  check('al pulsar un tema no se cambia de página: la dirección es /aprender?tema=mazos', e.url === '/aprender?tema=mazos' && (await page.evaluate(() => performance.getEntriesByType('navigation').length)) === 1, e.url)
  check('  …la elegida en color y con aro, las otras cinco en gris', e.baldosas.filter((b) => b.on).map((b) => b.slug).join() === 'mazos' && e.baldosas.filter((b) => !b.on).every((b) => b.gris), JSON.stringify(e.baldosas))
  check('  …y su ✕ a la vista', await page.locator('#apTemas .ap-baldosa.on .ap-baldosa-quitar').isVisible())
  check('  …la línea del tema: nombre, descripción, «1 de 4 leídas» y «Quitar»', /^Mazos & estrategia Listas, arquetipos y cómo jugarlas 1 de 4 leídas Quitar$/.test(e.linea || ''), e.linea)
  check('  …«En orden» puesto, y el buscador busca en el tema', e.orden[0] === 'En orden*' && e.buscar === 'Busca en Mazos & estrategia' && e.titulo.startsWith('Mazos & estrategia'), JSON.stringify(e.orden) + ' ' + e.buscar)
  check('  …solo sus cuatro guías, en el orden del temario y con sus grupos de título', e.guias.join('|') === '3 claves mentales|El mulligan|Arquetipo Beedrill ex|Cómo jugar Charizard ex' && e.grupos.join('|') === 'Lo básico|Arquetipos', JSON.stringify(e.guias) + JSON.stringify(e.grupos))
  check('  …las tarjetas son las mismas de la portada (portadas)', (await page.locator('#apLista .guia-portada').count()) === 4)
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/pc-tema.png` })
  await page.click('[data-ap-orden="recientes"]')
  await page.waitForTimeout(300)
  e = await estado(page)
  check('«Recientes» dentro del tema: las suyas, sin grupos', e.guias.length === 4 && e.grupos.length === 0 && e.guias[0] === 'El mulligan', JSON.stringify(e.guias))
  await page.click('#apSoloCursos')
  await page.waitForTimeout(300)
  e = await estado(page)
  check('«Solo cursos»: la del curso', e.guias.join() === 'Arquetipo Beedrill ex', JSON.stringify(e.guias))
  await page.click('#apSoloCursos')
  await page.click('#apTemas .ap-baldosa[data-tema="primeros-pasos"]')
  await page.waitForTimeout(500)
  e = await estado(page)
  check('pulsar otra cambia de tema directamente', e.url === '/aprender?tema=primeros-pasos' && e.guias.length === 2 && e.baldosas.find((b) => b.on)?.slug === 'primeros-pasos', JSON.stringify(e))
  await page.goBack()
  await page.waitForTimeout(500)
  e = await estado(page)
  check('«atrás» vuelve al tema de antes, sin recargar', e.url === '/aprender?tema=mazos' && e.baldosas.find((b) => b.on)?.slug === 'mazos', e.url)
  await page.click('[data-ap-quitar]')
  await page.waitForTimeout(500)
  e = await estado(page)
  check('«Quitar»: todas otra vez, en color, en /aprender', e.url === '/aprender' && e.guias.length === 10 && e.baldosas.every((b) => !b.on && !b.gris) && e.linea === null, JSON.stringify(e))
  await page.click('#apTemas .ap-baldosa[data-tema="mazos"]')
  await page.click('#apTemas .ap-baldosa[data-tema="mazos"]')
  await page.waitForTimeout(400)
  check('pulsar la elegida otra vez también la quita', (await estado(page)).url === '/aprender')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir('/aprender?tema=historia')
  const e = await estado(page)
  check('una dirección con tema abre ya filtrada', e.baldosas.find((b) => b.on)?.slug === 'historia' && e.guias.join() === 'Las Vending de 1998', JSON.stringify(e))
  const v = await abrir('/aprender?tema=no-existe')
  const e2 = await estado(v.page)
  check('un tema que no existe no filtra nada', e2.guias.length === 10 && e2.baldosas.every((b) => !b.on), JSON.stringify(e2.guias.length))
  check('  …sin errores', errores.length === 0 && v.errores.length === 0, [...errores, ...v.errores].join(' | '))
  await ctx.close(); await v.ctx.close()
}

console.log('── Móvil ──')
{
  const { page, ctx, errores } = await abrir('/aprender', { movil: true })
  const m = await page.evaluate(() => {
    const z = document.getElementById('apTemas')
    const bs = [...z.querySelectorAll('.ap-baldosa')].map((b) => b.getBoundingClientRect())
    const filas = new Set(bs.map((r) => Math.round(r.top)))
    return {
      columnas: new Set(bs.map((r) => Math.round(r.left))).size, filas: filas.size,
      alto: Math.round(z.getBoundingClientRect().height), desliza: z.scrollWidth > z.clientWidth + 2,
      corto: getComputedStyle(z.querySelector('[data-corto]'), '::after').content,
      seguir: (() => { const s = document.querySelector('#categoriesList > .aprender-seguir'); return s ? getComputedStyle(s).display : 'none' })(),
      grande: document.querySelectorAll('#apLista .guia-tarjeta, #apLista .guia-portada').length,
      filasGuia: document.querySelectorAll('#apLista .ap-filas > *').length,
      ancho: [document.documentElement.scrollWidth, innerWidth],
    }
  })
  check('los seis temas de golpe: 3 columnas × 2 filas, sin deslizar', m.columnas === 3 && m.filas === 2 && !m.desliza, JSON.stringify(m))
  check('  …en menos de 200 px de alto', m.alto < 200, m.alto)
  check('  …con los nombres cortos («Comprar y vender»)', m.corto === '"Comprar y vender"', m.corto)
  check('sin «Sigue donde lo dejaste» (ya está en Inicio)', m.seguir === 'none', m.seguir)
  check('las guías, todas en filas: ninguna grande', m.grande === 0 && m.filasGuia === 10, JSON.stringify(m))
  check('sin desbordar a lo ancho', m.ancho[0] <= m.ancho[1], JSON.stringify(m.ancho))
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/movil.png` })
  await page.locator('#apTemas .ap-baldosa[data-tema="mazos"]').tap()
  await page.waitForTimeout(500)
  const e = await estado(page)
  check('al tocar un tema: el elegido en color, los demás en gris, y sus cuatro guías en filas', e.baldosas.find((b) => b.on)?.slug === 'mazos' && e.baldosas.filter((b) => !b.on).every((b) => b.gris) && (await page.locator('#apLista .ap-filas > *').count()) === 4, JSON.stringify(e.baldosas))
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/movil-tema.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
