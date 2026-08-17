// Lo leído y lo seguido del foro.
//
// Igual que js/curso-datos.js: TODO falla en silencio. Estas tablas
// llegan en `supabase-migration-foro-mejoras.sql`, que se ejecuta a mano
// en el SQL Editor. Entre que se sube el código y se ejecuta la
// migración, el foro tiene que seguir funcionando entero — solo que sin
// marcar lo nuevo ni avisar de respuestas.
import { supabase } from './supabase.js'

// ── Lo leído ──

// La marca de "he leído hasta aquí" de cada tema, más la de "lo he
// leído todo" del perfil. Se piden juntas porque las dos hacen falta a
// la vez para decidir qué está sin leer.
// `hayDatos` dice si la tabla contestó. NO es lo mismo que "no hay
// lecturas": sin la migración ejecutada, todo saldría como no leído para
// siempre y no habría forma de quitarlo, o sea media pantalla en negrita
// hasta que alguien ejecute el SQL. Con esto, mientras no se pueda saber,
// no se marca nada.
export async function marcasDeLectura(userId) {
  const vacio = { porTema: {}, todoHasta: null, hayDatos: false }
  if (!userId) return vacio
  try {
    const [lecturas, perfil] = await Promise.all([
      supabase.from('forum_thread_reads').select('thread_id, last_read_at').eq('user_id', userId),
      supabase.from('user_profiles').select('forum_read_all_at').eq('id', userId).maybeSingle(),
    ])
    if (lecturas.error) return vacio
    const porTema = {}
    ;(lecturas.data || []).forEach((f) => {
      porTema[f.thread_id] = f.last_read_at
    })
    return { porTema, todoHasta: perfil.data?.forum_read_all_at || null, hayDatos: true }
  } catch {
    return vacio
  }
}

// ¿Tiene este tema algo que yo no haya visto?
//
// Sin sesión, nada está "sin leer": marcar en negrita media pantalla a
// alguien que acaba de llegar no le dice nada.
export function estaSinLeer(tema, marcas) {
  if (!marcas?.hayDatos || !tema?.last_post_at) return false
  const propia = marcas.porTema[tema.id]
  const referencia = [propia, marcas.todoHasta].filter(Boolean).sort().pop()
  if (!referencia) return true
  return new Date(tema.last_post_at) > new Date(referencia)
}

// Cuántos temas sin leer tiene cada foro: { board_id: 3, ... }
//
// El índice del foro no sabía nada de esto. Un foro con veinte mensajes
// nuevos se veía EXACTAMENTE igual que uno que ya te habías leído entero,
// así que había que entrar en los seis a ver si había algo.
//
// Se resuelve con UNA consulta, no una por foro: se piden los temas con
// actividad y se cuentan por foro aquí. Con `todoHasta` puesto sólo se
// piden los posteriores a esa fecha, que es donde está el ahorro de
// verdad — quien acaba de marcar todo como leído no se trae nada.
//
// El tope existe para que esto no crezca sin límite: son los temas con
// actividad MÁS RECIENTE, que es justo lo que interesa. Si algún día hay
// más de mil temas nuevos a la vez, el contador se queda corto y el punto
// de "hay algo nuevo" sigue siendo verdad, que es lo que importa.
export async function sinLeerPorForo(marcas, { tope = 1000 } = {}) {
  if (!marcas?.hayDatos) return {}
  try {
    let q = supabase
      .from('forum_threads')
      .select('id, board_id, last_post_at')
      .not('last_post_at', 'is', null)
      .order('last_post_at', { ascending: false })
      .limit(tope)
    if (marcas.todoHasta) q = q.gt('last_post_at', marcas.todoHasta)
    const { data, error } = await q
    if (error) return {}
    const cuenta = {}
    ;(data || []).forEach((t) => {
      if (!estaSinLeer(t, marcas)) return
      cuenta[t.board_id] = (cuenta[t.board_id] || 0) + 1
    })
    return cuenta
  } catch {
    return {}
  }
}

export async function marcarLeido(userId, threadId) {
  if (!userId || !threadId) return
  try {
    await supabase
      .from('forum_thread_reads')
      .upsert({ user_id: userId, thread_id: threadId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,thread_id' })
  } catch {
    // Sin migración todavía.
  }
}

// "Marcar todo como leído" es una sola fila en el perfil, no una por
// tema: con mil temas, lo segundo serían mil escrituras por un clic.
export async function marcarTodoLeido(userId) {
  if (!userId) return false
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ forum_read_all_at: new Date().toISOString() })
      .eq('id', userId)
    return !error
  } catch {
    return false
  }
}

// ── Suscripciones ──

export async function estaSuscrito(userId, threadId) {
  if (!userId || !threadId) return false
  try {
    const { data, error } = await supabase
      .from('forum_subscriptions')
      .select('thread_id')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}

export async function suscribir(userId, threadId) {
  if (!userId || !threadId) return false
  try {
    const { error } = await supabase
      .from('forum_subscriptions')
      .upsert({ user_id: userId, thread_id: threadId }, { onConflict: 'user_id,thread_id' })
    return !error
  } catch {
    return false
  }
}

export async function desuscribir(userId, threadId) {
  if (!userId || !threadId) return false
  try {
    const { error } = await supabase
      .from('forum_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('thread_id', threadId)
    return !error
  } catch {
    return false
  }
}

// Avisar a los suscritos de un mensaje nuevo.
//
// Es una función de la base (`security definer`) porque desde aquí NO se
// puede leer quién sigue un tema: la política solo deja ver las
// suscripciones propias. La función sí las ve, y solo devuelve cuántos
// avisos ha creado.
export async function avisarSuscritos(threadId, postId, titulo) {
  if (!threadId || !postId) return 0
  try {
    const { data, error } = await supabase.rpc('forum_avisar_suscritos', {
      p_thread: threadId,
      p_post: postId,
      p_titulo: titulo || '',
    })
    return error ? 0 : data || 0
  } catch {
    return 0
  }
}
