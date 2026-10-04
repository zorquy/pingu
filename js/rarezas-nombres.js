// Los NOMBRES de las rarezas, sin una sola etiqueta (tanda 510).
//
// Esto vivía dentro de `js/rarezas.js`, junto al dibujo de la marca. Y el
// dibujo escribe las clases «uno» y «dos» —aquí no se escriben con su
// atributo entero A PROPÓSITO: el barrido las buscaría también DENTRO DE
// ESTE COMENTARIO y volvería a marcar la dependencia que esta mudanza
// quita, que es justo lo que pasó al escribirlo la primera vez—, y viven en
// `css/carta-holo.css` — así que en cuanto /admin importó el módulo para
// traducir una rareza en un informe, el barrido de la 299 se puso rojo: la
// página «usa» esas clases por importar quien las pinta, aunque no pinte
// ninguna. Es exactamente la trampa de la tanda 316, y la salida es la que
// lleva escrita la casa desde la 471: **mudar lo puro a un fichero sin
// dependencias** y que lo importen los dos lados.
//
// `js/rarezas.js` lo reexporta, así que nada de lo que ya lo importaba de
// allí se entera.

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

// ── EL VOCABULARIO DE SCRYDEX (tanda 509) ──
//
// PINGU, mirando Lost Thunder: «las Rainbow se guardan como híper rara,
// pero realmente no. Esa rareza es Rare Rainbow. Necesitamos que las
// rarezas sean muy exactas».
//
// Y tiene razón: **TCGdex COLAPSA esa rareza**. Le llama «Hyper rare» a la
// arcoíris y a la dorada, que son dos cosas distintas y se distinguen a un
// metro. Scrydex las separa, y por eso su inglés va a `rarity_en`.
//
// Aquí solo están las que se saben con seguridad. Lo que no esté se enseña
// **en inglés tal cual**, que es lo que ya hace `rarezaEs` — y es a
// propósito: una rareza nueva es un dato, pero una traducción inventada es
// una etiqueta que miente, y eso es peor que el inglés. La función
// programada apunta las que va viendo (`rarezasVistas`), así que la lista
// se completa con lo que de verdad hay y no con lo que me imagino.
const RAREZAS_SCRYDEX = {
  'Rare Rainbow': 'Rara Arcoíris',
  'Rare Secret': 'Rara Secreta',
  'Rare Shiny': 'Rara Brillante',
  // Y «Shiny Rare», con las dos palabras al revés (tanda 527). No es una
  // suposición: salió en el informe de /admin con 10 cartas detrás, que es
  // justo para lo que existe ese informe. Las dos formas conviven en su
  // catálogo, así que se quedan las dos.
  'Shiny Rare': 'Rara Brillante',
  'Rare Ultra': 'Rara Ultra',
  'Double Rare': 'Rara Doble',
  'Illustration Rare': 'Rara Ilustración',
  'Special Illustration Rare': 'Rara Ilustración Especial',
  'Hyper Rare': 'Rara Híper',
  'Amazing Rare': 'Rara Asombrosa',
  'Radiant Rare': 'Rara Radiante',
  'ACE SPEC Rare': 'Rara ACE SPEC',
  // El sufijo es el nombre del mecanismo y no se traduce en español
  // tampoco, así que estas son transparentes y no hay nada que inventar.
  'Rare Holo EX': 'Rara Holo EX',
  'Rare Holo GX': 'Rara Holo GX',
  'Rare Holo V': 'Rara Holo V',
  'Rare Holo VMAX': 'Rara Holo VMAX',
  'Rare Holo VSTAR': 'Rara Holo VSTAR',
  'Rare Holo LV.X': 'Rara Holo LV.X',
  'Rare BREAK': 'Rara BREAK',
  'Rare Prime': 'Rara Prime',
  // ── LAS TRES DE LA PRIMERA PASADA GRANDE (tanda 529) ──
  //
  // Salieron del informe con 32, 5 y 1 cartas detrás. Las tres son
  // MECANISMOS con nombre oficial en español, no inventos míos:
  //
  // · «Prism Star» se publicó en España como **Prisma Estelar** (va
  //   impreso en la propia carta, debajo del nombre).
  // · La «Trainer Gallery» de Espada y Escudo se rotuló **Galería de
  //   Entrenadores** en los sets españoles.
  // · «Rare ACE» es la rareza de los ACE SPEC de Negro y Blanco, el mismo
  //   mecanismo que hoy se llama «ACE SPEC Rare». Va al mismo sitio para
  //   que las dos épocas se filtren juntas, que es lo que espera quien
  //   busca sus AS TÁCTICO.
  'Rare Prism Star': 'Rara Prisma Estelar',
  'Trainer Gallery Rare Holo': 'Rara Holo Galería de Entrenadores',
  'Rare ACE': 'Rara ACE SPEC',
}

