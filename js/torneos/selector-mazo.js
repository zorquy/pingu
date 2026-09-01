// El selector de mazo (tanda 233): escribes «dr» y salen los Pokémon
// con su minisprite, como en trainingcourt.app. Lo pidió PINGU tras
// probar el suyo — escribir el nombre a pelo tiene dos problemas:
//
//   · Se escribe mal. «Dragapult» y «dragapul» son dos mazos distintos
//     para una matriz de enfrentamientos, y parten el histórico en dos
//     sin que nadie se dé cuenta.
//   · No enseña nada. Ver el sprite mientras eliges es lo que hace que
//     no te equivoques de Pokémon.
//
// Un mazo son DOS selectores, porque un arquetipo se nombra por una o
// dos cartas: «Gardevoir» o «Dragapult Dusknoir».
//
// Se busca sobre dos cosas:
//   1. Las 1025 especies, con su sprite. Instantáneo y sin ir a la base
//      — la tabla ya está cargada.
//   2. El catálogo de arquetipos, para los que se nombran por un objeto
//      («Martillos»), que no tienen especie ni sprite.
import { POKEMON_POR_DEX, POKEMON_APLASTADOS, urlDeSprite } from './sprites-pokemon.js'

// El escapado va aquí y NO se importa de app.js a propósito: app.js toca
// el DOM al cargarse, y con ese import este módulo no se podría abrir en
// Node para probar el buscador, que es la parte que puede estar mal.
function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

// Las opciones que casan con lo tecleado. Se ordenan poniendo delante lo
// que EMPIEZA por lo buscado: con «dr», «Dragapult» tiene que salir
// antes que «Beedrill», que solo lo contiene.
export function buscarOpciones(texto, catalogo = [], limite = 40) {
  const q = String(texto || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!q) return []

  const opciones = []

  for (const arq of catalogo) {
    const norm = String(arq.nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (norm.includes(q)) {
      opciones.push({
        tipo: 'arquetipo',
        valor: `a:${arq.id}`,
        nombre: arq.nombre,
        // Un arquetipo del catálogo ya dice qué cartas lo representan;
        // el sprite sale de la primera que sea un Pokémon.
        sprite: null,
        empieza: norm.startsWith(q),
      })
    }
  }

  for (let i = 0; i < POKEMON_POR_DEX.length; i++) {
    const plano = POKEMON_APLASTADOS[i]
    if (!plano.includes(q)) continue
    opciones.push({
      tipo: 'pokemon',
      // La clave de agrupación es la misma que usa arquetipos.js para un
      // mazo deducido, así que una partida apuntada a mano cae en la
      // misma casilla que las de los torneos.
      valor: `d:${POKEMON_POR_DEX[i].toLowerCase()}`,
      nombre: POKEMON_POR_DEX[i],
      sprite: urlDeSprite(i + 1),
      empieza: plano.startsWith(q),
    })
  }

  // Los que EMPIEZAN por lo tecleado, delante: con «dr» hay que ver
  // «Dragapult» antes que «Beedrill», que solo lo contiene. Y NO se
  // ordena por longitud —se probó y hundía a «Dragapult» debajo de
  // «Drampa» y «Dreepy», que es justo lo contrario de lo que hace falta.
  opciones.sort(
    (a, b) =>
      Number(b.empieza) - Number(a.empieza) ||
      // Los catalogados delante de los sueltos: si alguien ha puesto
      // nombre a un mazo, ese nombre es mejor que el de una especie.
      (a.tipo === b.tipo ? 0 : a.tipo === 'arquetipo' ? -1 : 1) ||
      a.nombre.localeCompare(b.nombre)
  )
  return opciones.slice(0, limite)
}

// ── El trozo de pantalla ──
//
// No usa <select>: un desplegable nativo no lleva imágenes ni se puede
// filtrar escribiendo. Es un campo de texto con una lista debajo, que es
// lo que hace trainingcourt y lo que la gente espera de un buscador.
//
// `alElegir` recibe { valor, nombre, sprite } o null si se vacía.
export function montarSelectorMazo(contenedor, { catalogo = [], marcador = 'Elige un Pokémon…', alElegir } = {}) {
  let elegido = null
  let abierto = false
  let resaltado = 0
  let opciones = []

  contenedor.classList.add('selector-mazo')
  contenedor.innerHTML = `
    <div class="selector-mazo-campo">
      <img class="selector-mazo-sprite hidden" alt="" />
      <input type="text" class="selector-mazo-texto" placeholder="${escapeHtml(marcador)}" autocomplete="off"
             role="combobox" aria-expanded="false" aria-autocomplete="list" />
      <button type="button" class="selector-mazo-limpiar hidden" aria-label="Quitar">×</button>
    </div>
    <ul class="selector-mazo-lista hidden" role="listbox"></ul>`

  const campo = contenedor.querySelector('.selector-mazo-texto')
  const lista = contenedor.querySelector('.selector-mazo-lista')
  const sprite = contenedor.querySelector('.selector-mazo-sprite')
  const limpiar = contenedor.querySelector('.selector-mazo-limpiar')

  function cerrar() {
    abierto = false
    lista.classList.add('hidden')
    campo.setAttribute('aria-expanded', 'false')
  }

  function pintarLista() {
    lista.innerHTML = opciones
      .map(
        (o, i) => `
      <li class="selector-mazo-opcion ${i === resaltado ? 'resaltada' : ''}" role="option"
          aria-selected="${i === resaltado}" data-i="${i}">
        ${o.sprite ? `<img src="${escapeHtml(o.sprite)}" alt="" loading="lazy" />` : '<span class="selector-mazo-hueco"></span>'}
        <span>${escapeHtml(o.nombre)}</span>
      </li>`
      )
      .join('')
    lista.classList.toggle('hidden', !opciones.length)
    abierto = opciones.length > 0
    campo.setAttribute('aria-expanded', String(abierto))
  }

  function elegir(o) {
    elegido = o
    campo.value = o ? o.nombre : ''
    sprite.classList.toggle('hidden', !o?.sprite)
    if (o?.sprite) sprite.src = o.sprite
    limpiar.classList.toggle('hidden', !o)
    cerrar()
    alElegir?.(o)
  }

  campo.addEventListener('input', () => {
    // Al escribir se deshace la elección: si no, el campo diría una cosa
    // y el valor guardado sería otra.
    if (elegido) {
      elegido = null
      sprite.classList.add('hidden')
      limpiar.classList.add('hidden')
      alElegir?.(null)
    }
    opciones = buscarOpciones(campo.value, catalogo)
    resaltado = 0
    pintarLista()
  })

  campo.addEventListener('keydown', (e) => {
    if (!abierto) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      resaltado = (resaltado + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length
      pintarLista()
      lista.children[resaltado]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (opciones[resaltado]) elegir(opciones[resaltado])
    } else if (e.key === 'Escape') {
      cerrar()
    }
  })

  // `mousedown` y no `click`: el `blur` del campo llega antes que el
  // click y cerraría la lista sin haber elegido nada.
  lista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('[data-i]')
    if (!li) return
    e.preventDefault()
    elegir(opciones[Number(li.dataset.i)])
  })

  campo.addEventListener('blur', () => setTimeout(cerrar, 120))
  limpiar.addEventListener('click', () => {
    elegir(null)
    campo.focus()
  })

  return {
    valor: () => elegido,
    limpiar: () => elegir(null),
  }
}
