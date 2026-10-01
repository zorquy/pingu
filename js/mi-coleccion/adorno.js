// El adorno de una carpeta o de un álbum (tanda 411).
//
// PINGU, con las capturas de Dex: «me gustaría que las carpetas fuesen
// como las expansiones, mismo tamaño, esas burbujas, esos cuadrados. Y
// que al crearla te salga un pop-up para elegir un emoji, o un sprite de
// la Pokédex, o un color de fondo. El emoji iría como en las expansiones
// va el logo, y el fondo, en vez de sacarlo del logo, lo eliges tú; si
// no, se saca del emoji o del icono».
//
// ── POR QUÉ TRES COLUMNAS Y NO UNA ──
//
// Un adorno es UNA de tres cosas: un icono del sitio, un Pokémon o un
// emoji. Cabría en una sola columna con un prefijo («dex:25», «emoji:🔥»)
// y habría que partir la cadena en todas partes. Tres columnas dicen qué
// es sin interpretar nada, y el precedente de la casa es claro: una
// columna que hace dos trabajos se separa en silencio (tanda 335).
//
// Precedencia: Pokémon > emoji > icono. Es el orden en que se eligió:
// quien pone un Pokémon encima de un emoji quiere el Pokémon.
import { icons } from '../icons.js'
import { urlDeSprite, atributosDeRespaldo } from '../torneos/sprites-pokemon.js'

const escapeHtml = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Los iconos que se ofrecen. Salen de `js/icons.js`, que es de donde sale
// todo lo demás del sitio: una carpeta con un dibujo de trazo y otra con
// un emoji de colores se ven como dos sitios distintos.
export const ICONOS = [
  'folder', 'star', 'bookmark', 'cards', 'layers', 'package', 'gem', 'crown',
  'sparkles', 'flame', 'zap', 'droplet', 'leaf', 'snowflake', 'target', 'trophy',
  'heart', 'coins', 'lock', 'pin', 'eye', 'gamepad', 'palette', 'hash',
].filter((n) => icons[n])

// Y los emojis, porque PINGU los pidió por nombre. La norma de la casa es
// «iconos SVG, nunca emojis sueltos en la interfaz», y se respeta: esto no
// es la interfaz, es lo que ESCRIBE la persona en su carpeta, como el
// nombre. Los de arriba siguen siendo la opción que se ofrece primero.
export const EMOJIS = [
  '🔥', '💧', '🌿', '⚡', '🌙', '⭐', '💎', '🏆',
  '📕', '📘', '📗', '📙', '🎴', '🧢', '🎒', '🗺️',
  '🥇', '🥈', '🥉', '❤️', '💜', '💙', '💚', '🧡',
]

// Veinte colores de fondo. Son los mismos tonos apagados que usa la
// cabecera de una expansión al desenfocar un logo: un fondo saturado
// detrás de un icono blanco no deja leer ninguno de los dos.
export const COLORES = [
  '#2a6b96', '#1e5175', '#3f7d6b', '#4a7c3f', '#7a7a2e', '#9a6b2e',
  '#a1560a', '#9a3f3f', '#8c3f6b', '#7040b8', '#4a4fa8', '#2f6f7a',
]

// El color cuando no se elige ninguno: sale del adorno y SIEMPRE el mismo
// para el mismo adorno. No se saca de los píxeles del emoji —habría que
// pintarlo en un lienzo para leerlo, y el sprite viene de otra CDN, así
// que ni eso—; se saca de su código, que es estable y no pide red.
export function colorDe(a) {
  if (a?.color) return a.color
  const semilla = String(a?.dex_id ?? a?.emoji ?? a?.icono ?? '')
  if (!semilla) return COLORES[0]
  let n = 0
  for (const ch of semilla) n = (n * 31 + ch.codePointAt(0)) >>> 0
  return COLORES[n % COLORES.length]
}

// El dibujo de dentro de la burbuja.
export function iconoHtml(a, tamano = 44) {
  if (a?.dex_id) {
    const url = urlDeSprite(a.dex_id)
    if (url) return `<img src="${escapeHtml(url)}" alt="" width="${tamano}" height="${tamano}" loading="lazy" ${atributosDeRespaldo(url)} />`
  }
  if (a?.emoji) return `<span class="mc-burbuja-emoji">${escapeHtml(a.emoji)}</span>`
  const dibuja = icons[a?.icono] || icons.folder
  return dibuja(tamano)
}

// LA BURBUJA. Misma forma que la tarjeta de una expansión —cabecera de
// alto fijo con el fondo de color y el dibujo centrado, y debajo el
// nombre y su pie—, porque PINGU quiere que se lean como la misma cosa.
export function burbujaHtml({ id, nombre, pie, adorno, barra = null, dibujo = null, atributo = 'data-carpeta', clase = 'mc-burbuja' }) {
  const color = colorDe(adorno)
  return `<article class="${clase}" ${atributo}="${escapeHtml(id)}" style="--burbuja-color:${escapeHtml(color)}">
    <button type="button" class="mc-burbuja-abrir" data-abrir="${escapeHtml(id)}">
      <span class="mc-burbuja-cabecera" aria-hidden="true">${dibujo || iconoHtml(adorno)}</span>
      <span class="mc-burbuja-info">
        <span class="mc-burbuja-nombre">${escapeHtml(nombre)}</span>
        <span class="mc-burbuja-pie">${escapeHtml(pie)}</span>
        ${barra != null ? `<span class="mc-barra" aria-hidden="true"><i style="--ancho:${Math.max(0, Math.min(100, Math.round(barra)))}%"></i></span>` : ''}
      </span>
    </button>
    <button type="button" class="mc-burbuja-mas" data-ajustes="${escapeHtml(id)}" aria-label="Opciones de ${escapeHtml(nombre)}">···</button>
  </article>`
}
