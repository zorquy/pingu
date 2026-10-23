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
import { RETOS } from './retos-xp.js'

const noHayFuncion = (e) => /PGRST202|42883|does not exist|Could not find the function/i.test(`${e?.code || ''} ${e?.message || ''}`)

// Devuelve lo que contestó la base, o { sinCuenta } / { faltaMigracion } /
// { error }. `r` = { aciertos, total, intentos, acertada, tira }.
export async function guardarResultado(juego, dia, r = {}) {
  const session = await getSession().catch(() => null)
  if (!session) return { sinCuenta: true }
  const args = {
    p_juego: juego,
    p_dia: dia,
    p_aciertos: Number(r.aciertos) || 0,
    p_total: Number(r.total) || 0,
    p_intentos: r.intentos == null ? null : Number(r.intentos),
    p_acertada: Boolean(r.acertada),
    p_tira: Array.isArray(r.tira) ? r.tira.map(Boolean) : null,
  }
  // La partida tal cual (841), para verla hecha en otro aparato. Con la
  // migración de la 835 sin la parte de la 841, la función no tiene ese
  // parámetro y PostgREST no la encuentra: se repite sin él, que el
  // resultado y la XP valen más que la partida.
  const partida = partidaLocal(juego, dia)
  // El puesto en la liga de la semana antes de guardar (989): la liga es la
  // XP de los seis retos (`portada_clasificacion`), y al acabar se dice si
  // subes. Sin la función, no se dice nada.
  const antes = await puestoEnLiga()
  let { data, error } = await supabase.rpc('retos_guardar', partida ? { ...args, p_estado: partida } : args)
  if (error && partida && noHayFuncion(error)) ({ data, error } = await supabase.rpc('retos_guardar', args))
  if (error) return noHayFuncion(error) ? { faltaMigracion: true } : { error: error.message }
  if (data?.nuevo && antes !== null) {
    const despues = await puestoEnLiga()
    if (despues) data = { ...data, liga: { antes, despues } }
  }
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

// Tu puesto en la liga de la semana: 0 si no estás, null si no se sabe.
async function puestoEnLiga() {
  try {
    const { data, error } = await supabase.rpc('portada_clasificacion', { p_periodo: 'semana' })
    if (error || !data) return null
    return Number(data.tu?.puesto) || 0
  } catch {
    return null
  }
}

// La partida de hoy de un juego, como la guarda su página en el navegador.
function partidaLocal(juego, dia) {
  const clave = RETOS.find((x) => x.juego === juego)?.local
  if (!clave) return null
  try {
    const g = JSON.parse(localStorage.getItem(clave) || 'null')
    return g && g.dia === dia ? g : null
  } catch {
    return null
  }
}

// Si hoy ya jugaste este reto EN OTRO aparato (841), su partida baja de la
// base al navegador antes de que la página la lea: así sale hecho y no se
// juega dos veces. Sin cuenta, sin migración o sin partida guardada, no
// hace nada y la página sigue como siempre.
export async function traerPartidaDeHoy(juego, dia) {
  const clave = RETOS.find((x) => x.juego === juego)?.local
  if (!clave || partidaLocal(juego, dia)) return false
  const n = await misNumeros(1).catch(() => null)
  const g = n?.hoy?.[juego]?.estado
  if (!g || g.dia !== dia) return false
  try {
    localStorage.setItem(clave, JSON.stringify(g))
    return true
  } catch {
    return false
  }
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
