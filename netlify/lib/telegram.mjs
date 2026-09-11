// Mandar cosas de PokeDoc al Telegram de la comunidad.
//
// Vive aquí, y no dentro de la función programada, porque lo usan DOS:
// telegram-noticias (cada cinco minutos, sola) y telegram-mandar (el
// botón del panel, cuando PINGU la empuja a mano). El texto y la forma
// del mensaje tienen que ser los mismos por los dos caminos.

export const SITIO = 'https://pokedoc.es'

// Telegram admite un HTML muy corto, y lo que NO se escape le rompe el
// mensaje entero: un «&» o un «<» en un titular y el envío falla con
// «can't parse entities». Se escapan los tres que pide su documentación.
export const escaparTelegram = (t) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// El texto del mensaje.
//
// El pie de una foto en Telegram son 1024 caracteres como MUCHO, y si te
// pasas no recorta: rechaza el mensaje entero. Por eso se recorta aquí, y
// por un espacio, para no partir una palabra.
export function mensajeDeNoticia({ title, description, slug }, { limite = 1024 } = {}) {
  const url = `${SITIO}/noticias/${encodeURIComponent(slug || '')}`
  const titular = `<b>${escaparTelegram(title)}</b>`
  const enlace = `\n\n<a href="${escaparTelegram(url)}">Leer la noticia completa</a>`
  const sitio = Math.max(0, limite - titular.length - enlace.length - 2)
  let resumen = escaparTelegram(description || '')
  if (resumen.length > sitio) {
    const trozo = resumen.slice(0, sitio - 1)
    const espacio = trozo.lastIndexOf(' ')
    resumen = `${espacio > sitio * 0.5 ? trozo.slice(0, espacio) : trozo}…`
  }
  return `${titular}${resumen ? `\n\n${resumen}` : ''}${enlace}`
}

// Con portada va como FOTO con pie: en Telegram una foto ocupa media
// pantalla y es lo que hace que se pare el dedo. Sin portada, mensaje
// normal — una foto rota es peor que ninguna.
export async function mandarATelegram(noticia, { token, canal, tema = null, fetchImpl = fetch }) {
  const texto = mensajeDeNoticia(noticia)
  const conFoto = !!noticia.cover_image
  const metodo = conFoto ? 'sendPhoto' : 'sendMessage'
  // Un TEMA de un grupo (los «canales» de dentro de una comunidad) no es
  // un chat distinto: es el mismo grupo con `message_thread_id`. Sin él,
  // el mensaje cae en el tema General y no donde toca.
  const dentroDelTema = tema ? { message_thread_id: Number(tema) } : {}
  const cuerpo = conFoto
    ? { chat_id: canal, ...dentroDelTema, photo: noticia.cover_image, caption: texto, parse_mode: 'HTML' }
    : { chat_id: canal, ...dentroDelTema, text: texto, parse_mode: 'HTML', link_preview_options: { prefer_large_media: true } }

  const res = await fetchImpl(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  })
  const datos = await res.json().catch(() => ({}))
  if (datos?.ok) return { ok: true }

  // Si la foto no le gusta a Telegram —el enlace no le responde, pesa
  // demasiado, no es una imagen— se reintenta SIN ella antes de rendirse.
  // La noticia importa más que la foto.
  if (conFoto) {
    const res2 = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: canal, ...dentroDelTema, text: texto, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10000),
    })
    const datos2 = await res2.json().catch(() => ({}))
    if (datos2?.ok) return { ok: true, sinFoto: true }
    return { ok: false, error: datos2?.description || datos?.description || 'Telegram no ha aceptado el mensaje' }
  }
  return { ok: false, error: datos?.description || 'Telegram no ha aceptado el mensaje' }
}

// Qué llaves faltan, por su nombre.
//
// Antes esto era un `if (!token || !canal)` mudo dentro de la función
// programada: si faltaba una variable, PINGU publicaba y no pasaba NADA
// —ni mensaje, ni error, ni rastro en el registro— y no había manera de
// saber cuál era. Ahora se devuelve el nombre exacto para poder decirlo.
export function llavesQueFaltan(env) {
  const faltan = []
  if (!env.TELEGRAM_BOT_TOKEN) faltan.push('TELEGRAM_BOT_TOKEN')
  if (!env.TELEGRAM_CANAL_NOTICIAS) faltan.push('TELEGRAM_CANAL_NOTICIAS')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) faltan.push('SUPABASE_SERVICE_ROLE_KEY')
  return faltan
}
