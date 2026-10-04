// «Mi colección en una imagen» (tanda 571): el dibujo. La máquina —fotos
// con permiso, exportar, compartir— está en js/imagen-compartir.js.
//
// Esto no lo puede hacer PTCGenius ni TCGdex: no tienen tu colección. Las
// cuatro cifras de la cabecera, las tres que más valen con su foto, la
// expansión más completa y desde cuándo coleccionas. 1080 × 1350, el
// retrato de Instagram. Los colores van a pelo porque no es la página: es
// una imagen que se ve fuera, donde no hay tema claro ni oscuro.
import { fotoParaElLienzo, dibujarCarta } from '../imagen-compartir.js'

export const ANCHO = 1080
export const ALTO = 1350

function cifra(ctx, x, y, valor, rotulo) {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 64px Fredoka, Inter, sans-serif'
  ctx.fillText(valor, x, y)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '500 26px Inter, sans-serif'
  ctx.fillText(rotulo, x, y + 36)
}

// `datos`: { quien, copias, distintas, sets, valor, valiosas: [{ nombre,
// cadena, valor }], mejorSet: { nombre, tengo, total } | null, desde }
export async function pintarImagenDeColeccion(lienzo, datos) {
  const ctx = lienzo.getContext('2d')
  await document.fonts.ready
  const grad = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  grad.addColorStop(0, '#1e5175')
  grad.addColorStop(1, '#10141c')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // Cabecera
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 64px Fredoka, Inter, sans-serif'
  ctx.fillText('Mi colección', ANCHO / 2, 96)
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '500 30px Inter, sans-serif'
  ctx.fillText(`${datos.quien ? `de @${datos.quien} · ` : ''}Pokémon TCG`, ANCHO / 2, 142)

  // Las cuatro cifras, en dos por dos
  cifra(ctx, 90, 260, String(datos.copias), 'cartas')
  cifra(ctx, 560, 260, String(datos.distintas), 'distintas')
  cifra(ctx, 90, 400, String(datos.sets), datos.sets === 1 ? 'colección' : 'colecciones')
  cifra(ctx, 560, 400, datos.valor, 'de valor')

  // Las tres que más valen, con su foto
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 30px Inter, sans-serif'
  ctx.fillText('Las que más valen', 90, 512)
  const valiosas = (datos.valiosas || []).slice(0, 3)
  const fotos = await Promise.all(valiosas.map((v) => fotoParaElLienzo(v.cadena)))
  const cw = 280
  const ch = Math.round((cw * 342) / 245)
  const hueco = (ANCHO - 180 - cw * 3) / 2
  valiosas.forEach((v, i) => {
    const x = 90 + i * (cw + hueco)
    dibujarCarta(ctx, fotos[i], { x, y: 540, w: cw, h: ch, nombre: v.nombre })
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 26px Inter, sans-serif'
    ctx.fillText(v.valor, x + cw / 2, 540 + ch + 40)
  })

  // La expansión más completa, con su barra
  const yExp = 540 + ch + 120
  if (datos.mejorSet) {
    const { nombre, tengo, total } = datos.mejorSet
    const pct = total ? Math.round((tengo / total) * 100) : 0
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '700 30px Inter, sans-serif'
    ctx.fillText('Mi expansión más completa', 90, yExp)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 34px Inter, sans-serif'
    ctx.fillText(nombre, 90, yExp + 50)
    ctx.textAlign = 'right'
    ctx.fillText(`${tengo} de ${total} · ${pct} %`, ANCHO - 90, yExp + 50)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(90, yExp + 72, ANCHO - 180, 18)
    ctx.fillStyle = '#5ad1a4'
    ctx.fillRect(90, yExp + 72, Math.round((ANCHO - 180) * Math.min(1, tengo / (total || 1))), 18)
  }

  // Pie
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '500 26px Inter, sans-serif'
  if (datos.desde) ctx.fillText(datos.desde, ANCHO / 2, ALTO - 72)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 34px Fredoka, Inter, sans-serif'
  ctx.fillText('pokedoc.es/mi-coleccion', ANCHO / 2, ALTO - 26)
}
