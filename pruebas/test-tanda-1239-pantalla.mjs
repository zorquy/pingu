// Tanda 1239 — La bienvenida de cada sección (PINGU: «que te explique todas las
// subcategorías dentro de una categoría de la web… que solo salga la primera
// vez», y «que le salga a todo el mundo, aunque estén registrados»). Se mira:
//   · un navegador automático no la ve sin `?bienvenida=1` (las demás pruebas
//     siguen igual), ni en una ficha (`data-detalle`), ni encima de otra ventana;
//   · la regla de «una vez por sección» (`tocaBienvenida` con un navegador de
//     verdad): sin apuntar, sí; apuntada, no; con cuenta o sin ella;
//   · Colección con cuenta en el PC: siete páginas en dos columnas, «Estás aquí»
//     en el Panel, se apunta al abrir y una fila de la misma pantalla cambia de
//     pestaña sin recargar;
//   · /cartas sin cuenta: solo sus tres páginas, con su frase;
//   · el móvil: hoja pegada abajo, entera sin desplazarse, filas de 44, Esc;
//   · «Qué hay en esta sección» en el menú del avatar la vuelve a abrir.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true, ancho = 1440 } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { window.__FAKE_SESSION__ = s ? 'admin-1' : 'none' }, sesion)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta, espera = 2600) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(espera)
}
const abierta = (page) => page.evaluate(() => !!document.querySelector('#bvsDialogo[open]'))
const datos = (page) => page.evaluate(() => {
  const d = document.querySelector('#bvsDialogo')
  if (!d) return null
  const filas = [...d.querySelectorAll('.bvs-fila')]
  return {
    titulo: d.querySelector('h2')?.textContent.trim(),
    lema: d.querySelector('.bvs-banda p')?.textContent.trim(),
    filas: filas.map((f) => f.querySelector('b').firstChild.textContent.trim()),
    hrefs: filas.map((f) => f.getAttribute('href')),
    aqui: filas.filter((f) => f.classList.contains('aqui')).map((f) => f.querySelector('b').firstChild.textContent.trim()),
    columnas: new Set(filas.map((f) => Math.round(f.getBoundingClientRect().left))).size,
    altoFila: Math.min(...filas.map((f) => f.getBoundingClientRect().height)),
    cerrar: d.querySelector('.bvs-cerrar').getBoundingClientRect().width,
    abajo: Math.round(innerHeight - d.getBoundingClientRect().bottom),
    cabe: d.scrollHeight <= d.clientHeight + 1,
    nota: !!d.querySelector('.bvs-nota'),
    acento: getComputedStyle(d.querySelector('.bvs-ico') || d).backgroundColor,
  }
})

// ── 1. Sin pedirla, un navegador automático no la ve ──
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/foro.html')
  check('sin ?bienvenida=1, una prueba no la ve (el resto de la suite sigue igual)', !(await abierta(page)))
  await ir(page, '/tema.html?id=t1&bienvenida=1')
  check('en una ficha (data-detalle) no sale', !(await abierta(page)))
  // La regla de verdad, con un navegador que no es automático.
  const reglas = await page.evaluate(async () => {
    const m = await import('/js/bienvenida-seccion.js')
    const almacen = {}
    const win = (search = '') => ({ location: { search }, navigator: { webdriver: false }, localStorage: { getItem: (k) => almacen[k] ?? null, setItem: (k, v) => { almacen[k] = v } } })
    const doc = (seccion, detalle = false) => ({ documentElement: { dataset: { seccion }, hasAttribute: (a) => a === 'data-detalle' && detalle } })
    const r = {}
    r.nueva = m.tocaBienvenida({ doc: doc('jugar'), win: win() })
    almacen['pd-bienvenida-jugar'] = '2026-11-05'
    r.vista = m.tocaBienvenida({ doc: doc('jugar'), win: win() })
    r.otra = m.tocaBienvenida({ doc: doc('aprender'), win: win() })
    r.ficha = m.tocaBienvenida({ doc: doc('aprender', true), win: win() })
    r.sinSeccion = m.tocaBienvenida({ doc: doc(undefined), win: win() })
    r.sinAlmacen = m.tocaBienvenida({ doc: doc('aprender'), win: { location: { search: '' }, navigator: {}, localStorage: { getItem: () => { throw new Error('no') } } } })
    r.secciones = Object.keys(m.BIENVENIDAS)
    r.cuentas = Object.fromEntries(Object.entries(m.BIENVENIDAS).map(([k, v]) => [k, v.paginas.length]))
    return r
  })
  check('la primera vez en una sección, sale', reglas.nueva === true)
  check('apuntada, ya no sale', reglas.vista === false)
  check('apuntar una sección no apunta otra', reglas.otra === true)
  check('ni en una ficha ni en una página sin sección', reglas.ficha === false && reglas.sinSeccion === false)
  check('sin almacén del navegador no sale (si no, saldría en cada página)', reglas.sinAlmacen === false)
  check('cinco secciones con sus páginas', JSON.stringify(reglas.cuentas) === '{"inicio":4,"aprender":4,"cartas":7,"comunidad":4,"jugar":3}', JSON.stringify(reglas.cuentas))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

