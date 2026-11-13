// Traer el cambio del día (1330, G9): lo llaman Ajustes al elegir una moneda y
// app.js una vez al día si ya hay una elegida (por `import()`: quien ve euros
// no baja esto). Lo puro está en moneda.js.
import { LLAVE_CAMBIO, cambioGuardado, cambioViejo } from './moneda.js'

export async function traerCambio({ fetchImpl = fetch } = {}) {
  const res = await fetchImpl('/.netlify/functions/cambio').catch(() => null)
  if (!res?.ok) return null
  const c = await res.json().catch(() => null)
  if (!c?.tasas) return null
  try { localStorage.setItem(LLAVE_CAMBIO, JSON.stringify(c)) } catch {}
  return c
}

// Si el guardado es de otro día; si no llega, se queda el de antes (mejor un
// cambio de ayer que volver a euros de golpe).
export async function alDia() {
  if (!cambioViejo(cambioGuardado())) return cambioGuardado()
  return (await traerCambio()) || cambioGuardado()
}
