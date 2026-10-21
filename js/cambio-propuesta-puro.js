// ── Lo puro de las propuestas de cambio (tandas 942 y 943) ──
//
// Sin DOM ni Supabase: lo importan js/cambio-propuesta.js y las pruebas en
// Node. Todo se cuenta desde quien MIRA: «das» y «recibes» son suyos, y el
// dinero se dice como «te paga» o «le pagas», nunca «de» y «para».

export const FICHERO_MIGRACION = 'supabase-migration-942-propuestas-cambio.sql'

export const COMOS = [
  { id: 'bizum', nombre: 'Bizum' },
  { id: 'mano', nombre: 'En mano' },
  { id: 'paypal', nombre: 'PayPal' },
  { id: 'otro', nombre: 'Otro' },
]
export const nombreDeComo = (id) => COMOS.find((c) => c.id === id)?.nombre || ''

export const euros = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const centimos = (n) => Math.round((Number(n) || 0) * 100)

// Lo que suma cada lado y el dinero, desde quien mira. `items`: con `mia`
// (true si la da quien mira), `precio` (por copia, o null) y `cantidad`.
// `dinero`: { cantidad, pagaYo } — pagaYo true si paga quien mira.
export function balanceDe(items = [], dinero = {}) {
  let doy = 0
  let recibo = 0
  let sinPrecio = 0
  for (const it of items) {
    const n = Number(it.cantidad) || 1
    if (it.precio == null) { sinPrecio++; continue }
    if (it.mia) doy += centimos(it.precio) * n
    else recibo += centimos(it.precio) * n
  }
  const d = centimos(dinero.cantidad)
  // Lo que se lleva cada uno: el que paga «da» además el dinero.
  const misLados = dinero.pagaYo ? { das: doy + d, recibes: recibo } : { das: doy, recibes: recibo + d }
  const diferencia = misLados.recibes - misLados.das
  // Cuadra si la diferencia no pasa de un euro o del 5 % de lo que se mueve.
  const tolerancia = Math.max(100, Math.round(Math.max(misLados.das, misLados.recibes) * 0.05))
  return {
    doy: doy / 100,
    recibo: recibo / 100,
    dinero: d / 100,
    das: misLados.das / 100,
    recibes: misLados.recibes / 100,
    diferencia: diferencia / 100,
    cuadra: Math.abs(diferencia) <= tolerancia,
    sinPrecio,
  }
}

// La diferencia que se propone en dinero, con los precios de hoy: quién
// paga y cuánto. Nada si ya cuadra.
export function dineroQueCuadra(items = []) {
  const b = balanceDe(items, {})
  const falta = Math.round((b.doy - b.recibo) * 100) / 100
  if (Math.abs(falta) < 0.5) return { cantidad: 0, pagaYo: false }
  return falta > 0 ? { cantidad: falta, pagaYo: false } : { cantidad: -falta, pagaYo: true }
}

// El dinero de una propuesta GUARDADA, desde quien mira.
export function dineroDeOferta(oferta, yo) {
  const cantidad = Number(oferta?.dinero) || 0
  if (!cantidad || !oferta?.dinero_paga) return { cantidad: 0, pagaYo: false }
  const paga = oferta.dinero_paga === 'de' ? oferta.de : oferta.para
  return { cantidad, pagaYo: paga === yo, como: oferta.dinero_como || null }
}

export function textoDeDinero({ cantidad, pagaYo, como } = {}, nombreOtro = 'Te') {
  if (!cantidad) return ''
  const quien = pagaYo ? `Le pagas ${euros(cantidad)}` : `${nombreOtro === 'Te' ? 'Te paga' : `${nombreOtro} te paga`} ${euros(cantidad)}`
  return `${quien}${como ? ` · ${nombreDeComo(como)}` : ''}`
}

// Para la RPC: el dinero va como «quién paga», 'de' (quien propone) o 'para'.
export const pagaParaRpc = ({ cantidad, pagaYo }) => (Number(cantidad) > 0 ? (pagaYo ? 'de' : 'para') : null)

// Lo que dice una propuesta de su estado, a quien mira, y qué puede hacer.
export function estadoDe(oferta, yo, nombreOtro = 'la otra persona') {
  const mia = oferta?.de === yo
  const yaLoTengo = mia ? oferta?.recibido_de_at : oferta?.recibido_para_at
  const loTieneEl = mia ? oferta?.recibido_para_at : oferta?.recibido_de_at
  switch (oferta?.estado) {
    case 'enviada':
      return mia
        ? { texto: `Esperando a ${nombreOtro}`, tono: 'espera', acciones: ['editar', 'anular'] }
        : { texto: 'Te toca', tono: 'toca', acciones: ['aceptar', 'editar', 'rechazar'] }
    case 'aceptada':
      if (!yaLoTengo) return { texto: loTieneEl ? `${nombreOtro} ya tiene lo tuyo` : 'Aceptado', tono: 'toca', acciones: ['lo-tengo', 'anular'] }
      return { texto: `Esperando su «Lo tengo»`, tono: 'espera', acciones: ['anular'] }
    case 'hecha':
      return { texto: 'Cambio hecho', tono: 'hecho', acciones: oferta?.deshacer_hasta && new Date(oferta.deshacer_hasta) > new Date() ? ['deshacer'] : [] }
    case 'rechazada':
      return { texto: 'Rechazada', tono: 'fin', acciones: [] }
    case 'anulada':
      return { texto: 'Anulada', tono: 'fin', acciones: [] }
    case 'cambiada':
      return { texto: 'Cambiada por otra', tono: 'fin', acciones: [] }
    default:
      return { texto: '', tono: 'fin', acciones: [] }
  }
}

// Los cuatro pasos y cuál toca.
export function pasoDe(oferta) {
  if (oferta?.estado === 'hecha') return 4
  if (oferta?.estado === 'aceptada') return oferta.recibido_de_at || oferta.recibido_para_at ? 3 : 2
  return 1
}

// Viva = lo que todavía pide algo a alguien (o se puede deshacer).
export const estaViva = (o) => o?.estado === 'enviada' || o?.estado === 'aceptada' || (o?.estado === 'hecha' && o.deshacer_hasta && new Date(o.deshacer_hasta) > new Date())

// Lo que va a pasar al cerrar el cambio, para enseñarlo antes: lo que sale
// de tu colección y lo que entra, y el dinero. `items` desde quien mira.
export function loQueSeMueve(items = [], dinero = {}) {
  return {
    salen: items.filter((it) => it.mia),
    entran: items.filter((it) => !it.mia),
    dinero: Number(dinero.cantidad) > 0 ? dinero : null,
  }
}

// La lista para la RPC: lo mío con su línea; lo suyo con línea o pedido.
export function itemsParaRpc(items = []) {
  return items.map((it) => (it.mia
    ? { de: 'yo', linea: it.linea, cantidad: it.cantidad || 1, precio: it.precio ?? null }
    : it.linea
      ? { de: 'otro', linea: it.linea, cantidad: it.cantidad || 1, precio: it.precio ?? null }
      : { de: 'otro', card_id: it.card_id, market: it.market || 'WEST', idioma: it.idioma || 'es', estado: it.estado || 'NM', variante: it.variante || 'normal', cantidad: it.cantidad || 1, precio: it.precio ?? null }))
}
