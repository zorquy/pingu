// Comprimir una foto EN EL NAVEGADOR antes de subirla (tanda 891).
//
// Una foto de móvil son 3 o 4 MB para enseñar una carta en una burbuja de
// chat. Se reduce a 1.600 px de lado mayor y WebP al 82 %: se queda en
// 200–300 KB, subir tarda un segundo y el almacenamiento no crece. Si el
// navegador no sabe hacer WebP (Safari viejo) sale JPEG; si no sabe ni
// descodificar el fichero (un HEIC en un navegador que no lo lee) se
// devuelve tal cual y la foto sube sin tocar: mejor eso que ninguna.
//
// Lo puro (`medidaReducida`) vive en js/mensajes-puro.js, que no importa
// nada, para probarlo en Node.
import { medidaReducida } from './mensajes-puro.js'

export const LADO_MAX = 1600
export const CALIDAD = 0.82

async function descodificar(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* se prueba con <img> abajo */
    }
  }
  if (typeof document === 'undefined') return null
  return new Promise((listo) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      listo(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      listo(null)
    }
    img.src = url
  })
}

// Devuelve { blob, tipo, ancho, alto }. `ancho` y `alto` son los de la
// foto que se sube: se guardan con el mensaje para reservar su hueco.
export async function comprimirImagen(file, { ladoMax = LADO_MAX, calidad = CALIDAD } = {}) {
  const origen = await descodificar(file)
  if (!origen || typeof document === 'undefined') return { blob: file, tipo: file.type || 'image/jpeg', ancho: 0, alto: 0 }
  const anchoOrigen = origen.naturalWidth || origen.width
  const altoOrigen = origen.naturalHeight || origen.height
  const { ancho, alto } = medidaReducida(anchoOrigen, altoOrigen, ladoMax)
  try {
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    lienzo.getContext('2d').drawImage(origen, 0, 0, ancho, alto)
    // WebP si el navegador lo sabe escribir: `toBlob` con un tipo que no
    // conoce devuelve PNG, así que se mira el tipo de lo que sale.
    let blob = await new Promise((listo) => lienzo.toBlob(listo, 'image/webp', calidad))
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((listo) => lienzo.toBlob(listo, 'image/jpeg', calidad))
    if (!blob) return { blob: file, tipo: file.type || 'image/jpeg', ancho: anchoOrigen, alto: altoOrigen }
    // Si comprimida pesa más que el original (un PNG pequeño), va el original.
    if (blob.size >= file.size && ancho === anchoOrigen && /^image\/(jpeg|png|webp)$/.test(file.type)) {
      return { blob: file, tipo: file.type, ancho: anchoOrigen, alto: altoOrigen }
    }
    return { blob, tipo: blob.type, ancho, alto }
  } catch {
    return { blob: file, tipo: file.type || 'image/jpeg', ancho: anchoOrigen, alto: altoOrigen }
  } finally {
    origen.close?.()
  }
}

export const extensionDe = (tipo) => (tipo === 'image/webp' ? 'webp' : tipo === 'image/png' ? 'png' : 'jpg')
