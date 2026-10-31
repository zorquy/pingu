// El botón «Cambio hecho» de una conversación (tanda 795, NU4). Pasos:
// marcar → esperar a la otra persona → «¿Qué tal fue?» (todo bien / hubo un
// problema, con una nota que solo lee la moderación) → hecho. Sin la
// migración no sale nada: la conversación sigue como siempre.
import { escapeHtml } from './html.js'
import { cambiosCon, estadoDelCambio, marcarCambio, valorarCambio } from './cambios-hechos.js'

export async function pintarBotonDeCambio(caja, yo, otro, nombre) {
  if (!caja) return
  const filas = await cambiosCon(yo, otro)
  if (filas === null) { caja.innerHTML = ''; return }
  const e = estadoDelCambio(filas, yo)
  const quien = escapeHtml(nombre || 'la otra persona')
  // EN LA BARRA DEL TRATO (1146, W3): de entrada, un botón corto al lado de
  // «Proponer un cambio»; la explicación sale al tocarlo, no antes.
  const pregunta = `<span class="msg-cambio-explica">¿Os habéis cambiado cartas? Márcalo y, cuando ${quien} lo marque también, quedará en vuestros perfiles.</span><button type="button" class="btn-primary" data-cambio="marcar">Marcar el cambio</button><button type="button" class="btn-secondary" data-cambio="cancelar">Ahora no</button>`
  const html = {
    marcar: `<button type="button" class="btn-secondary" data-cambio="preguntar">Ya nos cambiamos</button>`,
    confirmar: `<button type="button" class="btn-primary" data-cambio="marcar">Confirmar el cambio</button><span class="subtext">${quien} dice que os habéis cambiado cartas.</span>`,
    esperando: `<span class="subtext">Has marcado el cambio. Falta que ${quien} lo confirme.</span>`,
    valorar: `<span class="msg-cambio-pregunta">¿Qué tal fue el cambio?</span><button type="button" class="btn-secondary" data-cambio="bien">Todo bien</button><button type="button" class="btn-secondary" data-cambio="problema">Hubo un problema</button>`,
    hecho: `<span class="subtext">Cambio hecho${e.valoracion === 'bien' ? ' · dijiste que fue bien' : ' · lo verá la moderación'}. <button type="button" class="link-btn" data-cambio="preguntar">Marcar otro</button></span>`,
  }[e.paso]
  caja.innerHTML = html
  // Lo que necesita la fila entera (una pregunta, un texto) la ocupa; lo
  // demás va al lado de «Proponer un cambio».
  const abierta = (h) => caja.classList.toggle('msg-cambio-abierto', h !== html || !['marcar', 'esperando', 'hecho'].includes(e.paso))
  abierta(html)
  // EL PASO SIGUIENTE SE PINTA YA (899, R6): marcar deja «esperando»,
  // confirmar deja «valorar», valorar deja «hecho». La base confirma por
  // detrás y repinta lo de verdad; si dice que no, vuelve lo de antes con
  // el error debajo.
  const siguiente = {
    marcar: { marcar: html.esperando },
    confirmar: { marcar: `<span class="msg-cambio-pregunta">¿Qué tal fue el cambio?</span>` },
    valorar: { bien: `<span class="subtext">Cambio hecho · dijiste que fue bien.</span>`, problema: `<span class="subtext">Cambio hecho · lo verá la moderación.</span>` },
  }
  caja.onclick = async (ev) => {
    const b = ev.target.closest('[data-cambio]')
    if (!b) return
    const accion = b.dataset.cambio
    if (accion === 'preguntar' || accion === 'cancelar') {
      const h = accion === 'preguntar' ? pregunta : html
      caja.innerHTML = h
      abierta(h)
      caja.querySelector('[data-cambio="marcar"], [data-cambio="preguntar"]')?.focus()
      return
    }
    const nota = accion === 'problema' ? window.prompt('Cuéntale a la moderación qué pasó (no lo verá nadie más):', '') : null
    if (accion === 'problema' && nota === null) return
    const antes = caja.innerHTML
    const provisional = siguiente[e.paso]?.[accion]
    if (provisional) { caja.innerHTML = provisional; abierta(provisional) }
    else b.disabled = true
    try {
      if (accion === 'marcar') await marcarCambio(otro)
      else await valorarCambio(e.fila.id, accion, nota)
      await pintarBotonDeCambio(caja, yo, otro, nombre)
    } catch (err) {
      caja.innerHTML = antes
      caja.insertAdjacentHTML('beforeend', `<span class="msg-cambio-error" role="alert">${escapeHtml(err.message)}</span>`)
    }
  }
}
