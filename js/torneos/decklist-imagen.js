// Bajar una decklist como imagen PNG (tanda 219). La imagen se dibuja a
// mano en un canvas — sin librerías, que el cliente de PokeDoc no carga
// dependencias nuevas — con las tres secciones y los colores de la casa.
//
// Vive SUELTO de decklist-export.js (tanda 358): esto no pinta ni una
// clase de CSS, y el constructor de mazos lo usa desde una página que no
// carga torneos.css. El módulo de al lado pinta los botones
// (`.torneo-exportar`), y una página «usa» las clases de todo lo que
// importa (la regla del barrido de la 299/316).
import { showToast } from '../toast.js'

const SECCIONES = [
  { campo: 'pokemon', titulo: 'Pokémon' },
  { campo: 'trainer', titulo: 'Trainer' },
  { campo: 'energy', titulo: 'Energía' },
]

export function descargarImagenDecklist(nombre, parsed) {
  const secciones = SECCIONES.map((s) => ({ ...s, lineas: parsed?.[s.campo] || [] })).filter(
    (s) => s.lineas.length
  )
  if (!secciones.length) {
    showToast('No hay lista que exportar.', 'error')
    return
  }

  const ancho = 700
  const margen = 32
  const altoLinea = 26
  // La altura se calcula ANTES de dibujar: título + subtítulo y, por
  // sección, su cabecera más una línea por carta.
  let alto = margen + 34 + 24 + 8
  for (const s of secciones) alto += 16 + altoLinea + s.lineas.length * altoLinea + 14
  alto += margen

  const canvas = document.createElement('canvas')
  const escala = 2 // nítido también en pantallas retina
  canvas.width = ancho * escala
  canvas.height = alto * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ancho, alto)

  let y = margen + 24
  ctx.fillStyle = '#1e5175' // el navy de PokeDoc
  ctx.font = '700 22px Inter, system-ui, sans-serif'
  ctx.fillText(nombre, margen, y)
  y += 24
  ctx.fillStyle = '#8a8a8a'
  ctx.font = '400 13px Inter, system-ui, sans-serif'
  ctx.fillText(`${parsed.total ?? '?'} cartas · pokedoc.es`, margen, y)
  y += 8

  for (const s of secciones) {
    y += 16 + altoLinea
    const total = s.lineas.reduce((n, l) => n + l.quantity, 0)
    ctx.fillStyle = '#1e5175'
    ctx.font = '700 15px Inter, system-ui, sans-serif'
    ctx.fillText(`${s.titulo} (${total})`, margen, y)
    ctx.strokeStyle = '#e3e3e3'
    ctx.beginPath()
    ctx.moveTo(margen, y + 7)
    ctx.lineTo(ancho - margen, y + 7)
    ctx.stroke()
    for (const linea of s.lineas) {
      y += altoLinea
      ctx.fillStyle = '#222222'
      ctx.font = '700 14px Inter, system-ui, sans-serif'
      ctx.fillText(`${linea.quantity}×`, margen, y)
      ctx.font = '400 14px Inter, system-ui, sans-serif'
      const nombreCarta = String(linea.name)
      ctx.fillText(nombreCarta, margen + 34, y)
      // El ancho se mide con la MISMA fuente con la que se pintó el
      // nombre; si no, el código de set se le montaría encima.
      const anchoNombre = ctx.measureText(nombreCarta).width
      const set = `${linea.set || ''} ${linea.number || ''}`.trim()
      if (set) {
        ctx.fillStyle = '#a0a0a0'
        ctx.font = '400 11px Inter, system-ui, sans-serif'
        ctx.fillText(set, margen + 34 + anchoNombre + 8, y)
      }
    }
    y += 14
  }

  const enlace = document.createElement('a')
  enlace.href = canvas.toDataURL('image/png')
  enlace.download = `decklist-${String(nombre).toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'jugador'}.png`
  enlace.click()
}