// De cualquier forma escrita a la canónica, en un solo mapa.
const CANONICA = new Map()
for (const [es, otras] of Object.entries(OTRAS_FORMAS)) {
  CANONICA.set(es, es)
  for (const o of otras) CANONICA.set(o, es)
}
for (const [en, es] of Object.entries(RAREZAS_ES)) if (!CANONICA.has(en)) CANONICA.set(en, es)
// Las de Scrydex PISAN a las de TCGdex cuando chocan, y ese es el motivo
// de la tanda: TCGdex mete la arcoíris dentro de «Hyper rare».
for (const [en, es] of Object.entries(RAREZAS_SCRYDEX)) CANONICA.set(en, es)

// ── ¿LA CONOCEMOS? (tanda 527) ──
//
// El informe de /admin marcaba como «sin traducir» todo lo que se tradujera
// a sí mismo, y así señaló «Promo» — que está en el diccionario desde
// siempre y cuya traducción al español ES «Promo». Un informe que señala lo
// que ya está bien enseña a no mirarlo, que es lo contrario de para lo que
// se hizo. La pregunta buena no es «¿cambia la palabra?» sino «¿está en el
// vocabulario?».
export function rarezaConocida(valor) {
  return !!valor && CANONICA.has(String(valor))
}

// El nombre oficial en español de una rareza, venga como venga escrita.
// Lo que no conocemos se devuelve TAL CUAL y no como «Sin rareza»: una
// rareza nueva es un dato, no un hueco.
export function rarezaEs(valor) {
  if (!valor) return null
  return CANONICA.get(valor) || String(valor)
}

// ── La rareza de una CARTA, que no es lo mismo que la de una cadena ──
//
// Manda `rarity_en`, que es el inglés canónico de Scrydex, y `rarity` es
// el respaldo. Mientras la función programada rellena, las dos conviven y
// la pantalla va ganando precisión sola; una carta sin `rarity_en` se
// sigue viendo exactamente como antes.
//
// Y la elección de columna va en SU PROPIA función exportada (tanda 523)
// porque no solo la necesita el rótulo: también la marca de la esquina, la
// familia de brillo, el escalón de la escala y los chips de filtro. Cada
// uno de esos sitios tenía escrito `rarity_en || rarity` a mano o —peor—
// solo `rarity`, y un sitio que se olvide no da ningún error: enseña la
// rareza GRUESA de TCGdex con la precisa delante.
export function rarezaCrudaDeCarta(carta) {
  return carta?.rarity_en || carta?.rarity || null
}

export function rarezaDeCarta(carta) {
  return rarezaEs(rarezaCrudaDeCarta(carta))
}

// Todas las formas con las que esa rareza puede estar guardada, para
// mandárselas a la consulta. Entra cualquiera de ellas.
export function formasDeRareza(valor) {
  const es = rarezaEs(valor)
  if (!es) return []
  const todas = new Set([String(valor), es, ...(OTRAS_FORMAS[es] || [])])
  return [...todas]
}


// Para pruebas y para quien quiera recorrerlas.
export { OTRAS_FORMAS, RAREZAS_SCRYDEX }
