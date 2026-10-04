// Tanda 549 — «Hacer el curso» llevaba a «Guía no encontrada».
//
// PINGU, con la captura delante: «te he pasado el botón de una guía… y si le
// das, te sale lo de guía no encontrada».
//
// Y la 548 no era esto. Esa guía SÍ tiene curso —la llamada dice «preguntas,
// racha y medalla, se tarda 8 minutos»—: lo que estaba roto era el ENLACE.
//
// Una guía se sirve en `/guia/<slug>`, y el botón apuntaba a
// `curso.html?slug=…` **en relativo**. Desde `/guia/mi-guia` el navegador lo
// resuelve a `/guia/curso.html`, que casa con la reescritura `/guia/:slug` y
// devuelve… la página de la guía, buscando una con el slug «curso.html». De
// ahí «Guía no encontrada».
//
// Es la trampa de la 327 otra vez —la que dejó /coleccion/tr sin CSS porque
// el navegador pedía /coleccion/css/style.css—, y `netlify.toml` la tiene
// escrita desde la 269: «por eso guia.html pasó a enlazar todo con rutas
// absolutas». Lo que nunca se enteró fue el JAVASCRIPT que pinta los
// enlaces, que es donde están los seis de esta página.
//
// Y no se veía desde dentro: en `/guia.html?slug=mi-guia` —como se abre una
// guía en las pruebas viejas— el enlace relativo funciona perfectamente. La
// dirección bonita es la que la gente usa.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. LA GUARDA: ningún enlace relativo pintado desde JavaScript ──')
{
  // La regla es sencilla y se puede comprobar: **todo enlace absoluto**. Un
  // relativo funciona en las páginas de la raíz y se rompe en las ocho que
  // se sirven en una dirección bonita (`/guia/`, `/noticias/`, `/usuario/`,
  // `/foro/`, `/tema/`, `/meta/`, `/carta/`, `/coleccion/`) — y como un
  // módulo compartido puede acabar en cualquiera, la regla vale para todos.
  const malos = []
  const barrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) { barrer(ruta); continue }
      if (!e.name.endsWith('.js')) continue
      const codigo = readFileSync(ruta, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      // Un enlace a una página nuestra: `href="algo.html"` sin barra
      // delante. Los que empiezan por `/`, `#`, `http` o por un `${…}`
      // —que sale de `profileUrl` o `rutaDeArticulo`, y los dos devuelven
      // ruta absoluta— están bien.
      for (const m of codigo.matchAll(/(href|src)=["`]([a-z0-9][^"`]*\.html[^"`]*)["`]/g)) {
        malos.push(`${ruta.replace('/home/user/pingu/', '')}: ${m[0].slice(0, 60)}`)
      }
      for (const m of codigo.matchAll(/location\.href\s*=\s*["`]([a-z0-9][^"`]*\.html[^"`]*)["`]/g)) {
        malos.push(`${ruta.replace('/home/user/pingu/', '')}: ${m[0].slice(0, 60)}`)
      }
    }
  }
  barrer('/home/user/pingu/js')
  check('ninguno', malos.length === 0, malos.join(' | '))
  // Que el barrido LLEGUE: si no encontrara NINGÚN enlace a una página,
  // esto saldría verde sin estar mirando nada (la lección de la 307).
  const todos = readFileSync('/home/user/pingu/js/guia.js', 'utf8').match(/href="\/[a-z-]+\.html/g) || []
  check(`  …y el barrido llega: ${todos.length} enlaces absolutos en guia.js`, todos.length >= 3, todos.join(' '))
}

console.log('── 2. Y las ocho páginas de dirección bonita, en su HTML ──')
{
  // Un `<script src="js/app.js">` en una página servida en /guia/algo
  // pediría /guia/js/app.js: la página sale SIN JavaScript y sin un solo
  // error en la consola de quien la mira (la 327).
  const PROFUNDAS = ['guia', 'usuario', 'foro', 'tema', 'mazo-meta', 'carta', 'coleccion']
  const malos = []
  for (const p of PROFUNDAS) {
    const html = readFileSync(`/home/user/pingu/${p}.html`, 'utf8')
    for (const m of html.matchAll(/(href|src)="([a-z0-9][^"]*)"/g)) {
      if (/^(https?:|mailto:|data:|#)/.test(m[2])) continue
      malos.push(`${p}.html: ${m[0].slice(0, 60)}`)
    }
  }
  check('todas enlazan en absoluto', malos.length === 0, malos.join(' | '))
}

// ── Y la pantalla, que es donde PINGU lo vio ──
const browser = await chromium.launch()
const CON_CURSO = [
  { type: 'hook', headline: '¿Listo?', subtext: 'Vamos.' },
  { type: 'quiz', question: '¿Cuántas cartas robas?', options: ['5', '7'], answer: 1 },
]
const guia = {
  id: 'g-1', slug: 'mi-guia', title: 'Empezar en el TCG',
  description: 'Lo básico para tu primera partida.', kind: 'guide',
  author_id: 'admin-1', review_status: 'published', published_at: '2026-08-01T10:00:00Z',
  reference_blocks: [{ type: 'heading', text: 'Cómo se juega' }, { type: 'paragraph', text: 'Robas siete cartas.' }],
  category_id: 'cat-1', estimated_mins: 8, blocks: CON_CURSO,
}
const abrir = async (ruta) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v },
    { __FAKE_SESSION__: 'none', __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Básico', slug: 'basico' }], __FAKE_GUIAS__: [guia] })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('── 3. Desde la dirección BONITA, que es la que usa la gente ──')
{
  const { page } = await abrir('/guia/mi-guia')
  const texto = await page.locator('body').innerText()
  check('la guía se abre en /guia/<slug>', /Empezar en el TCG/.test(texto) && !/no encontrada/i.test(texto), texto.slice(0, 120))
  // Los seis enlaces de esta página, mirados en el DOM: lo que vale es a
  // dónde apuntan DE VERDAD, no cómo están escritos en el fichero.
  const relativos = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((a) => ({ txt: (a.textContent || '').trim().slice(0, 30), href: a.getAttribute('href'), real: a.href }))
      .filter((x) => x.href && !/^(https?:|mailto:|#|\/)/.test(x.href))
      .map((x) => `${x.txt} → ${x.href}`))
  check('ningún enlace relativo en la página montada', relativos.length === 0, relativos.join(' | '))

  // Y EL CAMINO ENTERO: se pulsa el botón y se mira dónde se acaba.
  const boton = page.locator('.guia-cta-curso a').first()
  check('la llamada al curso está', (await boton.count()) === 1)
  check('  …apuntando en absoluto', (await boton.getAttribute('href')) === '/curso.html?slug=mi-guia', await boton.getAttribute('href'))
  await boton.click()
  await page.waitForTimeout(2600)
  const despues = await page.locator('body').innerText()
  check('al pulsar NO sale «Guía no encontrada»', !/no encontrada/i.test(despues), despues.slice(0, 160))
  check('  …sino el curso', /Continuar|¿Listo?/.test(despues), despues.slice(0, 160))
  check('  …y la dirección es la del curso', /\/curso\.html\?slug=mi-guia/.test(page.url()), page.url())
  await page.close()
}

console.log('── 4. Y el botón de arriba, el discreto ──')
{
  const { page } = await abrir('/guia/mi-guia')
  const arriba = page.locator('.guia-ir-al-curso')
  check('está', (await arriba.count()) === 1)
  await arriba.click()
  await page.waitForTimeout(2600)
  check('lleva al curso y no a un callejón', !/no encontrada/i.test(await page.locator('body').innerText()), page.url())
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
