// ¿Gradeada? Y la etiqueta de la cápsula (tanda 1234).
//
// PINGU: las tiendas venden cartas gradeadas y no había forma de meterlas
// («añadir una carta gradeada no se puede»): el formulario del stock tenía un
// campo de texto libre y el «añadir» de la Colección, nada. Por ahora tres
// casas —PSA, Beckett (BGS) y CGC— y la nota en desplegable, con la escala de
// cada una (`mi-coleccion/gradeo.js`, la 563: la misma que la ficha de una
// copia, para no tener dos listas de notas).
//
// Lo que se guarda sigue siendo el texto de siempre en `gradeo` («PSA 10»),
// así que no hace falta migración y lo que ya había escrito se sigue leyendo.
// Una casa que no es de las tres (SGC, ACE, algo escrito a mano) no se tira:
// sale como una opción más con su texto, para que editar no la borre (la 472).
//
// La etiqueta va con los colores que pidió PINGU: PSA roja con letras
// blancas, Beckett negra con letras blancas, CGC blanca con letras negras.
// Viven en `components.css` (`.chapa-gradeo`, `.ge`), que baja todo el mundo,
// porque la pintan el stock, el escaparate y la Colección.
import { escapeHtml } from './html.js'
import { leerGradeo, escribirGradeo, notasDeCasa, OTRA } from './mi-coleccion/gradeo.js'

export const CASAS_A_ELEGIR = [
  { id: 'PSA', nombre: 'PSA' },
  { id: 'BGS', nombre: 'Beckett' },
  { id: 'CGC', nombre: 'CGC' },
]
// La nota con la que se abre una casa recién tocada: lo que más se vende.
const NOTA_DE_SALIDA = '10'

// La etiqueta: la casa en negrita y la nota, con su color. Sin casa conocida,
// la chapa neutra con el texto tal cual.
export function chapaDeGradeoHtml(gradeo, { clase = '' } = {}) {
  const t = String(gradeo || '').trim()
  if (!t) return ''
  const { casa, nota, libre } = leerGradeo(t)
  const extra = clase ? ` ${clase}` : ''
  if (casa && casa !== OTRA) return `<span class="chapa-gradeo${extra}" data-casa="${escapeHtml(casa)}" title="Gradeada: ${escapeHtml(t)}"><b>${escapeHtml(casa)}</b> ${escapeHtml(nota)}</span>`
  return `<span class="chapa-gradeo${extra}" title="Gradeada: ${escapeHtml(t)}">${escapeHtml(libre || t)}</span>`
}

// El selector: «No» y las tres casas de un toque y, con una casa, su nota.
// `nombre` es el del campo oculto que lleva el valor (para un FormData).
export function gradeoHtml(valor, { nombre = 'gradeo', id = '' } = {}) {
  const puesto = leerGradeo(valor)
  const casa = puesto.casa || ''
  const ajena = casa && !CASAS_A_ELEGIR.some((c) => c.id === casa)
  const textoAjeno = ajena ? (casa === OTRA ? puesto.libre : `${casa} ${puesto.nota}`) : ''
  const boton = (idCasa, texto) => `<button type="button" class="ge-casa" data-ge-casa="${escapeHtml(idCasa)}"${idCasa && idCasa !== 'ajena' ? ` data-casa="${escapeHtml(idCasa)}"` : ''} aria-pressed="${(idCasa === casa && !ajena) || (idCasa === 'ajena' && ajena) || (!idCasa && !casa) ? 'true' : 'false'}">${escapeHtml(texto)}</button>`
  return `<fieldset class="ge"${id ? ` id="${escapeHtml(id)}"` : ''} data-ge>
    <legend class="ge-rotulo">Gradeada</legend>
    <div class="ge-casas" role="group" aria-label="¿Gradeada? Elige la casa">
      ${boton('', 'No')}${CASAS_A_ELEGIR.map((c) => boton(c.id, c.nombre)).join('')}${ajena ? boton('ajena', textoAjeno) : ''}
    </div>
    <label class="ge-nota"${casa && !ajena ? '' : ' hidden'}><span>Nota</span><select data-ge-nota aria-label="Nota de la cápsula">${casa && !ajena ? notasDeCasa(casa).map((n) => `<option value="${escapeHtml(n)}"${n === puesto.nota ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('') : ''}</select></label>
    <input type="hidden" name="${escapeHtml(nombre)}" value="${escapeHtml(String(valor || '').trim())}" data-ge-valor />
  </fieldset>`
}

// Lo que hace que funcione. `alCambiar(valor)` se llama con el texto que se
// guardaría («PSA 10») o null. Devuelve quién lo lee.
export function engancharGradeo(raiz, alCambiar = () => {}) {
  const caja = raiz?.matches?.('[data-ge]') ? raiz : raiz?.querySelector('[data-ge]')
  if (!caja) return { valor: () => null }
  const oculto = caja.querySelector('[data-ge-valor]')
  const ajeno = oculto.value
  const nota = caja.querySelector('[data-ge-nota]')
  const filaNota = caja.querySelector('.ge-nota')
  const leer = () => {
    const casa = caja.querySelector('.ge-casa[aria-pressed="true"]')?.dataset.geCasa || ''
    if (casa === 'ajena') return ajeno || null
    return escribirGradeo(casa, casa ? nota.value : '')
  }
  const poner = () => {
    oculto.value = leer() || ''
    alCambiar(leer())
  }
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('.ge-casa')
    if (!b) return
    caja.querySelectorAll('.ge-casa').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'))
    const casa = b.dataset.geCasa
    const conNota = casa && casa !== 'ajena'
    if (conNota) {
      const antes = nota.value
      const notas = notasDeCasa(casa)
      nota.innerHTML = notas.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')
      nota.value = notas.includes(antes) ? antes : notas.includes(NOTA_DE_SALIDA) ? NOTA_DE_SALIDA : notas[0]
    }
    filaNota.hidden = !conNota
    poner()
  })
  nota.addEventListener('change', poner)
  return { valor: leer }
}
