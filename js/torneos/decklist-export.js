// Exportar una decklist (tanda 219): copiar el texto tal cual al
// portapapeles (para pegarlo directo en TCG Live) y bajarla como imagen
// PNG. La imagen se dibuja a mano en un canvas — sin librerías, que el
// cliente de PokeDoc no carga dependencias nuevas — con las tres
// secciones y los colores de la casa.
import { showToast } from '../toast.js'

export async function copiarDecklist(rawText) {
  try {
    await navigator.clipboard.writeText(rawText || '')
    showToast('Lista copiada: pégala donde quieras.', 'success')
  } catch {
    showToast('No se ha podido copiar (el navegador lo ha impedido).', 'error')
  }
}

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

// Los dos botones juntos, listos para insertar en cualquier caja. Quien
// los pinta llama después a engancharExportar con los datos.
export function botonesExportarHtml() {
  return `
    <span class="torneo-exportar">
      <button type="button" class="btn-secondary" data-exportar-copiar>Copiar lista</button>
      <button type="button" class="btn-secondary" data-exportar-imagen>Descargar imagen</button>
    </span>`
}

export function engancharExportar(raiz, { nombre, rawText, parsed }) {
  raiz.querySelector('[data-exportar-copiar]')?.addEventListener('click', () => copiarDecklist(rawText))
  raiz.querySelector('[data-exportar-imagen]')?.addEventListener('click', () => descargarImagenDecklist(nombre, parsed))
}
