import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/+esm'
import { parseDeckIds } from './cards-block.js'

// Qué formato se puede guardar dentro de una guía, y cómo se normaliza.
//
// Este módulo es la frontera de seguridad del contenido: lo que salga de
// `sanitizeRichText()` se pinta tal cual en la página de la guía, así que
// aquí no puede colarse nada que no esté en estas listas.
//
// Se llama en DOS sitios: al guardar (desde el editor) y al pintar la
// guía ya publicada. Las dos, a propósito: un autor puede escribir su
// fila de `guides` directamente por la API saltándose el editor, así que
// sanear solo al guardar no bastaría.
//
// ── Por qué clases y no estilos ──
//
// Un editor con colores necesita guardar de algún modo "este trozo va en
// rojo". La forma fácil sería dejar pasar `style`, pero eso es dejar
// pasar CSS arbitrario dentro de la página: posicionamiento encima de
// otras cosas, fondos que llaman a una URL externa, texto invisible...
//
// Así que el color se guarda como una CLASE de una lista cerrada
// (`rt-c-rojo`), y el navegador puede escribir lo que quiera mientras
// edita: al guardar se traduce a la clase correspondiente y el `style`
// se tira. Lo único que sobrevive como estilo es la anchura de una
// imagen o de una lista de cartas, y no se filtra: se vuelve a
// construir a partir de un número, así que no hay cadena que colar.

// ── Paleta ──
//
// Los `hex` son los que se le pasan al navegador al aplicar el color, y
// son la llave para reconocerlo después. Si se cambia uno hay que
// cambiarlo también en components.css, o el texto se verá de un color
// mientras se escribe y de otro al guardar.
export const COLORES_TEXTO = [
  { clase: 'rt-c-rojo', nombre: 'Rojo', hex: '#c0392b' },
  { clase: 'rt-c-naranja', nombre: 'Naranja', hex: '#c8720a' },
  { clase: 'rt-c-verde', nombre: 'Verde', hex: '#0d9e6e' },
  { clase: 'rt-c-azul', nombre: 'Azul', hex: '#1e5175' },
  { clase: 'rt-c-morado', nombre: 'Morado', hex: '#4f46e5' },
  { clase: 'rt-c-rosa', nombre: 'Rosa', hex: '#be185d' },
  { clase: 'rt-c-gris', nombre: 'Gris', hex: '#52717f' },
]

export const COLORES_FONDO = [
  { clase: 'rt-h-amarillo', nombre: 'Amarillo', hex: '#fff3a3' },
  { clase: 'rt-h-verde', nombre: 'Verde', hex: '#c8f2e2' },
  { clase: 'rt-h-azul', nombre: 'Azul', hex: '#cfe8f7' },
  { clase: 'rt-h-rosa', nombre: 'Rosa', hex: '#fbd5e5' },
]

// Alineación del párrafo, y colocación de una imagen o una lista de
// cartas respecto al texto (izquierda y derecha hacen que el texto la
// rodee, como en Word).
export const CLASES_ALINEACION = ['rt-al-i', 'rt-al-c', 'rt-al-d']
export const CLASES_FIGURA = ['rt-fig', 'rt-fig-i', 'rt-fig-c', 'rt-fig-d']

export const CLASES_PERMITIDAS = new Set([
  ...COLORES_TEXTO.map((c) => c.clase),
  ...COLORES_FONDO.map((c) => c.clase),
  ...CLASES_ALINEACION,
  ...CLASES_FIGURA,
])

const PORHEX_TEXTO = Object.fromEntries(COLORES_TEXTO.map((c) => [c.hex, c.clase]))
const PORHEX_FONDO = Object.fromEntries(COLORES_FONDO.map((c) => [c.hex, c.clase]))

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
  'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'blockquote',
  'span', 'font', 'div', 'figure', 'figcaption', 'tcg-deck',
]
const ALLOWED_ATTR = ['href', 'src', 'alt', 'target', 'rel', 'data-cards', 'class', 'style', 'color', 'align', 'width', 'height']

