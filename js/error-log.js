import { supabase } from './supabase.js'

// Tope por carga de página para no inundar la tabla si algo entra en un
// bucle de errores (por ejemplo, un fallo que se repite en cada frame de
// una animación).
const MAX_ERRORS_PER_LOAD = 5
let loggedCount = 0

async function logError(message, stack) {
  if (loggedCount >= MAX_ERRORS_PER_LOAD) return
  loggedCount++
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('client_errors').insert({
      user_id: session?.user?.id || null,
      message: String(message || '(sin mensaje)').slice(0, 500),
      stack: stack ? String(stack).slice(0, 2000) : null,
      page_url: window.location.pathname,
      user_agent: navigator.userAgent,
    })
  } catch {
    // Si el propio registro de errores falla, no hay nada más que hacer
    // aquí — no queremos que el logger provoque más errores.
  }
}

export function initErrorLogging() {
  window.addEventListener('error', (e) => {
    logError(e.message, e.error?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    logError(e.reason?.message || String(e.reason), e.reason?.stack)
  })
}
