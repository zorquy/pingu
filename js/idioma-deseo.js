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
import { IDIOMAS, idiomasParaAnadirEn } from './cardmarket.js'
import { chipDeIdiomaHtml } from './precio-vista.js'
import { idiomasDeSetSinEsperar } from './idiomas-de-set.js'

// Los del catálogo occidental. Del japonés, `idiomasParaAnadirEn` (911): la
// japonesa y —si su set los tiene— la coreana y la china. El coreano lo
// admite la base desde la migración 911, la misma que dice qué idiomas tiene
// un set: sin ella, del japonés solo llega el japonés.
const OCCIDENTALES = ['es', 'en', 'fr', 'de', 'it', 'pt'].map((id) => IDIOMAS.find((i) => i.id === id))

// '' es «cualquiera»: en el catálogo japonés no se ofrece, porque ahí no hay
// otro idioma que pueda casar. `delSet` (911) quita los que el set no tuvo:
// Plasma Blast no salió en español. Sin saberlo, todos los de antes (y del
// japonés, solo el japonés).
export function opcionesDeDeseo(market = 'WEST', delSet = null) {
  const lista = idiomasParaAnadirEn(market, OCCIDENTALES, delSet)
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
export async function preguntarIdioma({ nombre = '', market = 'WEST', setId = null } = {}) {
  const d = crear()
  const opciones = opcionesDeDeseo(market, await idiomasDeSetSinEsperar(setId, market))
  const entrada = idiomaDeEntrada(market)
  d.querySelector('#iddCarta').textContent = nombre
  d.querySelector('#iddChips').innerHTML = opciones.map((i) => chipDeIdiomaHtml(i, i.id === entrada)).join('')
  d.querySelector('#iddNota').textContent = market === 'JP'
    ? (opciones.length > 1 ? 'Del catálogo japonés, en los idiomas en los que salió.' : 'Del catálogo japonés solo existe en japonés.')
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
