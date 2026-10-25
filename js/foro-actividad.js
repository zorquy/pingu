import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'
import { haceCuanto, fechaLarga, etiquetaHtml, urlForo, urlTema, faltaElForo, reaccionesRecibidas } from './foro-comun.js'
import { rutaDeArticulo } from './articulos.js'

// Lo que alguien ha hecho en el foro, para su perfil: los temas que ha
// abierto y los mensajes que ha escrito.
//
// Son dos listas y no una a propósito. Son dos cosas distintas: abrir un
// tema es proponer algo, y responder es ayudar en lo de otro. Mezcladas
// no se distingue quién arranca conversaciones y quién las sostiene, que
// es justo lo interesante de mirar en un perfil.
//
// Va aparte de perfil.js y usuario.js porque las dos páginas enseñan
// exactamente lo mismo, solo que de personas distintas.

const CUANTOS = 20

// Solo los números, para la chapa de la pestaña y para decidir cuál se
// abre (tanda 308). Son dos consultas de CABECERA —`head: true`, sin
// filas— así que cuestan mucho menos que pintar la pestaña entera, que
// es lo que se sigue haciendo con pereza al abrirla.
export async function contarActividadDelForo(userId) {
  if (!userId) return 0
  const [{ count: nTemas, error }, { count: nMensajes }, { count: nComentarios }] = await Promise.all([
    supabase.from('forum_threads').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase.from('forum_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    // Los comentarios en noticias y guías cuentan igual (876).
    supabase.from('guide_comments').select('id', { count: 'exact', head: true }).eq('author_id', userId),
  ])
  // Sin foro montado no hay nada que contar, y desde luego no hay que
  // enseñar un error en una chapa.
  if (faltaElForo(error)) return 0
  // El mensaje que abre un tema ES un mensaje de `forum_posts` (1013, L2):
  // sumar los temas aparte lo contaba dos veces, y la chapa decía «1» de
  // alguien con un tema y la lista de abajo «ningún mensaje».
  return (nMensajes || 0) + (nComentarios || 0)
}

// Un comentario en una noticia o en una guía (876): una noticia ya no abre
// hilo en el foro, se comenta debajo del artículo, y lo que se dice ahí es
// actividad como la del foro. Va con el artículo y a dónde lleva.
function filaComentario(c, articuloPorId) {
  const a = articuloPorId[c.guide_id]
  if (!a) return ''
  return `
    <li class="foro-act-fila">
      <span class="foro-act-icono" aria-hidden="true">${icons.messageSquare(15)}</span>
      <span class="foro-act-cuerpo">
        <a class="foro-act-titulo" href="${rutaDeArticulo(a.kind, a.slug)}">${etiquetaHtml(a.kind === 'news' ? 'Noticia' : 'Guía')} ${escapeHtml(a.title)}</a>
        <span class="foro-act-trozo">${escapeHtml(trozo(c.body))}</span>
        <small title="${escapeHtml(fechaLarga(c.created_at))}">${escapeHtml(haceCuanto(c.created_at))}</small>
      </span>
    </li>`
}

function filaTema(t, foroPorId) {
  const foro = foroPorId[t.board_id]
  return `
    <li class="foro-act-fila">
      <span class="foro-act-icono" aria-hidden="true">${icons.messageSquare(15)}</span>
      <span class="foro-act-cuerpo">
        <a class="foro-act-titulo" href="${urlTema(t.id)}">${etiquetaHtml(t.prefix)} ${escapeHtml(t.title)}</a>
        <small>
          ${foro ? `en <a href="${urlForo(foro.slug)}">${escapeHtml(foro.name)}</a> · ` : ''}
          <span title="${escapeHtml(fechaLarga(t.created_at))}">${escapeHtml(haceCuanto(t.created_at))}</span>
          · ${Math.max(0, (t.post_count || 1) - 1)} ${Math.max(0, (t.post_count || 1) - 1) === 1 ? 'respuesta' : 'respuestas'}
        </small>
      </span>
    </li>`
}

// Del mensaje se enseña un trozo en texto pelado: en una lista, el HTML
// del mensaje entero no aporta nada y descoloca la página.
function trozo(html, largo = 160) {
  const texto = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return texto.length > largo ? texto.slice(0, largo) + '…' : texto
}

function filaMensaje(m, temaPorId) {
  const tema = temaPorId[m.thread_id]
  if (!tema) return ''
  return `
    <li class="foro-act-fila">
      <span class="foro-act-icono" aria-hidden="true">${icons.quote(15)}</span>
      <span class="foro-act-cuerpo">
        <a class="foro-act-titulo" href="${urlTema(m.thread_id)}#mensaje-${m.id}">${escapeHtml(tema.title)}</a>
        <span class="foro-act-trozo">${escapeHtml(trozo(m.body_html))}</span>
        <small title="${escapeHtml(fechaLarga(m.created_at))}">${escapeHtml(haceCuanto(m.created_at))}</small>
      </span>
    </li>`
}

export async function pintarActividadDelForo(contenedor, userId, { esMio = false } = {}) {
  if (!contenedor || !userId) return

  // Los TOTALES van aparte de las listas: las listas se recortan a 20,
  // y usar su length como número le ponía "Mensajes 20" a quien lleva
  // trescientos. Consultas de solo contar, y las reacciones recibidas —
  // los "agradecimientos" de toda la vida.
  const [{ data: temas, error }, { data: mensajes }, { count: totalTemas }, { count: totalMensajes }, gracias, { data: comentarios }, { count: totalComentarios }] =
    await Promise.all([
      supabase
        .from('forum_threads')
        .select('id, title, prefix, board_id, post_count, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(CUANTOS),
      supabase
        .from('forum_posts')
        .select('id, thread_id, body_html, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(CUANTOS),
      supabase.from('forum_threads').select('id', { count: 'exact', head: true }).eq('author_id', userId),
      supabase.from('forum_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
      reaccionesRecibidas(userId),
      supabase
        .from('guide_comments')
        .select('id, guide_id, body, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(CUANTOS),
      supabase.from('guide_comments').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    ])

  if (faltaElForo(error)) {
    contenedor.innerHTML = ''
    return
  }

  const listaTemas = temas || []
  const listaMensajes = mensajes || []

  // Desde la 1013 (L2) el mensaje que abre un tema cuenta como mensaje,
  // aquí y en la chapa de la pestaña: una sola regla, la del foro.
  const respuestas = listaMensajes

  const listaComentarios = comentarios || []
  const [{ data: foros }, { data: temasDeMensajes }, { data: articulos }] = await Promise.all([
    listaTemas.length
      ? supabase.from('forum_boards').select('id, name, slug').in('id', [...new Set(listaTemas.map((t) => t.board_id))])
      : Promise.resolve({ data: [] }),
    respuestas.length
      ? supabase.from('forum_threads').select('id, title').in('id', [...new Set(respuestas.map((m) => m.thread_id))])
      : Promise.resolve({ data: [] }),
    listaComentarios.length
      ? supabase.from('guides').select('id, title, slug, kind').in('id', [...new Set(listaComentarios.map((c) => c.guide_id))])
      : Promise.resolve({ data: [] }),
  ])
  const articuloPorId = Object.fromEntries((articulos || []).map((a) => [a.id, a]))
  const nComentarios = totalComentarios ?? listaComentarios.length

  const foroPorId = Object.fromEntries((foros || []).map((f) => [f.id, f]))
  const temaPorId = Object.fromEntries((temasDeMensajes || []).map((t) => [t.id, t]))

  const quien = esMio ? 'Todavía no has' : 'Todavía no ha'
  const nTemas = totalTemas ?? listaTemas.length
  const nMensajes = totalMensajes ?? listaMensajes.length
  const recorte = (total) => (total > CUANTOS ? `<p class="subtext foro-act-recorte">Los últimos ${CUANTOS} de ${total}.</p>` : '')
  contenedor.innerHTML = `
    <div class="foro-act-numeros">
      <div><strong>${nMensajes}</strong><span>Mensajes</span></div>
      <div><strong>${nTemas}</strong><span>Temas abiertos</span></div>
      <div><strong>${nComentarios}</strong><span>Comentarios en noticias y guías</span></div>
      ${gracias === null ? '' : `<div><strong>${gracias}</strong><span>Reacciones recibidas</span></div>`}
    </div>
    <div class="foro-act-columnas">
      <section>
        <h3 class="foro-act-titular">${icons.messageSquare(15)} Temas abiertos <span>${nTemas}</span></h3>
        ${
          listaTemas.length
            ? `<ul class="foro-act-lista">${listaTemas.map((t) => filaTema(t, foroPorId)).join('')}</ul>${recorte(nTemas)}`
            : `<p class="empty-state">${quien} abierto ningún tema en el foro.</p>`
        }
      </section>
      <section>
        <h3 class="foro-act-titular">${icons.quote(15)} Mensajes <span>${nMensajes}</span></h3>
        ${
          respuestas.length
            ? `<ul class="foro-act-lista">${respuestas.map((m) => filaMensaje(m, temaPorId)).join('')}</ul>${recorte(nMensajes)}`
            : `<p class="empty-state">${quien} escrito ningún mensaje en el foro.</p>`
        }
      </section>
      <section>
        <h3 class="foro-act-titular">${icons.messageSquare(15)} Comentarios en noticias y guías <span>${nComentarios}</span></h3>
        ${
          listaComentarios.length
            ? `<ul class="foro-act-lista">${listaComentarios.map((c) => filaComentario(c, articuloPorId)).join('')}</ul>${recorte(nComentarios)}`
            : `<p class="empty-state">${quien} comentado ninguna noticia ni guía.</p>`
        }
      </section>
    </div>`
}
