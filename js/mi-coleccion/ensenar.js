// MODO «ENSEÑAR» (725, X15 de la lista): la colección a pantalla completa,
// una carta cada vez y grande, para enseñarla en persona —en la mesa de la
// tienda, al de al lado—. Se pasa con las flechas, deslizando o tocando
// los lados, y se sale con Esc o con la ✕.
//
// Y LA MEDALLA DE UN SET COMPLETO (725, X9): cuando la carta que acabas de
// añadir es la que faltaba, sale la mascota con su medalla. Una vez por set
// y por navegador: quitarla y volverla a poner no es completarlo otra vez.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { decidirGesto } from './gestos-ficha.js'

// Lo que se enseña: [{ fotos: [url, …respaldos], nombre, detalle }].
export function abrirEnsenar(cartas, { inicio = 0, doc = document, win = window } = {}) {
  if (!cartas?.length) return null
  let i = Math.max(0, Math.min(cartas.length - 1, inicio))
  let d = doc.getElementById('mcEnsenar')
  if (!d) {
    d = doc.createElement('dialog')
    d.id = 'mcEnsenar'
    d.className = 'mc-ensenar'
    d.setAttribute('aria-label', 'Enseñar tu colección')
    d.innerHTML = `
      <button type="button" class="mc-ensenar-cerrar" data-ensenar="cerrar" aria-label="Salir">✕</button>
      <button type="button" class="mc-ensenar-lado mc-ensenar-antes" data-ensenar="-1" aria-label="La anterior">‹</button>
      <figure class="mc-ensenar-carta"><img alt="" width="600" height="837" loading="eager"><figcaption><b></b><small></small></figcaption></figure>
      <button type="button" class="mc-ensenar-lado mc-ensenar-despues" data-ensenar="1" aria-label="La siguiente">›</button>
      <p class="mc-ensenar-sitio" aria-live="polite"></p>`
    doc.body.appendChild(d)
  }
  const img = d.querySelector('img')
  const pintar = () => {
    const c = cartas[i]
    let resto = (c.fotos || []).slice(1)
    img.onerror = () => {
      if (resto.length) {
        img.src = resto[0]
        resto = resto.slice(1)
      } else img.removeAttribute('src')
    }
    img.src = c.fotos?.[0] || ''
    img.alt = c.nombre || ''
    d.querySelector('figcaption b').textContent = c.nombre || ''
    d.querySelector('figcaption small').textContent = c.detalle || ''
    d.querySelector('.mc-ensenar-sitio').textContent = `${i + 1} de ${cartas.length}`
    d.querySelector('.mc-ensenar-antes').disabled = i === 0
    d.querySelector('.mc-ensenar-despues').disabled = i >= cartas.length - 1
  }
  const ir = (paso) => {
    const j = i + paso
    if (j < 0 || j >= cartas.length) return
    i = j
    pintar()
  }
  // Los oyentes se cambian en cada apertura (`on…`): la lista de cartas es
  // otra y no pueden apilarse.
  d.onclick = (e) => {
    const b = e.target.closest('[data-ensenar]')
    if (!b) return
    if (b.dataset.ensenar === 'cerrar') return d.close()
    ir(Number(b.dataset.ensenar))
  }
  // En el documento y no en el diálogo: al llegar a la última, su flecha
  // se apaga, el foco se cae del diálogo y sus teclas dejarían de llegar.
  doc.removeEventListener('keydown', d.__teclas || (() => {}))
  d.__teclas = (e) => {
    if (!d.open) return
    if (e.key === 'ArrowRight') ir(1)
    else if (e.key === 'ArrowLeft') ir(-1)
  }
  doc.addEventListener('keydown', d.__teclas)
  let toque = null
  d.ontouchstart = (e) => { toque = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null }
  d.ontouchend = (e) => {
    if (!toque) return
    const t = e.changedTouches[0]
    const g = decidirGesto({ dx: t.clientX - toque.x, dy: t.clientY - toque.y })
    toque = null
    if (g === 'siguiente') ir(1)
    else if (g === 'anterior') ir(-1)
    else if (g === 'cerrar') d.close()
  }
  d.onclose = () => {
    doc.removeEventListener('keydown', d.__teclas)
    if (doc.fullscreenElement) doc.exitFullscreen?.().catch(() => {})
  }
  pintar()
  if (!d.open) d.showModal()
  // A pantalla completa si se deja (en el iPhone no: el diálogo ya la ocupa).
  d.requestFullscreen?.().catch(() => {})
  return { dialogo: d, ir }
}

const CLAVE = 'pokedoc-sets-completos'

export function yaCelebrado(setId, almacen = globalThis.localStorage) {
  try {
    return (JSON.parse(almacen.getItem(CLAVE) || '[]') || []).includes(setId)
  } catch {
    return false
  }
}

function apuntarCelebrado(setId, almacen = globalThis.localStorage) {
  try {
    const lista = JSON.parse(almacen.getItem(CLAVE) || '[]') || []
    if (!lista.includes(setId)) almacen.setItem(CLAVE, JSON.stringify([...lista, setId].slice(-200)))
  } catch {}
}

export function celebrarSetCompleto({ setId, nombre, total }, { doc = document } = {}) {
  if (!setId || yaCelebrado(setId)) return null
  apuntarCelebrado(setId)
  let d = doc.getElementById('mcCompleto')
  if (!d) {
    d = doc.createElement('dialog')
    d.id = 'mcCompleto'
    d.className = 'mc-completo'
    d.setAttribute('aria-labelledby', 'mcCompletoTitulo')
    doc.body.appendChild(d)
    d.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) d.close() })
  }
  d.innerHTML = `
    <div class="mc-completo-mascota">
      <img src="/assets/images/mascota.webp" alt="" width="64" height="97" loading="lazy">
      <span class="mc-completo-medalla" aria-hidden="true">${icons.medal(20)}</span>
    </div>
    <div class="mc-completo-texto">
      <h2 id="mcCompletoTitulo">¡Has completado ${escapeHtml(nombre || 'la colección')}!</h2>
      <p>${total ? `Las ${total} cartas del set, todas tuyas.` : 'Todas las cartas del set, tuyas.'}</p>
    </div>
    <button type="button" class="mc-completo-cerrar" data-cerrar aria-label="Cerrar">✕</button>`
  // SIN modal (`show`, no `showModal`): la carta que lo completa acaba de
  // entrar con su aviso de Deshacer, y una capa encima lo dejaría sin poder
  // pulsar. Se celebra al lado, no tapando.
  if (!d.open) d.show()
  return d
}
