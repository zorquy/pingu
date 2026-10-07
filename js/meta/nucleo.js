// Lo puro de los mazos del meta (tanda 364): de una lista de Limitless
// a lo que se enseña, se copia o se abre en el constructor. Sin DOM y sin
// Supabase: se prueba en Node tal cual.
//
// Una lista de Limitless llega así (la guarda la base tal cual):
//   { pokemon: [{ count, name, set, number }], trainer: […], energy: […] }
// `set` es el código de TCG Live («TWM»), salvo las promos, que llegan
// con el de Limitless («SVP», «MEP»).
import { letraDeEnergia, esEnergiaBasica, PROMOS_SIN_GUION } from '../constructor/nucleo.js'

export const SECCIONES = [
  { campo: 'pokemon', titulo: 'Pokémon', live: 'Pokémon' },
  { campo: 'trainer', titulo: 'Entrenadores', live: 'Trainer' },
  { campo: 'energy', titulo: 'Energías', live: 'Energy' },
]

// Las ventanas que se pueden elegir. Una semana es el meta de AHORA; un
// mes ya mezcla dos metas si ha salido colección. Los 90 días están por
// los OFICIALES (tanda 366): hay dos o tres al mes y con menos no se ve
// nada.
export const PERIODOS = [7, 14, 30, 90]
export const PERIODO_POR_DEFECTO = 14

// De dónde sale cada torneo (tanda 366). `null` es «todas».
export const FUENTES = [
  { id: null, nombre: 'Todos' },
  { id: 'oficial', nombre: 'Oficiales' },
  { id: 'online', nombre: 'Online' },
  { id: 'pokedoc', nombre: 'PokeDoc' },
]
export function fuenteDe(valor) {
  return FUENTES.some((f) => f.id === valor) ? valor : null
}
export const NOMBRE_DE_FUENTE = { oficial: 'Oficial', online: 'Online', pokedoc: 'PokeDoc' }

export function periodoDe(valor) {
  const n = Number(valor)
  return PERIODOS.includes(n) ? n : PERIODO_POR_DEFECTO
}

// Por debajo de esto un arquetipo no tiene muestra: su % de victorias es
// ruido y su lista media la deciden dos personas. Decide tres cosas a la
// vez —y por eso vive aquí, en un sitio—: qué filas salen del desplegable
// «ver todos» en /meta, qué fichas llevan `noindex` y cuáles van al
// sitemap. Miles de fichas casi vacías hunden el dominio (tanda 322).
export const MIN_MAZOS_CON_MUESTRA = 30

// Limitless mete aquí lo que no sabe clasificar.
export const ARQUETIPO_OTROS = 'other'

// ── Los iconos ──
//
// Los nombres de icono de Limitless son los de su CDN de minisprites
// («dragapult», «sharpedo-mega»): la misma que ya usa la web para los
// arquetipos de los torneos (sprites-pokemon.js). Una mega recién salida
// puede no tener sprite todavía: se prueba con la especie base antes
// de pasar a la cadena de respaldos de siempre.
export function urlDeIcono(icono, cdn) {
  const s = String(icono || '').toLowerCase()
  return /^[a-z0-9-]+$/.test(s) ? `${cdn}/${s}.png` : null
}

export function especieBaseDeIcono(icono) {
  const s = String(icono || '').toLowerCase()
  const base = s.replace(/-(mega|mega-x|mega-y)$/, '')
  return base !== s ? base : null
}

// ── Números que se leen ──
const fmt1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' })
const fmt2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: 'always' })
const fmt0 = new Intl.NumberFormat('es-ES', { useGrouping: 'always' })

export function porcentaje(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? `${fmt1.format(n)} %` : '—'
}

export function copiasMedias(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? `×${fmt2.format(Math.round(n * 10) / 10)}` : ''
}

export function entero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? fmt0.format(n) : '0'
}

// La flecha de «sube / baja». Solo con dato del periodo anterior Y con
// una diferencia que se note: medio punto arriba o abajo en un mazo del
// 3 % es el ruido de un torneo grande más o menos, y una flecha verde
// por eso sería mentir con buena cara.
export function tendencia(cuota, anterior) {
  const a = Number(cuota)
  const b = anterior === null || anterior === undefined ? NaN : Number(anterior)
  if (!Number.isFinite(a)) return null
  if (!Number.isFinite(b)) return { tipo: 'nuevo', diferencia: null }
  const d = Math.round((a - b) * 10) / 10
  if (Math.abs(d) < 0.5) return { tipo: 'igual', diferencia: d }
  return { tipo: d > 0 ? 'sube' : 'baja', diferencia: d }
}

export function textoTendencia(t) {
  if (!t) return ''
  if (t.tipo === 'nuevo') return 'Nuevo'
  if (t.tipo === 'igual') return '='
  return `${t.diferencia > 0 ? '+' : '−'}${fmt1.format(Math.abs(t.diferencia))}`
}

export function puestoOrdinal(puesto) {
  const n = Number(puesto)
  return Number.isFinite(n) && n > 0 ? `${n}.º` : '—'
}

export function resultado(v, d, e) {
  return `${v || 0}-${d || 0}-${e || 0}`
}

// ── La lista ──
export function totalDeLista(lista) {
  return SECCIONES.reduce((s, { campo }) => s + (lista?.[campo] || []).reduce((t, l) => t + (Number(l.count) || 0), 0), 0)
}

