// Tanda 737 — el repaso del foco y del orden de tabulación (X16 de la lista
// de propuestas, elegidas por PINGU).
//
// Lo que se mira, recorriendo con Tab doce páginas del sitio:
//   · que cada parada SE VEA (nada de pararse en algo escondido o de 0 px);
//   · que se NOTE: un contorno o un anillo en el propio elemento, o —si la
//     caja es la que hace de contorno, como la de la lupa— un cambio en su
//     caja al entrar el foco. Se compara CON y SIN foco: una sombra que ya
//     estaba no es un indicador;
//   · que el orden no SALTE hacia atrás (más de 150 px hacia arriba entre
//     dos paradas seguidas que no están fijas), salvo la vuelta del final;
//   · que el anillo de la casa sea de verdad (`--shadow-ring` era un 3 px
//     al 16 %, que sobre blanco no llega ni a 1,5:1);
//   · y que al cerrar un diálogo el foco VUELVA a quien lo abrió.
// Y en el código: ningún `tabindex` positivo (rompe el orden de la página).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. En el código ──')
{
  const ficheros = [
    ...readdirSync(RAIZ).filter((f) => f.endsWith('.html')),
    ...['js', 'js/mi-coleccion', 'js/torneos', 'js/meta'].flatMap((d) => readdirSync(`${RAIZ}/${d}`).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`)),
  ]
  const positivos = ficheros.filter((f) => /tabindex="[1-9]|tabIndex = [1-9]/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
  check(`ningún tabindex positivo en ${ficheros.length} ficheros`, ficheros.length > 200 && positivos.length === 0, positivos.join(', '))
  const estilo = readFileSync(`${RAIZ}/css/style.css`, 'utf8')
  check('el anillo de foco es macizo, del color de la casa', /--shadow-ring: 0 0 0 2px var\(--navy\);/.test(estilo))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST' }]
  window.__FAKE_CARTAS__ = [{ id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } }]
}
async function abrir(ruta) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|pokemontcg\.io|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}

// Lo que se mide de la parada actual. El indicador se busca en el
// elemento y, si no, en sus tres antepasados: lo que cambia entre CON foco
// y SIN él (borde o sombra). Se quita el foco y se vuelve a poner a mano,
// con `focusVisible`, para medir los dos estados.
const medir = () => {
  const e = document.activeElement
  if (!e || e === document.body) return null
  const cs = getComputedStyle(e)
  const r = e.getBoundingClientRect()
  const desc = `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''} «${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28)}»`
  let fijo = false
  for (let x = e; x && x !== document.body; x = x.parentElement) {
    const p = getComputedStyle(x).position
    if (p === 'fixed' || p === 'sticky') { fijo = true; break }
  }
  const propio = (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') || cs.boxShadow !== 'none'
  let deCaja = false
  if (!propio) {
    const cajas = [e.parentElement, e.parentElement?.parentElement, e.parentElement?.parentElement?.parentElement].filter(Boolean)
    const foto = () => cajas.map((c) => { const s = getComputedStyle(c); return `${s.borderTopColor}|${s.boxShadow}|${s.outlineStyle}` })
    const con = foto()
    e.blur()
    const sin = foto()
    e.focus({ focusVisible: true })
    deCaja = con.some((v, i) => v !== sin[i])
  }
  return { desc, visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05, nota: propio || deCaja, y: Math.round(r.top + scrollY), fijo }
}

const PAGINAS = ['/index.html', '/cartas', '/mi-coleccion.html', '/foro.html', '/torneos.html', '/carta.html?id=base1-4', '/aprender.html', '/buscar.html', '/noticias', '/perfil.html', '/meta.html', '/lanzamientos.html']
console.log('── 2. Con Tab, página a página ──')
for (const ruta of PAGINAS) {
  const { page, ctx, errores } = await abrir(ruta)
  const vistos = new Set()
  const sinVerse = []
  const sinNotarse = []
  const saltos = []
  let antes = null
  let vueltas = 0
  for (let i = 0; i < 90 && vueltas < 1; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(medir)
    if (!r) continue
    // La vuelta del pie al «Saltar al contenido» es el final del recorrido.
    if (antes && /salta-al-contenido/.test(r.desc)) vueltas++
    else if (antes && !antes.fijo && !r.fijo && r.y < antes.y - 150) saltos.push(`${antes.desc} → ${r.desc}`)
    antes = r
    if (vistos.has(r.desc)) continue
    vistos.add(r.desc)
    if (!r.visible) sinVerse.push(r.desc)
    if (!r.nota) sinNotarse.push(r.desc)
  }
  check(`${ruta}: ${vistos.size} paradas, todas a la vista`, vistos.size >= 15 && sinVerse.length === 0, sinVerse.join(' | '))
  check('  …todas con su indicador', sinNotarse.length === 0, sinNotarse.join(' | '))
  check('  …y sin saltos hacia atrás', saltos.length === 0, saltos.join(' | '))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Al cerrar un diálogo, el foco vuelve ──')
{
  const { page, ctx } = await abrir('/index.html')
  await page.focus('#navSearchBtn')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  check('la paleta se abre con el foco en su caja', await page.evaluate(() => document.activeElement?.id === 'paletaInput'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('  …y al cerrarla vuelve a la lupa', await page.evaluate(() => document.activeElement?.id === 'navSearchBtn'), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
  await page.keyboard.press('Shift+?')
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('la ayuda de atajos, igual', await page.evaluate(() => document.activeElement?.id === 'navSearchBtn'), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
  await ctx.close()
  const c = await abrir('/carta.html?id=base1-4')
  await c.page.focus('#cmComparar')
  await c.page.keyboard.press('Enter')
  await c.page.waitForTimeout(900)
  await c.page.keyboard.press('Escape')
  await c.page.waitForTimeout(300)
  check('comparar dos cartas, igual', await c.page.evaluate(() => document.activeElement?.id === 'cmComparar'), await c.page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
  await c.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
