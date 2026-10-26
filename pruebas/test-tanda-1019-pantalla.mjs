// Tanda 1019 — A2, A3 y D10 de «PokeDoc como app»: en el móvil, una página
// de detalle (un tema, una guía, un torneo) lleva la cabecera de app —volver,
// de dónde vienes, compartir— y no pinta sus migas; el pie se queda en dos
// líneas (los enlaces siguen en el HTML, para Google); y los datos de un
// torneo van en dos columnas. Una página de lista (Aprender) no cambia.
import { readFileSync, readdirSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── 1. El generador y el CSS ──')
{
  const gen = await import(`${RAIZ}/generar-barra-movil.mjs`)
  const con = (f) => /<html[^>]* data-detalle>/.test(readFileSync(`${RAIZ}/${f}`, 'utf8'))
  check('tema, guía, torneo y usuario llevan data-detalle; aprender, foro, torneos y la portada no', con('tema.html') && con('guia.html') && con('torneo.html') && con('usuario.html') && !con('aprender.html') && !con('foro.html') && !con('torneos.html') && !con('index.html'))
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && f !== 'cartas.html' && readFileSync(`${RAIZ}/${f}`, 'utf8').includes('id="navbar"'))
  const distintas = paginas.filter((f) => { const h = readFileSync(`${RAIZ}/${f}`, 'utf8'); return gen.conSeccion(h, f) !== h })
  check('el repo lleva data-seccion y data-detalle tal como salen del generador', distintas.length === 0, distintas.join(', '))
  const movil = readFileSync(`${RAIZ}/css/movil.css`, 'utf8')
  check('las migas se esconden por data-detalle (antes del primer pintado), no por una clase que ponga el JavaScript', /html\.con-barra-movil\[data-detalle\] \.breadcrumb,\s*html\.con-barra-movil\[data-detalle\] \.foro-migas/.test(movil))
  check('el pie del móvil esconde las columnas y el lema, no los quita del HTML', /\.pie-rejilla \.pie-col,\s*\.pie-lema \{\s*display: none;/.test(movil) && readFileSync(`${RAIZ}/aprender.html`, 'utf8').includes('class="pie-col"'))
}

const b = await chromium.launch()
async function abrir(ruta, { referrer } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'; localStorage.setItem('pokedoc-onboarding', '1')
    const dia = (d) => new Date(Date.now() - d * 86400e3).toISOString().slice(0, 10)
    window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'liga-fdn-otono', name: 'Liga FDN [Oct–Dic] · jornada 3', description: 'Liga de tres meses.', status: 'in_progress', format: 'league', start_at: new Date(Date.now() + 5 * 86400e3).toISOString(), max_players: 32, admin_id: 'admin-1', matchday_dates: [dia(14), dia(0), dia(-5)], is_official: true }]
    window.__FAKE_INSCRIPCIONES__ = ['user-1', 'user-2', 'user-3'].map((u, i) => ({ id: `ins-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', created_at: new Date().toISOString() }))
    const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'Misty', display_name: 'Misty', total_xp: 3900, level: 9 }]
    window.__FAKE_SECCIONES__ = [{ id: 'seccion-2', name: 'Juego', position: 1 }]
    window.__FAKE_FOROS__ = [{ id: 'foro-3', slug: 'competitivo', name: 'Competitivo', description: 'Mazos, torneos y meta', section_id: 'seccion-2', position: 0 }]
    window.__FAKE_TEMAS__ = [{ id: 'tema-2', board_id: 'foro-3', title: '¿Charizard sigue siendo top tras la rotación?', author_id: 'user-2', prefix: null, post_count: 2, view_count: 840, last_post_at: hace(6), last_post_author_id: 'user-2', created_at: hace(40), is_pinned: true }]
    window.__FAKE_MENSAJES__ = [{ id: 'msg-3', thread_id: 'tema-2', author_id: 'user-2', body_html: '<p>Con la rotación pierde Rare Candy antiguo pero gana Night Stretcher.</p>', created_at: hace(40) }, { id: 'msg-4', thread_id: 'tema-2', author_id: 'user-1', body_html: '<p>Top 3 seguro.</p>', created_at: hace(30) }]
    window.__FAKE_CATEGORIAS__ = [{ id: 'cat-2', slug: 'competitivo', name: 'Competitivo', description: 'Torneos y meta' }]
    window.__FAKE_GUIAS__ = [{ id: 'guia-2', slug: 'charizard-ex', title: 'Guía de Charizard ex para Estándar', description: 'Lista, plan de juego y emparejamientos.', kind: 'guide', category_id: 'cat-2', estimated_mins: 14, author_id: 'user-2', published_at: new Date(Date.now() - 86400e3).toISOString(), created_at: new Date(Date.now() - 2 * 86400e3).toISOString(), view_count: 120, blocks: [{ type: 'paragraph', text: 'Charizard ex sigue siendo top tras la rotación.' }], level: 'intermediate' }]
  })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', referer: referrer })
  await p.waitForTimeout(2500)
  return { p, ctx, errores }
}
const visible = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' }, sel)

console.log('\n── 2. Un tema del foro ──')
{
  const { p, ctx, errores } = await abrir('/tema/tema-2')
  const cab = await p.evaluate(() => {
    const c = document.querySelector('.bm-cab'); if (!c) return null
    return { contexto: c.querySelector('.bm-cab-titulo small')?.textContent, titulo: c.querySelector('.bm-cab-titulo span')?.textContent, tituloVisible: getComputedStyle(c.querySelector('.bm-cab-titulo span')).display !== 'none', volver: !!c.querySelector('.bm-cab-volver'), compartir: !!c.querySelector('.bm-cab-compartir'), alto: c.getBoundingClientRect().height }
  })
  check('la barra de arriba es la cabecera de detalle: volver, «Competitivo» y compartir', cab && cab.volver && cab.compartir && cab.contexto === 'Competitivo', JSON.stringify(cab))
  check('  …el título del hilo está listo pero no se ve mientras el <h1> está en pantalla', cab && /Charizard/.test(cab.titulo || '') && cab.tituloVisible === false, JSON.stringify(cab))
  check('  …y el logo, el buscador y las migas no se ven', !(await visible(p, '.nav-logo')) && !(await visible(p, '.bm-pastilla')) && !(await visible(p, '.foro-migas')))
  await p.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
  await p.waitForTimeout(600)
  check('al bajar, el título sube a la cabecera', await p.evaluate(() => document.querySelector('.bm-cab')?.classList.contains('bm-cab-con-titulo')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Volver ──')
{
  const { p, ctx } = await abrir('/tema/tema-2')
  await p.click('.bm-cab-volver')
  await p.waitForTimeout(1200)
  check('sin venir de PokeDoc, «volver» lleva a la miga (el foro Competitivo), nunca fuera', /foro/.test(p.url()) && !/tema\.html/.test(p.url()), p.url())
  await ctx.close()
}

console.log('\n── 4. Una guía y un torneo ──')
{
  const { p, ctx, errores } = await abrir('/guia.html?slug=charizard-ex')
  const cab = await p.evaluate(() => { const c = document.querySelector('.bm-cab'); return c ? { contexto: c.querySelector('small')?.textContent, titulo: c.querySelector('span')?.textContent } : null })
  check('la guía lleva cabecera con su categoría y su título', cab && cab.contexto && /Charizard/.test(cab.titulo || ''), JSON.stringify(cab))
  check('  …y sin migas en el contenido', !(await visible(p, '.breadcrumb')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/torneo.html?slug=liga-fdn-otono')
  const datos = await p.evaluate(() => { const f = document.querySelector('.torneo-formato'); if (!f) return null; const r = [...f.querySelectorAll('.torneo-dato')].map((d) => d.getBoundingClientRect()); return { n: r.length, columnas: new Set(r.map((x) => Math.round(x.left))).size, filas: new Set(r.map((x) => Math.round(x.top))).size, alto: f.getBoundingClientRect().height } })
  check('los datos del torneo van en dos columnas (cinco datos, tres filas)', datos && datos.n >= 4 && datos.columnas === 2 && datos.filas <= Math.ceil(datos.n / 2), JSON.stringify(datos))
  check('  …con la cabecera de detalle «Torneos»', (await p.evaluate(() => document.querySelector('.bm-cab small')?.textContent)) === 'Torneos')
  await ctx.close()
}

console.log('\n── 5. Una página de lista no cambia, y el pie es corto ──')
{
  const { p, ctx } = await abrir('/aprender.html')
  check('Aprender sigue con logo y buscador, sin cabecera de detalle', (await visible(p, '.nav-logo')) && (await visible(p, '.bm-pastilla')) && !(await p.$('.bm-cab')))
  const pie = await p.evaluate(() => { const f = document.querySelector('.footer'); const r = f.getBoundingClientRect(); return { alto: r.height, enlaces: f.querySelectorAll('a').length, columnasVisibles: [...f.querySelectorAll('.pie-col')].filter((c) => c.getBoundingClientRect().height > 0).length, marca: !!f.querySelector('.pie-marca') && getComputedStyle(f.querySelector('.pie-marca')).display !== 'none' } })
  check('el pie mide menos de 180 px, con la marca a la vista y las columnas escondidas', pie.alto < 180 && pie.marca && pie.columnasVisibles === 0, JSON.stringify(pie))
  check('  …y sus enlaces siguen en el HTML (los lee Google)', pie.enlaces >= 20, pie.enlaces)
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/aprender.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const cols = await p.evaluate(() => [...document.querySelectorAll('.footer .pie-col')].filter((c) => c.getBoundingClientRect().height > 0).length)
  check('en el PC el pie conserva las columnas', cols === 3, cols)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
