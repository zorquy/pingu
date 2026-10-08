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
    cm_avg30: numero(cm['30d_average']),
    cm_avg7: numero(cm['7d_average']),
    cm_disponibles: Number.isInteger(Number(cm.available_items)) ? Number(cm.available_items) : null,
    release_date: sale,
    updated_at: ahora.toISOString(),
  }
}

// EL PRECIO QUE SE ENSEÑA: el mínimo en ESPAÑA, que es lo que PINGU pidió.
// Si nadie lo vende en España, el de Europa, y si no el mínimo a secas —
// diciendo de dónde es: «8,78 €» a secas sería afirmar que es el español—.
// `null` es «no se sabe» (la 319), y no un cero.
export function precioDeProducto(f) {
  if (!f) return null
  if (numero(f.cm_lowest_es) != null) return { valor: Number(f.cm_lowest_es), donde: 'España' }
  if (numero(f.cm_lowest_eu) != null) return { valor: Number(f.cm_lowest_eu), donde: 'Europa' }
  if (numero(f.cm_lowest) != null) return { valor: Number(f.cm_lowest), donde: 'Cardmarket' }
  return null
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
    const p = precioDeProducto(porId.get(m.product_id))
    if (p) total += p.valor * n
    else if (n) sinPrecio += n
  }
  return { total: Math.round(total * 100) / 100, sinPrecio, unidades }
}
