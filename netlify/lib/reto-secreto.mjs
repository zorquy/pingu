// Lo SECRETO de los retos (tanda 1268, PINGU: «para que ningún listillo haga
// trampa»). Dos cosas que el navegador no puede saber:
//
// 1. LA SEMILLA DEL DÍA. Hasta la 1267 el reto del día salía de la fecha con
//    el generador de js/carta-del-dia.js, que está en la página: contando las
//    cartas elegibles por la API pública y repitiendo la cuenta, cualquiera
//    sacaba la carta de hoy sin jugar (y el sitio de la buena entre las
//    opciones de «¿De qué expansión es?», y el Pokémon de la silueta). Ahora
//    a la fecha se le suma un número que sale de la clave de servicio, que
//    solo tiene Netlify. Sigue siendo determinista —dos funciones que eligen
//    a la vez eligen lo mismo—, pero ya no se puede repetir desde fuera.
//
// 2. LAS FOTOS. La foto de un reto no puede llevar en su dirección de qué
//    carta es (la de TCGdex dice el set y el número, y la de PokeAPI el
//    número de la Pokédex), ni puede ser la foto nítida con un desenfoque de
//    CSS encima: arrastrándola o abriéndola en otra pestaña salía entera
//    (PINGU lo vio en «¿Qué carta es?»). Así que la sirve /reto-foto, ya
//    borrosa o en silueta, desde una dirección CIFRADA: de dónde sale y qué
//    se le hace va dentro y solo esta función sabe leerlo. El cifrado es
//    determinista (el vector sale de un HMAC de lo cifrado) para que la misma
//    foto tenga la misma dirección y la guarde la CDN para todo el mundo.
import { createHash, createHmac, createCipheriv, createDecipheriv } from 'node:crypto'

const llaveDe = (clave) => createHash('sha256').update(`pokedoc-retos-1268:${clave}`).digest()

// Un número de 0 a 16.777.215 por día, que sin la clave no se adivina.
export function semillaDelDia(dia, clave) {
  if (!clave) return 0
  return parseInt(createHmac('sha256', llaveDe(clave)).update(`semilla:${dia}`).digest('hex').slice(0, 6), 16)
}

const aB64 = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export function sellar(obj, clave) {
  const llave = llaveDe(clave)
  const claro = Buffer.from(JSON.stringify(obj))
  const iv = createHmac('sha256', llave).update(claro).digest().subarray(0, 12)
  const c = createCipheriv('aes-256-gcm', llave, iv)
  const cifrado = Buffer.concat([c.update(claro), c.final()])
  return aB64(Buffer.concat([iv, c.getAuthTag(), cifrado]))
}

export function abrir(token, clave) {
  try {
    const b = deB64(token)
    if (b.length < 29) return null
    const d = createDecipheriv('aes-256-gcm', llaveDe(clave), b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'))
  } catch {
    return null
  }
}

// La dirección de una foto del reto: `u` son las direcciones de donde
// sacarla (la cadena de respaldos), `e` lo que se le hace (`{ d: px }`
// desenfoque, `{ s: nivel }` silueta; nada, la foto tal cual).
export const urlDeFoto = (spec, clave) => `/.netlify/functions/reto-foto?f=${sellar(spec, clave)}`
