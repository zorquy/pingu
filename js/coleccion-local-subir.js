// Al entrar con cuenta, lo que apuntaste sin ella en este navegador se sube
// solo (1328, G4). Entra por `import()` desde app.js y solo si hay algo
// guardado: la portada no lo baja.
import { leer, paraSubir, vaciar, LLAVE, copiasDe } from './coleccion-local.js'
import { showToast } from './toast.js'

let enMarcha = false
export async function subirAlEntrar(userId) {
  if (enMarcha || !userId) return
  const lineas = leer()
  if (!lineas.length) return
  enMarcha = true
  try {
    // Una tienda no: lo suyo es el stock, y su `user_collection` no se ve.
    const { getProfile } = await import('./app.js')
    const p = await getProfile(userId).catch(() => null)
    if (!p || p.tipo === 'tienda') return
    // Se quitan del navegador ANTES de subirlas (otra pestaña no las sube dos
    // veces) y lo que no entre vuelve a su sitio.
    vaciar()
    const datos = await import('./mi-coleccion/datos.js')
    const quedan = []
    for (const [mercado, ls] of paraSubir(lineas)) {
      for (const l of ls) {
        try { await datos.anadir(userId, l, mercado) } catch { quedan.push(lineas.find((x) => x.card_id === l.card_id && (x.market || 'WEST') === mercado)) }
      }
    }
    const subidas = copiasDe(lineas) - copiasDe(quedan.filter(Boolean))
    if (quedan.length) try { localStorage.setItem(LLAVE, JSON.stringify(quedan.filter(Boolean))) } catch {}
    if (subidas > 0) showToast(`Hemos guardado en tu cuenta ${subidas === 1 ? 'la carta' : `las ${subidas} cartas`} que apuntaste sin ella.`, 'success')
  } finally { enMarcha = false }
}
