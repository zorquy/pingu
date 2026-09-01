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
// Se busca sobre tres cosas, y las dos primeras son instantáneas porque
// no van a la base:
//   1. Las 1025 especies, con su minisprite.
//   2. El catálogo de arquetipos curado por los admins.
//   3. Las CARTAS de nuestro espejo, para lo que no es un Pokémon. Un
//      mazo se puede llamar por un objeto —«Martillos»— y hasta la
//      tanda 234 eso no se podía elegir: PINGU lo vio enseguida, porque
//      en trainingcourt escribes «hamm» y sale Crushing Hammer.
//      Estas tardan lo que tarde la consulta y se añaden después.
import { POKEMON_POR_DEX, POKEMON_APLASTADOS, urlDeSprite, dexDeCarta } from './sprites-pokemon.js'
import { searchCards, cardImageUrl } from '../tcgdex.js'

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

// ── Las cartas que NO son Pokémon ──
//
// Van aparte de buscarOpciones() porque esto SÍ va a la base y aquello
// no: la lista tiene que aparecer al primer golpe de tecla, y las cartas
// se cuelan detrás cuando llegan.
//
// Se quitan las que son un Pokémon: esas ya salen arriba con su sprite,
// que se reconoce mejor que una miniatura de carta, y si no saldrían
// repetidas una vez por cada set en el que se han impreso.
export async function buscarCartas(texto, limite = 10) {
  const q = String(texto || '').trim()
  if (q.length < 3) return [] // con menos de tres letras devuelve media base
  let cartas = []
  try {
    ;({ cartas } = await searchCards(q, { limite: 40 }))
  } catch {
    return []
  }

  const vistos = new Set()
  const salida = []
  for (const c of cartas) {
    if (dexDeCarta(c.name)) continue
    const clave = String(c.name).toLowerCase()
    // La misma carta está impresa en varios sets: una vez basta.
    if (vistos.has(clave)) continue
    vistos.add(clave)
    salida.push({
      tipo: 'carta',
      valor: `d:${clave}`,
      nombre: c.name,
      sprite: cardImageUrl(c.image_path, 'low'),
      esCarta: true,
    })
    if (salida.length >= limite) break
  }
  return salida
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
        ${
          o.sprite
            ? `<img class="${o.esCarta ? 'es-carta' : ''}" src="${escapeHtml(o.sprite)}" alt="" loading="lazy" />`
            : '<span class="selector-mazo-hueco"></span>'
        }
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
    sprite.classList.toggle('es-carta', Boolean(o?.esCarta))
    if (o?.sprite) sprite.src = o.sprite
    limpiar.classList.toggle('hidden', !o)
    cerrar()
    alElegir?.(o)
  }

  // Cada búsqueda lleva su número. Las cartas tardan lo que tarde la
  // base, y sin esto la respuesta de una búsqueda vieja podría llegar
  // DESPUÉS de otra más nueva y pisarla: escribes «martillo», llega lo
  // de «mar» y se queda ahí.
  let busqueda = 0

  campo.addEventListener('input', () => {
    // Al escribir se deshace la elección: si no, el campo diría una cosa
    // y el valor guardado sería otra.
    if (elegido) {
      elegido = null
      sprite.classList.add('hidden')
      limpiar.classList.add('hidden')
      alElegir?.(null)
    }
    const mia = ++busqueda
    const texto = campo.value
    opciones = buscarOpciones(texto, catalogo)
    resaltado = 0
    pintarLista()

    // Y detrás, lo que no es un Pokémon. Va después a propósito: la
    // lista tiene que responder a la primera tecla, y esto va a la base.
    buscarCartas(texto).then((cartas) => {
      if (mia !== busqueda || !cartas.length) return
      // Las que ya estén (un arquetipo catalogado con ese nombre) no se
      // repiten.
      const yaEstan = new Set(opciones.map((o) => o.nombre.toLowerCase()))
      const nuevas = cartas.filter((c) => !yaEstan.has(c.nombre.toLowerCase()))
      if (!nuevas.length) return
      opciones = [...opciones, ...nuevas]
      pintarLista()
    })
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
