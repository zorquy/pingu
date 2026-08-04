// Plegar texto para buscar: sin acentos y en minúsculas.
//
// Nadie escribe los acentos en un buscador. "falsificacion" tiene que
// encontrar "falsificación", y "jesus" a "Jesús".
//
// El equivalente en la base de datos es `public.plegar_texto()`, de
// supabase-migration-busqueda-acentos.sql. LOS DOS TIENEN QUE PLEGAR
// IGUAL: si aquí se quitan los acentos y allí no (o al revés), el
// buscador deja de encontrar cosas y no da ningún error que lo delate.
//
// Cómo funciona: normalize('NFD') separa cada letra acentuada en dos
// caracteres, la letra y la tilde suelta; después se tiran las tildes.
// Así se cubren todas de golpe, sin listas de letras. La ñ se pliega a n,
// igual que hace `unaccent` en Postgres.
//
// El rango U+0300–U+036F es el bloque Unicode de las marcas diacríticas
// que la descomposición deja sueltas.
const TILDES = /[\u0300-\u036f]/g

export function plegarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(TILDES, '')
    .toLowerCase()
}

// Igual que plegarTexto, pero además devuelve un mapa para volver del
// texto plegado al original.
//
// Hace falta para resaltar el trozo encontrado: la búsqueda pasa por el
// texto plegado, pero lo que se le enseña a la persona es el original,
// con sus acentos. Y las posiciones NO coinciden por las bravas: la
// normalización puede cambiar la longitud (una é son dos caracteres en
// NFD) y hay caracteres que ocupan dos posiciones en JavaScript (los
// emojis). Con el mapa, `mapa[i]` es la posición en el original del
// carácter i del plegado.
export function plegarConMapa(texto) {
  const original = String(texto ?? '')
  let plegado = ''
  const mapa = []
  for (let i = 0; i < original.length; i++) {
    const pieza = original[i].normalize('NFD').replace(TILDES, '').toLowerCase()
    for (const c of pieza) {
      plegado += c
      mapa.push(i)
    }
  }
  // Una posición más al final, para poder pedir dónde termina una
  // coincidencia que llega hasta el borde.
  mapa.push(original.length)
  return { plegado, mapa }
}

// Atajo para los filtros que se hacen en el navegador sobre una lista ya
// cargada (el directorio de la comunidad, por ejemplo).
export function contienePlegado(texto, consultaPlegada) {
  if (!consultaPlegada) return true
  return plegarTexto(texto).includes(consultaPlegada)
}
