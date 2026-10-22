// Las cartas de cada set, guardadas en el navegador (tanda 978, propuesta
// «Que cargue al momento»).
//
// Lo que hace que Dex abra una expansión «al instante» es que ya tiene sus
// cartas en el teléfono: solo baja las fotos. Aquí, la primera vez que se
// abre un set se guarda lo que contestó la base (números, nombres,
// versiones) y la siguiente se pinta con eso en el acto; quien llama pide lo
// nuevo por detrás y repinta solo si ha cambiado algo.
//
// En IndexedDB y no en localStorage: un set grande son 100–300 KB, y
// localStorage se llena a los 5 MB y escribe sin poder esperar. Se guarda el
// TEXTO de la respuesta: así compararlo con la nueva es comparar dos cadenas,
// y nadie puede tocar lo guardado pegándole cosas a las cartas (las versiones
// se pegan a cada carta al pintar).
//
// Todo lo que falle (ventana privada, sin sitio, IndexedDB bloqueado)
// devuelve `null` y la pantalla carga como antes. Son datos del catálogo, los
// mismos para todo el mundo: no se borran al salir de la cuenta.
const BASE = 'pokedoc-catalogo'
const ALMACEN = 'cartas-de-set'
// Cuándo se abrió cada uno, aparte: para recortar basta leer esto, que es
// pequeño, sin cargar los textos de los cuarenta.
const CUANDO = 'cuando'
// Los que se quedan; al pasar, se van los que hace más que no se abren.
export const MAX_SETS = 40

let abierta = null
function abrir() {
  if (!abierta) {
    abierta = new Promise((ok) => {
      try {
        const r = indexedDB.open(BASE, 1)
        r.onupgradeneeded = () => { r.result.createObjectStore(ALMACEN); r.result.createObjectStore(CUANDO) }
        r.onsuccess = () => ok(r.result)
        r.onerror = () => ok(null)
        r.onblocked = () => ok(null)
      } catch {
        ok(null)
      }
    })
  }
  return abierta
}

// La llave lleva las COLUMNAS: si una tanda pide una columna más, lo guardado
// sin ella no vale (llegaría `undefined`, la 523) y se pide de nuevo.
export function claveDeSet(mercado, ids, columnas) {
  let h = 0
  for (const ch of String(columnas || '')) h = (h * 31 + ch.charCodeAt(0)) | 0
  return `${mercado}|${[...ids].sort().join(',')}|${(h >>> 0).toString(36)}`
}

export async function leerGuardado(clave) {
  const db = await abrir()
  if (!db) return null
  return new Promise((ok) => {
    try {
      const q = db.transaction(ALMACEN).objectStore(ALMACEN).get(clave)
      q.onsuccess = () => ok(typeof q.result === 'string' ? q.result : null)
      q.onerror = () => ok(null)
    } catch {
      ok(null)
    }
  })
}

export async function guardar(clave, texto) {
  const db = await abrir()
  if (!db) return false
  return new Promise((ok) => {
    try {
      const tx = db.transaction([ALMACEN, CUANDO], 'readwrite')
      const almacen = tx.objectStore(ALMACEN)
      const cuando = tx.objectStore(CUANDO)
      almacen.put(texto, clave)
      cuando.put(Date.now(), clave)
      // Y el recorte, en la misma transacción.
      const tiempos = cuando.getAll()
      const llaves = cuando.getAllKeys()
      llaves.onsuccess = () => {
        const filas = llaves.result.map((k, i) => ({ k, t: tiempos.result?.[i] || 0 }))
        for (const { k } of filas.sort((a, b) => b.t - a.t).slice(MAX_SETS)) { almacen.delete(k); cuando.delete(k) }
      }
      tx.oncomplete = () => ok(true)
      tx.onerror = () => ok(false)
      tx.onabort = () => ok(false)
    } catch {
      ok(false)
    }
  })
}
