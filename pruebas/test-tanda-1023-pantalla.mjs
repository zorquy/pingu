// Tanda 1023 — A4 de «PokeDoc como app» y LA PRUEBA DE SOLAPES: en el
// móvil nada fijo tapa nada que se pueda pulsar. Recorre las páginas con
// datos de verdad (fixtures-app.mjs), baja hasta el final y comprueba que
// (1) lo fijo abajo son como mucho DOS cosas —la barra y la burbuja—: un
// tercer flotante (el botón rosa del foro, la barra de Guardar del
// constructor) es lo que esta prueba existe para cazar; (2) al final de la
// página ningún enlace ni botón del contenido queda debajo de lo fijo (la
// página reserva su sitio); y (3) la página no se desplaza de lado.
// Y lo de A4: la transición con dirección y el toque en las tarjetas.
import { readFileSync, readdirSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`) }

console.log('── 1. El CSS y el guion de la cabecera (A4) ──')
{
  const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8')
  check('la transición tiene dirección (adelante / atras) solo en el móvil y sin «menos movimiento»', /@media \(max-width: 900px\) and \(prefers-reduced-motion: no-preference\) \{[\s\S]*?html:active-view-transition-type\(adelante\)::view-transition-new\(root\)[\s\S]*?html:active-view-transition-type\(atras\)::view-transition-old\(root\)/.test(css))
  check('  …y se apaga con «menos movimiento»', /@media \(prefers-reduced-motion: reduce\) \{\s*html:active-view-transition-type\(adelante\)::view-transition-old\(root\),[\s\S]*?\{ animation: none; \}/.test(css))
  check('las tarjetas y las filas se hunden al tocarlas (pointer: coarse), y no con «menos movimiento»', /@media \(pointer: coarse\) \{\s*:is\(\.foro-fila,[^}]*:active \{ transform: scale\(0\.985\)/.test(css) && /:is\(\.foro-fila,[^}]*:active \{ transform: none; transition: none; \}/.test(css))
  const gen = await import(`${RAIZ}/generar-barra-movil.mjs`)
  check('el guion de la cabecera pone el tipo en pagereveal: detalle → adelante, volver → atras', /pagereveal/.test(gen.CLASE_MOVIL) && /traverse/.test(gen.CLASE_MOVIL) && /data-detalle/.test(gen.CLASE_MOVIL))
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && readFileSync(`${RAIZ}/${f}`, 'utf8').includes('id="navbar"'))
  const sin = paginas.filter((f) => !readFileSync(`${RAIZ}/${f}`, 'utf8').includes(gen.CLASE_MOVIL))
  check(`las ${paginas.length} páginas con barra llevan ese guion, uno solo`, sin.length === 0 && paginas.every((f) => readFileSync(`${RAIZ}/${f}`, 'utf8').split("classList.add('con-barra-movil')").length === 2), sin.join(', '))
}

console.log('\n── 2. Los solapes, página a página (móvil) ──')
const PAGINAS = ['/', '/aprender', '/retos', '/glosario', '/guardados', '/foro', '/foro/competitivo', '/tema/tema-2', '/usuarios', '/usuario/Misty', '/mensajes', '/noticias', '/lanzamientos', '/novedades',
  '/cartas', '/cartas?ver=album&set=sv08&catalogo=WEST', '/mi-coleccion', '/mi-coleccion?ver=cartas', '/mi-coleccion?ver=album', '/mi-coleccion?ver=pokedex', '/mi-coleccion?ver=albumes', '/mi-coleccion?ver=productos',
  '/torneos', '/torneo?slug=liga-fdn-otono', '/mazos', '/constructor?mazo=mazo-1', '/mis-partidas', '/meta', '/laboratorio', '/repeticiones', '/perfil', '/ajustes', '/guia/charizard-ex', '/buscar?q=charizard']
const b = await chromium.launch()
const ctx = await contexto(b, true)
let malas = 0
for (const ruta of PAGINAS) {
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 100)))
  try {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500)
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await page.waitForTimeout(700)
    const r = await page.evaluate(() => {
      const vh = innerHeight, vw = innerWidth
      const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      // Lo fijo que toca el tercio de abajo (la barra, la burbuja… y lo que no debería).
      const fijos = [...document.querySelectorAll('body *')].filter((el) => { const p = getComputedStyle(el).position; if (p !== 'fixed' && p !== 'sticky') return false; if (el.closest('dialog, [hidden], .hidden')) return false; if (!visible(el)) return false; const r = el.getBoundingClientRect(); return r.bottom > vh * 0.6 && r.top < vh && r.width > 80 })
      const abajo = fijos.filter((el) => !fijos.some((o) => o !== el && o.contains(el)))
      const nombres = abajo.map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''))
      // Al final de la página: lo pulsable del contenido que queda debajo de lo fijo.
      const cajas = abajo.map((el) => el.getBoundingClientRect())
      const dentro = (r, c) => r.left < c.right - 4 && r.right > c.left + 4 && r.top < c.bottom - 4 && r.bottom > c.top + 4
      const pulsables = [...document.querySelectorAll('main a, main button, .page-content a, .page-content button, footer a')].filter((el) => visible(el) && !abajo.some((f) => f.contains(el)) && !el.closest('[data-sin-arrastre], dialog, .mc-pestanias'))
      const tapados = pulsables.filter((el) => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && cajas.some((c) => dentro(r, c)) }).map((el) => (el.textContent.trim() || el.getAttribute('aria-label') || el.className).slice(0, 30))
      return { fijos: nombres, tapados: tapados.slice(0, 5), ancho: document.documentElement.scrollWidth <= vw + 1 }
    })
    const ok = r.fijos.length <= 2 && r.tapados.length === 0 && r.ancho
    if (!ok) malas++
    check(`${ruta}: ${r.fijos.length} fijo(s) abajo, nada pulsable tapado al final, sin desplazamiento de lado`, ok, JSON.stringify(r) + (errores.length ? ' · ' + errores[0] : ''))
  } catch (e) {
    malas++
    check(`${ruta}: se abre`, false, String(e).slice(0, 120))
  }
  await page.close()
}
await ctx.close()
await b.close()
check(`ninguna de las ${PAGINAS.length} páginas apila un tercer flotante ni tapa nada`, malas === 0, `${malas} con solapes`)
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
