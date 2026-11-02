// «TU MES» (tanda 1173, P7 de la propuesta del Panel): lo que has hecho
// este mes con la colección, en cuatro cifras que ya se saben (las líneas
// por `created_at`, los cambios hechos y la foto diaria del valor), y tu
// mejor compra. Puro, sin DOM: lo pinta el Panel y lo dibuja mes-imagen.js.

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const inicioDelMes = (ahora = Date.now()) => {
  const d = new Date(ahora)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

export const nombreDelMes = (ahora = Date.now()) => MESES[new Date(ahora).getMonth()]

// `lineas`: tus líneas. `busca(linea)`: su carta. `valorDe(linea)`: lo que
// vale la LÍNEA entera (o null). `cambios`: filas de `trade_confirmations`
// (o null si no se han podido leer).
export function resumenDelMes(lineas, { ahora = Date.now(), busca = () => null, valorDe = () => null, cambios = null } = {}) {
  const desde = inicioDelMes(ahora)
  const esDelMes = (iso) => iso && new Date(iso).getTime() >= desde
  let cartas = 0
  const primeraDeSet = new Map()
  let mejor = null
  for (const l of lineas || []) {
    const c = busca(l)
    const clave = c?.set_id ? `${c.market || l.market || 'WEST'}|${c.set_id}` : null
    const t = l.created_at ? new Date(l.created_at).getTime() : null
    if (clave && t) primeraDeSet.set(clave, Math.min(primeraDeSet.get(clave) ?? Infinity, t))
    if (!esDelMes(l.created_at)) continue
    const copias = Number(l.cantidad) || 1
    cartas += copias
    const pagado = Number(l.precio_compra) > 0 ? Number(l.precio_compra) : null
    const v = valorDe(l)
    if (pagado !== null && v > 0) {
      const vale = v / copias
      const gana = vale - pagado
      if (!mejor || gana > mejor.gana) mejor = { carta: c, linea: l, pagado, vale, gana }
    }
  }
  const expansiones = [...primeraDeSet.values()].filter((t) => t >= desde).length
  const hechos = cambios === null ? null : (cambios || []).filter((f) => esDelMes(f.created_at) && f.hecho_a_at && f.hecho_b_at).length
  return { cartas, expansiones, cambios: hechos, mejor }
}
