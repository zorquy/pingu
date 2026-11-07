// Los chips de /avisos (1168): puro, sin importar nada del navegador, para que
// lo pruebe Node. `llave` es la del color de style.css (Colección va por
// `cartas`, como en toda la web); «Para ti» es lo que no es de ninguna
// sección, que es justo lo que cuenta la campana (1142).
import { seccionDeAviso } from './numeros-seccion.js'

export const CHIPS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'para-ti', texto: 'Para ti' },
  { id: 'Comunidad', texto: 'Comunidad', llave: 'comunidad' },
  { id: 'Colección', texto: 'Colección', llave: 'cartas' },
  { id: 'Jugar', texto: 'Jugar', llave: 'jugar' },
  // Lo de las tiendas (ofertas, fotos) va con su mensaje (1264).
  { id: 'Mensajes', texto: 'Mensajes', llave: 'mensajes' },
]

// Si un aviso entra en un chip.
export function casaConChip(aviso, chip) {
  if (chip === 'todos') return true
  const s = seccionDeAviso(aviso?.type)
  return chip === 'para-ti' ? !s : s === chip
}

// Cuántos SIN LEER hay en cada chip (el número de la chapa).
export function cuentasDeChips(avisos = []) {
  const sinLeer = avisos.filter((a) => a && !a.read_at)
  return Object.fromEntries(CHIPS.map((c) => [c.id, sinLeer.filter((a) => casaConChip(a, c.id)).length]))
}
