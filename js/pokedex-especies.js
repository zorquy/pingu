// De qué Pokémon habla una carta (tanda 381).
//
// Es la pieza que hace posible la Pokédex de «Mi colección»: entras en
// Pikachu y ves TODAS sus cartas, de todas las colecciones, con cuáles
// tienes. Y no cuesta ni una petición a TCGdex — la especie sale del
// NOMBRE, que ya está en la base desde la importación.
//
// ── POR QUÉ NO SE USA `dexesDeNombre` A SECAS ──
//
// Casi vale. Saca todas las especies de un texto y ya resuelve las
// formas —«Teal Mask Ogerpon ex» cae en Ogerpon y no en dos Pokémon—,
// pero se escribió para NOMBRES DE MAZO, y ahí no hay sufijos pegados
// con guion. En un nombre de CARTA sí: «Pikachu & Zekrom-GX» daba solo
// Pikachu, porque `aplastar` se come el guion y «zekromgx» no es
// ninguna especie. Las TAG TEAM se quedaban con la mitad.
//
// La regla que lo arregla tiene que ser cuidadosa: **partir por el guion
// sin más rompe dos especies de verdad** — «Ho-Oh» (250) y «Porygon-Z»
// (474) se llaman así, con guion. Por eso se prueba SIEMPRE la palabra
// ENTERA primero, y solo si no es ninguna especie se prueba lo que hay
// antes del último guion. Ho-Oh y Porygon-Z casan enteros y no se tocan;
// Zekrom-GX no casa, y entonces sí se mira «Zekrom».
//
// No se ha tocado `dexesDeNombre`: de ella cuelga cómo se agrupan los
// mazos en /mis-partidas y en el meta, y cambiarla movería esas firmas.
// Esto es otra pregunta —«¿qué Pokémon SALE en esta carta?»— y se
// contesta aparte.
//
// Sin DOM y sin Supabase: se prueba en Node, y una función de servidor
// puede importarlo para rellenar la columna.
import { dexesDeNombre } from './torneos/arquetipos.js'
import { dexExacto, BASE_DE_FORMA, POKEMON_POR_DEX } from './torneos/sprites-pokemon.js'

// «Zekrom-GX» → «Zekrom», pero «Ho-Oh» y «Porygon-Z» se quedan como
// están. El `&` pasa a espacio para que las TAG TEAM se partan en dos
// trozos y cada uno se resuelva por su cuenta.
export function limpiarNombreDeCarta(nombre) {
  return String(nombre ?? '')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => {
      if (!palabra.includes('-')) return palabra
      // La entera manda: si ES una especie, no se toca.
      if (dexExacto(palabra)) return palabra
      const antes = palabra.slice(0, palabra.lastIndexOf('-'))
      return antes && dexExacto(antes) ? antes : palabra
    })
    .join(' ')
}

// Los números de Pokédex de las especies que salen en esta carta.
//
// Siempre la especie BASE: una Mega y una forma regional son la misma
// entrada de la Pokédex. `dexesDeNombre` devuelve el número sintético de
// la forma (20282 para Mega Gardevoir) y aquí se baja a su especie, que
// es lo que se quiere para agrupar una colección.
//
// Devuelve un array, vacío si no sale ninguno: un Entrenador o una
// Energía no tienen especie, y eso NO es un fallo — es la respuesta.
export function especiesDeCarta(nombre) {
  const dexes = dexesDeNombre(limpiarNombreDeCarta(nombre))
  const bases = dexes.map((d) => BASE_DE_FORMA.get(d) ?? d).filter((d) => d >= 1 && d <= 1025)
  return [...new Set(bases)].sort((a, b) => a - b)
}

// El nombre de una especie por su número, para pintarla.
export function especiePorDex(dex) {
  const n = Number(dex)
  return n >= 1 && n <= POKEMON_POR_DEX.length ? POKEMON_POR_DEX[n - 1] : null
}

export { POKEMON_POR_DEX }
