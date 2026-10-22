// Una página que Chrome prepara por si la abres (985, la D de «Rápida al
// volver») ejecuta su código entero sin que nadie la vea. Leer es justo lo
// que se adelanta; ESCRIBIR no: la visita, la racha, «leído», un voto…
// esperan a que la página se abra de verdad, y si no se abre, no pasan.
// Todo lo que no es GET o HEAD cuenta como escribir (las RPC de leer también
// esperan, que es lo prudente). Sin imports, para probarlo en Node.
export function fetchQueEspera(fetchImpl = (...a) => fetch(...a), doc = globalThis.document) {
  return (recurso, opciones = {}) => {
    const metodo = String(opciones?.method || recurso?.method || 'GET').toUpperCase()
    if (doc?.prerendering && metodo !== 'GET' && metodo !== 'HEAD') {
      return new Promise((ok) => doc.addEventListener('prerenderingchange', ok, { once: true })).then(() => fetchImpl(recurso, opciones))
    }
    return fetchImpl(recurso, opciones)
  }
}
