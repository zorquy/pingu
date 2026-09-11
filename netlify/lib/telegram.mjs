// Mandar cosas de PokeDoc al Telegram de la comunidad.
//
// Vive aquí, y no dentro de la función programada, porque lo usan DOS:
// telegram-noticias (cada cinco minutos, sola) y telegram-mandar (el
// botón del panel, cuando PINGU la empuja a mano). El texto y la forma
// del mensaje tienen que ser los mismos por los dos caminos.

export const SITIO = 'https://pokedoc.es'

// Cuando el mensaje va sin foto, la portada tiene que entrar igual por la
// vista previa del enlace: grande, y ENCIMA del texto, que es lo que lo
// hace parecer una noticia y no un enlace suelto.
const VISTA_PREVIA = { prefer_large_media: true, show_above_text: true }

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

// La portada, en una dirección que Telegram pueda abrir.
//
// A la foto no la sube PokeDoc: se le pasa la URL y va Telegram, desde
// SUS servidores, a buscarla. Eso descarta dos cosas que sí valen dentro
// de la web y aquí no llegarían nunca:
//
//   · una ruta del propio sitio («/fotos/portada.png»), porque Telegram
//     no tiene contra qué resolverla — se le pone pokedoc.es delante,
//     igual que hace urlAbsoluta() con el og:image de las redes;
//   · una imagen incrustada en el propio texto (data:, blob:), que no
//     es una dirección que nadie pueda ir a buscar.
export function portadaAbsoluta(url) {
  const v = String(url ?? '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  // Cualquier otro esquema (data:, blob:, javascript:) no es algo que
  // Telegram pueda pedir: mejor sin foto que con un envío rechazado.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ''
  return `${SITIO}${v.startsWith('/') ? '' : '/'}${v}`
}

// Con portada va como FOTO con pie: en Telegram una foto ocupa media
// pantalla y es lo que hace que se pare el dedo. Sin portada, mensaje
// normal — una foto rota es peor que ninguna.
// El máximo de Telegram para una foto SUBIDA por nosotros. Por enlace el
// límite es la mitad, y esa es otra razón para subirla cuando el enlace
// falla: caben portadas que por URL no cabrían.
const MAXIMO_FOTO = 10 * 1024 * 1024

// Traerse la portada a nuestro servidor.
//
// Telegram descarga la foto DESDE SUS SERVIDORES, y hay sitios que a él
// le dicen que no aunque a un navegador le digan que sí: un 403 de quien
// aloja la imagen, un 404, o simplemente que tarde demasiado. El mensaje
// que devuelve entonces —«failed to get HTTP URL content»— no dice cuál
// de las tres es.
//
// Pidiéndola nosotros se sabe qué pasa Y, si nosotros sí podemos, se le
// sube a Telegram en vez de pasarle el enlace. Es el mismo camino que
// yt-portada.mjs con las miniaturas de YouTube.
export async function traerLaPortada(url, fetchImpl = fetch) {
  let res
  try {
    res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
  } catch (e) {
    return { error: `no responde (${e?.message || e})` }
  }
  if (!res.ok) return { error: `responde ${res.status}` }
  const tipo = String(res.headers?.get?.('content-type') || '').split(';')[0].trim()
  // Una portada guardada con la extensión equivocada sale servida como
  // «application/octet-stream», y eso Telegram no lo acepta como foto.
  if (!/^image\//i.test(tipo)) return { error: `no es una imagen (${tipo || 'sin tipo'})` }
  let datos
  try {
    datos = await res.arrayBuffer()
  } catch (e) {
    return { error: `se ha cortado la descarga (${e?.message || e})` }
  }
  if (datos.byteLength > MAXIMO_FOTO) {
    return { error: `pesa ${(datos.byteLength / 1048576).toFixed(1)} MB (el máximo son 10)` }
  }
  if (!datos.byteLength) return { error: 'viene vacía' }
  return { blob: new Blob([datos], { type: tipo }) }
}

// Con portada va como FOTO con pie: en Telegram una foto ocupa media
// pantalla y es lo que hace que se pare el dedo. Sin portada, mensaje
// normal — una foto rota es peor que ninguna.
//
// Tres intentos, de más barato a más caro:
//
//   1. sendPhoto con el ENLACE. Es lo mejor cuando funciona: no pasa un
//      solo byte por nuestro servidor y Telegram se la cachea.
//   2. Si Telegram no consigue bajársela, la bajamos nosotros y se la
//      SUBIMOS. Aquí se arregla el caso de la web que le dice que no a
//      Telegram pero a nosotros no, y el de la portada servida con un
//      tipo que no es de imagen.
//   3. Y si ni eso, mensaje con vista previa grande: la portada entra
//      por el og:image de la noticia. Nunca se pierde del todo.
export async function mandarATelegram(noticia, { token, canal, tema = null, fetchImpl = fetch }) {
  const texto = mensajeDeNoticia(noticia)
  const portada = portadaAbsoluta(noticia.cover_image)
  // Un TEMA de un grupo (los «canales» de dentro de una comunidad) no es
  // un chat distinto: es el mismo grupo con `message_thread_id`. Sin él,
  // el mensaje cae en el tema General y no donde toca.
  const dentroDelTema = tema ? { message_thread_id: Number(tema) } : {}
  const aTelegram = (metodo, cuerpo) =>
    fetchImpl(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10000),
    })
  const respuesta = async (res) => (await res.json().catch(() => ({}))) || {}

  const sinFoto = async (motivo) => {
    const datos = await respuesta(
      await aTelegram('sendMessage', { chat_id: canal, ...dentroDelTema, text: texto, parse_mode: 'HTML', link_preview_options: VISTA_PREVIA })
    )
    if (datos.ok) return { ok: true, sinFoto: true, motivo }
    return { ok: false, error: datos.description || motivo || 'Telegram no ha aceptado el mensaje' }
  }

  if (!portada) return sinFoto(noticia.cover_image ? 'la portada no es una dirección que Telegram pueda pedir' : undefined)

  // 1. Por enlace.
  const porEnlace = await respuesta(await aTelegram('sendPhoto', { chat_id: canal, ...dentroDelTema, photo: portada, caption: texto, parse_mode: 'HTML' }))
  if (porEnlace.ok) return { ok: true }

  // 2. Subiéndola nosotros.
  const traida = await traerLaPortada(portada, fetchImpl)
  if (traida.blob) {
    const form = new FormData()
    form.set('chat_id', String(canal))
    if (tema) form.set('message_thread_id', String(tema))
    form.set('caption', texto)
    form.set('parse_mode', 'HTML')
    // El nombre da igual (Telegram mira el contenido), pero sin nombre
    // algunos servidores rechazan la parte del formulario.
    form.set('photo', traida.blob, 'portada')
    let subida = {}
    try {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
      subida = await respuesta(res)
    } catch (e) {
      subida = { description: `no se ha podido subir (${e?.message || e})` }
    }
    if (subida.ok) return { ok: true, subida: true }
    return sinFoto(`${porEnlace.description || 'Telegram no ha aceptado el enlace'}; y subiéndola: ${subida.description || 'tampoco'}`)
  }

  // 3. Ni por enlace ni subiéndola. Se dice qué le pasa a ESA portada,
  // que es lo único con lo que se puede hacer algo.
  return sinFoto(`la portada ${traida.error} — ${portada}`)
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
