// La portada a 16:9 (tanda 796, SI4): quien sube su portada no tiene que
// recortarla antes. Se recorta por el centro en el navegador, a 1600 px de
// ancho como mucho, y se sube eso: la tarjeta de guía y la de noticia son
// 16:9, y una foto vertical subida a pelo salía con la cara cortada.
export function cajaDeRecorte(ancho, alto, proporcion = 16 / 9) {
  if (!ancho || !alto) return null
  if (ancho / alto > proporcion) {
    const w = Math.round(alto * proporcion)
    return { x: Math.round((ancho - w) / 2), y: 0, w, h: alto }
  }
  const h = Math.round(ancho / proporcion)
  return { x: 0, y: Math.round((alto - h) / 2), w: ancho, h }
}

export async function recortarPortada(file, { proporcion = 16 / 9, maxAncho = 1600 } = {}) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  try {
    const bitmap = await createImageBitmap(file)
    const c = cajaDeRecorte(bitmap.width, bitmap.height, proporcion)
    if (!c || (Math.abs(bitmap.width / bitmap.height - proporcion) < 0.01 && bitmap.width <= maxAncho)) return file
    const escala = Math.min(1, maxAncho / c.w)
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(c.w * escala)
    lienzo.height = Math.round(c.h * escala)
    lienzo.getContext('2d').drawImage(bitmap, c.x, c.y, c.w, c.h, 0, 0, lienzo.width, lienzo.height)
    const tipo = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise((ok) => lienzo.toBlob(ok, tipo, 0.88))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + (tipo === 'image/png' ? '.png' : '.jpg'), { type: tipo })
  } catch {
    // Si el navegador no sabe recortarla, se sube tal cual: mejor eso que nada.
    return file
  }
}
