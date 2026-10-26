// Tanda 829 — /novedades: lo que cambia en PokeDoc, contado corto.
//
// PINGU: «hasta ahora lo tenemos como un post en el foro que voy
// actualizando a mano; ¿podríamos hacer un apartado?», y con la maqueta:
// «en el inicio junto con noticias y lanzamientos; menos info técnica y más
// visual, con las mejores mejoras; tres destacadas».
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const d = await import(`${RAIZ}/js/novedades-datos.js`)

console.log('── 1. Lo puro ──')
check('el lunes de una semana (y sin husos: el 2026-10-12 es lunes)', d.lunesDe('2026-10-14') === '2026-10-12' && d.lunesDe('2026-10-12') === '2026-10-12' && d.lunesDe('2026-10-18') === '2026-10-12' && d.lunesDe('2026-10-19') === '2026-10-19')
check('el rótulo de la semana', d.rotuloDeSemana('2026-10-12') === 'Semana del 12 de octubre')
const E = [
  { fecha: '2026-10-14', tipo: 'nuevo', texto: 'A' }, { fecha: '2026-10-13', tipo: 'arreglo', texto: 'B' },
  { fecha: '2026-10-09', tipo: 'mejora', texto: 'C' }, { fecha: 'mal', tipo: 'nuevo', texto: 'X' }, { fecha: '2026-10-10', tipo: 'raro', texto: 'Y' },
]
const s = d.porSemanas(E)
check('por semanas, la más nueva arriba, sin las que no valen', s.length === 2 && s[0].lunes === '2026-10-12' && s[0].entradas.map((e) => e.texto).join('') === 'AB' && s[1].entradas[0].texto === 'C', JSON.stringify(s))
check('filtrar por tipo', d.porSemanas(E, 'arreglo').length === 1 && d.porSemanas(E, 'arreglo')[0].entradas[0].texto === 'B')
const dest = d.destacadasDelMes([{ mes: '2026-09', titulo: 'v' }, ...[1, 2, 3, 4].map((i) => ({ mes: '2026-10', titulo: `n${i}` }))])
check('destacadas: las del último mes, como mucho tres', dest.mes === '2026-10' && dest.lista.length === 3 && d.nombreDeMes(dest.mes) === 'octubre')
check('«nuevo para ti»: solo lo de después de tu última visita, y nada la primera vez', d.semanasNuevas(s, '2026-10-10').has('2026-10-12') && !d.semanasNuevas(s, '2026-10-10').has('2026-10-05') && d.semanasNuevas(s, null).size === 0)
check('el punto del menú: hay si hay algo después, o si no has entrado nunca', d.hayNovedades(E, '2026-10-13') && !d.hayNovedades(E, '2026-10-14') && d.hayNovedades(E, null) && !d.hayNovedades([], null))
const m = await import(`${RAIZ}/js/novedades.js`)
check('un enlace solo si es de la casa (nada de javascript: ni de //fuera)', !/href/.test(m.filaHtml({ tipo: 'nuevo', texto: 'x', enlace: 'javascript:alert(1)' })) && !/href/.test(m.filaHtml({ tipo: 'nuevo', texto: 'x', enlace: '//malo.com' })) && /href="\/foro"/.test(m.filaHtml({ tipo: 'nuevo', texto: 'x', enlace: '/foro' })))
check('el texto va escapado', /&lt;b&gt;/.test(m.filaHtml({ tipo: 'nuevo', texto: '<b>x</b>' })))

