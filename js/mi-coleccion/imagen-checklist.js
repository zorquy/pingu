// LA LISTA DE UN SET, EN UNA IMAGEN (764, Z5 de la ronda 3): el checklist
// de toda la vida —número, nombre y una casilla— con lo tuyo marcado, para
// imprimirlo o mandarlo. Es lo que se lleva a una tienda o a una quedada:
// «¿me falta la 47?» se contesta mirando una lista, no abriendo la web.
//
// 1080 de ancho, como las demás (571, 733, 751); el ALTO crece con el set,
// porque un set de 250 cartas en 1350 px saldría ilegible. La máquina
// —descargar o compartir— es la de js/imagen-compartir.js.
import { compartirLienzo, redondeado } from '../imagen-compartir.js'

export const ANCHO = 1080
const CABECERA = 230
const PIE = 90
const FILA = 30
const MARGEN = 56

// Cuántas columnas: con pocas cartas, dos anchas; con muchas, hasta cuatro.
// Lo que se lee tiene que caber: el nombre se recorta, el número no.
export function columnasDeChecklist(n) {
  if (n <= 40) return 2
  if (n <= 120) return 3
  return 4
}

// Lo que dice la imagen, aparte del dibujo: se prueba sin lienzo.
export function textosDeChecklist({ nombre = '', cartas = [], dueno = '' }) {
  const n = cartas.length
  const tengo = cartas.filter((c) => c.tengo).length
  const columnas = columnasDeChecklist(n)
  const filas = Math.ceil(n / columnas)
  return {
    titulo: nombre || 'Mi álbum',
    sub: `${dueno ? `@${dueno} · ` : ''}tienes ${tengo} de ${n}${n ? ` · ${Math.round((tengo / n) * 100)} %` : ''}`,
    columnas,
    filas,
    alto: CABECERA + filas * FILA + PIE,
    // Por COLUMNAS, como un checklist impreso: se lee de arriba abajo.
    lineas: cartas.map((c, i) => ({ ...c, col: Math.floor(i / filas), fil: i % filas })),
    fichero: `pokedoc-checklist-${String(nombre || 'album').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`,
  }
}

function recortado(ctx, str, ancho) {
  let t = String(str || '')
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

export async function dibujarChecklist({ nombre, cartas, dueno = '', doc = document }) {
  const t = textosDeChecklist({ nombre, cartas, dueno })
  if (!t.lineas.length) throw new Error('Este álbum no tiene cartas que listar.')
  const lienzo = doc.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = t.alto
  const ctx = lienzo.getContext('2d')
  await doc.fonts?.ready
  // Fondo claro a propósito: se imprime.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ANCHO, t.alto)
  ctx.fillStyle = '#1e5175'
  ctx.fillRect(0, 0, ANCHO, 12)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#14202c'
  ctx.font = '700 60px Fredoka, Inter, sans-serif'
  ctx.fillText(recortado(ctx, t.titulo, ANCHO - 2 * MARGEN), MARGEN, 110)
  ctx.fillStyle = '#4a5a68'
  ctx.font = '500 30px Inter, sans-serif'
  ctx.fillText(t.sub, MARGEN, 160)

  const anchoCol = (ANCHO - 2 * MARGEN) / t.columnas
  for (const l of t.lineas) {
    const x = MARGEN + l.col * anchoCol
    const y = CABECERA + l.fil * FILA
    // La casilla: llena y con su ✓ si la tienes.
    redondeado(ctx, x, y - 18, 20, 20, 4)
    if (l.tengo) {
      ctx.fillStyle = '#0a7a55'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x + 4, y - 8)
      ctx.lineTo(x + 9, y - 3)
      ctx.lineTo(x + 16, y - 13)
      ctx.stroke()
    } else {
      ctx.strokeStyle = '#8a98a5'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fillStyle = l.tengo ? '#14202c' : '#4a5a68'
    ctx.font = '700 18px Inter, sans-serif'
    const num = String(l.numero ?? '')
    ctx.fillText(num, x + 30, y)
    const wNum = Math.max(44, ctx.measureText(num).width + 10)
    ctx.font = `${l.tengo ? 600 : 400} 18px Inter, sans-serif`
    ctx.fillText(recortado(ctx, l.nombre, anchoCol - 30 - wNum - 12), x + 30 + wNum, y)
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a98a5'
  ctx.font = '700 26px Inter, sans-serif'
  ctx.fillText('pokedoc.es', ANCHO / 2, t.alto - 36)
  return { lienzo, textos: t }
}

export async function compartirChecklist({ nombre, cartas, dueno = '' }) {
  const { lienzo, textos } = await dibujarChecklist({ nombre, cartas, dueno })
  await compartirLienzo(lienzo, { nombreFichero: textos.fichero, texto: `${textos.titulo}: ${textos.sub}. En PokeDoc: ${location.origin}` })
  return lienzo
}
