// EL FORO COMO UNA APP DE MENSAJES, la lista (746, J1 de la lista de
// propuestas). El índice eran tarjetas altas por foro: para ver qué se
// estaba hablando había que entrar en cada uno. Arriba va ahora una lista
// densa de CONVERSACIONES —los hilos con movimiento, de todos los foros—:
// el avatar de quien escribió lo último, el título, de qué foro es, un
// trozo de la última respuesta y un punto en lo que no has leído. Y chips:
// «Todo», «Para ti» (donde has escrito), «Siguiendo» y uno por foro. El
// índice de siempre sigue debajo, para quien quiere ir por foros.
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial } from './app.js'
import { haceCuanto, nombreDe, urlTema, perfilesPorId } from './foro-comun.js'
import { estaSinLeer } from './foro-lecturas.js'

export const CUANTAS = 30

// El texto de un mensaje, sin etiquetas y recortado. Puro.
export function fragmento(html, max = 90) {
  const t = String(html || '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

// Qué temas deja pasar un chip. Puro.
export function filtrar(temas, filtro, { mios = new Set(), sigo = new Set() } = {}) {
  if (filtro === 'para-ti') return temas.filter((t) => mios.has(t.id) || t.author_id === mios.yo)
  if (filtro === 'siguiendo') return temas.filter((t) => sigo.has(t.id))
  if (filtro && filtro.startsWith('foro:')) return temas.filter((t) => t.board_id === filtro.slice(5))
  return temas
}

// El último mensaje de cada tema, de una lista ordenada de más nuevo a más
// viejo. Puro.
export function ultimosPorTema(posts) {
  const m = new Map()
  for (const p of posts || []) if (!m.has(p.thread_id)) m.set(p.thread_id, p)
  return m
}

// El avatar como <span> y no como el <a> de `avatarHtml`: la fila entera ya
// es un enlace, y un <a> dentro de otro el navegador lo parte en dos.
function avatarSpan(perfil, tamano) {
  const estilo = `width:${tamano}px; height:${tamano}px; font-size:${Math.round(tamano * 0.45)}px; ${avatarStyle(perfil)}`
  return `<span class="mini-avatar" style="${estilo}" aria-hidden="true">${perfil?.avatar_url ? '' : escapeHtml(getInitial(nombreDe(perfil)))}</span>`
}

export function filaHtml(t, { perfiles = {}, foros = new Map(), ultimos = new Map(), marcas = null } = {}) {
  const ultimo = ultimos.get(t.id)
  const quien = perfiles[ultimo?.author_id || t.last_post_author_id || t.author_id]
  const sinLeer = estaSinLeer(t, marcas)
  const destino = sinLeer ? `${urlTema(t.id)}?nuevo=1` : urlTema(t.id)
  const trozo = ultimo ? fragmento(ultimo.body_html) : ''
  return `<a class="foro-conv${sinLeer ? ' foro-conv-nueva' : ''}" href="${destino}">
    ${avatarSpan(quien, 40)}
    <span class="foro-conv-cuerpo">
      <span class="foro-conv-arriba"><b>${escapeHtml(t.title)}</b><time datetime="${escapeHtml(t.last_post_at || '')}">${escapeHtml(haceCuanto(t.last_post_at))}</time></span>
      <span class="foro-conv-abajo">${foros.get(t.board_id) ? `<span class="foro-conv-foro">${escapeHtml(foros.get(t.board_id))}</span>` : ''}<span class="foro-conv-trozo">${trozo ? `${escapeHtml(nombreDe(quien))}: ${escapeHtml(trozo)}` : ''}</span></span>
    </span>
    ${sinLeer ? '<span class="foro-conv-punto" aria-label="Sin leer"></span>' : ''}
  </a>`
}

export function chipsHtml(filtro, { conSesion = false, foros = [] } = {}) {
  const chip = (id, texto) => `<button type="button" class="foro-conv-chip" data-conv-filtro="${escapeHtml(id)}" aria-pressed="${filtro === id ? 'true' : 'false'}">${escapeHtml(texto)}</button>`
  return [chip('todo', 'Todo'), ...(conSesion ? [chip('para-ti', 'Para ti'), chip('siguiendo', 'Siguiendo')] : []), ...foros.map((f) => chip(`foro:${f.id}`, f.name))].join('')
}

// Monta la lista en `caja`. `foros` son los del índice (id, name, parent_id).
export async function montarConversaciones(caja, { supabase, sesion = null, marcas = null, foros = [] }) {
  if (!caja) return null
  const uid = sesion?.user?.id || null
  const nombres = new Map(foros.map((f) => [f.id, f.name]))
  const { data: temas, error } = await supabase
    .from('forum_threads')
    .select('id, title, board_id, author_id, last_post_at, last_post_author_id, post_count')
    .order('last_post_at', { ascending: false })
    .limit(CUANTAS)
  // Sin poder preguntar, la lista no sale: el índice de debajo sigue.
  if (error) {
    caja.hidden = true
    return null
  }
  const lista = (temas || []).filter((t) => nombres.has(t.board_id))
  if (!lista.length) {
    caja.hidden = true
    return null
  }
  const ids = lista.map((t) => t.id)
  const [posts, mios, sigo] = await Promise.all([
    supabase.from('forum_posts').select('thread_id, author_id, body_html, created_at').in('thread_id', ids).order('created_at', { ascending: false }).limit(300).then((r) => r.data || [], () => []),
    uid ? supabase.from('forum_posts').select('thread_id').eq('author_id', uid).in('thread_id', ids).then((r) => new Set((r.data || []).map((p) => p.thread_id)), () => new Set()) : new Set(),
    uid ? supabase.from('forum_subscriptions').select('thread_id').eq('user_id', uid).then((r) => new Set((r.data || []).map((s) => s.thread_id)), () => new Set()) : new Set(),
  ])
  mios.yo = uid
  const ultimos = ultimosPorTema(posts)
  const perfiles = await perfilesPorId([...lista.map((t) => t.author_id), ...lista.map((t) => t.last_post_author_id), ...[...ultimos.values()].map((p) => p.author_id)])
  // Los chips de foro, solo de los que tienen algo en la lista.
  const conAlgo = foros.filter((f) => lista.some((t) => t.board_id === f.id))
  let filtro = 'todo'
  const pintar = () => {
    const vistas = filtrar(lista, filtro, { mios, sigo })
    caja.innerHTML = `<h2 class="foro-seccion-titulo">Conversaciones</h2>
      <div class="foro-conv-chips" role="group" aria-label="Qué conversaciones ver">${chipsHtml(filtro, { conSesion: !!uid, foros: conAlgo })}</div>
      <div class="foro-conv-lista">${vistas.length ? vistas.map((t) => filaHtml(t, { perfiles, foros: nombres, ultimos, marcas })).join('') : `<p class="subtext foro-conv-vacio">${filtro === 'para-ti' ? 'Todavía no has escrito en ninguna de estas.' : filtro === 'siguiendo' ? 'No sigues ninguna de estas. Dale a «Seguir» dentro de un tema.' : 'Nada por aquí.'}</p>`}</div>`
  }
  pintar()
  caja.hidden = false
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-conv-filtro]')
    if (!b) return
    filtro = b.dataset.convFiltro
    pintar()
  })
  return { lista }
}
