// La racha que se enseña de OTRA persona (tanda 1001). PINGU: «si no tienen
// racha sale 1 fuego, pero debería no salir nada». Viva —entró hoy o ayer:
// `current_streak` no vuelve a cero hasta que la persona vuelve— y de dos
// días o más, que un día suelto no es una racha. Puro: lo usan /usuarios y
// /usuario.
export function rachaVisible(p, hoy = new Date()) {
  const n = Number(p?.current_streak) || 0
  const ayer = new Date(hoy.getTime() - 86400e3).toISOString().slice(0, 10)
  return n >= 2 && String(p?.last_active_date || '') >= ayer ? n : 0
}
