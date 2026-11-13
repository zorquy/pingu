// CSS que nadie pinta (tanda 1316, R3 del plan): una LISTA para revisar a
// mano, nunca para borrar sola.
//
//   node herramientas/css-sin-usar.mjs            → resumen por hoja
//   node herramientas/css-sin-usar.mjs --todo     → cada clase, con su hoja
//
// Cruza cada clase de cada hoja con todo el HTML y el JS (también /admin y las
// funciones del servidor, que pintan HTML). La lección de la 498 va dentro: un
// nombre COMPUESTO en ejecución (`medalla-${x}`) no aparece entero en ningún
// sitio, así que se apunta el PREFIJO (`medalla-`) y se perdona todo lo que
// empiece por él. Marca de menos, nunca de más: lo que sale aquí es candidato,
// y antes de quitar una regla se grepa a mano en el JS (CLAUDE.md, 498).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'

const RAIZ = resolve(dirname(new URL(import.meta.url).pathname), '..')

function ficheros(dir, ext, fuera = []) {
  if (!existsSync(dir)) return fuera
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'vendor' || n.startsWith('.')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, ext, fuera)
    else if (ext.test(n)) fuera.push(p)
  }
  return fuera
}

// Las clases de una hoja (sin comentarios ni lo de dentro de url()).
export function clasesDeCss(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '')
  const clases = new Set()
  // Un trozo hasta `}` acaba en «selector { valores»; dentro de un @media,
  // «@media (…) { selector { valores»: el selector es lo de antes del ÚLTIMO `{`.
  for (const bloque of limpio.split('}')) {
    const partes = bloque.split('{')
    if (partes.length < 2) continue
    const sel = partes[partes.length - 2]
    for (const m of sel.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) clases.add(m[1])
  }
  return clases
}

// Lo que el código usa: palabras sueltas y prefijos de nombres compuestos.
export function usoDelCodigo(textos) {
  const palabras = new Set()
  const prefijos = new Set()
  for (const t of textos) {
    for (const m of t.matchAll(/[_a-zA-Z][_a-zA-Z0-9-]*/g)) palabras.add(m[0])
    // `algo-${…}` o 'algo-' + … : el prefijo de una clase armada en ejecución.
    for (const m of t.matchAll(/([_a-zA-Z][_a-zA-Z0-9-]*-)(?:\$\{|['"`]\s*\+)/g)) prefijos.add(m[1])
  }
  return { palabras, prefijos }
}

export function sinUsar(clases, { palabras, prefijos }) {
  return [...clases].filter((c) => !palabras.has(c) && ![...prefijos].some((p) => c.startsWith(p)))
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const codigo = [
    ...readdirSync(RAIZ).filter((n) => n.endsWith('.html')).map((n) => join(RAIZ, n)),
    ...ficheros(join(RAIZ, 'admin'), /\.(html|js)$/),
    ...ficheros(join(RAIZ, 'js'), /\.m?js$/),
    ...ficheros(join(RAIZ, 'netlify'), /\.m?js$/),
  ].map((f) => readFileSync(f, 'utf8'))
  const uso = usoDelCodigo(codigo)
  const hojas = [...ficheros(join(RAIZ, 'css'), /\.css$/), ...ficheros(join(RAIZ, 'admin'), /\.css$/)]
  const todo = process.argv.includes('--todo')
  let total = 0
  const filas = []
  for (const h of hojas) {
    const lista = sinUsar(clasesDeCss(readFileSync(h, 'utf8')), uso).sort()
    if (!lista.length) continue
    total += lista.length
    filas.push([relative(RAIZ, h), lista])
  }
  filas.sort((a, b) => b[1].length - a[1].length)
  for (const [h, lista] of filas) {
    console.log(`${String(lista.length).padStart(4)}  ${h}`)
    if (todo) for (const c of lista) console.log(`        .${c}`)
  }
  console.log(`\n${total} clases sin rastro en el HTML ni en el JS (${hojas.length} hojas). Candidatas, no condenadas: grepa cada una a mano antes de quitarla.`)
}
