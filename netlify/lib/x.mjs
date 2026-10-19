// Publicar en la cuenta de PokeDoc en X (tanda 902).
//
// Vive aquí, y no dentro de la función programada, porque lo usan DOS:
// x-noticias (cada cinco minutos, sola) y x-mandar (el botón del panel,
// cuando PINGU empuja una noticia a mano). El texto tiene que ser el
// mismo por los dos caminos, y además el mismo que el del botón
// «Compartir en X» de la propia noticia (js/compartir-x.js, 880): lo que
// publica la cuenta y lo que comparte la gente es idéntico.
//
// ── POR QUÉ SIN SUBIR IMAGEN ──
//
// X pinta la tarjeta con la portada ÉL SOLO a partir de las etiquetas
// `twitter:card` que ya escribe cada página (meta-social.js). Subir la
// imagen aparte es otra petición, otro punto de fallo y, en el plan de
// pago por uso, otro cargo. El enlace va aparte del texto: así X lo
// cuenta como enlace (23 letras, se escriba como se escriba) y le pinta
// la tarjeta.
//
// ── LA FIRMA (OAuth 1.0a) ──
//
// La API v2 de X admite publicar en nombre de una cuenta con las cuatro
// claves de «user context» de la app (API key, API secret, Access token,
// Access secret), firmando cada petición con HMAC-SHA1. Es la única forma
// que no caduca: el OAuth 2.0 de usuario da tokens de dos horas que hay
// que ir renovando y guardando, y una función programada que depende de
// un token guardado se muere el día que la renovación falla.
//
// Se firma a mano con `node:crypto` porque aquí no entran dependencias
// nuevas: la firma son veinte líneas y está probada contra el ejemplo
// oficial de la documentación de X (test-tanda-902). Para una petición
// con cuerpo JSON, en la firma entran SOLO los parámetros oauth_* y los
// de la consulta —el cuerpo no—, que es lo que dice la RFC 5849 para
// cualquier cuerpo que no sea un formulario.
//
// ── LAS LLAVES ──
//
// X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN y X_ACCESS_SECRET son variables
// de entorno de Netlify. NO van en el repo, nunca. Sin ellas no se
// publica nada y se dice cuáles faltan, igual que con Telegram.

import { createHmac, randomBytes } from 'node:crypto'
import { textoParaX } from '../../js/compartir-x.js'

export const SITIO = 'https://pokedoc.es'
export const CUENTA = '@pokedoc_es'
export const PUBLICAR_URL = 'https://api.x.com/2/tweets'

export const LLAVES = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET']

export function llavesQueFaltan(env = process.env) {
  return LLAVES.filter((k) => !String(env[k] || '').trim())
}

// Recortadas: un espacio o un salto de línea pegado con la clave en
// Netlify da un 401 que no dice nada, y no se ve en la pantalla de las
// variables. Unas comillas alrededor, lo mismo.
const limpia = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '')

export function clavesDe(env = process.env) {
  return {
    apiKey: limpia(env.X_API_KEY),
    apiSecret: limpia(env.X_API_SECRET),
    accessToken: limpia(env.X_ACCESS_TOKEN),
    accessSecret: limpia(env.X_ACCESS_SECRET),
  }
}

// El escape que pide OAuth (RFC 3986): `encodeURIComponent` deja pasar
// `!'()*`, y una firma con uno de esos sin escapar no casa con la que
// calcula X. Pasó con el ejemplo oficial, que lleva un «!».
export const escaparOAuth = (s) =>
  encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// La cabecera `Authorization` firmada para una petición.
//
// `parametros` son los de la consulta (y los de un cuerpo de formulario,
// que aquí no usamos). `nonce` y `timestamp` se inyectan para poder
// comprobar la firma contra un valor conocido.
export function cabeceraOAuth({ metodo, url, parametros = {}, claves, nonce, timestamp }) {
  const oauth = {
    oauth_consumer_key: claves.apiKey,
    oauth_nonce: nonce || randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
    oauth_token: claves.accessToken,
    oauth_version: '1.0',
  }
  // Todos los parámetros, escapados, ordenados por clave (y por valor si
  // la clave se repite), unidos con `&`.
  const todos = Object.entries({ ...parametros, ...oauth })
    .map(([k, v]) => [escaparOAuth(k), escaparOAuth(v)])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const base = `${String(metodo).toUpperCase()}&${escaparOAuth(url)}&${escaparOAuth(todos)}`
  const llave = `${escaparOAuth(claves.apiSecret)}&${escaparOAuth(claves.accessSecret)}`
  const firma = createHmac('sha1', llave).update(base).digest('base64')
  const campos = { ...oauth, oauth_signature: firma }
  return `OAuth ${Object.keys(campos)
    .sort()
    .map((k) => `${escaparOAuth(k)}="${escaparOAuth(campos[k])}"`)
    .join(', ')}`
}

// El texto de una noticia: el del botón de compartir, con el enlace al
// final en su línea. X lo cuenta como enlace y pinta la tarjeta.
export function textoDeNoticia({ title, description, slug }) {
  const url = `${SITIO}/noticias/${encodeURIComponent(slug || '')}`
  return `${textoParaX({ titulo: title, descripcion: description })}\n\n${url}`
}

// Si un fallo de X se arregla solo reintentando o no.
//
// Un 401 o un 403 son las claves (mal copiadas, sin permiso de escritura,
// app suspendida): reintentar cada cinco minutos es insistir en lo mismo,
// así que se PARA y lo quita una persona. Un 402 es el plan (sin crédito)
// y también para. Un 429 es «demasiado deprisa» y se espera; un 5xx es
// cosa suya y se reintenta.
export function esFalloDefinitivo(estado) {
  return estado === 401 || estado === 402 || estado === 403
}

// Publicar un texto. Devuelve { ok, id } o { ok: false, estado, error,
// definitivo }. Nunca lanza: quien llama decide qué hacer con el fallo.
export async function publicarEnX(texto, { claves, fetchImpl = fetch } = {}) {
  const cabecera = cabeceraOAuth({ metodo: 'POST', url: PUBLICAR_URL, claves })
  let res
  try {
    res = await fetchImpl(PUBLICAR_URL, {
      method: 'POST',
      headers: { authorization: cabecera, 'content-type': 'application/json' },
      body: JSON.stringify({ text: texto }),
    })
  } catch (e) {
    return { ok: false, estado: 0, error: `no se ha podido llamar a X: ${e?.message || e}`, definitivo: false }
  }
  let cuerpo = null
  try {
    cuerpo = await res.json()
  } catch {
    // Un 5xx puede venir sin JSON: el estado ya dice bastante.
  }
  if (res.ok && cuerpo?.data?.id) return { ok: true, id: cuerpo.data.id }
  // X cuenta el error de dos formas: `detail` (v2) o `errors[0].message`.
  const detalle = cuerpo?.detail || cuerpo?.errors?.[0]?.message || cuerpo?.title || `HTTP ${res.status}`
  return { ok: false, estado: res.status, error: String(detalle).slice(0, 200), definitivo: esFalloDefinitivo(res.status) }
}
