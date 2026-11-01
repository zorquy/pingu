// Tanda 1162 — nombres y textos (T1, T5 y T6 de la propuesta «PokeDoc entera»):
// la lista de personas se llama «Gente» en todas partes, Mis partidas y
// Cambios dicen lo mismo en la lateral, la burbuja y el título; las cajas de
// búsqueda tutean («Busca…», sin puntos suspensivos salvo una lista de
// ejemplos); y las frases de obra («todavía no está activado») se fueron.
// Sin navegador: lee el repo.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO = process.env.REPO || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }
const leer = (f) => readFileSync(join(REPO, f), 'utf8')
const ficheros = (dir, ext) => {
  const out = []
  for (const n of readdirSync(join(REPO, dir))) {
    const p = join(dir, n)
    if (['node_modules', '.git', 'admin', 'assets'].includes(n)) continue
    if (statSync(join(REPO, p)).isDirectory()) out.push(...ficheros(p, ext))
    else if (n.endsWith(ext)) out.push(p)
  }
  return out
}

console.log('── T1: un nombre para cada cosa ──')
const usuarios = leer('usuarios.html')
check('la lista de personas se titula «Gente»', /<h1>Gente<\/h1>/.test(usuarios) && /<title>Gente — PokeDoc<\/title>/.test(usuarios) && !/La comunidad<\/h1>/.test(usuarios))
check('  …también en og:title y twitter:title', (usuarios.match(/content="Gente — PokeDoc"/g) || []).length === 2)
const barra = leer('js/barra-movil.js')
check('la burbuja y la lateral dicen «Mis partidas», como el título', /'mis-partidas': 'Mis partidas'/.test(barra) && !/'mis-partidas': 'Partidas'/.test(barra))
check('  …y la hoja «Tú» también', /'Mis partidas', 'partidas'/.test(leer('js/menu-tu.js')))
check('la pestaña de cambios se rotula «Cambios» en la burbuja, no «Trade»', /<span class="mc-texto-corto">Cambios<\/span>/.test(leer('mi-coleccion.html')) && !/>Trade</.test(leer('mi-coleccion.html')))
// /cartas se genera de la misma plantilla sin la pestaña de cambios (649): sin «Trade» igual.
check('  …y /cartas, generado, tampoco dice «Trade»', !/>Trade</.test(leer('cartas.html')))
check('el mazo del meta no titula «Cargando…»', !/Cargando…/.test(leer('mazo-meta.html')) && /provisional/.test(leer('js/meta-mazo.js')))

console.log('── T5: «Busca…» en todas las cajas ──')
const cajas = []
for (const f of [...ficheros('.', '.html'), ...ficheros('js', '.js')]) {
  const s = leer(f)
  for (const m of s.matchAll(/placeholder=["']([^"']*)["']/g)) cajas.push({ f, texto: m[1] })
  for (const m of s.matchAll(/\.placeholder = ([`'"])([^`'"]*)\1/g)) cajas.push({ f, texto: m[2] })
  for (const m of s.matchAll(/\? '(Buscar?[^']*)' : '(Buscar?[^']*)'/g)) cajas.push({ f, texto: m[1] }, { f, texto: m[2] })
}
const busca = cajas.filter((c) => /^Busca/.test(c.texto))
check(`hay cajas de búsqueda (${busca.length})`, busca.length >= 18)
const infinitivo = busca.filter((c) => /^Buscar\b/.test(c.texto))
check('ninguna va en infinitivo («Buscar…»)', infinitivo.length === 0, JSON.stringify(infinitivo))
// Los puntos suspensivos solo cierran una lista de ejemplos («Charizard, Iono, 151/165…»).
const puntos = busca.filter((c) => /…$/.test(c.texto) && !/[:,]/.test(c.texto))
check('sin puntos suspensivos salvo en una lista de ejemplos', puntos.length === 0, JSON.stringify(puntos))
check('la caja de Gente dice a quién buscas', busca.some((c) => c.f === 'usuarios.html' && c.texto === 'Busca a alguien por su nombre'))

console.log('── T6: nada de «todavía no está activado» ──')
const frases = ['El foro todavía no está activado', 'El buscador del foro todavía no está activado', 'Las peticiones de guías todavía no están activadas', 'Los productos todavía no están activados']
for (const f of frases) {
  const donde = [...ficheros('js', '.js'), ...ficheros('.', '.html')].filter((x) => leer(x).includes(`>${f}`) || leer(x).includes(`'${f}`) || leer(x).includes(`"${f}`))
  check(`«${f}» ya no se pinta`, donde.length === 0, donde.join(', '))
}
for (const [f, que] of [['js/foro.js', "'el foro'"], ['js/foro.js', "'el buscador del foro'"], ['js/tema.js', "'el tema'"], ['js/peticiones.js', "'las peticiones'"], ['js/mi-coleccion/productos.js', "'los productos'"]]) {
  check(`${f} pasa por pintarSinRespuesta(…, ${que})`, new RegExp(`pintarSinRespuesta\\([^)]*${que}\\)`).test(leer(f)))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
