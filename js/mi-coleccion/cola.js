// SIN CONEXIÓN (745, V7 de la lista de propuestas): lo que añades sin red
// se queda en COLA en este navegador y se guarda solo cuando vuelve.
//
// Es solo AÑADIR, a propósito: añadir es lo que se hace con la carta en la
// mano —en una tienda, en un torneo, donde no hay cobertura— y cae siempre
// por `datos.anadir` (la 650), que sabe sumar a una línea que ya existe.
// Editar o borrar sin red pediría resolver choques con lo que haya cambiado
// en otro sitio, y eso no se hace a ciegas.
//
// Y la copia de tu colección para la página «Sin conexión» (`guardarCopia`):
// nombres, set y copias, nada más —es para mirarla, no para trabajar—.
export const CLAVE_COLA = 'pokedoc-cola-anadir'
export const CLAVE_COPIA = 'pokedoc-coleccion-guardada'
const INTENTOS = 5

const leer = (almacen, clave, defecto) => {
  try { return JSON.parse(almacen?.getItem(clave) || 'null') ?? defecto } catch { return defecto }
}
const escribir = (almacen, clave, valor) => {
  try { almacen?.setItem(clave, JSON.stringify(valor)) } catch {}
}

export function leerCola(almacen = globalThis.localStorage) {
  const c = leer(almacen, CLAVE_COLA, [])
  return Array.isArray(c) ? c : []
}

// Mete un añadir en la cola. Lo de otra persona no se mezcla: cada entrada
// lleva su dueño y solo se envía con esa sesión.
export function encolar(entrada, almacen = globalThis.localStorage) {
  const cola = leerCola(almacen)
  cola.push({ ...entrada, intentos: 0, creada: new Date().toISOString() })
  escribir(almacen, CLAVE_COLA, cola)
  return cola.length
}

// Manda lo de `userId`, en orden, con `enviar(entrada)`. Lo que falla se
// queda con un intento más; a la quinta se aparta (a `descartadas`) para que
// un fallo que no es de red —una carta que ya no existe— no se repita para
// siempre (la 510). Devuelve { enviadas, quedan, descartadas }.
export async function vaciarCola(userId, enviar, almacen = globalThis.localStorage) {
  const cola = leerCola(almacen)
  const quedan = []
  const descartadas = []
  let enviadas = 0
  for (const e of cola) {
    if (e.userId !== userId) {
      quedan.push(e)
      continue
    }
    try {
      await enviar(e)
      enviadas++
    } catch {
      const otra = { ...e, intentos: (e.intentos || 0) + 1 }
      if (otra.intentos >= INTENTOS) descartadas.push(otra)
      else quedan.push(otra)
    }
  }
  escribir(almacen, CLAVE_COLA, quedan)
  return { enviadas, quedan: quedan.filter((e) => e.userId === userId).length, descartadas }
}

// La copia para mirar sin red: las cartas con su set y sus copias, las que
// más copias tienes primero, y como mucho 400 (localStorage no es la base).
export function copiaDeColeccion(lineas, nombreDe, setDe, { tope = 400, ahora = new Date() } = {}) {
  const porCarta = new Map()
  for (const l of lineas || []) {
    if (!l?.card_id) continue
    const k = `${l.card_id}|${l.market || 'WEST'}`
    const ya = porCarta.get(k) || { n: nombreDe(l), s: setDe(l), c: 0 }
    ya.c += Number(l.cantidad) || 1
    porCarta.set(k, ya)
  }
  const cartas = [...porCarta.values()].sort((a, b) => b.c - a.c || String(a.n).localeCompare(String(b.n), 'es')).slice(0, tope)
  return { cuando: ahora.toISOString(), total: [...porCarta.values()].reduce((n, x) => n + x.c, 0), distintas: porCarta.size, cartas }
}

export function guardarCopia(copia, almacen = globalThis.localStorage) {
  escribir(almacen, CLAVE_COPIA, copia)
}
