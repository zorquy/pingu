import { supabase } from './supabase.js'

// Tope por carga (un fallo en bucle no inunda la tabla).
const MAX_ERRORS_PER_LOAD = 5
let loggedCount = 0
// Un módulo que no carga dispara los dos manejadores: uno vale.
const yaRegistrados = new Set()

// Y una vez por visita (1385).
const CLAVE_VISTOS = 'pd-errores-vistos'
function yaEnEstaVisita(clave) {
  try {
    const vistos = JSON.parse(sessionStorage.getItem(CLAVE_VISTOS) || '[]')
    if (vistos.includes(clave)) return true
    sessionStorage.setItem(CLAVE_VISTOS, JSON.stringify([...vistos, clave].slice(-60)))
  } catch {
    // Sin sessionStorage (modo privado estricto), se queda el tope por carga.
  }
  return false
}

async function logError(message, stack) {
  if (loggedCount >= MAX_ERRORS_PER_LOAD) return
  const clave = String(message || '').slice(0, 200)
  if (yaRegistrados.has(clave)) return
  yaRegistrados.add(clave)
  if (yaEnEstaVisita(clave)) return
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

// LO QUE NO SE APUNTA (910, 1386; el porqué, en SCHEMA): «Script error.»
// sin traza, las transiciones que cancela el navegador, lo que no lanza
// NUESTRO código y los fallos de red sin un /js/ nuestro en la traza.
const FUERA = '(\\/\\.netlify\\/scripts\\/|(chrome|moz|safari|safari-web)-extension:\\/\\/|iabjs:\\/\\/|webkit-masked-url:)'
const DE_FUERA = new RegExp(FUERA)
const EN_WINDOW_AJENO = /\b(window\.)?(ethereum|__firefox__|_META|webkit\.messageHandlers|__gCrWeb|TalismanEnabled|tronWeb|solana)\b|\bM_ID\b|MetaMask|Talisman|Java exception/
const DE_RED = /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The network connection was lost\.?)$/
const URL_DE_FUERA = new RegExp(`\\S*${FUERA}\\S*`, 'g')
const nuestro = (pila) => /\/js\/[\w./-]+\.js/.test(String(pila || '').replace(URL_DE_FUERA, ''))
export function esRuido(mensaje, error) {
  const m = String(mensaje || '')
  const pila = String(error?.stack || '')
  if (/^Script error\.?$/.test(m) && !error?.stack) return true
  if (/^Transition was (aborted|skipped)\b|^Skipping view transition\b|^Old view transition aborted\b/.test(m)) return true
  if (/^ResizeObserver loop\b/.test(m)) return true
  if (DE_FUERA.test(pila) && !nuestro(pila)) return true
  if (EN_WINDOW_AJENO.test(m) && !nuestro(pila)) return true
  if (DE_RED.test(m) && !nuestro(pila)) return true
  return false
}

// UNA PÁGINA CON MÓDULOS DE DOS DESPLIEGUES (910, 1386; SCHEMA): se vacían
// las cachés de la casa y se recarga, una vez cada cinco minutos y con red.
export const DESAJUSTE = /Importing binding name|Indirectly exported binding name|does not provide an export named|doesn't provide an export named|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|\b(icons|datos|ctx)\.\w+ is not a function/i
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

// El contexto de un fallo de red: red, pestaña y tiempo abierta.
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

// Lo mismo para un `import()` que alguien ATRAPA (1236): true si recarga.
export function recargarSiDesajuste(error) {
  const mensaje = error?.message || String(error || '')
  if (!tocaRecargar(mensaje)) return false
  logError(mensaje, `${error?.stack || ''}\n(atrapado; la página se ha recargado sola)`).finally(vaciarYRecargar)
  return true
}

// UN AVISO DE CSP SOLO SI LO CAUSA NUESTRO CÓDIGO (1385, 1386; SCHEMA): ni
// extensiones (el antivirus y su nsvcs.net) ni un host ajeno metido en la
// página (el navegador de dentro de Facebook).
const HOSTS_AJENOS = /(^|\.)(facebook\.net|facebook\.com|nsvcs\.net)$/
export function cspEsNuestra(sourceFile, origen = globalThis.location?.origin || '', bloqueado = '') {
  const f = String(sourceFile || '')
  if (!f || !origen) return false
  try {
    if (bloqueado && HOSTS_AJENOS.test(new URL(bloqueado).hostname)) return false
  } catch { /* «inline», «eval»… */ }
  return f === origen || f.startsWith(`${origen}/`)
}

export function initErrorLogging() {
  window.addEventListener('error', (e) => apuntar(e.message, e.error))
  window.addEventListener('unhandledrejection', (e) => {
    // Una transición entre páginas que corta una navegación (una página que
    // redirige al cargar, I5 de la 1334) no es un fallo: el navegador la
    // aborta y avisa con una promesa que nadie espera.
    if (/^(InvalidStateError|AbortError)$/.test(e.reason?.name || '') && /Transition was (aborted|skipped)/.test(e.reason?.message || '')) return void e.preventDefault()
    apuntar(e.reason?.message || String(e.reason), e.reason)
  })
  // La CSP en modo informe (1313): lo que bloquearía, a los errores del panel.
  document.addEventListener('securitypolicyviolation', (e) => {
    if (!cspEsNuestra(e.sourceFile, undefined, e.blockedURI)) return
    let de = e.blockedURI || ''
    try { de = new URL(de).origin } catch { /* «inline», «eval»… */ }
    logError(`CSP ${e.disposition === 'report' ? '(informe)' : ''} ${e.effectiveDirective}: ${de}`, `${e.sourceFile || ''}:${e.lineNumber || ''}`)
  })
}
