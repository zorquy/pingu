// Un sprite dibujado en un lienzo (tanda 997, sacado de meta-imagen.js): de
// dónde pedirlo para que el lienzo se pueda exportar y qué parte se ve. Sin
// dependencias de pantalla: lo importan la imagen del meta y la de
// /mis-partidas, y esta no debe arrastrar lo que pinta el meta (la 299).
import { CDN_SPRITES } from './sprites-pokemon.js'

// De la CDN de Limitless a /sprite, que es nuestra; lo demás, tal cual.
export function fuenteDeSprite(url) {
  const u = String(url || '')
  return u.startsWith(`${CDN_SPRITES}/`) ? `/sprite/${u.slice(CDN_SPRITES.length + 1).replace(/\.png$/, '')}` : u
}

// Lo que ocupa DE VERDAD un sprite: sin el marco transparente. Los de
// Limitless vienen recortados, pero los de PokeAPI (el respaldo, y desde la
// tanda 511 el sitio de las megas cuando /sprite no contesta) son de 96×96
// con el Pokémon en medio, y sin esto salían a un tercio de tamaño. Una
// imagen sin permiso no se puede leer: entonces, entera.
export function cajaVisible(img) {
  const entera = { x: 0, y: 0, w: img.width, h: img.height }
  try {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const k = c.getContext('2d')
    k.drawImage(img, 0, 0)
    const { data } = k.getImageData(0, 0, c.width, c.height)
    let x0 = c.width
    let y0 = c.height
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    return x1 < 0 ? entera : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
  } catch {
    return entera
  }
}
