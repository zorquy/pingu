// Los ocho tipos de energía con símbolo (711 y 714). Lo usan la Pokédex
// (el color de cada ficha) y los chips de filtro «Tipo de energía», así que
// vive aquí, sin dependencias: dos copias del mismo mapa se separan (471).
//
// La clave canónica es la inglesa —`types` se guarda así, 334—; el español
// es el de `TIPOS_ES` (js/carta-traducciones.js), que es lo que llega a un
// chip, y el respaldo de una fila vieja que lo traiga traducido. Dragón,
// Incoloro y Hada tienen símbolo desde la 748: sin él, su chip de filtro
// era la palabra metida a presión en un círculo (y el color nunca va solo,
// V1).
export const LETRA_DE_TIPO = {
  Grass: 'G', Fire: 'R', Water: 'W', Lightning: 'L', Psychic: 'P', Fighting: 'F', Darkness: 'D', Metal: 'M',
  Dragon: 'N', Colorless: 'C', Fairy: 'Y',
  Planta: 'G', Fuego: 'R', Agua: 'W', Rayo: 'L', 'Psíquico': 'P', Lucha: 'F', Oscuro: 'D',
  'Dragón': 'N', Incolora: 'C', Incoloro: 'C', Hada: 'Y',
}
export const NOMBRE_DE_LETRA = { G: 'Planta', R: 'Fuego', W: 'Agua', L: 'Rayo', P: 'Psíquico', F: 'Lucha', D: 'Oscuro', M: 'Metal', N: 'Dragón', C: 'Incolora', Y: 'Hada' }

// El símbolo en una etiqueta: `alt` vacío cuando va al lado de su nombre
// (lo dice el texto), y con el nombre cuando va solo.
export function simboloDeTipoHtml(tipo, { tam = 16, solo = false } = {}) {
  const letra = LETRA_DE_TIPO[tipo] || (NOMBRE_DE_LETRA[tipo] ? tipo : null)
  if (!letra) return ''
  return `<img class="mc-energia" src="/assets/energias/${letra}.svg" alt="${solo ? NOMBRE_DE_LETRA[letra] : ''}" width="${tam}" height="${tam}" />`
}
