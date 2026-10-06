// Cardmarket: el precio de una carta y el enlace a su página con los
// filtros ya puestos (tanda 365).
//
// ── DE DÓNDE SALE CADA COSA (tanda 589) ──
//
// · El PRECIO de una copia es el mínimo Near Mint de Cardmarket EN SU
//   IDIOMA (español, inglés, alemán, francés, italiano), que lo da TCGGO
//   cada día (`cm_low_es`… en `tcg_card_prices`). Lo que vale tu carta
//   en español es lo que cuesta la más barata en español.
// · Si TCGGO no tiene la carta, el general de la guía de Cardmarket
//   (mínimo, tendencia, media de 30 días: `cm_low`, `cm_trend`…), que
//   es lo que había hasta la 588, y que sigue poniendo TCGdex para las
//   cartas sin par propio.
// · Y si Cardmarket no la tiene, TCGplayer: en euros si viene de TCGGO
//   (`tp_market_eur`), en dólares por versión si viene de TCGdex (`tp_*`).
// · Las gradeadas: Cardmarket (euros) y ventas en eBay (dólares), por
//   casa y nota (`cm_gradeadas`, `ebay_gradeadas`).
//
// · El ENLACE a Cardmarket va por `idProduct` con el idioma y el estado
//   ya filtrados; el de TCGplayer, por su id de producto. Los dos ids
//   los decide `tcggo-emparejar` (`cm_id_product_propio`,
//   `tp_id_product_propio` en `tcg_cards`).
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

// Los idiomas de Cardmarket, con el número de su filtro `language`. La
// japonesa, la coreana y la china son OTROS productos en Cardmarket (el
// `idProduct` de TCGGO para una carta japonesa es el del producto
// japonés), y dentro de ESE producto el filtro de idioma sí existe: 7 es
// el japonés, 10 el coreano, 11 el chino tradicional (671). Hasta la 671
// iban a `null` y el enlace salía sin filtro («no te lleva al filtro
// correcto», PINGU).
export const IDIOMAS = [
  { id: 'es', cm: 4, nombre: 'Español' },
  { id: 'en', cm: 1, nombre: 'Inglés' },
  { id: 'fr', cm: 2, nombre: 'Francés' },
  { id: 'de', cm: 3, nombre: 'Alemán' },
  { id: 'it', cm: 5, nombre: 'Italiano' },
  { id: 'pt', cm: 8, nombre: 'Portugués' },
  { id: 'ja', cm: 7, nombre: 'Japonés' },
  // El coreano (671): una impresión que TCGGO cotiza al lado de la japonesa.
  { id: 'ko', cm: 10, nombre: 'Coreano' },
  // El chino entra en la tanda 472, cuando el selector de catálogo pasó a
  // mandar con qué idioma se añade: sin él, añadir del catálogo chino
  // guardaba la carta como ESPAÑOLA. `cm: null` como la japonesa — en
  // Cardmarket es otro producto, no un filtro de este.
  { id: 'zh', cm: 11, nombre: 'Chino' },
]
export const IDIOMA_POR_DEFECTO = 'es'

// Los idiomas en los que TCGGO da un mínimo propio, en el orden en que se
// enseñan: el nuestro primero. El portugués no tiene; el coreano y el
// chino los da su catálogo japonés (671).
export const IDIOMAS_CON_PRECIO = ['es', 'en', 'de', 'fr', 'it', 'ja', 'ko', 'zh']
export const columnaDeIdioma = (id) => (IDIOMAS_CON_PRECIO.includes(id) ? `cm_low_${id}` : null)

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
// ── TCGplayer, en dólares (tanda 586) ──
//
// TCGdex trae los dos mercados en la misma ficha: Cardmarket (euros, el
// nuestro) y TCGplayer (dólares, el de media comunidad latinoamericana).
// TCGplayer va POR VERSIÓN —normal, holofoil, reverse-holofoil, 1st
// edition…— y las versiones se llaman distinto en su documentación y en
// su ejemplo («reverse-holofoil» y «reverse»), así que cada una de las
// nuestras prueba varias llaves suyas, de la más exacta a la más
// parecida. Una ultra rara no tiene «normal»: su precio «normal» ES el
// holofoil.
const LLAVES_TCGPLAYER = {
  normal: ['normal', 'unlimited', 'holofoil', 'unlimited-holofoil'],
  reverse: ['reverse-holofoil', 'reverse', 'holofoil', 'normal'],
  holo: ['holofoil', 'unlimited-holofoil', 'normal', 'unlimited'],
  primera: ['1st-edition-holofoil', '1st-edition', 'holofoil', 'normal'],
}