// A la forma de `parseDecklist` del motor de torneos ({ quantity, name,
// set, number }), que es la que entienden la rejilla de cartas
// (pintarDecklistVisual) y la imagen descargable.
export function comoDecklist(lista) {
  const fuera = { total: totalDeLista(lista) }
  for (const { campo } of SECCIONES) {
    fuera[campo] = (lista?.[campo] || [])
      .filter((l) => Number(l.count) > 0 && l.name)
      .map((l) => ({ quantity: Number(l.count), name: String(l.name), set: String(l.set || ''), number: String(l.number || '') }))
  }
  return fuera
}

// Las promos van con su código de TCG Live («PR-SV 92»): el importador
// del juego no conoce «SVP». Es la tabla del constructor leída al revés.
const PROMO_LIVE = Object.fromEntries(Object.entries(PROMOS_SIN_GUION).map(([live, limitless]) => [limitless, live]))

export function lineaTcgLive(l) {
  const n = Number(l.count) || 0
  const set = String(l.set || '').toUpperCase()
  const numero = String(l.number || '')
  // Las básicas, como las exporta TCG Live y como las escribe el
  // constructor: «Basic {P} Energy MEE 13».
  if (esEnergiaBasica({ name: l.name, set_id: set.toLowerCase() })) {
    const letra = letraDeEnergia(l.name)
    if (letra) return `${n} Basic {${letra}} Energy ${set} ${numero}`.trim()
  }
  return `${n} ${l.name} ${PROMO_LIVE[set] || set} ${numero}`.replace(/\s+/g, ' ').trim()
}

export function textoTcgLive(lista) {
  const bloques = []
  for (const { campo, live } of SECCIONES) {
    const lineas = (lista?.[campo] || []).filter((l) => Number(l.count) > 0 && l.name)
    if (!lineas.length) continue
    const suma = lineas.reduce((s, l) => s + Number(l.count), 0)
    bloques.push(`${live}: ${suma}\n${lineas.map(lineaTcgLive).join('\n')}`)
  }
  return `${bloques.join('\n\n')}\n\nTotal Cards: ${totalDeLista(lista)}`
}

// ── Hacia el constructor ──
//
// Con el formato del enlace del builder de Limitless (`?i=`), que el
// constructor ya sabe leer (leerEnlaceLimitless, nucleo.js): así la
// lista entra por el camino de siempre —por colección y número, con los
// alias de las promos— sin inventar un tercer formato.
//
//   1 + por carta: [región 0][copias en base 62][long. set][long. número][SET][NÚMERO]
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function codigoLimitless(lista) {
  let s = '1'
  for (const { campo } of SECCIONES) {
    for (const l of lista?.[campo] || []) {
      const n = Number(l.count)
      const set = String(l.set || '').toUpperCase()
      const numero = String(l.number || '').replace(/^0+(?=\d)/, '')
      // Lo que no cabe en el formato (sin set, o con un código de más de
      // nueve letras) se queda fuera: el constructor avisará de que faltan
      // cartas, que es mejor que un enlace que no se lee entero.
      if (!(n >= 1 && n <= 61) || !/^[A-Z0-9-]{1,9}$/.test(set) || !/^[A-Za-z0-9]{1,9}$/.test(numero)) continue
      s += `0${BASE62[n]}${set.length}${numero.length}${set}${numero}`
    }
  }
  return s
}

export function enlaceConstructor(lista, nombre = '', { laboratorio = false } = {}) {
  const p = new URLSearchParams({ i: codigoLimitless(lista) })
  if (nombre) p.set('nombre', String(nombre).slice(0, 80))
  // `lab`: abre el laboratorio de pruebas nada más cargar (tanda 384).
  if (laboratorio) p.set('lab', '1')
  return `/constructor?${p.toString()}`
}

// La ficha de la lista en Limitless: es de donde sale el dato y quien lo
// quiera ver en su sitio original tiene que poder llegar.
export function enlaceLimitless(torneoId, jugador) {
  if (!torneoId || !jugador) return null
  return `https://play.limitlesstcg.com/tournament/${encodeURIComponent(torneoId)}/player/${encodeURIComponent(jugador)}/decklist`
}

// ── La lista media ──
//
// Las filas de `meta_lista_media` partidas en las tres secciones y, en
// cada una, el NÚCLEO (lo que lleva casi todo el mundo) separado de las
// OPCIONES. El corte, en el 50 %: una carta que lleva menos de la mitad
// no es parte del mazo, es una decisión de quien lo juega.
export const CORTE_DE_NUCLEO = 50

export function partirListaMedia(filas) {
  const fuera = {}
  for (const { campo } of SECCIONES) fuera[campo] = { nucleo: [], opciones: [] }
  for (const f of filas || []) {
    const sitio = fuera[f.seccion]
    if (!sitio) continue
    ;(Number(f.porcentaje) >= CORTE_DE_NUCLEO ? sitio.nucleo : sitio.opciones).push(f)
  }
  return fuera
}

// Una lista de 60 «tipo» a partir de la media: el núcleo con sus copias
// redondeadas. NO se ofrece como lista para copiar —no la ha jugado
// nadie y puede no cuadrar a 60—, solo dice cuántas cartas fijas tiene
// el mazo, que es lo que cuenta la cabecera de la lista media.
export function cartasDelNucleo(filas) {
  return (filas || [])
    .filter((f) => Number(f.porcentaje) >= CORTE_DE_NUCLEO)
    .reduce((s, f) => s + Math.round(Number(f.media) || 0), 0)
}
