// La insignia de las copias en la imagen exportada de un mazo (tanda 421).
//
// La pinta js/torneos/decklist-imagen.js encima de cada carta y la LEE
// js/constructor/imagen.js al importar una lista desde una imagen: por
// eso vive aquí, en un solo sitio. Si cambia el dibujo o la geometría,
// cambian los dos lados a la vez — el lector se hace sus plantillas
// pintando con esta MISMA función, no con un fichero precalculado.
//
// Va donde Limitless pone su hexágono rojo (abajo y en el centro), que
// es la zona que mira el lector (ZONA_CONTADOR en imagen.js), pero con
// el azul de la casa y el canto blanco: el toque de PokeDoc.
//
// Sin importaciones y sin clases: solo un canvas.

// Relativa a la carta: el centro, en fracción del ancho y del alto; el
// radio, en fracción del ancho. Cabe entera en la zona del contador.
export const INSIGNIA = { cx: 0.5, cy: 0.84, r: 0.2 }
export const AZUL_INSIGNIA = ['#2a6b96', '#163d59']

// ¿Es este píxel del azul de la insignia? Lo usa el lector para saber si
// hay insignia antes de intentar leer un número (sin ella, cualquier
// plantilla «casaría» un poco y saldría un número inventado).
export function esAzulInsignia(r, g, b) {
  return b > 70 && b - r > 40 && g > r && g < 125
}

export function dibujarInsignia(ctx, n, x, y, w, h) {
  const R = w * INSIGNIA.r
  const cx = x + w * INSIGNIA.cx
  const cy = y + h * INSIGNIA.cy
  ctx.save()
  ctx.beginPath()
  // Hexágono con la punta arriba, como el de Limitless.
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3
    const px = cx + R * Math.cos(a)
    const py = cy + R * Math.sin(a)
    if (k) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  }
  ctx.closePath()
  const g = ctx.createLinearGradient(cx, cy - R, cx, cy + R)
  g.addColorStop(0, AZUL_INSIGNIA[0])
  g.addColorStop(1, AZUL_INSIGNIA[1])
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = Math.max(1, R * 0.12)
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  const texto = String(n)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${Math.round(R * (texto.length > 1 ? 0.92 : 1.1))}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, cx, cy + R * 0.06)
  ctx.restore()
}

// La letra tiene que estar cargada antes de pintar: un canvas no espera
// a una fuente, pinta con la de respaldo y ya no cambia.
export async function cargarLetraInsignia() {
  try {
    await document.fonts.load('800 40px Inter')
  } catch {
    // Sin la fuente se pinta con la del sistema: se lee igual.
  }
}
