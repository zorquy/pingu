// La chapa del TIPO de un torneo (1462, propuesta «Torneos más visuales»,
// PINGU: «cada pastilla como online, en persona… debería tener un color
// distintivo»). Un color por tipo, el mismo en toda la web, y siempre con su
// icono y su texto: el color dice «qué es», nunca solo él (quien no distingue
// el verde del azul lee igual «En persona» y «Online»). Lo que se pulsa sigue
// siendo --acento; esto no es un botón.
//
// Los colores son fichas de style.css (`--tipo-*`, en los dos temas) y la
// pieza vive en components.css (`.chapa-tipo`, `[data-tipo-torneo]`): así la
// ficha del torneo, Inicio o el perfil la pintan igual que /torneos.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

export const TIPOS_DE_TORNEO = {
  online: { texto: 'Online', icono: 'globe' },
  persona: { texto: 'En persona', icono: 'mapPin' },
  liga: { texto: 'Liga', icono: 'trophy' },
  oficial: { texto: 'Oficial', icono: 'star' },
  repite: { texto: 'Se repite', icono: 'refreshCw' },
  vivo: { texto: 'En juego', icono: null },
}

// `texto` cambia lo que dice (la ciudad en vez de «En persona», «Cada
// viernes»…); `llena`, el fondo entero del color (sobre una imagen).
export function chapaTipoHtml(tipo, { texto = null, llena = false, titulo = '' } = {}) {
  const t = TIPOS_DE_TORNEO[tipo]
  if (!t) return ''
  const ico = tipo === 'vivo' ? '<span class="chapa-tipo-punto" aria-hidden="true"></span>' : icons[t.icono]?.(12) || ''
  // La de «en juego» llena conserva `torneo-estado-jugando` (la 311 mide que
  // su texto se lea sobre el rojo, en los dos temas).
  const estado = tipo === 'vivo' && llena ? ' torneo-estado-jugando' : ''
  return `<span class="chapa-tipo${llena ? ' llena' : ''}${estado}" data-tipo-torneo="${tipo}"${titulo ? ` title="${escapeHtml(titulo)}"` : ''}>${ico}${escapeHtml(texto ?? t.texto)}</span>`
}

// El tipo que manda en el color de un torneo (el de su fondo y su fecha):
// una liga es liga aunque se juegue online; si no, dónde se juega.
export function tipoPrincipal(t) {
  if (t?.format === 'league') return 'liga'
  return t?.modalidad === 'presencial' ? 'persona' : 'online'
}
