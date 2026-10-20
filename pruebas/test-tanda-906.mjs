// Tanda 906 — UNA dirección por página para Google.
//
// Search Console (PINGU, 2026-10-20): la guía de pull rates aparecía con
// tres direcciones —/guia/x, /guia/x?slug=x y /guia.html?slug=x—, otra con
// el `fbclid` de Facebook pegado, y /sobre junto a /sobre.html. La canónica
// copiaba la query entera y las páginas fijas se anunciaban con `.html`, así
// que cada copia se declaraba buena y la fuerza se repartía.
import { readFileSync, readdirSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. La canónica que pone el servidor ──')
{
  const { urlCanonica } = await import(`${RAIZ}/netlify/edge-functions/meta-social.js`)
  const u = (x) => urlCanonica(new URL(x))
  check('fuera el fbclid y los utm', u('https://pokedoc.es/aprender?tema=conceptos&fbclid=abc&utm_source=ig') === 'https://pokedoc.es/aprender?tema=conceptos')
  check('fuera el .html', u('https://pokedoc.es/aprender.html?tema=conceptos') === 'https://pokedoc.es/aprender?tema=conceptos' && u('https://pokedoc.es/index.html') === 'https://pokedoc.es/')
  check('se quedan los parámetros que eligen la página', u('https://pokedoc.es/torneo?slug=liga&ver=jugadores') === 'https://pokedoc.es/torneo?slug=liga' && u('https://pokedoc.es/curso.html?slug=a') === 'https://pokedoc.es/curso?slug=a')
  check('y siempre con el dominio bueno', u('https://pokedoc.netlify.app/sobre.html') === 'https://pokedoc.es/sobre')
  const ms = leer('netlify/edge-functions/meta-social.js')
  check('la guía va a /guia/<slug> y la noticia a /noticias/<slug>, sin query', /esNoticia \|\| !esCurso \? `\$\{SITIO\}\$\{rutaDeArticulo\(esNoticia \? 'news' : 'guide', slug\)\}`/.test(ms))
  check('las migas de pan apuntan sin .html', !/url: `\$\{SITIO\}\/(aprender|foro)\.html`/.test(ms))
}

console.log('\n── 2. Las páginas fijas ──')
{
  // carta, coleccion y tema son PLANTILLAS: su canónica la sustituye el
  // servidor por la de cada carta, colección o tema.
  const PLANTILLAS = new Set(['carta.html', 'coleccion.html', 'tema.html'])
  const malas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !PLANTILLAS.has(f))
    .filter((f) => /rel="canonical" href="https:\/\/pokedoc\.es\/[^"]*\.html/.test(leer(f)))
  check('ninguna página fija se anuncia con .html', !malas.length, malas.join(', '))
  check('/cartas sale así del generador', /rel="canonical" href="https:\/\/pokedoc\.es\/cartas"/.test(leer('generar-cartas.mjs')))
  for (const f of ['auth.html', 'buscar.html']) check(`${f} fuera de Google (noindex,follow)`, /<meta name="robots" content="noindex,follow" \/>/.test(leer(f)))
}

console.log('\n── 3. El sitemap ──')
{
  const s = leer('netlify/functions/sitemap.mjs')
  const fijas = [...s.matchAll(/\['(\/[^']*)', '0\.\d'\]/g)].map((m) => m[1])
  check('sus páginas fijas van sin .html', fijas.length > 15 && !fijas.some((r) => r.endsWith('.html')), fijas.filter((r) => r.endsWith('.html')).join(', '))
  check('y no ofrece la búsqueda interna ni la de entrar', !fijas.some((r) => /^\/(buscar|auth)\b/.test(r)))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
