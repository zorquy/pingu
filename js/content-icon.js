import { icons, ICON_NAMES } from './icons.js'
import { escapeHtml } from './html.js'

// El icono de una guía, una categoría, un logro o un bloque de curso.
//
// EL PROBLEMA
// Los "emojis" de PokeDoc no estaban en el código: son DATOS. Cada guía
// guarda su `cover_emoji`, cada categoría su `emoji`, cada logro el suyo.
// O sea que cambiar emojis por iconos no es buscar y reemplazar en los
// ficheros: hay contenido escrito por gente con emojis dentro.
//
// LA REGLA
// Se mira el valor guardado y se decide, en este orden:
//
//   1. ¿Es el nombre de un icono nuestro? → se pinta el icono.
//   2. ¿Es un emoji que sabemos traducir? → se pinta su icono.
//   3. ¿No es ninguna de las dos? → se pinta TAL CUAL.
//
// El punto 3 es lo importante. Si alguien puso un emoji que no está en la
// tabla, o pegó un carácter raro, sigue viéndose lo que puso. Nunca se
// queda un hueco vacío por no reconocer algo — perder contenido de otra
// persona por un cambio de estilo sería mucho peor que un emoji suelto.
//
// Así no hace falta migrar la base ni tocar lo que ya escribió nadie: lo
// nuevo se guarda con nombre de icono y lo viejo se traduce al vuelo.

// Emoji → nombre de icono. Salen de los que se usan de verdad: portadas
// de las 13 guías publicadas, categorías, y los 36 del selector antiguo.
const POR_EMOJI = {
  // Documentos y lectura
  '📘': 'bookOpen', '📗': 'bookOpen', '📙': 'bookOpen', '📕': 'bookOpen', '📖': 'bookOpen',
  '🗂️': 'folder', '🗂': 'folder', '🧾': 'receipt', '📐': 'ruler', '🔢': 'hash',
  // Buscar y examinar
  '🔍': 'search', '🔎': 'search', '🕵️': 'scan', '🕵': 'scan', '🔬': 'scan', '👁️': 'eye',
  // Valor y rareza
  '⭐': 'star', '🌟': 'star', '✨': 'sparkles', '💎': 'gem', '👑': 'crown',
  '🏆': 'trophy', '🏅': 'trophy', '🎯': 'target',
  // Dinero y mercado
  '💰': 'coins', '💶': 'coins', '💵': 'coins', '💸': 'coins', '📈': 'trendingUp',
  // Cartas y juego
  '🃏': 'cards', '🎴': 'cards', '🎮': 'gamepad', '🕹️': 'gamepad',
  // Protección y estado
  '🛡️': 'shield', '🛡': 'shield', '📦': 'package', '🔖': 'bookmark', '🔒': 'lock',
  '🧊': 'snowflake', '❄️': 'snowflake',
  // Tipos y naturaleza
  '⚡': 'zap', '🔥': 'flame', '💧': 'droplet', '🌿': 'leaf', '🌱': 'sprout',
  '🐉': 'flame', '🎨': 'palette',
  // El bocadillo del curso del núcleo negro: una carta auténtica son
  // varias capas pegadas, y ese bloque explica justo eso.
  '🥪': 'layers',
  // Avisos
  '✅': 'checkCircle', '⚠️': 'triangleAlert', '⚠': 'triangleAlert', '❌': 'xCircle',
  '💡': 'lightbulb', '📌': 'pin', '🔁': 'refreshCw', '👋': 'sparkles',
  '🎉': 'sparkles', '🥳': 'sparkles', '📜': 'bookOpen', '📝': 'edit', '🧠': 'lightbulb',
}

export function isIconName(valor) {
  return typeof valor === 'string' && ICON_NAMES.includes(valor)
}

// Devuelve el nombre del icono que corresponde, o null si no hay ninguno.
export function iconNameFor(valor) {
  const v = String(valor ?? '').trim()
  if (!v) return null
  if (isIconName(v)) return v
  // Algunos emojis llegan con el selector de variación (U+FE0F) y otros
  // sin él, según de dónde se hayan copiado. Se prueban las dos formas
  // para no fallar por un carácter invisible.
  return POR_EMOJI[v] || POR_EMOJI[v.replace(/️/g, '')] || null
}

// El HTML final. `fallback` es el icono que se usa cuando no hay valor
// ninguno (una guía sin portada, por ejemplo).
export function contentIconHtml(valor, size = 24, fallback = 'bookOpen') {
  const nombre = iconNameFor(valor)
  if (nombre) return icons[nombre](size)

  const v = String(valor ?? '').trim()
  // Ni icono ni emoji conocido: si hay algo escrito, se respeta.
  if (v) return `<span style="font-size:${size}px; line-height:1;">${escapeHtml(v)}</span>`
  return icons[fallback] ? icons[fallback](size) : icons.bookOpen(size)
}

// Para cuando el icono va PEGADO A UN TEXTO en la misma línea (el título
// de una guía en una lista, la cabecera de una colección...).
//
// Un emoji se apoya en la línea base como cualquier letra; un SVG en
// línea también, pero como su caja llega hasta abajo del todo, el dibujo
// queda flotando por encima del texto. La envoltura lo baja un pelo y le
// pone el hueco de separación, para que no haga falta acordarse de eso en
// cada sitio donde se pinte.
export function inlineIconHtml(valor, size = 16, fallback = 'bookOpen') {
  return `<span class="inline-content-icon">${contentIconHtml(valor, size, fallback)}</span>`
}
