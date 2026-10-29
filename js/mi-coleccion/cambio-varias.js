// «PARA CAMBIO» CON VARIAS (tanda 1097, PINGU: «puedes seleccionar cartas en
// cualquier sitio y añadirlas en bulk, pero lo que no puedes es darlas para
// cambio»). Seleccionar → «Para cambio» abre esta hoja:
//   · las que YA tienes: cuántas das de cada una (una, todas menos una o
//     todas). Nunca baja lo que ya dabas;
//   · las que NO tienes: se añaden (como «Añadir», con idioma y estado) y
//     quedan para cambio, que es lo que pasa cuando te llega un sobre y lo
//     repetido va directo a la carpeta de cambios.
// Lo puro (`cambioDeLineas`) va aparte de la hoja para poder probarlo.
import { IDIOMAS, ESTADOS } from '../cardmarket.js'
import { chipDeIdiomaHtml } from '../precio-vista.js'
import { escapeHtml } from '../html.js'

export const CUANTAS = [
  { id: 'una', nombre: 'Una de cada' },
  { id: 'menos-una', nombre: 'Todas menos una' },
  { id: 'todas', nombre: 'Todas' },
]

// Lo que pasa a dar cada línea de UNA carta (y versión): `lineas` son tus
// líneas de esa carta y versión. Devuelve [{ id, cambio }] solo de las que
// cambian. «Una»: la línea con más copias da una (si ya da alguna, nada).
// «Todas menos una»: te quedas una (de la línea con más copias) y das el
// resto. «Todas»: das todo. Nunca se baja lo que ya dabas.
export function cambioDeLineas(lineas, cuantas) {
  const ls = (lineas || []).filter((l) => (Number(l.cantidad) || 0) > 0)
  if (!ls.length) return []
  const mayor = [...ls].sort((a, b) => (Number(b.cantidad) || 0) - (Number(a.cantidad) || 0))[0]
  const ya = (l) => Number(l.cambio) || 0
  const quiere = new Map()
  if (cuantas === 'una') {
    if (!ls.some((l) => ya(l) > 0)) quiere.set(mayor.id, 1)
  } else {
    for (const l of ls) {
      const n = Number(l.cantidad) || 0
      quiere.set(l.id, cuantas === 'menos-una' && l.id === mayor.id ? n - 1 : n)
    }
  }
  return ls
    .filter((l) => quiere.has(l.id) && quiere.get(l.id) > ya(l))
    .map((l) => ({ id: l.id, cambio: Math.min(Number(l.cantidad) || 0, quiere.get(l.id)) }))
}

let dialogo = null
function crear() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'mc-idd mc-cvar'
  dialogo.id = 'mcCambioVarias'
  dialogo.setAttribute('aria-labelledby', 'cvarTitulo')
  dialogo.innerHTML = `
    <div class="mc-idd-cuerpo">
      <h2 id="cvarTitulo">Para cambio</h2>
      <p class="mc-idd-carta" id="cvarCuenta"></p>
      <div class="mc-idd-bloque" id="cvarTuyas">
        <p class="mc-idd-rot" id="cvarTuyasRot"></p>
        <div class="mc-idioma-chips" id="cvarCuantas" role="radiogroup" aria-label="Cuántas das de cada una"></div>
      </div>
      <div class="mc-idd-bloque" id="cvarNuevas">
        <p class="mc-idd-rot" id="cvarNuevasRot"></p>
        <div class="mc-idioma-chips" id="cvarIdiomas" role="radiogroup" aria-label="Idioma"></div>
        <div class="mc-idioma-chips mc-cvar-estados" id="cvarEstados" role="radiogroup" aria-label="Estado"></div>
      </div>
      <p class="mc-idd-nota" id="cvarNota"></p>
      <div class="mc-idd-pie">
        <button type="button" class="btn-secondary" data-cvar="no">Cancelar</button>
        <button type="button" class="btn-primary" data-cvar="si">Poner para cambio</button>
      </div>
    </div>`
  document.body.append(dialogo)
  dialogo.addEventListener('click', (e) => {
    const chip = e.target.closest('[role="radio"]')
    if (chip && !chip.disabled) {
      for (const x of chip.parentElement.querySelectorAll('[role="radio"]')) {
        x.classList.toggle('activo', x === chip)
        x.setAttribute('aria-checked', String(x === chip))
      }
      return
    }
    const b = e.target.closest('[data-cvar]')
    if (b) return dialogo.close(b.dataset.cvar)
    // Tocar fuera de la caja es cancelar, como en el resto de hojas.
    if (e.target === dialogo) dialogo.close('no')
  })
  return dialogo
}

