// LA BARRA PEGADA DEL MÓVIL, para lo que se lee largo (tanda 858).
//
// La de la expansión (856) es lo que más le gustó a PINGU: «cuando bajas y
// se queda arriba». Esto es la misma pieza para las demás fichas largas —la
// guía, el tema del foro, el torneo—: cuando la cabecera se va por arriba,
// sale una barra fija con la flecha de volver, el título y una cifra a la
// derecha (lo que queda de lectura, los mensajes, la ronda); al volver a
// verse la cabecera, se esconde. Solo en el móvil: quien la monta lo pide
// con `import()` si la pantalla es de móvil, y el módulo mete su hoja.
//
// `progreso`: si se da, una línea por debajo con lo leído (la guía). Se
// calcula contra el elemento que se pasa, de su arriba a su abajo.
import { hojaInyectada } from './hoja.js'

// Con guarda para que las cuentas de abajo se puedan probar en Node.
export const hoja = typeof document !== 'undefined' ? hojaInyectada('css/barra-pegada.css') : null

const escapar = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Lo que queda por leer, con lo leído: de lo que hay por debajo del visor
// hasta el final del cuerpo.
export function loQueQueda(minutosTotales, fraccionLeida) {
  const quedan = Math.max(0, Math.round(minutosTotales * (1 - Math.min(1, Math.max(0, fraccionLeida)))))
  return quedan <= 0 ? 'Leída' : quedan === 1 ? '1 min más' : `${quedan} min más`
}

// La fracción leída de `cuerpo`: 0 cuando su arriba llega al borde de
// arriba del visor, 1 cuando su abajo llega al borde de abajo. Lo que se
// recorre es el cuerpo menos un visor; un cuerpo que cabe entero está leído.
export function fraccionDe(cuerpo, alturaVisor = window.innerHeight, scrollY = window.scrollY) {
  const r = cuerpo.getBoundingClientRect()
  const arriba = r.top + scrollY
  const recorrido = r.height - alturaVisor
  if (recorrido <= 0) return scrollY + alturaVisor >= arriba ? 1 : 0
  return Math.min(1, Math.max(0, (scrollY - arriba) / recorrido))
}

export function montarBarraPegada({ cabecera, titulo, volverHref, volverTexto = 'Volver', cifra = () => '', progreso = null, doc = document, win = window } = {}) {
  if (!cabecera || !('IntersectionObserver' in win)) return null
  let barra = doc.getElementById('barraPegada')
  if (!barra) {
    barra = doc.createElement('div')
    barra.id = 'barraPegada'
    barra.className = 'barra-pegada hidden'
    doc.body.appendChild(barra)
  }
  barra.innerHTML = `<a class="barra-pegada-volver" href="${escapar(volverHref || '/')}" aria-label="${escapar(volverTexto)}"><span class="barra-pegada-flecha" aria-hidden="true"></span></a><span class="barra-pegada-titulo"></span><span class="barra-pegada-cifra"></span>${progreso ? '<span class="barra-pegada-progreso" aria-hidden="true"><i></i></span>' : ''}`
  barra.querySelector('.barra-pegada-titulo').textContent = String(titulo || doc.title || '')
  const elCifra = barra.querySelector('.barra-pegada-cifra')
  const elProgreso = barra.querySelector('.barra-pegada-progreso i')
  const refrescar = () => {
    elCifra.textContent = String(cifra() || '')
    if (elProgreso && progreso) elProgreso.style.width = `${Math.round(fraccionDe(progreso, win.innerHeight, win.scrollY) * 100)}%`
  }
  const io = new IntersectionObserver((vistas) => {
    const v = vistas[vistas.length - 1]
    // Solo cuando la cabecera se ha ido por ARRIBA: por abajo (al cargar
    // con la página ya desplazada hacia otro lado) no tiene sentido.
    const fuera = !v.isIntersecting && v.boundingClientRect.top < 0
    barra.classList.toggle('hidden', !fuera)
    if (fuera) refrescar()
  })
  io.observe(cabecera)
  let pendiente = false
  const alMover = () => {
    if (barra.classList.contains('hidden') || pendiente) return
    pendiente = true
    win.requestAnimationFrame(() => { pendiente = false; refrescar() })
  }
  win.addEventListener('scroll', alMover, { passive: true })
  return {
    refrescar,
    poner(nuevoTitulo) { barra.querySelector('.barra-pegada-titulo').textContent = String(nuevoTitulo || '') },
    quitar() { io.disconnect(); win.removeEventListener('scroll', alMover); barra.remove() },
  }
}
