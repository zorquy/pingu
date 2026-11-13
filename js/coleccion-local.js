// Probar sin cuenta (tanda 1328, G4 del plan 2027): tu colección empieza antes
// de registrarte. En /cartas sin sesión el «+» funciona y las líneas se guardan
// AQUÍ, en el navegador, con la misma forma que una de `user_collection`; al
// entrar con cuenta se suben solas (`subirAlEntrar`, desde app.js) y esto se
// vacía.
//
// Sin DOM ni Supabase (cardmarket.js no importa nada): el almacén se inyecta (localStorage en la web, un objeto
// en las pruebas de Node). Lo usa `datos.js` cuando `usarColeccionLocal()`.

import { claveDeLinea } from './cardmarket.js'

export const LLAVE = 'pd-coleccion-local'
// El «dueño» de unas líneas que todavía no son de nadie: un uuid que no puede
// ser el de nadie, para que lo que pregunte a la base por él reciba un vacío y
// no un error de tipo.
export const SIN_CUENTA = '00000000-0000-0000-0000-000000000000'
// A partir de cuántas la franja deja de ser un detalle y pide la cuenta.
export const AVISO_DESDE = 5
const TOPE = 999

const almacenWeb = () => (typeof localStorage !== 'undefined' ? localStorage : null)

export function leer(almacen = almacenWeb()) {
  try {
    const v = JSON.parse(almacen?.getItem(LLAVE) || '[]')
    return Array.isArray(v) ? v.filter((l) => l && l.id && l.card_id) : []
  } catch { return [] }
}

function escribir(lineas, almacen = almacenWeb()) {
  try {
    if (lineas.length) almacen?.setItem(LLAVE, JSON.stringify(lineas))
    else almacen?.removeItem(LLAVE)
    return true
  } catch { return false }
}

export const hayLocales = (almacen = almacenWeb()) => leer(almacen).length > 0

// La misma clave que usa datos.js (`claveDeLinea`: carta, idioma, estado,
// versión y gradeo) y el catálogo: dos iguales se suman en vez de repetirse.
const clave = (l) => `${l.market || 'WEST'}|${claveDeLinea(l)}`

export function lineasDe(mercado = null, almacen = almacenWeb()) {
  const todas = leer(almacen)
  return (mercado ? todas.filter((l) => (l.market || 'WEST') === mercado) : todas).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

export const lineasDeCarta = (cardId, almacen = almacenWeb()) => leer(almacen).filter((l) => l.card_id === cardId)

let contador = 0
const idNueva = () => `local-${Date.now().toString(36)}-${(contador++).toString(36)}`

export function anadir(linea, mercado = 'WEST', { almacen = almacenWeb(), ahora = new Date() } = {}) {
  const todas = leer(almacen)
  const nueva = { cantidad: 1, ...linea, market: linea.market || mercado }
  const igual = todas.find((l) => clave(l) === clave(nueva))
  let puesta
  if (igual) {
    igual.cantidad = Math.min(TOPE, (Number(igual.cantidad) || 0) + (Number(nueva.cantidad) || 1))
    igual.updated_at = ahora.toISOString()
    puesta = igual
  } else {
    puesta = { ...nueva, id: idNueva(), user_id: SIN_CUENTA, cambio: 0, created_at: ahora.toISOString(), updated_at: ahora.toISOString() }
    todas.push(puesta)
  }
  if (!escribir(todas, almacen)) throw new Error('Este navegador no deja guardar nada. Crea tu cuenta para apuntar tus cartas.')
  return { ...puesta }
}

export function actualizar(id, cambios, { almacen = almacenWeb(), ahora = new Date() } = {}) {
  const todas = leer(almacen)
  const l = todas.find((x) => x.id === id)
  if (!l) throw new Error('Esa carta ya no está en este navegador.')
  for (const [k, v] of Object.entries(cambios || {})) if (v !== undefined && k !== 'id' && k !== 'user_id') l[k] = v
  l.updated_at = ahora.toISOString()
  escribir(todas, almacen)
  return { ...l }
}

export function borrar(id, almacen = almacenWeb()) {
  const todas = leer(almacen)
  const quedan = todas.filter((l) => l.id !== id)
  if (quedan.length === todas.length) throw new Error('Esa carta ya no está en este navegador.')
  escribir(quedan, almacen)
}

export const vaciar = (almacen = almacenWeb()) => escribir([], almacen)

export const copiasDe = (lineas) => (lineas || []).reduce((n, l) => n + (Number(l.cantidad) || 0), 0)

// Lo que se manda a la base al entrar: sin lo que es solo de aquí (la id, el
// dueño de mentira, las fechas), por catálogo.
export function paraSubir(lineas) {
  const porMercado = new Map()
  for (const l of lineas || []) {
    const { id, user_id: _u, created_at: _c, updated_at: _a, cambio: _x, ...resto } = l
    const m = resto.market || 'WEST'
    if (!porMercado.has(m)) porMercado.set(m, [])
    porMercado.get(m).push(resto)
  }
  return porMercado
}

// La franja de /cartas sin cuenta: nada sin cartas; con pocas, la frase corta;
// desde AVISO_DESDE, la que pide la cuenta.
export function franjaDe(lineas, valor = null) {
  const n = copiasDe(lineas)
  if (!n) return null
  const euros = Number.isFinite(valor) && valor > 0 ? `${valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : null
  const cuenta = `${n} ${n === 1 ? 'carta' : 'cartas'}`
  return {
    fuerte: n >= AVISO_DESDE,
    titulo: `Llevas ${cuenta}${euros ? ` · ${euros}` : ''}`,
    texto: n >= AVISO_DESDE ? 'Están en este navegador. Con cuenta, en todos tus dispositivos y no se pierden.' : 'Guardadas en este navegador.',
    boton: n >= AVISO_DESDE ? 'Crear cuenta para no perderlas' : 'Crear cuenta',
  }
}
