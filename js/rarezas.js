// Las rarezas, con el nombre OFICIAL en español y su marca (tanda 463).
//
// PINGU mandó la tabla de rarezas de la web oficial de Pokémon en español,
// con sus dibujos: «te voy a pasar las imágenes de la web oficial para que
// lo veas, y con sus iconos».
//
// ── DOS COSAS QUE ARREGLA, Y UNA NO ES COSMÉTICA ──
//
// 1. El NOMBRE. Nosotros decíamos «Doble rara», «Ultra rara», «Ilustración
//    rara»; el oficial es «Rara Doble», «Rara Ultra», «Rara Ilustración».
//    No es gusto: **es el mismo nombre que devuelve TCGdex cuando se le
//    pide en español**, que es como está guardada media base. Mientras no
//    coincidieran, un filtro de rareza mandaba a la consulta la clave
//    inglesa y NUESTRA palabra, y las filas guardadas con la palabra de
//    TCGdex se quedaban fuera — el filtro enseñaba la mitad sin que nada
//    lo dijera. Coincidir arregla el filtro, no solo el rótulo.
//
// 2. La MARCA. Una rareza se reconoce por su dibujo antes que por su
//    nombre: un círculo, un diamante, una estrella, dos estrellas. Y es lo
//    que lleva impreso la carta en la esquina, así que es la forma de
//    comprobar que lo que dice la web es lo que tienes en la mano.
//
// Sin DOM y sin Supabase: se prueba en Node.

// De cómo lo llama TCGdex EN INGLÉS a cómo se llama en español oficial.
export const RAREZAS_ES = {
  Common: 'Común',
  Uncommon: 'Infrecuente',
  Rare: 'Rara',
  'Rare Holo': 'Rara Holo',
  'Double rare': 'Rara Doble',
  'Ultra Rare': 'Rara Ultra',
  'Illustration rare': 'Rara Ilustración',
  'Special illustration rare': 'Rara Ilustración Especial',
  'Hyper rare': 'Rara Híper',
  'Shiny rare': 'Rara Brillante',
  'Shiny Ultra Rare': 'Rara Brillante Ultra',
  'Amazing Rare': 'Rara Asombrosa',
  'Radiant Rare': 'Rara Radiante',
  'ACE SPEC Rare': 'Rara ACE SPEC',
  'Mega attack rare': 'Rara Ataque Mega',
  'Mega hyper rare': 'Rara Híper Mega',
  Promo: 'Promo',
  None: 'Sin rareza',
}

// ── LO MISMO, ESCRITO DE OTRA MANERA ──
//
// El catálogo se ha importado en varios idiomas y la misma rareza está
// guardada con la palabra de cada uno. Aquí van TODAS las formas que se
// han visto, y la primera de cada lista es la canónica.
//
// Esto NO es una lista de cortesía: es lo que se manda a la consulta. Un
// filtro que solo mande una de las formas enseña la mitad de las cartas y
// **no da ningún error** — la lección de la tanda 455, que es cuando
// salieron «Ninguno» y «None» como dos chips distintos.
const OTRAS_FORMAS = {
  Común: ['Common'],
  Infrecuente: ['Uncommon', 'Poco común', 'Poco Común'],
  Rara: ['Rare'],
  'Rara Holo': ['Rare Holo', 'Rara holo'],
  'Rara Doble': ['Double rare', 'Doble rara'],
  'Rara Ultra': ['Ultra Rare', 'Ultra rara'],
  'Rara Ilustración': ['Illustration rare', 'Ilustración rara'],
  'Rara Ilustración Especial': ['Special illustration rare', 'Ilustración especial rara'],
  'Rara Híper': ['Hyper rare', 'Hiperrara', 'Rara Secreta'],
  'Rara Brillante': ['Shiny rare', 'Variocolor rara'],
  'Rara Asombrosa': ['Amazing Rare'],
  'Rara Radiante': ['Radiant Rare'],
  'Rara ACE SPEC': ['ACE SPEC Rare', 'ACE SPEC'],
  'Rara Brillante Ultra': ['Shiny Ultra Rare'],
  // Las dos de Megaevolución, de la tabla oficial que mandó PINGU: la
  // Híper Mega es un diamante dorado y la Ataque Mega, dos estrellas rosa
  // y verde. Las trae el catálogo desde los sets de 2026.
  'Rara Ataque Mega': ['Mega attack rare'],
  'Rara Híper Mega': ['Mega hyper rare'],
  'Sin rareza': ['None', 'Ninguno'],
}

