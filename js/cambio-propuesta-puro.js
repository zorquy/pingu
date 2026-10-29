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

// EL TOTAL A MANO (1106, PINGU: «que sea editable… si estoy vendiendo un lote,
// abaratarlo un poco, o redondear: sale 4,99 y digo 5 euros»). Se escribe el
// total y se reparte entre las cartas en proporción a lo que valía cada una
// (su precio, o el de Cardmarket, o a partes iguales si no hay ninguno), para
// que la tarjeta siga sumando lo mismo. Devuelve el precio por copia de cada
// una, en céntimos exactos: lo que sobra del redondeo va a la línea de una
// copia que más pesa.
export function repartirTotal(items = [], total = 0) {
  const objetivo = Math.max(0, Math.round((Number(total) || 0) * 100))
  if (!items.length) return []
  const n = (it) => Math.max(1, Number(it.cantidad) || 1)
  const valor = (it) => Number(it.precio ?? it.precioCm) || 0
  let pesos = items.map((it) => valor(it) * n(it))
  if (!pesos.some((x) => x > 0)) pesos = items.map(n)
  const suma = pesos.reduce((a, b) => a + b, 0)
  const precios = items.map((it, i) => Math.floor(((objetivo * pesos[i]) / suma) / n(it)))
  let resto = objetivo - precios.reduce((a, c, i) => a + c * n(items[i]), 0)
  // El resto, primero a las líneas de una copia (cuadra al céntimo); si no
  // hay, a la que más pesa, de copia en copia mientras quepa.
  const orden = items.map((_, i) => i).sort((a, b) => (n(items[a]) === 1) - (n(items[b]) === 1) || pesos[a] - pesos[b]).reverse()
  for (const i of orden) {
    if (resto <= 0) break
    const m = Math.floor(resto / n(items[i]))
    if (m > 0) { precios[i] += m; resto -= m * n(items[i]) }
  }
  return precios.map((c) => c / 100)
}

// «Redondear»: el total al euro más cercano (y nunca a cero si había algo).
export const totalRedondo = (total) => (Number(total) > 0 ? Math.max(1, Math.round(Number(total))) : 0)

// EL ENVÍO (1099, PINGU: «normal son 2 € y el certificado son 7 €»). Los
// precios están también en `cambio_envio_precio` de la migración 1099: si
// cambian, en los dos.
export const ENVIOS = [
  { id: 'normal', nombre: 'Normal', precio: 2 },
  { id: 'certificado', nombre: 'Certificado', precio: 7 },
  { id: 'mano', nombre: 'En mano', precio: 0 },
]
export const envioDe = (id) => ENVIOS.find((e) => e.id === id) || null

// Qué es un trato desde quien mira (1099): si solo das cartas, «vendo»; si
// solo te las dan, «compro»; si las dos cosas, «cambio».
export function tipoDe(items = [], yo = null) {
  const mias = items.filter((it) => (yo == null ? it.mia : it.quien === yo)).length
  const suyas = items.length - mias
  if (mias && !suyas) return 'vendo'
  if (suyas && !mias) return 'compro'
  return 'cambio'
}

// El título de una propuesta guardada, desde quien mira.
export function tituloDe(oferta, yo, nombreOtro) {
  const tipo = tipoDe(oferta?.items || [], yo)
  if (tipo === 'vendo') return oferta?.de === yo ? `Venta a ${nombreOtro}` : `Le vendes a ${nombreOtro}`
  if (tipo === 'compro') return oferta?.de === yo ? `Compra a ${nombreOtro}` : `${nombreOtro} te vende`
  return `Cambio con ${nombreOtro}`
}

// Quién paga el envío (1099, lo recomendado): en una venta, quien compra (el
// lado que no da cartas), y se le suma a lo que paga; en un cambio cada uno
// paga lo que manda, así que nadie le paga el envío al otro.
export function pagaElEnvio(oferta) {
  const items = oferta?.items || []
  const daDe = items.some((it) => it.quien === oferta?.de)
  const daPara = items.some((it) => it.quien === oferta?.para)
  if (daDe && !daPara) return oferta?.para || null
  if (daPara && !daDe) return oferta?.de || null
  return null
}

