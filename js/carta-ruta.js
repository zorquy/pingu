// Direcciones y URLs del catálogo de cartas (tanda 326).
//
// Sale de `js/carta-nucleo.js` por la trampa del barrido de CSS: aquel
// fichero pinta HTML, y una página que lo importa «usa» todas sus
// clases aunque no pinte ninguna. La lista de un mazo de un torneo solo
// necesita saber ADÓNDE enlaza una carta, así que importar el molde
// entero le habría colgado las clases de `css/carta.css` a /torneo, que
// no carga esa hoja. Es exactamente lo que le pasó a `.guide-card` con
// la portada en la tanda 316.
//
// Aquí dentro no hay ni una etiqueta: solo cadenas de dirección.
// `carta-nucleo.js` lo reexporta, así que nada de lo que ya lo
// importaba de allí se entera.

const ASSETS = 'https://assets.tcgdex.net'

// ── La dirección ──
//
// `/carta/ceruledge-ex-sv5-36`: el nombre delante, porque eso es lo que
// lee una persona antes de pulsar y lo que Google pesa.
//
// El identificador de TCGdex ya es `<set>-<número>`, así que la
// dirección termina en dos trozos separados por guion. Para leerla al
// revés NO se puede dar por hecho dónde acaba el nombre —lleva guiones
// él también—, así que se prueban los candidatos de menos a más trozos y
// se pregunta por TODOS a la vez. Un identificador de set con un guion
// dentro (no he visto ninguno, pero tampoco los he contado todos) se
// resuelve solo por el segundo candidato, en vez de dar un 404 que
// nadie sabría explicar.
export function rutaDeCarta(carta) {
  const id = String(carta?.id ?? '')
  if (!id) return '/cartas'
  // Con el nombre que LEE una persona: si tenemos el español, ese
  // (tanda 335). La dirección es lo que se pulsa y lo que pesa Google,
  // y la web es española. El identificador del final es lo único que la
  // resuelve, así que el nombre de delante puede cambiar sin romper
  // ningún enlace viejo.
  const nombre = (typeof carta?.name_es === 'string' && carta.name_es.trim()) || carta?.name
  return `/carta/${aSlug(nombre)}-${id}`
}

export function aSlug(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'carta'
}

// Los identificadores que PODRÍA ser esta dirección, del más probable al
// menos. Se devuelven todos para preguntar una sola vez.
export function candidatosDeRuta(ruta) {
  const m = String(ruta ?? '').match(/^\/carta\/([^/?#]+)/)
  if (!m) return []
  const trozos = decodeURIComponent(m[1]).split('-').filter(Boolean)
  const fuera = []
  for (const cuantos of [2, 3, 4]) {
    if (trozos.length < cuantos) break
    fuera.push(trozos.slice(-cuantos).join('-'))
  }
  return fuera
}

export function urlDeImagen(imagePath, calidad = 'high') {
  if (!imagePath) return null
  return `${ASSETS}/en/${imagePath}/${calidad}.webp`
}

// ── La dirección de una colección (tanda 346) ──
//
// El trozo que se lee es el CÓDIGO de TCG Live —`/coleccion/pbl`—, que
// es el que usa la gente, el que sale en las decklists y el que enseña
// la lista de colecciones. El identificador de TCGdex (`me05`) es
// interno y con la nomenclatura asiática: PINGU vio que la etiqueta ya
// decía PBL y la dirección seguía diciendo ME05.
//
// Se queda de respaldo para los sets que no tienen código (los viejos, y
// los nuevos hasta que alguien se lo apunte), y las direcciones VIEJAS
// siguen valiendo porque quien resuelve prueba las dos columnas.
export function rutaDeColeccion(set) {
  const clave = String(set?.tcg_online_code || set?.id || '')
  if (!clave) return '/cartas'
  return `/coleccion/${encodeURIComponent(clave.toLowerCase())}`
}

export function idDeRutaDeColeccion(ruta) {
  const m = String(ruta ?? '').match(/^\/coleccion\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Lo que hay que preguntarle a la base para resolver esa dirección: son
// DOS columnas, y el filtro sale de aquí para que el navegador y el
// borde no puedan decir cosas distintas.
//
// Se limpia lo que llega: un `or=(…)` de PostgREST se parte por comas y
// paréntesis, así que una clave con uno de esos dentro no rompe la
// consulta — se queda sin él y no encuentra nada, que es lo correcto.
export function filtroDeColeccion(clave) {
  const limpia = String(clave ?? '').replace(/[^A-Za-z0-9.\-_]/g, '')
  return `id.eq.${limpia.toLowerCase()},tcg_online_code.eq.${limpia.toUpperCase()}`
}

export function urlDeLogo(logoPath) {
  if (!logoPath) return null
  return `${ASSETS}/en/${logoPath}.webp`
}
