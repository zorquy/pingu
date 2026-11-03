// LA CIFRA DE TU COLECCIÓN ES LA DEL PANEL (tanda 1205, PINGU: «que el del
// inicio sea una copia literalmente. Coja el mismo dato, que no calcule de
// otro lado»). La portada sumaba por su cuenta (`valorComoElPanel`) y no
// llegaba a lo mismo: el Panel pide en vivo a TCGdex el precio de las cartas
// que no tienen uno guardado (sus `vivos`), y eso la portada no lo hace. Así
// que el Panel APUNTA aquí la cifra que enseña, cada vez que la pinta, y la
// portada enseña ESA mientras sea de hoy y de las últimas horas. Si no hay
// (otro dispositivo, o hace mucho), la portada suma como antes.
// Puro salvo el almacén, que se puede inyectar.
const LLAVE = 'pd-cifra-panel'
export const VIGENCIA_MS = 12 * 60 * 60 * 1000

const almacenDeVerdad = () => { try { return globalThis.localStorage || null } catch { return null } }
const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

export function anotarCifraDelPanel(uid, total, { almacen = almacenDeVerdad(), ahora = Date.now() } = {}) {
  if (!uid || !Number.isFinite(Number(total)) || !almacen) return
  try {
    almacen.setItem(LLAVE, JSON.stringify({ uid, total: Math.round(Number(total) * 100) / 100, at: ahora }))
  } catch { /* sin almacén, la portada suma por su cuenta */ }
}

export function cifraDelPanel(uid, { almacen = almacenDeVerdad(), ahora = Date.now() } = {}) {
  if (!uid || !almacen) return null
  try {
    const v = JSON.parse(almacen.getItem(LLAVE) || 'null')
    if (!v || v.uid !== uid || !Number.isFinite(v.total) || !Number.isFinite(v.at)) return null
    if (ahora - v.at > VIGENCIA_MS || ahora < v.at || !mismoDia(v.at, ahora)) return null
    return v.total
  } catch {
    return null
  }
}
