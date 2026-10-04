// Que todo lo que se IMPORTA por su nombre EXISTA (tanda 510).
//
// ── POR QUÉ EXISTE ──
//
// La noche del 2026-10-04 añadí `rarezaDeCarta` a la lista de
// importación de `js/carta.js` dando por hecho que venía de
// `carta-traducciones.js` —que es de donde la coge `mi-coleccion.js`—,
// pero carta.js la pide por `carta-nucleo.js`, que no la reexportaba.
//
// Y un export que no existe **no rompe una función: rompe la página
// entera**. Es un `SyntaxError` al resolver el módulo, así que /carta se
// quedó sin NADA de JavaScript. Estuvo así en producción hora y media,
// hasta que la suite completa lo cantó con seis rojos.
//
// Esto lo caza en un segundo y sin navegador, que es la diferencia entre
// verlo antes de empujar y verlo ochenta minutos después. Recorre TODOS
// los módulos del repo, no una lista escrita a mano: una lista curada se
// queda vieja (tanda 323) y el fichero que falte es justo el que falla.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`)
}

function modulos(dir, fuera = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) modulos(p, fuera)
    else if (/\.(mjs|js)$/.test(n)) fuera.push(p)
  }
  return fuera
}

// Lo que un fichero EXPORTA por su nombre, incluyendo lo que reexporta.
// No se ejecuta nada: es lectura de texto, así que da igual que el módulo
// necesite un navegador o Supabase.
function exportaciones(f, vistos = new Set()) {
  if (vistos.has(f) || !existsSync(f)) return new Set()
  vistos.add(f)
  const s = readFileSync(f, 'utf8')
  const fuera = new Set()
  // `export function x`, `export const x`, `export class x`, `export let x`
  for (const m of s.matchAll(/(?:^|[;}\s])export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) fuera.add(m[1])
  // `export default`
  if (/^export\s+default\b/m.test(s)) fuera.add('default')
  // `export { a, b as c }` y `export { … } from './x.js'`.
  //
  // SIN anclar a principio de línea: el bundle de Supabase viene
  // MINIFICADO y escribe `export{hn as createClient}` sin espacio y a
  // mitad de una línea de 60 KB. La primera versión de esto lo marcó como
  // roto, y el roto era el parser — que es justo lo que tenía que pasar:
  // una guarda que no entiende un fichero debe cantarlo, no callárselo.
  for (const m of s.matchAll(/(?:^|[;}\s])export\s*\{([^}]*)\}\s*(?:from\s*['"]([^'"]+)['"])?/gm)) {
    for (const trozo of m[1].split(',')) {
      const t = trozo.trim()
      if (!t) continue
      const comoM = t.match(/\bas\s+([A-Za-z0-9_$]+)$/)
      fuera.add(comoM ? comoM[1] : t.split(/\s+/)[0])
    }
  }
  // `export * from './x.js'`: hereda todo lo del otro.
  for (const m of s.matchAll(/(?:^|[;}\s])export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
    const d = resolver(f, m[1])
    if (d) for (const e of exportaciones(d, vistos)) fuera.add(e)
  }
  return fuera
}

function resolver(desde, spec) {
  if (!spec.startsWith('.')) return null
  const p = resolve(dirname(desde), spec)
  return existsSync(p) ? p : null
}

console.log('── Todo lo que se importa por su nombre, ¿existe? ──')
const todos = modulos(join(RAIZ, 'js'))
  .concat(modulos(join(RAIZ, 'netlify')))
  .concat(modulos(join(RAIZ, 'admin', 'js')))
const cacheExp = new Map()
const exp = (f) => {
  if (!cacheExp.has(f)) cacheExp.set(f, exportaciones(f))
  return cacheExp.get(f)
}

const rotos = []
let revisados = 0
for (const f of todos) {
  const s = readFileSync(f, 'utf8')
  // `import { a, b as c } from './x.js'` — solo los RELATIVOS, que son
  // los nuestros. Un paquete de npm no se puede comprobar así.
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const destino = resolver(f, m[2])
    if (!destino) {
      rotos.push(`${f.replace(RAIZ + '/', '')} importa de «${m[2]}», que NO EXISTE`)
      continue
    }
    const tiene = exp(destino)
    for (const trozo of m[1].split(',')) {
      const t = trozo.trim()
      if (!t) continue
      const nombre = t.split(/\s+as\s+/)[0].trim()
      if (!nombre) continue
      revisados++
      if (!tiene.has(nombre)) {
        rotos.push(`${f.replace(RAIZ + '/', '')} importa «${nombre}» de ${m[2]}, que NO lo exporta`)
      }
    }
  }
}

// Que el barrido LLEGUE: de un repo del que no se recoge ni un import no
// se puede decir que no tenga ninguno roto (la lección de la 307).
check(`el barrido llega: ${todos.length} módulos, ${revisados} importaciones con nombre`, revisados > 300, String(revisados))
check('ninguna importación apunta a algo que no se exporta', rotos.length === 0, rotos.slice(0, 12).join('\n      '))

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