// Cuánto vale un dólar en euros, A OJO. Es para dar un «≈» cuando
// Cardmarket no tiene la carta, no para facturar: se revisa de vez en
// cuando (2026-10).
export const EUR_POR_USD = 0.86
export const usdAEuros = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * EUR_POR_USD * 100) / 100 : null)

export function tcgplayerDe(tp, variante = 'normal') {
  if (!tp || typeof tp !== 'object') return null
  for (const llave of LLAVES_TCGPLAYER[variante] || LLAVES_TCGPLAYER.normal) {
    const v = tp[llave]
    if (!v || typeof v !== 'object') continue
    const mercado = num(v.marketPrice)
    const desde = num(v.lowPrice)
    if (mercado || desde) return { mercado, desde, version: llave, prestado: llave !== (LLAVES_TCGPLAYER[variante] || [])[0] }
  }
  return null
}

// ── El emparejamiento DUDOSO (tanda 586) ──
//
// TCGdex casa cada carta con un producto de Cardmarket, y a veces casa
// mal: el Groudon-EX de Duelos Primigenios (PRC 150, ~200 €) traía el
// precio y el enlace del Groudon común (PRC 84, 2 €). No da ningún error:
// es un precio perfectamente válido… de otra carta. Lo único que lo
// delata es TCGplayer, que para la MISMA carta dice 150 $. Cuando los dos
// mercados se llevan más de DIEZ veces, el de Cardmarket no se cree: el
// valor sale de TCGplayer y el botón de Cardmarket busca por nombre en
// vez de ir al producto equivocado. Diez y no dos porque entre mercados
// hay diferencias reales de 2-3×; 10× no es un mercado, es otra carta.
export const VECES_PARA_DUDAR = 10
export function emparejamientoDudoso(eur, usd) {
  const e = num(eur)
  const d = num(usd)
  if (!e || !d) return false
  const dEnEuros = d * EUR_POR_USD
  return e / dEnEuros > VECES_PARA_DUDAR || dEnEuros / e > VECES_PARA_DUDAR
}

export function precioDe(pricing, { reverse = false, variante = null } = {}) {
  const version = variante || (reverse ? 'reverse' : 'normal')
  const usd = tcgplayerDe(pricing?.tcgplayer, version)
  const cm = pricing?.cardmarket
  if (!cm) return usd ? { idProduct: null, desde: null, tendencia: null, media30: null, media7: null, actualizado: null, reverse, prestado: false, usd, dudoso: false } : null
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
    usd,
    dudoso: false,
  }
  fuera.dudoso = emparejamientoDudoso(fuera.tendencia || fuera.media30 || fuera.desde, usd?.mercado || usd?.desde)
  return fuera.desde || fuera.tendencia || fuera.media30 || fuera.idProduct || usd ? fuera : null
}

// De dónde sale el valor con el que se suma: 'cardmarket', 'tcgplayer' o
// null. Cardmarket manda; TCGplayer (convertido) cuando Cardmarket no
// tiene la carta o la tiene mal emparejada.
export function origenDelValor(precio) {
  if (!precio) return null
  const eur = precio.tendencia || precio.media30 || precio.desde
  if (eur && !precio.dudoso) return 'cardmarket'
  if (precio.usd?.mercado || precio.usd?.desde) return 'tcgplayer'
  return eur ? 'cardmarket' : null
}

const fmtUsd = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function dolares(v) {
  return typeof v === 'number' && Number.isFinite(v) ? fmtUsd.format(v) : '—'
}

// Una línea con los dos mercados, para la ficha y para el formulario de
// añadir: siempre la misma frase, venga de donde venga.
export function resumenDePrecio(precio, idioma = IDIOMA_POR_DEFECTO) {
  const p = precioParaIdioma(precio, idioma)
  if (!p) return 'Sin precio.'
  if (p.origen === 'cardmarket-idioma') return `Desde ${euros(p.valor)} en ${idiomaDe(idioma).nombre.toLowerCase()}`
  if (p.origen === 'cardmarket') return `Desde ${euros(p.valor)} en Cardmarket`
  return `TCGplayer: ${p.dolares ? `${dolares(p.dolares)} (≈ ${euros(p.valor)})` : euros(p.valor)}`
}

