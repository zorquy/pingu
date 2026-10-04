// Tanda 548 — el botón «Hacer el curso» en guías que no tienen curso.
//
// Lo contó una persona que lee la web, y PINGU lo trajo: «hay algunas guías
// que ha leído y hay un botón de hacer curso, pero justo son guías que no
// tienen un curso enlazado. En las guías que no hay curso yo quitaría el
// botón, porque si se van a curso le sale vacío».
//
// La causa: `guideHasCourse` decía que una guía tiene curso si `blocks` trae
// ALGO. Y los bloques de un curso son de dos clases —los que se JUEGAN
// (quiz, truefalse, match…) y la teoría que se lee y se pasa (hook,
// concept, tip)—, así que una guía con solo teoría pasaba la comprobación:
// salía el botón y detrás no había ni una pregunta.
//
// No daba ningún error. Es un botón que cumple su promesa a medias, que es
// la lección de la 447 —una frase de la interfaz es una AFIRMACIÓN sobre lo
// que hace el código— con un botón en vez de una frase.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
// Las dos reglas viven en un módulo PURO (tanda 548), y eso es parte del
// arreglo: en `js/app.js` no las podía importar una prueba sin navegador
// —ese fichero monta la barra de arriba al cargarse y en Node revienta—,
// así que la regla que decide si sale un botón no tenía prueba de node.
import { guideHasCourse, PRACTICE_TYPES, esPractica } from '/home/user/pingu/js/guia-contenido.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const TEORIA = [{ type: 'hook', text: '¿Sabías que…?' }, { type: 'concept', text: 'Un premio es…' }, { type: 'tip', text: 'Truco' }]
const CON_PREGUNTA = [...TEORIA, { type: 'quiz', question: '¿Cuántos premios hay?', options: ['3', '6'], answer: 1 }]

console.log('── 1. «Tiene curso» es «hay algo que jugar» ──')
{
  check('solo teoría: NO tiene curso', guideHasCourse({ blocks: TEORIA }) === false, JSON.stringify(TEORIA.map((b) => b.type)))
  check('con una pregunta: sí', guideHasCourse({ blocks: CON_PREGUNTA }) === true)
  check('sin bloques: no', guideHasCourse({ blocks: [] }) === false)
  check('sin la columna: no', guideHasCourse({}) === false && guideHasCourse(null) === false)
  // Y los catorce tipos cuentan, no solo el quiz: si mañana se añade uno y
  // esta lista no se enterara, un curso nuevo dejaría de contar como curso
  // y nadie vería un error — solo un botón que no sale.
  for (const t of PRACTICE_TYPES) {
    if (!guideHasCourse({ blocks: [{ type: t }] })) check(`el tipo «${t}» cuenta como curso`, false)
  }
  check(`los ${PRACTICE_TYPES.length} tipos jugables cuentan`, PRACTICE_TYPES.every((t) => guideHasCourse({ blocks: [{ type: t }] })))
  check('y un tipo inventado no', !esPractica({ type: 'parrafo' }) && !guideHasCourse({ blocks: [{ type: 'parrafo' }] }))
}

console.log('── 2. La lista de tipos vive en UN sitio ──')
{
  // `curso-juego.js` la reexporta, así que sus importadores no cambian —
  // pero nadie puede volver a escribirla a mano: una copia se separa en
  // cuanto alguien añade un tipo, y eso no da error (la norma de la 471).
  const copias = []
  const barrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) { barrer(ruta); continue }
      if (!e.name.endsWith('.js') || e.name === 'guia-contenido.js') continue
      const codigo = readFileSync(ruta, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      // Una copia es una LISTA con varios dentro —`['quiz', 'truefalse', …]`—,
      // no la cadena de `if` que pinta cada tipo ni un mapa de iconos: eso
      // son usos legítimos, y marcarlos haría la guarda inútil a la
      // primera (la trampa de la 312: al barrer código, todo lo que
      // CONTIENE la cadena cuenta, no solo lo que ES).
      if (/\[[^\]]*'truefalse'[^\]]*'fillblank'[^\]]*\]/.test(codigo)) copias.push(ruta.replace('/home/user/pingu/', ''))
    }
  }
  barrer('/home/user/pingu/js')
  check('nadie se copia la lista de tipos jugables', copias.length === 0, copias.join(', '))
  // Que el barrido LLEGUE: en el fichero bueno sí está (lección de la 307).
  check('  …y el barrido llega: en `guia-contenido.js` sí está', /'truefalse'[\s\S]{0,80}'fillblank'/.test(readFileSync('/home/user/pingu/js/guia-contenido.js', 'utf8')))
}

// ── Y ahora las dos pantallas ──
const browser = await chromium.launch()
const guia = (blocks) => ({
  id: 'g-1', slug: 'mi-guia', title: 'Empezar en el TCG',
  description: 'Lo básico para tu primera partida.', kind: 'guide',
  author_id: 'admin-1', review_status: 'published', published_at: '2026-08-01T10:00:00Z',
  reference_blocks: [{ type: 'heading', text: 'Cómo se juega' }, { type: 'paragraph', text: 'Robas siete cartas.' }],
  category_id: 'cat-1', estimated_mins: 5, blocks,
})
const abrir = async (ruta, blocks) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v },
    { __FAKE_SESSION__: 'none', __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Básico', slug: 'basico' }], __FAKE_GUIAS__: [guia(blocks)] })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('── 3. La guía con solo teoría NO ofrece el curso ──')
{
  const { page, errores } = await abrir('/guia?slug=mi-guia', TEORIA)
  const texto = await page.locator('body').innerText()
  check('no sale el botón de arriba', (await page.locator('.guia-ir-al-curso').count()) === 0)
  check('ni la llamada de abajo', (await page.locator('.guia-cta-curso').count()) === 0)
  check('ni la frase «Hacer el curso» en ninguna parte', !/Hacer el curso/.test(texto), texto.slice(0, 200))
  // Y la guía se sigue leyendo: quitar el botón no puede quitar la página.
  check('la guía se lee igual', /Cómo se juega/.test(texto))
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('── 4. Y con una pregunta, sí ──')
{
  // La otra mitad: una guarda que solo se prueba cuando NO salta no se
  // está probando (la lección de la 506).
  const { page } = await abrir('/guia?slug=mi-guia', CON_PREGUNTA)
  check('sale el botón de arriba', (await page.locator('.guia-ir-al-curso').count()) === 1)
  check('y la llamada de abajo', (await page.locator('.guia-cta-curso').count()) === 1)
  const href = await page.locator('.guia-ir-al-curso').getAttribute('href')
  check('  …apuntando al curso de ESA guía', href === 'curso.html?slug=mi-guia', href)
  await page.close()
}

console.log('── 5. Y quien llegue al curso por la dirección, lo oye claro ──')
{
  // Las dos puertas preguntan lo mismo, que es lo que hace que no puedan
  // discrepar. Antes el curso aceptaba cualquier `blocks` no vacío y abría
  // un curso de CERO preguntas: diapositivas y se acaba.
  const { page, errores } = await abrir('/curso.html?slug=mi-guia', TEORIA)
  const texto = await page.locator('body').innerText()
  check('dice que todavía no está disponible', /todavía no está disponible/i.test(texto), texto.slice(0, 200))
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await page.close()
  const { page: bueno } = await abrir('/curso.html?slug=mi-guia', CON_PREGUNTA)
  const t2 = await bueno.locator('body').innerText()
  check('  …y el curso de verdad sí arranca', !/todavía no está disponible/i.test(t2) && /Continuar/.test(t2), t2.slice(0, 160))
  await bueno.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
