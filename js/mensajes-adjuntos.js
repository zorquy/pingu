// Las fotos de un mensaje privado (tanda 891): subirlas al cubo privado,
// pedir sus direcciones firmadas y borrarlas con el mensaje.
//
// El cubo `mensajes-adjuntos` NO es público: una carpeta por conversación
// y una política que solo deja leer a los dos participantes (migración
// 891). Por eso aquí no hay `getPublicUrl`: cada foto se pide con
// `createSignedUrls`, que pasa por la política, y la dirección caduca.
import { supabase } from './supabase.js'
import { comprimirImagen, extensionDe } from './imagen-comprimir.js'

export const CUBO = 'mensajes-adjuntos'
const SEGUNDOS_DE_FIRMA = 60 * 60

// Sube las fotos ya comprimidas. Devuelve la lista que se guarda en el
// mensaje: [{ ruta, w, h }]. Si una falla, se borra lo que ya subió de
// este mensaje y se lanza: un mensaje con la mitad de las fotos no es lo
// que alguien quiso mandar.
export async function subirAdjuntos(conversationId, ficheros, { alProgresar = null } = {}) {
  const subidas = []
  try {
    for (const [i, f] of (ficheros || []).entries()) {
      const { blob, tipo, ancho, alto } = await comprimirImagen(f)
      const ruta = `${conversationId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extensionDe(tipo)}`
      const { error } = await supabase.storage.from(CUBO).upload(ruta, blob, { contentType: tipo, upsert: false })
      if (error) throw error
      subidas.push({ ruta, w: ancho || undefined, h: alto || undefined })
      alProgresar?.(i + 1, ficheros.length)
    }
    return subidas
  } catch (err) {
    if (subidas.length) await borrarAdjuntos(subidas).catch(() => {})
    throw err
  }
}

export async function borrarAdjuntos(adjuntos) {
  const rutas = (adjuntos || []).map((a) => a?.ruta).filter(Boolean)
  if (!rutas.length) return
  const { error } = await supabase.storage.from(CUBO).remove(rutas)
  if (error) throw error
}

// Direcciones firmadas, con caché: el hilo se repinta cada pocos segundos
// y pedir la firma de las mismas fotos en cada pintada sería una petición
// por foto cada diez segundos. Se guardan hasta cinco minutos antes de
// caducar.
const firmadas = new Map() // ruta → { url, hasta }
export async function urlsDeAdjuntos(adjuntos) {
  const rutas = [...new Set((adjuntos || []).map((a) => a?.ruta).filter(Boolean))]
  const ahora = Date.now()
  const faltan = rutas.filter((r) => !(firmadas.get(r)?.hasta > ahora + 5 * 60 * 1000))
  if (faltan.length) {
    const { data, error } = await supabase.storage.from(CUBO).createSignedUrls(faltan, SEGUNDOS_DE_FIRMA)
    if (!error) {
      for (const d of data || []) {
        if (d?.signedUrl && d?.path) firmadas.set(d.path, { url: d.signedUrl, hasta: ahora + SEGUNDOS_DE_FIRMA * 1000 })
      }
    }
  }
  return new Map(rutas.map((r) => [r, firmadas.get(r)?.url || null]))
}
