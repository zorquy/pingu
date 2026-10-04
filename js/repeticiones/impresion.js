// Qué impresión de una carta jugó de verdad cada uno (tanda 481).
//
// El registro solo dice el NOMBRE: «Greninja ex». Y de un nombre puede
// haber cartas distintas: el Greninja ex teracristal de Máscaras del
// Crepúsculo (Ráfaga Espejismo) y el de 30th Celebration (Tajo Sigiloso,
// Filo Acuático), que no se parecen en nada. El resolutor por nombre
// (constructor/datos.js) elige la impresión más NUEVA con marca legal, que
// es lo que quiere un mazo pegado sin códigos — y aquí era justo la otra.
// PINGU: «sale como si fuera el Greninja ex de la colección del 30
// aniversario, lógicamente no es así».
//
// Lo que sí dice el registro es qué ATACÓ y qué HABILIDAD usó cada uno
// («usando Ráfaga Espejismo»), y eso es la huella de la carta. Los
// ataques que guardamos son los que lee el laboratorio, en inglés (así los
// lee js/constructor/textos.js), así que se miran en
// TCGdex en español, que es como los escribe TCG Live.
//
// El coste: una petición por Pokémon que ataque o use algo (la de la
// impresión elegida, para ver que casa), y solo si NO casa, la lista de
// las que se llaman igual y la ficha de cada una hasta dar con la buena.

// En el idioma DEL REGISTRO: uno en inglés dice «using Mirage Barrage», y
// contra las fichas en español no casaría nunca (catorce peticiones por
// Pokémon para nada).
const API = (idioma) => `https://api.tcgdex.net/v2/${idioma === 'en' ? 'en' : 'es'}`
const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim()

// Nombre de carta (plano) → nombres de lo que se le ha visto usar (planos).
export function usosPorCarta(lectura) {
  const usos = new Map()
  const pon = (carta, que) => {
    if (!carta || !que) return
    const k = plano(carta)
    if (!usos.has(k)) usos.set(k, new Set())
    usos.get(k).add(plano(que))
  }
  for (const e of lectura?.eventos || []) {
    if (e.tipo === 'ataque') pon(e.pokemon, e.ataque)
    else if (e.tipo === 'usar') pon(e.pokemon, e.que)
  }
  return usos
}

// Los usos de una carta por su nombre, con la misma normalización.
export const usosDe = (mapa, nombre) => mapa?.get(plano(nombre)) || new Set()

// Lo que una ficha de TCGdex sabe hacer: sus ataques y sus habilidades.
const sabeHacer = (ficha) => new Set([...(ficha?.attacks || []), ...(ficha?.abilities || [])].map((x) => plano(x?.name)).filter(Boolean))

// ¿Esta ficha hace TODO lo que se le ha visto hacer? `null` si no se sabe
// (TCGdex no la tiene en español): no saberlo no es no casar.
function casa(ficha, usos) {
  if (!ficha) return null
  const hace = sabeHacer(ficha)
  if (!hace.size) return null
  return [...usos].every((u) => hace.has(u))
}

// La impresión que casa con lo que se jugó, o null si la elegida ya vale
// (o no se puede saber). `pedir` es `fetch` (inyectable para las pruebas).
export async function impresionQueCasa(nombre, usos, elegida, { pedir = fetch, tope = 12, idioma = 'es' } = {}) {
  if (!usos?.size || !elegida?.id) return null
  const ficha = (id) =>
    pedir(`${API(idioma)}/cards/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  if (casa(await ficha(elegida.id), usos)) return null
  let lista = []
  try {
    const r = await pedir(`${API(idioma)}/cards?name=${encodeURIComponent(nombre)}`, { headers: { Accept: 'application/json' } })
    lista = r.ok ? await r.json() : []
  } catch {
    return null
  }
  const objetivo = plano(nombre)
  const candidatas = (Array.isArray(lista) ? lista : []).filter((c) => c?.id && c.id !== elegida.id && plano(c.name) === objetivo).slice(0, tope)
  for (const c of candidatas) {
    const f = await ficha(c.id)
    if (casa(f, usos)) return { id: f.id || c.id, set: f.set?.id || String(c.id).replace(/-[^-]+$/, ''), numero: f.localId || c.localId }
  }
  return null
}

// ── La que se juega en el meta ──
//
// Lo de arriba solo sirve si la carta HACE algo en la partida. Un Pokémon
// que no ataca ni usa nada —el Shaymin de Rivales Predestinados, cuya
// habilidad es pasiva— no deja huella en el registro, y el resolutor por
// nombre se quedaba con la impresión legal más NUEVA, que no tiene por qué
// ser la que lleva nadie. PINGU: «ese Shaymin no es el que se juega
// realmente; el que se está jugando es el de Rivales Predestinados».
//
// La pista que queda es qué impresión LLEVAN los mazos de verdad:
// `meta_cartas_dia` cuenta los Pokémon de las listas de Limitless por
// nombre + colección + número. De cada nombre, la que más mazos suma.
// `filas`: [{ nombre, set_codigo, numero, mazos }] (el nombre, el inglés).
const numeroPlano = (n) => String(n ?? '').trim().toLowerCase().replace(/^0+(?=\w)/, '')

export function masJugadas(filas) {
  const suma = new Map()
  for (const f of filas || []) {
    const set = String(f?.set_codigo || '').trim().toUpperCase()
    const numero = numeroPlano(f?.numero)
    if (!f?.nombre || !set || !numero) continue
    const clave = `${plano(f.nombre)}|${set}|${numero}`
    const x = suma.get(clave) || { nombre: plano(f.nombre), set, numero: String(f.numero).trim(), mazos: 0 }
    x.mazos += Number(f.mazos) || 0
    suma.set(clave, x)
  }
  const mejor = new Map()
  for (const x of suma.values()) {
    const ya = mejor.get(x.nombre)
    if (!ya || x.mazos > ya.mazos) mejor.set(x.nombre, x)
  }
  return mejor
}

// ¿Es esta carta (su código de colección y su número) ESA impresión?
export const esLaImpresion = (codigo, numero, buena) =>
  Boolean(codigo && buena) && String(codigo).toUpperCase() === buena.set && numeroPlano(numero) === numeroPlano(buena.numero)
