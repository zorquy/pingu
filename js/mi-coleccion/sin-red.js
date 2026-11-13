// TU COLECCIÓN SIN COBERTURA (tanda 1318, A4 del plan). En una tienda o en un
// torneo con mala cobertura, abrir Mi colección fallaba entera. Ahora lo que
// carga la pantalla (tus líneas, sus cartas, los precios, «La quiero») se
// guarda en este navegador (IndexedDB) cada vez que llega de la red, y si la
// red no contesta se pinta la copia, diciendo de cuándo es.
//
// Red PRIMERO, siempre: la copia solo se usa cuando la petición falla POR LA
// RED (sin conexión, «Failed to fetch»). Un error de la base —una columna que
// falta, un permiso— se sigue viendo como error: tapar eso con datos viejos
// sería mentir. Añadir sin red ya existía (la cola de la 745, `cola.js`).
//
// La copia es de quien la guarda (la llave lleva su id) y se borra al salir
// de la cuenta (`olvidarCopias`, que llama signOut con las de ultima-vista).
const BD = 'pokedoc-sin-red'
const ALMACEN = 'copias'
const YO = 'pokedoc-sin-red-yo'

let bd = null
function abrir(idb = globalThis.indexedDB) {
  if (!idb) return Promise.resolve(null)
  if (bd) return bd
  bd = new Promise((ok) => {
    try {
      const pet = idb.open(BD, 1)
      pet.onupgradeneeded = () => { if (!pet.result.objectStoreNames.contains(ALMACEN)) pet.result.createObjectStore(ALMACEN) }
      pet.onsuccess = () => ok(pet.result)
      pet.onerror = () => ok(null)
      pet.onblocked = () => ok(null)
    } catch { ok(null) }
  })
  return bd
}
const enTransaccion = async (modo, hacer) => {
  const db = await abrir()
  if (!db) return null
  return new Promise((ok) => {
    try {
      const tx = db.transaction(ALMACEN, modo)
      const pet = hacer(tx.objectStore(ALMACEN))
      tx.oncomplete = () => ok(pet?.result ?? true)
      tx.onerror = () => ok(null)
      tx.onabort = () => ok(null)
    } catch { ok(null) }
  })
}

export const guardarCopia = (clave, valor, en = Date.now()) => enTransaccion('readwrite', (s) => s.put({ valor, en }, clave))
export const leerCopia = (clave) => enTransaccion('readonly', (s) => s.get(clave))
export const olvidarCopias = () => enTransaccion('readwrite', (s) => s.clear())

// ¿Ha fallado por la RED? Sin conexión, o el fetch que no llega (cada
// navegador lo escribe a su manera). Lo demás no es cosa de la cobertura.
export function esFalloDeRed(err, nav = globalThis.navigator) {
  if (nav && nav.onLine === false) return true
  const texto = `${err?.name || ''} ${err?.message || ''} ${err?.details || ''}`
  return /Failed to fetch|NetworkError|Load failed|network connection was lost|ERR_INTERNET_DISCONNECTED|fetch failed/i.test(texto)
}

// De cuándo es lo que se está enseñando: null = de la red (lo de ahora).
let copiaDe = null
export const fechaDeLaCopia = () => copiaDe

// Pide con `pedir`; si llega, guarda la copia (sin esperar) y la devuelve; si
// falla por la red y hay copia, la copia. Un Map se guarda como pares.
export async function conCopia(clave, pedir, { esMapa = false, guardar = guardarCopia, leer = leerCopia, nav = globalThis.navigator } = {}) {
  try {
    const valor = await pedir()
    // Sin conexión no se guarda nunca: una función que se traga su error y
    // devuelve vacío (las versiones lo hacen) pisaría la copia buena. Y vacío
    // sin conexión es que no ha llegado nada: se mira la copia.
    if (nav?.onLine === false) {
      if (esMapa ? !valor?.size : !valor?.length) throw new Error('Failed to fetch')
      return valor
    }
    void guardar(clave, esMapa ? [...valor] : valor)
    return valor
  } catch (err) {
    if (!esFalloDeRed(err, nav)) throw err
    const c = await leer(clave)
    if (!c) throw err
    copiaDe = copiaDe ? Math.min(copiaDe, c.en) : c.en
    return esMapa ? new Map(c.valor) : c.valor
  }
}

// Quién eras la última vez (solo el id): sin red, si la sesión no se puede
// renovar, la copia se sigue enseñando a quien la guardó en este navegador.
export function recordarQuienSoy(id, almacen = globalThis.localStorage) {
  try { if (id) almacen.setItem(YO, id) } catch {}
}
export function quienEraSinRed(almacen = globalThis.localStorage, nav = globalThis.navigator) {
  if (nav?.onLine !== false) return null
  try { return almacen.getItem(YO) || null } catch { return null }
}
export function olvidarQuienSoy(almacen = globalThis.localStorage) {
  try { almacen.removeItem(YO) } catch {}
}

// «13 de noviembre, 18:02»: lo que dice el aviso.
export function textoDeLaCopia(en, ahora = new Date()) {
  const d = new Date(en)
  if (Number.isNaN(d.getTime())) return 'Sin cobertura: tu colección tal como la guardaste en este navegador.'
  const mismoDia = d.toDateString() === ahora.toDateString()
  const cuando = mismoDia
    ? `hoy a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    : `el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  return `Sin cobertura: tu colección tal como estaba ${cuando}. Lo que añadas se guarda al volver la red.`
}
