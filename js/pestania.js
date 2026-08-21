// El contador en el título de la pestaña del navegador: "(3) PokeDoc…"
// cuando tienes avisos o mensajes privados sin leer. Es lo que hace que
// una pestaña de PokeDoc abierta en segundo plano te diga desde lejos
// que ha pasado algo, sin entrar.
//
// Cada fuente (la campanita, los mensajes) anota SU número y aquí se
// suman: así ninguna pisa a la otra y el total siempre cuadra con lo
// que enseñan las burbujitas de la barra.

const partes = {}
let total = 0

// El título "de la página", sin contador. No se puede capturar una sola
// vez: tema.js, foro.js o guia.js reescriben document.title cuando les
// llegan los datos ("Mi tema — Foro de PokeDoc"), normalmente DESPUÉS de
// que las burbujitas hayan puesto el (N). Por eso hay un observador del
// <title>: cuando el cambio no es nuestro, se toma como base nueva y se
// le vuelve a plantar el contador delante.
let base = null
let ultimoPuesto = null
let vigilando = false

function sinContador(s) {
  return s.replace(/^\(\d+\+?\)\s/, '')
}

function aplicar() {
  const deseado = total > 0 ? `(${total > 99 ? '99+' : total}) ${base}` : base
  if (document.title === deseado) return
  ultimoPuesto = deseado
  document.title = deseado
}

function vigilar() {
  if (vigilando) return
  const el = document.querySelector('title')
  if (!el) return
  vigilando = true
  new MutationObserver(() => {
    // Nuestro propio cambio también dispara el observador: se ignora.
    if (document.title === ultimoPuesto) return
    base = sinContador(document.title)
    aplicar()
  }).observe(el, { childList: true, characterData: true, subtree: true })
}

export function anotarEnPestania(fuente, cuantos) {
  try {
    if (base === null) base = sinContador(document.title)
    partes[fuente] = Math.max(0, Number(cuantos) || 0)
    total = Object.values(partes).reduce((a, b) => a + b, 0)
    aplicar()
    vigilar()
  } catch {
    // Un título sin contador es perfectamente válido.
  }
}
