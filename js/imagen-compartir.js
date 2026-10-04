// La máquina de la imagen para compartir (tanda 571): cargar fotos en un
// canvas que SÍ se exporta, dibujar, y sacarla por el menú del sistema o
// como descarga. Nació en js/nueve.js (566) y sale a su fichero porque
// «Mi colección en una imagen» pide exactamente lo mismo con otro dibujo.
//
// Lo del CORS, que es lo único con enjundia: una foto de otro dominio
// dibujada en un canvas sin permiso lo deja «sucio» y `toBlob()` revienta.
// Cada foto se prueba directa con `crossOrigin`; si el navegador la
// rechaza, se pide a nuestra función `imagen-carta`, que la sirve con el
// permiso puesto. Si tampoco, null: quien dibuja pone un hueco con nombre.
import { showToast } from './toast.js'

export function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('no carga'))
    img.src = url
  })
}

export async function fotoParaElLienzo(cadena) {
  for (const url of cadena || []) {
    try {
      return await cargarImagen(url)
    } catch {
      // sin permiso o sin foto: por nuestra función
    }
    try {
      return await cargarImagen(`/.netlify/functions/imagen-carta?u=${encodeURIComponent(url)}`)
    } catch {
      // la siguiente de la cadena
    }
  }
  return null
}

export function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Una foto con esquinas redondeadas, o un hueco con un texto si no hay.
export function dibujarCarta(ctx, img, { x, y, w, h, r = 14, nombre = '' }) {
  ctx.save()
  redondeado(ctx, x, y, w, h, r)
  ctx.clip()
  if (img) {
    ctx.drawImage(img, x, y, w, h)
  } else {
    ctx.fillStyle = '#2a3a4c'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = '700 22px Inter, sans-serif'
    ctx.fillText(nombre, x + w / 2, y + h / 2)
  }
  ctx.restore()
}

export function comoBlob(lienzo) {
  return new Promise((resolve, reject) => {
    try {
      lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png')
    } catch (err) {
      reject(err)
    }
  })
}

export async function descargarLienzo(lienzo, nombreFichero) {
  try {
    const blob = await comoBlob(lienzo)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nombreFichero
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    return true
  } catch {
    showToast('No se ha podido generar la imagen.', 'error')
    return false
  }
}

// Por el menú del sistema con el fichero (Instagram, WhatsApp, X); sin
// menú (escritorio), se descarga y se abre X con el texto puesto.
export async function compartirLienzo(lienzo, { nombreFichero, texto }) {
  try {
    const blob = await comoBlob(lienzo)
    const fichero = new File([blob], nombreFichero, { type: 'image/png' })
    if (navigator.canShare?.({ files: [fichero] })) {
      await navigator.share({ files: [fichero], text: texto })
      return
    }
    await descargarLienzo(lienzo, nombreFichero)
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  } catch (err) {
    if (err?.name === 'AbortError') return
    showToast('No se ha podido compartir. Prueba a descargar la imagen.', 'error')
  }
}
