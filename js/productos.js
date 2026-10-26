// LOS PRODUCTOS SELLADOS (762, PR1 de la ronda 3): sobres, cajas, ETB,
// latas… PINGU: «una nueva pestaña en Mi colección que sea productos… la
// API se trae productos por expansiones».
//
// Lo PURO, sin red ni Supabase: lo importan la web (la pestaña, el Panel y
// /lanzamientos) y la función programada `tcggo-productos`, que es la
// lección de la 471 — no copiar, mudar lo puro a un fichero sin
// dependencias.

// El TIPO sale del nombre: TCGGO no lo da. El ORDEN importa: «Booster
// Bundle» y «Booster Box» antes que «Booster», y «Elite Trainer Box» antes
// que cualquier «Box».
export const TIPOS = [
  { id: 'etb', nombre: 'Caja de Entrenador Élite', patron: /elite trainer box|\betb\b/i },
  { id: 'caja', nombre: 'Caja de sobres', patron: /booster (box|display|case)|\bdisplay\b|\bbooster box\b/i },
  { id: 'bundle', nombre: 'Bundle de sobres', patron: /booster bundle|\bbundle\b/i },
  { id: 'blister', nombre: 'Blíster', patron: /blister|checklane|\b\d-pack\b/i },
  { id: 'lata', nombre: 'Lata', patron: /\btin\b/i },
  { id: 'mazo', nombre: 'Mazo', patron: /\bdeck\b/i },
  { id: 'coleccion', nombre: 'Colección', patron: /collection|premium|\bbox\b|binder|poster|stacking/i },
  { id: 'sobre', nombre: 'Sobre', patron: /booster|\bpack\b/i },
]
export const OTRO = { id: 'otro', nombre: 'Otros' }

export function tipoDeProducto(nombre) {
  const n = String(nombre || '')
  return (TIPOS.find((t) => t.patron.test(n)) || OTRO).id
}
export const nombreDeTipo = (id) => (TIPOS.find((t) => t.id === id) || OTRO).nombre

const numero = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// La fila de `tcg_products` que sale de un producto suyo. Todas las columnas
// `not null` van SIEMPRE (la 526: un upsert tiene que poder formar la fila
// que insertaría aunque vaya a ser un update).
export function filaDeProducto(p, { ahora = new Date() } = {}) {
  if (!p || !Number.isInteger(Number(p.id)) || !String(p.name || '').trim()) return null
  const cm = p.prices?.cardmarket || {}
  const ep = p.episode || {}
  const sale = /^\d{4}-\d{2}-\d{2}/.test(String(ep.released_at || '')) ? String(ep.released_at).slice(0, 10) : null
  return {
    id: Number(p.id),
    episode_id: Number.isInteger(Number(ep.id)) ? Number(ep.id) : null,
    lang: String(p.lang || ep.lang || 'en').slice(0, 8),
    name: String(p.name).trim().slice(0, 300),
    slug: p.slug ? String(p.slug).slice(0, 300) : null,
    tipo: tipoDeProducto(p.name),
    image: typeof p.image === 'string' ? p.image : null,
    cardmarket_id: Number.isInteger(Number(p.cardmarket_id)) ? Number(p.cardmarket_id) : null,
    tcgplayer_id: Number.isInteger(Number(p.tcgplayer_id)) ? Number(p.tcgplayer_id) : null,
    tcggo_url: typeof p.tcggo_url === 'string' ? p.tcggo_url : null,
    cm_lowest: numero(cm.lowest),
    cm_lowest_eu: numero(cm.lowest_EU_only),
    cm_lowest_es: numero(cm.lowest_ES),
    // Por país del vendedor (769), para la ficha del producto. Columnas de
    // supabase-migration-productos-ficha.sql: la función las quita si faltan.
    cm_lowest_de: numero(cm.lowest_DE),
    cm_lowest_fr: numero(cm.lowest_FR),
    cm_lowest_it: numero(cm.lowest_IT),
    cm_avg30: numero(cm['30d_average']),
    cm_avg7: numero(cm['7d_average']),
    cm_disponibles: Number.isInteger(Number(cm.available_items)) ? Number(cm.available_items) : null,
    // El PVP de Europa, en euros (1026, `msrp.eu`). Columna de la migración
    // 1026: la función la quita si falta. Otra moneda no es un PVP en euros.
    pvp_eur: p.msrp?.eu?.currency === 'EUR' ? numero(p.msrp.eu.price) : null,
    release_date: sale,
    updated_at: ahora.toISOString(),
  }
}

