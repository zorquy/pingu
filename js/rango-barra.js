// La barra del rango (789, PA12), en su módulo desde la 794: sus clases
// viven en perfil.css, y en gamification.js —que baja toda la web— la
// prueba 306 las daba por huérfanas en las 44 páginas.
import { levelProgress, LEVEL_THRESHOLDS } from './gamification.js'

// El rango como barra (789, PA12): «5 de 250 XP para Entrenador» con lo
// que falta pintado, en vez de «Novato · 0 XP» suelto. En el último nivel,
// solo los XP.
export function barraDeRango(xp) {
  const p = levelProgress(xp)
  const i = LEVEL_THRESHOLDS.findIndex((l) => l.level === p.level)
  const siguiente = LEVEL_THRESHOLDS[i + 1]
  if (!siguiente) return `<span class="rango-texto">${xp} XP</span>`
  return `<span class="rango-texto">${xp} de ${siguiente.min} XP para ${siguiente.level}</span><span class="rango-barra" aria-hidden="true"><i style="--pct:${p.pct}"></i></span>`
}
