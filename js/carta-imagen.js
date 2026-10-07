// UNA IMAGEN PARA COMPARTIR UNA CARTA (733, X7 de la lista): su foto en
// grande, el nombre, el set y el número, el precio y —si es tuya— «La
// tengo». En formato vertical (1080 × 1350), que es el que llena una
// historia o un post sin recortes. La máquina es la de siempre
// (`imagen-compartir.js`, 571): foto con permiso o por nuestra función,
// y el menú del sistema o la descarga.
import { fotoParaElLienzo, dibujarCarta, redondeado, compartirLienzo } from './imagen-compartir.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { euros } from './cardmarket.js'
import { aSlug } from './carta-ruta.js'

export const ANCHO = 1080
export const ALTO = 1350

// Lo que dice la imagen, aparte del dibujo: se prueba sin lienzo.
export function textosDeLaImagen({ carta, valor = null, tengo = null }) {
  return {
    nombre: nombreDeCarta(carta),
    detalle: `${nombreDeSet(carta?.tcg_sets) || carta?.set_id || ''} · ${carta?.local_id || ''}`,
    precio: valor ? `Desde ${euros(valor)}` : null,
    tengo: tengo ? (tengo === 1 ? 'La tengo' : `La tengo · ${tengo} copias`) : null,
    fichero: `pokedoc-${aSlug(nombreDeCarta(carta))}-${aSlug(carta?.id)}.png`,
  }
}

export async function dibujarImagenDeCarta({ carta, valor = null, tengo = null, doc = document }) {
  const t = textosDeLaImagen({ carta, valor, tengo })
  const lienzo = doc.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  const ctx = lienzo.getContext('2d')
  const fondo = ctx.createLinearGradient(0, 0, 0, ALTO)
  fondo.addColorStop(0, '#163a57')
  fondo.addColorStop(1, '#0b1219')
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, ANCHO, ALTO)
  const foto = await fotoParaElLienzo(cadenaDeEscaneo(carta, null, 'high'))
  const h = 800
  const w = Math.round((h * 63) / 88)
  dibujarCarta(ctx, foto, { x: (ANCHO - w) / 2, y: 90, w, h, r: 28, nombre: t.nombre })
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 64px Inter, sans-serif'
  ctx.fillText(t.nombre, ANCHO / 2, 990, ANCHO - 120)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '500 36px Inter, sans-serif'
  ctx.fillText(t.detalle, ANCHO / 2, 1046, ANCHO - 120)
  if (t.precio) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 56px Inter, sans-serif'
    ctx.fillText(t.precio, ANCHO / 2, 1136)
  }
  if (t.tengo) {
    ctx.font = '700 34px Inter, sans-serif'
    const ancho = ctx.measureText(t.tengo).width + 64
    redondeado(ctx, (ANCHO - ancho) / 2, 1172, ancho, 64, 32)
    ctx.fillStyle = '#0d9e6e'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(t.tengo, ANCHO / 2, 1216)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '700 30px Inter, sans-serif'
  ctx.fillText('pokedoc.es', ANCHO / 2, ALTO - 40)
  return { lienzo, textos: t }
}

export async function compartirCarta({ carta, valor = null, tengo = null, url = location.href }) {
  const { lienzo, textos } = await dibujarImagenDeCarta({ carta, valor, tengo })
  await compartirLienzo(lienzo, { nombreFichero: textos.fichero, texto: `${textos.nombre}${textos.precio ? ` — ${textos.precio}` : ''} en PokeDoc ${url}` })
  return lienzo
}
