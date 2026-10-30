// LAS CITAS DEL FORO, TODAS COMO LA PRIMERA (tanda 1116).
//
// La primera cita de una respuesta se pinta al leer, desde `reply_to_id`:
// «Devy escribió: ↩» con el enlace a su mensaje, y su contenido con fotos.
// Las demás (la multicita de la 964) se guardaban como «Nombre: texto» en un
// <blockquote> a secas, cortadas a 400 letras y sin fotos ni enlace. PINGU:
// «las otras citas se cortan… mira cómo se muestran».
//
// Ahora una cita extra se GUARDA con lo que el saneador deja pasar —un
// <p> con un enlace `#mensaje-<id>` delante y el contenido del mensaje— y
// al pintar se le pone la ropa de la primera (`.foro-cita`). El enlace ya
// salta al mensaje aunque esté en otra página (el `hashchange` de tema.js).
// Las viejas, «Nombre: texto», se reconocen si su mensaje está en la página.

const TOPE_LETRAS = 400

// Corta un trozo de HTML por las LETRAS, no por los caracteres del HTML:
// cortar el texto crudo partía una etiqueta por la mitad y con una foto
// delante se comía todo el texto.
export function recortarNodo(raiz, tope = TOPE_LETRAS) {
  let quedan = tope
  let cortado = false
  const recorrer = (nodo) => {
    for (const hijo of [...nodo.childNodes]) {
      if (cortado) {
        hijo.remove()
        continue
      }
      if (hijo.nodeType === 3) {
        const t = hijo.textContent
        if (t.length > quedan) {
          hijo.textContent = t.slice(0, quedan).trimEnd() + '…'
          cortado = true
        } else quedan -= t.length
      } else if (hijo.nodeType === 1) recorrer(hijo)
    }
  }
  recorrer(raiz)
  return raiz
}

// El contenido de un mensaje pintado, listo para meterlo en una cita: sin
// las citas que él llevara dentro (una cadena de citas dentro de citas no
// la lee nadie) y recortado.
function contenidoDe(cuerpo) {
  const copia = cuerpo.cloneNode(true)
  copia.querySelectorAll('blockquote').forEach((q) => q.remove())
  return recortarNodo(copia)
}

// La cita de un mensaje para la caja de responder: lo que se guarda.
export function citaDeMensaje({ id, nombre, cuerpo }) {
  const cita = document.createElement('blockquote')
  const cab = document.createElement('p')
  const a = document.createElement('a')
  a.href = `#mensaje-${id}`
  a.textContent = `${nombre} escribió:`
  cab.append(a)
  cita.append(cab)
  if (cuerpo) cita.append(...contenidoDe(cuerpo).childNodes)
  return cita
}

function vestir(cita, enlace) {
  // El renglón que llevaba el enlace se va: el enlace es ya la cabecera.
  const cab = enlace.parentElement
  if (cab !== cita && cab?.parentElement === cita) cab.remove()
  cita.classList.add('foro-cita')
  enlace.className = 'foro-cita-quien'
  enlace.title = 'Ver el mensaje completo en su sitio'
  if (!enlace.querySelector('.foro-cita-salto')) {
    const salto = document.createElement('span')
    salto.className = 'foro-cita-salto'
    salto.setAttribute('aria-hidden', 'true')
    salto.textContent = ' ↩'
    enlace.append(salto)
  }
  const cuerpo = document.createElement('div')
  cuerpo.className = 'article-body'
  const resto = [...cita.childNodes].filter((n) => n !== enlace)
  cuerpo.append(...resto)
  cita.replaceChildren(enlace, cuerpo)
}

// Al pintar los mensajes: las citas guardadas, con la ropa de la primera.
export function enriquecerCitas(raiz) {
  const cuerpos = [...raiz.querySelectorAll('[data-mensaje]')].map((art) => ({
    id: art.dataset.mensaje,
    nombre: art.querySelector('.foro-autor-nombre')?.textContent.trim() || '',
    cuerpo: art.querySelector('.foro-mensaje-texto'),
  }))
  for (const cita of raiz.querySelectorAll('.foro-mensaje-texto blockquote:not(.foro-cita)')) {
    // La de ahora: un renglón con el enlace a su mensaje, y nada más.
    const cab = cita.firstElementChild
    const enlace = cab?.tagName === 'P' && cab.children.length === 1 ? cab.querySelector('a[href^="#mensaje-"]') : null
    if (enlace && cab.textContent.trim() === enlace.textContent.trim()) {
      vestir(cita, enlace)
      continue
    }
    // La de antes de la 1116: «Nombre: texto». Se reconoce si el mensaje
    // citado está en esta página (mismo autor y empieza igual); si no, se
    // queda como estaba, que también se lee.
    const m = /^([^:\n]{1,40}): ([\s\S]+)$/.exec(cita.textContent.trim())
    if (!m) continue
    const [, nombre, texto] = m
    const principio = texto.replace(/\s+/g, ' ').slice(0, 60)
    const suyo = cuerpos.find(
      (c) => c.nombre === nombre && c.cuerpo && !c.cuerpo.contains(cita) && c.cuerpo.innerText.replace(/\s+/g, ' ').trim().startsWith(principio)
    )
    if (!suyo) continue
    const nueva = citaDeMensaje(suyo)
    cita.replaceWith(nueva)
    vestir(nueva, nueva.querySelector('a'))
  }
}
