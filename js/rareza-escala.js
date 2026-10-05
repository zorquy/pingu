// La ESCALA de rareza: UNA para toda la web (tandas 427, 523 y 624).
//
// La usan dos sitios que antes tenían cada uno la suya: ordenar una
// expansión en /mi-coleccion («las más raras primero») y elegir qué
// impresión de una carta se enseña (js/impresion-canonica.js, la de rareza
// más baja). Dos escalas para la misma pregunta acaban contestando cosas
// distintas — la de /mi-coleccion no entendía el español, y media base
// tiene la rareza en español («Común», «Rara Doble», «Ultra Rara»), así que
// esas cartas se ordenaban al final como «no se sabe».
//
// Sin DOM y sin Supabase: se prueba en Node.

// No hay escala en la base —`rarity` es texto— así que hay que ponerla, y
// una lista a mano SE QUEDA VIEJA (tanda 323). Por eso debajo hay un
// reconocimiento por PALABRAS, en los dos idiomas: una rareza nueva que diga
// «Hyper» se ordena como una hiperrara desde el día uno.
const ESCALA = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  'Rare Holo': 4,
  'Double rare': 5,
  'ACE SPEC Rare': 6,
  'Ultra Rare': 7,
  'Illustration rare': 8,
  'Amazing Rare': 8,
  'Radiant Rare': 8,
  'Shiny rare': 9,
  'Special illustration rare': 10,
  'Hyper rare': 11,
  // Una promo no es un escalón de rareza: es de dónde salió la carta. Va
  // la primera para no partir la escala por la mitad.
  Promo: 0,
}

// De más específico a menos: «special illustration» tiene que ganarle a
// «illustration», «rara doble» a «rara» y «rare holo» a «rare», o todo
// acabaría en el escalón más bajo que case.
//
// Con BORDES DE PALABRA, que no es un detalle: `/rare/i` casa con
// «Rareza», así que una rareza que no se reconozca acabaría en medio de la
// escala en vez de al final (la trampa de las tandas 312 y 313 aplicada a
// un nombre de rareza). Y se compara SIN TILDES: un `\b` junto a una «í»
// no es un borde para JavaScript, y «Rara Híper» no casaría con nada.
const POR_PALABRAS = [
  // La arcoíris y la secreta van ARRIBA y antes que nada (tanda 523):
  // sin ellas «Rare Rainbow» no casaba con ninguna palabra menos `rare` y
  // una de las cartas más buscadas del set se ordenaba como una común.
  [/\b(rainbow|arcoiris)\b/i, 11],
  [/\b(secret|secreta)\b/i, 11],
  [/\b(hyper|hiper)\b/i, 11],
  [/\b(black white|blanca y negra)\b/i, 11],
  [/\b(special illustration|ilustracion especial)\b/i, 10],
  [/\b(shiny|shining|variocolor|brillante)\b/i, 9],
  [/\b(radiant|radiante|amazing|asombrosa|increibles)\b/i, 8],
  // La Galería de Entrenadores es una ilustración con otro nombre: con el
  // `holo` de su rótulo inglés se ordenaba como una holo del montón.
  [/\b(illustration|ilustracion|gallery|galeria)\b/i, 8],
  [/\b(ultra|full art|arte completo)\b/i, 7],
  [/\b(ace\s*spec|ace|as tactico)\b/i, 6],
  [/\b(double|doble)\b/i, 5],
  [/\bholo/i, 4],
  [/\bpromo\b/i, 0],
  [/\b(uncommon|infrecuente|poco comun)\b/i, 2],
  [/\b(common|comun)\b/i, 1],
  [/\b(rare|rara)\b/i, 3],
]

const sinTildes = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

// Tres respuestas y no dos (la regla de la tanda 319): un número si se
// sabe, `null` si la rareza existe pero no se reconoce, y `null` también
// si no hay rareza. Lo que NO vale es inventarse un escalón: colocaría una
// rareza desconocida en medio de la escala sin que nada lo cantara. Las de
// TCG Pocket («Un Diamante», «Corona») se quedan fuera a propósito: no son
// del juego de cartas.
export function rangoDeRareza(rareza) {
  if (!rareza) return null
  const clave = Object.keys(ESCALA).find((k) => k.toLowerCase() === String(rareza).toLowerCase())
  if (clave) return ESCALA[clave]
  const texto = sinTildes(rareza)
  const palabra = POR_PALABRAS.find(([re]) => re.test(texto))
  return palabra ? palabra[1] : null
}

// El escalón de una CARTA: manda `rarity_en` (el inglés exacto de Scrydex,
// tanda 523) y `rarity` es el respaldo — también cuando `rarity_en` trae
// algo que la escala no reconoce, que no es lo mismo que no traer nada.
export function rangoDeCarta(carta) {
  for (const r of [carta?.rarity_en, carta?.rarity]) {
    const rango = rangoDeRareza(r)
    if (rango != null) return rango
  }
  return null
}