// El valor con el que se suma una carta a la colección (589): el mínimo
// de su idioma, y si no, lo que diga `precioParaIdioma`. Hasta la 588 era
// la tendencia general; PINGU lo cambió al mínimo —«pondría el precio
// más bajo, que sería el desde»—, que es lo que cuesta comprarla hoy.
export function valorDe(precio, idioma = null) {
  return precioParaIdioma(precio, idioma || IDIOMA_POR_DEFECTO)?.valor ?? null
}

// De una fila de `tcg_card_prices` (la guarda la función programada) a
// la misma forma que `precioDe`.
export function precioDeFila(fila, { reverse = false, variante = null } = {}) {
  if (!fila) return null
  // Las columnas `tp_*` (586): si la fila no las trae todavía, TCGplayer
  // sencillamente no está, que es la verdad.
  const tp = {}
  for (const [nuestra, suya] of [['normal', 'normal'], ['holo', 'holofoil'], ['reverse', 'reverse-holofoil'], ['primera', '1st-edition-holofoil']]) {
    const mercado = num(fila[`tp_${nuestra}_market`])
    const desde = num(fila[`tp_${nuestra}_low`])
    if (mercado || desde) tp[suya] = { marketPrice: mercado, lowPrice: desde }
  }
  const hayCm = fila.cm_id_product || fila.cm_low || fila.cm_trend || fila.cm_avg30 || fila.cm_low_holo || fila.cm_trend_holo || fila.cm_avg30_holo
  const precio = precioDe(
    {
      ...(hayCm
        ? {
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
          }
        : {}),
      ...(Object.keys(tp).length ? { tcgplayer: tp } : {}),
    },
    { reverse, variante }
  )
  // La URL EXACTA del producto (tanda 585), que trae pokemontcg.io cuando
  // TCGdex no tiene la carta: vale aunque no haya ni una cifra, porque
  // es lo que convierte el botón en «esta carta» y no en una búsqueda.
  const url = typeof fila.cm_url === 'string' && /^https?:\/\//.test(fila.cm_url) ? fila.cm_url : null
  // Lo de TCGGO (589): el mínimo por idioma, TCGplayer en euros, cuántas
  // hay a la venta y las gradeadas. Lo que no viene es null, y `porIdioma`
  // solo existe si hay al menos un idioma con cifra.
  const porIdioma = {}
  for (const id of IDIOMAS_CON_PRECIO) {
    const v = num(fila[`cm_low_${id}`])
    if (v) porIdioma[id] = v
  }
  const extra = {
    porIdioma: Object.keys(porIdioma).length ? porIdioma : null,
    tpEur: num(fila.tp_market_eur),
    tpMidEur: num(fila.tp_mid_eur),
    disponibles: Number.isInteger(fila.cm_disponibles) ? fila.cm_disponibles : null,
    gradeadas: fila.cm_gradeadas || fila.ebay_gradeadas ? { cardmarket: fila.cm_gradeadas || null, ebay: fila.ebay_gradeadas || null } : null,
    actualizadoTcggo: fila.tcggo_updated || null,
  }
  const hayExtra = extra.porIdioma || extra.tpEur || extra.gradeadas
  if (!precio) {
    if (!url && !hayExtra) return null
    return { idProduct: fila.cm_id_product || null, desde: null, tendencia: null, media30: null, media7: null, actualizado: fila.cm_updated || null, reverse, prestado: false, usd: null, dudoso: false, url, ...extra }
  }
  return { ...precio, url, ...extra }
}

// ── El precio de UNA copia, según su idioma (tanda 589) ──
//
// Devuelve { valor, origen, idioma } con la regla de la casa (la misma
// que `valor_de_linea` en la base, que es quien hace la foto diaria):
//   1. el mínimo de Cardmarket en SU idioma (`cardmarket-idioma`);
//   2. el general de Cardmarket —mínimo, tendencia, media— si no parece
//      ser de otra carta (`cardmarket`);
//   3. TCGplayer, en euros de TCGGO o en dólares convertidos (`tcgplayer`).
// Sin nada, null. No se descuenta por estado: sería un número inventado.
export function precioParaIdioma(precio, idioma = IDIOMA_POR_DEFECTO) {
  if (!precio) return null
  const propio = precio.porIdioma?.[idioma] || null
  if (propio) return { valor: propio, origen: 'cardmarket-idioma', idioma }
  const general = precio.desde || precio.tendencia || precio.media30 || null
  if (general && !precio.dudoso) return { valor: general, origen: 'cardmarket', idioma: null }
  if (precio.tpEur) return { valor: precio.tpEur, origen: 'tcgplayer', idioma: null }
  const usd = precio.usd?.mercado || precio.usd?.desde || null
  if (usd) return { valor: usdAEuros(usd), origen: 'tcgplayer', idioma: null, dolares: usd }
  if (general) return { valor: general, origen: 'cardmarket', idioma: null }
  return null
}

