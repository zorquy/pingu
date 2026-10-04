// ── Cómo se ordena una expansión (tanda 427) ──
//
// Una expansión se mira de cuatro maneras según lo que vayas a hacer: por
// número cuando repasas el set en la mano, por nombre cuando buscas una,
// por rareza cuando miras lo que vale, y «lo que te falta» cuando vas a
// comprar o a cambiar. Hasta ahora solo había la primera.
//
// Va en su propio fichero y sin tocar el DOM para poder probarlo en Node:
// lo que decide el orden es aritmética, y la aritmética no necesita un
// navegador para equivocarse.

export const ORDENES = [
  { id: 'numero', nombre: 'Por número' },
  { id: 'nombre', nombre: 'Por nombre' },
  { id: 'rareza', nombre: 'Las más raras primero' },
  { id: 'falta', nombre: 'Lo que te falta primero' },
]

// El número impreso ordena «como en el álbum»: 2 antes que 10, y los que
// llevan letras (TG12, SV045) detrás de los numéricos.
export function porNumero(a, b) {
  const na = parseInt(a.local_id, 10)
  const nb = parseInt(b.local_id, 10)
  const ea = String(a.local_id).match(/^\d+$/) ? 0 : 1
  const eb = String(b.local_id).match(/^\d+$/) ? 0 : 1
  return ea - eb || (Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || String(a.local_id).localeCompare(String(b.local_id))
}

// La escala de rareza. No hay ninguna en la base —`rarity` es texto— así
// que hay que ponerla, y una lista a mano SE QUEDA VIEJA: es la lección de
// la tanda 323. Por eso debajo hay un reconocimiento por PALABRAS, igual
// que en `familiaDeBrillo`: una rareza nueva que diga «Hyper» se ordena
// como una hiperrara desde el día uno y no cuando alguien se acuerde.
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
// «illustration», y «rare holo» a «rare», o todo acabaría en el escalón
// más bajo que case.
//
// Y con BORDES DE PALABRA, que no es un detalle: `/rare/i` casa con
// «Rareza», así que una rareza que no se reconozca acabaría colocada en
// medio de la escala en vez de al final. Es la trampa de las tandas 312 y
// 313 —al barrer texto, todo lo que CONTIENE la cadena cuenta— aplicada a
// un nombre de rareza.
const POR_PALABRAS = [
  // La arcoíris y la secreta van ARRIBA y antes que nada (tanda 523):
  // sin ellas «Rare Rainbow» no casaba con ninguna palabra menos `rare` y
  // una de las cartas más buscadas del set se ordenaba como una común.
  [/\b(rainbow|arco[ií]ris)\b/i, 11],
  [/\b(secret|secreta)\b/i, 11],
  [/\bhyper\b/i, 11],
  [/\bspecial\s+illustration\b/i, 10],
  [/\b(shiny|variocolor)\b/i, 9],
  [/\b(radiant|amazing)\b/i, 8],
  [/\billustration\b/i, 8],
  [/\bultra\b/i, 7],
  [/\bace\s*spec\b/i, 6],
  [/\bdouble\b/i, 5],
  [/\bholo/i, 4],
  [/\bpromo\b/i, 0],
  [/\buncommon\b/i, 2],
  [/\bcommon\b/i, 1],
  [/\brare\b/i, 3],
]

// Tres respuestas y no dos (la regla de la tanda 319): un número si se
// sabe, `null` si la rareza existe pero no se reconoce, y `null` también
// si no hay rareza. Lo que NO vale es inventarse un escalón: colocaría una
// rareza desconocida en medio de la escala sin que nada lo cantara.
export function rangoDeRareza(rareza) {
  if (!rareza) return null
  const clave = Object.keys(ESCALA).find((k) => k.toLowerCase() === String(rareza).toLowerCase())
  if (clave) return ESCALA[clave]
  const palabra = POR_PALABRAS.find(([re]) => re.test(String(rareza)))
  return palabra ? palabra[1] : null
}

// Ordena SIN tocar la lista que le dan: `sort` muta, y `album.cartas` es
// la lista buena del set — ordenarla en el sitio dejaría el «por número»
// dependiendo de lo último que hubieras elegido.
export function ordenar(cartas, orden, { tengo, nombre } = {}) {
  const lista = [...cartas]
  const cuantas = (c) => (tengo ? Number(tengo(c.id)) || 0 : 0)
  const comoSeLlama = (c) => (nombre ? nombre(c) : c?.name || '')
  if (orden === 'nombre') {
    return lista.sort((a, b) => comoSeLlama(a).localeCompare(comoSeLlama(b), 'es') || porNumero(a, b))
  }
  if (orden === 'rareza') {
    return lista.sort((a, b) => {
      const ra = rangoDeRareza(a.rarity)
      const rb = rangoDeRareza(b.rarity)
      // Las que no se saben van SIEMPRE al final, se ordene como se
      // ordene: en «de más a menos», ponerlas arriba diría que son las más
      // raras del set, que es exactamente lo que no se sabe.
      if (ra === null && rb === null) return porNumero(a, b)
      if (ra === null) return 1
      if (rb === null) return -1
      return rb - ra || porNumero(a, b)
    })
  }
  if (orden === 'falta') {
    // Las que te faltan primero, y dentro de cada grupo por número: si no,
    // «lo que te falta» sería una lista desordenada de la que no se puede
    // ir leyendo números para buscarlos en una tienda.
    return lista.sort((a, b) => (cuantas(a) ? 1 : 0) - (cuantas(b) ? 1 : 0) || porNumero(a, b))
  }
  return lista.sort(porNumero)
}
