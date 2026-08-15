// Vídeos de YouTube dentro de una guía o de un mensaje del foro.
//
// Lo pidió Iker viendo una guía en la que su autor había dejado el enlace
// a su vídeo: se puede pulsar, pero te saca de la guía justo cuando la
// estabas leyendo.
//
// ── Lo que NO se hace, y por qué ──
//
// El autor NO escribe un <iframe>, ni nada que se le parezca. Dejar pasar
// un iframe del usuario en el saneador es abrir la puerta de par en par:
// un iframe puede apuntar a donde quiera, cargar lo que quiera y tapar la
// página entera con algo transparente encima de un botón de verdad.
//
// Lo que se guarda es `<yt-video data-yt="ID">`, con el identificador de
// once caracteres y nada más. El iframe lo construye ESTE fichero, con
// una dirección que escribimos nosotros. Lo único que viene del autor es
// un identificador que el saneador ya ha comprobado carácter a carácter.
//
// Es el mismo patrón que <tcg-deck>: se guarda el dato, no el resultado.

// Once caracteres de letras, números, guion y guion bajo. Es lo que
// usa YouTube, y es todo lo que se acepta.
const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/

export const esIdYoutube = (id) => ID_VALIDO.test(String(id || ''))

// Saca el identificador de las formas en que la gente pega un enlace:
// youtu.be/ID, /watch?v=ID, /shorts/ID, /embed/ID, /live/ID. Devuelve
// null si no es un enlace de YouTube reconocible.
export function idDeYoutube(texto) {
  const t = String(texto || '').trim()
  if (!t) return null
  // Si pega el identificador a pelo, también vale.
  if (ID_VALIDO.test(t)) return t

  let u
  try {
    u = new URL(t.startsWith('http') ? t : `https://${t}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  const dominios = ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be']
  if (!dominios.includes(host)) return null

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return ID_VALIDO.test(id) ? id : null
  }
  const v = u.searchParams.get('v')
  if (v && ID_VALIDO.test(v)) return v
  const partes = u.pathname.split('/').filter(Boolean)
  if (['shorts', 'embed', 'live', 'v'].includes(partes[0]) && ID_VALIDO.test(partes[1] || '')) {
    return partes[1]
  }
  return null
}

export const urlDeYoutube = (id) => `https://www.youtube.com/watch?v=${id}`

// ── Pintar ──
//
// No se carga el vídeo al abrir la página: se pinta una portada nuestra y
// el iframe no aparece hasta que alguien lo pulsa.
//
// Son tres cosas a la vez. La primera es la que manda: la política de
// privacidad dice que la web no lleva nada de terceros, y un iframe de
// YouTube en cada visita lo convertiría en mentira. Así, mientras nadie
// pulse, a Google no le llega absolutamente nada. Además una guía con
// cuatro vídeos pesaría varios megas antes de leer la primera línea, y
// la portada la dibujamos nosotros, sin pedirle la miniatura a Google —
// que también sería una visita contada.
export function hydrateVideos(raiz) {
  const bloques = [...(raiz?.querySelectorAll?.('yt-video') || [])]
  for (const el of bloques) {
    const id = el.getAttribute('data-yt')
    if (!esIdYoutube(id)) {
      el.remove()
      continue
    }
    if (el.dataset.montado === '1') continue
    el.dataset.montado = '1'
    // Dentro del editor la superficie es editable: sin esto se puede
    // escribir dentro del bloque y romperlo con el cursor.
    el.setAttribute('contenteditable', 'false')
    el.innerHTML = portadaHtml(id)

    el.querySelector('.yt-portada')?.addEventListener('click', () => {
      const marco = document.createElement('iframe')
      // La dirección la escribimos AQUÍ. `id` ya ha pasado por
      // ID_VALIDO, así que no puede llevar nada más que el vídeo.
      marco.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
      marco.title = 'Vídeo de YouTube'
      marco.loading = 'lazy'
      marco.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      marco.allowFullscreen = true
      marco.referrerPolicy = 'strict-origin-when-cross-origin'
      el.innerHTML = ''
      el.appendChild(marco)
    })
  }
}

function portadaHtml(id) {
  return `
    <button type="button" class="yt-portada" aria-label="Reproducir el vídeo de YouTube">
      <span class="yt-play" aria-hidden="true">
        <svg viewBox="0 0 68 48" width="68" height="48">
          <path d="M66.5 7.7c-.8-2.9-2.5-5.2-5.4-6C55.8.2 34 .2 34 .2s-21.8 0-27.1 1.5c-2.9.8-4.6 3.1-5.4 6C0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 2.5 5.2 5.4 6C12.2 47.8 34 47.8 34 47.8s21.8 0 27.1-1.5c2.9-.8 4.6-3.1 5.4-6C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#ff0000"/>
          <path d="M27 34.2 45.1 24 27 13.8z" fill="#fff"/>
        </svg>
      </span>
      <span class="yt-texto">Ver el vídeo</span>
      <span class="yt-nota">Se carga desde YouTube al pulsar</span>
    </button>
    <a class="yt-enlace" href="${urlDeYoutube(id)}" target="_blank" rel="noopener noreferrer">Abrirlo en YouTube</a>`
}
