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

// `js/mercados.js` no importa nada (tanda 438), asi que esto se puede
// seguir importando desde una funcion de Netlify y desde /torneo, que es
// justo de lo que trata el comentario de arriba.
import { idiomaDeMercado } from './mercados.js'

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

// EL IDIOMA DE LA CARPETA ES EL DEL MERCADO (tanda 438), no siempre `en`.
// Lo era hasta la 437 porque el catalogo era uno solo; en cuanto se pudo
// mirar el japones, cada escaneo se pedia a `/en/...` y devolvia 404. Y un
// 404 de imagen NO DA ERROR EN NINGUNA PARTE: la cadena de respaldo pasa
// al siguiente sitio, se queda sin sitios y quita la imagen, asi que la
// pantalla sale entera sin una sola foto y con pinta de estar cargando.
export function urlDeImagen(imagePath, calidad = 'high', mercado = 'WEST') {
  if (!imagePath) return null
  return `${ASSETS}/${idiomaDeMercado(mercado)}/${imagePath}/${calidad}.webp`
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
//
// OJO AL `toLowerCase()` SI /coleccion DEJA DE SER SOLO OCCIDENTAL (tanda
// 486). Baja la clave a minúsculas porque los identificadores de set del
// catálogo occidental lo son (`sv08`, `me05`) — pero **el japonés los
// nombra en MAYÚSCULAS**: TCGdex contesta `SV1a` con serie `SV`. Su API no
// distingue caja, pero `id.eq.` de Postgres sí, así que `id.eq.sv1a` no
// casaría con `SV1a` y la ficha de una colección japonesa daría un 404 sin
// que nada diera error.
//
// Hoy no pasa, y por un motivo concreto y no por suerte: `js/coleccion.js`
// lleva `const MERCADO = 'WEST'`, o sea que esta función solo resuelve
// direcciones del catálogo occidental. El día que esa línea cambie, hay que
// cambiar esta — y como un comentario que justifica un atajo caduca y nadie
// vuelve a leerlo (la lección de la 471), lo vigila `test-tanda-486.mjs`:
// si `coleccion.js` deja de ser de un solo mercado y esto sigue bajando la
// caja, la prueba se pone roja.
export function filtroDeColeccion(clave) {
  const limpia = String(clave ?? '').replace(/[^A-Za-z0-9.\-_]/g, '')
  return `id.eq.${limpia.toLowerCase()},tcg_online_code.eq.${limpia.toUpperCase()}`
}

export function urlDeLogo(logoPath, mercado = 'WEST') {
  if (!logoPath) return null
  return `${ASSETS}/${idiomaDeMercado(mercado)}/${logoPath}.webp`
}

// El logo montado a mano (tanda 434), para cuando `logo_path` está a null.
//
// Es el mismo truco que con el escaneo de una carta: TCGdex tiene ficheros
// en su CDN que su manifiesto no lista (cards-database#2362), y la ruta de
// un logo es `serie/set/logo`. Si está, se ve; si no, la cadena de la
// tarjeta pasa al símbolo y después al nombre, que es lo que hace hoy.
//
// Sin serie no hay dirección: inventarla daría una que no es.
export function urlDeLogoPorPartes(serieId, setId, mercado = 'WEST') {
  if (!serieId || !setId) return null
  if ([serieId, setId].some((v) => /[/?#\s]/.test(String(v)))) return null
  return `${ASSETS}/${idiomaDeMercado(mercado)}/${String(serieId).trim()}/${String(setId).trim()}/logo.webp`
}
