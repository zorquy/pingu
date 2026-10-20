import { supabase } from './supabase.js'

// Tope por carga de página para no inundar la tabla si algo entra en un
// bucle de errores (por ejemplo, un fallo que se repite en cada frame de
// una animación).
const MAX_ERRORS_PER_LOAD = 5
let loggedCount = 0
// Un módulo que no carga dispara los dos manejadores globales, así que el
// mismo "Failed to fetch" entraba dos veces por cada carga de página y
// duplicaba todo el listado del panel.
const yaRegistrados = new Set()

async function logError(message, stack) {
  if (loggedCount >= MAX_ERRORS_PER_LOAD) return
  const clave = String(message || '').slice(0, 200)
  if (yaRegistrados.has(clave)) return
  yaRegistrados.add(clave)
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

// Para registrar a mano un fallo que no lanza excepción — por ejemplo el
// `{ error }` que devuelve una consulta de Supabase, que si nadie lo mira
// se queda en silencio y no aparece nunca en el panel de errores.
export function logClientError(message, stack) {
  return logError(message, stack)
}

// LO QUE NO SE APUNTA (910): ruido que no dice nada que se pueda arreglar.
// «Script error.» es lo que el navegador deja ver de un error de un script
// de OTRO origen —una extensión, el navegador de dentro de Instagram—: sin
// fichero, sin línea, sin traza (la web no carga scripts de fuera). Y las
// transiciones entre páginas (`@view-transition`) que el propio navegador
// cancela porque cambió el alto de la ventana (la barra del móvil al hacer
// scroll) o porque la página ya se había enseñado: la navegación sigue sin
// la animación, que es lo que tiene que pasar.
export function esRuido(mensaje, error) {
  const m = String(mensaje || '')
  if (/^Script error\.?$/.test(m) && !error?.stack) return true
  if (/^Transition was (aborted|skipped)\b/.test(m)) return true
  return false
}

// UNA PÁGINA CON MÓDULOS DE DOS DESPLIEGUES (910). Si un módulo pide a otro
// algo que ese no exporta, es que uno llegó nuevo y el otro viejo de la
// caché (o del navegador): la página está rota entera y no se arregla sola.
// Se vacían las cachés de la casa y se recarga UNA vez cada cinco minutos
// —si vuelve a pasar, es un fallo de verdad y se queda apuntado—. Sin red,
// no: recargar llevaría a «Sin conexión» por un trozo que no ha llegado.
export const DESAJUSTE = /Importing binding name|does not provide an export named|doesn't provide an export named|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
const CLAVE_RECARGA = 'pd-recarga-despliegue'

export function tocaRecargar(mensaje, { ahora = Date.now(), almacen = globalThis.sessionStorage, enLinea = globalThis.navigator?.onLine !== false } = {}) {
  if (!DESAJUSTE.test(String(mensaje || '')) || !enLinea) return false
  try {
    if (ahora - Number(almacen.getItem(CLAVE_RECARGA) || 0) < 5 * 60 * 1000) return false
    almacen.setItem(CLAVE_RECARGA, String(ahora))
    return true
  } catch {
    return false
  }
}

async function vaciarYRecargar() {
  try {
    const nombres = await caches.keys()
    await Promise.all(nombres.filter((n) => /^pokedoc-(ficheros|paginas)-/.test(n)).map((n) => caches.delete(n)))
  } catch {}
  location.reload()
}

// Un «Failed to fetch» suelto no dice qué petición ni en qué momento; esto
// sí: si había red, si la pestaña estaba a la vista y cuánto llevaba
// abierta (una app que vuelve de segundo plano pide antes de tener red).
function contexto() {
  const s = Math.round(performance.now() / 1000)
  return `[en línea: ${navigator.onLine ? 'sí' : 'no'} · pestaña: ${document.visibilityState} · a los ${s} s de abrir]`
}
const esDeRed = (m) => /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/.test(String(m || ''))

function apuntar(mensaje, error) {
  if (esRuido(mensaje, error)) return
  const pila = esDeRed(mensaje) ? `${contexto()}\n${error?.stack || ''}` : error?.stack
  if (tocaRecargar(mensaje)) {
    logError(mensaje, `${pila || ''}\n(la página se ha recargado sola)`).finally(vaciarYRecargar)
    return
  }
  logError(mensaje, pila)
}

export function initErrorLogging() {
  window.addEventListener('error', (e) => apuntar(e.message, e.error))
  window.addEventListener('unhandledrejection', (e) => apuntar(e.reason?.message || String(e.reason), e.reason))
}
