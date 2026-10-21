// «¿CUÁL TIENES?» ANTES DE AÑADIR (tanda 922). PINGU, con Dex delante: al
// darle a añadir, Dex enseña primero las versiones que existen para que
// marques la tuya. Aquí igual: si la carta tiene más de una, la hoja de
// añadir abre con la lista (su precio, cuántas tienes) y el resto del
// formulario espera; al tocar una, la versión queda arriba en una fila con
// «Cambiar». Con una sola, va directa y lo dice («la única que existe»).
//
// La MISMA para la hoja de Mi colección y la de /carta: las dos tienen su
// `<select>` de versión, que sigue siendo quien guarda el valor (lo lee el
// guardar de cada una); este módulo solo decide qué se ve encima.
import { escapeHtml } from '../html.js'
import { euros } from '../cardmarket.js'
import { iconoDeVersion } from './iconos-version.js'

// `form`: el formulario de la hoja; `select`: su desplegable de versión;
// `lista` y `fija`: los dos huecos de la hoja para la lista y la fila.
export function montarEleccion({ form, select, lista, fija }) {
  let estado = null
  const pintarFija = () => {
    const v = estado.versiones.find((x) => x.id === select.value) || estado.versiones[0]
    const sola = estado.versiones.length < 2
    fija.innerHTML = `<span class="vp-fija-icono">${iconoDeVersion(v?.id, 20)}</span><span class="vp-fija-texto"><small>Versión</small><b>${escapeHtml(v?.nombre || '')}</b></span>${
      sola && estado.seSabe ? '<span class="vp-fija-nota">la única que existe</span>' : '<button type="button" class="vp-cambiar" data-vp-cambiar>Cambiar</button>'
    }`
  }
  const elegir = (id) => {
    if (select.value !== id) {
      select.value = id
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    form.classList.remove('vp-eligiendo')
    lista.hidden = true
    fija.hidden = false
    pintarFija()
    // El foco va a lo siguiente que se toca, no se queda en un botón que ya
    // no se ve.
    form.querySelector('.mc-idioma-chip.activo, .mc-idioma-chip')?.focus?.()
  }
  const abrirLista = () => {
    const { versiones, seSabe, tienes, precio } = estado
    lista.innerHTML = `<p class="vp-titulo" id="${escapeHtml(lista.id)}Titulo">¿Cuál tienes?</p>${
      seSabe ? '' : '<p class="vp-aviso">No sabemos qué versiones tiene esta carta: elige la tuya.</p>'
    }<div class="vp-opciones" role="radiogroup" aria-labelledby="${escapeHtml(lista.id)}Titulo">${versiones
      .map((v) => {
        const n = tienes?.(v.id) || 0
        const p = precio?.(v.id)
        return `<button type="button" class="vp-opcion" role="radio" aria-checked="${n > 0}" data-vp-version="${escapeHtml(v.id)}">
          <span class="vp-opcion-icono">${iconoDeVersion(v.id, 20)}</span>
          <span class="vp-opcion-texto"><b>${escapeHtml(v.nombre)}</b><small>${n ? `Tienes ${n}` : 'No la tienes'}</small></span>
          <span class="vp-opcion-precio">${p != null ? euros(p) : ''}</span>
          <span class="vp-check${n ? ' si' : ''}" aria-hidden="true">${n ? '✓' : ''}</span>
        </button>`
      })
      .join('')}</div>`
    form.classList.add('vp-eligiendo')
    lista.hidden = false
    fija.hidden = true
    lista.querySelector('.vp-opcion')?.focus?.()
  }
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vp-version]')
    if (b) elegir(b.dataset.vpVersion)
  })
  fija.addEventListener('click', (e) => {
    if (e.target.closest('[data-vp-cambiar]')) abrirLista()
  })
  return {
    // `puesta`: la versión que ya se sabe (la casilla de «Variantes», la
    // ficha abierta en una versión): entonces no se pregunta.
    abrir({ versiones, puesta = null, seSabe = true, tienes = null, precio = null }) {
      estado = { versiones, seSabe, tienes, precio }
      if (puesta && versiones.some((v) => v.id === puesta)) return elegir(puesta)
      if (versiones.length < 2) return elegir(versiones[0]?.id || 'normal')
      abrirLista()
    },
    // Las versiones de TCGGO llegan después (862): si se está eligiendo, la
    // lista se repinta con ellas; si ya se eligió, solo la fila.
    actualizar(versiones) {
      if (!estado) return
      estado.versiones = versiones
      // Si se queda en una (el idioma de la 956 quita las demás), no hay
      // nada que preguntar: se elige sola, como al abrir.
      if (!lista.hidden && versiones.length < 2) elegir(versiones[0]?.id || 'normal')
      else if (!lista.hidden) abrirLista()
      else pintarFija()
    },
  }
}
