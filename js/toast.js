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

export function showToast(message, type = 'error') {
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message
  getContainer().appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast-visible'))
  setTimeout(() => {
    el.classList.remove('toast-visible')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, 4200)
}
