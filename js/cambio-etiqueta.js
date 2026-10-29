// LA ETIQUETA DEL ENVÍO de un trato (tanda 1110, PINGU: «podría generar una
// etiqueta de envío, con los datos que da y con los datos que yo tengo»).
//
// Un A4 con la etiqueta en la esquina de arriba (105 × 148 mm, un cuarto de
// hoja, con su raya de corte): el destinatario en grande, tu dirección de
// remitente, cómo va (ordinario o certificado) y qué lleva. Se dibuja en un
// lienzo que va al PDF como JPEG, igual que las etiquetas de la tienda (1093,
// `pdfDeImagenes`). Sin DOM al importarlo: `textosDeEtiqueta` es puro y la
// prueba lo mira en Node.
import { pdfDeImagenes, PUNTOS_POR_MM } from './tiendas-puro.js'
import { lineasDeDireccion } from './cambio-propuesta-puro.js'

const PX_MM = 8
const A4 = [210, 297]
const ETIQUETA = [105, 148]
const C = { tinta: '#0d1b2a', suave: '#52717f', raya: '#c9dbe2' }
const LETRA = 'Inter, system-ui, sans-serif'
const TITULO = 'Outfit, Inter, system-ui, sans-serif'

// Lo que lleva la etiqueta, en texto: `para` y `de` son direcciones (`de`
// puede faltar: se deja hueco para escribirla a mano), `envio` el de
// `envioAutomatico`, `cartas` cuántas van.
export function textosDeEtiqueta({ para, de = null, envio = null, cartas = 0, seguimiento = null }) {
  return {
    tipo: envio?.tipo === 'certificado' ? 'CERTIFICADO' : 'ORDINARIO',
    destinatario: lineasDeDireccion(para),
    remitente: de ? lineasDeDireccion(de) : [],
    contenido: `Contiene: ${cartas === 1 ? '1 carta coleccionable' : `${cartas} cartas coleccionables`}. No doblar.`,
    seguimiento: seguimiento ? `Seguimiento: ${seguimiento}` : '',
  }
}

// Corta a lo que cabe, con «…».
function cortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

export async function lienzoDeEtiqueta(datos) {
  const t = textosDeEtiqueta(datos)
  const mm = (v) => Math.round(v * PX_MM)
  const c = document.createElement('canvas')
  c.width = mm(A4[0])
  c.height = mm(A4[1])
  const ctx = c.getContext('2d')
  try { await document.fonts?.ready } catch {}
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  // La raya de corte, muy suave, y el marco de la etiqueta.
  ctx.strokeStyle = C.raya
  ctx.lineWidth = 2
  ctx.setLineDash([mm(2), mm(1.5)])
  ctx.strokeRect(1, 1, mm(ETIQUETA[0]), mm(ETIQUETA[1]))
  ctx.setLineDash([])
  ctx.strokeStyle = C.tinta
  ctx.lineWidth = mm(0.5)
  const m = 6
  ctx.strokeRect(mm(m), mm(m), mm(ETIQUETA[0] - m * 2), mm(ETIQUETA[1] - m * 2))
  const X = mm(m + 5)
  const ancho = mm(ETIQUETA[0] - (m + 5) * 2)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  // Arriba: la marca y cómo va.
  ctx.fillStyle = C.tinta
  ctx.font = `800 ${mm(4.2)}px ${TITULO}`
  ctx.fillText('PokeDoc', X, mm(m + 9))
  ctx.font = `800 ${mm(3.6)}px ${LETRA}`
  const tipoAncho = ctx.measureText(t.tipo).width + mm(4)
  const tipoX = X + ancho - tipoAncho
  ctx.lineWidth = mm(0.4)
  ctx.strokeRect(tipoX, mm(m + 4), tipoAncho, mm(6.6))
  ctx.fillText(t.tipo, tipoX + mm(2), mm(m + 8.9))
  // El destinatario, en grande.
  let Y = mm(m + 22)
  ctx.fillStyle = C.suave
  ctx.font = `700 ${mm(2.8)}px ${LETRA}`
  ctx.fillText('DESTINATARIO', X, Y)
  Y += mm(8)
  ctx.fillStyle = C.tinta
  t.destinatario.forEach((l, i) => {
    ctx.font = `${i === 0 ? 800 : 600} ${mm(i === 0 ? 6 : 5.2)}px ${LETRA}`
    ctx.fillText(cortar(ctx, l, ancho), X, Y)
    Y += mm(i === 0 ? 8 : 7)
  })
  // Una raya y el remitente, más pequeño (o el hueco para escribirlo).
  Y = Math.max(Y + mm(4), mm(m + 82))
  ctx.strokeStyle = C.raya
  ctx.lineWidth = mm(0.3)
  ctx.beginPath()
  ctx.moveTo(X, Y)
  ctx.lineTo(X + ancho, Y)
  ctx.stroke()
  Y += mm(7)
  ctx.fillStyle = C.suave
  ctx.font = `700 ${mm(2.6)}px ${LETRA}`
  ctx.fillText('REMITENTE', X, Y)
  Y += mm(5.5)
  ctx.fillStyle = C.tinta
  ctx.font = `500 ${mm(3.6)}px ${LETRA}`
  if (t.remitente.length) {
    for (const l of t.remitente) {
      ctx.fillText(cortar(ctx, l, ancho), X, Y)
      Y += mm(4.8)
    }
  } else {
    ctx.strokeStyle = C.raya
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(X, Y + mm(1))
      ctx.lineTo(X + ancho, Y + mm(1))
      ctx.stroke()
      Y += mm(6)
    }
  }
  // Abajo: qué lleva y, si lo hay, el seguimiento.
  ctx.fillStyle = C.suave
  ctx.font = `500 ${mm(2.8)}px ${LETRA}`
  const abajo = mm(ETIQUETA[1] - m - 5)
  ctx.fillText(cortar(ctx, t.contenido, ancho), X, abajo)
  if (t.seguimiento) ctx.fillText(cortar(ctx, t.seguimiento, ancho), X, abajo - mm(4.5))
  return c
}

const comoJpeg = (c) => new Promise((ok, mal) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a)), mal) : mal(new Error('sin imagen'))), 'image/jpeg', 0.92))

export async function pdfDeEtiqueta(datos) {
  const c = await lienzoDeEtiqueta(datos)
  const pagina = { jpeg: await comoJpeg(c), ancho: c.width, alto: c.height }
  return pdfDeImagenes([pagina], { anchoPt: Math.round(A4[0] * PUNTOS_POR_MM * 100) / 100, altoPt: Math.round(A4[1] * PUNTOS_POR_MM * 100) / 100 })
}

// Descargarla. `nombre`: el del fichero, sin «.pdf».
export async function descargarEtiqueta(datos, nombre = 'etiqueta-envio') {
  const pdf = await pdfDeEtiqueta(datos)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  a.download = `${nombre}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
