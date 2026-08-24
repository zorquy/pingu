// Los estímulos del juego: sonido, vibración, partículas y el combo en
// grande. Es la capa que convierte "has acertado" en algo que se SIENTE
// — el 90 % de lo que hace adictivo a un Duolingo no son los ejercicios,
// es este feedback.
//
// Reglas de la casa aquí dentro:
//  - Nada de ficheros de audio: las notas se sintetizan con WebAudio
//    (cero peso, cero peticiones). El silencio se recuerda en
//    localStorage y hay botón en el marcador.
//  - TODO va en try/catch: una celebración no puede romper jamás el
//    guardado de una respuesta. Sin AudioContext (navegadores capados,
//    autoplay bloqueado) simplemente no suena.
//  - `prefers-reduced-motion` apaga partículas y sacudidas desde el CSS;
//    aquí se respeta no vibrando.

const CLAVE_SILENCIO = 'pokedoc-curso-silencio'

export function silenciado() {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === '1'
  } catch {
    return false
  }
}

export function alternarSilencio() {
  const ahora = !silenciado()
  try {
    localStorage.setItem(CLAVE_SILENCIO, ahora ? '1' : '0')
  } catch {}
  return ahora
}

let ctx = null
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  // Los navegadores arrancan el contexto "suspendido" hasta el primer
  // gesto; como sonar() siempre llega desde un clic, esto lo despierta.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function nota(ac, frecuencia, cuando, duracion, tipo = 'sine', volumen = 0.09) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = tipo
  osc.frequency.value = frecuencia
  gain.gain.setValueAtTime(0.0001, cuando)
  gain.gain.exponentialRampToValueAtTime(volumen, cuando + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, cuando + duracion)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(cuando)
  osc.stop(cuando + duracion + 0.02)
}

// Las cuatro señales del juego. Frecuencias de acorde de do mayor: lo
// bastante "musical" para no cansar a la quinta pregunta.
export function sonar(cual) {
  try {
    if (silenciado()) return
    const ac = audio()
    if (!ac) return
    const t = ac.currentTime
    if (cual === 'acierto') {
      nota(ac, 523.25, t, 0.09)
      nota(ac, 659.25, t + 0.08, 0.14)
    } else if (cual === 'fallo') {
      nota(ac, 196, t, 0.2, 'triangle', 0.07)
      nota(ac, 155.56, t + 0.1, 0.22, 'triangle', 0.06)
    } else if (cual === 'combo') {
      nota(ac, 523.25, t, 0.08)
      nota(ac, 659.25, t + 0.07, 0.08)
      nota(ac, 783.99, t + 0.14, 0.18)
    } else if (cual === 'final') {
      nota(ac, 523.25, t, 0.12, 'triangle')
      nota(ac, 659.25, t + 0.11, 0.12, 'triangle')
      nota(ac, 783.99, t + 0.22, 0.12, 'triangle')
      nota(ac, 1046.5, t + 0.33, 0.3, 'triangle', 0.11)
    }
  } catch {}
}

function movimientoReducido() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function vibrar(cual) {
  try {
    if (movimientoReducido()) return
    navigator.vibrate?.(cual === 'acierto' ? 15 : [40, 60, 40])
  } catch {}
}

// El chorro de partículas sobre la respuesta correcta. Se pintan en
// fixed sobre el centro del elemento y cada una vuela hacia su --dx/--dy
// (la animación vive en el CSS); al terminar se limpian solas.
export function estallido(el, cuantas = 10) {
  try {
    if (movimientoReducido() || !el) return
    const caja = el.getBoundingClientRect()
    const cx = caja.left + caja.width / 2
    const cy = caja.top + caja.height / 2
    const COLORES = ['#22a06b', '#38bdf8', '#f59e0b', '#a78bfa']
    for (let i = 0; i < cuantas; i++) {
      const p = document.createElement('span')
      p.className = 'curso-particula'
      const angulo = (Math.PI * 2 * i) / cuantas + Math.random() * 0.6
      const distancia = 38 + Math.random() * 34
      p.style.left = `${cx}px`
      p.style.top = `${cy}px`
      p.style.setProperty('--dx', `${Math.cos(angulo) * distancia}px`)
      p.style.setProperty('--dy', `${Math.sin(angulo) * distancia - 18}px`)
      p.style.background = COLORES[i % COLORES.length]
      document.body.appendChild(p)
      p.addEventListener('animationend', () => p.remove())
      // Red de seguridad: si la animación no corre (pestaña en segundo
      // plano), que no se queden puntos flotando para siempre.
      setTimeout(() => p.remove(), 1200)
    }
  } catch {}
}

// La mascota comenta los momentos grandes: asoma por la esquina con una
// burbuja y se va sola. Aparece POCO a propósito — el búho de Duolingo
// funciona porque no está siempre.
let mascotaViva = null
export function mascotaDice(texto) {
  try {
    if (movimientoReducido() || !texto) return
    mascotaViva?.remove()
    const caja = document.createElement('div')
    caja.className = 'curso-mascota'
    caja.innerHTML = `
      <span class="curso-mascota-burbuja"></span>
      <img src="/assets/images/mascota.webp" alt="" width="72" height="109" />`
    caja.querySelector('.curso-mascota-burbuja').textContent = texto
    document.body.appendChild(caja)
    mascotaViva = caja
    setTimeout(() => {
      caja.classList.add('curso-mascota-se-va')
      setTimeout(() => caja.remove(), 400)
    }, 2400)
  } catch {}
}

// El «×2» en grande cuando el multiplicador SUBE (no en cada acierto:
// repetirlo lo gastaría). Aparece sobre el escenario y se va solo.
export function comboGrande(stage, mult, racha) {
  try {
    if (!stage) return
    const globo = document.createElement('div')
    globo.className = 'curso-combo-grande'
    globo.innerHTML = `<strong>×${mult}</strong><span>¡${racha} seguidas!</span>`
    stage.appendChild(globo)
    globo.addEventListener('animationend', () => globo.remove())
    setTimeout(() => globo.remove(), 1600)
  } catch {}
}
