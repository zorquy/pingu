// Adónde lleva lo que se comparte A PokeDoc desde otra app (tanda 1317, A7).
// El service worker recibe el POST del `share_target` y manda aquí el
// enlace, el texto y el título; una foto va directa al escáner.
//
// - Un enlace de pokedoc.es: a esa página.
// - Un enlace de Cardmarket a una carta: el buscador de cartas con su nombre
//   (Cardmarket lo lleva en la dirección: …/Singles/<set>/<Nombre-de-la-carta>).
// - Cualquier otro texto: el buscador de cartas con ese texto.
const MAX = 80

export function destinoCompartido({ url = '', text = '', title = '' } = {}) {
  // Muchas apps meten el enlace dentro del texto («Mira esto https://…»).
  const enlace = url || (String(text).match(/https?:\/\/\S+/) || [])[0] || ''
  if (enlace) {
    let u = null
    try { u = new URL(enlace) } catch { /* no es un enlace */ }
    // Siempre una ruta de la casa: «//otra.web» sería salir de PokeDoc.
    if (u && /(^|\.)pokedoc\.es$/.test(u.hostname)) return '/' + u.pathname.replace(/^[/\\]+/, '') + u.search + u.hash
    if (u && /(^|\.)cardmarket\.com$/.test(u.hostname)) {
      const trozos = u.pathname.split('/').filter(Boolean)
      const i = trozos.indexOf('Singles')
      const nombre = i >= 0 ? trozos[i + 2] : null
      // «Pikachu-ex-V1-SSP057»: fuera la versión (V1) y el código (SSP057).
      if (nombre) return buscar(decodeURIComponent(nombre).replace(/-V\d+(?=-|$)/, '').replace(/-[A-Z]{2,5}\d{2,4}$/, '').replace(/-/g, ' '))
    }
  }
  const resto = String(text || title).replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim()
  return resto ? buscar(resto) : '/cartas?ver=buscar'
}

const buscar = (q) => `/cartas?ver=buscar&q=${encodeURIComponent(q.slice(0, MAX).trim())}`
