import { escapeHtml } from './app.js'
import { searchCards, cardImageUrl, cardImageFallbackUrl } from './tcgdex.js'

// Buscador de cartas del editor. Devuelve una promesa con la lista de
// identificadores elegidos, o null si se cierra sin elegir.
//
// Busca en `tcg_cards` (nuestro espejo), no en TCGdex. Si el catálogo
// está vacío es que nadie lo ha importado todavía desde /admin → Cartas,
// y eso hay que decirlo: si no, parece que la búsqueda está rota.

const MAX = 60
let contadorPeticion = 0

function resultadoHtml(carta, elegida) {
  const src = cardImageUrl(carta.image_path)
  const reserva = cardImageFallbackUrl(carta.image_path)
  const setName = carta.tcg_sets?.name || carta.set_id
  return `
    <li>
      <button type="button" class="cp-result${elegida ? ' elegida' : ''}" data-card="${escapeHtml(carta.id)}">
        ${
          src
            ? `<img src="${escapeHtml(src)}" alt="" loading="lazy"
                 onerror="if(!this.dataset.r){this.dataset.r=1;this.src='${escapeHtml(reserva)}'}else{this.onerror=null;this.style.visibility='hidden'}">`
            : `<span class="cp-noimg">sin imagen</span>`
        }
        <span class="cp-name">${escapeHtml(carta.name)}</span>
        <span class="cp-set">${escapeHtml(setName)} #${escapeHtml(carta.local_id)}</span>
      </button>
    </li>`
}

export function openCardPicker() {
  return new Promise((resolve) => {
    const elegidas = []   // ids, en el orden en que se van eligiendo
    const porId = {}      // id -> carta, para poder pintar la lista de abajo

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal-box modal-box-wide card-picker" role="dialog" aria-modal="true" aria-label="Buscar cartas">
        <button type="button" class="modal-close" id="cpClose" aria-label="Cerrar">×</button>
        <h3>Añadir cartas</h3>
        <p class="cp-help">Busca por nombre y pincha las cartas que quieras. Se añadirán a la guía en el orden en que las elijas.</p>
        <input type="search" id="cpQuery" class="cp-input" placeholder="Nombre de la carta…" autocomplete="off" />
        <p class="cp-status" id="cpStatus"></p>
        <ul class="cp-results" id="cpResults"></ul>
        <div class="cp-chosen" id="cpChosen"></div>
        <div class="modal-actions modal-actions-row">
          <button type="button" class="btn-secondary" id="cpCancel">Cancelar</button>
          <button type="button" class="btn-primary" id="cpConfirm" disabled>Añadir</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    const $ = (id) => overlay.querySelector(`#${id}`)
    const input = $('cpQuery')
    const estado = $('cpStatus')
    const resultados = $('cpResults')

    function cerrar(valor) {
      document.removeEventListener('keydown', alPulsarTecla)
      overlay.remove()
      resolve(valor)
    }
    function alPulsarTecla(e) {
      if (e.key === 'Escape') cerrar(null)
    }
    document.addEventListener('keydown', alPulsarTecla)

    function pintarElegidas() {
      $('cpConfirm').disabled = elegidas.length === 0
      $('cpChosen').innerHTML = elegidas.length
        ? `<p class="cp-chosen-title">${elegidas.length} carta(s) elegida(s)${elegidas.length >= MAX ? ' · máximo alcanzado' : ''}</p>
           <ul class="cp-chosen-list">${elegidas
             .map(
               (id) =>
                 `<li><button type="button" data-quitar="${escapeHtml(id)}" title="Quitar">${escapeHtml(
                   porId[id]?.name || id
                 )} ×</button></li>`
             )
             .join('')}</ul>`
        : ''
      $('cpChosen')
        .querySelectorAll('[data-quitar]')
        .forEach((b) =>
          b.addEventListener('click', () => {
            const i = elegidas.indexOf(b.dataset.quitar)
            if (i >= 0) elegidas.splice(i, 1)
            pintarElegidas()
            marcarResultados()
          })
        )
    }

    function marcarResultados() {
      resultados.querySelectorAll('.cp-result').forEach((b) => {
        b.classList.toggle('elegida', elegidas.includes(b.dataset.card))
      })
    }

    async function buscar() {
      const consulta = input.value
      if (consulta.trim().length < 2) {
        resultados.innerHTML = ''
        estado.textContent = 'Escribe al menos 2 letras.'
        return
      }
      // Cada búsqueda lleva número: si vuelve una antigua después de una
      // nueva, se descarta. Sin esto, teclear rápido deja en pantalla el
      // resultado de una consulta que ya no es la que hay en la caja.
      const mia = ++contadorPeticion
      estado.textContent = 'Buscando…'
      let cartas = []
      try {
        cartas = await searchCards(consulta)
      } catch (err) {
        if (mia !== contadorPeticion) return
        estado.textContent = `No se ha podido buscar: ${err.message}`
        return
      }
      if (mia !== contadorPeticion) return

      cartas.forEach((c) => { porId[c.id] = c })
      resultados.innerHTML = cartas.map((c) => resultadoHtml(c, elegidas.includes(c.id))).join('')
      estado.textContent = cartas.length
        ? `${cartas.length} resultado(s).`
        : 'Ninguna carta con ese nombre. Si esperabas encontrarla, quizá falte importar su set desde el panel de administración.'

      resultados.querySelectorAll('.cp-result').forEach((btn) =>
        btn.addEventListener('click', () => {
          const id = btn.dataset.card
          const i = elegidas.indexOf(id)
          if (i >= 0) elegidas.splice(i, 1)
          else if (elegidas.length < MAX) elegidas.push(id)
          pintarElegidas()
          marcarResultados()
        })
      )
    }

    let temporizador = null
    input.addEventListener('input', () => {
      clearTimeout(temporizador)
      temporizador = setTimeout(buscar, 250)
    })

    $('cpClose').addEventListener('click', () => cerrar(null))
    $('cpCancel').addEventListener('click', () => cerrar(null))
    $('cpConfirm').addEventListener('click', () => cerrar([...elegidas]))
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(null) })

    estado.textContent = 'Escribe al menos 2 letras.'
    input.focus()
  })
}