// Lo que le llega a una persona en un cambio (1098): las copias del otro y
// el dinero que paga el otro, con el envío si se lo paga a ella (1099).
// `quien` es su id.
export function queRecibe(oferta, quien) {
  const cartas = (oferta?.items || []).filter((it) => it.quien !== quien).reduce((n, it) => n + (Number(it.cantidad) || 1), 0)
  const cantidad = Number(oferta?.dinero) || 0
  const paga = oferta?.dinero_paga === 'de' ? oferta?.de : oferta?.dinero_paga === 'para' ? oferta?.para : null
  const envio = Number(oferta?.envio_precio) || 0
  const pagaEnvio = envio > 0 ? pagaElEnvio(oferta) : null
  const dinero = (cantidad > 0 && paga && paga !== quien ? cantidad : 0) + (pagaEnvio && pagaEnvio !== quien ? envio : 0)
  return { cartas, dinero: Math.round(dinero * 100) / 100 }
}

// El botón de confirmar dice lo que te llega (1098, PINGU: «si son cartas,
// cartas recibidas; en el caso de ser una, recibido; si tengo que recibir
// dinero, dinero recibido»). Null si no te llega nada: no hay nada que
// confirmar (la 1098 te da por confirmado al aceptar).
export function textoDeRecibido({ cartas, dinero } = {}) {
  if (cartas && dinero) return 'Recibido'
  if (cartas === 1) return 'Carta recibida'
  if (cartas > 1) return 'Cartas recibidas'
  if (dinero) return 'Dinero recibido'
  return null
}

// «2 cartas y 30,00 €», para decir qué confirma cada uno.
export function loQueEs({ cartas, dinero } = {}) {
  const c = cartas ? `${cartas} ${cartas === 1 ? 'carta' : 'cartas'}` : ''
  const d = dinero ? euros(dinero) : ''
  return [c, d].filter(Boolean).join(' y ') || 'nada'
}

// LA DIRECCIÓN (1102, PINGU: «que alguien cuando acepta el envío también
// pueda meter su dirección… en el caso de cambio, que los dos»). La pone
// quien RECIBE cartas en un trato por correo; el dinero no la necesita. Los
// tamaños son los de `trade_offer_direcciones` (migración 1102).
export const CAMPOS_DIRECCION = [
  { id: 'nombre', nombre: 'Nombre y apellidos', min: 2, max: 120, auto: 'name' },
  { id: 'calle', nombre: 'Calle, número, piso', min: 3, max: 200, auto: 'street-address' },
  { id: 'cp', nombre: 'Código postal', min: 3, max: 12, auto: 'postal-code' },
  { id: 'ciudad', nombre: 'Ciudad', min: 2, max: 80, auto: 'address-level2' },
  { id: 'provincia', nombre: 'Provincia', min: 0, max: 80, auto: 'address-level1', opcional: true },
  { id: 'telefono', nombre: 'Teléfono', min: 0, max: 30, auto: 'tel', opcional: true },
]

// Lo escrito, limpio, y lo que falta. `error` null si vale.
export function validarDireccion(d = {}) {
  const dir = {}
  const faltan = []
  for (const c of CAMPOS_DIRECCION) {
    const v = String(d?.[c.id] ?? '').trim().slice(0, c.max)
    dir[c.id] = v || (c.opcional ? null : '')
    if (!c.opcional && v.length < c.min) faltan.push(c.nombre.toLowerCase())
  }
  return { dir, error: faltan.length ? `Falta ${faltan.join(', ')}.` : null }
}

