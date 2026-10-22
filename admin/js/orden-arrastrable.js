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

// El identificador de una era nueva, sacado de su nombre (975): PINGU pone
// «McDonald's» y nadie tiene que inventarse «mcdonalds». Minúsculas, sin
// acentos y con guiones —lo que pide `serie_id`—, y si ya existe, con -2, -3…
export function idDeEraNueva(nombre, existentes = []) {
  const base = String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'era'
  const usados = new Set(existentes.map((x) => String(x).toLowerCase()))
  if (!usados.has(base)) return base
  let n = 2
  while (usados.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// El orden de las eras con una nueva metida donde se ha pedido: arriba del
// todo, abajo del todo o justo después de otra.
export function conEraEn(ids, nueva, donde) {
  const sin = ids.filter((x) => x !== nueva)
  if (donde === '__arriba') return [nueva, ...sin]
  const i = sin.indexOf(donde)
  if (donde === '__abajo' || i < 0) return [...sin, nueva]
  return [...sin.slice(0, i + 1), nueva, ...sin.slice(i + 1)]
}
