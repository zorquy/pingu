// ── Lo puro de «Una versión a varias» (tanda 999) ──
//
// Sin DOM ni Supabase, para que una prueba lo importe en Node (la 471): qué
// números se han pegado, qué cartas entran, cuáles ya llevan esa versión y
// qué se le manda a `catalogo_version_mano` (la 934) por cada una.
import { varianteDeEtiqueta } from '../../js/mi-coleccion/variantes.js'

// Las tres clases de una versión a mano, como el formulario de una carta.
export const CLASES_DE_VERSION = [
  ['adicional', 'Adicional (no cuenta para el set maestro)'],
  ['sello', 'Sello: Pokémon Day, prerelease, staff (no cuenta)'],
  ['impresion', 'Impresión (cuenta, como la Reverse)'],
]

// Los nombres que la base no deja usar (son los de siempre: `catalogo_version_mano`).
const RESERVADOS = new Set(['normal', 'reverse', 'holo', 'primera', 'reverse-holo', 'standard', '1st-edition', 'first-edition'])

// Un número para comparar: lo de delante de la barra, sin espacios, en
// minúsculas y sin ceros delante de cada tramo de cifras («003/106» → «3»,
// «TG01» → «tg1», «SVP 205» → «svp205»).
export function numeroComparable(valor) {
  const t = String(valor ?? '').split('/')[0].toLowerCase().replace(/\s+/g, '')
  return t.replace(/\d+/g, (d) => String(Number(d)))
}

// Lo pegado: números sueltos o tramos («101-103»), separados por comas,
// espacios, puntos y comas o saltos de línea. Un tramo al revés se da la
// vuelta; uno de más de 400 no se expande (es una errata, no un set).
export function numerosDeTexto(texto) {
  const fuera = new Set()
  for (const trozo of String(texto || '').split(/[,;\n]+/)) {
    const t = trozo.trim()
    if (!t) continue
    const tramo = t.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (tramo) {
      let [a, b] = [Number(tramo[1]), Number(tramo[2])]
      if (a > b) [a, b] = [b, a]
      if (b - a <= 400) {
        for (let n = a; n <= b; n++) fuera.add(String(n))
        continue
      }
    }
    // «SVP 205» es UN número; «4 25 58», tres.
    const sueltos = /^[a-z]+\s+\d+$/i.test(t) ? [t] : t.split(/\s+/)
    for (const suelto of sueltos) if (suelto) fuera.add(numeroComparable(suelto))
  }
  return fuera
}

// Las cartas cuyo número está en lo pegado, en el orden del set.
export const cartasDeNumeros = (cartas, numeros) => (cartas || []).filter((c) => numeros.has(numeroComparable(c.local_id)))

// El nombre, como lo guarda la base, y si se puede usar.
export const idDeVersion = (etiqueta) => varianteDeEtiqueta(etiqueta)
export function problemaDelNombre(etiqueta) {
  const t = String(etiqueta || '').trim()
  if (!t) return 'Ponle un nombre a la versión (por ejemplo, «Cosmos Holo»).'
  if (t.length > 60) return 'El nombre es demasiado largo.'
  if (RESERVADOS.has(idDeVersion(t))) return 'Ese nombre es el de una versión de siempre: ponle otro.'
  return null
}

// `tiene`: card_id → ids de las versiones que ya lleva. Una carta que ya
// tiene una con ese nombre no se repite.
export function planDeVarias(elegidas, etiqueta, tiene = new Map()) {
  const id = idDeVersion(etiqueta)
  const crear = []
  const ya = []
  for (const c of elegidas || []) (tiene.get(c.id)?.has(id) ? ya : crear).push(c)
  return { crear, ya }
}

// Lo que se le manda a `catalogo_version_mano` por cada carta. El icono va
// vacío: la web lo saca del nombre (`iconoDeVersion`: «Cosmos» → destellos).
export function datosDeVersion({ etiqueta, salio_en = '', lanzamiento = '', clase = 'adicional' }) {
  return {
    etiqueta: String(etiqueta || '').trim(),
    salio_en: String(salio_en || '').trim(),
    lanzamiento: /^\d{4}-\d{2}-\d{2}$/.test(String(lanzamiento || '')) ? lanzamiento : '',
    clase: CLASES_DE_VERSION.some(([k]) => k === clase) ? clase : 'adicional',
    icono: '',
  }
}

export const AVISO_934 = 'Falta ejecutar supabase-migration-934-versiones-a-mano.sql en el SQL Editor: hasta entonces no se pueden crear versiones a mano.'
