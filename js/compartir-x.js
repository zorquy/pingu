// LO QUE SE PUBLICA EN X (880), sin DOM: lo prueba Node.
//
// PINGU: «me gustaría poder compartir las noticias en twitter de manera
// correcta, es decir, que ponga un poco y la portada». La portada la pone
// X solo con el enlace (la tarjeta `summary_large_image` que escribe
// `meta-social.js`); lo que hay que mandar bien es EL TEXTO: el título, un
// trozo de la entradilla y el enlace, y que quepa. X cuenta 280 letras y
// cualquier enlace le cuesta 23, se escriba como se escriba.
export const LARGO_X = 280
export const LARGO_ENLACE = 23

// Corta por una palabra entera y pone puntos suspensivos. Un corte a
// media palabra («…revelad») parece un fallo; a mitad de frase, no.
export function recortarPalabras(texto, maximo) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= maximo) return limpio
  if (maximo <= 1) return '…'
  const trozo = limpio.slice(0, maximo - 1)
  const espacio = trozo.lastIndexOf(' ')
  return `${(espacio > maximo * 0.5 ? trozo.slice(0, espacio) : trozo).replace(/[\s,;:.]+$/, '')}…`
}

// El texto de una noticia para X, SIN el enlace: título, línea en blanco y
// la entradilla recortada para que, con el enlace detrás, quepa en 280. Si
// el título solo ya no deja sitio, va el título a secas (recortado).
export function textoParaX({ titulo, descripcion = '' }) {
  const t = String(titulo ?? '').replace(/\s+/g, ' ').trim()
  const sitio = LARGO_X - LARGO_ENLACE - 1 // el espacio o salto antes del enlace
  if (t.length >= sitio - 12) return recortarPalabras(t, sitio)
  const d = String(descripcion ?? '').replace(/\s+/g, ' ').trim()
  if (!d) return t
  const queda = sitio - t.length - 2
  return queda < 24 ? t : `${t}\n\n${recortarPalabras(d, queda)}`
}

// La dirección que abre el cuadro de publicar en X con el texto puesto.
// `url` va aparte: así X la cuenta como enlace y le pinta la tarjeta.
export function direccionDeX({ texto, url }) {
  // `encodeURIComponent` y no URLSearchParams: el «+» de este último lo
  // leen como espacio casi todos, pero no hace falta jugársela.
  return `https://x.com/intent/post?text=${encodeURIComponent(texto)}${url ? `&url=${encodeURIComponent(url)}` : ''}`
}

// Lo que se pega en WhatsApp o donde sea: el mismo texto y el enlace al
// final, en su línea.
export function textoConEnlace({ titulo, descripcion, url }) {
  return `${textoParaX({ titulo, descripcion })}\n\n${url}`
}
