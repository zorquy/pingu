// La imagen que se comparte de un reto (tanda 583).
//
// El texto con emojis (568) es lo que se pega en WhatsApp; la IMAGEN es
// lo que se sube a una historia de Instagram o se manda por donde un
// texto no luce. Es la misma pieza para los tres retos: un título, la
// cuenta grande, la tira de cuadrados (o varias filas, en «¿Qué carta
// es?»), la racha y el enlace. Opcionalmente una foto (la carta del día,
// ya resuelta).
//
// 1080×1350, como la de la colección (571): el formato de historia.
import { redondeado, dibujarCarta } from './imagen-compartir.js'

export const ANCHO = 1080
export const ALTO = 1350

function fondo(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, ALTO)
  g.addColorStop(0, '#1e5175')
  g.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ANCHO, ALTO)
}

// Una fila de cuadrados centrada en `y`; cada valor: true (verde), false
// (rojo) o null (vacío, gris).
function fila(ctx, valores, y, lado = 72, hueco = 18) {
  const total = valores.length * lado + (valores.length - 1) * hueco
  let x = (ANCHO - total) / 2
  for (const v of valores) {
    ctx.fillStyle = v === true ? '#2e9e5b' : v === false ? '#d64545' : 'rgba(255,255,255,0.18)'
    redondeado(ctx, x, y, lado, lado, 14)
    ctx.fill()
    x += lado + hueco
  }
}

// `filas` manda sobre `tira`: una tira es una sola fila.
export function pintarResultadoReto(lienzo, { titulo, cuenta, detalle = '', tira = null, filas = null, racha = 0, enlace, foto = null, fotoNombre = '' }) {
  const ctx = lienzo.getContext('2d')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  fondo(ctx)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.font = '700 44px Fredoka, Inter, sans-serif'
  ctx.fillText('PokeDoc · reto diario', ANCHO / 2, 110)
  ctx.font = '700 64px Fredoka, Inter, sans-serif'
  ctx.fillText(titulo, ANCHO / 2, 200)

  let y = 260
  if (foto) {
    const w = 360
    const h = Math.round((w * 342) / 245)
    dibujarCarta(ctx, foto, { x: (ANCHO - w) / 2, y, w, h, r: 20, nombre: fotoNombre })
    y += h + 70
  } else {
    y += 60
  }

  ctx.fillStyle = '#fff'
  ctx.font = '700 160px Fredoka, Inter, sans-serif'
  ctx.fillText(cuenta, ANCHO / 2, y + 120)
  y += 170
  if (detalle) {
    ctx.font = '500 40px Inter, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(detalle, ANCHO / 2, y + 30)
    y += 70
  }

  const lineas = filas || (tira ? [tira] : [])
  const lado = lineas.length > 3 ? 48 : 72
  const hueco = lineas.length > 3 ? 12 : 18
  y += 30
  for (const l of lineas) {
    fila(ctx, l, y, lado, hueco)
    y += lado + hueco
  }

  if (racha >= 2) {
    ctx.fillStyle = '#ffd166'
    ctx.font = '700 44px Inter, sans-serif'
    ctx.fillText(`🔥 ${racha} días seguidos`, ANCHO / 2, y + 60)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 40px Inter, sans-serif'
  ctx.fillText(enlace, ANCHO / 2, ALTO - 80)
  return lienzo
}
