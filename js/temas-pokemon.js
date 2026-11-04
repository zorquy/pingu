// El Pokémon de cada tema de Aprender (tanda 1226, PINGU eligió la A de la
// propuesta: «un Pokémon que tenga que ver»). Antes salía de una cuenta con
// el slug (`pokemonDe`) y no significaba nada: Squirtle en «Mazos &
// estrategia», Gengar dos veces. Puro: sin red ni DOM.
//
// Manda la columna `categories.pokemon` (migración 1226, editable en /admin →
// Guías → Categorías). Hasta que exista, o si un tema no lo tiene, se elige por
// las PALABRAS del nombre (los slugs de producción no están en el repo y el
// nombre sí lo vemos). Un tema que no casa con nada no lleva Pokémon: lleva su
// icono, que es mejor que uno al azar.

import { normalizeSearch } from './texto.js'

// Los seis de la propuesta, con su porqué (se pinta debajo en el PC).
export const POKEMON_CON_SENTIDO = {
  172: { nombre: 'Pichu', porque: 'el primero de su línea' },
  52: { nombre: 'Meowth', porque: 'Día de Pago' },
  132: { nombre: 'Ditto', porque: 'se hace pasar por otro' },
  201: { nombre: 'Unown', porque: 'leer lo que pone' },
  142: { nombre: 'Aerodactyl', porque: 'un fósil' },
  65: { nombre: 'Alakazam', porque: 'CI de 5.000' },
}

// Por palabras del nombre, en este orden (la primera que case gana).
const POR_PALABRAS = [
  [/\b(primeros?|empezar|principiante)/, 172],
  [/\b(comprar|vender|venta|cambiar|precio)/, 52],
  [/\b(real|falsa|falso|falsific)/, 132],
  [/\bidentific/, 201],
  [/\b(historia|curiosidad)/, 142],
  [/\b(mazo|estrategia|competitivo)/, 65],
]

export function pokemonDelTema(c) {
  const propio = Number(c?.pokemon)
  if (Number.isInteger(propio) && propio > 0) return propio
  const nombre = normalizeSearch(`${c?.name || ''} ${c?.slug || ''}`)
  for (const [re, dex] of POR_PALABRAS) if (re.test(nombre)) return dex
  return null
}

export const porqueDelPokemon = (dex) => POKEMON_CON_SENTIDO[dex] || null
