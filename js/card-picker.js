import { escapeHtml } from './app.js'
import {
  searchCards, cardImageUrl, refCarta,
  MERCADOS_A_IMPORTAR, MERCADO_POR_DEFECTO, NOMBRE_MERCADO,
} from './tcgdex.js'

// Buscador de cartas del editor. Devuelve una promesa con la lista de
// identificadores elegidos, o null si se cierra sin elegir.
//
// Busca en `tcg_cards` (nuestro espejo), no en TCGdex. Si el catálogo
// está vacío es que nadie lo ha importado todavía desde /admin → Cartas,
// y eso hay que decirlo: si no, parece que la búsqueda está rota.

const MAX = 60
// Cuántas cartas se piden de golpe. Antes eran 24 (el valor por defecto
// de searchCards) y la pantalla decía "24 resultados", así que parecía
// que sólo había 24 cartas con ese nombre. Era el tope.
const POR_PAGINA = 48
let contadorPeticion = 0

function resultadoHtml(carta, elegida) {
  const src = cardImageUrl(carta.image_path, 'low', carta.market)
  const setName = carta.tcg_sets?.name || carta.set_id
  // Lo que se guarda es la REFERENCIA, no el id: `CS1a-1` existe en
  // occidental y en chino tradicional, y son dos cartas distintas.
  return `
    <li>
      <button type="button" class="cp-result${elegida ? ' elegida' : ''}" data-card="${escapeHtml(refCarta(carta.id, carta.market))}">
        ${
          src
            ? // Hay cartas sin escaneo en el catálogo. Antes el hueco se
              // quedaba invisible y parecía un fallo de la web; ahora se
              // cambia por un aviso, que al menos se entiende.
              `<img src="${escapeHtml(src)}" alt="" loading="lazy"
                 onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'cp-noimg',textContent:'sin imagen'}))">`
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
        <div class="cp-buscar">
          <input type="search" id="cpQuery" class="cp-input" placeholder="Nombre de la carta…" autocomplete="off" />
          <label class="cp-mercado">
            <span>Catálogo</span>
            <select id="cpMercado">
              ${MERCADOS_A_IMPORTAR.map(
                (mk) =>
                  `<option value="${mk}"${mk === MERCADO_POR_DEFECTO ? ' selected' : ''}>${escapeHtml(
                    NOMBRE_MERCADO[mk] || mk
                  )}</option>`
              ).join('')}
            </select>
          </label>
        </div>
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

    // Cuántas hay EN TOTAL para lo que se ha buscado, y cuántas se han
    // pintado ya. Antes no se sabía el total: se pedían 24, la pantalla
    // decía "24 resultados" y parecía que sólo había 24 cartas.
    let total = 0
    let pintadas = 0

    function engancharResultados() {
      resultados.querySelectorAll('.cp-result').forEach((btn) => {
        // Al traer más se añaden botones nuevos a los que ya había; sin
        // esta marca, los viejos acabarían con el mismo oyente dos veces.
        if (btn.dataset.enganchado) return
        btn.dataset.enganchado = '1'
        btn.addEventListener('click', () => {
          const id = btn.dataset.card
          const i = elegidas.indexOf(id)
          if (i >= 0) elegidas.splice(i, 1)
          else if (elegidas.length < MAX) elegidas.push(id)
          pintarElegidas()
          marcarResultados()
        })
      })
    }

    function pintarEstado() {
      estado.innerHTML = pintadas
        ? `Se ven ${pintadas} de ${total}.` +
          (pintadas < total ? ` <button type="button" class="link-btn" id="cpMas">Ver más</button>` : '')
        : 'Ninguna carta con ese nombre en este catálogo. Si esperabas encontrarla, prueba otro catálogo o quizá falte importar su set desde el panel de administración.'
      overlay.querySelector('#cpMas')?.addEventListener('click', () => buscar({ mas: true }))
    }

    async function buscar({ mas = false } = {}) {
      const consulta = input.value
      if (consulta.trim().length < 2) {
        resultados.innerHTML = ''
        pintadas = 0
        total = 0
        estado.textContent = 'Escribe al menos 2 letras.'
        return
      }
      // Cada búsqueda lleva número: si vuelve una antigua después de una
      // nueva, se descarta. Sin esto, teclear rápido deja en pantalla el
      // resultado de una consulta que ya no es la que hay en la caja.
      const mia = ++contadorPeticion
      if (!mas) {
        pintadas = 0
        total = 0
      }
      estado.textContent = mas ? 'Trayendo más…' : 'Buscando…'
      let resultado
      try {
        resultado = await searchCards(consulta, {
          limite: POR_PAGINA,
          desde: mas ? pintadas : 0,
          market: $('cpMercado').value || MERCADO_POR_DEFECTO,
        })
      } catch (err) {
        if (mia !== contadorPeticion) return
        estado.textContent = `No se ha podido buscar: ${err.message}`
        return
      }
      if (mia !== contadorPeticion) return

      const cartas = resultado.cartas
      total = resultado.total
      cartas.forEach((c) => { porId[refCarta(c.id, c.market)] = c })
      const html = cartas.map((c) => resultadoHtml(c, elegidas.includes(refCarta(c.id, c.market)))).join('')
      // Al pedir más se AÑADE al final. Si se repintara la lista entera,
      // quien está mirando la carta 40 volvería de golpe al principio.
      if (mas) resultados.insertAdjacentHTML('beforeend', html)
      else resultados.innerHTML = html
      pintadas = mas ? pintadas + cartas.length : cartas.length
      pintarEstado()
      engancharResultados()
    }

    let temporizador = null
    input.addEventListener('input', () => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => buscar(), 250)
    })
    // Cambiar de catálogo vuelve a buscar desde el principio: lo que había
    // pintado era de otro mercado y no se puede mezclar con lo nuevo.
    $('cpMercado').addEventListener('change', () => buscar())

    $('cpClose').addEventListener('click', () => cerrar(null))
    $('cpCancel').addEventListener('click', () => cerrar(null))
    $('cpConfirm').addEventListener('click', () => cerrar([...elegidas]))
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(null) })

    estado.textContent = 'Escribe al menos 2 letras.'
    input.focus()
  })
}