// De cualquier forma escrita a la canónica, en un solo mapa.
const CANONICA = new Map()
for (const [es, otras] of Object.entries(OTRAS_FORMAS)) {
  CANONICA.set(es, es)
  for (const o of otras) CANONICA.set(o, es)
}
for (const [en, es] of Object.entries(RAREZAS_ES)) if (!CANONICA.has(en)) CANONICA.set(en, es)

// El nombre oficial en español de una rareza, venga como venga escrita.
// Lo que no conocemos se devuelve TAL CUAL y no como «Sin rareza»: una
// rareza nueva es un dato, no un hueco.
export function rarezaEs(valor) {
  if (!valor) return null
  return CANONICA.get(valor) || String(valor)
}

// Todas las formas con las que esa rareza puede estar guardada, para
// mandárselas a la consulta. Entra cualquiera de ellas.
export function formasDeRareza(valor) {
  const es = rarezaEs(valor)
  if (!es) return []
  const todas = new Set([String(valor), es, ...(OTRAS_FORMAS[es] || [])])
  return [...todas]
}

// ── LAS MARCAS ──
//
// Cuatro formas, que es lo que hay de verdad impreso en una carta:
// círculo, diamante, una estrella y dos. Y cuatro acabados: negro (las
// tres de sobre), tornasol (holo y ultra), oro (ilustración e híper) y
// rosa-y-verde (ataque mega y brillante).
//
// El COLOR va en el CSS y no aquí (`currentColor` y un `data-acabado`):
// la marca vive dentro de un chip que en el tema oscuro tiene la letra
// clara, y un negro a fuego desaparecería contra su propio fondo —la
// lección de la 315—. Las dos estrellas de «ataque mega» son de dos
// colores distintos, así que llevan clase cada una: es la única de las
// cuatro que no se puede pintar con un solo color.
const ESTRELLA = 'M12 3.2 14.2 8.9 20.3 9.3 15.6 13.2 17.1 19.2 12 15.9 6.9 19.2 8.4 13.2 3.7 9.3 9.8 8.9Z'
const ESTRELLA_IZQ = 'M7 4.5 8.6 8.6 13 8.9 9.6 11.7 10.7 16 7 13.6 3.3 16 4.4 11.7 1 8.9 5.4 8.6Z'
const ESTRELLA_DER = 'M17 4.5 18.6 8.6 23 8.9 19.6 11.7 20.7 16 17 13.6 13.3 16 14.4 11.7 11 8.9 15.4 8.6Z'
const CIRCULO = '<circle cx="12" cy="12" r="5.6" />'
const DIAMANTE = '<path d="M12 5.2 18.8 12 12 18.8 5.2 12Z" />'
const UNA = `<path d="${ESTRELLA}" />`
const DOS = `<path class="uno" d="${ESTRELLA_IZQ}" /><path class="dos" d="${ESTRELLA_DER}" />`

const MARCAS = {
  Común: { forma: CIRCULO, acabado: 'negro' },
  Infrecuente: { forma: DIAMANTE, acabado: 'negro' },
  Rara: { forma: UNA, acabado: 'negro' },
  'Rara Holo': { forma: UNA, acabado: 'holo' },
  'Rara Doble': { forma: DOS, acabado: 'negro' },
  'Rara Ultra': { forma: DOS, acabado: 'holo' },
  'Rara Ilustración': { forma: UNA, acabado: 'oro' },
  'Rara Ilustración Especial': { forma: DOS, acabado: 'oro' },
  'Rara Híper': { forma: DIAMANTE, acabado: 'oro' },
  'Rara Híper Mega': { forma: DIAMANTE, acabado: 'oro' },
  'Rara Ataque Mega': { forma: DOS, acabado: 'mega' },
  'Rara Brillante': { forma: UNA, acabado: 'mega' },
  'Rara Brillante Ultra': { forma: DOS, acabado: 'mega' },
  'Rara Radiante': { forma: UNA, acabado: 'holo' },
  'Rara Asombrosa': { forma: UNA, acabado: 'holo' },
  'Rara ACE SPEC': { forma: UNA, acabado: 'oro' },
}

// La marca de una rareza, o cadena vacía si no le toca ninguna. El vacío
// es una RESPUESTA y no un olvido: una promo no lleva marca de rareza
// impresa, y dibujarle una estrella sería decir que es rara.
export function marcaDeRarezaHtml(valor, { clase = 'rareza-marca' } = {}) {
  const m = MARCAS[rarezaEs(valor)]
  if (!m) return ''
  return (
    `<span class="${clase}" data-acabado="${m.acabado}" aria-hidden="true">` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${m.forma}</svg>` +
    '</span>'
  )
}

// Para pruebas y para quien quiera recorrerlas.
export { OTRAS_FORMAS, MARCAS }
