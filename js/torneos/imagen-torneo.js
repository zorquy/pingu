// LA IMAGEN DE UN TORNEO, SIN CAJA SI ES UN LOGO RECORTADO (1485, PINGU: «he
// puesto como icono el de Tradeitto. Es un PNG redondo. ¿Por qué sale el
// recuadro cuadrado? Debería ser redondo… la lógica que tenemos en los
// eventos»). Como en los eventos (1292), se mira AL SUBIRLA: si las cuatro
// esquinas son transparentes, es un logo sin fondo y se pinta tal cual, sin la
// caja de color. No hay columna nueva: la marca va en el nombre del fichero
// (`torneo-sinfondo-<hora>.png`), así que no hace falta migración y una imagen
// de antes se queda como estaba hasta que se vuelva a subir.
// Leerla al pintar es `esImagenSinFondo`, en arena-lista.js (lo baja /torneos
// y este fichero solo quien sube una imagen).
import { esquinasTransparentesDe } from '../eventos-puro.js'

// El tipo de subida que le toca (el que entiende uploadProfileImage). Un JPEG
// no tiene transparencia, y lo que no se deja leer se sube con su caja.
export async function tipoDeSubida(fichero) {
  if (!/png|webp|gif|svg/i.test(fichero?.type || '') || typeof createImageBitmap !== 'function') return 'torneo'
  try {
    const bmp = await createImageBitmap(fichero)
    const lado = 64
    const lienzo = document.createElement('canvas')
    lienzo.width = lado
    lienzo.height = lado
    const c = lienzo.getContext('2d', { willReadFrequently: true })
    c.drawImage(bmp, 0, 0, lado, lado)
    return esquinasTransparentesDe(c.getImageData(0, 0, lado, lado).data, lado, lado) ? 'torneo-sinfondo' : 'torneo'
  } catch {
    return 'torneo'
  }
}