// Los elementos a los que se les respeta una anchura. En el resto, el
// `style` se tira entero.
const ADMITEN_ANCHURA = new Set(['FIGURE', 'IMG', 'TCG-DECK'])

// ── Utilidades de color ──

// Los navegadores devuelven el color como `rgb(192, 57, 43)`, y a veces
// como `#c0392b` o `#c39`. Todo acaba en la misma forma para poder
// compararlo con la paleta.
export function aHex(valor) {
  const v = String(valor || '').trim().toLowerCase()
  const rgb = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (rgb) {
    return `#${[1, 2, 3].map((i) => Number(rgb[i]).toString(16).padStart(2, '0')).join('')}`
  }
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v.slice(1).split('').map((c) => c + c).join('')}`
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  return null
}

function declaraciones(style) {
  const fuera = {}
  String(style || '')
    .split(';')
    .forEach((trozo) => {
      const i = trozo.indexOf(':')
      if (i === -1) return
      fuera[trozo.slice(0, i).trim().toLowerCase()] = trozo.slice(i + 1).trim()
    })
  return fuera
}

// Una anchura en tanto por ciento, entera y dentro de un rango con
// sentido. Devuelve null si no hay nada aprovechable.
export function anchuraPorcentaje(valor) {
  const m = String(valor || '').trim().match(/^(\d+(?:\.\d+)?)%$/)
  if (!m) return null
  const n = Math.round(Number(m[1]))
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(10, n))
}

// ── Normalización ──

function quitarClasesNoPermitidas(el) {
  const buenas = [...el.classList].filter((c) => CLASES_PERMITIDAS.has(c))
  if (buenas.length) el.setAttribute('class', buenas.join(' '))
  else el.removeAttribute('class')
  return buenas
}

// Negrita, cursiva, subrayado y tachado escritos como ESTILO en vez de
// como etiqueta.
//
// Pasa por dos caminos, y los dos son normales:
//   - `document.execCommand` con styleWithCSS activado (que hace falta
//     para los colores y la alineación) genera
//     <span style="font-style: italic"> en vez de <em>.
//   - Pegar desde Word o Google Docs trae exactamente lo mismo.
//
// Sin esto, el estilo se veía mientras escribías y desaparecía al
// guardar, porque el `style` se tira. Se traduce a la etiqueta que sí se
// guarda.
function envolverEstilosDeTexto(el, d, doc) {
  const envoltorios = []
  if (/^(bold|bolder|[6-9]00)$/.test(String(d['font-weight'] || '').trim())) envoltorios.push('strong')
  if (/italic|oblique/.test(d['font-style'] || '')) envoltorios.push('em')
  const decoracion = `${d['text-decoration'] || ''} ${d['text-decoration-line'] || ''}`
  if (/underline/.test(decoracion)) envoltorios.push('u')
  if (/line-through/.test(decoracion)) envoltorios.push('s')
  if (envoltorios.length === 0) return

  const dentro = doc.createDocumentFragment()
  while (el.firstChild) dentro.appendChild(el.firstChild)
  let nodo = dentro
  for (const etiqueta of envoltorios) {
    const w = doc.createElement(etiqueta)
    w.appendChild(nodo)
    nodo = w
  }
  el.appendChild(nodo)
}

function traducirEstilo(el) {
  const d = declaraciones(el.getAttribute('style'))
  envolverEstilosDeTexto(el, d, el.ownerDocument)

  const claseTexto = PORHEX_TEXTO[aHex(d.color)]
  if (claseTexto) el.classList.add(claseTexto)

  const claseFondo = PORHEX_FONDO[aHex(d['background-color'] || d.background)]
  if (claseFondo) el.classList.add(claseFondo)

  const alineacion = { center: 'rt-al-c', right: 'rt-al-d', left: 'rt-al-i' }[String(d['text-align'] || '').toLowerCase()]
  if (alineacion) el.classList.add(alineacion)

  // La anchura es lo único que sigue siendo estilo. No se filtra la
  // cadena que venía: se descarta y se escribe una nueva a partir del
  // número, que es la única forma de estar seguro de lo que queda.
  const ancho = ADMITEN_ANCHURA.has(el.tagName) ? anchuraPorcentaje(d.width) : null
  if (ancho) el.setAttribute('style', `width:${ancho}%`)
  else el.removeAttribute('style')
}

// <font color="#c0392b">texto</font> → <span class="rt-c-rojo">texto</span>
//
// Sigue apareciendo porque `document.execCommand('foreColor')` lo genera
// en algunos navegadores cuando no se le pide que use CSS.
function traducirFont(el) {
  const clase = PORHEX_TEXTO[aHex(el.getAttribute('color'))]
  if (!clase) {
    // Un color que no es de la paleta no se guarda: se queda el texto.
    el.replaceWith(...el.childNodes)
    return
  }
  const span = el.ownerDocument.createElement('span')
  span.className = clase
  while (el.firstChild) span.appendChild(el.firstChild)
  el.replaceWith(span)
}

function esExterno(href) {
  return /^https?:\/\//i.test(String(href || ''))
}

export function sanitizeRichText(html) {
  const limpio = DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Con ALLOWED_ATTR explícito, DOMPurify seguiría dejando pasar
    // CUALQUIER data-*. Se apaga y se permite solo el nuestro.
    ALLOW_DATA_ATTR: false,
  })
  if (typeof DOMParser === 'undefined') return limpio

  const doc = new DOMParser().parseFromString(limpio, 'text/html')

  // <font> y <strike>/<del> se traducen antes de nada, para que el resto
  // del recorrido solo vea las etiquetas modernas.
  doc.querySelectorAll('font').forEach(traducirFont)
  doc.querySelectorAll('strike, del').forEach((el) => {
    const s = doc.createElement('s')
    while (el.firstChild) s.appendChild(el.firstChild)
    el.replaceWith(s)
  })

  doc.querySelectorAll('*').forEach((el) => {
    if (!el.isConnected) return
    traducirEstilo(el)
    const clases = quitarClasesNoPermitidas(el)

    // Atributos de maquetación antiguos que ya no significan nada. El
    // `width` de las imágenes se quita también a propósito: Firefox lo
    // deja al redimensionarlas con su propio tirador, y compite con la
    // anchura en tanto por ciento, que es la que entiende esta web.
    el.removeAttribute('align')
    el.removeAttribute('width')
    el.removeAttribute('height')

    // Un <span> sin nada que decir estorba: se deshace y se quedan sus
    // hijos. Los navegadores generan muchísimos al escribir.
    if (el.tagName === 'SPAN' && clases.length === 0) {
      el.replaceWith(...el.childNodes)
      return
    }

    // Un <div> NO se deshace: algunos navegadores lo usan como separador
    // de párrafo al pulsar Enter, y quitarlo pegaría todo el texto en un
    // solo bloque. Se convierte en <p>, que es lo que quería decir.
    if (el.tagName === 'DIV') {
      const p = doc.createElement('p')
      if (clases.length) p.className = clases.join(' ')
      while (el.firstChild) p.appendChild(el.firstChild)
      el.replaceWith(p)
      return
    }

    if (el.tagName === 'A' && esExterno(el.getAttribute('href'))) {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
  })

  // Un pie de foto vacío deja un hueco raro debajo de la imagen.
  doc.querySelectorAll('figcaption').forEach((fc) => {
    if (!fc.textContent.trim()) fc.remove()
  })

  // Un <tcg-deck> guarda SOLO los identificadores de las cartas. Lo que
  // tenga dentro se tira siempre: en el editor se rellena con las cartas
  // para que el autor las vea, y sin esto esa vista previa acabaría
  // guardada dentro de la guía — congelando nombres e imágenes que deben
  // salir siempre de la base.
  doc.querySelectorAll('tcg-deck').forEach((el) => {
    const ids = parseDeckIds(el.getAttribute('data-cards'))
    el.textContent = ''
    if (ids.length === 0) el.remove()
    else el.setAttribute('data-cards', ids.join(','))
  })

  return doc.body.innerHTML
}
