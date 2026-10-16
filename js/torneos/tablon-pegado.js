// Qué aviso del tablón va pegado en la barra de estado (878). Pura y sin
// DOM, aparte de tablon.js, para poder probarla en Node: el último aviso
// HUMANO, y solo mientras sea reciente —el de hace tres horas ya no es «lo
// último»—. Un suceso automático más nuevo no lo tapa: la barra ya cuenta
// las rondas por su cuenta (877).
export const PEGADO_MS = 3 * 3600e3

export function avisoPegado(lista, ahora = Date.now()) {
  const a = (lista || []).find((x) => x.kind === 'aviso')
  if (!a) return null
  return ahora - new Date(a.created_at).getTime() <= PEGADO_MS ? a : null
}
