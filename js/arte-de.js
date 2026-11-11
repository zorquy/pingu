// El degradado de una portada sin imagen (.arte-1..6 en components.css): uno
// de seis, elegido por el SLUG y no al azar —si cambiara en cada pintada, la
// rejilla de /aprender parpadearía al filtrar—. Puro desde la 1283: lo usa
// también la cabecera del artículo (js/articulo-cabecera.js), que pinta igual
// el servidor (meta-social) y no puede importar app.js.
const ARTES = 6
export function arteDe(algo) {
  const clave = String(algo?.slug || algo?.id || algo || '')
  let suma = 0
  for (let i = 0; i < clave.length; i++) suma = (suma * 31 + clave.charCodeAt(i)) % 100000
  return (suma % ARTES) + 1
}
