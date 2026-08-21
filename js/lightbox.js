// El visor de imágenes: clic en una foto de un mensaje o de una guía y
// se abre a pantalla completa, con flechas para pasar entre las fotos de
// ese mismo mensaje y Escape para cerrar. Para un foro de "¿es falsa
// esta carta?" lleno de fotos, mirar los detalles en grande es la mitad
// del trabajo.
//
// Escucha delegada y global (se engancha una vez desde app.js): funciona
// con contenido repintado y con el que llegue después.

let abierto = null // { grupo: [img...], indice }

function elegible(img) {
  // Solo el contenido publicado. Nunca dentro de un editor (ahí el clic
  // es para seleccionar la imagen), ni imágenes que ya son un enlace, ni
  // las piezas con vida propia (mazos de cartas, portadas de vídeo).
  if (!img.closest('.article-body')) return false
  if (img.closest('[contenteditable="true"]')) return false
  if (img.closest('a')) return false
  if (img.closest('tcg-deck, yt-video, .foro-firma')) return false
  return true
}

// El grupo por el que se pasa con las flechas: las fotos DEL MISMO
// mensaje (o de la misma guía), no todas las de la página — mezclar las
// fotos de tres personas en un mismo carrete despista.
function grupoDe(img) {
  const raiz = img.closest('.foro-mensaje-texto') || img.closest('.article-body')
  return [...raiz.querySelectorAll('img')].filter(elegible)
}

function plantilla() {
  const capa = document.createElement('div')
  capa.className = 'lightbox'
  capa.setAttribute('role', 'dialog')
  capa.setAttribute('aria-label', 'Imagen ampliada')
  capa.innerHTML = `
    <button type="button" class="lightbox-cerrar" aria-label="Cerrar">✕</button>
    <button type="button" class="lightbox-flecha lightbox-ant" aria-label="Imagen anterior">‹</button>
    <figure>
      <img alt="">
      <figcaption class="lightbox-pie"></figcaption>
    </figure>
    <button type="button" class="lightbox-flecha lightbox-sig" aria-label="Imagen siguiente">›</button>
    <span class="lightbox-contador"></span>`
  return capa
}

function pintar() {
  if (!abierto) return
  const capa = document.querySelector('.lightbox')
  const img = abierto.grupo[abierto.indice]
  capa.querySelector('img').src = img.currentSrc || img.src
  capa.querySelector('img').alt = img.alt || ''
  // El pie: el figcaption que le puso quien la subió, o el alt.
  const pie = img.closest('figure')?.querySelector('figcaption')?.textContent || img.alt || ''
  capa.querySelector('.lightbox-pie').textContent = pie
  capa.querySelector('.lightbox-pie').style.display = pie ? '' : 'none'
  const varios = abierto.grupo.length > 1
  capa.querySelector('.lightbox-contador').textContent = varios ? `${abierto.indice + 1} / ${abierto.grupo.length}` : ''
  capa.querySelector('.lightbox-ant').style.display = varios ? '' : 'none'
  capa.querySelector('.lightbox-sig').style.display = varios ? '' : 'none'
}

function mover(paso) {
  if (!abierto || abierto.grupo.length < 2) return
  abierto.indice = (abierto.indice + paso + abierto.grupo.length) % abierto.grupo.length
  pintar()
}

function cerrar() {
  document.querySelector('.lightbox')?.remove()
  document.body.style.overflow = ''
  abierto = null
}

function abrir(img) {
  const grupo = grupoDe(img)
  if (!grupo.length) return
  abierto = { grupo, indice: Math.max(0, grupo.indexOf(img)) }
  const capa = plantilla()
  document.body.appendChild(capa)
  // La página de detrás no debe hacer scroll mientras se mira la foto.
  document.body.style.overflow = 'hidden'
  pintar()
  capa.querySelector('.lightbox-cerrar').focus()

  capa.addEventListener('click', (e) => {
    if (e.target.closest('.lightbox-ant')) return mover(-1)
    if (e.target.closest('.lightbox-sig')) return mover(1)
    // Clic en el fondo (o en la ✕): se cierra. Clic sobre la propia
    // imagen no cierra — es donde se apunta para mirar de cerca.
    if (!e.target.closest('figure') || e.target.closest('.lightbox-cerrar')) cerrar()
  })
}

export function engancharLightbox() {
  document.addEventListener('click', (e) => {
    const img = e.target instanceof Element ? e.target.closest('img') : null
    if (!img || !elegible(img)) return
    e.preventDefault()
    abrir(img)
  })
  document.addEventListener('keydown', (e) => {
    if (!abierto) return
    if (e.key === 'Escape') cerrar()
    else if (e.key === 'ArrowLeft') mover(-1)
    else if (e.key === 'ArrowRight') mover(1)
  })
}
