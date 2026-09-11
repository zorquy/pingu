// Mandar cosas de PokeDoc al Telegram de la comunidad.
//
// Vive aquí, y no dentro de la función programada, porque lo usan DOS:
// telegram-noticias (cada cinco minutos, sola) y telegram-mandar (el
// botón del panel, cuando PINGU la empuja a mano). El texto y la forma
// del mensaje tienen que ser los mismos por los dos caminos.

import { fechaLargaEs } from './fechas.mjs'

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
function recortarA(texto, sitio) {
  if (texto.length <= sitio) return texto
  const trozo = texto.slice(0, Math.max(0, sitio - 1))
  const espacio = trozo.lastIndexOf(' ')
  return `${espacio > sitio * 0.5 ? trozo.slice(0, espacio) : trozo}…`
}

export function mensajeDeNoticia({ title, description, slug }, { limite = 1024 } = {}) {
  const url = `${SITIO}/noticias/${encodeURIComponent(slug || '')}`
  const titular = `<b>${escaparTelegram(title)}</b>`
  const enlace = `\n\n<a href="${escaparTelegram(url)}">Leer la noticia completa</a>`
  const sitio = Math.max(0, limite - titular.length - enlace.length - 2)
  const resumen = recortarA(escaparTelegram(description || ''), sitio)
  return `${titular}${resumen ? `\n\n${resumen}` : ''}${enlace}`
}

// La descripción de un torneo puede venir con formato (tanda 220), y
// Telegram solo entiende cuatro etiquetas: se deja el texto pelado.
export function soloTexto(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cómo se juega, en una línea: «5 rondas suizas + top 8», «liga de 8
// jornadas». Es lo primero que mira quien decide si se apunta.
export function comoSeJuega({ format, swiss_rounds: rondas, top_cut_size: top }) {
  if (!rondas) return ''
  const base = format === 'league' ? `liga de ${rondas} ${rondas === 1 ? 'jornada' : 'jornadas'}` : `${rondas} ${rondas === 1 ? 'ronda suiza' : 'rondas suizas'}`
  return top ? `${base} + top ${top}` : base
}

// El anuncio de un torneo.
//
// Misma forma que el de una noticia —titular, resumen, enlace— porque
// salen por el mismo canal y tienen que leerse igual. Lo que cambia es
// que en medio va la FICHA: cuándo se juega, cómo y cuántas plazas. Eso
// es lo que decide si alguien se apunta, y si hay que abrir la web para
// saberlo, no se abre.
export function mensajeDeTorneo(torneo, { limite = 1024, ahora = new Date() } = {}) {
  const url = `${SITIO}/torneo?slug=${encodeURIComponent(torneo.slug || '')}`
  const titulo = `<b>${escaparTelegram(torneo.name)}</b>`
  const enlace = `\n\n<a href="${escaparTelegram(url)}">Apúntate</a>`

  const cuando = fechaLargaEs(torneo.start_at, { ahora })
  const plazas = torneo.max_players == null ? 'plazas sin límite' : `${torneo.max_players} plazas`
  const ficha = escaparTelegram([cuando, comoSeJuega(torneo), plazas].filter(Boolean).join(' · '))

  const sitio = Math.max(0, limite - titulo.length - enlace.length - ficha.length - 4)
  const resumen = recortarA(escaparTelegram(soloTexto(torneo.description)), sitio)
  return `${titulo}${ficha ? `\n\n${ficha}` : ''}${resumen ? `\n\n${resumen}` : ''}${enlace}`
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
// Sin estas cabeceras, muchos sitios que alojan imágenes contestan 403 a
// secas: una petición sin `user-agent` tiene toda la pinta de un robot
// raspando, y la bloquean antes de mirar nada más. El nuestro dice quién
// es y a dónde escribir — no se disfraza de navegador.
//
// Lo que NO se manda es `referer`: es justo lo que miran las webs con
// protección contra enlazado externo, y mandarlo sería pedir el rechazo.
const CABECERAS_DE_IMAGEN = {
  accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'user-agent': 'PokeDocBot/1.0 (+https://pokedoc.es)',
}

// Qué es esta imagen, mirándole los primeros bytes.
//
// Hace falta porque el `content-type` MIENTE: lo pone quien sirve el
// fichero, y una portada guardada con la extensión equivocada sale como
// «image/png» siendo otra cosa. Y porque Telegram rechaza como FOTO
// formatos que son imágenes perfectamente válidas —WebP, AVIF, HEIC, los
// que gasta media web hoy— con un «IMAGE_PROCESS_FAILED» que no dice
// cuál de todos los motivos posibles es.
//
// Sin librerías: son cuatro cabeceras y se leen a mano.
export function describirImagen(datos) {
  const b = new Uint8Array(datos)
  const texto = (i, n) => String.fromCharCode(...b.slice(i, i + n))
  const u16 = (i, pequeno) => (pequeno ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1])
  const u32 = (i, pequeno) =>
    (pequeno ? b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24) : (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0

  if (b.length < 16) return { formato: '' }

  if (texto(1, 3) === 'PNG') return { formato: 'png', ancho: u32(16), alto: u32(20) }
  if (texto(0, 3) === 'GIF') return { formato: 'gif', ancho: u16(6, true), alto: u16(8, true) }
  if (texto(0, 2) === 'BM') return { formato: 'bmp', ancho: u32(18, true), alto: u32(22, true) }

  if (texto(0, 4) === 'RIFF' && texto(8, 4) === 'WEBP') {
    const clase = texto(12, 4)
    // VP8X lleva las medidas menos uno, en tres bytes cada una.
    if (clase === 'VP8X' && b.length > 30) {
      return { formato: 'webp', ancho: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), alto: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
    }
    if (clase === 'VP8 ' && b.length > 30) return { formato: 'webp', ancho: u16(26, true) & 0x3fff, alto: u16(28, true) & 0x3fff }
    return { formato: 'webp' }
  }

  // AVIF y HEIC se declaran en la caja «ftyp» del principio.
  if (texto(4, 4) === 'ftyp') {
    const marca = texto(8, 4)
    if (marca.startsWith('avi')) return { formato: 'avif' }
    if (marca.startsWith('hei') || marca.startsWith('mif')) return { formato: 'heic' }
  }

  if (b[0] === 0xff && b[1] === 0xd8) {
    // Las medidas de un JPEG están en el marcador SOF, que hay que ir a
    // buscar saltando de segmento en segmento.
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const marcador = b[i + 1]
      if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
        i += 2
        continue
      }
      const largo = u16(i + 2)
      if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
        return { formato: 'jpeg', alto: u16(i + 5), ancho: u16(i + 7) }
      }
      if (largo < 2) break
      i += 2 + largo
    }
    return { formato: 'jpeg' }
  }

  return { formato: '' }
}

