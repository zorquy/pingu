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
