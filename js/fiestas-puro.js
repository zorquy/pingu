// LAS FIESTAS, lo puro (tanda 1286). Qué fiestas tienen decoración (para el
// interruptor de Ajustes) y lo de la Navidad que no toca el documento: cuándo
// toca el regalo de Delibird y qué Pokémon pueden salir. Sin dependencias: lo
// prueba Node. El calendario de cada página (qué día es qué) vive en
// generar-temporada.mjs, que es la línea de la cabecera.
import { hoyEnEspana } from './adviento-puro.js'

// Las que se pueden quitar con «Quitar la decoración» (`pd-sin-<fiesta>`).
// Una fiesta nueva con hoja propia entra aquí.
export const FIESTAS_CON_DECORACION = ['halloween', 'navidad', 'inocentes']

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

// ── Inocentes (1287): todo Ditto el 28 de diciembre ──
// Un sprite o dibujo de Pokémon se reconoce por su DIRECCIÓN: Limitless (los
// sprites de mazos), PokeAPI (sprites y dibujos oficiales) y nuestra /sprite.
// Las fotos de cartas van por otros sitios (TCGdex, TCGGO, el escaneo de
// Limitless), así que no se tocan: la broma no cambia una carta ni un precio.
const LIMITLESS = 'https://r2.limitlesstcg.net/pokemon/gen9'
const POKEAPI = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'
export const DITTO = {
  sprite: `${LIMITLESS}/ditto.png`,
  pixel: `${POKEAPI}/132.png`,
  arte: `${POKEAPI}/other/official-artwork/132.png`,
}
const ES_POKEMON = /r2\.limitlesstcg\.net\/pokemon\/|PokeAPI\/sprites|^\/sprite\/|\/\/[^/]+\/sprite\//i

export const esPokemon = (src) => ES_POKEMON.test(String(src || ''))

// El Ditto que va en su lugar, del mismo estilo y tamaño: un dibujo oficial
// por otro, un sprite por otro. null si no es un Pokémon (o ya es Ditto).
export function dittoDe(src) {
  if (!esPokemon(src) || Object.values(DITTO).includes(src)) return null
  if (/official-artwork|other\/home/.test(src)) return DITTO.arte
  if (/PokeAPI\/sprites/i.test(src)) return DITTO.pixel
  return DITTO.sprite
}