// Las líneas de una dirección, como en un sobre.
export const lineasDeDireccion = (d) => (d ? [d.nombre, d.calle, [d.cp, d.ciudad].filter(Boolean).join(' ') + (d.provincia ? ` (${d.provincia})` : ''), d.telefono ? `Tel. ${d.telefono}` : ''].filter(Boolean) : [])
// «C/ Mayor 12, 3.º B · 28013 Madrid»: para una línea.
export const direccionCorta = (d) => (d ? [d.calle, [d.cp, d.ciudad].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : '')

// Si va por correo (y no se cambió a en mano al aceptar).
export const vaPorCorreo = (o) => o?.envio === 'correo' && o?.envio_tipo !== 'mano'
// Si a esa persona le mandan cartas por correo: entonces pone su dirección.
export const necesitaDireccion = (o, quien) => vaPorCorreo(o) && (o?.items || []).some((it) => it.quien !== quien)
// `o.direcciones`: { [quien]: dirección } o null si no se sabe (sin la
// migración). Lo que no se sabe no falta.
export const faltaDireccion = (o, quien) => Boolean(o?.direcciones) && necesitaDireccion(o, quien) && !o.direcciones[quien]

// EL COBRO (1107, PINGU: «si elijo Bizum, que yo también tenga el número
// metido, y si es PayPal, el email o el arroba de PayPal»). Lo pone quien
// cobra el dinero del trato; las mismas reglas que `cambio_cobro_poner`.
export const COMOS_CON_DATO = {
  bizum: { nombre: 'Bizum', campo: 'Número de Bizum', ejemplo: '600 11 22 33', tipo: 'tel', auto: 'tel' },
  paypal: { nombre: 'PayPal', campo: 'Email o usuario de PayPal', ejemplo: 'tu@email.com o @usuario', tipo: 'text', auto: 'email' },
}
export function validarCobro(como, texto) {
  const crudo = String(texto ?? '').trim()
  if (como === 'bizum') {
    const dato = crudo.replace(/[^0-9+]/g, '')
    return /^\+?[0-9]{9,15}$/.test(dato) ? { dato, error: null } : { dato, error: 'Ese no parece un número de teléfono para Bizum.' }
  }
  if (como === 'paypal') {
    const ok = crudo.length >= 3 && crudo.length <= 120 && /^(@?[A-Za-z0-9._-]+|[^@ ]+@[^@ ]+\.[^@ ]+|(https?:\/\/)?(www\.)?paypal\.me\/[A-Za-z0-9._-]+)$/.test(crudo)
    return { dato: crudo, error: ok ? null : 'Pon el email o el usuario de PayPal.' }
  }
  return { dato: crudo, error: 'Ese pago no lleva datos.' }
}
// «600 11 22 33» para leerlo; el PayPal, tal cual.
export function datoBonito(como, dato) {
  if (como !== 'bizum' || !dato) return dato || ''
  const m = /^(\+34)?(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(dato)
  return m ? `${m[1] ? '+34 ' : ''}${m[2]} ${m[3]} ${m[4]} ${m[5]}` : dato
}
// Quién cobra: el lado que no paga el dinero apuntado.
export const quienCobra = (o) => (Number(o?.dinero) > 0 ? (o.dinero_paga === 'de' ? o.para : o.dinero_paga === 'para' ? o.de : null) : null)
export const necesitaCobro = (o, quien) => Boolean(COMOS_CON_DATO[o?.dinero_como]) && quienCobra(o) === quien
// `o.cobros`: { [quien]: { como, dato } } o null si no se sabe (sin la migración).
export const faltaCobro = (o, quien) => Boolean(o?.cobros) && necesitaCobro(o, quien) && !o.cobros[quien]

// LO ENVIADO (1103, PINGU: «si es un envío certificado, deberíamos poder poner
// el número de seguimiento»). Solo si la fila trae las columnas (sin la
// migración no se sabe y no se pide).
export const sabeEnvios = (o) => Boolean(o) && 'enviado_de_at' in o
export const mandaPorCorreo = (o, quien) => vaPorCorreo(o) && (o?.items || []).some((it) => it.quien === quien)
export const enviadoDe = (o, quien) => (quien === o?.de ? o?.enviado_de_at : o?.enviado_para_at) || null
export const seguimientoDe = (o, quien) => (quien === o?.de ? o?.seguimiento_de : o?.seguimiento_para) || null
// Le falta mandar lo suyo: ni lo ha dicho ni el otro ha confirmado que le llegó.
export function faltaMandar(o, quien) {
  if (!sabeEnvios(o) || !mandaPorCorreo(o, quien) || enviadoDe(o, quien)) return false
  return !(quien === o.de ? o.recibido_para_at : o.recibido_de_at)
}

// Lo que dice una propuesta de su estado, a quien mira, y qué puede hacer.
export function estadoDe(oferta, yo, nombreOtro = 'la otra persona') {
  const mia = oferta?.de === yo
  const otro = mia ? oferta?.para : oferta?.de
  const yaLoTengo = mia ? oferta?.recibido_de_at : oferta?.recibido_para_at
  const loTieneEl = mia ? oferta?.recibido_para_at : oferta?.recibido_de_at
  switch (oferta?.estado) {
    case 'enviada':
      return mia
        ? { texto: `Esperando a ${nombreOtro}`, tono: 'espera', acciones: ['editar', 'anular'], frase: oferta?.envio === 'correo' ? `Esperando a que ${nombreOtro} elija el envío y acepte.` : `Esperando a que ${nombreOtro} acepte.` }
        : { texto: 'Te toca', tono: 'toca', acciones: ['aceptar', 'editar', 'rechazar'], frase: oferta?.envio === 'correo' ? (oferta?.direcciones && necesitaDireccion(oferta, yo) ? 'Te toca: elige el envío, pon tu dirección y acepta, o haz una contraoferta.' : 'Te toca: elige el envío y acepta, o haz una contraoferta.') : 'Te toca: acepta o haz una contraoferta.' }
    case 'aceptada':
      // Por correo, sin tu dirección no te lo pueden mandar (1102).
      if (!yaLoTengo && faltaDireccion(oferta, yo)) return { texto: 'Te toca', tono: 'toca', acciones: ['anular'], frase: `Te toca: pon tu dirección para que ${nombreOtro} te lo envíe.` }
      // Por Bizum o PayPal, sin tu dato no te pueden pagar (1107).
      if (faltaCobro(oferta, yo)) return { texto: 'Te toca', tono: 'toca', acciones: yaLoTengo ? ['anular'] : ['lo-tengo', 'anular'], frase: `Te toca: pon tu ${COMOS_CON_DATO[oferta.dinero_como].nombre} para que ${nombreOtro} te pague.` }
      if (!loTieneEl && faltaCobro(oferta, otro)) return { texto: `Falta su ${COMOS_CON_DATO[oferta.dinero_como].nombre}`, tono: 'espera', acciones: yaLoTengo ? ['anular'] : ['lo-tengo', 'anular'], frase: `Esperando a que ${nombreOtro} ponga su ${COMOS_CON_DATO[oferta.dinero_como].nombre} para pagarle.` }
      if (!loTieneEl && faltaDireccion(oferta, otro)) return { texto: 'Falta su dirección', tono: 'espera', acciones: yaLoTengo ? ['anular'] : ['lo-tengo', 'anular'], frase: `Esperando a que ${nombreOtro} ponga su dirección para mandárselo.` }
      // Con su dirección, te toca mandarlo y decirlo (1103).
      if (faltaMandar(oferta, yo)) return { texto: 'Te toca', tono: 'toca', acciones: yaLoTengo ? ['anular'] : ['lo-tengo', 'anular'], frase: `Te toca: mándaselo a ${nombreOtro} y pulsa «Ya lo he enviado».` }
      if (!yaLoTengo && enviadoDe(oferta, otro)) {
        const seg = seguimientoDe(oferta, otro)
        return { texto: 'En camino', tono: 'toca', acciones: ['lo-tengo', 'anular'], frase: `${nombreOtro} ya te lo ha enviado${seg ? ` (seguimiento ${seg})` : ''}. Cuando te llegue, confírmalo.` }
      }
      if (!yaLoTengo) return { texto: loTieneEl ? `${nombreOtro} ya tiene lo tuyo` : 'Aceptado', tono: 'toca', acciones: ['lo-tengo', 'anular'], frase: loTieneEl ? `${nombreOtro} ya tiene lo tuyo. Cuando te llegue lo suyo, confírmalo.` : 'Aceptado: mandaos lo vuestro y confírmalo cuando te llegue.' }
      return { texto: `Esperando a que ${nombreOtro} lo confirme`, tono: 'espera', acciones: ['anular'], frase: `Esperando a que a ${nombreOtro} le llegue lo tuyo y lo confirme.` }
    case 'hecha':
      return { texto: 'Cambio hecho', tono: 'hecho', acciones: oferta?.deshacer_hasta && new Date(oferta.deshacer_hasta) > new Date() ? ['deshacer'] : [], frase: 'Hecho: las cartas ya están en la colección de cada uno.' }
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

// Los pasos que se pintan y el que está ahora (desde 1, como `pasoDe`). Por
// correo, con las direcciones sabidas, uno más: «Dirección» (1102).
export function pasosDe(o) {
  const conDireccion = Boolean(o?.direcciones) && vaPorCorreo(o)
  if (!conDireccion) return { nombres: ['Propuesta', 'Aceptada', 'Recibido', 'Hecho'], paso: pasoDe(o) }
  // Y con lo enviado sabido, «Enviado» (1103).
  const conEnvio = sabeEnvios(o)
  const nombres = conEnvio ? ['Propuesta', 'Aceptada', 'Dirección', 'Enviado', 'Recibido', 'Hecho'] : ['Propuesta', 'Aceptada', 'Dirección', 'Recibido', 'Hecho']
  if (o.estado === 'hecha') return { nombres, paso: nombres.length }
  if (o.estado !== 'aceptada') return { nombres, paso: 1 }
  if (o.recibido_de_at || o.recibido_para_at) return { nombres, paso: nombres.length - 1 }
  if (faltaDireccion(o, o.de) || faltaDireccion(o, o.para)) return { nombres, paso: 2 }
  if (conEnvio && !faltaMandar(o, o.de) && !faltaMandar(o, o.para)) return { nombres, paso: 4 }
  return { nombres, paso: 3 }
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
