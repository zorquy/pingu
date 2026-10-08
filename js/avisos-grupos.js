// Los avisos de la campana, agrupados (736, X11 de la lista de propuestas).
//
// Diez reacciones al mismo mensaje eran diez filas iguales, y tapaban la
// respuesta que sí importaba. Ahora lo que habla de LO MISMO —mismo tipo y
// mismo enlace— es una fila con su cuenta («5 reacciones a tu mensaje»),
// y las filas van por tramos: hoy, ayer, esta semana, antes.
//
// Los seguidores se juntan por tipo aunque el enlace sea distinto: cada
// uno enlaza a SU perfil, y «Te siguen 4 personas nuevas» es la noticia,
// no cuatro filas de «Nuevo seguidor». (Los del muro no: los de TU muro ya
// comparten enlace, y una mención en el muro de otro va a otro sitio.)
// Las reglas son puras (las prueba node sin navegador); el pintado va
// aquí también para que la campana, que baja la portada, no cargue con él.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'

const POR_TIPO = new Set(['new_follower'])

// El título de un grupo de N. Lo que no está aquí dice el título del más
// nuevo y cuántos más hay: nunca se inventa una frase para un tipo que no
// se conoce.
const TITULOS = {
  guide_comment: (n) => `${n} comentarios nuevos en tu guía`,
  comment_reply: (n) => `${n} respuestas a tu comentario`,
  guide_rating: (n) => `${n} valoraciones nuevas en tu guía`,
  guide_helpful: (n) => `A ${n} personas les ha servido tu guía`,
  guide_suggestion: (n) => `${n} correcciones sugeridas en tu guía`,
  forum_reply: (n) => `${n} mensajes nuevos para ti en este tema`,
  forum_reaction: (n) => `${n} reacciones a tu mensaje`,
  new_follower: (n) => `Te siguen ${n} personas nuevas`,
  wall_comment: (n) => `${n} comentarios en tu muro`,
  trade_match: (n) => `${n} personas dan cartas que buscas`,
  trade_match_seguido: (n) => `${n} personas que sigues dan cartas que buscas`,
  torneo_partida: (n) => `${n} avisos de tu partida`,
}

// Las respuestas de un mismo tema llevan cada una el ancla de SU mensaje
// (`/tema/12#mensaje-80`): sin quitarla no se juntaría ninguna. Las
// reacciones sí la conservan: son a UN mensaje, y el título lo dice.
const sinAncla = (link) => String(link || '').split('#')[0]

const DIA = 86_400_000
const medianoche = (t) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// En qué tramo cae una fecha, contado en días de calendario y no en horas:
// un aviso de las 23:50 de ayer es de «Ayer» aunque sean las 00:10.
export function tramoDe(iso, ahora = Date.now()) {
  const hoy = medianoche(ahora)
  const t = new Date(iso).getTime()
  if (t >= hoy) return 'Hoy'
  if (t >= hoy - DIA) return 'Ayer'
  if (t >= hoy - 6 * DIA) return 'Esta semana'
  return 'Antes'
}

export const TRAMOS = ['Hoy', 'Ayer', 'Esta semana', 'Antes']

// [{ tramo, grupos: [{ ids, tipo, link, titulo, cuerpo, fecha, n, leido }] }]
// La lista llega de la más nueva a la más vieja (así la pide la campana) y
// el grupo cae en el tramo de su aviso MÁS NUEVO: cinco reacciones de esta
// semana con una de hoy son una noticia de hoy.
export function agruparAvisos(lista, ahora = Date.now()) {
  const grupos = new Map()
  for (const a of lista || []) {
    const clave = POR_TIPO.has(a.type) ? a.type : `${a.type}|${a.type === 'forum_reaction' ? a.link || '' : sinAncla(a.link)}`
    const g = grupos.get(clave)
    if (g) {
      g.ids.push(a.id)
      g.titulos.push(a.title)
      // Van de la más nueva a la más vieja: el enlace del grupo acaba
      // siendo el del PRIMER mensaje sin leer, que es por donde se lee.
      if (a.link) g.link = a.link
      if (!a.read_at) g.leido = false
      continue
    }
    grupos.set(clave, { ids: [a.id], tipo: a.type, link: a.link || null, titulos: [a.title], cuerpo: a.body || null, fecha: a.created_at, leido: Boolean(a.read_at) })
  }
  const salida = TRAMOS.map((tramo) => ({ tramo, grupos: [] }))
  for (const g of grupos.values()) {
    const n = g.ids.length
    // Juntos por tipo, el cuerpo y el enlace de uno solo (un nombre, SU
    // perfil) no describen al grupo: el cuerpo se quita y se va a tu
    // perfil, que es donde está la lista de quien te sigue.
    const juntoPorTipo = POR_TIPO.has(g.tipo) && n > 1
    const titulo = n === 1 ? g.titulos[0] : TITULOS[g.tipo]?.(n) || `${g.titulos[0]} (y ${n - 1} más)`
    const link = juntoPorTipo ? '/perfil.html' : g.link
    salida[TRAMOS.indexOf(tramoDe(g.fecha, ahora))].grupos.push({ ids: g.ids, tipo: g.tipo, link, titulo, cuerpo: juntoPorTipo ? null : g.cuerpo, fecha: g.fecha, n, leido: g.leido })
  }
  return salida.filter((t) => t.grupos.length)
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(iso).toLocaleDateString('es-ES')
}

// Una fila es un GRUPO: al pulsarla se marcan leídos todos los suyos.
function filaDeGrupo(g) {
  return `
    <a class="nav-bell-item${g.leido ? '' : ' unread'}" href="${escapeHtml(g.link || '#')}" data-notif-id="${escapeHtml(g.ids[0])}" data-notif-ids="${escapeHtml(g.ids.join(','))}">
      <span class="nav-bell-item-title">${escapeHtml(g.titulo)}${g.n > 1 ? ` <span class="nav-bell-cuenta">${g.n}</span>` : ''}</span>
      ${g.cuerpo ? `<span class="nav-bell-item-body">${escapeHtml(g.cuerpo)}</span>` : ''}
      <span class="nav-bell-item-date">${timeAgo(g.fecha)}</span>
    </a>`
}

// El HTML de la lista entera de la campana.
export function listaDeAvisos(lista) {
  if (!lista?.length) return `<p class="empty-state" style="padding:16px;">Estás al día. No tienes avisos sin leer.</p>`
  hojaInyectada('css/avisos.css')
  return agruparAvisos(lista)
    .map((t) => `<p class="nav-bell-tramo">${escapeHtml(t.tramo)}</p>${t.grupos.map(filaDeGrupo).join('')}`)
    .join('')
}
