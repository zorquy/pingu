// Qué versiones existen DE VERDAD de una carta (tanda 383).
//
// PINGU quería marcar cada versión por su lado, como hacen las apps de
// coleccionismo. Y no hace falta preguntarle nada a nadie: TCGdex lo
// trae en `card.variants` y el curador ya lo guarda en
// `tcg_cards.variants` desde la tanda 330.
//
// ── POR QUÉ NO SE ENSEÑAN LAS CUATRO SIEMPRE ──
//
// Porque de casi ninguna carta existen las cuatro. Una común de hoy
// tiene normal y reverse; una ultra rara solo holo; las de 1999 tienen
// primera edición y las de ahora no. Ofrecer cuatro casillas en todas
// sería invitar a marcar una versión que no existe — y entonces tu
// colección diría que tienes algo que no se ha impreso nunca.
//
// Lo que NO se sabe tampoco se inventa: si `variants` viene vacío (la
// carta no se ha engordado todavía) se devuelve una sola versión, la
// normal, que es lo que hacía la pantalla antes de esta tanda. Un hueco
// no puede convertirse en «esta carta solo existe en normal».
//
// Sin DOM y sin Supabase: se prueba en Node.

// De cómo lo llama TCGdex a cómo lo llamamos nosotros
// (`user_collection.variante`). `wPromo` se deja fuera a propósito: es
// un SELLO impreso en la carta, no una versión que se coleccione
// aparte, y meterlo añadiría una casilla que nadie sabría qué marca.
const EQUIVALE = [
  { suyo: 'normal', nuestro: 'normal', corto: 'N', nombre: 'Normal' },
  { suyo: 'reverse', nuestro: 'reverse', corto: 'RH', nombre: 'Reverse holo' },
  { suyo: 'holo', nuestro: 'holo', corto: 'H', nombre: 'Holo' },
  { suyo: 'firstEdition', nuestro: 'primera', corto: '1.ª', nombre: '1.ª edición' },
]

export const VARIANTE_POR_DEFECTO = 'normal'

// Todas las que existen en el TCG, para quien quiera ofrecerlas cuando
// no sabe cuáles tiene esta carta.
export const TODAS = EQUIVALE.slice()

// Las versiones de esta carta, en el orden de arriba. Devuelve al menos
// una: una carta sin ninguna versión no se podría guardar.
//
// ── `siNoSeSabe` NO TIENE UN VALOR «OBVIO», POR ESO SE PIDE ──
//
// Cuando `variants` viene vacío —la carta no se ha engordado— hay dos
// respuestas razonables y son OPUESTAS, según para qué se pregunte:
//
//   · Para MARCAR en el álbum, una sola (la normal). Marcar es AFIRMAR
//     que tienes algo, y ofrecer casillas de versiones que a lo mejor no
//     existen invita a apuntar una carta que no se ha impreso nunca.
//   · Para GUARDAR desde la ficha, todas. Ahí la carta la tienes tú en
//     la mano y sabes mejor que nosotros en qué versión: esconderle la
//     opción sería impedirle apuntar lo que de verdad tiene.
//
// Los dos sitios lo hacían por su cuenta y **ya discrepaban** (la ficha
// suponía normal + reverse y el bolsillo solo normal). Un valor por
// defecto habría enterrado la diferencia otra vez, así que se pide: que
// cada pantalla diga en voz alta qué prefiere.
export function variantesDeCarta(carta, siNoSeSabe = [EQUIVALE[0]]) {
  const v = carta?.variants
  if (!v || typeof v !== 'object') return siNoSeSabe
  const hay = EQUIVALE.filter((e) => v[e.suyo] === true)
  return hay.length ? hay : siNoSeSabe
}

// ¿Merece la pena enseñar el selector? Con una sola versión no: sería
// una casilla que solo se puede marcar de una manera.
export function tieneVarias(carta) {
  return variantesDeCarta(carta).length > 1
}

// El nombre largo de una versión, para el `aria-label` y el `title`.
export function nombreDeVariante(id) {
  return EQUIVALE.find((e) => e.nuestro === id)?.nombre || 'Normal'
}

// En qué versión se añade una carta cuando NADIE ha dicho cuál (tanda
// 564).
//
// Era la cadena `'normal'`, escrita a mano en cuatro sitios, y estaba mal
// en todas las cartas que no tienen normal — que son muchísimas: una
// ultra rara, una full art y una secreta solo existen en holo. El «+» del
// álbum las guardaba como NORMALES, sin dar ningún error y sin que se
// note: la chapa de versión solo sale cuando no es la normal, así que la
// casilla se quedaba igual que una bien puesta.
//
// Las casillas por versión nunca pasaron por aquí —llevan la suya en el
// `data-var`—, y por eso el fallo se escondió: justo las cartas de las
// que se ofrecen varias versiones son las que lo hacían bien.
//
// Lo que NO se sabe sigue siendo normal: una carta sin engordar no dice
// nada de sus versiones, y la normal es la que existe casi siempre.
export function varianteDeCarta(carta) {
  return variantesDeCarta(carta)[0]?.nuestro || VARIANTE_POR_DEFECTO
}
