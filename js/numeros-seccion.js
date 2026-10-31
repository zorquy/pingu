// EL NÚMERO DE CADA SECCIÓN (tanda 1139, N2 de la propuesta de comunidad).
// PINGU: «un número en la barra cuando algo te espera, sí». Hasta ahora lo
// que tenías sin leer solo se sumaba en el avatar (avisos + mensajes) y desde
// la barra de abajo no se sabía dónde estaba. Ahora Comunidad cuenta los
// mensajes sin leer y los avisos del foro, y Jugar los de torneos (te toca
// una ronda, un recordatorio, tu plaza…). Lo mismo en la lateral del PC.
//
// No pregunta nada a la base: lee lo que ya cuentan la campanita
// (`window.__pdAvisos`, que deja notifications.js) y el sobre (#navMsgBadge),
// y se repinta con el evento `pd-avisos` que lanzan los dos. Lo puro va
// arriba y lo prueba Node.

export function seccionDeAviso(tipo = '') {
  const t = String(tipo || '')
  if (t.startsWith('forum_')) return 'Comunidad'
  if (t.startsWith('torneo_') || t.startsWith('tournament_')) return 'Jugar'
  return null
}

// «9+» del sobre vale diez: más de nueve, que es lo que se pinta igual.
const numeroDeChapa = (texto) => {
  const s = String(texto || '').trim()
  return s.endsWith('+') ? 10 : Number(s) || 0
}

export function cuentasDeSecciones(avisos = [], mensajes = 0) {
  const cuentas = { Comunidad: numeroDeChapa(mensajes), Jugar: 0 }
  for (const a of avisos || []) {
    if (a?.read_at) continue
    const s = seccionDeAviso(a?.type)
    if (s) cuentas[s] += 1
  }
  return cuentas
}

export const textoDeNumero = (n) => (n > 9 ? '9+' : n > 0 ? String(n) : '')

// Pinta (o quita) la chapa en cada enlace de sección: los de la barra de
// abajo (`nav.bm a`) y los de la lateral (`.lat-seccion-enlace`). El nombre
// de la sección es el texto de su <span>, el mismo que usan las dos barras.
export function pintarNumeros(doc, cuentas) {
  for (const a of doc.querySelectorAll('nav.bm > a, .lat-seccion-enlace')) {
    const nombre = a.querySelector('span:not(.sec-num)')?.textContent.trim() || ''
    const texto = textoDeNumero(cuentas[nombre] || 0)
    let chapa = a.querySelector('.sec-num')
    if (!texto) {
      chapa?.remove()
      if (a.dataset.secNombre) { a.removeAttribute('aria-label'); delete a.dataset.secNombre }
      continue
    }
    if (!chapa) {
      chapa = doc.createElement('b')
      chapa.className = 'sec-num'
      chapa.setAttribute('aria-hidden', 'true')
      a.appendChild(chapa)
    }
    if (chapa.textContent !== texto) chapa.textContent = texto
    a.dataset.secNombre = nombre
    a.setAttribute('aria-label', `${nombre} (${texto} sin leer)`)
  }
}

export function montarNumerosDeSeccion({ doc = document, win = window } = {}) {
  if (doc.documentElement.dataset.secNumeros) return
  doc.documentElement.dataset.secNumeros = '1'
  let pendiente = false
  const pintar = () => {
    if (pendiente) return
    pendiente = true
    win.requestAnimationFrame(() => {
      pendiente = false
      const sobre = doc.getElementById('navMsgBadge')
      const mensajes = sobre && !sobre.classList.contains('hidden') ? sobre.textContent : 0
      pintarNumeros(doc, cuentasDeSecciones(win.__pdAvisos || [], mensajes))
    })
  }
  win.addEventListener('pd-avisos', pintar)
  pintar()
}
