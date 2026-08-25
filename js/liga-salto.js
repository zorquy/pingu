// El salto de puestos en la liga, para la pantalla final del reto.
// Módulo aparte de liga.js A PROPÓSITO: liga.js lo importa la portada
// (que anda al límite del presupuesto de peso) y esto solo lo usa
// curso.js.

// El puesto de un usuario en una clasificación ya calculada (1 = líder;
// 0 = no aparece).
export function puestoDe(filas, userId) {
  return filas.findIndex((f) => f.user_id === userId) + 1
}

// La frase del salto. Posiciones 1-based; antes = 0 significa que aún
// no estaba en la liga. Bajar de puesto no puede pasar sumando puntos,
// pero si pasara (datos raros), mejor callar que restregar: ''.
export function textoSaltoLiga(antes, despues) {
  if (!despues) return ''
  if (!antes) return `Entras en la liga de la semana: vas ${despues}.º`
  if (despues < antes) return `¡Subes del ${antes}.º al ${despues}.º en la liga de la semana!`
  if (despues === antes) return `Sigues ${despues}.º en la liga de la semana`
  return ''
}
