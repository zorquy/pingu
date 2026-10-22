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

// LAS PANTALLAS DE VARIOS BLOQUES (984): la portada o un perfil no tienen un
// «ya está» en un solo sitio, cada bloque llega por su lado. Se pinta lo
// guardado y se mira el DOM: un bloque cuenta como al día en cuanto alguien le
// cambia el contenido DESPUÉS de pintar lo guardado. Se guarda al ratito de
// cada cambio y al irse, y de los bloques que no se han vuelto a pintar se
// queda lo de la vez anterior, nunca su esqueleto. `atributos`: huecos cuyo
// `style` y `class` también cuentan (el banner y el avatar de un perfil).
// Lo pintado desde lo guardado no tiene manejadores hasta que se sustituye.
export function vistaVigilada(clave, ids, { atributos = [], doc = document, storage = almacen(), espera = 800, ttl } = {}) {
  const previa = leerVista(clave, { storage, ttl })
  const atrs = previa?.atributos || {}
  if (previa) {
    pintarUltimaVista(clave, { doc, storage, ttl })
    for (const [id, a] of Object.entries(atrs)) {
      const el = doc.getElementById(id)
      if (!el || !a) continue
      if (typeof a.style === 'string') el.setAttribute('style', a.style)
      if (typeof a.clase === 'string') el.className = a.clase
    }
  }
  const frescos = new Set()
  let reloj = null
  const guardar = () => {
    clearTimeout(reloj)
    if (!frescos.size) return
    const partes = { ...(previa?.partes || {}) }
    const nuevosAtrs = { ...atrs }
    for (const id of frescos) {
      const el = doc.getElementById(id)
      if (!el) continue
      if (ids.includes(id)) partes[id] = el.innerHTML
      if (atributos.includes(id)) nuevosAtrs[id] = { style: el.getAttribute('style') || '', clase: el.className }
    }
    try {
      const texto = JSON.stringify({ t: Date.now(), partes, visibles: null, atributos: nuevosAtrs })
      if (texto.length <= MAX_CARACTERES) storage.setItem(clave, texto)
    } catch {}
  }
  const vigilados = [...new Set([...ids, ...atributos])]
  for (const id of vigilados) {
    const el = doc.getElementById(id)
    if (!el) continue
    new MutationObserver(() => {
      frescos.add(id)
      // El punto se apaga cuando se ha vuelto a pintar todo lo que salió de lo
      // guardado (lo que no estaba guardado no estaba enseñando nada viejo).
      if (Object.keys(previa?.partes || {}).every((i) => frescos.has(i) || !doc.getElementById(i))) vistaAlDia(doc)
      clearTimeout(reloj)
      reloj = setTimeout(guardar, espera)
    }).observe(el, atributos.includes(id) ? { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] } : { childList: true, subtree: true, characterData: true })
  }
  doc.defaultView?.addEventListener('pagehide', guardar)
  // Lo que no llegue nunca (un bloque que falla) no deja el punto encendido.
  setTimeout(() => vistaAlDia(doc), 10_000)
  return previa
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