// TCGplayer, directo al producto.
const TP = 'https://www.tcgplayer.com/product'
export function enlaceTcgplayer(idProduct) {
  const id = Number(idProduct)
  return Number.isInteger(id) && id > 0 ? `${TP}/${id}` : null
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
    // TCGplayer, por versión (586). Lo que no viene se guarda a null: una
    // versión que TCGplayer no vende no vale cero.
    ...filaDeTcgplayer(pricing?.tcgplayer),
    checked_at: ahora.toISOString(),
  }
}

export const COLUMNAS_TCGPLAYER = ['tp_normal_market', 'tp_normal_low', 'tp_holo_market', 'tp_holo_low', 'tp_reverse_market', 'tp_reverse_low', 'tp_primera_market', 'tp_primera_low', 'tp_updated']

function filaDeTcgplayer(tp) {
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const de = (llaves) => {
    for (const k of llaves) if (tp?.[k] && typeof tp[k] === 'object') return tp[k]
    return null
  }
  const normal = de(['normal', 'unlimited'])
  const holo = de(['holofoil', 'unlimited-holofoil'])
  const reverse = de(['reverse-holofoil', 'reverse'])
  const primera = de(['1st-edition-holofoil', '1st-edition'])
  return {
    tp_normal_market: n(normal?.marketPrice),
    tp_normal_low: n(normal?.lowPrice),
    tp_holo_market: n(holo?.marketPrice),
    tp_holo_low: n(holo?.lowPrice),
    tp_reverse_market: n(reverse?.marketPrice),
    tp_reverse_low: n(reverse?.lowPrice),
    tp_primera_market: n(primera?.marketPrice),
    tp_primera_low: n(primera?.lowPrice),
    tp_updated: tp?.updated ? new Date(tp.updated).toISOString() : null,
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
export function enlaceCardmarket({ idProduct = null, url = null, dudoso = false, idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO, variante = 'normal', nombre = '' } = {}) {
  // Sin `idProduct` pero con la URL exacta (585): a la carta, sin filtros
  // —es una redirección y no se le pueden colgar—, que es mejor que una
  // búsqueda con 133 resultados.
  if (!idProduct && url) return url
  const i = idiomaDe(idioma)
  const e = estadoDe(estado)
  const p = new URLSearchParams()
  // Un `idProduct` dudoso (586) lleva a OTRA carta: mejor la búsqueda.
  // Sin filtro de idioma (la japonesa es otro producto allí, 642) se va al
  // producto igual, solo que sin `language`.
  if (idProduct && !dudoso) {
    p.set('idProduct', String(idProduct))
    if (i.cm) p.set('language', String(i.cm))
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
export function textoDelEnlace({ idProduct = null, url = null, dudoso = false, idioma = IDIOMA_POR_DEFECTO, estado = ESTADO_POR_DEFECTO } = {}) {
  const i = idiomaDe(idioma)
  if (!idProduct && url) return 'Ver en Cardmarket'
  if (!idProduct || dudoso) return 'Buscar en Cardmarket'
  const e = estadoDe(estado)
  return `Cardmarket · ${i.nombre.toLowerCase()} · ${e.id}`
}

// ── La colección ──

// El valor de una línea de la colección: el precio que haya puesto su
// dueño a mano manda sobre el de Cardmarket (una gradeada, una firmada:
// ahí el precio general no dice nada).
export function valorDeLinea(linea, precio) {
  const manual = typeof linea?.valor_manual === 'number' ? linea.valor_manual : Number(linea?.valor_manual)
  const unidad = Number.isFinite(manual) && manual > 0 ? manual : valorDe(precio, linea?.idioma || null)
  return unidad ? unidad * (Number(linea?.cantidad) || 1) : null
}

// La clave con la que se funden dos líneas: misma carta, mismo idioma,
// estado, versión y gradeo son la misma línea con más copias.
export function claveDeLinea(l) {
  return [l.card_id, l.idioma || '', l.estado || '', l.variante || 'normal', l.gradeo || ''].join('|')
}
