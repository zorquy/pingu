// Cardmarket: el precio de una carta y el enlace a su página con los
// filtros ya puestos (tanda 365).
//
// ── DE DÓNDE SALE CADA COSA ──
//
// · El PRECIO sale de TCGdex (`pricing.cardmarket` de la ficha de una
//   carta), que copia la guía de precios de Cardmarket una vez al día:
//   «desde» (`low`), tendencia (`trend`) y medias de 1, 7 y 30 días, más
//   las mismas cifras para el reverso holográfico (`*-holo`). Es el
//   precio de la carta en GENERAL: cualquier idioma y cualquier estado.
//
// · El mínimo por idioma y estado NO lo da ninguna fuente abierta. Lo
//   tiene la API de Cardmarket (solo vendedores con credenciales) y su
//   propia página, que no se deja leer desde fuera. Por eso el precio
//   general se enseña con su nombre («desde», «tendencia») y el ENLACE
//   lleva a Cardmarket con el idioma y el estado ya filtrados: ahí está
//   el mínimo de verdad, a un clic.
//
// · El ENLACE va por `idProduct` (también lo da TCGdex): Cardmarket
//   redirige /Products?idProduct=N a la página de la carta y CONSERVA
//   los filtros. Comprobado el 2026-09-29 con Dragapult ex TWM 130
//   (769304): `language=4&minCondition=4` abre la carta en español y en
//   Good o mejor; `isReverseHolo=Y` abre la versión «(Foil)».
//
// Sin DOM y sin Supabase: se prueba en Node.

const API = 'https://api.tcgdex.net/v2'
const CM = 'https://www.cardmarket.com/es/Pokemon'

// Los idiomas de Cardmarket para una carta occidental (los de su filtro
// en la página de un producto). La japonesa, la coreana y la china son
// OTROS productos en Cardmarket: no hay filtro que las saque aquí.
export const IDIOMAS = [
  { id: 'es', cm: 4, nombre: 'Español' },
  { id: 'en', cm: 1, nombre: 'Inglés' },
  { id: 'fr', cm: 2, nombre: 'Francés' },
  { id: 'de', cm: 3, nombre: 'Alemán' },
  { id: 'it', cm: 5, nombre: 'Italiano' },
  { id: 'pt', cm: 8, nombre: 'Portugués' },
  { id: 'ja', cm: null, nombre: 'Japonés' },
]
export const IDIOMA_POR_DEFECTO = 'es'

// Los estados, con el número del filtro `minCondition` de Cardmarket.
// Es «este estado O MEJOR», que es lo que se quiere: si tu carta está
// en Good, una en Near Mint al mismo precio también es tu precio.
export const ESTADOS = [
  { id: 'MT', cm: 1, nombre: 'Mint' },
  { id: 'NM', cm: 2, nombre: 'Near Mint' },
  { id: 'EX', cm: 3, nombre: 'Excellent' },
  { id: 'GD', cm: 4, nombre: 'Good' },
  { id: 'LP', cm: 5, nombre: 'Light Played' },
  { id: 'PL', cm: 6, nombre: 'Played' },
  { id: 'PO', cm: 7, nombre: 'Poor' },
]
export const ESTADO_POR_DEFECTO = 'NM'

// La versión física de la carta. En Cardmarket el reverso holo es el
// mismo producto con un filtro, y su precio va en los campos `-holo`.
export const VARIANTES = [
  { id: 'normal', nombre: 'Normal' },
  { id: 'reverse', nombre: 'Reverse holo' },
  { id: 'holo', nombre: 'Holo' },
  { id: 'primera', nombre: '1.ª edición' },
]

export const idiomaDe = (id) => IDIOMAS.find((i) => i.id === id) || IDIOMAS[0]
export const estadoDe = (id) => ESTADOS.find((e) => e.id === id) || ESTADOS.find((e) => e.id === ESTADO_POR_DEFECTO)
export const varianteDe = (id) => VARIANTES.find((v) => v.id === id) || VARIANTES[0]

// ── El precio ──

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

// De `pricing` de TCGdex a lo que se enseña. `reverse` elige las cifras
// del reverso holográfico. Devuelve null si no hay nada que enseñar.
//
// LO DEL REVERSO, que es de donde salía la mitad de los «Sin precio»
// (tanda 375): los campos `-holo` solo existen en las cartas que
// Cardmarket lista como producto aparte. En las demás —promos, muchas
// antiguas, casi todo lo que no sea del bloque de moda— están a null, y
// pedir el precio del reverso devolvía NADA. Osea que marcar tu carta
// como «reverse holo» hacía DESAPARECER un precio que estaba ahí.
//
// Un reverso sin cifras propias no vale cero: vale por lo menos lo que
// vale la carta. Se cae a las del normal y se marca `prestado`, para
// que la pantalla pueda decir de dónde sale — un precio que no es el
// tuyo y no lo dice es peor que no tenerlo.
export function precioDe(pricing, { reverse = false } = {}) {
  const cm = pricing?.cardmarket
  if (!cm) return null
  const cifrasDe = (s) => ({
    desde: num(cm[`low${s}`]),
    tendencia: num(cm[`trend${s}`]),
    media30: num(cm[`avg30${s}`]),
    media7: num(cm[`avg7${s}`]),
  })
  const hay = (c) => Boolean(c.desde || c.tendencia || c.media30)
  const propias = cifrasDe(reverse ? '-holo' : '')
  const prestado = reverse && !hay(propias) && hay(cifrasDe(''))
  const fuera = {
    idProduct: Number.isInteger(cm.idProduct) ? cm.idProduct : null,
    ...(prestado ? cifrasDe('') : propias),
    actualizado: cm.updated || null,
    reverse,
    // De la versión normal, porque la del reverso no la da nadie.
    prestado,
  }
  return fuera.desde || fuera.tendencia || fuera.media30 || fuera.idProduct ? fuera : null
}

