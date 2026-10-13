// Lo que tarda DE VERDAD cada página (tanda 821, VE6): LCP (cuándo se ve lo
// principal), INP (lo que tarda en responder a un toque) y CLS (cuánto
// salta), medidos en el navegador de quien visita y apuntados en nuestra
// tabla `page_vitals`. Sin terceros ni cookies, y sin decir quién.
//
// Una visita de cada cuatro (MUESTRA): para un p75 por página sobra, y son
// cuatro veces menos filas. Se manda UNA vez, al esconderse la página (es
// cuando el INP y el CLS ya son los finales), con `keepalive` para que la
// petición sobreviva al cierre. Si la tabla no existe todavía, la petición
// falla y no pasa nada: es medir, no la web.
import { normalizePath, pareceRobot } from './page-views.js'
import { supabase } from './supabase.js'

export const MUESTRA = 0.25

// La nota de una cifra con los umbrales de Google (bueno / a mejorar /
// malo), para el bloque de /admin.
const UMBRALES = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] }
export function notaDeVital(tipo, valor) {
  if (valor == null || !UMBRALES[tipo]) return ''
  const [bien, mal] = UMBRALES[tipo]
  return valor <= bien ? 'bien' : valor <= mal ? 'regular' : 'mal'
}

// La fila que se manda: enteros y acotados, como pide la tabla. Sin LCP ni
// INP ni CLS no hay nada que apuntar.
export function filaDeVitales({ path, lcp, inp, cls, movil }) {
  const ms = (x, max) => (Number.isFinite(x) && x >= 0 ? Math.min(Math.round(x), max) : null)
  const fila = { path: String(path || '/').slice(0, 200), lcp_ms: ms(lcp, 120000), inp_ms: ms(inp, 60000), cls_mil: Number.isFinite(cls) && cls >= 0 ? Math.min(Math.round(cls * 1000), 100000) : null, movil: !!movil }
  return fila.lcp_ms == null && fila.inp_ms == null && fila.cls_mil == null ? null : fila
}

export function medirVitales({ win = window, azar = Math.random, enviar = null } = {}) {
  if (!win.PerformanceObserver || pareceRobot() || azar() >= MUESTRA) return false
  const m = { lcp: null, inp: null, cls: 0 }
  const observar = (type, alLlegar, extra = {}) => {
    try {
      new win.PerformanceObserver((lista) => lista.getEntries().forEach(alLlegar)).observe({ type, buffered: true, ...extra })
    } catch {}
  }
  observar('largest-contentful-paint', (e) => { m.lcp = e.startTime })
  // El INP de verdad es casi el peor toque; con las visitas de una en una,
  // el peor toque de la visita es una buena aproximación.
  observar('event', (e) => { if (e.interactionId) m.inp = Math.max(m.inp ?? 0, e.duration) }, { durationThreshold: 40 })
  observar('layout-shift', (e) => { if (!e.hadRecentInput) m.cls += e.value })
  let mandado = false
  const mandar = () => {
    if (mandado || win.document.visibilityState !== 'hidden') return
    mandado = true
    const fila = filaDeVitales({ path: normalizePath(win.location.pathname, win.location.search), ...m, movil: !!win.matchMedia?.('(max-width: 900px)').matches })
    if (!fila) return
    // La dirección y la clave, las del cliente (no una copia: la 471). Sin
    // ellas (el doble de las pruebas) no se manda nada a ninguna parte.
    const url = supabase?.supabaseUrl
    const clave = supabase?.supabaseKey
    const ir = enviar || (url && clave ? (cuerpo) => win.fetch(`${url}/rest/v1/page_vitals`, { method: 'POST', keepalive: true, headers: { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify(cuerpo) }).catch(() => {}) : null)
    ir?.(fila)
  }
  win.document.addEventListener('visibilitychange', mandar)
  return true
}
