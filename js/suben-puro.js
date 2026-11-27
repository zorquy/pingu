// Las cartas que más suben esta semana, lo puro (tanda 1488, sacado de
// js/escaparate.js): lo usan la portada sin cuenta y el correo de los lunes
// (netlify/functions/resumen-semanal.mjs), que no puede bajarse el cliente de
// Supabase del navegador. «Esta semana» es la media de 7 días contra la de 30
// (`cm_avg7` sobre `cm_avg30`, de Cardmarket), con un mínimo de 5 %.
export function lasQueMasSuben(filas, n = 3) {
  return (filas || [])
    .map((r) => ({ ...r, siete: Number(r.cm_avg7), treinta: Number(r.cm_avg30) }))
    .filter((r) => r.siete > 0 && r.treinta > 0 && r.siete / r.treinta >= 1.05)
    .map((r) => ({ id: r.card_id, precio: Number(r.cm_trend) || r.siete, sube: r.siete / r.treinta - 1 }))
    .sort((a, b) => b.sube - a.sube)
    .slice(0, n)
}
