// Los logros de coleccionista (tanda 793, NU9): hasta aquí los trofeos
// premiaban participar (guías, cursos, foro) y los torneos; ninguno
// coleccionar. Los define el admin en `achievement_definitions` como los
// demás (la migración siembra los primeros); aquí solo se les da el número.
//
// Se cuentan con la colección que /mi-coleccion YA tiene en memoria: pedirla
// otra vez desde cualquier página para mirar un trofeo serían miles de filas.

// Puro: lo que cuenta cada tipo de logro, con la colección en la mano.
export function statsDeColeccion({ lineas, cartaDe, cuantasPorSet, totalDeSet, unidad }) {
  const distintas = new Set(lineas.map((l) => l.card_id))
  let setsCompletos = 0
  for (const [set, n] of cuantasPorSet) {
    const total = totalDeSet(set)
    if (total > 0 && n >= total) setsCompletos++
  }
  let cartaMasCara = 0
  for (const l of lineas) cartaMasCara = Math.max(cartaMasCara, unidad(l) || 0)
  const porIlustrador = new Map()
  for (const id of distintas) {
    const quien = cartaDe(id)?.illustrator
    if (quien) porIlustrador.set(quien, (porIlustrador.get(quien) || 0) + 1)
  }
  return {
    cartas: distintas.size,
    setsCompletos,
    cartaMasCara: Math.floor(cartaMasCara),
    maxIlustrador: Math.max(0, ...porIlustrador.values()),
  }
}

export async function comprobarLogrosDeColeccion(userId, stats) {
  const { checkAchievements } = await import('./gamification.js')
  return checkAchievements(userId, { coleccion: stats })
}
