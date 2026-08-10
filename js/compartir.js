import { showToast } from './toast.js'
import { icons } from './icons.js'

// Compartir una guía o un tema.
//
// Hasta ahora, quien quería pasarle una guía a un amigo tenía que ir a la
// barra del navegador y copiar la dirección a mano. En el móvil eso es
// bastante trabajo, y es justo donde está casi todo el mundo. Cada
// persona que comparte es alcance que no cuesta nada.
//
// Dos caminos, según lo que tenga el navegador:
//
//   - En el móvil (y en algún navegador de escritorio) existe
//     `navigator.share`, que abre la hoja de compartir del sistema: ahí
//     está WhatsApp, Telegram, el correo y lo que tenga instalado. Es lo
//     que la gente espera.
//   - Si no existe, se copia el enlace al portapapeles y se avisa. Sirve
//     igual y no hace falta ninguna ventana propia.

const COPIA_OK = 'Enlace copiado'

export function compartirHtml(id, { clase = 'btn-secondary', texto = 'Compartir' } = {}) {
  return `<button type="button" class="${clase}" id="${id}">${icons.share(14)} ${texto}</button>`
}

// Copia sin depender del portapapeles moderno.
//
// `navigator.clipboard` solo existe en contextos seguros (https o
// localhost). Si alguien entra por http, o el navegador es viejo, sin
// esto el botón no haría absolutamente nada.
function copiarAlaAntigua(url) {
  const campo = document.createElement('textarea')
  campo.value = url
  campo.setAttribute('readonly', '')
  campo.style.position = 'fixed'
  campo.style.top = '-1000px'
  document.body.appendChild(campo)
  campo.select()
  let bien = false
  try {
    bien = document.execCommand('copy')
  } catch {
    bien = false
  }
  campo.remove()
  return bien
}

export async function copiarEnlace(url) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    // Puede fallar si la pestaña no tiene el foco, entre otras. Se
    // intenta por el otro camino antes de darse por vencido.
  }
  return copiarAlaAntigua(url)
}

// `boton` es el elemento; `datos` lleva el título y la dirección.
export function engancharCompartir(boton, { titulo, url } = {}) {
  if (!boton) return
  boton.addEventListener('click', async () => {
    const enlace = url || window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo || document.title, url: enlace })
        return
      } catch (e) {
        // Cerrar la hoja de compartir sin elegir nada lanza AbortError.
        // No es un fallo: es alguien que ha cambiado de opinión, y
        // enseñarle un aviso de error sería mentirle. Cualquier otro
        // error sí cae al camino de copiar.
        if (e?.name === 'AbortError') return
      }
    }
    showToast((await copiarEnlace(enlace)) ? COPIA_OK : 'No se ha podido copiar el enlace')
  })
}
