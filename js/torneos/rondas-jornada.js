// ── Rondas por jornada (tanda 849) ──
// PINGU: «en cada jornada quiero hacer tres rondas». Una jornada son
// `rounds_per_matchday` rondas suizas seguidas (1 si no se dice, que es como
// era): con 3, la jornada 2 son las rondas 4, 5 y 6. `swiss_rounds` sigue
// siendo el TOTAL de rondas —así el motor, los cierres y la clasificación,
// que cuentan rondas, no cambian— y lo que habla de jornadas pasa por aquí.
// La base usa la MISMA cuenta (supabase-migration-torneos-rondas-jornada.sql).
export const rondasPorJornada = (t) => Math.max(1, Math.floor(Number(t?.rounds_per_matchday) || 1))
export const numJornadas = (t) => Math.ceil((Number(t?.swiss_rounds) || 0) / rondasPorJornada(t))
export const jornadaDeRonda = (t, ronda) => Math.ceil(Number(ronda) / rondasPorJornada(t))
export const rondaEnJornada = (t, ronda) => ((Number(ronda) - 1) % rondasPorJornada(t)) + 1
export const primeraRondaDe = (t, jornada) => (Number(jornada) - 1) * rondasPorJornada(t) + 1

// Cómo se nombra una ronda de liga: «jornada 2» si cada jornada es una
// ronda, y «ronda 1 de la jornada 2» si son varias.
export function nombreDeRondaDeLiga(t, ronda, { corto = false } = {}) {
  const j = jornadaDeRonda(t, ronda)
  if (rondasPorJornada(t) === 1) return corto ? `J${j}` : `jornada ${j}`
  const k = rondaEnJornada(t, ronda)
  return corto ? `J${j}·R${k}` : `ronda ${k} de la jornada ${j}`
}

// ENTRE JORNADAS (tanda 850). PINGU: «no está en juego entre jornadas». En la
// base una liga sigue `in_progress` toda la temporada (así admite listas y
// gente nueva), pero lo que se ENSEÑA es otra cosa: si ninguna ronda está
// viva y la última jornada empezada ya ha jugado todas sus rondas, la liga
// está esperando a la siguiente. Entre dos rondas de la MISMA jornada sí se
// está jugando. `rondas` son filas de `rounds` (round_number, status, phase);
// sin ellas no se sabe y se dice lo de siempre.
const ultimaSuiza = (rondas) => Math.max(0, ...rondas.filter((r) => r.phase !== 'top_cut').map((r) => Number(r.round_number) || 0))

export function entreJornadas(t, rondas) {
  if (t?.format !== 'league' || t.status !== 'in_progress' || !Array.isArray(rondas)) return false
  if (rondas.some((r) => r.status !== 'finished' || r.phase === 'top_cut')) return false
  const hechas = ultimaSuiza(rondas)
  return hechas % rondasPorJornada(t) === 0 && hechas < (Number(t.swiss_rounds) || 0)
}

// La jornada que toca después de las rondas hechas, con su fecha si la tiene.
export function proximaJornada(t, rondas) {
  const n = jornadaDeRonda(t, ultimaSuiza(rondas || []) + 1)
  const fechas = Array.isArray(t?.matchday_dates) ? t.matchday_dates : []
  return { n, fecha: fechas[n - 1] || null }
}

// LA PRÓXIMA CITA de un torneo (879). PINGU: «en el panel de siguiente
// torneo no sale el de hoy, es la jornada 2 de una liga, debería decir que
// hoy hay torneo». Para un torneo normal la cita es `start_at`; para una
// liga, la primera jornada que no haya pasado (con un margen de seis horas,
// como la portada: la de hoy a las 19:00 sigue siendo «hoy» a las 23:00).
// Sin fechas de jornada, se cae al `start_at`. Pura; null si no hay nada.
export function proximaCita(t, ahora = Date.now(), margenMs = 6 * 3600e3) {
  if (!t || t.status === 'finished' || t.status === 'cancelled') return null
  const desde = ahora - margenMs
  const vale = (f) => f && Number.isFinite(Date.parse(f)) && Date.parse(f) >= desde
  if (t.format === 'league' && Array.isArray(t.matchday_dates) && t.matchday_dates.length) {
    const i = t.matchday_dates.findIndex(vale)
    if (i >= 0) return { fecha: t.matchday_dates[i], jornada: i + 1 }
    return null
  }
  return vale(t.start_at) ? { fecha: t.start_at, jornada: null } : null
}

// «hoy a las 19:00», «mañana a las 19:00», «el jue 23 oct a las 19:00»;
// y «hace 40 min» si ya pasó. Pura (la hora, en la del navegador).
export function cuandoLaCita(fecha, ahora = Date.now()) {
  const t = Date.parse(fecha)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const diaDe = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((diaDe(d) - diaDe(new Date(ahora))) / 86400e3)
  if (t < ahora) {
    const min = Math.round((ahora - t) / 60000)
    return min < 60 ? `hace ${min} min` : dias === 0 ? `hoy a las ${hora}` : `el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
  }
  if (dias === 0) return `hoy a las ${hora}`
  if (dias === 1) return `mañana a las ${hora}`
  return `el ${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} a las ${hora}`
}
