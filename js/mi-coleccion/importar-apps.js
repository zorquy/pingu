// Traer tu colección de otras apps (tanda 1329, G5 del plan 2027): de dónde
// viene (para decir cómo sacarla de allí y qué se entiende de su fichero) y lo
// que no se ha podido casar, para arreglarlo a mano. Puro: se prueba con node.
//
// Las columnas las sigue reconociendo `reconocerColumnas` (importar-csv.js),
// que no necesita saber de dónde viene: elegir la app solo explica. Los pasos
// son a propósito generales («busca Exportar»): una frase que nombra un menú
// de otra app afirma que existe, y esas apps cambian sin avisarnos.

import { escapeHtml } from '../html.js'

export const APPS = [
  { id: 'dex', nombre: 'Dex', lee: 'expansión, número, versión, estado, idioma y lo que pagaste' },
  { id: 'collectr', nombre: 'Collectr', lee: 'expansión, número, versión, estado, gradeo y lo que pagaste' },
  { id: 'tcgplayer', nombre: 'TCGplayer', lee: 'expansión (nombre o código), número, versión (Printing), estado e idioma' },
  { id: 'cardmarket', nombre: 'Cardmarket', lee: 'expansión, número, estado, idioma y si es foil' },
  { id: 'pokellector', nombre: 'Pokellector', lee: 'expansión y número (si tu lista los trae)' },
  { id: 'otra', nombre: 'Excel u otra', lee: 'cualquier columna con la expansión (nombre o código) y el número' },
]

export const appPorId = (id) => APPS.find((a) => a.id === id) || null

// Lo que se dice al elegir una app: cómo sacarla y qué se entiende.
export function pasosDe(id) {
  const a = appPorId(id)
  if (!a) return ''
  const sacar = a.id === 'otra'
    ? 'Guarda la hoja como CSV (o copia las filas con su cabecera) y pégala aquí.'
    : `En ${a.nombre}, busca «Exportar» o «Export CSV» en tu colección y pega aquí el fichero o súbelo.`
  return `${sacar} De su fichero leemos ${a.lee}. Lo mínimo es la expansión y el número de cada carta.`
}

// Qué app parece un fichero por su cabecera (ya plegada), además de las que
// reconoce `reconocerColumnas`. Solo para decirlo: no cambia cómo se lee.
export function appDeCabecera(plegadas = []) {
  const tiene = (c) => plegadas.includes(c)
  if (tiene('simple name') || (tiene('product id') && tiene('printing'))) return 'tcgplayer'
  if (tiene('idproduct') || tiene('cardmarketid') || tiene('isfoil')) return 'cardmarket'
  return null
}

// Las filas que no casan, para arreglarlas a mano: un enlace para buscar cada
// una en el catálogo (por nombre, o por expansión y número) y un CSV con ellas
// para guardarlas y volver a intentarlo.
export function busquedaDePerdida(p) {
  const e = p?.entrada || {}
  const q = [e.nombre, e.nombre ? '' : e.set || e.codigo, e.nombre ? '' : e.numero].filter(Boolean).join(' ').trim()
  return q ? `/mi-coleccion?ver=buscar&q=${encodeURIComponent(q)}` : null
}

export function perdidasHtml(perdidas, { tope = 60 } = {}) {
  if (!perdidas?.length) return ''
  const filas = perdidas.slice(0, tope).map((p) => {
    const e = p.entrada || {}
    const href = busquedaDePerdida(p)
    const quien = [e.nombre, [e.set || e.codigo, e.numero].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')
    return `<li><span>Línea ${e.fila}${quien ? ` · ${escapeHtml(quien)}` : ''}</span> <span class="subtext">${escapeHtml(p.motivo)}</span>${href ? ` <a class="mc-imp-buscar" href="${escapeHtml(href)}" target="_blank" rel="noopener">Buscarla</a>` : ''}</li>`
  }).join('')
  return `<div class="mc-imp-perdidas-cab"><p class="mc-imp-titulo">Sin encontrar (${perdidas.length}): búscalas y añádelas a mano</p><button type="button" class="btn-secondary" data-imp-descargar-perdidas>Descargar las que faltan</button></div>
    <ul class="mc-imp-lista">${filas}${perdidas.length > tope ? `<li class="subtext">…y ${perdidas.length - tope} más (van todas en el fichero)</li>` : ''}</ul>`
}

const celda = (v) => {
  const t = v == null ? '' : String(v)
  return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
export function csvDePerdidas(perdidas) {
  const cab = ['Línea', 'Carta', 'Expansión', 'Código', 'Número', 'Cantidad', 'Idioma', 'Estado', 'Por qué no entró']
  const filas = (perdidas || []).map(({ entrada: e = {}, motivo }) => [e.fila, e.nombre, e.set, e.codigo, e.numero, e.cantidad, e.idioma, e.estado, motivo].map(celda).join(','))
  return [cab.join(','), ...filas].join('\n')
}
