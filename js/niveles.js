// Los niveles de XP y los rangos de colaborador (tanda 1124, PINGU: «la
// experiencia, si la gente utiliza mucho la web, puede haber más niveles» y
// «el de coleccionista no me cuadra»). Diez niveles con nombres del viaje de
// un entrenador; cada uno cuesta más o menos el doble que el anterior, porque
// con los retos se pueden ganar ~210 XP al día y con cinco niveles el tercero
// llegaba en días.
//
// Puro y sin dependencias: lo importan la web (js/gamification.js) y la
// insignia de las firmas (netlify/functions/insignia.mjs), que antes llevaba
// su copia y se quedaba vieja. La base dice lo mismo en `nivel_de_xp`
// (supabase-migration-1124-niveles.sql); test-tanda-1124 compara las dos.
export const NIVELES = [
  { level: 'Novato', min: 0, color: '#8a93a5', icono: 'sprout' },
  { level: 'Aprendiz', min: 150, color: '#a3825c', icono: 'compass' },
  { level: 'Entrenador', min: 400, color: '#22a06b', icono: 'gamepad' },
  { level: 'Rival', min: 900, color: '#0ea5b7', icono: 'zap' },
  { level: 'Veterano', min: 1800, color: '#3b82f6', icono: 'shield' },
  { level: 'Experto', min: 3500, color: '#8b5cf6', icono: 'star' },
  { level: 'As', min: 6000, color: '#ec4899', icono: 'target' },
  { level: 'Alto Mando', min: 10000, color: '#f97316', icono: 'gem' },
  { level: 'Campeón', min: 16000, color: '#eab308', icono: 'trophy' },
  // El último lleva degradado (PINGU eligió que se note): `especial`.
  { level: 'Maestro', min: 25000, color: '#eab308', icono: 'crown', especial: true },
].map((n, i, todos) => ({ ...n, next: todos[i + 1]?.min ?? null }))

export function nivelDeXp(xp) {
  const total = Number(xp) || 0
  return [...NIVELES].reverse().find((n) => total >= n.min) || NIVELES[0]
}

// Reputación de colaborador, por cuántas guías ha aprobado la moderación
// (no por XP). Nombres cortos desde la 1124 (PINGU).
export const RANGOS_COLABORADOR = [
  { min: 0, title: 'Miembro', icono: 'user' },
  { min: 1, title: 'Colaborador', icono: 'sprout' },
  { min: 5, title: 'Destacado', icono: 'star' },
  { min: 10, title: 'Leyenda', icono: 'crown' },
]

export function rangoDeColaborador(aprobadas) {
  return [...RANGOS_COLABORADOR].reverse().find((r) => (Number(aprobadas) || 0) >= r.min) || RANGOS_COLABORADOR[0]
}

// 25000 → «25.000»: el es-ES de toLocaleString no agrupa las de cuatro cifras.
export const milesXp = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