const chipHtml = (id, texto, activo, dato) => `<button type="button" class="mc-idioma-chip${activo ? ' activo' : ''}" role="radio" aria-checked="${activo}" data-${dato}="${escapeHtml(id)}"><span>${escapeHtml(texto)}</span></button>`
const marcado = (sel, dato) => dialogo.querySelector(`${sel} [aria-checked="true"]`)?.dataset[dato]

// `tuyas`: cuántas de las marcadas tienes; `nuevas`: cuántas no. `idiomas`:
// los ids que se ofrecen al añadir en este catálogo, con `idioma` y `estado`
// de entrada (los de «Añadir»). Devuelve { cuantas, idioma, estado } o
// `undefined` si se cancela.
export function preguntarCambio({ tuyas = 0, nuevas = 0, idiomas = [], idioma = 'es', estado = 'NM' } = {}) {
  const d = crear()
  const total = tuyas + nuevas
  d.querySelector('#cvarCuenta').textContent = `${total} ${total === 1 ? 'carta' : 'cartas'}`
  d.querySelector('#cvarTuyas').hidden = !tuyas
  d.querySelector('#cvarTuyasRot').textContent = tuyas === total ? (total === 1 ? 'De la que tienes, das' : 'De cada una, das') : tuyas === 1 ? 'De la que tienes, das' : `De las ${tuyas} que tienes, das`
  d.querySelector('#cvarCuantas').innerHTML = CUANTAS.map((c, i) => chipHtml(c.id, c.nombre, i === 0, 'cuantas')).join('')
  d.querySelector('#cvarNuevas').hidden = !nuevas
  d.querySelector('#cvarNuevasRot').textContent = nuevas === total
    ? (total === 1 ? 'No la tienes: se añade así' : 'No las tienes: se añaden así')
    : `${nuevas === 1 ? 'La que no tienes se añade' : `Las ${nuevas} que no tienes se añaden`} así`
  const lista = idiomas.map((id) => IDIOMAS.find((i) => i.id === id)).filter(Boolean)
  const entrada = lista.some((i) => i.id === idioma) ? idioma : lista[0]?.id
  d.querySelector('#cvarIdiomas').innerHTML = lista.map((i) => chipDeIdiomaHtml(i, i.id === entrada)).join('')
  d.querySelector('#cvarEstados').innerHTML = ESTADOS.map((e) => chipHtml(e.id, e.id, e.id === estado, 'estado')).join('')
  for (const b of d.querySelectorAll('#cvarEstados [data-estado]')) b.title = ESTADOS.find((e) => e.id === b.dataset.estado)?.nombre || ''
  d.querySelector('#cvarNota').textContent = nuevas
    ? 'Se añaden a tu colección con una para cambio. Lo que ya dabas no baja.'
    : 'Salen en tu perfil y en los cruces. Lo que ya dabas no baja.'
  d.returnValue = ''
  return new Promise((resolver) => {
    d.addEventListener('close', () => {
      if (d.returnValue !== 'si') return resolver(undefined)
      resolver({ cuantas: marcado('#cvarCuantas', 'cuantas') || 'una', idioma: marcado('#cvarIdiomas', 'idioma') || entrada, estado: marcado('#cvarEstados', 'estado') || estado })
    }, { once: true })
    d.showModal()
    d.querySelector('[data-cvar="si"]')?.focus()
  })
}
