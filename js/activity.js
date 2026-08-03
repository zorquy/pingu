import { supabase } from './supabase.js'
import { escapeHtml, getInitial, profileUrl } from './app.js'
import { icons } from './icons.js'

// Hilo de actividad reciente. No hay tabla de eventos: se arma leyendo
// lo que ya existe (progreso, guías, comentarios, altas) y mezclando por
// fecha. Así no hay nada que escribir en cada acción ni un registro que
// se pueda desincronizar con la realidad.
//
// Quien tenga `hide_activity` no aparece. Para `user_progress` eso ya lo
// impone RLS (ver supabase-migration-actividad.sql), pero el resto de
// fuentes son de lectura pública, así que hay que filtrarlas aquí.

const POR_FUENTE = 20

function haceCuanto(iso) {
  const segundos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (segundos < 60) return 'hace un momento'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
}

export async function loadActivity(limite = 20) {
  const desde = new Date(Date.now() - 60 * 86400_000).toISOString()

  const [progreso, guiasNuevas, comentarios, altas] = await Promise.all([
    supabase
      .from('user_progress')
      .select('user_id, guide_id, status, completed_at, read_at')
      .or(`completed_at.gte.${desde},read_at.gte.${desde}`)
      .limit(POR_FUENTE * 2),
    supabase
      .from('guides')
      .select('id, title, slug, author_id, published_at')
      .not('published_at', 'is', null)
      .not('author_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(POR_FUENTE),
    supabase
      .from('guide_comments')
      .select('id, author_id, guide_id, created_at')
      .order('created_at', { ascending: false })
      .limit(POR_FUENTE),
    supabase
      .from('user_profiles')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(POR_FUENTE),
  ])

  const eventos = []
  for (const p of progreso.data || []) {
    if (p.status === 'completed' && p.completed_at) {
      eventos.push({ tipo: 'curso', userId: p.user_id, guideId: p.guide_id, fecha: p.completed_at })
    } else if (p.read_at) {
      eventos.push({ tipo: 'lectura', userId: p.user_id, guideId: p.guide_id, fecha: p.read_at })
    }
  }
  for (const g of guiasNuevas.data || []) {
    eventos.push({ tipo: 'guia', userId: g.author_id, guideId: g.id, fecha: g.published_at })
  }
  for (const c of comentarios.data || []) {
    eventos.push({ tipo: 'comentario', userId: c.author_id, guideId: c.guide_id, fecha: c.created_at })
  }
  for (const u of altas.data || []) {
    if (u.created_at) eventos.push({ tipo: 'alta', userId: u.id, fecha: u.created_at })
  }

  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  // Se piden más de los necesarios y se recorta al final, porque parte se
  // caerá al filtrar a quien se ha escondido o a guías ya despublicadas.
  const candidatos = eventos.slice(0, limite * 3)
  const userIds = [...new Set(candidatos.map((e) => e.userId).filter(Boolean))]
  const guideIds = [...new Set(candidatos.map((e) => e.guideId).filter(Boolean))]

  const [{ data: perfiles }, { data: guias }] = await Promise.all([
    userIds.length
      ? supabase.from('user_profiles').select('id, username, display_name, avatar_url, avatar_color, hide_activity').in('id', userIds)
      : Promise.resolve({ data: [] }),
    guideIds.length
      ? supabase.from('guides').select('id, title, slug').in('id', guideIds)
      : Promise.resolve({ data: [] }),
  ])

  const perfilPorId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
  const guiaPorId = Object.fromEntries((guias || []).map((g) => [g.id, g]))

  // Con poca gente, alguien que se lee cinco guías seguidas llena el hilo
  // él solo y parece que no hay nadie más. Se limita cuánto puede ocupar
  // cada persona para que se vea variedad.
  const MAX_POR_PERSONA = 3
  const usadosPorPersona = {}

  return candidatos
    .filter((e) => {
      const perfil = perfilPorId[e.userId]
      if (!perfil || perfil.hide_activity) return false
      // Una guía borrada o despublicada deja eventos huérfanos que no se
      // pueden enlazar a ningún sitio.
      if (e.guideId && !guiaPorId[e.guideId]) return false
      const usados = usadosPorPersona[e.userId] || 0
      if (usados >= MAX_POR_PERSONA) return false
      usadosPorPersona[e.userId] = usados + 1
      return true
    })
    .slice(0, limite)
    .map((e) => ({ ...e, perfil: perfilPorId[e.userId], guia: e.guideId ? guiaPorId[e.guideId] : null }))
}

const TEXTOS = {
  curso: { icono: 'graduationCap', verbo: 'ha completado el curso' },
  lectura: { icono: 'bookOpen', verbo: 'se ha leído' },
  guia: { icono: 'sparkles', verbo: 'ha publicado la guía' },
  comentario: { icono: 'messageSquare', verbo: 'ha comentado en' },
  alta: { icono: 'user', verbo: 'se ha unido a PokeDoc' },
}

function eventoHtml(e) {
  const t = TEXTOS[e.tipo]
  const nombre = e.perfil?.display_name || e.perfil?.username || 'Alguien'
  const estiloAvatar = e.perfil?.avatar_url
    ? `background-image:url('${e.perfil.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${e.perfil?.avatar_color || 'var(--navy)'}`
  const destino = e.guia
    ? ` <a href="/guia.html?slug=${encodeURIComponent(e.guia.slug)}">${escapeHtml(e.guia.title)}</a>`
    : ''
  return `
    <li class="activity-item">
      <a class="mini-avatar activity-avatar" href="${profileUrl(e.perfil)}" style="${estiloAvatar}">${
        e.perfil?.avatar_url ? '' : getInitial(nombre)
      }</a>
      <div class="activity-body">
        <p><a href="${profileUrl(e.perfil)}" class="activity-name">${escapeHtml(nombre)}</a> ${t.verbo}${destino}</p>
        <span class="activity-when">${haceCuanto(e.fecha)}</span>
      </div>
      <span class="activity-icon" aria-hidden="true">${icons[t.icono](15)}</span>
    </li>`
}

export function renderActivityHtml(eventos, { vacio = 'Todavía no hay actividad. ¡Sé el primero!' } = {}) {
  if (eventos.length === 0) return `<p class="empty-state">${escapeHtml(vacio)}</p>`
  return `<ul class="activity-list">${eventos.map(eventoHtml).join('')}</ul>`
}
