// Antes de salir a producción (tanda 1309, C3 del plan): lo que corre Netlify
// como `[build] command`. Si algo falla, el despliegue se para y la web sigue
// como estaba: lo roto no llega a nadie, y no hay que gastar otro despliegue
// en arreglarlo.
//
// Lo que mira (en un par de segundos y sin dependencias):
//   1. Cada `import { x } from './y.js'` apunta a un fichero que existe y que
//      exporta `x` (la 510: un export que falta deja la PÁGINA sin JavaScript).
//   2. Cada `<script src>` y `<link rel=stylesheet href>` de las páginas
//      apunta a un fichero que existe.
//   3. Los JSON que la web lee (novedades, manifiesto) se leen.
//
// Es la misma regla que test-imports.mjs (rama `pruebas`), aquí sin las
// pruebas: esto va en la rama que se despliega. Se corre también a mano:
//   node herramientas/antes-de-salir.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

const RAIZ = resolve(dirname(new URL(import.meta.url).pathname), '..')
const fallos = []

function ficheros(dir, ext, fuera = []) {
  if (!existsSync(dir)) return fuera
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, ext, fuera)
    else if (ext.test(n)) fuera.push(p)
  }
  return fuera
}

const relativo = (f) => f.replace(RAIZ + '/', '')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

function resolver(desde, spec) {
  if (!spec.startsWith('.')) return null
  const p = resolve(dirname(desde), spec)
  return existsSync(p) ? p : null
}

const cache = new Map()
function exportaciones(f, vistos = new Set()) {
  if (cache.has(f)) return cache.get(f)
  if (vistos.has(f) || !existsSync(f)) return new Set()
  vistos.add(f)
  const s = readFileSync(f, 'utf8')
  const fuera = new Set()
  for (const m of s.matchAll(/(?:^|[;}\s])export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) fuera.add(m[1])
  if (/^export\s+default\b/m.test(s)) fuera.add('default')
  for (const m of s.matchAll(/(?:^|[;}\s])export\s*\{([^}]*)\}/gm)) {
    for (const trozo of m[1].split(',')) {
      const t = trozo.trim()
      if (!t) continue
      const como = t.match(/\bas\s+([A-Za-z0-9_$]+)$/)
      fuera.add(como ? como[1] : t.split(/\s+/)[0])
    }
  }
  for (const m of s.matchAll(/(?:^|[;}\s])export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
    const d = resolver(f, m[1])
    if (d) for (const e of exportaciones(d, vistos)) fuera.add(e)
  }
  cache.set(f, fuera)
  return fuera
}

// 1. Los imports con nombre.
const modulos = [...ficheros(join(RAIZ, 'js'), /\.m?js$/), ...ficheros(join(RAIZ, 'admin', 'js'), /\.m?js$/), ...ficheros(join(RAIZ, 'netlify'), /\.m?js$/)]
let nombres = 0
for (const f of modulos) {
  const s = sinComentarios(readFileSync(f, 'utf8'))
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const destino = resolver(f, m[2])
    if (!destino) { fallos.push(`${relativo(f)} importa de «${m[2]}», que no existe`); continue }
    const tiene = exportaciones(destino)
    for (const trozo of m[1].split(',')) {
      const nombre = trozo.trim().split(/\s+as\s+/)[0].trim()
      if (!nombre) continue
      nombres++
      if (!tiene.has(nombre)) fallos.push(`${relativo(f)} importa «${nombre}» de ${m[2]}, que no lo exporta`)
    }
  }
  for (const m of s.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    if (!resolver(f, m[1])) fallos.push(`${relativo(f)} carga «${m[1]}» con import(), que no existe`)
  }
}

// 2. Lo que piden las páginas.
const paginas = [...readdirSync(RAIZ).filter((n) => n.endsWith('.html')).map((n) => join(RAIZ, n)), ...ficheros(join(RAIZ, 'admin'), /\.html$/)]
for (const p of paginas) {
  const h = readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const refs = [...h.matchAll(/<script[^>]*\ssrc="([^"]+)"/g), ...h.matchAll(/<link[^>]*rel="(?:stylesheet|modulepreload|manifest)"[^>]*href="([^"]+)"/g), ...h.matchAll(/<link[^>]*href="([^"]+)"[^>]*rel="(?:stylesheet|modulepreload|manifest)"/g)]
  for (const [, url] of refs) {
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) continue
    const limpia = url.split(/[?#]/)[0]
    const f = limpia.startsWith('/') ? join(RAIZ, limpia) : resolve(dirname(p), limpia)
    if (!existsSync(f)) fallos.push(`${relativo(p)} pide «${url}», que no existe`)
  }
}

// 3. Los JSON que se leen.
for (const j of ['novedades.json', 'manifest.webmanifest']) {
  const f = join(RAIZ, j)
  if (!existsSync(f)) continue
  try { JSON.parse(readFileSync(f, 'utf8')) } catch (e) { fallos.push(`${j} no se puede leer: ${e.message}`) }
}

if (fallos.length) {
  console.error(`✋ No se publica: ${fallos.length} ${fallos.length === 1 ? 'cosa rota' : 'cosas rotas'}.\n` + fallos.map((x) => `  · ${x}`).join('\n'))
  process.exit(1)
}
console.log(`✅ Listo para salir: ${modulos.length} módulos, ${nombres} imports con nombre y ${paginas.length} páginas revisados.`)
