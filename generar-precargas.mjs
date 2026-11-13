// LAS PRECARGAS DE MÓDULOS (tanda 1315, R2 del plan). La ficha de un torneo
// encadena seis niveles de `import`: el navegador descubre el sexto cuando ha
// bajado los cinco anteriores, y cada nivel es un viaje de ida y vuelta. Con
// un `<link rel="modulepreload">` por módulo en la cabecera, los pide todos a
// la vez desde el principio.
//
// Este generador recorre, para cada página, sus `<script type="module" src>`
// y TODO lo que importan de forma fija (`import … from`, `import '…'`,
// `export … from`), y escribe la lista entre
//   <!-- precargas: … -->  y  <!-- /precargas -->
// detrás de los seis de siempre (que van a mano y no se repiten). Lo que entra
// por `import()` NO se precarga: es lo que se baja solo al tocar algo, y
// precargarlo sería bajarlo siempre.
//
// Sin paso de compilación: es un fichero más que se regenera. Tras tocar los
// imports de una página, `node generar-precargas.mjs` (después de
// generar-barra-movil y generar-cartas). test-tanda-1315 comprueba que el repo
// lleva lo que sale de aquí.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'

const RAIZ = dirname(new URL(import.meta.url).pathname)
const INICIO = '<!-- precargas: las escribe generar-precargas.mjs (1315) -->'
const FIN = '<!-- /precargas -->'

const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
const FIJOS = /(?:^|[;\s}])(?:import|export)\s+(?:[^'"`;]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/gm

const cache = new Map()
function importsFijos(fichero) {
  if (cache.has(fichero)) return cache.get(fichero)
  const lista = []
  if (existsSync(fichero)) {
    const s = sinComentarios(readFileSync(fichero, 'utf8'))
    for (const m of s.matchAll(FIJOS)) {
      const destino = resolve(dirname(fichero), m[1])
      if (existsSync(destino)) lista.push(destino)
    }
  }
  cache.set(fichero, lista)
  return lista
}

// La ruta de la web (`/js/x.js`) de un `src` de la página.
function rutaDe(src, pagina) {
  if (/^(https?:)?\/\//.test(src)) return null
  const limpio = src.split(/[?#]/)[0]
  const f = limpio.startsWith('/') ? join(RAIZ, limpio) : resolve(dirname(pagina), limpio)
  return existsSync(f) ? f : null
}

// Los módulos de una página, en orden de descubrimiento (primero lo que pide
// la página, luego lo que piden ellos…).
export function modulosDe(html, pagina) {
  const entradas = [...html.matchAll(/<script[^>]*type="module"[^>]*\ssrc="([^"]+)"/g)].map((m) => rutaDe(m[1], pagina)).filter(Boolean)
  const vistos = new Set()
  const cola = [...entradas]
  while (cola.length) {
    const f = cola.shift()
    if (vistos.has(f)) continue
    vistos.add(f)
    cola.push(...importsFijos(f))
  }
  return [...vistos].map((f) => '/' + relative(RAIZ, f).replace(/\\/g, '/'))
}

export function bloqueDe(html, pagina) {
  const yaEstan = new Set([...html.replace(new RegExp(`${INICIO}[\\s\\S]*?${FIN}\\n?`), '').matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]))
  const lista = modulosDe(html, pagina).filter((r) => !yaEstan.has(r))
  if (!lista.length) return ''
  return `  ${INICIO}\n${lista.map((r) => `  <link rel="modulepreload" href="${r}" />`).join('\n')}\n  ${FIN}\n`
}

// Pone (o rehace) el bloque: detrás del último modulepreload a mano, o antes
// de la primera hoja si no hay ninguno.
export function conPrecargas(html, pagina) {
  const sin = html.replace(new RegExp(`  ${INICIO}[\\s\\S]*?${FIN}\\n`), '')
  const bloque = bloqueDe(sin, pagina)
  if (!bloque) return sin
  const manos = [...sin.matchAll(/^.*<link rel="modulepreload"[^\n]*\n/gm)]
  if (manos.length) {
    const ultimo = manos.at(-1)
    const i = ultimo.index + ultimo[0].length
    return sin.slice(0, i) + bloque + sin.slice(i)
  }
  const hoja = sin.search(/^\s*<link rel="stylesheet"/m)
  if (hoja < 0) return sin
  return sin.slice(0, hoja) + bloque + sin.slice(hoja)
}

export function paginas() {
  const raiz = readdirSync(RAIZ).filter((n) => n.endsWith('.html')).map((n) => join(RAIZ, n))
  const admin = existsSync(join(RAIZ, 'admin')) ? readdirSync(join(RAIZ, 'admin')).filter((n) => n.endsWith('.html')).map((n) => join(RAIZ, 'admin', n)) : []
  return [...raiz, ...admin]
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  let tocadas = 0
  let total = 0
  for (const p of paginas()) {
    const antes = readFileSync(p, 'utf8')
    const despues = conPrecargas(antes, p)
    total += (despues.match(/<!-- precargas:[\s\S]*?<!-- \/precargas -->/)?.[0].match(/modulepreload/g) || []).length
    if (despues !== antes) {
      writeFileSync(p, despues)
      tocadas++
    }
  }
  console.log(`🔗 Precargas: ${tocadas} páginas al día, ${total} módulos precargados en total.`)
}
