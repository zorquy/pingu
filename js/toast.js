let container = null

function getContainer() {
  if (container && document.body.contains(container)) return container
  container = document.createElement('div')
  container.className = 'toast-container'
  container.setAttribute('role', 'status')
  container.setAttribute('aria-live', 'polite')
  document.body.appendChild(container)
  return container
}

// `accion` (873): un botón dentro del aviso («Compartir» al subir de
// nivel); `acciones`, varios (1084: Deshacer y Recibo). Con acción el aviso
// dura más, que hay que poder pulsarla.
export function showToast(message, type = 'error', { accion = null, acciones = accion ? [accion] : [] } = {}) {
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message
  for (const accion of acciones) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'toast-accion'
    b.textContent = accion.texto
    b.addEventListener('click', () => { accion.alPulsar(); quitar() })
    el.appendChild(b)
  }
  getContainer().appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast-visible'))
  const quitar = () => {
    el.classList.remove('toast-visible')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }
  setTimeout(quitar, acciones.length ? 9000 : 4200)
}