// El valor con el que se suma una carta a la colección: la TENDENCIA,
// que es lo que Cardmarket da como «lo que vale»; sin ella, la media de
// 30 días; sin nada, el «desde». No se ajusta por estado a propósito:
// cualquier descuento por «Good» sería un número inventado.
export function valorDe(precio) {
  return precio?.tendencia || precio?.media30 || precio?.desde || null
}

// De una fila de `tcg_card_prices` (la guarda la función programada) a
// la misma forma que `precioDe`.
export function precioDeFila(fila, { reverse = false } = {}) {
  if (!fila) return null
  return precioDe(
    {
      cardmarket: {
        idProduct: fila.cm_id_product,
        low: fila.cm_low,
        trend: fila.cm_trend,
        avg30: fila.cm_avg30,
        avg7: fila.cm_avg7,
        'low-holo': fila.cm_low_holo,
        'trend-holo': fila.cm_trend_holo,
        'avg30-holo': fila.cm_avg30_holo,
        updated: fila.cm_updated,
      },
    },
    { reverse }
  )
}

// Y al revés: de la respuesta de TCGdex a la fila de la tabla.
export function filaDePrecio(cardId, pricing, ahora = new Date()) {
  const cm = pricing?.cardmarket || {}
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    card_id: cardId,
    cm_id_product: Number.isInteger(cm.idProduct) ? cm.idProduct : null,
    cm_low: n(cm.low),
    cm_trend: n(cm.trend),
    cm_avg30: n(cm.avg30),
    cm_avg7: n(cm.avg7),
    cm_low_holo: n(cm['low-holo']),
    cm_trend_holo: n(cm['trend-holo']),
    cm_avg30_holo: n(cm['avg30-holo']),
    cm_updated: cm.updated || null,
    checked_at: ahora.toISOString(),
  }
}

// La ficha en inglés: el precio es el mismo en todos los idiomas de
// TCGdex, y la inglesa es la que existe siempre.
export function urlDePrecio(cardId) {
  return `${API}/en/cards/${encodeURIComponent(cardId)}`
}

const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function euros(v) {
  return typeof v === 'number' && Number.isFinite(v) ? fmt.format(v) : '—'
}

// ── El enlace ──
//
// `nombre` solo hace falta para el caso sin `idProduct` (la carta no
// está en Cardmarket según TCGdex, o es japonesa): entonces se busca por
// nombre, que al menos deja a un clic de la carta.
export function enlaceCardmarket({ idProduct = null, idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO, variante = 'normal', nombre = '' } = {}) {
  const i = idiomaDe(idioma)
  const e = estadoDe(estado)
  const p = new URLSearchParams()
  if (idProduct && i.cm) {
    p.set('idProduct', String(idProduct))
    p.set('language', String(i.cm))
    p.set('minCondition', String(e.cm))
    if (variante === 'reverse') p.set('isReverseHolo', 'Y')
    return `${CM}/Products?${p.toString()}`
  }
  p.set('searchString', String(nombre || '').trim())
  if (i.cm) p.set('language', String(i.cm))
  return `${CM}/Products/Search?${p.toString()}`
}

// El texto del botón, que dice QUÉ filtros lleva: «español · Good o
// mejor». Quien lo pulsa sabe qué va a ver antes de irse.
export function textoDelEnlace({ idProduct = null, idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO } = {}) {
  const i = idiomaDe(idioma)
  if (!idProduct || !i.cm) return 'Buscar en Cardmarket'
  const e = estadoDe(estado)
  return `Ver en Cardmarket: ${i.nombre.toLowerCase()} · ${e.nombre}${e.id === 'MT' ? '' : ' o mejor'}`
}

// ── La colección ──

// El valor de una línea de la colección: el precio que haya puesto su
// dueño a mano manda sobre el de Cardmarket (una gradeada, una firmada:
// ahí el precio general no dice nada).
export function valorDeLinea(linea, precio) {
  const manual = typeof linea?.valor_manual === 'number' ? linea.valor_manual : Number(linea?.valor_manual)
  const unidad = Number.isFinite(manual) && manual > 0 ? manual : valorDe(precio)
  return unidad ? unidad * (Number(linea?.cantidad) || 1) : null
}

// La clave con la que se funden dos líneas: misma carta, mismo idioma,
// estado, versión y gradeo son la misma línea con más copias.
export function claveDeLinea(l) {
  return [l.card_id, l.idioma || '', l.estado || '', l.variante || 'normal', l.gradeo || ''].join('|')
}
