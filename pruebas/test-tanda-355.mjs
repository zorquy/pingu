// Tanda 355 — el reconocimiento de imágenes y su herramienta gemela.
//
// `herramientas/huellas-limitless.js` (se pega en la consola de
// limitlesstcg.com para generar assets/constructor/huellas.bin) lleva
// COPIADAS las funciones de cálculo de js/constructor/imagen.js: si una
// copia cambia y la otra no, las huellas del fichero dejan de casar con
// las que calcula el navegador y el reconocimiento se degrada SIN dar
// error — cada carta sale «dudosa» y parece que la imagen es mala.
//
// Es la norma de la constante copiada (tanda 322): una copia sin
// vigilar se separa en silencio. Aquí se leen los dos ficheros como
// TEXTO y se comparan las funciones línea a línea.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

const RAIZ = '/home/user/pingu'
const modulo = readFileSync(`${RAIZ}/js/constructor/imagen.js`, 'utf8')
const herramienta = readFileSync(`${RAIZ}/herramientas/huellas-limitless.js`, 'utf8')

// El cuerpo de una función, del `function nombre(` a su llave de cierre,
// contando llaves. Vale porque ninguna de estas funciones lleva llaves
// dentro de cadenas o expresiones regulares — si algún día una las
// lleva, esta extracción se rompe A LA VISTA (no encuentra la función o
// la corta), no en silencio.
function sacar(texto, nombre) {
  const desde = texto.indexOf(`function ${nombre}(`)
  if (desde < 0) return null
  const abre = texto.indexOf('{', desde)
  let nivel = 0
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === '{') nivel++
    else if (texto[i] === '}' && --nivel === 0) return texto.slice(desde, i + 1)
  }
  return null
}

// Línea a línea y sin sangría: en la herramienta van dos espacios más
// adentro (viven dentro del IIFE) y eso no es una diferencia.
const normal = (t) =>
  t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .join('\n')

console.log('\n── 1. Las funciones copiadas son IDÉNTICAS ──')
for (const nombre of ['huella', 'compactar', 'detectar', 'distancia', 'parcheContador', 'plantillaCruda']) {
  const a = sacar(modulo, nombre)
  const b = sacar(herramienta, nombre)
  check(`${nombre} está en los dos ficheros`, !!a && !!b)
  if (a && b) {
    const iguales = normal(a) === normal(b)
    check(`${nombre} es idéntica`, iguales, iguales ? '' : 'las dos copias se han separado: iguala la de herramientas/huellas-limitless.js y REGENERA huellas.bin')
  }
}

console.log('\n── 2. Y la zona del contador también ──')
{
  const zona = (t) => (t.match(/const ZONA_CONTADOR = \{[^}]*\}/) || [null])[0]
  const a = zona(modulo)
  const b = zona(herramienta)
  check('ZONA_CONTADOR está en los dos', !!a && !!b)
  if (a && b) check('y es la misma', normal(a) === normal(b))
}

console.log('\n── 3. El fichero de huellas del repo se puede leer ──')
{
  // Con el MISMO lector del navegador: si el formato y el lector se
  // separan, esto revienta aquí y no en la cara de quien sube una foto.
  const { leerFichero } = await import(`${RAIZ}/js/constructor/imagen.js`)
  const buf = readFileSync(`${RAIZ}/assets/constructor/huellas.bin`)
  let db = null
  try {
    db = leerFichero(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  } catch (e) {
    check('leerFichero lo abre', false, e.message)
  }
  if (db) {
    check('leerFichero lo abre', true)
    check('tiene miles de cartas (Estándar entero)', db.cartas.length > 4000, db.cartas.length)
    check('el largo de huella cuadra con fw×fh', db.flen === db.fw * db.fh + 2 * (db.fw >> 1) * (db.fh >> 1))
    check('las 20 plantillas del contador están', db.plantillas.length === 20, db.plantillas.length)
    check('cada carta dice set, número y nombre', db.cartas.every((c) => c.set && c.num && c.nombre))
  }
}

console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