// ── 2. Colección con cuenta, en el PC ──
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?bienvenida=1')
  check('sale sola en Mi colección', await abierta(page))
  const d = await datos(page)
  check('«Tu colección, entera» con sus siete páginas', d?.titulo === 'Tu colección, entera' && d.filas.join('|') === 'Panel|Expansiones|Pokédex|Álbumes|Productos|Deseos y cambios|Buscar', JSON.stringify(d?.filas))
  check('«Estás aquí» en el Panel', JSON.stringify(d?.aqui) === '["Panel"]', JSON.stringify(d?.aqui))
  check('en dos columnas en el PC', d?.columnas === 2, d?.columnas)
  check('cada fila lleva a su pestaña', d?.hrefs.includes('/mi-coleccion?ver=mercado') && d?.hrefs.includes('/mi-coleccion?ver=album'), JSON.stringify(d?.hrefs))
  check('con cuenta, dice dónde volver a verla', d?.nota === true)
  check('«Bienvenid@ a Colección» y el botón dice «Entendido»', await page.evaluate(() => document.querySelector('#bvsDialogo .bvs-banda small')?.textContent.trim() === 'Bienvenid@ a Colección' && document.querySelector('#bvsDialogo .bvs-entendido')?.textContent.trim() === 'Entendido'))
  check('en el color de la sección (el ámbar de Colección)', /154, 95, 6|228, 180, 74/.test(d?.acento || ''), d?.acento)
  check('se apunta al abrirse', await page.evaluate(() => /^\d{4}-\d{2}-\d{2}$/.test(localStorage.getItem('pd-bienvenida-cartas') || '')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1239-coleccion-pc.png` })
  const antes = page.url()
  await page.click('#bvsDialogo .bvs-fila[data-bvs-pestania="album"]')
  await page.waitForTimeout(600)
  check('«Expansiones» cierra y cambia de pestaña sin recargar', !(await abierta(page)) && page.url().includes('mi-coleccion') && await page.evaluate(() => document.querySelector('.mc-pestania[data-pestania="album"]')?.getAttribute('aria-selected') === 'true'), antes + ' → ' + page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

// ── 3. /cartas sin cuenta ──
{
  const { ctx, page, errores } = await abrir({ sesion: false })
  await ir(page, '/cartas.html?bienvenida=1')
  const d = await datos(page)
  check('en el catálogo sin cuenta, solo sus tres páginas', d?.filas.join('|') === 'Expansiones|Productos|Buscar', JSON.stringify(d?.filas))
  check('…que enlazan a /cartas', d?.hrefs.every((h) => h.startsWith('/cartas?ver=')), JSON.stringify(d?.hrefs))
  check('…con la frase de quien no tiene cuenta', /Con una cuenta/.test(d?.lema || ''), d?.lema)
  check('…y sin la línea del avatar', d?.nota === false)
  check('cuatro páginas o menos, en una columna', d?.columnas === 1, d?.columnas)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

// ── 4. El móvil: hoja abajo, entera ──
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page, '/torneos.html?bienvenida=1')
  const d = await datos(page)
  check('Jugar en el móvil: tres (1358), «Estás aquí» en Torneos', d?.filas.length === 3 && JSON.stringify(d?.aqui) === '["Torneos"]', JSON.stringify(d))
  check('hoja pegada abajo', d && d.abajo <= 1, d?.abajo)
  check('cabe entera sin desplazarse en un iPhone', d?.cabe === true)
  check('filas y cerrar de 44 al dedo', d?.altoFila >= 44 && d?.cerrar >= 44, `${d?.altoFila} / ${d?.cerrar}`)
  if (CAPS) await page.screenshot({ path: `${CAPS}/1239-jugar-movil.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc la cierra', !(await abierta(page)))
  await ir(page, '/foro.html?bienvenida=1')
  const f = await datos(page)
  check('Comunidad: Foro, Eventos, Tiendas y Gente, en una columna', f?.filas.join('|') === 'Foro|Eventos|Tiendas|Gente' && f.columnas === 1, JSON.stringify(f?.filas))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1239-comunidad-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

// ── 5. Nunca encima de otra ventana ──
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/retos.html?bienvenida=1`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { const d = document.createElement('dialog'); d.id = 'otra'; d.textContent = 'otra'; document.body.appendChild(d); d.showModal() })
  await page.waitForTimeout(2600)
  check('con otra ventana abierta no sale…', !(await abierta(page)))
  check('…y no se apunta (sale en la página siguiente)', await page.evaluate(() => !localStorage.getItem('pd-bienvenida-aprender')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

// ── 6. «Qué hay en esta sección» desde el avatar ──
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrir({ movil })
  await ir(page, '/aprender.html')
  check(`${movil ? 'móvil' : 'PC'}: no sale sola`, !(await abierta(page)))
  // En el PC ancho la lateral tapa la barra de arriba: el clic va al botón.
  await page.evaluate(() => document.getElementById('navUserBtn')?.click())
  await page.waitForSelector('[data-tu="bienvenida"]', { timeout: 5000 }).catch(() => {})
  const boton = await page.$('[data-tu="bienvenida"]')
  check(`${movil ? 'móvil' : 'PC'}: «Qué hay en esta sección» en el menú del avatar`, !!boton)
  if (boton) {
    await boton.evaluate((b) => b.click())
    await page.waitForTimeout(800)
    const d = await datos(page)
    check(`${movil ? 'móvil' : 'PC'}: abre la de Aprender con «Guías y cursos» marcada`, (await abierta(page)) && d?.titulo === 'Aprende a jugar y a coleccionar' && JSON.stringify(d.aqui) === '["Guías y cursos"]', JSON.stringify(d))
    check(`${movil ? 'móvil' : 'PC'}: el menú se cierra`, await page.evaluate(() => document.getElementById('navUserDropdown')?.classList.contains('hidden')))
    if (CAPS && !movil) await page.screenshot({ path: `${CAPS}/1239-aprender-pc.png` })
    await page.click('#bvsDialogo .bvs-entendido')
    await page.waitForTimeout(300)
    check(`${movil ? 'móvil' : 'PC'}: «Entendido» la cierra`, !(await abierta(page)))
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
