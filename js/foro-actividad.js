import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'
import { haceCuanto, fechaLarga, etiquetaHtml, urlForo, urlTema, faltaElForo } from './foro-comun.js'

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

  const [{ data: temas, error }, { data: mensajes }] = await Promise.all([
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
  ])

  if (faltaElForo(error)) {
    contenedor.innerHTML = ''
    return
  }

  const listaTemas = temas || []
  const listaMensajes = mensajes || []

  // El primer mensaje de un tema ES el tema: enseñarlo también en la lista
  // de mensajes sería contar dos veces lo mismo. Se piden los mensajes de
  // sus temas ordenados y se aparta el primero de cada uno.
  let aperturas = new Set()
  if (listaTemas.length) {
    const { data: suyos } = await supabase
      .from('forum_posts')
      .select('id, thread_id, created_at')
      .in('thread_id', listaTemas.map((t) => t.id))
      .order('created_at', { ascending: true })
    const primeroDe = {}
    for (const p of suyos || []) if (!primeroDe[p.thread_id]) primeroDe[p.thread_id] = p.id
    aperturas = new Set(Object.values(primeroDe))
  }
  const respuestas = listaMensajes.filter((m) => !aperturas.has(m.id))

  const [{ data: foros }, { data: temasDeMensajes }] = await Promise.all([
    listaTemas.length
      ? supabase.from('forum_boards').select('id, name, slug').in('id', [...new Set(listaTemas.map((t) => t.board_id))])
      : Promise.resolve({ data: [] }),
    respuestas.length
      ? supabase.from('forum_threads').select('id, title').in('id', [...new Set(respuestas.map((m) => m.thread_id))])
      : Promise.resolve({ data: [] }),
  ])

  const foroPorId = Object.fromEntries((foros || []).map((f) => [f.id, f]))
  const temaPorId = Object.fromEntries((temasDeMensajes || []).map((t) => [t.id, t]))

  const quien = esMio ? 'Todavía no has' : 'Todavía no ha'
  contenedor.innerHTML = `
    <div class="foro-act-columnas">
      <section>
        <h3 class="foro-act-titular">${icons.messageSquare(15)} Temas abiertos <span>${listaTemas.length}</span></h3>
        ${
          listaTemas.length
            ? `<ul class="foro-act-lista">${listaTemas.map((t) => filaTema(t, foroPorId)).join('')}</ul>`
            : `<p class="empty-state">${quien} abierto ningún tema en el foro.</p>`
        }
      </section>
      <section>
        <h3 class="foro-act-titular">${icons.quote(15)} Mensajes <span>${respuestas.length}</span></h3>
        ${
          respuestas.length
            ? `<ul class="foro-act-lista">${respuestas.map((m) => filaMensaje(m, temaPorId)).join('')}</ul>`
            : `<p class="empty-state">${quien} escrito ningún mensaje en el foro.</p>`
        }
      </section>
    </div>`
}
