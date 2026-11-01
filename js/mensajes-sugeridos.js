// «Con quién podrías hablar» (tanda 1167, M3 de «PokeDoc entera»).
//
// Sin conversaciones, Mensajes decía «elige una conversación de la lista»
// con la lista vacía al lado. Para empezar a hablar había que saber a quién
// buscar. Esto saca hasta seis personas de tres sitios, con el motivo:
//   · tienen cartas que buscas (`intercambios_quien_tiene`, la de Cruces),
//   · las sigues (`user_follows`),
//   · están en un torneo contigo (`tournament_registrations` de tus torneos
//     en marcha).
// Por `import()` desde mensajes.js: solo lo baja quien no tiene conversaciones.
import { supabase } from './supabase.js'
import { escapeHtml, getInitial, avatarStyle } from './app.js'
import { sugerir } from './mensajes-sugeridos-puro.js'
import { COLUMNAS_RANGO, atributosDeRango } from './rangos.js'

export { sugerir }

async function pedir(sesion) {
  const yo = sesion.user.id
  const [tienen, seguidas, torneos] = await Promise.all([
    supabase.rpc('intercambios_quien_tiene', { p_limite: 60 }).then((r) => r.data || []).catch(() => []),
    supabase.from('user_follows').select('following_id').eq('follower_id', yo).limit(30)
      .then(async ({ data }) => {
        const ids = (data || []).map((f) => f.following_id)
        if (!ids.length) return []
        const { data: perfiles } = await supabase.from('user_profiles').select(`id, username, display_name, avatar_url, ${COLUMNAS_RANGO}`).in('id', ids).limit(30)
        return (perfiles || []).map((p) => ({ ...p, user_id: p.id }))
      }).catch(() => []),
    supabase.from('tournament_registrations').select('tournament_id').eq('user_id', yo).eq('status', 'active').limit(10)
      .then(async ({ data }) => {
        const ids = (data || []).map((r) => r.tournament_id)
        if (!ids.length) return []
        const [{ data: otros }, { data: ts }] = await Promise.all([
          supabase.from('tournament_registrations').select('tournament_id, user_id').in('tournament_id', ids).eq('status', 'active').neq('user_id', yo).limit(60),
          supabase.from('tournaments').select('id, name').in('id', ids),
        ])
        const nombreDe = new Map((ts || []).map((t) => [t.id, t.name]))
        const gente = (otros || []).filter((r) => nombreDe.has(r.tournament_id))
        if (!gente.length) return []
        const { data: perfiles } = await supabase.from('user_profiles').select(`id, username, display_name, avatar_url, ${COLUMNAS_RANGO}`).in('id', [...new Set(gente.map((g) => g.user_id))]).limit(60)
        const perfil = new Map((perfiles || []).map((p) => [p.id, p]))
        return gente.map((g) => ({ ...(perfil.get(g.user_id) || {}), user_id: g.user_id, torneo: nombreDe.get(g.tournament_id) })).filter((p) => p.username)
      }).catch(() => []),
  ])
  return sugerir({ tienen, seguidas, torneos, yo })
}

export function sugeridosHtml(gente) {
  if (!gente.length) return ''
  return `<section class="msg-sugeridos" aria-label="Con quién podrías hablar">
    <h2 class="msg-sugeridos-titulo">Con quién podrías hablar</h2>
    <div class="msg-sugeridos-lista">${gente.map((p) => `
      <div class="msg-sugerido">
        <span class="mini-avatar msg-sugerido-avatar" style="${avatarStyle(p)}" data-en-linea="${escapeHtml(p.user_id)}">${p.avatar_url ? '' : getInitial(p.display_name)}</span>
        <strong class="msg-sugerido-nombre"${atributosDeRango(p)}>${escapeHtml(p.display_name)}</strong>
        <span class="msg-sugerido-motivo">${escapeHtml(p.motivo)}</span>
        <a class="btn-secondary msg-sugerido-escribir" href="/mensajes.html?with=${encodeURIComponent(p.user_id)}">Escribirle</a>
      </div>`).join('')}</div>
    <p class="subtext msg-sugeridos-pie">O busca a cualquiera con «Nueva conversación».</p>
  </section>`
}

// Pinta las sugerencias en `caja` (si hay alguien) y devuelve cuántas.
export async function pintarSugeridos(caja, sesion) {
  if (!caja || !sesion) return 0
  const gente = await pedir(sesion).catch(() => [])
  caja.innerHTML = sugeridosHtml(gente)
  if (gente.length) import('./en-linea.js').then((m) => m.marcarEnLinea(caja)).catch(() => {})
  return gente.length
}
