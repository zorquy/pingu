// «Compartir» de Tus colores (tanda 1411): la pared en una imagen para redes,
// con el marco común (`redes-marco.js`) en el oro de Colección. Hasta 30
// ilustraciones en el orden de la pared y debajo la tira de tus colores con
// su peso. Entra por `import()` desde tus-colores.js.
import { fotoParaElLienzo, dibujarCarta, redondeado } from '../imagen-compartir.js'
import { pintarMarco } from '../redes-marco.js'
import { cadenaDeEscaneo } from '../escaneo-carta.js'

const PROP = 342 / 245
export const MAXIMO = 30

// Puro: cuántas columnas para que quepan n cartas en la caja lo más grandes
// posible (de 3 a 6).
export function columnasPara(n, caja) {
  let mejor = { columnas: 3, w: 0 }
  for (let col = 3; col <= 6; col++) {
    const filas = Math.ceil(n / col)
    const w = Math.min((caja.w - 10 * (col - 1)) / col, (caja.h - 10 * (filas - 1)) / filas / PROP)
    if (w > mejor.w) mejor = { columnas: col, w }
  }
  return mejor
}

export function textoDeColores({ resumen, color, n }) {
  const lineas = [color ? `🎨 Mis ilustraciones de color ${color.toLowerCase()} en PokeDoc` : '🎨 Mi colección, por colores, en PokeDoc']
  if (!color && resumen) lineas.push(`Mi color: ${resumen.mas.color} (${resumen.mas.pct} %)`)
  lineas.push(`${n} ${n === 1 ? 'ilustración' : 'ilustraciones'}`)
  lineas.push('pokedoc.es')
  return lineas.join('\n')
}

export function pintarColores(lienzo, { fotos = [], grupos = [], titulo = '', formato = 'historia' }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'coleccion',
    chapa: 'Mis colores',
    titulo,
    enlace: 'pokedoc.es',
    linea: formato === 'larga' ? 'Enlace en la bio' : apaisada ? '' : 'Mira los tuyos en PokeDoc',
    maxLineas: 2,
  })
  const tira = apaisada ? 26 : 44
  const libre = { x: caja.x, y: caja.y, w: caja.w, h: caja.h - tira - 18 }
  const lista = fotos.slice(0, MAXIMO)
  const { columnas, w: ancho } = columnasPara(lista.length || 1, libre)
  const w = Math.floor(ancho)
  const h = Math.round(w * PROP)
  const filas = Math.ceil(lista.length / columnas)
  const altoTodo = filas * h + (filas - 1) * 10
  const y0 = libre.y + Math.max(0, (libre.h - altoTodo) / 2)
  lista.forEach((f, i) => {
    const fila = Math.floor(i / columnas)
    const enFila = Math.min(columnas, lista.length - fila * columnas)
    const x0 = libre.x + (libre.w - (enFila * w + (enFila - 1) * 10)) / 2
    dibujarCarta(ctx, f.img, { x: x0 + (i % columnas) * (w + 10), y: y0 + fila * (h + 10), w, h, r: Math.max(4, Math.round(w / 16)), nombre: '' })
  })
  // La tira de colores, de lado a lado de la caja.
  const total = grupos.reduce((s, g) => s + g.n, 0) || 1
  let x = caja.x
  const yT = caja.y + caja.h - tira
  ctx.save()
  redondeado(ctx, caja.x, yT, caja.w, tira, tira / 2)
  ctx.clip()
  for (const g of grupos) {
    const ancho = (caja.w * g.n) / total
    ctx.fillStyle = g.hex
    ctx.fillRect(x, yT, ancho + 1, tira)
    x += ancho
  }
  ctx.restore()
  return lienzo
}

export async function compartirColores({ fichas = [], grupos = [], resumen = null, color = null }) {
  if (!fichas.length) throw new Error('No hay ilustraciones que enseñar.')
  const { abrirHojaCompartir } = await import('../compartir-hoja.js')
  const titulo = color ? `Mis cartas *${color.toLowerCase()}*` : resumen ? `Mi color es el *${resumen.mas.color === 'marrón' ? 'marrón' : resumen.mas.color}*` : 'Mi colección en *colores*'
  let fotos = null
  return abrirHojaCompartir({
    titulo: 'Compartir tus colores',
    texto: textoDeColores({ resumen, color, n: fichas.length }),
    nombre: 'mis-colores',
    historiaPropia: true,
    imagen: async (formato) => {
      if (!fotos) fotos = await Promise.all(fichas.slice(0, MAXIMO).map(async (f) => ({ img: await fotoParaElLienzo(cadenaDeEscaneo(f.carta, null, 'low')) })))
      return pintarColores(document.createElement('canvas'), { fotos, grupos: color ? grupos.filter((g) => g.color === fichas[0].color) : grupos, titulo, formato })
    },
  })
}