// Lo que Telegram acepta como FOTO. Un WebP o un AVIF son imágenes
// válidas y se ven en cualquier navegador, pero como foto las rechaza.
const FORMATOS_DE_FOTO = ['jpeg', 'png', 'gif', 'bmp']

// Y sus límites: la suma de ancho y alto no puede pasar de 10000, y una
// tira muy alargada tampoco la traga.
const SUMA_MAXIMA = 10000
const PROPORCION_MAXIMA = 20

// En qué se queda una portada, para poder contarlo: «JPEG 1200×630,
// 245 KB». Sin esto, «IMAGE_PROCESS_FAILED» no se puede ni empezar a
// mirar.
export function comoEsLaPortada(info, bytes) {
  const medidas = info.ancho && info.alto ? ` ${info.ancho}×${info.alto} px` : ''
  // Los bytes sueltos se dicen tal cual: una portada de 300 bytes es una
  // imagen rota, y «0 KB» no lo contaría.
  const peso = bytes ? `, ${bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`}` : ''
  return `${(info.formato || 'formato desconocido').toUpperCase()}${medidas}${peso}`
}

export async function traerLaPortada(url, fetchImpl = fetch) {
  let res
  try {
    res = await fetchImpl(url, { redirect: 'follow', headers: CABECERAS_DE_IMAGEN, signal: AbortSignal.timeout(15000) })
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

  // Y ahora lo que de verdad importa, que el content-type no cuenta.
  const info = describirImagen(datos)
  const como = comoEsLaPortada(info, datos.byteLength)
  if (info.formato && !FORMATOS_DE_FOTO.includes(info.formato)) {
    return { error: `es un ${info.formato.toUpperCase()} (${como}) y Telegram no acepta ese formato como foto: vuelve a subirla en JPG o PNG`, como }
  }
  if (info.ancho && info.alto) {
    if (info.ancho + info.alto > SUMA_MAXIMA) {
      return { error: `es demasiado grande (${como}): Telegram no pasa de ${SUMA_MAXIMA} sumando ancho y alto`, como }
    }
    const proporcion = Math.max(info.ancho / info.alto, info.alto / info.ancho)
    if (proporcion > PROPORCION_MAXIMA) return { error: `es demasiado alargada (${como})`, como }
  }
  return { blob: new Blob([datos], { type: tipo }), como }
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
export async function mandarATelegram(anuncio, { token, canal, tema = null, fetchImpl = fetch }) {
  const texto = anuncio.texto
  const portada = portadaAbsoluta(anuncio.portada)
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

  if (!portada) return sinFoto(anuncio.portada ? 'la imagen no es una dirección que Telegram pueda pedir' : undefined)

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
    // Si llega aquí, la portada pasó todas nuestras comprobaciones y aun
    // así Telegram no la quiere. Se dice EN QUÉ CONSISTE: sin eso, un
    // «IMAGE_PROCESS_FAILED» no se puede ni empezar a mirar.
    return sinFoto(`${porEnlace.description || 'Telegram no ha aceptado el enlace'}; y subiéndola: ${subida.description || 'tampoco'} (la portada es ${traida.como})`)
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
export function llavesQueFaltan(env, { canal = 'TELEGRAM_CANAL_NOTICIAS' } = {}) {
  const faltan = []
  if (!env.TELEGRAM_BOT_TOKEN) faltan.push('TELEGRAM_BOT_TOKEN')
  // Los «canales» de una comunidad de Telegram son TEMAS de un mismo
  // grupo, así que el de torneos suele ser el mismo chat que el de
  // noticias con otro `message_thread_id`. Se deja poner uno propio, y
  // si no está se usa el de noticias: lo que cambia de verdad es el tema.
  if (!env[canal] && !env.TELEGRAM_CANAL_NOTICIAS) faltan.push(canal)
  if (!env.SUPABASE_SERVICE_ROLE_KEY) faltan.push('SUPABASE_SERVICE_ROLE_KEY')
  return faltan
}

// El chat al que mandar, con esa misma regla.
export function canalDe(env, nombre = 'TELEGRAM_CANAL_NOTICIAS') {
  return env[nombre] || env.TELEGRAM_CANAL_NOTICIAS || ''
}
