// De un montón de decklists a «qué cartas se juegan» (tanda 325).
//
// Función PURA: entran las listas y el catálogo de arquetipos, sale lo
// que va en `tcg_card_play`. Ni red, ni base, ni fecha. Así se prueba
// con seis listas escritas a mano y sin montar nada.
//
// El arquetipo se deduce con `js/torneos/arquetipos.js`, EL MISMO módulo
// que pinta los mazos de un torneo. No hay una segunda opinión sobre qué
// es un Ceruledge Dusknoir: si algún día se afina la deducción, se afina
// para los dos sitios a la vez.
import { arquetipoDeMazo, claveDeArquetipo, normalizarNombre } from '../../js/torneos/arquetipos.js'

// Cuántos arquetipos se guardan por carta. Los tres primeros cuentan la
// historia; del cuarto para abajo es ruido con una copia cada uno, y
// todos juntos salen como «Otros».
export const ARQUETIPOS_POR_CARTA = 3

// Las energías básicas no dicen nada de un mazo: las lleva todo el
// mundo y saldrían siempre las primeras en cualquier «lo más jugado».
// Se cuentan igual dentro de su propia ficha, pero no ensucian el resto.
function esLineaDeMazo(seccion) {
  return seccion === 'pokemon' || seccion === 'trainer'
}

// Una decklist son `{ parsed_cards, tournament_id }`. Lo que se devuelve
// va indexado por nombre normalizado, que es como se pregunta desde la
// ficha de una carta.
export function agregarJuego(decklists, catalogo = []) {
  const porCarta = new Map()

  for (const lista of decklists || []) {
    const parsed = lista?.parsed_cards
    if (!parsed || typeof parsed !== 'object') continue

    // El arquetipo se deduce UNA vez por mazo, no una por carta.
    const arq = arquetipoDeMazo(parsed, catalogo)
    const clave = arq ? claveDeArquetipo(arq) : null
    const nombreArq = arq?.nombre || null
    const torneo = lista?.tournament_id || null

    // Dentro de un mismo mazo, la misma carta puede venir en varias
    // líneas (dos reimpresiones de Iono). Cuenta como UN mazo y como la
    // suma de sus copias.
    const enEsteMazo = new Map()
    for (const seccion of ['pokemon', 'trainer', 'energy']) {
      if (!esLineaDeMazo(seccion)) continue
      for (const linea of parsed[seccion] || []) {
        const nombre = String(linea?.name ?? '').trim()
        if (!nombre) continue
        const key = normalizarNombre(nombre)
        if (!key) continue
        const copias = Number(linea?.quantity)
        const previo = enEsteMazo.get(key)
        enEsteMazo.set(key, {
          nombre: previo?.nombre || nombre,
          copias: (previo?.copias || 0) + (Number.isFinite(copias) && copias > 0 ? copias : 0),
        })
      }
    }

    for (const [key, { nombre, copias }] of enEsteMazo) {
      let fila = porCarta.get(key)
      if (!fila) {
        fila = { name_key: key, name: nombre, decks: 0, total_copies: 0, torneos: new Set(), arq: new Map() }
        porCarta.set(key, fila)
      }
      fila.decks += 1
      fila.total_copies += copias
      if (torneo) fila.torneos.add(torneo)
      if (clave) {
        const a = fila.arq.get(clave) || { clave, nombre: nombreArq, mazos: 0 }
        a.mazos += 1
        fila.arq.set(clave, a)
      }
    }
  }

  return [...porCarta.values()].map((f) => ({
    name_key: f.name_key,
    name: f.name,
    decks: f.decks,
    total_copies: f.total_copies,
    tournaments: f.torneos.size,
    // Los arquetipos, de más mazos a menos. A empate manda el nombre,
    // que no es mejor criterio pero sí uno ESTABLE: sin él, dos empates
    // se pintarían distinto en dos cálculos seguidos y parecería que
    // algo se mueve cuando no se mueve nada.
    archetypes: [...f.arq.values()]
      .sort((a, b) => b.mazos - a.mazos || String(a.nombre).localeCompare(String(b.nombre)))
      .slice(0, ARQUETIPOS_POR_CARTA),
  }))
}
