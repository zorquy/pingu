// La liga de la semana: la clasificación del reto diario de lunes a
// domingo. No tiene tabla propia — se agrega en el navegador desde
// daily_challenge_results (pública, salvo actividad oculta), que a
// escala de esta comunidad son unas pocas filas por día. Cada lunes,
// borrón y cuenta nueva, igual que el top del mes cada día 1.
//
// El día del reto se guarda en UTC (ver js/reto-diario.js), así que el
// lunes también se calcula en UTC: si no, a medianoche se mezclarían
// las semanas según el huso de quien mira.
import { supabase } from './supabase.js'

export function lunesDeEstaSemana() {
  const hoy = new Date()
  const retrocede = (hoy.getUTCDay() + 6) % 7
  const lunes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - retrocede))
  return lunes.toISOString().slice(0, 10)
}

// Las filas de la liga, ya ordenadas: [{ user_id, puntos, dias }].
// Desempate por días jugados: a igualdad de puntos, gana la constancia.
export async function clasificacionSemanal() {
  try {
    const { data, error } = await supabase
      .from('daily_challenge_results')
      .select('user_id, day, score')
      .gte('day', lunesDeEstaSemana())
      .limit(2000)
    if (error || !data) return []
    const por = {}
    for (const f of data) {
      const fila = (por[f.user_id] = por[f.user_id] || { user_id: f.user_id, puntos: 0, dias: 0 })
      fila.puntos += f.score || 0
      fila.dias++
    }
    return Object.values(por).sort((a, b) => b.puntos - a.puntos || b.dias - a.dias)
  } catch {
    return []
  }
}
