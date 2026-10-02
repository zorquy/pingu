// Leer una carta de dos franjas de foto (tanda 447).
//
// QUÉ RECIBE. Dos recortes en JPEG, no una foto: la banda del NOMBRE Y
// TIPO de arriba y la del CÓDIGO E ILUSTRADOR de abajo. El recorte lo hace
// el navegador (js/mi-coleccion/escaner.js) por dos motivos, y los dos
// importan: una foto de cámara son dos o tres megas para leer cuatro
// palabras, y el dibujo de la carta es justo donde un OCR se inventa
// texto.
//
// POR QUÉ ESTO VIVE EN EL SERVIDOR Y NO EN EL NAVEGADOR. Dex lee en tiempo
// real porque es una app NATIVA y usa el OCR del propio iPhone (el
// framework Vision de Apple; la lista de idiomas de su pantalla es
// literalmente la de Vision). Una web no tiene eso: el equivalente del
// navegador —la Shape Detection API— solo funciona en Chrome tras una
// bandera, y en Safari de iOS dejó de funcionar en iOS 18. La otra opción
// era una librería de OCR en el cliente, y CLAUDE.md prohíbe dependencias
// nuevas de npm para el cliente (son además un par de megas). Así que se
// lee aquí, UNA VEZ POR CARTA y no por fotograma, que es lo que hace que
// quepa en un plan gratuito.
//
// QUÉ PROVEEDOR. OCR.space, y no es un gusto: tiene plan gratuito de
// verdad (25.000 peticiones al mes, 500 al día por IP), acepta la imagen
// en base64 tal cual la manda el navegador, no necesita SDK ninguno —es
// un POST de formulario— y lee los siete idiomas de carta que hay en la
// pantalla, japonés y chino incluidos. Si algún día se cambia, lo único
// que hay que reescribir es `leerFranja`: la FORMA de la respuesta que
// espera el navegador está ahí abajo y no depende del proveedor.
//
// SIN CLAVE NO FUNCIONA, Y LO DICE. Mientras no haya `OCR_API_KEY` en
// Netlify, esto devuelve 503 con un mensaje que explica qué falta. Es a
// propósito: un escáner que no contesta nada es indistinguible de uno
// roto, y quien lo pruebe tiene que saber si el problema es su carta, su
// cámara o que esto no está montado todavía.

const LIMITE = 900 * 1024 // dos franjas en JPEG caben de sobra
const OCR_URL = 'https://api.ocr.space/parse/image'

// El idioma de la CARTA (el de la pantalla del escáner) al código del
// proveedor. Y el MOTOR va aquí al lado a propósito: el motor 2 lee mejor
// el alfabeto latino pero NO sabe japonés ni chino —se los salta sin dar
// error, devolviendo texto vacío—, así que esos dos van por el motor 1,
// que sí los tiene.
const IDIOMAS = {
  es: { lang: 'spa', motor: 2 },
  en: { lang: 'eng', motor: 2 },
  ja: { lang: 'jpn', motor: 1 },
  zh: { lang: 'chs', motor: 1 },
  de: { lang: 'ger', motor: 2 },
  fr: { lang: 'fre', motor: 2 },
  it: { lang: 'ita', motor: 2 },
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Solo POST.' }, 405)

  let cuerpo
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'No he podido leer la petición.' }, 400)
  }
  const { estado, datos } = await leerCarta(cuerpo, { clave: process.env.OCR_API_KEY })
  return json(datos, estado)
}