// Las columnas de la 1026 en `tcg_products`: la función las quita si su
// migración no está (un upsert con una columna que no existe se rechaza entero).
export const COLUMNAS_1026 = ['pvp_eur']

// QUÉ LLEVA DENTRO un producto (1026): las filas de `tcg_product_contenido`
// que salen de su `contained_items` (TCGGO, con `include_contained_items=1`).
// Cada una lleva lo que TCGGO dice de lo contenido —nombre, foto, el mínimo
// de Cardmarket y el de TCGplayer— para pintarlo sin cruzar nada; `idDe`
// convierte el id de un producto contenido al nuestro (el japonés va
// desplazado, 808). Lo que no es producto ni carta, o no tiene id, no entra.
export function filasDeContenido(p, { productId, ahora = new Date(), idDe = (id) => id } = {}) {
  if (!Array.isArray(p?.contained_items) || !Number.isInteger(Number(productId))) return []
  const vistas = new Set()
  const filas = []
  for (const c of p.contained_items) {
    const tipo = c?.type === 'product' ? 'product' : c?.type === 'card' ? 'card' : null
    const id = Number(c?.id)
    if (!tipo || !Number.isInteger(id) || id <= 0 || !String(c.name || '').trim()) continue
    const contenidoId = tipo === 'product' ? idDe(id) : id
    const clave = `${tipo}:${contenidoId}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    const cantidad = Math.min(10000, Math.max(1, Math.round(Number(c.quantity) || 1)))
    const cm = c.prices?.cardmarket || {}
    const tp = c.prices?.tcg_player || c.prices?.tcgplayer || {}
    filas.push({
      product_id: Number(productId),
      contenido_tipo: tipo,
      contenido_id: contenidoId,
      cantidad,
      nombre: String(c.name).trim().slice(0, 300),
      image: typeof c.image === 'string' ? c.image : null,
      cm_lowest: numero(cm.lowest ?? cm.lowest_near_mint),
      tp_market: tp.currency === 'EUR' ? numero(tp.market_price) : null,
      updated_at: ahora.toISOString(),
    })
  }
  return filas
}

// LA CUENTA DEL PACK (1026, PINGU dijo adelante a «sale a cuenta»): lo que
// costaría comprar suelto lo que lleva dentro, contra lo que vale el pack.
// Solo se suma lo que tiene precio; lo que no, se cuenta aparte y la ficha lo
// dice, porque una ETB lleva accesorios sin precio y «sale a cuenta» con la
// mitad de las cosas sin contar sería afirmar de más. `null` si no hay nada
// con precio o el pack no tiene precio (no se sabe, la 319).
export function cuentaDelPack(precioDelPack, contenido) {
  const filas = Array.isArray(contenido) ? contenido : []
  if (!filas.length || numero(precioDelPack) == null) return null
  let suelto = 0
  let conPrecio = 0
  let sinPrecio = 0
  for (const f of filas) {
    const n = Math.max(1, Number(f.cantidad) || 1)
    const precio = numero(f.cm_lowest) ?? numero(f.tp_market)
    if (precio == null) { sinPrecio += n; continue }
    suelto += precio * n
    conPrecio += n
  }
  if (!conPrecio) return null
  suelto = Math.round(suelto * 100) / 100
  const diferencia = Math.round((suelto - Number(precioDelPack)) * 100) / 100
  // Con todo contado, el veredicto; con algo sin precio, solo la cuenta.
  const veredicto = sinPrecio ? 'parcial' : diferencia > 0 ? 'mejor' : diferencia < 0 ? 'peor' : 'igual'
  return { suelto, pack: Number(precioDelPack), diferencia, conPrecio, sinPrecio, veredicto }
}

// Lo que sale cada unidad dentro de un pack («Viene en», 1026): el precio
// del pack entre las que lleva. Orientativo cuando el pack lleva más cosas.
export function porUnidad(precioDelPack, cantidad) {
  const precio = numero(precioDelPack)
  const n = Number(cantidad)
  if (precio == null || !Number.isFinite(n) || n <= 0) return null
  return Math.round((precio / n) * 100) / 100
}

// El precio de hoy contra el PVP (1026): a cuánto está por encima o por
// debajo. Entre −5 % y +5 % es «en el PVP». `null` sin uno de los dos.
export function relacionConPvp(precio, pvp) {
  const p = numero(precio)
  const v = numero(pvp)
  if (p == null || v == null || v <= 0) return null
  const tanto = Math.round(((p - v) / v) * 100)
  if (Math.abs(tanto) <= 5) return { tanto, texto: 'hoy en el PVP' }
  if (tanto >= 95 && tanto < 150) return { tanto, texto: 'hoy al doble' }
  if (tanto >= 150) return { tanto, texto: `hoy a ${(p / v).toLocaleString('es-ES', { maximumFractionDigits: 1 })}×` }
  return { tanto, texto: tanto > 0 ? `hoy un ${tanto} % por encima` : `hoy un ${-tanto} % por debajo` }
}

// LOS PRECIOS DE UN PRODUCTO SON POR IDIOMA, no por país (967). TCGGO da
// `lowest_ES`, `lowest_DE`… igual que en las cartas: el producto EN español,
// en alemán… (Sergio.M, con su web delante: «English, German, French…»). Y
// `lowest_EU_only` y `lowest` son el del idioma del propio producto (el
// inglés en el occidental, el japonés en el japonés): el mínimo de vendedores
// de Europa y el de todos. Se rotulaban «España», «Europa», «Alemania»… y
// «Todo Cardmarket», que no son lo que dicen.
const NOMBRE_DE_IDIOMA = { es: 'español', en: 'inglés', ja: 'japonés', de: 'alemán', fr: 'francés', it: 'italiano', ko: 'coreano', zh: 'chino' }
export const idiomaDelProducto = (f) => (NOMBRE_DE_IDIOMA[String(f?.lang || 'en').slice(0, 2)] ? String(f?.lang || 'en').slice(0, 2) : 'en')
const suIdioma = (f) => numero(f?.cm_lowest_eu) ?? numero(f?.cm_lowest)

// EL PRECIO QUE SE ENSEÑA: el del producto en ESPAÑOL, que es lo que PINGU
// pidió. Si no hay, el de su idioma (el inglés), diciendo cuál: «8,78 €» a
// secas sería afirmar que es el español. `null` es «no se sabe» (la 319).
export function precioDeProducto(f) {
  if (!f) return null
  if (numero(f.cm_lowest_es) != null) return { valor: Number(f.cm_lowest_es), donde: NOMBRE_DE_IDIOMA.es, idioma: 'es' }
  const propio = suIdioma(f)
  if (propio != null) return { valor: propio, donde: NOMBRE_DE_IDIOMA[idiomaDelProducto(f)], idioma: idiomaDelProducto(f) }
  return null
}

// EL IDIOMA DE TU COPIA (969): un producto se apunta en un idioma, como una
// carta. Los que se ofrecen son los que TCGGO da por idioma en el occidental
// (español, inglés, alemán, francés, italiano) y el japonés en el japonés.
export function idiomasDeProducto(f) {
  return idiomaDelProducto(f) === 'ja' || f?.market === 'JP' ? ['ja'] : ['es', 'en', 'de', 'fr', 'it']
}
export const nombreDeIdioma = (id) => {
  const n = NOMBRE_DE_IDIOMA[id] || String(id || '')
  return n ? n[0].toUpperCase() + n.slice(1) : ''
}

// Lo que vale UNA copia: el mínimo en SU idioma, como una carta (la 900); si
// en ese idioma no hay cifra, el de siempre (`precioDeProducto`), que dice
// de qué idioma es. Sin idioma —una línea de antes de la 969—, el de siempre.
export function precioDeProductoEnIdioma(f, idioma) {
  if (!f) return null
  if (idioma) {
    const v = preciosPorIdioma(f).find((x) => x.id === idioma)
    if (v) return { valor: v.valor, donde: NOMBRE_DE_IDIOMA[idioma], idioma }
  }
  return precioDeProducto(f)
}

// En preventa: sale después de hoy (la fecha de su expansión).
export function esPreventa(f, hoy = new Date().toISOString().slice(0, 10)) {
  return Boolean(f?.release_date) && String(f.release_date) > hoy
}

// Lo que valen tus productos: cantidad × su precio. Los que no tienen
// precio se cuentan aparte, para no decir «0 €» de lo que no se sabe.
export function valorDeProductos(mios, porId) {
  let total = 0
  let sinPrecio = 0
  let unidades = 0
  for (const m of mios || []) {
    const n = Math.max(0, Number(m.cantidad) || 0)
    unidades += n
    const p = precioDeProductoEnIdioma(porId.get(m.product_id), m.idioma)
    if (p) total += p.valor * n
    else if (n) sinPrecio += n
  }
  return { total: Math.round(total * 100) / 100, sinPrecio, unidades }
}

// Las columnas que trae la 769 (supabase-migration-productos-ficha.sql).
// Hasta que esté la migración, `tcggo-productos` no las manda: un upsert
// con una columna que no existe se rechaza ENTERO.
export const COLUMNAS_POR_PAIS = ['cm_lowest_de', 'cm_lowest_fr', 'cm_lowest_it']

// LO QUE ENSEÑA LA FICHA DE UN PRODUCTO (769, por idioma desde la 967): el
// mínimo en cada idioma, el español primero y luego el del propio producto;
// solo los que tienen cifra (lo que no se sabe no se pinta, la 319).
const COLUMNA_DE_IDIOMA = { es: 'cm_lowest_es', de: 'cm_lowest_de', fr: 'cm_lowest_fr', it: 'cm_lowest_it' }
export function preciosPorIdioma(f) {
  const propio = idiomaDelProducto(f)
  const orden = ['es', propio, 'de', 'fr', 'it'].filter((id, i, l) => l.indexOf(id) === i)
  return orden
    .map((id) => ({ id, nombre: NOMBRE_DE_IDIOMA[id][0].toUpperCase() + NOMBRE_DE_IDIOMA[id].slice(1), valor: id === propio ? suIdioma(f) : numero(f?.[COLUMNA_DE_IDIOMA[id]]) }))
    .filter((x) => x.valor != null)
}

// Los enlaces: Cardmarket por su id de producto (sin filtro de idioma: un
// producto sellado ES de un idioma, y el filtro dejaría fuera lo que hay) y
// TCGplayer por el suyo. `null` si no hay id: un botón que no lleva a
// ninguna parte no se pinta.
export function enlaceCardmarketDeProducto(f) {
  const id = Number(f?.cardmarket_id)
  return Number.isInteger(id) && id > 0 ? `https://www.cardmarket.com/es/Pokemon/Products?idProduct=${id}` : null
}
export function enlaceTcgplayerDeProducto(f) {
  const id = Number(f?.tcgplayer_id)
  return Number.isInteger(id) && id > 0 ? `https://www.tcgplayer.com/product/${id}` : null
}

// El catálogo de un producto (769): japonés si su idioma o su expansión lo
// son; occidental si no.
export const mercadoDeProducto = (f, setMarket = null) => (setMarket || (String(f?.lang || '').toLowerCase() === 'ja' ? 'JP' : 'WEST'))

// BUSCAR UN PRODUCTO POR LO QUE SE ESCRIBE (968). Los nombres de TCGGO van
// en inglés («Mega Charizard X ex Tin») y quien busca escribe en español
// («lata charizard»): cada palabra es una condición, y las que tienen
// traducción valen en los dos idiomas. Sin acentos ni signos: lo que va
// dentro de un `or` de PostgREST no puede llevar comas ni paréntesis.
const EN_INGLES = {
  lata: ['tin'], latas: ['tin'],
  sobre: ['booster', 'pack'], sobres: ['booster', 'pack'],
  caja: ['box'], cajas: ['box'],
  mazo: ['deck'], mazos: ['deck'],
  coleccion: ['collection'], colecciones: ['collection'],
  entrenador: ['trainer'], elite: ['elite'],
  pokemon: ['pokémon'],
}
export function terminosDeProducto(crudo) {
  const palabras = String(crudo || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(' ').filter(Boolean)
  return [...new Set(palabras)].slice(0, 6).map((p) => [p, ...(EN_INGLES[p] || []).filter((x) => x !== p)])
}
// El filtro de cada palabra, para `.or(…)`: una palabra, una llamada (y
// PostgREST junta las llamadas con AND).
export const filtroDeTermino = (alternativas) => alternativas.map((a) => `name.ilike.*${a}*`).join(',')
// Adónde lleva un producto desde fuera de su pestaña: /cartas, que se ve sin
// cuenta (en /mi-coleccion sin cuenta sale «entra»).
export const rutaDeProducto = (f) => `/cartas?ver=productos&producto=${encodeURIComponent(f?.id ?? '')}`
