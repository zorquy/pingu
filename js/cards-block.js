import { escapeHtml } from './app.js'
import { cardsByIds, cardImageUrl, refCarta, parseRefCarta, MERCADO_POR_DEFECTO } from './tcgdex.js'

// Una lista de cartas dentro de una guía.
//
// Lo que se guarda en la guía es SOLO esto:
//   <tcg-deck data-cards="swsh3-136,base1-4"></tcg-deck>
//
// Ni imágenes, ni nombres, ni maquetación. El dibujo lo genera esta web
// a partir de `tcg_cards`, que es nuestra. Tres motivos:
//
//   1. Lo que escribe un autor nunca acaba siendo HTML de verdad: solo
//      identificadores, y encima validados contra la base.
//   2. Si mañana cambia el diseño de las cartas, cambian TODAS las guías
//      ya escritas sin tocarlas.
//   3. Si TCGdex corrige el nombre de una carta, la guía se corrige sola.

const MAX_CARTAS = 60

// Los identificadores de TCGdex son del tipo "swsh3-136", "sv03.5-1",
// "xyp-XY99". Nada más puede entrar aquí.
export function parseDeckIds(valor) {
  return String(valor || '')
    .split(',')
    .map((s) => s.trim())
    // "sv1-25" es una carta occidental; "CS1a-1@TW" la misma en chino
    // tradicional. El sufijo es opcional para que las guías escritas
    // antes de haber varios mercados sigan valiendo tal cual.
    .filter((s) => /^[a-zA-Z0-9.]+-[a-zA-Z0-9.]+(@[A-Z]{2,4})?$/.test(s))
    .slice(0, MAX_CARTAS)
}

export function deckAttrValue(ids) {
  return parseDeckIds(ids.join(',')).join(',')
}

function cartaHtml(carta) {
  // El escaneo sale en el idioma del mercado de la carta.
  const src = cardImageUrl(carta.image_path, 'low', carta.market)
  const setName = carta.tcg_sets?.name || carta.set_id
  const pie = `${carta.name} · ${setName} #${carta.local_id}`
  const img = src
    ? // Ya no se reintenta en otro idioma: el catálogo es inglés y
      // tiene escaneo de todas las cartas. Si aun así falta, se cambia
      // la imagen por el nombre en texto para no dejar un hueco roto.
      `<img src="${escapeHtml(src)}" alt="${escapeHtml(carta.name)}" loading="lazy"
         onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'deck-card-noimg',textContent:this.alt}))">`
    : `<span class="deck-card-noimg">${escapeHtml(carta.name)}</span>`
  return `<li class="deck-card" title="${escapeHtml(pie)}">
    ${img}
    <span class="deck-card-name">${escapeHtml(carta.name)}</span>
    <span class="deck-card-set">${escapeHtml(setName)} #${escapeHtml(carta.local_id)}</span>
  </li>`
}

export function renderDeckHtml(cartas, idsPedidos = []) {
  if (cartas.length === 0) {
    return `<p class="deck-empty">No se han podido cargar las cartas de esta lista.</p>`
  }
  // Se respeta el orden en que las puso el autor, no el que devuelva la
  // base.
  const porId = Object.fromEntries(cartas.map((c) => [c.id, c]))
  const ordenadas = idsPedidos.length ? idsPedidos.map((id) => porId[id]).filter(Boolean) : cartas
  const faltan = idsPedidos.length - ordenadas.length
  return `
    <ul class="deck-grid">${ordenadas.map(cartaHtml).join('')}</ul>
    ${faltan > 0 ? `<p class="deck-note">${faltan} carta(s) de esta lista ya no están en el catálogo.</p>` : ''}`
}

// Busca los <tcg-deck> dentro de `raiz` y los rellena. Una sola consulta
// para todas las listas de la página, aunque haya varias.
export async function hydrateDecks(raiz) {
  const bloques = [...(raiz?.querySelectorAll?.('tcg-deck') || [])]
  if (bloques.length === 0) return

  const porBloque = bloques.map((el) => parseDeckIds(el.getAttribute('data-cards')))
  const todos = porBloque.flat()
  if (todos.length === 0) {
    bloques.forEach((el) => { el.innerHTML = `<p class="deck-empty">Lista de cartas vacía.</p>` })
    return
  }

  let cartas = []
  try {
    cartas = await cardsByIds(todos)
  } catch {
    bloques.forEach((el) => { el.innerHTML = `<p class="deck-empty">No se han podido cargar las cartas.</p>` })
    return
  }

  const porId = Object.fromEntries(cartas.map((c) => [c.id, c]))
  bloques.forEach((el, i) => {
    const ids = porBloque[i]
    // Dentro del editor la superficie es editable; la lista no debe
    // serlo, o el cursor se mete entre las cartas y las descoloca. En la
    // página de la guía este atributo no molesta.
    el.setAttribute('contenteditable', 'false')
    el.innerHTML = renderDeckHtml(ids.map((id) => porId[id]).filter(Boolean), ids)
  })
}
