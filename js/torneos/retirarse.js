// Retirarse de un torneo (1436, Tardeo de Testeo del 25-11; Ibai: «dejar más
// claro el botón de dropear del torneo y que funcione correctamente»).
//
// Antes la baja era un segundo toque sobre el mismo botón («¿Seguro?»), en
// Info o en la sala de espera: durante el torneo nadie lo encontraba, y como la
// ficha se repinta sola, el botón podía volver a «Darme de baja» entre los dos
// toques. Ahora es una ventana que dice en tres líneas qué pasa con tu ronda,
// con las siguientes y con tus puntos; y la baja se da por hecha SOLO si la
// base devuelve la fila (un UPDATE que la política rechaza no da error).
import { supabase } from '../supabase.js'
import { icons } from '../icons.js'

const escapar = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Las líneas de la ventana. Puro: lo vigila la prueba de la 1436.
//   empezado: el torneo ya está en juego
//   ronda:    «la ronda 2» si tienes una mesa sin cerrar, si no null
//   rival:    contra quién es esa mesa
export function lineasDeRetirada({ empezado, ronda = null, rival = null }) {
  if (!empezado) {
    return [
      { si: false, texto: 'Dejas tu plaza y no puedes volver a inscribirte.' },
      { si: false, texto: 'No juegas ninguna ronda de este torneo.' },
    ]
  }
  return [
    ronda
      ? { si: true, texto: `${ronda.charAt(0).toUpperCase()}${ronda.slice(1)} la terminas${rival ? `: tu partida contra ${rival} cuenta` : ''}.` }
      : { si: true, texto: 'Las partidas que ya has jugado cuentan.' },
    { si: false, texto: 'No te emparejamos en la siguiente ronda ni en las demás.' },
    { si: false, texto: 'No puedes volver a entrar. Tus puntos se quedan en la tabla.' },
  ]
}

// Pregunta y espera. Resuelve true si dice que sí.
export function preguntarRetirada(datos) {
  return new Promise((resolver) => {
    document.getElementById('torneoRetirada')?.remove()
    const d = document.createElement('dialog')
    d.className = 'torneo-lista-ventana torneo-retirada'
    d.id = 'torneoRetirada'
    d.setAttribute('aria-labelledby', 'torneoRetiradaTitulo')
    const lineas = lineasDeRetirada(datos)
      .map((l) => `<li class="${l.si ? 'si' : 'no'}"><span aria-hidden="true">${l.si ? icons.checkCircle(18) : icons.xCircle(18)}</span>${escapar(l.texto)}</li>`)
      .join('')
    d.innerHTML = `
      <div class="simple-card">
        <h3 id="torneoRetiradaTitulo">¿Te retiras del torneo?</h3>
        <ul class="torneo-retirada-lineas">${lineas}</ul>
        <div class="torneo-retirada-botones">
          <button type="button" class="btn-primary torneo-retirada-si" data-retirada="si">Sí, retirarme</button>
          <button type="button" class="btn-secondary" data-retirada="no">Seguir en el torneo</button>
        </div>
      </div>`
    document.body.appendChild(d)
    let respuesta = false
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-retirada]')
      if (b) {
        respuesta = b.dataset.retirada === 'si'
        d.close()
      } else if (e.target === d) d.close()
    })
    d.addEventListener('close', () => {
      d.remove()
      resolver(respuesta)
    })
    d.showModal()
    d.querySelector('[data-retirada="no"]')?.focus()
  })
}

// La baja de verdad. Devuelve { ok: true } o { ok: false, mensaje }.
export async function retirarme(inscripcionId, rondaActualId) {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({ status: 'dropped', dropped_at: new Date().toISOString(), dropped_after_round_id: rondaActualId || null })
    .eq('id', inscripcionId)
    .eq('status', 'active')
    .select('id')
  if (error) return { ok: false, mensaje: `No se ha podido guardar la baja: ${error.message}` }
  if (!data?.length) return { ok: false, mensaje: 'La baja no se ha guardado: recarga la página y vuelve a probar. Si sigue, llama al juez.' }
  return { ok: true }
}
