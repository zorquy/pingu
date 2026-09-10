// El peso de la portada en gzip: index.html + su grafo de módulos + CSS.
// Presupuesto de la casa: 170 KB (ver CLAUDE.md).
//
// El grafo se recorre resolviendo cada import a su RUTA REAL en disco. Es
// lo que se hizo mal una vez: contar './x.js' y '/js/x.js' como dos
// ficheros distintos inflaba la cuenta en 60 KB.
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, dirname, relative } from 'node:path'

const RAIZ = '/home/user/pingu'
const vistos = new Set()
let total = 0
const detalle = []

const pesar = (abs) => {
  const real = resolve(abs)
  if (vistos.has(real) || !existsSync(real)) return null
  vistos.add(real)
  const bytes = readFileSync(real)
  const gz = gzipSync(bytes).length
  total += gz
  detalle.push([relative(RAIZ, real), gz])
  return bytes.toString('utf8')
}

const recorrer = (abs) => {
  const src = pesar(abs)
  if (src === null) return
  const base = dirname(resolve(abs))
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g)) {
    const ruta = m[1]
    if (!ruta.startsWith('.') && !ruta.startsWith('/')) continue
    recorrer(ruta.startsWith('/') ? resolve(RAIZ, `.${ruta}`) : resolve(base, ruta))
  }
  // Los import() perezosos NO cuentan: por eso están puestos así.
}

const html = readFileSync(`${RAIZ}/index.html`, 'utf8')
pesar(`${RAIZ}/index.html`)
for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
  pesar(resolve(RAIZ, `.${m[1].startsWith('/') ? m[1] : '/' + m[1]}`))
}
for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) {
  recorrer(resolve(RAIZ, `.${m[1].startsWith('/') ? m[1] : '/' + m[1]}`))
}

detalle.sort((a, b) => b[1] - a[1])
for (const [f, gz] of detalle.slice(0, 8)) console.log(`  ${(gz / 1024).toFixed(1).padStart(6)} KB  ${f}`)
console.log(`  ${'—'.repeat(30)}`)
console.log(`  ${(total / 1024).toFixed(1)} KB gzip en total (${vistos.size} ficheros)`)
console.log(`  Presupuesto: 170 KB → ${total / 1024 <= 170 ? `✅ caben ${(170 - total / 1024).toFixed(1)} KB más` : '❌ PASADO'}`)
