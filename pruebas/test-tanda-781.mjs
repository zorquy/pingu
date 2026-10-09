// Tanda 781 — bloque 2 de «PokeDoc al detalle»: SI2 sin cajas punteadas,
// SI3 un solo «Ver todo», SI9 chapas que dicen algo, SI5 un solo primario.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const regla = (css, sel) => (css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[2] || ''

console.log('── 1. Estático ──')
const style = leer('css/style.css')
check('SI2: .empty-state sin borde punteado', !/dashed/.test(regla(style, '.empty-state')), regla(style, '.empty-state'))
check('  …con sus cartas fantasma', /mask: url\("data:image\/svg\+xml/.test(regla(style, '.empty-state:not([style])::before')))
check('  …ni en el constructor ni en el muro', !/dashed/.test(regla(leer('css/constructor.css'), '.cm-vacio')) && !/dashed/.test(regla(leer('css/components.css'), '.wall-empty')))
check('  …y Mensajes y los mazos con botón, no con enlaces en la frase',
  /empty-state">Todavía no tienes conversaciones[^`]*class="btn-primary"/.test(leer('js/mensajes.js')) &&
  /empty-state">Todavía no tienes mazos guardados[^']*class="btn-primary" href="\/constructor"/.test(leer('js/torneos/torneo.js')))
check('SI5: el primario es el azul sólido con el blanco fijo', /background: var\(--navy-solid\);\s*color: var\(--blanco-fijo\)/.test(regla(style, '.btn-primary')))
const idx = leer('index.html')
check('SI3: la portada dice «Ver todo» con su flecha, las dos veces', (idx.match(/class="ver-todo"[^>]*>Ver todo <span class="ver-todo-flecha"/g) || []).length === 2)
check('  …y el foro, «Hoy» y el Panel también', /class="ver-todo" href="\/foro"/.test(leer('js/home.js')) && /class="ver-todo"/.test(leer('js/hoy.js')) && /link-btn ver-todo/.test(leer('js/mi-coleccion.js')))
check('  …sin el botón con borde del foro', !/foro-vivo-boton/.test(leer('js/home.js') + leer('css/portada.css')))
const mc = leer('js/mi-coleccion.js')
check('SI9: la «N» solo si no es la normal', /varianteDe\(l\.variante\)\.id === 'normal' \? '' : chapaDeVarianteHtml\(l\.variante\)/.test(mc))
check('  …y el «Normal» de la expansión, solo separando', /mias\.length === 1 && mias\[0\]\.nuestro === 'normal'/.test(mc))
check('  …y «Novato» fuera del foro y de Gente', /esPrimerNivel\(nivel\) \? \[\]/.test(leer('js/tema.js')) && /esPrimerNivel\(calculateLevel/.test(leer('js/usuarios.js')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
for (const tema of ['light', 'dark']) {
  const p = await b.newPage({ colorScheme: tema })
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(() => {
    const n = document.createElement('a'); n.className = 'btn-primary'; n.textContent = 'x'; document.body.appendChild(n)
    const cs = getComputedStyle(n); const out = { fondo: cs.backgroundColor, letra: cs.color }; n.remove()
    const v = document.createElement('p'); v.className = 'empty-state'; v.textContent = 'Nada'; document.body.appendChild(v)
    const vs = getComputedStyle(v), antes = getComputedStyle(v, '::before')
    out.borde = vs.borderTopStyle; out.fantasma = antes.content !== 'none' && antes.height === '56px'; v.remove()
    return out
  })
  check(`${tema}: el primario azul oscuro con letra blanca`, r.fondo === 'rgb(30, 81, 117)' && r.letra === 'rgb(255, 255, 255)', JSON.stringify(r))
  check(`${tema}: el vacío sin caja y con el abanico`, r.borde === 'none' && r.fantasma, JSON.stringify(r))
  await p.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
