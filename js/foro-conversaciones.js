// LAS FILAS DE CONVERSACIÓN del foro (746, rehecho en la 804).
//
// En la 746 el índice abría con una lista de conversaciones de todos los
// foros, con chips «Para ti» y «Siguiendo»; debajo seguía el índice de
// siempre. PINGU: «es un poco lioso… para eso mantener mejor el foro como
// estaba antes, y cada tema que sea como lo nuevo». Desde la 804 el índice
// es el clásico y la forma de conversación (quién dijo lo último, un trozo
// y el punto de lo no leído) la lleva la lista de temas de CADA foro. Aquí
// quedan las piezas puras que esa lista usa.
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial } from './app.js'
import { nombreDe } from './foro-comun.js'

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

// El último mensaje de cada tema, de una lista ordenada de más nuevo a más
// viejo. Puro.
export function ultimosPorTema(posts) {
  const m = new Map()
  for (const p of posts || []) if (!m.has(p.thread_id)) m.set(p.thread_id, p)
  return m
}

// El avatar como <span> y no como el <a> de `avatarHtml`: la fila entera ya
// es un enlace, y un <a> dentro de otro el navegador lo parte en dos.
export function avatarSpan(perfil, tamano) {
  const estilo = `width:${tamano}px; height:${tamano}px; font-size:${Math.round(tamano * 0.45)}px; ${avatarStyle(perfil)}`
  return `<span class="mini-avatar" style="${estilo}" aria-hidden="true">${perfil?.avatar_url ? '' : escapeHtml(getInitial(nombreDe(perfil)))}</span>`
}
