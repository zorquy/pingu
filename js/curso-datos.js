// La capa de datos del juego de los cursos: partidas, estadísticas de
// cada pregunta y cola de repaso.
//
// TODO lo de aquí falla en silencio a propósito.
//
// Estas tablas llegan en `supabase-migration-cursos-juego.sql`, que se
// ejecuta a mano en el SQL Editor de Supabase. Entre que se sube el
// código y se ejecuta la migración hay un rato en el que las tablas no
// existen. Durante ese rato el curso tiene que seguir jugándose igual:
// se pierden el marcador guardado y los porcentajes, pero no se rompe la
// pantalla ni salta un error en la cara del usuario.
//
// Por eso ninguna función de este fichero lanza: devuelven null, 0 o
// lista vacía, y quien llama enseña lo que pueda.
import { supabase } from './supabase.js'

// ── Estadísticas por pregunta ──

// Suma uno al contador de esta pregunta. Es una función de la base
// (`security definer`) porque `question_stats` no es escribible desde el
// navegador: si lo fuera, cualquiera podría inventarse los porcentajes.
export async function registrarRespuesta(guideId, clave, acierto) {
  if (!guideId || !clave) return
  try {
    await supabase.rpc('record_question_answer', {
      p_guide_id: guideId,
      p_question_key: clave,
      p_correct: !!acierto,
    })
  } catch {
    // Sin migración todavía. El curso sigue.
  }
}

// Cuánta gente ha acertado cada pregunta de este curso, por clave.
export async function estadisticasDelCurso(guideId) {
  if (!guideId) return {}
  try {
    const { data, error } = await supabase
      .from('question_stats')
      .select('question_key, times_answered, times_correct')
      .eq('guide_id', guideId)
    if (error || !data) return {}
    const porClave = {}
    data.forEach((f) => {
      porClave[f.question_key] = { respondida: f.times_answered, acertada: f.times_correct }
    })
    return porClave
  } catch {
    return {}
  }
}

// ── Partidas ──

export async function guardarPartida(userId, guideId, resumen, duracionMs) {
  if (!userId || !guideId) return null
  try {
    const { data, error } = await supabase
      .from('course_attempts')
      .insert({
        user_id: userId,
        guide_id: guideId,
        score: resumen.score,
        correct: resumen.correct,
        total: resumen.total,
        duration_ms: duracionMs ?? null,
      })
      // La medalla se lee de vuelta porque la pone el disparador de la
      // base, no nosotros.
      .select('id, score, correct, total, medal')
      .single()
    if (error) return null
    return data
  } catch {
    return null
  }
}

// La mejor partida anterior a esta, para saber si hay récord y si sube
// la medalla. Devuelve null si no hay ninguna (primera vez) o si la
// tabla todavía no existe.
export async function mejorPartida(userId, guideId) {
  if (!userId || !guideId) return null
  try {
    const { data, error } = await supabase
      .from('course_attempts')
      .select('score, correct, total, medal, created_at')
      .eq('user_id', userId)
      .eq('guide_id', guideId)
      .order('score', { ascending: false })
      .limit(1)
    if (error || !data || !data.length) return null
    return data[0]
  } catch {
    return null
  }
}

// ¿Es la primera vez que juega este curso? Hace falta para no repartir
// XP por bloque cada vez que alguien repite: sin esto, repetir el curso
// más corto en bucle sería la forma más rápida de subir de nivel.
export async function haJugadoAntes(userId, guideId) {
  if (!userId || !guideId) return false
  try {
    const { count, error } = await supabase
      .from('course_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('guide_id', guideId)
    if (error) return false
    return (count || 0) > 0
  } catch {
    return false
  }
}

export async function clasificacionDeCurso(guideId, limite = 100) {
  if (!guideId) return []
  try {
    const { data, error } = await supabase.rpc('course_leaderboard', {
      p_guide_id: guideId,
      p_limit: limite,
    })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

// ── Repaso de lo fallado ──

const DIAS_HASTA_EL_REPASO = 2

export async function apuntarParaRepasar(userId, guideId, clave, block) {
  if (!userId || !guideId || !clave) return
  const dentroDeUnosDias = new Date(Date.now() + DIAS_HASTA_EL_REPASO * 86400_000).toISOString()
  try {
    // `times_failed` no se toca aquí: el upsert lo dejaría en 1 otra vez.
    // Fallar dos veces la misma pregunta ya se nota en que la fila sigue
    // ahí; llevar la cuenta exacta pedía una función de la base y no
    // aporta nada que se vea.
    await supabase.from('course_review_queue').upsert(
      {
        user_id: userId,
        guide_id: guideId,
        question_key: clave,
        block,
        failed_at: new Date().toISOString(),
        review_after: dentroDeUnosDias,
      },
      { onConflict: 'user_id,guide_id,question_key' }
    )
  } catch {
    // Sin migración todavía.
  }
}

export async function quitarDelRepaso(userId, guideId, clave) {
  if (!userId || !guideId || !clave) return
  try {
    await supabase
      .from('course_review_queue')
      .delete()
      .eq('user_id', userId)
      .eq('guide_id', guideId)
      .eq('question_key', clave)
  } catch {
    // Sin migración todavía.
  }
}

// Lo que toca repasar hoy: lo fallado hace ya unos días.
export async function pendientesDeRepaso(userId, limite = 5) {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('course_review_queue')
      .select('guide_id, question_key, block, failed_at')
      .eq('user_id', userId)
      .lte('review_after', new Date().toISOString())
      .order('failed_at', { ascending: true })
      .limit(limite)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

// Cuántas hay esperando (para el aviso de "tienes 4 preguntas por
// repasar"), sin traérselas todas.
export async function cuantasParaRepasar(userId) {
  if (!userId) return 0
  try {
    const { count, error } = await supabase
      .from('course_review_queue')
      .select('question_key', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('review_after', new Date().toISOString())
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}
