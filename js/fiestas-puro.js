// LAS FIESTAS, lo puro (tanda 1286). Qué fiestas tienen decoración (para el
// interruptor de Ajustes) y lo de la Navidad que no toca el documento: cuándo
// toca el regalo de Delibird y qué Pokémon pueden salir. Sin dependencias: lo
// prueba Node. El calendario de cada página (qué día es qué) vive en
// generar-temporada.mjs, que es la línea de la cabecera.
import { hoyEnEspana } from './adviento-puro.js'

// Las que se pueden quitar con «Quitar la decoración» (`pd-sin-<fiesta>`).
// Una fiesta nueva con hoja propia entra aquí.
export const FIESTAS_CON_DECORACION = ['halloween', 'navidad']

// Del 22 de diciembre al 6 de enero: la misma regla que la cabecera.
export function esNavidad(fecha = new Date()) {
  const k = (fecha.getMonth() + 1) * 100 + fecha.getDate()
  return k >= 1222 || k <= 106
}

// El regalo de Delibird sale del 25 de diciembre al 4 de enero, en España:
// el 5 y el 6 son de los Reyes.
export function regaloToca(fecha = new Date()) {
  const h = hoyEnEspana(fecha)
  return (h.mes === 12 && h.dia >= 25) || (h.mes === 1 && h.dia <= 4)
}

// La llave del regalo es de la TEMPORADA, no del año natural: el 2 de enero
// sigue siendo el regalo de la Navidad de 2026.
export function claveDeRegalo(fecha = new Date()) {
  const h = hoyEnEspana(fecha)
  return `pd-navidad-regalo-${h.mes === 1 ? h.anio - 1 : h.anio}`
}

// Lo que Delibird puede traer: su nombre en inglés (el `name` del catálogo,
// que es la clave) y su número de Pokédex (el dibujo si no hay carta).
export const REGALOS = [
  ['Delibird', 225],
  ['Snorunt', 361],
  ['Glaceon', 471],
  ['Lapras', 131],
  ['Articuno', 144],
  ['Cetitan', 975],
  ['Froslass', 478],
  ['Stantler', 234],
  ['Snom', 872],
  ['Frosmoth', 873],
  ['Eiscue', 875],
  ['Cubchoo', 613],
  ['Spheal', 363],
  ['Vanillite', 582],
  ['Regice', 378],
  ['Mamoswine', 473],
  ['Chingling', 433],
  ['Alolan Vulpix', 37],
]

export const elegir = (lista, azar = Math.random()) => lista[Math.floor(azar * lista.length) % lista.length]

// Una carta para regalar: de las que tienen foto, la que diga el azar.
export function cartaDeRegalo(filas, azar = Math.random()) {
  const con = (filas || []).filter((c) => c?.image_path || c?.image_tcggo)
  return con.length ? elegir(con, azar) : null
}
