import { icons } from './icons.js'
import { contentIconHtml, iconNameFor } from './content-icon.js'

// Selector del icono de portada de una guía.
//
// Antes ofrecía una rejilla de 36 emojis y guardaba el carácter. Ahora
// ofrece iconos y guarda el NOMBRE del icono ('search', 'shield'...), que
// es lo que hace que el sitio entero se vea de una pieza en vez de mezclar
// dibujos de trazo con emojis de colores de cada sistema operativo.
//
// El fichero conserva su nombre y su función exportada a propósito: lo
// importan dos editores, y renombrarlo por estética habría sido tocar
// cuatro sitios para no ganar nada.
//
// Sigue siendo un campo de texto por debajo, así que:
//   - una guía guardada con un emoji lo sigue enseñando, y al abrirla en
//     el editor el botón muestra el icono equivalente;
//   - quien quiera poner algo que no está en la lista, puede escribirlo.

// Los iconos que se ofrecen, agrupados por para qué sirven. El orden
// importa: es el orden en que se ven, y lo primero debería ser lo más
// probable para una guía de PokeDoc.
const OPCIONES = [
  // Buscar, examinar, detectar
  'search', 'scan', 'eye', 'shield', 'triangleAlert', 'checkCircle',
  // Cartas y colección
  'cards', 'layers', 'package', 'bookmark', 'gem', 'star',
  // Rareza y logro
  'sparkles', 'crown', 'trophy', 'target', 'flame', 'zap',
  // Dinero y mercado
  'coins', 'trendingUp', 'receipt', 'lock',
  // Aprender
  'bookOpen', 'graduationCap', 'lightbulb', 'listOrdered', 'hash', 'ruler',
  // Juego y tipos
  'gamepad', 'droplet', 'leaf', 'sprout', 'snowflake', 'palette',
  // Otros
  'clock', 'folder', 'pin', 'refreshCw',
]

const POR_DEFECTO = 'bookOpen'

// Cómo se llama cada uno para quien escribe (1014, L4): nadie sabe que el
// libro se llama «bookOpen» en el código, y no tiene por qué.
const NOMBRES = {
  search: 'Lupa', scan: 'Escáner', eye: 'Ojo', shield: 'Escudo', triangleAlert: 'Aviso', checkCircle: 'Visto',
  cards: 'Cartas', layers: 'Capas', package: 'Paquete', bookmark: 'Marcador', gem: 'Gema', star: 'Estrella',
  sparkles: 'Destellos', crown: 'Corona', trophy: 'Trofeo', target: 'Diana', flame: 'Llama', zap: 'Rayo',
  coins: 'Monedas', trendingUp: 'Subida', receipt: 'Recibo', lock: 'Candado',
  bookOpen: 'Libro', graduationCap: 'Birrete', lightbulb: 'Bombilla', listOrdered: 'Lista', hash: 'Número', ruler: 'Regla',
  gamepad: 'Mando', droplet: 'Gota', leaf: 'Hoja', sprout: 'Brote', snowflake: 'Copo', palette: 'Paleta',
  clock: 'Reloj', folder: 'Carpeta', pin: 'Chincheta', refreshCw: 'Ciclo',
}
export const nombreDeIcono = (n) => NOMBRES[n] || n

// `abierto` (1014, L4): la rejilla a la vista desde el principio, sin botón
// que la despliegue, con el elegido dicho con su nombre; el campo de texto
// se queda escondido (es lo que guarda el editor).
export function attachEmojiPicker(input, { abierto = false } = {}) {
  if (!input || input.dataset.emojiPickerAttached) return
  input.dataset.emojiPickerAttached = '1'

  const wrap = document.createElement('div')
  wrap.className = abierto ? 'emoji-picker-wrap emoji-picker-abierto' : 'emoji-picker-wrap'
  input.parentNode.insertBefore(wrap, input)
  wrap.appendChild(input)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'emoji-picker-btn'
  btn.setAttribute('aria-label', 'Elegir un icono de la lista')
  btn.setAttribute('title', 'Elegir un icono de la lista')
  wrap.appendChild(btn)

  // Enseña lo que hay guardado. Si es un emoji antiguo, se ve ya su icono
  // equivalente: así al abrir una guía vieja se entiende sin explicar nada
  // que ese emoji ahora es ese dibujo.
  const pintarBoton = () => {
    btn.innerHTML = contentIconHtml(input.value.trim(), 20, POR_DEFECTO)
  }
  pintarBoton()

  const panel = document.createElement('div')
  panel.className = abierto ? 'emoji-picker-panel emoji-picker-fijo' : 'emoji-picker-panel hidden'
  panel.setAttribute('role', 'listbox')
  panel.innerHTML = OPCIONES.map(
    (n) => `<button type="button" class="emoji-picker-option" data-icon="${n}" title="${nombreDeIcono(n)}" aria-label="${nombreDeIcono(n)}">${icons[n](20)}</button>`
  ).join('')
  wrap.appendChild(panel)

  const close = () => { if (!abierto) panel.classList.add('hidden') }

  // Lo elegido, con su nombre (solo abierto): «Libro · elegido».
  const etiqueta = abierto ? document.createElement('p') : null
  if (etiqueta) {
    etiqueta.className = 'emoji-picker-etiqueta subtext'
    wrap.appendChild(etiqueta)
  }
  const pintarEtiqueta = () => {
    if (!etiqueta) return
    const actual = iconNameFor(input.value.trim())
    etiqueta.textContent = `${actual ? `${nombreDeIcono(actual)} · elegido` : 'Elige un icono'}. Si subes una imagen de portada, el icono no se usa.`
  }

  const marcarElegido = () => {
    const actual = iconNameFor(input.value.trim())
    panel.querySelectorAll('.emoji-picker-option').forEach((o) => {
      o.classList.toggle('selected', o.dataset.icon === actual)
    })
    pintarEtiqueta()
  }
  if (abierto) {
    btn.classList.add('hidden')
    input.classList.add('emoji-picker-campo-oculto')
    input.setAttribute('aria-hidden', 'true')
    input.tabIndex = -1
    marcarElegido()
  }

  btn.addEventListener('click', () => {
    // Por si el valor lo puso otro código (cargar una guía, un borrador)
    // sin disparar un evento "input".
    pintarBoton()
    marcarElegido()
    panel.classList.toggle('hidden')
  })

  panel.querySelectorAll('.emoji-picker-option').forEach((opt) =>
    opt.addEventListener('click', () => {
      input.value = opt.dataset.icon
      pintarBoton()
      marcarElegido()
      input.dispatchEvent(new Event('input', { bubbles: true }))
      close()
    })
  )

  input.addEventListener('input', () => { pintarBoton(); if (abierto) marcarElegido() })

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
}
