// El hilo del foro de cada noticia (tanda 273).
//
// Lo pidió PINGU: que cada noticia abra su hilo sola, con un resumen y el
// enlace al artículo completo, como los torneos. Con dos diferencias que
// salen de haber visto funcionar el de los torneos:
//
//  1. AUTOMÁTICO, no un botón. Una noticia se publica y ya está: si hay
//     que acordarse de pulsar «anunciar», la mitad se quedan sin hilo.
//  2. SE GUARDA CUÁL ES. El torneo busca su hilo por el título
//     (`where title = 'Torneo: X'`); en cuanto alguien lo renombra desde
//     la moderación, el torneo cree que no tiene hilo y ofrece abrir
//     otro. Aquí se guarda el identificador en `guides.forum_thread_id`,
//     y eso es además lo que hace que guardar la noticia diez veces no
//     abra diez hilos.

import { escapeHtml } from './app.js'

export const FORO_NOTICIAS = 'noticias'

// El primer mensaje del hilo: de qué va, y a dónde ir a leerlo entero.
//
// Es un RESUMEN a propósito, no la noticia copiada. Si el texto entero
// estuviera aquí, el foro competiría con el artículo por la misma visita
// —y por la misma búsqueda en Google, que es lo último que quieres: dos
// páginas tuyas peleándose por lo mismo—. El hilo es para comentar; el
// artículo, para leer.
// Recibe la fila de la noticia TAL CUAL está en la base (`title`,
// `description`, `cover_image`) y no un objeto traducido: la traducción
// intermedia solo servía para poder equivocarse al hacerla.
export function mensajeDelHilo({ title, description, slug, cover_image: portada }) {
  const url = `https://pokedoc.es/noticias/${encodeURIComponent(slug || '')}`
  const partes = []
  if (portada) {
    partes.push(`<p><img src="${escapeHtml(portada)}" alt="${escapeHtml(title || '')}"></p>`)
  }
  if (description) partes.push(`<p>${escapeHtml(description)}</p>`)
  partes.push(
    `<p><a href="${escapeHtml(url)}"><strong>Leer la noticia completa</strong></a></p>`,
    `<p>¿Qué te parece? Se comenta por aquí.</p>`
  )
  return partes.join('')
}

// Abre el hilo, si toca.
//
// Devuelve el id del hilo, o null si no había nada que hacer. No lanza
// NUNCA: esto corre justo después de guardar una noticia, y que falle el
// foro no puede dar a entender que no se ha guardado la noticia.
export async function abrirHiloDeNoticia(supabase, { guia, autorId }) {
  if (!guia?.id || !autorId) return null
  // Solo noticias, solo publicadas, y solo si no tiene hilo ya.
  if (guia.kind !== 'news' || !guia.published_at || guia.forum_thread_id) return null

  try {
    const { data: foro } = await supabase
      .from('forum_boards')
      .select('id')
      .eq('slug', FORO_NOTICIAS)
      .maybeSingle()
    if (!foro?.id) {
      // La migración del foro todavía no está puesta. No es un error que
      // enseñarle a nadie: la noticia se ha guardado igual.
      console.warn('[noticias-foro] No existe el foro «noticias». Ejecuta supabase-migration-noticias-foro.sql.')
      return null
    }

    const { data: hilo, error } = await supabase
      .from('forum_threads')
      .insert({ board_id: foro.id, author_id: autorId, title: guia.title, prefix: 'Noticia' })
      .select('id')
      .single()
    if (error || !hilo?.id) {
      console.warn('[noticias-foro] No se ha podido abrir el hilo:', error?.message)
      return null
    }

    const { error: errorMensaje } = await supabase.from('forum_posts').insert({
      thread_id: hilo.id,
      author_id: autorId,
      body_html: mensajeDelHilo(guia),
    })
    if (errorMensaje) {
      // Un hilo sin primer mensaje no sirve para nada y encima sale en el
      // índice del foro como si tuviera algo. Se deshace — el mismo
      // cuidado que tienen el foro y los torneos.
      await supabase.from('forum_threads').delete().eq('id', hilo.id)
      console.warn('[noticias-foro] No se ha podido publicar el mensaje:', errorMensaje.message)
      return null
    }

    // Se apunta cuál es. Si esto fallara, el hilo existe pero la noticia
    // no lo sabe: se avisa, porque la próxima vez abriría otro.
    const { error: errorApunte } = await supabase
      .from('guides')
      .update({ forum_thread_id: hilo.id })
      .eq('id', guia.id)
    if (errorApunte) console.warn('[noticias-foro] Hilo abierto pero no apuntado:', errorApunte.message)

    return hilo.id
  } catch (e) {
    console.warn('[noticias-foro] No se ha podido abrir el hilo:', e?.message || e)
    return null
  }
}
