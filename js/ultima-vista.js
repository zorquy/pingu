// LA ÚLTIMA VISTA, PINTADA YA (tanda 894, R2 de «Rápida y limpia»).
//
// Las listas que se abren cada día —el foro, el meta, las noticias, los
// lanzamientos, los torneos, el Panel de tu colección— se guardan en el
// navegador tal como se pintaron la última vez. Al volver se pintan al
// instante desde ahí, con un punto junto al título que dice «pidiendo lo
// nuevo», y en cuanto llega lo de ahora se sustituye. Es lo que hace
// cualquier app: nadie vuelve a ver un esqueleto de algo que ya vio ayer.
//
// Lo que se guarda es el HTML de unos huecos (por id) y, si hace falta,
// qué huecos estaban a la vista (`visibles`, los que se esconden con la
// clase `hidden`). La clave lleva QUIÉN miraba: el foro enseña tus no
// leídos y el Panel es tuyo, así que otra cuenta en el mismo navegador no
// puede ver lo de la anterior — y al salir se olvidan todas
// (`olvidarVistas`, desde `signOut`). Caduca a la semana y no se guarda lo
// que no cabe. Sin imports, para probarlo en Node.

const PREFIJO = 'pokedoc-uv-'
export const TTL_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_CARACTERES = 200_000

const almacen = () => globalThis.localStorage

export function claveDeVista(pagina, quien = null) {
  return `${PREFIJO}${pagina}|${quien || 'anon'}`
}

export function tomarPartes(ids, doc = document) {
  const partes = {}
  for (const id of ids) {
    const el = doc.getElementById(id)
    if (el) partes[id] = el.innerHTML
  }
  return partes
}

export function visiblesDe(ids, doc = document) {
  const v = {}
  for (const id of ids) {
    const el = doc.getElementById(id)
    if (el) v[id] = !el.classList.contains('hidden') && !el.hidden
  }
  return v
}

export function guardarVista(clave, partes, { visibles = null, storage = almacen(), ahora = Date.now() } = {}) {
  try {
    const texto = JSON.stringify({ t: ahora, partes, visibles })
    if (texto.length > MAX_CARACTERES) return false
    storage.setItem(clave, texto)
    return true
  } catch {
    return false
  }
}

export function leerVista(clave, { storage = almacen(), ahora = Date.now(), ttl = TTL_MS } = {}) {
  try {
    const crudo = storage.getItem(clave)
    if (!crudo) return null
    const v = JSON.parse(crudo)
    if (!v || typeof v.t !== 'number' || !v.partes || typeof v.partes !== 'object') return null
    if (ahora - v.t > ttl) return null
    return v
  } catch {
    return null
  }
}

// Pinta lo guardado y enciende el punto. Devuelve lo pintado, o null si no
// había nada (y entonces la página se queda con su esqueleto de siempre).
export function pintarUltimaVista(clave, { doc = document, storage, ahora, ttl } = {}) {
  const v = leerVista(clave, { storage, ahora, ttl })
  if (!v) return null
  for (const [id, html] of Object.entries(v.partes)) {
    const el = doc.getElementById(id)
    if (el && typeof html === 'string') el.innerHTML = html
  }
  for (const [id, visible] of Object.entries(v.visibles || {})) {
    const el = doc.getElementById(id)
    if (el) el.classList.toggle('hidden', !visible)
  }
  doc.documentElement.classList.add('uv-actualizando')
  return v
}

export function vistaAlDia(doc = document) {
  doc.documentElement.classList.remove('uv-actualizando')
}

export function olvidarVistas(storage = almacen()) {
  try {
    const claves = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith(PREFIJO)) claves.push(k)
    }
    for (const k of claves) storage.removeItem(k)
    return claves.length
  } catch {
    return 0
  }
}
