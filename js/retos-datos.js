// Lo que los retos diarios guardan y leen de la base (tanda 835). La XP la
// calcula `retos_guardar` (supabase-migration-retos-xp.sql); aquí solo se
// manda el resultado y se celebra lo que conteste.
//
// Sin cuenta se juega igual (la partida vive en el navegador) y no se
// guarda nada; sin la migración, tampoco, y se dice: «no se sabe» no es
// «no has ganado nada» (la 319).
import { supabase } from './supabase.js'
import { getSession } from './app.js'
import { showToast } from './toast.js'
import { checkAchievements, celebrarSiSubeDeNivel } from './gamification.js'

const noHayFuncion = (e) => /PGRST202|42883|does not exist|Could not find the function/i.test(`${e?.code || ''} ${e?.message || ''}`)

// Devuelve lo que contestó la base, o { sinCuenta } / { faltaMigracion } /
// { error }. `r` = { aciertos, total, intentos, acertada, tira }.
export async function guardarResultado(juego, dia, r = {}) {
  const session = await getSession().catch(() => null)
  if (!session) return { sinCuenta: true }
  const { data, error } = await supabase.rpc('retos_guardar', {
    p_juego: juego,
    p_dia: dia,
    p_aciertos: Number(r.aciertos) || 0,
    p_total: Number(r.total) || 0,
    p_intentos: r.intentos == null ? null : Number(r.intentos),
    p_acertada: Boolean(r.acertada),
    p_tira: Array.isArray(r.tira) ? r.tira.map(Boolean) : null,
  })
  if (error) return noHayFuncion(error) ? { faltaMigracion: true } : { error: error.message }
  if (data?.nuevo) {
    const ganado = (data.xp || 0) + (data.xpPerfecto || 0) + (data.xpRacha || 0)
    try {
      if (Number.isFinite(data.totalXp)) celebrarSiSubeDeNivel(data.totalXp - ganado, data.totalXp)
      if (data.perfecto) showToast(`¡Día perfecto! Los seis retos de hoy: +${data.xpPerfecto} XP`, 'success')
      if (data.bonoRacha) showToast(`${data.racha} días seguidos jugando retos: +${data.xpRacha} XP`, 'success')
      await checkAchievements(session.user.id)
    } catch {
      // Una celebración no tumba el guardado.
    }
  }
  return data || {}
}

// Tus días, tu racha y lo de hoy. null sin cuenta o sin migración.
export async function misNumeros(dias = 60) {
  const session = await getSession().catch(() => null)
  if (!session) return null
  const { data, error } = await supabase.rpc('retos_mis_numeros', { p_dias: dias })
  return error ? null : data || null
}

// Lo de todos de un juego y día. null si no se puede saber.
export async function estadisticas(juego, dia) {
  const { data, error } = await supabase.rpc('retos_estadisticas', { p_juego: juego, p_dia: dia })
  return error ? null : data || null
}
