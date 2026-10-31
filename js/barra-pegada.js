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
//
// `indice` (1139, G1): los títulos de la guía ([{ id, text }]). La cifra se
// vuelve un botón que despliega «En esta guía» debajo de la barra, con la
// sección en la que estás marcada: en el PC el índice va al lado (desde
// 1024 px) y en el móvil no había forma de saltar a una sección.
// `accion` (1139, F2): un botón a la derecha (`{ texto, alPulsar }`), como
// «3 nuevos ↓» en un tema; `ponerAccion` lo cambia o lo quita después.
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

// La sección en la que estás: la última cuyo título ya ha pasado por debajo
// de las dos barras de arriba (`margen`, un poco más que el `scroll-margin-top`
// de la guía, para que la sección a la que acabas de saltar cuente). Antes
// del primero, ninguna.
export function seccionActual(tops, margen = 140) {
  let actual = -1
  tops.forEach((t, i) => { if (t != null && t <= margen) actual = i })
  return actual
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

export function montarBarraPegada({ cabecera, titulo, volverHref, volverTexto = 'Volver', cifra = () => '', progreso = null, indice = null, accion = null, doc = document, win = window } = {}) {
  if (!cabecera || !('IntersectionObserver' in win)) return null
  let barra = doc.getElementById('barraPegada')
  if (!barra) {
    barra = doc.createElement('div')
    barra.id = 'barraPegada'
    barra.className = 'barra-pegada hidden'
    doc.body.appendChild(barra)
  }
  const conIndice = Array.isArray(indice) && indice.length > 1
  const cifraHtml = conIndice
    ? '<button type="button" class="barra-pegada-cifra barra-pegada-indice-btn" aria-expanded="false" aria-controls="barraPegadaIndice"><span class="barra-pegada-cifra-texto"></span><span class="barra-pegada-indice-flecha" aria-hidden="true"></span></button>'
    : '<span class="barra-pegada-cifra"><span class="barra-pegada-cifra-texto"></span></span>'
  const indiceHtml = conIndice
    ? `<nav class="barra-pegada-indice" id="barraPegadaIndice" aria-label="En esta guía" hidden><b>En esta guía</b>${indice.map((h) => `<a href="#${escapar(h.id)}">${escapar(h.text)}</a>`).join('')}</nav>`
    : ''
  barra.innerHTML = `<a class="barra-pegada-volver" href="${escapar(volverHref || '/')}" aria-label="${escapar(volverTexto)}"><span class="barra-pegada-flecha" aria-hidden="true"></span></a><span class="barra-pegada-titulo"></span>${cifraHtml}<button type="button" class="btn-primary barra-pegada-accion" hidden></button>${progreso ? '<span class="barra-pegada-progreso" aria-hidden="true"><i></i></span>' : ''}${indiceHtml}`
  barra.querySelector('.barra-pegada-titulo').textContent = String(titulo || doc.title || '')
  const elCifra = barra.querySelector('.barra-pegada-cifra-texto')
  const elProgreso = barra.querySelector('.barra-pegada-progreso i')
  const elIndice = barra.querySelector('.barra-pegada-indice')
  const botonIndice = barra.querySelector('.barra-pegada-indice-btn')
  const elAccion = barra.querySelector('.barra-pegada-accion')
  let alPulsarAccion = null
  const ponerAccion = (nueva) => {
    alPulsarAccion = nueva?.alPulsar || null
    elAccion.hidden = !nueva?.texto
    elAccion.textContent = nueva?.texto || ''
  }
  ponerAccion(accion)
  elAccion.addEventListener('click', () => alPulsarAccion?.())
  const abrirIndice = (abrir) => {
    if (!elIndice) return
    elIndice.hidden = !abrir
    botonIndice.setAttribute('aria-expanded', String(abrir))
  }
  if (elIndice) {
    // Al abrirlo se vuelve a mirar dónde estás: un salto de ancla no siempre
    // dispara el `scroll` antes del toque.
    botonIndice.addEventListener('click', () => { if (elIndice.hidden) marcarSeccion(); abrirIndice(elIndice.hidden) })
    // Tocar una sección la lleva allí (el ancla) y pliega el índice.
    elIndice.addEventListener('click', (e) => { if (e.target.closest('a')) abrirIndice(false) })
    doc.addEventListener('click', (e) => { if (!barra.contains(e.target)) abrirIndice(false) })
  }
  const marcarSeccion = () => {
    if (!elIndice) return
    const tops = indice.map((h) => doc.getElementById(h.id)?.getBoundingClientRect().top ?? null)
    const actual = seccionActual(tops)
    elIndice.querySelectorAll('a').forEach((a, i) => {
      a.classList.toggle('activo', i === actual)
      if (i === actual) a.setAttribute('aria-current', 'location')
      else a.removeAttribute('aria-current')
    })
  }
  const refrescar = () => {
    elCifra.textContent = String(cifra() || '')
    if (elProgreso && progreso) elProgreso.style.width = `${Math.round(fraccionDe(progreso, win.innerHeight, win.scrollY) * 100)}%`
    marcarSeccion()
  }
  const io = new IntersectionObserver((vistas) => {
    const v = vistas[vistas.length - 1]
    // Solo cuando la cabecera se ha ido por ARRIBA: por abajo (al cargar
    // con la página ya desplazada hacia otro lado) no tiene sentido.
    const fuera = !v.isIntersecting && v.boundingClientRect.top < 0
    barra.classList.toggle('hidden', !fuera)
    if (fuera) refrescar()
    else abrirIndice(false)
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
    ponerAccion,
    poner(nuevoTitulo) { barra.querySelector('.barra-pegada-titulo').textContent = String(nuevoTitulo || '') },
    quitar() { io.disconnect(); win.removeEventListener('scroll', alMover); barra.remove() },
  }
}
