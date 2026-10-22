// LO PURO DEL BUSCADOR DE ARRIBA (tanda 972, B1–B6 de la propuesta que
// eligió PINGU: «el buscador es un poco mierda… hay gente que busca ahí
// expansiones, cartas o productos y no sale»). Sin red ni Supabase, para
// que /buscar, la paleta y las pruebas usen lo mismo.
import { normalizeSearch } from './texto.js'
import { esDelTCG, nombreDeSet } from './catalogo-series.js'
import { llevaElNumero } from './mi-coleccion/busqueda.js'

// B1 · LAS EXPANSIONES QUE CASAN CON LO ESCRITO: su código o su id tal cual
// («MEW», «sv3»), su nombre igual («151»), que empiece por ello
// («obsidiana») o que lleve todas las palabras. Las más nuevas primero
// dentro de cada grado. Ni TCG Pocket ni las escondidas.
export function expansionesQueCasan(sets, crudo, limite = 4) {
  const q = normalizeSearch(String(crudo || '')).trim()
  if (q.length < 2) return { filas: [], total: 0 }
  const palabras = q.split(/\s+/).filter(Boolean)
  const grado = (s) => {
    const codigo = normalizeSearch(String(s.tcg_online_code || ''))
    if ((codigo && codigo === q) || normalizeSearch(String(s.id || '')) === q) return 0
    const nombres = [s.name, s.name_en].map((n) => normalizeSearch(String(n || ''))).filter(Boolean)
    if (nombres.some((n) => n === q)) return 1
    if (nombres.some((n) => n.startsWith(q))) return 2
    if (nombres.some((n) => palabras.every((p) => n.includes(p)))) return 3
    return null
  }
  const vistas = new Set()
  const casan = []
  for (const s of sets || []) {
    if (!s || s.oculto || !esDelTCG(s)) continue
    const g = grado(s)
    if (g == null) continue
    // Dos filas del mismo set en el mismo catálogo (un set y su hermano
    // plegado) son una expansión para quien busca.
    const clave = `${s.market || 'WEST'}:${normalizeSearch(nombreDeSet(s))}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    casan.push({ s, g })
  }
  casan.sort((a, b) => a.g - b.g || String(b.s.release_date || '').localeCompare(String(a.s.release_date || '')))
  return { filas: casan.slice(0, limite).map((x) => x.s), total: casan.length }
}

// Adónde lleva una expansión: su estantería en /cartas (que se ve sin
// cuenta), en su catálogo.
export const rutaDeExpansion = (s) => `/cartas?ver=album&set=${encodeURIComponent(s?.id ?? '')}${s?.market === 'JP' ? '&catalogo=JP' : ''}`

// B2 · EL MEJOR RESULTADO: una carta concreta, cuando lo escrito la señala
// —un número impreso que solo lleva una de las que salen, o la expansión
// dicha con su código o su total («MEW 151», «4/102»)—. Si el número lo
// llevan varias («Pikachu 25» en veinte sets), no hay una mejor: null.
export function mejorResultado(todas, leida) {
  if (!leida?.numero || !Array.isArray(todas) || !todas.length) return null
  const conNumero = todas.filter((c) => llevaElNumero(c.local_id, leida.numero, leida.prefijo))
  if (conNumero.length === 1) return conNumero[0]
  if (conNumero.length && leida.setIds?.length) return conNumero[0]
  return null
}

// B4 · CUÁNTOS hay en cada grupo, para su chapa: el total cuando se sabe
// («24»), y si solo se sabe que hay más de los que se han pedido, «4+».
// null = no se ha preguntado o ha fallado (la chapa va sin número).
export function cuentaDeGrupo(estado, pedidos) {
  if (!estado || estado.error) return null
  if (Number.isFinite(estado.total)) return estado.hayMas ? `${estado.total}+` : String(estado.total)
  const n = estado.filas?.length || 0
  return estado.hayMas || (pedidos && n >= pedidos) ? `${n}+` : String(n)
}

// B6 · Con «@» delante se busca a la GENTE, y solo a la gente: «@ibai» no
// es una carta ni una guía.
export const esPersona = (q) => /^\s*@/.test(String(q || ''))
export const sinArroba = (q) => String(q || '').replace(/^\s*@+/, '').trim()
