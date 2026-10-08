// «¿EN QUÉ IDIOMA LA QUIERES?» (tanda 771). PINGU: «la carta que quieras,
// seleccionar el idioma en el que la quieres». El idioma del deseo existe
// en la base desde la 376 (`user_wants.idioma`, null = cualquiera) y los
// cruces ya lo respetan; lo que faltaba era preguntarlo. Una ventana y no
// un desplegable en cada fila: se pregunta UNA vez, al apuntarla, que es
// cuando se sabe.
//
// La comparten /mi-coleccion (el buscador, el Mercado y el corazón de la
// ficha) y /carta (su corazón), y por eso crea su propio <dialog>: /carta no
// lo lleva en su HTML. Su CSS va en css/cardmarket.css, que cargan las dos.
import { escapeHtml } from './app.js'
import { IDIOMAS } from './cardmarket.js'
import { banderaHtml } from './precio-vista.js'

// Los que admite la base (`user_wants_idioma`): el coreano no está, y del
// catálogo japonés solo existe la japonesa (como al añadir a la colección,
// la 472).
const POR_CATALOGO = { WEST: ['es', 'en', 'fr', 'de', 'it', 'pt'], JP: ['ja'] }

// '' es «cualquiera»: en el catálogo japonés no se ofrece, porque ahí no hay
// otro idioma que pueda casar.
export function opcionesDeDeseo(market = 'WEST') {
  const ids = POR_CATALOGO[market] || POR_CATALOGO.WEST
  const lista = ids.map((id) => IDIOMAS.find((i) => i.id === id)).filter(Boolean)
  return market === 'JP' ? lista : [{ id: '', nombre: 'Cualquiera' }, ...lista]
}

// Lo que se marca de entrada: «cualquiera», que es lo que más cruces da, o
// el japonés donde no hay otro.
export const idiomaDeEntrada = (market = 'WEST') => (market === 'JP' ? 'ja' : '')

let dialogo = null
function crear() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'mc-idd'
  dialogo.id = 'iddDialogo'
  dialogo.setAttribute('aria-labelledby', 'iddTitulo')
  dialogo.innerHTML = `
    <div class="mc-idd-cuerpo">
      <h2 id="iddTitulo">¿En qué idioma la quieres?</h2>
      <p class="mc-idd-carta" id="iddCarta"></p>
      <div class="mc-idioma-chips" id="iddChips" role="radiogroup" aria-label="Idioma"></div>
      <p class="mc-idd-nota" id="iddNota"></p>
      <div class="mc-idd-pie">
        <button type="button" class="btn-secondary" id="iddCancelar">Cancelar</button>
        <button type="button" class="btn-primary" id="iddApuntar">Apuntar</button>
      </div>
    </div>`
  document.body.append(dialogo)
  dialogo.addEventListener('click', (e) => {
    const chip = e.target.closest('.mc-idioma-chip')
    if (chip) marcar(chip.dataset.idioma)
    // Tocar fuera de la caja es cancelar, como en el resto de hojas.
    if (e.target === dialogo) dialogo.close('')
  })
  dialogo.querySelector('#iddCancelar').addEventListener('click', () => dialogo.close(''))
  dialogo.querySelector('#iddApuntar').addEventListener('click', () => dialogo.close('si'))
  return dialogo
}

function marcar(id) {
  for (const x of dialogo.querySelectorAll('.mc-idioma-chip')) {
    const puesto = x.dataset.idioma === id
    x.classList.toggle('activo', puesto)
    x.setAttribute('aria-checked', String(puesto))
  }
}

// Devuelve el idioma ('es', 'ja'…), `null` para «cualquiera» o `undefined`
// si se cancela: son tres respuestas y quien llama tiene que distinguirlas.
export function preguntarIdioma({ nombre = '', market = 'WEST' } = {}) {
  const d = crear()
  const opciones = opcionesDeDeseo(market)
  const entrada = idiomaDeEntrada(market)
  d.querySelector('#iddCarta').textContent = nombre
  d.querySelector('#iddChips').innerHTML = opciones
    .map((i) => `<button type="button" class="mc-idioma-chip${i.id === entrada ? ' activo' : ''}" role="radio" aria-checked="${i.id === entrada}" data-idioma="${escapeHtml(i.id)}">${i.id ? banderaHtml(i.id) : ''}<span>${escapeHtml(i.nombre)}</span></button>`)
    .join('')
  d.querySelector('#iddNota').textContent = market === 'JP'
    ? 'Del catálogo japonés solo existe en japonés.'
    : '«Cualquiera» te cruza con más gente. Puedes apuntarla en dos idiomas: son dos deseos.'
  d.returnValue = ''
  return new Promise((resolver) => {
    d.addEventListener('close', () => {
      if (d.returnValue !== 'si') return resolver(undefined)
      const id = d.querySelector('.mc-idioma-chip.activo')?.dataset.idioma ?? entrada
      resolver(id || null)
    }, { once: true })
    d.showModal()
    d.querySelector('.mc-idioma-chip.activo')?.focus()
  })
}
