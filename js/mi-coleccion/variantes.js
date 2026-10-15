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
//
// ── Y LAS VERSIONES DE TCGGO (tanda 862) ──
//
// PINGU, con Dex delante y el Drakloak de Ascended Heroes: Normal, Reverse
// Holo y Quick Ball Holo, cada una su casilla, y tener cualquiera cuenta
// como tener la carta. TCGdex solo sabe de cuatro impresiones; los
// patrones de Mega Evolution («Energy Symbol Pattern», «Quick Ball») y
// la Reverse de un set viejo los trae TCGGO en `tcg_card_versions` (861).
// Quien tiene las filas en la mano las pega a la carta (`pegarVersiones` →
// `carta.versiones`) y desde ahí salen como una versión más: su id en la
// colección es la etiqueta en minúsculas con guiones (`quick-ball`), y la
// que no tiene etiqueta —o dice «Reverse Holo»— ES la reverse de siempre.
import { normalizeSearch } from '../texto.js'

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

// Lo que TCGGO llama una versión, en nuestros ids. Sin etiqueta es la
// Reverse (es lo único que Cardmarket vende aparte dentro del mismo
// producto en un set viejo); lo que no es ninguna de las cuatro, su
// etiqueta hecha id: minúsculas, sin acentos, guiones.
const CLASICAS = { 'reverse holo': 'reverse', reverse: 'reverse', 'reverse holofoil': 'reverse', holo: 'holo', holofoil: 'holo', standard: 'normal', normal: 'normal', '1st edition': 'primera', 'first edition': 'primera' }
export function varianteDeEtiqueta(etiqueta) {
  const t = normalizeSearch(String(etiqueta || '')).replace(/\s+/g, ' ').trim()
  if (!t) return 'reverse'
  if (CLASICAS[t]) return CLASICAS[t]
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'reverse'
}
export const esClasica = (id) => EQUIVALE.some((e) => e.nuestro === id)

// El nombre exacto de cada versión de TCGGO («Poké Ball», con su acento),
// apuntado al pegarlas; lo que no se ha visto se deshace del id.
const NOMBRES = new Map()
const deId = (id) => String(id || '').split('-').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(' ')

// Las filas de `tcg_card_versions` de unas cartas, pegadas a cada una
// (`carta.versiones`). Devuelve el mapa por carta.
export function pegarVersiones(cartas, filas) {
  const por = new Map()
  for (const f of filas || []) {
    if (!f?.card_id) continue
    por.set(f.card_id, (por.get(f.card_id) || []).concat([f]))
    const id = varianteDeEtiqueta(f.etiqueta)
    if (f.etiqueta && !esClasica(id)) NOMBRES.set(id, String(f.etiqueta).trim())
  }
  for (const c of cartas || []) if (c && por.has(c.id)) c.versiones = por.get(c.id)
  return por
}

// La fila de TCGGO de una versión de esta carta, o null (la normal no
// tiene: es la carta misma).
export function versionDeVariante(carta, id) {
  return (carta?.versiones || []).find((f) => varianteDeEtiqueta(f.etiqueta) === id) || null
}

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
  const base = v && typeof v === 'object' ? EQUIVALE.filter((e) => v[e.suyo] === true) : []
  // Y las de TCGGO (862), detrás de las de TCGdex y sin repetir.
  const extras = []
  for (const f of carta?.versiones || []) {
    const id = varianteDeEtiqueta(f.etiqueta)
    if (base.some((e) => e.nuestro === id) || extras.some((e) => e.nuestro === id)) continue
    extras.push(EQUIVALE.find((e) => e.nuestro === id) || { suyo: null, nuestro: id, corto: cortoDeVariante(id), nombre: nombreDeVariante(id) })
  }
  if (base.length) return [...base, ...extras]
  if (!extras.length) return siNoSeSabe
  // Solo versiones de TCGGO: la Standard (la carta misma) existe seguro.
  const sin = Array.isArray(siNoSeSabe) && siNoSeSabe.length ? siNoSeSabe : [EQUIVALE[0]]
  return [...sin, ...extras.filter((e) => !sin.some((s) => s.nuestro === e.nuestro))]
}

// ¿Merece la pena enseñar el selector? Con una sola versión no: sería
// una casilla que solo se puede marcar de una manera.
export function tieneVarias(carta) {
  return variantesDeCarta(carta).length > 1
}

// El nombre largo de una versión, para el `aria-label` y el `title`.
export function nombreDeVariante(id) {
  return EQUIVALE.find((e) => e.nuestro === id)?.nombre || NOMBRES.get(id) || (id ? deId(id) : 'Normal')
}

// El código corto de la chapa: el de siempre para las cuatro; para una de
// TCGGO, las iniciales («ESP», «QB»).
export function cortoDeVariante(id) {
  const e = EQUIVALE.find((x) => x.nuestro === id)
  if (e) return e.corto
  return nombreDeVariante(id).split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 3) || 'N'
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
