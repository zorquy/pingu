// LAS FOTOS DE LOS RETOS (tanda 1111). PINGU, con el reto #91 de «¿De qué
// expansión es?» enseñando el DORSO en la carta 2: «si hay alguna carta sin
// imagen, que no se pueda entrar al juego… la gente se va a quejar».
//
// Elegir «con foto» miraba si había una COLUMNA de foto (`image_path`,
// `image_tcggo`…), y una columna llena no es una foto que exista: la del
// XY Trainer Kit apuntaba a ficheros que no están en ninguna CDN, la cadena
// de respaldos se agotaba y quedaba el dorso. Aquí se PREGUNTA a la cadena
// de verdad, la misma que pinta la web (`cadenaDeEscaneo`), antes de dar una
// carta por buena.
//
// Tres respuestas, como siempre que se pregunta fuera (la 319): `true` hay
// foto, `false` todas las direcciones han dicho que no, `null` no se sabe
// (no contestaron a tiempo). Solo un `false` deja una carta fuera: una CDN
// lenta no puede vaciar el reto.
import { cadenaDeEscaneo } from '../../js/escaneo-carta.js'

const NO_ES_UN_NO = [403, 405, 501]

// ¿Esa dirección da una imagen? HEAD primero (no baja nada); las CDN que no
// lo aceptan contestan 403/405 y se prueban con un GET del primer byte.
export async function urlContesta(url, ms = 3000) {
  for (const metodo of ['HEAD', 'GET']) {
    let res
    try {
      res = await fetch(url, { method: metodo, redirect: 'follow', signal: AbortSignal.timeout(ms), headers: metodo === 'GET' ? { range: 'bytes=0-0' } : {} })
    } catch {
      return null
    }
    try { await res.body?.cancel?.() } catch {}
    // Una página que contesta 200 con HTML («no encontrado» bonito) no es una foto.
    if (res.ok) return !/^text\//i.test(res.headers.get('content-type') || '')
    if (!NO_ES_UN_NO.includes(res.status)) return false
  }
  return false
}

// UNA FOTO QUE COMPARTEN DOS CARTAS NO ES LA FOTO DE NINGUNA (1111b). El
// reto #91 siguió con el dorso después de la 1111: la dirección CONTESTABA,
// con una imagen de verdad… que era el dorso, el «sin foto» de su fuente. Un
// genérico así lo llevan muchas cartas a la vez, así que con `pedir` se
// pregunta a la base si otra carta del mismo catálogo tiene la misma
// dirección; si la tiene, esa columna no cuenta como foto.
export async function sinFotosCompartidas(carta, pedir) {
  if (!pedir || !carta?.id) return carta
  const fuera = {}
  for (const col of ['image_tcggo', 'image_path']) {
    const v = carta[col]
    if (!v) continue
    try {
      const r = await pedir(`tcg_cards?select=id&market=eq.${encodeURIComponent(carta.market || 'WEST')}&${col}=eq.${encodeURIComponent(v)}&id=neq.${encodeURIComponent(carta.id)}&limit=1`)
      if (r?.datos?.length) fuera[col] = null
    } catch {
      // Si no se puede preguntar, la columna se queda: no se sabe no es un no.
    }
  }
  return Object.keys(fuera).length ? { ...carta, ...fuera } : carta
}

// La carta tiene foto si ALGUNA dirección de su cadena la da (sin contar las
// que comparte con otras cartas, si llega `pedir`).
export async function fotoContesta(carta, { probar = urlContesta, calidad = 'high', pedir = null } = {}) {
  const propia = await sinFotosCompartidas(carta, pedir)
  const cadena = cadenaDeEscaneo(propia, propia?.tcg_sets?.tcg_online_code || null, calidad)
  if (!cadena.length) return false
  const respuestas = await Promise.all(cadena.map((u) => probar(u).catch(() => null)))
  if (respuestas.includes(true)) return true
  return respuestas.includes(null) ? null : false
}

// Las que no se sabe que NO tengan foto, en su orden. A la vez: elegir ya
// pide varias a la base, y una detrás de otra serían segundos.
export async function conFoto(cartas, opciones = {}) {
  const lista = (cartas || []).filter(Boolean)
  const r = await Promise.all(lista.map((c) => fotoContesta(c, opciones)))
  return lista.filter((_, i) => r[i] !== false)
}

// Los ids de las que seguro que NO tienen foto (para cambiarlas).
export async function sinFoto(cartas, opciones = {}) {
  const lista = (cartas || []).filter(Boolean)
  const r = await Promise.all(lista.map((c) => fotoContesta(c, opciones)))
  return lista.filter((_, i) => r[i] === false).map((c) => c.id)
}

// `?revisar=1`: el navegador ha visto una carta sin foto y pide que se mire
// otra vez (y se cambie). Solo para el reto del día; una partida libre se
// elige de nuevo cada vez.
export const revisarDePeticion = (req) => {
  try { return new URL(req.url).searchParams.get('revisar') === '1' } catch { return false }
}
export const CABECERAS_REVISADO = { 'cache-control': 'no-store' }
