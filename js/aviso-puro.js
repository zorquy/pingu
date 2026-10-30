// Las reglas del aviso del equipo (1120), puras: las usan la franja de
// toda la web (js/aviso-global.js) y la vista previa de /admin → Avisos,
// así que lo que ve el equipo es lo que sale. Lo prueba Node.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

export const TIPOS_DE_AVISO = {
  novedad: { nombre: 'Novedad', icono: 'sparkles' },
  aviso: { nombre: 'Aviso', icono: 'triangleAlert' },
  mantenimiento: { nombre: 'Mantenimiento', icono: 'settings' },
}

export const PUBLICOS_DE_AVISO = { todos: 'Todo el mundo', cuenta: 'Solo con cuenta', movil: 'Solo en el móvil' }

// Los avisos de antes de la 1120 tenían `tono` ('info' | 'aviso').
export function tipoDeAviso(a) {
  if (TIPOS_DE_AVISO[a?.tipo]) return a.tipo
  return a?.tono === 'aviso' ? 'aviso' : 'novedad'
}

// Un enlace de la casa (/algo) o de fuera con https; lo demás no se pinta.
export function enlaceDeAviso(a) {
  const e = String(a?.enlace || '').trim()
  return /^(\/(?!\/)|https:\/\/)/.test(e) ? e : ''
}

// apagado · vacio · programado · caducado · activo
export function estadoDeAviso(a, ahora = new Date()) {
  if (!String(a?.texto || '').trim()) return 'vacio'
  if (!a.activo) return 'apagado'
  const t = +ahora
  if (a.desde && t < +new Date(a.desde)) return 'programado'
  if (a.hasta && t >= +new Date(a.hasta)) return 'caducado'
  return 'activo'
}

export function seVeAviso(a, { ahora = new Date(), conCuenta = false, movil = false } = {}) {
  if (estadoDeAviso(a, ahora) !== 'activo') return false
  if (a.publico === 'cuenta' && !conCuenta) return false
  if (a.publico === 'movil' && !movil) return false
  return true
}

// Un resumen barato del aviso, solo para saber si es EL MISMO que ya
// cerraste. No es criptografía: es una huella.
export function huellaDeAviso(a) {
  const s = `${String(a?.texto || '').trim()}|${enlaceDeAviso(a)}|${a?.desde || ''}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return String(h)
}

export function franjaHtml(a, { cerrar = true } = {}) {
  const tipo = tipoDeAviso(a)
  const enlace = enlaceDeAviso(a)
  const fuera = /^https:/.test(enlace)
  const textoEnlace = String(a?.texto_enlace || '').trim() || 'Ver más'
  return `<div class="aviso-global" data-tipo="${tipo}" role="status">
      <span class="aviso-global-icono" aria-hidden="true">${icons[TIPOS_DE_AVISO[tipo].icono](16)}</span>
      <span class="aviso-global-texto">${escapeHtml(String(a?.texto || '').trim())}</span>
      ${enlace ? `<a class="aviso-global-enlace" href="${escapeHtml(enlace)}"${fuera ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(textoEnlace)}</a>` : ''}
      ${cerrar ? '<button type="button" class="aviso-global-cerrar" aria-label="Cerrar el aviso">✕</button>' : ''}
    </div>`
}
