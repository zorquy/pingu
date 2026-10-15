// La expansión que llevas, en una imagen (873): el logo, el anillo con el
// tanto por ciento, «N de M» y lo que valen las tuyas. Entra por `import()`
// desde el ⋮ de la expansión («Compartir la expansión»).
import { fondo, medidasDe } from '../reto-imagen.js'
import { cargarImagen } from '../imagen-compartir.js'

const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'
export const ENLACE = 'pokedoc.es/cartas'

const euros = (n) => `${Math.round(n).toLocaleString('es-ES')} €`

// Puro: lo que se pega.
export function textoDeExpansion({ nombre, tengo = 0, total = 0, pct = 0, valor = 0 }) {
  const lineas = [`📦 ${nombre}: llevo ${tengo} de ${total} (${pct} %) en PokeDoc${tengo >= total && total ? ' ✅ ¡completa!' : ''}`]
  if (valor > 0) lineas.push(`💶 Las mías valen ${euros(valor)}`)
  lineas.push(ENLACE)
  return lineas.join('\n')
}

// Un anillo de progreso centrado en (cx, cy).
function anillo(ctx, cx, cy, r, grosor, pct) {
  ctx.lineWidth = grosor
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  if (pct > 0) {
    ctx.strokeStyle = pct >= 100 ? '#ffd166' : '#2e9e5b'
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(100, pct)) / 100)
    ctx.stroke()
  }
}

// Un logo que cabe en una caja, centrado y sin deformar.
function logoEnCaja(ctx, img, cx, cy, maxW, maxH) {
  if (!img) return false
  const k = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = img.width * k
  const h = img.height * k
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  return true
}

export function pintarExpansion(lienzo, { nombre, logo = null, tengo = 0, total = 0, pct = 0, valor = 0, formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondo(ctx, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const apaisada = formato === 'apaisada'
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${apaisada ? 30 : 44}px ${TITULAR}`
  ctx.fillText('PokeDoc · mi colección', W / 2, apaisada ? 64 : 110)
  // El logo (o el nombre si no hay) y el anillo.
  const cx = apaisada ? 320 : W / 2
  const cy = apaisada ? 330 : 560
  const r = apaisada ? 150 : 250
  anillo(ctx, cx, cy, r, apaisada ? 22 : 34, pct)
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${apaisada ? 96 : 160}px ${TITULAR}`
  ctx.fillText(`${pct} %`, cx, cy + (apaisada ? 34 : 56))
  const tx = apaisada ? 800 : W / 2
  if (!logoEnCaja(ctx, logo, tx, apaisada ? 150 : 250, apaisada ? 560 : 700, apaisada ? 130 : 120)) {
    ctx.font = `700 ${apaisada ? 44 : 60}px ${TITULAR}`
    ctx.fillText(nombre, tx, apaisada ? 170 : 240)
  }
  ctx.font = `700 ${apaisada ? 72 : 110}px ${TITULAR}`
  ctx.fillText(`${tengo} de ${total}`, tx, apaisada ? 330 : 960)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `500 ${apaisada ? 30 : 40}px ${TEXTO}`
  ctx.fillText(tengo >= total && total ? '¡Completa!' : `${total - tengo} por conseguir`, tx, apaisada ? 385 : 1020)
  if (valor > 0) {
    ctx.fillStyle = '#ffd166'
    ctx.font = `700 ${apaisada ? 30 : 40}px ${TEXTO}`
    ctx.fillText(`Las mías valen ${euros(valor)}`, tx, apaisada ? 445 : 1090)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 ${apaisada ? 28 : 40}px ${TEXTO}`
  ctx.fillText(ENLACE, W / 2, H - (apaisada ? 40 : 80))
  return lienzo
}

export async function compartirExpansion({ nombre, logoUrl = null, tengo, total, pct, valor }) {
  const { abrirHojaCompartir } = await import('../compartir-hoja.js')
  let logo = null
  let pedido = false
  return abrirHojaCompartir({
    titulo: nombre,
    texto: textoDeExpansion({ nombre, tengo, total, pct, valor }),
    nombre: `expansion-${String(nombre).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    imagen: async (formato) => {
      if (!pedido && logoUrl) {
        pedido = true
        logo = await cargarImagen(logoUrl).catch(() => null)
      }
      return pintarExpansion(document.createElement('canvas'), { nombre, logo, tengo, total, pct, valor, formato })
    },
  })
}
