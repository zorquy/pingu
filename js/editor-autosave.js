const PREFIX = 'pokedoc-editor-draft-'

function key(scope) {
  return `${PREFIX}${scope}`
}

export function saveDraft(scope, data) {
  try {
    localStorage.setItem(key(scope), JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    // localStorage puede fallar en modo privado o si está lleno — el autoguardado
    // es una mejora de confort, no algo crítico, así que lo ignoramos en silencio.
  }
}

export function loadDraft(scope) {
  try {
    const raw = localStorage.getItem(key(scope))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearDraft(scope) {
  try {
    localStorage.removeItem(key(scope))
  } catch {
    // ver saveDraft
  }
}

// Arranca un autoguardado periódico. captureState() debe devolver el
// snapshot actual del formulario; se guarda solo si tiene título (para no
// llenar localStorage con borradores completamente vacíos).
// Devuelve una función para detenerlo — hay que llamarla antes de navegar
// tras un guardado con éxito, si no el "beforeunload" de esa misma
// navegación volvería a escribir el borrador que se acaba de borrar.
export function startAutosave(scope, captureState, intervalMs = 8000) {
  const tick = () => {
    const state = captureState()
    if (state?.title?.trim()) saveDraft(scope, state)
  }
  const id = setInterval(tick, intervalMs)
  window.addEventListener('beforeunload', tick)
  return () => {
    clearInterval(id)
    window.removeEventListener('beforeunload', tick)
  }
}
