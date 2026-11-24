// ── Lo puro del puesto de cambios (tanda 1426) ──
//
// Sin DOM ni Supabase: lo importa js/evento-puesto.js y las pruebas en Node.
// Cada cosa del puesto es un `item`: { sello, precio (número o null), nombre,
// set (clave), setNombre, rareza, texto (ya plegado para buscar), i (el orden
// en que llegó) }.

// El precio, por tramos: quien mira una mesa piensa en «menos de 20 €», no en
// un número exacto.
export const TRAMOS_PRECIO = [
  { clave: 'hasta5', nombre: 'Hasta 5 €', desde: 0, hasta: 5 },
  { clave: '5a20', nombre: 'De 5 a 20 €', desde: 5, hasta: 20 },
  { clave: '20a50', nombre: 'De 20 a 50 €', desde: 20, hasta: 50 },
  { clave: 'mas50', nombre: 'Más de 50 €', desde: 50, hasta: Infinity },
]

export const ORDENES = [
  { clave: 'tuyo', nombre: 'Lo tuyo primero' },
  { clave: 'caras', nombre: 'Más caras' },
  { clave: 'baratas', nombre: 'Más baratas' },
  { clave: 'nombre', nombre: 'Nombre' },
  { clave: 'expansion', nombre: 'Expansión' },
]

const enTramo = (precio, clave) => {
  const t = TRAMOS_PRECIO.find((x) => x.clave === clave)
  if (!t) return true
  if (!Number.isFinite(precio)) return false
  return precio >= t.desde && precio < t.hasta
}

// Lo que se ofrece en cada desplegable sale de lo que HAY, con cuántas: una
// expansión que no tiene nadie no se ofrece.
export function opcionesDe(items) {
  const contar = (clave, nombre) => {
    const m = new Map()
    for (const x of items) {
      const k = x[clave]
      if (!k) continue
      const v = m.get(k) || { clave: k, nombre: x[nombre] || k, n: 0 }
      v.n++
      m.set(k, v)
    }
    return [...m.values()].sort((a, b) => b.n - a.n || String(a.nombre).localeCompare(String(b.nombre), 'es'))
  }
  const tramos = TRAMOS_PRECIO.map((t) => ({ ...t, n: items.filter((x) => enTramo(x.precio, t.clave)).length })).filter((t) => t.n > 0)
  return { sets: contar('set', 'setNombre'), rarezas: contar('rareza', 'rareza'), tramos, conSello: items.filter((x) => x.sello).length }
}

export function filtrar(items, { q = '', set = '', rareza = '', precio = '', solo = false } = {}) {
  return items.filter((x) => (!q || x.texto.includes(q)) && (!set || x.set === set) && (!rareza || x.rareza === rareza) && (!precio || enTramo(x.precio, precio)) && (!solo || x.sello))
}

// «Lo tuyo primero»: lo que lleva sello delante (lo que buscas, lo que das) y,
// dentro, lo de más valor; es el orden de la pestaña Cambios (939).
const RANGO_SELLO = { 'La buscas': 0, 'La das': 0, 'La tienes': 1 }
export function ordenar(items, orden = 'tuyo') {
  const p = (x) => (Number.isFinite(x.precio) ? x.precio : null)
  const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es') || a.i - b.i
  const lista = [...items]
  if (orden === 'caras') return lista.sort((a, b) => (p(b) ?? -1) - (p(a) ?? -1) || a.i - b.i)
  // Sin precio, al final también al ordenar de barata a cara.
  if (orden === 'baratas') return lista.sort((a, b) => (p(a) ?? Infinity) - (p(b) ?? Infinity) || a.i - b.i)
  if (orden === 'nombre') return lista.sort(porNombre)
  if (orden === 'expansion') return lista.sort((a, b) => String(a.setNombre || '').localeCompare(String(b.setNombre || ''), 'es') || porNombre(a, b))
  return lista.sort((a, b) => (RANGO_SELLO[a.sello] ?? 2) - (RANGO_SELLO[b.sello] ?? 2) || (p(b) ?? -1) - (p(a) ?? -1) || a.i - b.i)
}

// La línea de debajo de los filtros: cuántas y lo que suman las que tienen
// precio. «de N» solo si hay algo puesto.
export function cuentaDe(vistas, total, euros) {
  const suma = vistas.reduce((s, x) => s + (Number.isFinite(x.precio) ? x.precio : 0), 0)
  const n = vistas.length === 1 ? '1 carta' : `${vistas.length.toLocaleString('es-ES')} cartas`
  return `${n}${vistas.length !== total ? ` de ${total.toLocaleString('es-ES')}` : ''}${suma > 0 ? ` · ${euros(suma)}` : ''}`
}

// La frase del cruce, arriba: lo que te puede dar de TU lista y lo que le
// puedes dar tú. Nada que cruzar también se dice.
export function fraseDelCruce(teDa, leDas, nombre) {
  const cartas = (n) => (n === 1 ? '1 carta' : `${n} cartas`)
  if (!teDa && !leDas) return `Ahora mismo no os cuadra nada, pero mira lo que da ${nombre}.`
  if (!teDa) return `Tú le puedes dar a ${nombre} ${cartas(leDas)} que busca.`
  const da = `${nombre} te puede dar ${cartas(teDa)} de tu lista`
  return leDas ? `${da} y tú le puedes dar ${leDas} que busca.` : `${da}.`
}
