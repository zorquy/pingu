import { supabase } from './supabase.js'
import { escapeHtml, getInitial, profileUrl, avatarStyle } from './app.js'
import { contributorCounts, badgeHtml } from './contributor-badge.js'

// Lo que repiten las tres pantallas del foro (índice, lista de temas y
// tema): fechas, gente y la firma del autor.

export function haceCuanto(iso) {
  if (!iso) return ''
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

// Fecha completa para el título emergente: "hace 3 h" está bien para
// leer de un vistazo, pero a veces hace falta saber el día exacto.
export function fechaLarga(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
}

export function nombreDe(perfil) {
  return perfil?.display_name || perfil?.username || 'Alguien'
}

export async function perfilesPorId(ids) {
  const unicos = [...new Set((ids || []).filter(Boolean))]
  if (unicos.length === 0) return {}
  const { data } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, level, total_xp')
    .in('id', unicos)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

export function avatarHtml(perfil, tamano = 20) {
  const nombre = nombreDe(perfil)
  const estilo = `width:${tamano}px; height:${tamano}px; font-size:${Math.round(tamano * 0.45)}px; ${avatarStyle(perfil)}`
  const contenido = perfil?.avatar_url ? '' : escapeHtml(getInitial(nombre))
  if (!perfil) return `<span class="mini-avatar" style="${estilo}">${contenido}</span>`
  return `<a class="mini-avatar" href="${profileUrl(perfil)}" style="${estilo}">${contenido}</a>`
}

export function enlacePerfil(perfil) {
  const nombre = escapeHtml(nombreDe(perfil))
  return perfil ? `<a href="${profileUrl(perfil)}">${nombre}</a>` : `<span>${nombre}</span>`
}

// El rango de colaborador de varias personas de una vez. Se reexporta
// desde aquí para que las pantallas del foro no tengan que saber de dónde
// sale.
export { contributorCounts, badgeHtml }

// La etiqueta que va delante del título del tema ([Duda], [Oficial]...).
export function etiquetaHtml(prefix) {
  if (!prefix) return ''
  return `<span class="foro-etiqueta">${escapeHtml(prefix)}</span>`
}

// Las etiquetas que se pueden elegir al abrir un tema (y al editarlo).
// Viven aquí y no en foro.js porque se eligen en dos pantallas: al crear
// el tema (foro.js) y al editar su título (tema.js) — dos listas se
// desincronizarían a la primera.
//
// Pensadas para lo que se habla en una comunidad de TCG: además de las
// genéricas (duda, debate...), las de enseñar la colección, mover cartas
// (intercambio y compraventa) y jugar (mazos, torneos).
export const ETIQUETAS = [
  'Duda',
  'Ayuda',
  'Debate',
  'Opinión',
  'Noticia',
  'Guía',
  'Muestra',
  'Colección',
  'Intercambio',
  'Compra/Venta',
  'Mazo',
  'Torneo',
  'Encuesta',
  'Off-topic',
]

// Un tema y un foro se enlazan siempre igual. Las rutas bonitas
// (/foro/<slug> y /tema/<id>) las resuelve netlify.toml.
export const urlForo = (slug) => `/foro/${encodeURIComponent(slug)}`
export const urlTema = (id, pagina) => `/tema/${encodeURIComponent(id)}${pagina && pagina > 1 ? `?p=${pagina}` : ''}`

// De dónde se saca QUÉ foro o QUÉ tema hay que pintar.
//
// netlify.toml reescribe /foro/<slug> a /foro.html?f=<slug> con estado
// 200. Una reescritura NO cambia la barra de direcciones: el navegador
// se queda en /foro/<slug>, así que ese `?f=` lo ve el servidor y no lo
// ve JavaScript — `window.location.search` está vacío. Si solo se mirara
// la query, entrar en un foro llevaría siempre al índice general.
//
// Por eso manda la RUTA, y la query queda como alternativa para cuando se
// entra directo a foro.html (y en local, donde no hay reescrituras). Es
// lo mismo que hace profileParamsFromLocation() con /usuario/<nombre>.
export function foroDeLaRuta() {
  const enLaRuta = window.location.pathname.match(/\/foro\/([^/?#]+)/)
  if (enLaRuta) return decodeURIComponent(enLaRuta[1])
  return new URLSearchParams(window.location.search).get('f')
}

export function temaDeLaRuta() {
  const enLaRuta = window.location.pathname.match(/\/tema\/([^/?#]+)/)
  if (enLaRuta) return decodeURIComponent(enLaRuta[1])
  return new URLSearchParams(window.location.search).get('t')
}

// "Del equipo" es administración O moderación. Un moderador ordena el
// foro (fijar, cerrar, borrar, editar) sin tener las llaves del panel de
// administración entero.
//
// Si la migración de títulos todavía no está puesta, `is_moderator` no
// existe y la consulta falla entera: se reintenta con lo que sí hay, para
// que el foro siga funcionando mientras tanto.
export async function esDelEquipo(sesion) {
  if (!sesion) return false
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin, is_moderator')
    .eq('id', sesion.user.id)
    .maybeSingle()
  if (!error) return !!(data?.is_admin || data?.is_moderator)

  const { data: solo } = await supabase.from('user_profiles').select('is_admin').eq('id', sesion.user.id).maybeSingle()
  return !!solo?.is_admin
}

// Cuando falta la migración no se enseña un error de base de datos: se
// dice lo que pasa, en cristiano.
export function faltaElForo(error) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /forum_/.test(`${error.message || ''} ${error.details || ''}`)
  )
}
