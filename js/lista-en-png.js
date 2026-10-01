// La lista de un mazo DENTRO de su imagen exportada (tanda 421).
//
// PINGU: «que la imagen que te exportas sirva para importar la lista».
// Reconocer cartas por cómo se ven funciona, pero es aproximado: dos
// impresiones parecidas se confunden y un número mal leído es una copia
// de más. Así que la imagen lleva además la lista en texto, en un trozo
// `iTXt` del PNG (texto UTF-8 que cualquier visor ignora), y el
// constructor lo lee primero: con él, la importación es EXACTA.
//
// Si la imagen pasa por una red social se recomprime y el trozo se
// pierde: entonces queda el reconocimiento por imagen, que para eso la
// imagen se pinta como la de Limitless (js/constructor/imagen.js).
//
// Sin importaciones, sin DOM y sin clases: se prueba en Node.

export const CLAVE_LISTA = 'pokedoc:lista'

const FIRMA = [137, 80, 78, 71, 13, 10, 26, 10]

let tabla = null
function crc32(bytes) {
  if (!tabla) {
    tabla = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tabla[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (const b of bytes) c = tabla[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const esPng = (b) => b.length > 8 && FIRMA.every((v, i) => b[i] === v)

// Los trozos de un PNG: { tipo, desde (inicio de los datos), largo }.
function trozos(b) {
  const vista = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const fuera = []
  let p = 8
  while (p + 12 <= b.length) {
    const largo = vista.getUint32(p)
    const tipo = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7])
    if (p + 12 + largo > b.length) break
    fuera.push({ tipo, inicio: p, desde: p + 8, largo })
    p += 12 + largo
    if (tipo === 'IEND') break
  }
  return fuera
}

// Devuelve los bytes del PNG con la lista metida justo después de la
// cabecera (IHDR). Si no es un PNG, los devuelve tal cual.
export function meterLista(bytes, texto) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (!esPng(b)) return b
  const t = trozos(b)
  const ihdr = t.find((x) => x.tipo === 'IHDR')
  if (!ihdr) return b
  const enc = new TextEncoder()
  // iTXt: clave \0 · sin comprimir (0) · método (0) · idioma \0 · clave traducida \0 · texto
  const datos = new Uint8Array([...enc.encode(CLAVE_LISTA), 0, 0, 0, 0, 0, ...enc.encode(String(texto))])
  const tipo = enc.encode('iTXt')
  const trozo = new Uint8Array(12 + datos.length)
  const v = new DataView(trozo.buffer)
  v.setUint32(0, datos.length)
  trozo.set(tipo, 4)
  trozo.set(datos, 8)
  v.setUint32(8 + datos.length, crc32(new Uint8Array([...tipo, ...datos])))
  const corte = ihdr.desde + ihdr.largo + 4
  const fuera = new Uint8Array(b.length + trozo.length)
  fuera.set(b.subarray(0, corte), 0)
  fuera.set(trozo, corte)
  fuera.set(b.subarray(corte), corte + trozo.length)
  return fuera
}

// La lista que lleva dentro un PNG exportado por PokeDoc, o null.
export function sacarLista(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (!esPng(b)) return null
  const dec = new TextDecoder()
  for (const t of trozos(b)) {
    if (t.tipo !== 'iTXt') continue
    const d = b.subarray(t.desde, t.desde + t.largo)
    const fin = d.indexOf(0)
    if (fin < 0 || dec.decode(d.subarray(0, fin)) !== CLAVE_LISTA) continue
    // Comprimido no lo escribimos nunca: si lo está, no es nuestro.
    if (d[fin + 1] !== 0) return null
    let p = fin + 3
    p = d.indexOf(0, p) + 1 // el idioma
    p = d.indexOf(0, p) + 1 // la clave traducida
    if (p <= 0) return null
    const texto = dec.decode(d.subarray(p)).trim()
    return texto || null
  }
  return null
}
