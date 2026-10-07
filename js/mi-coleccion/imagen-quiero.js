// «La quiero» en una imagen (tanda 751, Y3): tu lista para pegarla en un
// grupo de cambios. Las cartas que buscas con su nombre, las que más
// buscas primero (es el orden de la lista) y, si son muchas, «y N más».
// Sin precios: lo que vale una carta lo mira cada uno, y una imagen con
// euros invita a regatear antes de hablar.
//
// 1080 × 1350, como las demás (571, 733). La máquina —fotos con permiso y
// el menú del sistema— es la de js/imagen-compartir.js.
import { fotoParaElLienzo, dibujarCarta, redondeado, compartirLienzo } from '../imagen-compartir.js'
import { cadenaDeEscaneo } from '../escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from '../catalogo-series.js'

export const ANCHO = 1080
export const ALTO = 1350
const PROPORCION = 342 / 245

// Cuántas caben y de qué tamaño: con pocas, más grandes.
export function rejillaDeLaQuiero(n) {
  if (n <= 4) return { columnas: 2, ancho: 300, maximo: 4 }
  if (n <= 6) return { columnas: 3, ancho: 270, maximo: 6 }
  return { columnas: 5, ancho: 168, maximo: 15 }
}

// Lo que dice la imagen, aparte del dibujo: se prueba sin lienzo.
export function textosDeLaQuiero({ cartas = [], nombre = '' }) {
  const validas = cartas.filter((x) => x?.carta)
  const { maximo } = rejillaDeLaQuiero(validas.length)
  const n = validas.length
  return {
    titulo: 'Las que quiero',
    sub: `${nombre ? `@${nombre} · ` : ''}${n} ${n === 1 ? 'carta' : 'cartas'}`,
    cartas: validas.slice(0, maximo).map((x) => ({
      carta: x.carta,
      nombre: nombreDeCarta(x.carta),
      detalle: `${nombreDeSet(x.carta.tcg_sets) || x.carta.set_id || ''} · ${x.carta.local_id || ''}`,
      laQueFalta: x.prioridad === 3,
    })),
    mas: Math.max(0, n - maximo),
    fichero: `pokedoc-la-quiero${nombre ? `-${nombre}` : ''}.png`,
  }
}

function recortado(ctx, str, ancho) {
  let t = String(str || '')
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

export async function dibujarLaQuiero({ cartas = [], nombre = '', doc = document }) {
  const t = textosDeLaQuiero({ cartas, nombre })
  if (!t.cartas.length) throw new Error('Apunta alguna carta antes de compartir la lista.')
  const lienzo = doc.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  const ctx = lienzo.getContext('2d')
  await doc.fonts?.ready
  const fondo = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  fondo.addColorStop(0, '#5b1d3a')
  fondo.addColorStop(1, '#14202c')
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, ANCHO, ALTO)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 72px Fredoka, Inter, sans-serif'
  ctx.fillText(t.titulo, ANCHO / 2, 120)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '500 32px Inter, sans-serif'
  ctx.fillText(t.sub, ANCHO / 2, 174)

  const { columnas, ancho } = rejillaDeLaQuiero(t.cartas.length + t.mas)
  const alto = Math.round(ancho * PROPORCION)
  const hueco = 40
  const fila = alto + 100
  const filas = Math.ceil(t.cartas.length / columnas)
  const x0 = (ANCHO - (columnas * ancho + (columnas - 1) * hueco)) / 2
  const y0 = 220 + Math.max(0, (ALTO - 140 - 220 - filas * fila) / 2)
  const fotos = await Promise.all(t.cartas.map((x) => fotoParaElLienzo(cadenaDeEscaneo(x.carta))))
  t.cartas.forEach((x, i) => {
    const col = i % columnas
    const fil = Math.floor(i / columnas)
    // La última fila, centrada si no está llena.
    const enEsta = Math.min(columnas, t.cartas.length - fil * columnas)
    const desplaza = ((columnas - enEsta) * (ancho + hueco)) / 2
    const x1 = x0 + desplaza + col * (ancho + hueco)
    const y1 = y0 + fil * fila
    dibujarCarta(ctx, fotos[i], { x: x1, y: y1, w: ancho, h: alto, r: 14, nombre: x.nombre })
    if (x.laQueFalta) {
      ctx.font = `700 ${ancho < 200 ? 18 : 22}px Inter, sans-serif`
      const rotulo = 'LA que me falta'
      const w = Math.min(ancho - 8, ctx.measureText(rotulo).width + 28)
      redondeado(ctx, x1 + (ancho - w) / 2, y1 + alto - 48, w, 36, 18)
      ctx.fillStyle = '#e0457b'
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.fillText(rotulo, x1 + ancho / 2, y1 + alto - 23)
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 26px Inter, sans-serif'
    ctx.fillText(recortado(ctx, x.nombre, ancho), x1 + ancho / 2, y1 + alto + 34)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '500 20px Inter, sans-serif'
    ctx.fillText(recortado(ctx, x.detalle, ancho), x1 + ancho / 2, y1 + alto + 62)
  })
  if (t.mas) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 36px Inter, sans-serif'
    ctx.fillText(`y ${t.mas} más`, ANCHO / 2, ALTO - 88)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '700 30px Inter, sans-serif'
  ctx.fillText('pokedoc.es', ANCHO / 2, ALTO - 44)
  return { lienzo, textos: t }
}

export async function compartirLaQuiero({ cartas = [], nombre = '' }) {
  const { lienzo, textos } = await dibujarLaQuiero({ cartas, nombre })
  // El enlace es a PokeDoc y no a tu lista: «La quiero» solo la abre su
  // dueño, y un enlace que a los demás les abre otra cosa es una promesa
  // rota. Lo que buscas lo ven en Cambios, cruzado con lo suyo.
  await compartirLienzo(lienzo, { nombreFichero: textos.fichero, texto: `Las cartas que busco. ¿Tienes alguna? Escríbeme en PokeDoc: ${location.origin}` })
  return lienzo
}