console.log('\n── 2. El fichero de novedades ──')
const json = JSON.parse(readFileSync(`${RAIZ}/novedades.json`, 'utf8'))
check('todas las entradas valen (tipo, fecha y texto)', json.entradas.length > 0 && d.entradasValidas(json.entradas).length === json.entradas.length)
check('el mes más reciente tiene exactamente tres destacadas, cada una con su dibujo', d.destacadasDelMes(json.destacadas).lista.length === 3 && d.destacadasDelMes(json.destacadas).lista.every((x) => x.dibujo && x.enlace))
// Cada enlace lleva a una página que existe (la regla de la 510: un camino
// escrito es un enlace que nadie comprueba).
const RUTAS = new Set(['/', '/foro', '/retos', '/glosario', '/cartas', '/mi-coleccion', '/evento', '/novedades', '/noticias'])
const existe = (h) => {
  const ruta = h.split(/[?#]/)[0]
  if (RUTAS.has(ruta) || /^\/ilustrador\/[a-z0-9-]+$/.test(ruta)) return true
  return existsSync(`${RAIZ}${ruta.endsWith('.html') ? ruta : `${ruta}.html`}`)
}
const enlaces = [...json.entradas, ...json.destacadas].map((x) => x.enlace).filter(Boolean)
check('cada enlace lleva a una página que existe', enlaces.every(existe), JSON.stringify(enlaces.filter((h) => !existe(h))))
check('nada técnico en los textos (ni números de tanda ni nombres de función)', ![...json.entradas, ...json.destacadas].some((x) => /\btanda\b|\b8\d\d\b|\(\)|`|_/.test(`${x.texto} ${x.titulo || ''}`)))

console.log('\n── 3. Está en Inicio, junto a Noticias y Lanzamientos ──')
const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && readFileSync(`${RAIZ}/${f}`, 'utf8').includes('id="navbar"'))
const sin = paginas.filter((f) => (readFileSync(`${RAIZ}/${f}`, 'utf8').match(/<a href="\/lanzamientos\.html">Lanzamientos<\/a>\s*<a href="\/novedades">Novedades<\/a>/g) || []).length < 2)
check(`en las ${paginas.length} páginas con barra, detrás de Lanzamientos (barra de arriba y menú)`, !sin.length, JSON.stringify(sin))
const bm = await import(`${RAIZ}/js/barra-movil.js`)
check('la sección de /novedades es Inicio, con su icono', bm.SECCION_DE.Inicio.includes('novedades') && bm.iconoDePagina('novedades') === 'sparkles')
const html = readFileSync(`${RAIZ}/novedades.html`, 'utf8')
check('la página: su descripción, su canónica y su hoja', /<meta name="description" content="[^"]{40,}"/.test(html) && /rel="canonical" href="https:\/\/pokedoc\.es\/novedades"/.test(html) && /href="\/css\/novedades\.css"/.test(html))
check('en el mapa del sitio', /'\/novedades'/.test(readFileSync(`${RAIZ}/netlify/functions/sitemap.mjs`, 'utf8')))

console.log('\n── 4. La página ──')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
for (const [nombre, opc] of [['ordenador', { viewport: { width: 1280, height: 900 } }], ['móvil', { ...devices['iPhone 13'] }]]) {
  const ctx = await browser.newContext({ ...opc, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; localStorage.setItem('pokedoc-novedades-visto', '2026-10-12') })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(`${BASE}/novedades.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.nv-fila').length > 0, null, { timeout: 15000 }).catch(() => {})
  const v = await page.evaluate(() => ({
    dest: document.querySelectorAll('.nv-dest').length,
    dibujos: document.querySelectorAll('.nv-dest .nv-mini').length,
    titulo: document.getElementById('nvDestacadasTitulo')?.textContent,
    semanas: [...document.querySelectorAll('.nv-semana')].map((x) => ({ filas: x.querySelectorAll('.nv-fila').length, nuevo: Boolean(x.querySelector('.nv-punto')), mas: x.querySelector('[data-abrir]')?.textContent || '' })),
    filtros: [...document.querySelectorAll('.nv-filtro')].map((b) => b.textContent),
    ancho: document.documentElement.scrollWidth <= window.innerWidth + 1,
    visto: localStorage.getItem('pokedoc-novedades-visto'),
  }))
  console.log(`  [${nombre}]`)
  check('  tres destacadas con su dibujo, «Lo mejor de octubre»', v.dest === 3 && v.dibujos === 3 && v.titulo === 'Lo mejor de octubre', JSON.stringify(v))
  check('  dos semanas, seis filas como mucho, y «Ver N más»', v.semanas.length === 2 && v.semanas.every((x) => x.filas <= 6) && v.semanas.some((x) => /^Ver \d+ más/.test(x.mas)), JSON.stringify(v.semanas))
  check('  «nuevo para ti» en la semana de después de tu última visita, no en la otra', v.semanas[0].nuevo && !v.semanas[1].nuevo)
  check('  los filtros: Todo, Nuevo, Mejoras, Arreglos', v.filtros.join(',') === 'Todo,Nuevo,Mejoras,Arreglos')
  check('  no se sale de la pantalla a lo ancho', v.ancho)
  check('  apunta la visita (para la próxima vez y para el punto del menú)', v.visto === json.entradas.map((e) => e.fecha).sort().at(-1), v.visto)
  await page.click('.nv-filtro:has-text("Arreglos")')
  const arreglos = await page.evaluate(() => [...document.querySelectorAll('.nv-fila .nv-chip')].map((c) => c.textContent))
  check('  el filtro «Arreglos» deja solo arreglos', arreglos.length > 0 && arreglos.every((t) => t === 'Arreglo'), JSON.stringify(arreglos))
  await page.click('.nv-filtro:has-text("Todo")')
  const antes = await page.locator('.nv-semana').first().locator('.nv-fila').count()
  await page.locator('.nv-semana').first().locator('[data-abrir]').click()
  const despues = await page.locator('.nv-semana').first().locator('.nv-fila').count()
  check('  «Ver N más de esta semana» las enseña todas', despues > antes, `${antes} → ${despues}`)
  check('  sin errores de JavaScript', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. «Novedades» salió de la hoja «Tú» (918) y sigue en Inicio y en el pie ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/glosario.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#navUserBtn, .nav-user-btn', { timeout: 15000 }).catch(() => {})
  await page.click('#navUserBtn, .nav-user-btn').catch(() => {})
  await page.waitForSelector('#navUserDropdown .tu-baldosas', { timeout: 8000 }).catch(() => {})
  const r = await page.evaluate(() => ({
    enTu: Boolean(document.querySelector('#navUserDropdown a[href="/novedades"]')),
    fuera: [...document.querySelectorAll('a[href="/novedades"], a[href="/novedades.html"]')].filter((a) => !a.closest('#navUserDropdown')).length,
  }))
  check('«Novedades» ya no está en «Tú», y fuera de la hoja hay al menos un camino (Inicio, el pie)', !r.enTu && r.fuera >= 1, JSON.stringify(r))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
