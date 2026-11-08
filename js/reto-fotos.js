// UN RETO NO EMPIEZA CON UNA CARTA SIN FOTO (tanda 1111). PINGU, con el
// dorso en la carta 2 del reto #91: «si hay alguna carta sin imagen, que no
// se pueda entrar al juego».
//
// Antes de pintar el tablero se cargan las fotos del reto por su cadena de
// respaldos (la misma que las pinta). Si alguna se agota, se le pide al
// servidor que lo revise (`?revisar=1`): mira él las fotos y cambia las que
// no tengan por otras, en el día guardado para todo el mundo. Si el servidor
// dice que alguna sigue sin foto (`sinFoto`), el reto no se abre y lo dice.
//
// Quien CIERRA es el servidor y no el navegador: que una foto no cargue aquí
// puede ser la red de quien juega (un bloqueador, una CDN que su operadora no
// alcanza), y eso no es razón para cerrarle el reto. Tampoco cuenta una que
// no ha contestado a tiempo.
import { cadenaDeEscaneo } from './escaneo-carta.js'

export const TEXTO_SIN_FOTO = 'Una de las cartas de hoy no tiene foto y la estamos cambiando. Vuelve en un rato.'

// 'ok', 'falla' (toda la cadena dice que no) o 'tarde'.
export function probarCadena(cadena, ms = 6000) {
  return new Promise((fin) => {
    if (!cadena?.length) return fin('falla')
    let i = 0
    let hecho = false
    const acabar = (r) => { if (!hecho) { hecho = true; clearTimeout(reloj); fin(r) } }
    const reloj = setTimeout(() => acabar('tarde'), ms)
    const img = new Image()
    img.onload = () => acabar(img.naturalWidth > 0 ? 'ok' : 'falla')
    img.onerror = () => { i++; if (i < cadena.length) img.src = cadena[i]; else acabar('falla') }
    img.src = cadena[0]
  })
}

// Los ids de las que no tienen foto. `calidad`, la que pinta el juego: así
// lo que se carga aquí es lo que luego sale de la caché.
export async function cartasSinFoto(cartas, calidad = 'low') {
  const lista = (cartas || []).filter(Boolean)
  const r = await Promise.all(lista.map((c) => probarCadena(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, calidad))))
  return lista.filter((_, i) => r[i] === 'falla').map((c) => c.id)
}

// Cuántas de esas cadenas no dan ninguna foto. Desde la 1268 la mesa de un
// reto trae las fotos ya hechas (/reto-foto, con la dirección cifrada): cada
// una es su propia cadena de una dirección.
async function cuantasSinFoto(cadenas) {
  const r = await Promise.all((cadenas || []).map((c) => probarCadena(c)))
  return r.filter((x) => x === 'falla').length
}

// Trae el reto de `funcion` y comprueba sus fotos. Devuelve la respuesta, o
// lanza: `e.sinFoto` si sigue faltando alguna después de revisar. Las fotos
// salen de `cadenasDe(r)` (listas de direcciones) o, si no, de las cartas
// de `cartasDe(r)` por su cadena de respaldos.
export async function traerRetoConFotos(funcion, { libre = null, cartasDe, cadenasDe = null, calidad = 'low' }) {
  const faltan = async (r) => (cadenasDe ? cuantasSinFoto(cadenasDe(r)) : (await cartasSinFoto(cartasDe(r), calidad)).length)
  const pedir = async (revisar) => {
    const q = new URLSearchParams()
    if (libre) q.set('libre', libre)
    if (revisar) q.set('revisar', '1')
    // La 1111b acortó lo que el navegador guarda la respuesta del día (era
    // hasta medianoche): con otra dirección, lo guardado antes no se usa. Solo
    // el día: una libre se guarda poco y Parejas la pide antes por su dirección.
    // Y la 1268 cambió lo que contesta (la mesa, sin respuestas): la v=3.
    if (!libre) q.set('v', '3')
    const res = await fetch(`/.netlify/functions/${funcion}${q.toString() ? `?${q}` : ''}`, { headers: { accept: 'application/json' }, ...(revisar ? { cache: 'no-store' } : {}) })
    const r = await res.json()
    if (!res.ok || r.error) throw new Error(r.error || `HTTP ${res.status}`)
    return r
  }
  const r = await pedir(false)
  if (!(await faltan(r))) return r
  const revisado = await pedir(true)
  if (!revisado.sinFoto?.length) return revisado
  const e = new Error('sin foto')
  e.sinFoto = true
  throw e
}
