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
