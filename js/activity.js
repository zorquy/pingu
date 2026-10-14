import { supabase } from './supabase.js'
import { conVueltaAtrasDeTipo } from './articulos.js'
import { logClientError } from './error-log.js'
import { COLUMNAS_RANGO } from './rangos.js'

// Hilo de actividad reciente. No hay tabla de eventos: se arma leyendo
// lo que ya existe (progreso, guías —publicadas y en revisión—,
// comentarios, altas, peticiones y temas) y mezclando por
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

const publicadas = (columnas) =>
  supabase
    .from('guides')
    .select(columnas)
    .not('published_at', 'is', null)
    .not('author_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(POR_FUENTE)

export async function loadActivity(limite = 20) {
  const desde = new Date(Date.now() - 60 * 86400_000).toISOString()

  const [progreso, guiasNuevas, guiasEnCamino, comentarios, altas, peticiones, temas] = await Promise.all([
    supabase
      .from('user_progress')
      .select('user_id, guide_id, status, completed_at, read_at')
      .or(`completed_at.gte.${desde},read_at.gte.${desde}`)
      .limit(POR_FUENTE * 2),
    // `kind` y `forum_thread_id` son de la tanda 289: hace falta saber si
    // lo publicado es una guía o una NOTICIA, y cuál es el hilo que la
    // noticia abrió sola para no contar dos veces lo mismo.
    conVueltaAtrasDeTipo(
      () => publicadas('id, title, slug, author_id, published_at, kind, forum_thread_id'),
      () => publicadas('id, title, slug, author_id, published_at')
    ),
    // Las que están EN CAMINO, no solo las publicadas.
    //
    // Escribir una guía lleva días y hasta ahora no se veía por ninguna
    // parte hasta que el equipo la aprobaba: quien la estaba escribiendo
    // no recibía ni una señal de que alguien se hubiera enterado. En una
    // comunidad que arranca, eso es justo lo que hay que premiar.
    //
    // Se piden las que están en revisión y NO los borradores: enviar a
    // revisión es un acto deliberado de "esto ya lo enseño", mientras que
    // un borrador a medias es privado y anunciarlo sería sacarlo sin
    // permiso. Por eso el filtro es `submitted_at is not null` además del
    // estado.
    //
    // Se pueden leer y enlazar sin problema: la política `guides_select`
    // deja ver las `pending` a propósito (ver
    // supabase-migration-community-guides.sql) y guia.html ya pinta el
    // aviso de "pendiente de revisión".
    supabase
      .from('guides')
      .select('id, title, slug, author_id, submitted_at')
      .eq('review_status', 'pending')
      .not('submitted_at', 'is', null)
      .not('author_id', 'is', null)
      .order('submitted_at', { ascending: false })
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
    // Pedir una guía también es actividad de la comunidad: es de las
    // cosas más baratas de hacer y de las que más ganas dan de entrar a
    // ver. Si la tabla todavía no existe (migración sin ejecutar), la
    // consulta falla y el resto del hilo sigue igual.
    supabase
      .from('guide_requests')
      .select('id, title, requester_id, created_at')
      .order('created_at', { ascending: false })
      .limit(POR_FUENTE),
    // Abrir un tema en el foro es de lo que más movimiento genera, así
    // que tiene que salir aquí. Solo los temas, no cada respuesta: si
    // entraran los mensajes, una conversación animada taparía todo lo
    // demás del hilo.
    supabase
      .from('forum_threads')
      .select('id, title, author_id, created_at')
      .order('created_at', { ascending: false })
      .limit(POR_FUENTE),
  ])

  // Qué fuentes NO han contestado.
  //
  // Las siete consultas se leían con `.data || []` y nadie miraba el
  // error: si una fallaba —falta una migración, la RLS no deja leer, se
  // cayó la red— el hilo enseñaba "todavía no hay actividad". Es la
  // misma mentira que decía la analítica, y encima en la pantalla donde
  // se mira si la comunidad está viva.
  //
  // El detalle técnico no se le enseña a quien visita: va al registro de
  // errores, que es donde el equipo puede verlo. Lo que cambia en
  // pantalla es solo que deja de afirmarse que no hay nada.
  const fallos = [
    ['user_progress', progreso.error],
    ['guides', guiasNuevas.error],
    ['guides (en revisión)', guiasEnCamino.error],
    ['guide_comments', comentarios.error],
    ['user_profiles', altas.error],
    ['guide_requests', peticiones.error],
    ['forum_threads', temas.error],
  ].filter(([, error]) => error)

  if (fallos.length) {
    logClientError(
      `Hilo de actividad: ${fallos.length} de 7 fuentes han fallado — ` +
        fallos.map(([tabla, error]) => `${tabla}: ${error.message || 'error'}`).join('; ')
    )
  }

  const eventos = []
  for (const p of progreso.data || []) {
    if (p.status === 'completed' && p.completed_at) {
      eventos.push({ tipo: 'curso', userId: p.user_id, guideId: p.guide_id, fecha: p.completed_at })
    } else if (p.read_at) {
      eventos.push({ tipo: 'lectura', userId: p.user_id, guideId: p.guide_id, fecha: p.read_at })
    }
  }
  // El hilo del foro que abre sola una noticia (tanda 273) NO es un tema
  // que haya abierto nadie: sale del mismo botón de publicar. Contarlo
  // aparte llenaba el hilo con la misma noticia dos veces seguidas.
  const hilosDeNoticia = new Set(
    (guiasNuevas.data || []).filter((g) => g.kind === 'news' && g.forum_thread_id).map((g) => String(g.forum_thread_id))
  )
  for (const g of guiasNuevas.data || []) {
    eventos.push({ tipo: g.kind === 'news' ? 'noticia' : 'guia', userId: g.author_id, guideId: g.id, fecha: g.published_at })
  }
  for (const g of guiasEnCamino.data || []) {
    eventos.push({ tipo: 'guia_enviada', userId: g.author_id, guideId: g.id, fecha: g.submitted_at })
  }
  for (const c of comentarios.data || []) {
    eventos.push({ tipo: 'comentario', userId: c.author_id, guideId: c.guide_id, fecha: c.created_at })
  }
  for (const u of altas.data || []) {
    if (u.created_at) eventos.push({ tipo: 'alta', userId: u.id, fecha: u.created_at })
  }
  for (const r of peticiones.data || []) {
    eventos.push({ tipo: 'peticion', userId: r.requester_id, texto: r.title, fecha: r.created_at })
  }
  for (const t of temas.data || []) {
    if (hilosDeNoticia.has(String(t.id))) continue
    eventos.push({ tipo: 'tema', userId: t.author_id, texto: t.title, enlace: `/tema/${t.id}`, fecha: t.created_at })
  }

  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  // Se piden más de los necesarios y se recorta al final, porque parte se
  // caerá al filtrar a quien se ha escondido o a guías ya despublicadas.
  const candidatos = eventos.slice(0, limite * 3)
  const userIds = [...new Set(candidatos.map((e) => e.userId).filter(Boolean))]
  const guideIds = [...new Set(candidatos.map((e) => e.guideId).filter(Boolean))]

  const [{ data: perfiles }, { data: guias }] = await Promise.all([
    userIds.length
      ? supabase.from('user_profiles').select(`id, username, display_name, avatar_url, hide_activity, ${COLUMNAS_RANGO}`).in('id', userIds)
      : Promise.resolve({ data: [] }),
    guideIds.length
      ? conVueltaAtrasDeTipo(
          () => supabase.from('guides').select('id, title, slug, kind').in('id', guideIds),
          () => supabase.from('guides').select('id, title, slug').in('id', guideIds)
        )
      : Promise.resolve({ data: [] }),
  ])

  const perfilPorId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
  const guiaPorId = Object.fromEntries((guias || []).map((g) => [g.id, g]))

  // Con poca gente, alguien que se lee cinco guías seguidas llena el hilo
  // él solo y parece que no hay nadie más. Se limita cuánto puede ocupar
  // cada persona para que se vea variedad.
  const MAX_POR_PERSONA = 3
  const usadosPorPersona = {}

  const lista = candidatos
    .filter((e) => {
      // Una noticia es del sitio: no es la actividad de nadie. Ni la
      // esconde `hide_activity` de quien la teclee, ni le gasta a esa
      // persona su cupo del hilo.
      if (e.tipo === 'noticia') return !!guiaPorId[e.guideId]
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

  // Se devuelven los eventos Y si algo falló. Sin lo segundo, quien
  // pinta no puede distinguir "no hay nada" de "no he podido mirarlo".
  return { eventos: lista, fallos: fallos.map(([tabla]) => tabla) }
}

// Lo pinta js/comunidad-sucesos.js (845), con el molde de la portada.
