// ── Lo puro de «Versiones de todas» (tanda 949) ──
//
// Sin DOM ni Supabase, para que una prueba lo importe en Node (la 471): qué
// versiones se ofrecen, qué cartas entran según los filtros y cuántas filas
// se crearían. La base (catalogo_versiones_lote) hace lo que se le pide; lo
// que se le pide se decide aquí.

// Las de siempre, con la etiqueta como la escribe TCGGO (es la llave: la web
// la convierte en id con `varianteDeEtiqueta`, y la base con
// `catalogo_id_de_version`). PINGU: «normalmente son primera edición y
// unlimited»; las Reverse son las de Reviving Legends del foro.
export const VERSIONES_LOTE = [
  { etiqueta: '1st Edition', nombre: '1.ª edición' },
  { etiqueta: 'Unlimited', nombre: 'Unlimited' },
  { etiqueta: '1st Edition Reverse Holo', nombre: '1.ª edición Reverse' },
  { etiqueta: 'Unlimited Reverse Holo', nombre: 'Unlimited Reverse' },
  { etiqueta: 'Normal', nombre: 'Normal' },
  { etiqueta: 'Holo', nombre: 'Holo' },
  { etiqueta: 'Reverse Holo', nombre: 'Reverse Holo' },
]

export const SIN_RAREZA = 'Sin rareza'
export const rarezaDe = (c) => String(c?.rarity_en || c?.rarity || '').trim() || SIN_RAREZA

// El número de una carta para el «desde/hasta»: el de delante de la barra
// («003/106» → 3). Un número que no lo es («SP», «TG01») no entra en un
// rango; sin rango, entra.
export function numeroDe(c) {
  const n = parseInt(String(c?.local_id ?? '').split('/')[0].replace(/^[^0-9]+/, ''), 10)
  return Number.isFinite(n) ? n : null
}

// Las rarezas del set, con cuántas cartas tiene cada una, de más a menos.
export function rarezasDelSet(cartas) {
  const cuenta = new Map()
  for (const c of cartas || []) cuenta.set(rarezaDe(c), (cuenta.get(rarezaDe(c)) || 0) + 1)
  return [...cuenta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([rareza, n]) => ({ rareza, n }))
}

// Las cartas que entran: las de las rarezas marcadas (todas si `rarezas` es
// null) y, con desde o hasta, las de ese tramo de números.
export function cartasDelLote(cartas, { rarezas = null, desde = null, hasta = null } = {}) {
  const conRango = desde != null || hasta != null
  return (cartas || []).filter((c) => {
    if (rarezas && !rarezas.has(rarezaDe(c))) return false
    if (!conRango) return true
    const n = numeroDe(c)
    if (n == null) return false
    return (desde == null || n >= desde) && (hasta == null || n <= hasta)
  })
}

// Las etiquetas elegidas, en el orden de la lista y sin repetir (sin
// distinguir caja, como la base); la «otra» escrita a mano, detrás.
export function etiquetasElegidas(marcadas, otra = '') {
  const fuera = []
  for (const t of [...(marcadas || []), ...String(otra || '').split(',')]) {
    const e = String(t || '').trim()
    if (e && e.length <= 60 && !fuera.some((x) => x.toLowerCase() === e.toLowerCase())) fuera.push(e)
  }
  return fuera
}

// Cuántas filas crearía (y cuántas ya estaban), con `tiene` = mapa
// card_id → etiquetas de edición que ya lleva (en minúsculas).
export function resumenDelLote(cartas, etiquetas, tiene = new Map()) {
  let nuevas = 0
  let ya = 0
  let quitables = 0
  for (const c of cartas || []) {
    const suyas = tiene.get(c.id) || new Set()
    for (const e of etiquetas || []) {
      if (suyas.has(e.toLowerCase())) { ya++; quitables++ } else nuevas++
    }
  }
  return { cartas: (cartas || []).length, nuevas, ya, quitables }
}

export const AVISO_LOTE = 'Falta ejecutar supabase-migration-949-versiones-en-lote.sql en el SQL Editor: hasta entonces no se pueden poner versiones a todo un set.'
