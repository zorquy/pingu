// Qué series del catálogo de TCGdex son el juego de cartas DE VERDAD
// (tanda 327).
//
// TCGdex sirve en la misma API el TCG de toda la vida y **Pokémon TCG
// Pocket** (serie `tcgp`), que es un juego distinto con cartas distintas
// y que aquí no pinta nada: quien busca una carta para su mazo no quiere
// encontrarse una del móvil mezclada.
//
// `fetchSets` ya las filtra AL IMPORTAR desde la tanda 233. Pero lo que
// ya está en la base se importó antes de eso, así que las páginas del
// catálogo no pueden dar por hecho que la tabla esté limpia: filtran
// otra vez AL LEER. Es la lección de la 323 — un filtro que solo corre
// en un sitio deja de correr en cuanto alguien llega por otro camino.
//
// Módulo suelto y sin dependencias para que puedan usarlo las tres
// mitades: el navegador, la función del borde y el sitemap.
export const SERIES_FUERA = ['tcgp']

// `serie_id` a null NO es motivo para echar a un set: las colecciones
// viejas de Wizards lo traen vacío y son el TCG más TCG que hay. Solo
// se va lo que está explícitamente en la lista.
export function esDelTCG(set) {
  const serie = set?.serie_id
  return !serie || !SERIES_FUERA.includes(String(serie))
}
