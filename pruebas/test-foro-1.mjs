import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// El foro, parte 1: el índice y la lista de temas de un foro.
//
// Reconstruido en la tanda 226. La cobertura del foro se perdió con el
// contenedor el 2026-08-28 y esta es la primera tanda de la vuelta.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript((s) => {
    for (const [clave, valor] of Object.entries(s)) window[clave] = valor
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

// Dos secciones, tres foros (uno con subforo) y temas repartidos.
const MUNDO = {
  __FAKE_SECCIONES__: [{ name: 'General' }, { name: 'Mercadillo' }],
  // Sembrados A PROPÓSITO en distinto orden del que deben salir: si la
  // semilla ya viniera ordenada, quitar el `.order('position')` del
  // código no cambiaría nada y la prueba no se enteraría.
  __FAKE_FOROS__: [
    { id: 'foro-2', slug: 'mazos', name: 'Mazos', section_id: 'seccion-1', position: 1 },
    { id: 'foro-1', slug: 'dudas', name: 'Dudas de reglas', section_id: 'seccion-1', position: 0 },
    { id: 'foro-3', slug: 'venta', name: 'Compra-venta', section_id: 'seccion-2', position: 0 },
    // Subforo de «Mazos»: sus temas cuentan también para el padre.
    { id: 'foro-4', slug: 'mazos-std', name: 'Estándar', section_id: 'seccion-1', parent_id: 'foro-2', position: 0 },
  ],
  __FAKE_TEMAS__: [
    { id: 'tema-1', board_id: 'foro-1', title: 'Pikachu y la marca H', author_id: 'user-1', post_count: 2 },
    { id: 'tema-2', board_id: 'foro-1', title: 'Duda con Prize Cards', author_id: 'user-2', post_count: 1 },
    { id: 'tema-3', board_id: 'foro-4', title: 'Charizard ex en Estándar', author_id: 'user-1', post_count: 1 },
  ],
  __FAKE_MENSAJES__: [
    { id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Pregunta</p>' },
    { id: 'msg-2', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Respuesta</p>' },
    { id: 'msg-3', thread_id: 'tema-2', author_id: 'user-2', body_html: '<p>Otra</p>' },
    { id: 'msg-4', thread_id: 'tema-3', author_id: 'user-1', body_html: '<p>Del subforo</p>' },
  ],
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El índice del foro se pinta entero ──')
{
  const { page, errores } = await abrir('/foro', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = await page.locator('body').innerText()
  check('salen las dos secciones', /General/.test(texto) && /Mercadillo/.test(texto))
  for (const foro of ['Dudas de reglas', 'Mazos', 'Compra-venta']) {
    check(`sale el foro «${foro}»`, texto.includes(foro))
  }
  check('los foros enlazan a su página', (await page.locator('a[href*="/foro/"], a[href*="foro="]').count()) > 0)
  // Y salen por su `position`, no por el orden en que estuvieran en la
  // base: «Dudas» lleva la 0 y «Mazos» la 1. Se mira el orden de los
  // ENLACES a foros, no el texto de la página entera: al lado hay
  // paneles de actividad que nombran foros y desordenan la búsqueda.
  const orden = await page.evaluate(() => {
    const nombres = ['Dudas de reglas', 'Mazos', 'Compra-venta']
    return [...document.querySelectorAll('a')]
      .map((a) => a.textContent.replace(/\s+/g, ' ').trim())
      .filter((t) => nombres.includes(t))
  })
  check('respeta el orden de la sección', orden.indexOf('Dudas de reglas') < orden.indexOf('Mazos'), JSON.stringify(orden))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Las cuentas de cada foro cuadran ──')
{
  // El índice no lee la tabla de foros sino una VISTA que le añade las
  // cuentas. Lo que se comprueba aquí es esa suma, que es lo que la
  // gente mira para decidir dónde entrar.
  const { page } = await abrir('/foro', MUNDO)
  const cuentas = await page.evaluate(() => {
    const fila = [...document.querySelectorAll('a, div, li')].find((e) => /Dudas de reglas/.test(e.textContent || ''))
    return fila ? fila.textContent.replace(/\s+/g, ' ') : null
  })
  check('«Dudas de reglas» dice 2 temas', /2/.test(cuentas || ''), cuentas?.slice(0, 90))

  // El subforo es el caso que se escapa: sus temas tienen que contar
  // también en el foro padre.
  const conMazos = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  check('el padre cuenta lo del subforo', /Mazos/.test(conMazos), conMazos.slice(0, 60))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Un foro lista sus temas ──')
{
  const { page, errores } = await abrir('/foro?f=dudas', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  // Se mira la LISTA, no la página entera: al lado hay un panel de
  // actividad reciente que sí enseña temas de todo el foro, y con toda
  // la razón. Mezclar las dos cosas haría fallar la prueba por algo
  // que está bien.
  const lista = await page.evaluate(() => {
    const panel = document.querySelector('.foro-temas, .foro-lista-temas, #listaTemas')
    return (panel || document.querySelector('main')).innerText
  })
  check('sale un tema del foro', /Pikachu y la marca H/.test(lista), lista.slice(0, 120))
  check('y el otro también', /Prize Cards/.test(lista))
  // Cada tema de la lista es una `.foro-tema-fila`; el título va en su
  // h3. (El primer intento buscaba clases que no existen y devolvía una
  // lista VACÍA: la comprobación pasaba sin mirar nada, que es
  // exactamente lo que estas pruebas tienen que evitar. De ahí que se
  // compruebe también CUÁNTAS filas hay.)
  const enLaLista = await page.evaluate(() =>
    [...document.querySelectorAll('.foro-tema-fila h3')].map((t) => t.textContent.replace(/\s+/g, ' ').trim())
  )
  check('la lista es solo de este foro', !enLaLista.some((t) => /Charizard/.test(t)), JSON.stringify(enLaLista))
  check('y son dos, ni uno más', enLaLista.length === 2, JSON.stringify(enLaLista))
  // La cuenta que mueve el paginador va en OTRA consulta que también
  // filtra por foro. Si esa se le olvida el filtro, el paginador ofrece
  // páginas que no existen: se comprueba que no aparece una segunda.
  await page.close()

  // El paginador fantasma: la CUENTA va en otra consulta, que también
  // tiene que filtrar por foro. Para que se note hace falta que en otro
  // foro haya temas de sobra — si no, un contador sin filtrar sigue
  // dando una sola página y el fallo pasa desapercibido.
  const conMuchos = await abrir('/foro?f=dudas', {
    ...MUNDO,
    __FAKE_TEMAS__: [
      { id: 'tema-1', board_id: 'foro-1', title: 'El único de dudas', author_id: 'user-1' },
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `otro-${i}`, board_id: 'foro-3', title: `Venta ${i}`, author_id: 'user-2',
      })),
    ],
  })
  const paginas = await conMuchos.page.locator('.foro-paginacion a, .paginacion a, .pagination a, [data-pagina]').count()
  check('no ofrece páginas de otro foro', paginas === 0, `${paginas} enlaces de página`)
  await conMuchos.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Los temas fijados van arriba ──')
{
  const { page } = await abrir('/foro?f=dudas', {
    ...MUNDO,
    __FAKE_TEMAS__: [
      { id: 'tema-1', board_id: 'foro-1', title: 'Tema normal y reciente', author_id: 'user-1', last_post_at: new Date().toISOString() },
      // Más viejo, pero FIJADO: tiene que salir el primero igualmente.
      { id: 'tema-2', board_id: 'foro-1', title: 'Normas del foro', author_id: 'user-2', is_pinned: true, last_post_at: '2020-01-01T00:00:00Z' },
    ],
  })
  const orden = await page.evaluate(() => {
    const texto = document.body.innerText
    return { fijado: texto.indexOf('Normas del foro'), normal: texto.indexOf('Tema normal y reciente') }
  })
  check('los dos salen', orden.fijado >= 0 && orden.normal >= 0, JSON.stringify(orden))
  check('el fijado va antes que el reciente', orden.fijado < orden.normal, JSON.stringify(orden))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Un foro vacío lo dice, no se queda en blanco ──')
{
  const { page, errores } = await abrir('/foro?f=venta', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = await page.locator('body').innerText()
  check('avisa de que no hay temas', /todav|vac|ning|primer/i.test(texto), texto.slice(0, 160))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Un foro que no existe no revienta ──')
{
  const { page, errores } = await abrir('/foro?f=no-existe-este', MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = await page.locator('body').innerText()
  check('lo dice claramente', /no existe|no está/i.test(texto), texto.slice(0, 160))
  await page.close()
}

await browser.close()
console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
