// El dibujo oficial de un Pokémon (1217): el que llevan las portadas de guía,
// la palabra del día del Glosario y las destacadas de Novedades. Aparte de
// js/guia-portada.js para que quien solo quiere el dibujo no arrastre las
// clases de la portada (la 299 lo cuenta). Puro.
const ARTE = 'sprites/pokemon/other/official-artwork'
const POKEMON = [6, 4, 282, 65, 197, 887, 249, 445, 448, 658, 133, 25, 384, 94, 1, 7, 151]

// Uno de la lista por la clave (el slug, el id): siempre el mismo.
export function pokemonDe(clave) {
  let h = 0
  for (const ch of String(clave || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return POKEMON[h % POKEMON.length]
}

// Desde jsDelivr y, si no contesta, GitHub a pelo (321); sin las dos, el color.
export function artePokemonHtml(dex, clase) {
  return `<img class="${clase}" src="https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/${ARTE}/${dex}.png" alt="" width="240" height="240" loading="lazy" decoding="async" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/${ARTE}/${dex}.png'}else{this.remove()}" />`
}