// El trabajo, suelto del envoltorio HTTP y con la clave y el `fetch`
// inyectados: es el patrón de las demás funciones del repo
// (`escaneo.mjs`, `cartas-detalle`), y aquí hace falta de verdad porque lo
// único que se puede probar sin gastar peticiones de verdad contra el
// proveedor es esto.
export async function leerCarta(cuerpo, { clave, fetchImpl = fetch } = {}) {
  const { nombre, codigo, idioma } = cuerpo || {}
  if (!esRecorte(nombre) || !esRecorte(codigo)) {
    return { estado: 400, datos: { error: 'Faltan los dos recortes de la carta.' } }
  }
  // Un tope de tamaño, que esto recibe imágenes de fuera: sin él,
  // cualquiera puede mandar veinte megas y pagarlos nosotros. Y el plan
  // gratuito corta a 1 MB por imagen, así que pasarse no daría un error
  // nuestro sino uno ajeno, más difícil de leer.
  if (nombre.length + codigo.length > LIMITE) {
    return { estado: 413, datos: { error: 'Los recortes son demasiado grandes.' } }
  }

  if (!clave) {
    return {
      estado: 503,
      datos: {
        error: 'El lector de cartas no está configurado todavía.',
        detalle: 'Falta la variable OCR_API_KEY en Netlify.',
        sinConfigurar: true,
      },
    }
  }

  const cfg = IDIOMAS[String(idioma || 'es')] || IDIOMAS.es

  // LAS DOS FRANJAS A LA VEZ. En serie serían dos esperas sumadas, y una
  // función de Netlify se mata a los 10 segundos: con dos lecturas de
  // cuatro segundos cada una, ir en serie es jugársela por nada.
  let leidas
  try {
    leidas = await Promise.all([
      leerFranja(nombre, cfg, clave, { fetchImpl }),
      leerFranja(codigo, cfg, clave, { fetchImpl }),
    ])
  } catch (err) {
    // Que el proveedor falle no es que la carta esté mal encuadrada, y el
    // mensaje tiene que distinguirlo: si no, la gente repite la foto
    // veinte veces contra un servicio caído.
    return { estado: 502, datos: { error: 'El lector de cartas no contesta. Inténtalo en un rato.', detalle: String(err?.message || err) } }
  }

  // LA FORMA DE LA RESPUESTA, que es lo que el navegador sabe leer. El
  // cruce con `tcg_cards` NO se hace aquí: lo hace el buscador que ya
  // existe, con el nombre, y el número de la franja de abajo afina. De
  // esas dos franjas salen cuatro señales —nombre, tipo, código de
  // colección e ilustrador— y con que acierte dos, la carta se resuelve.
  return { estado: 200, datos: { textos: { nombre: leidas[0], codigo: leidas[1] }, idioma: String(idioma || 'es') } }
}

// Una franja, leída. Devuelve SIEMPRE una cadena —vacía si no se ha
// sacado nada—: quien la usa decide qué hacer con el vacío, y un null por
// medio solo añade un caso más.
async function leerFranja(dataUrl, cfg, clave, { fetchImpl = fetch } = {}) {
  const form = new URLSearchParams()
  form.set('base64Image', dataUrl)
  form.set('language', cfg.lang)
  form.set('OCREngine', String(cfg.motor))
  // Sin la retícula de palabras: solo hace falta el texto, y pedirla
  // multiplica por diez el tamaño de la respuesta.
  form.set('isOverlayRequired', 'false')
  // La franja llega estrecha y pequeña; `scale` le dice al proveedor que
  // la agrande antes de leerla, que es justo para lo que existe.
  form.set('scale', 'true')
  // Una franja es UNA línea de texto. Decírselo evita que parta el nombre
  // en dos renglones al leer el borde de la carta.
  form.set('detectOrientation', 'false')

  const res = await fetchImpl(OCR_URL, {
    method: 'POST',
    headers: { apikey: clave, 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    // La mitad del presupuesto de la función para cada franja, y van en
    // paralelo: así una franja atascada no se lleva la otra por delante.
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`OCR ${res.status}`)
  const datos = await res.json()
  if (datos?.IsErroredOnProcessing) {
    throw new Error([].concat(datos.ErrorMessage || 'error del OCR').join(' '))
  }
  const crudo = datos?.ParsedResults?.[0]?.ParsedText || ''
  return limpiar(crudo)
}

// El texto del OCR llega con saltos de línea, retornos de carro y espacios
// dobles. Se aplana a una línea: lo que viene detrás —el buscador y el
// número— trabaja con una cadena, no con un párrafo.
function limpiar(texto) {
  return String(texto).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function esRecorte(v) {
  return typeof v === 'string' && v.startsWith('data:image/jpeg;base64,') && v.length > 128
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export { leerFranja, limpiar, esRecorte, IDIOMAS, LIMITE }
