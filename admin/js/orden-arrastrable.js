// Colocar arrastrando: las reglas, sin DOM y sin red (tanda 551).
//
// Está aparte de `colecciones.js` por lo de siempre: aquel importa
// `js/app.js`, que al cargarse monta la barra de arriba y en Node revienta,
// así que lo que viva allí no lo puede probar nadie sin navegador. Lo puro
// aquí, que no importa nada.

// Lo que se GUARDA sigue siendo un número; lo que cambia es que ya no lo
// escribe una persona. De diez en diez y no de uno en uno a propósito: así
// una colocación suelta solo escribe las filas que de verdad se movieron.
export const numeros = (lista) => lista.map((_, i) => (i + 1) * 10)

// Mover un elemento un paso arriba o abajo. Devuelve una lista NUEVA: la
// de entrada es lo que hay en pantalla y se pisa sola si se muta.
export function moverEnLista(lista, id, paso) {
  const i = lista.indexOf(id)
  if (i < 0) return lista
  const j = Math.max(0, Math.min(lista.length - 1, i + paso))
  if (i === j) return lista
  const copia = lista.slice()
  copia.splice(j, 0, copia.splice(i, 1)[0])
  return copia
}

// Qué filas cambian de número al pasar de un orden a otro. Es lo que se
// escribe, y se calcula aparte para poder mirarlo: escribir las 231 filas
// cada vez que se mueve una sería una pantalla que tarda tres segundos en
// responder a un arrastre.
export function loQueCambia(antes, despues) {
  const nuevos = numeros(despues)
  const cambios = []
  for (let i = 0; i < despues.length; i++) {
    const id = despues[i]
    if (antes.get(id) !== nuevos[i]) cambios.push({ id, orden: nuevos[i] })
  }
  return cambios
}

// Delante de cuál cae lo que se suelta: la primera fila cuya mitad de
// arriba queda por debajo del cursor. `null` = al final.
//
// Sin la mitad no se puede soltar al final de una lista —el cursor siempre
// está sobre ALGUNA fila—, y ese es justo el movimiento que más se hace al
// ordenar: mandar una al fondo.
export function dondeCae(cajas, y) {
  for (const c of cajas) {
    if (y < c.top + c.alto / 2) return c.id
  }
  return null
}
