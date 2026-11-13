// Ajustes › Calendario (tanda 1321, P7 del plan): tu dirección secreta para
// tener tus torneos, jornadas, eventos con «Voy» y lanzamientos en el
// calendario del móvil, siempre al día. Entra por import() desde ajustes.js.
import { supabase } from './supabase.js'
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { enlacesDeCalendario } from './calendario-puro.js'

const sinMigracion = (e) => /PGRST202|42883|Could not find the function|calendario_/.test(`${e?.code || ''} ${e?.message || ''}`)
const QUE = [
  ['torneos', 'Torneos y jornadas', 'Los torneos en los que estás inscrito y cada jornada de tus ligas.'],
  ['eventos', 'Eventos con «Voy»', 'Card shows y quedadas a los que vas.'],
  ['lanzamientos', 'Lanzamientos', 'El día que sale cada expansión de los catálogos que coleccionas.'],
]

const interruptor = (id, texto, detalle, activo) =>
  `<label class="aj-interruptor"><span>${escapeHtml(texto)}<small>${escapeHtml(detalle)}</small></span><input type="checkbox" role="switch" data-cal="${id}" ${activo ? 'checked' : ''}></label>`

export function calendarioHtml(c, origen = location.origin) {
  const e = enlacesDeCalendario(c.clave, origen)
  return `
    <h2>Calendario</h2>
    <p>Tus cosas de PokeDoc en el calendario de tu móvil, siempre al día: te suscribes una vez y se actualiza solo.</p>
    ${QUE.map(([id, t, d]) => interruptor(id, t, d, c[id])).join('')}
    <div class="aj-cal-botones">
      <a class="btn-primary" href="${escapeHtml(e.google)}" target="_blank" rel="noopener">${icons.calendar(16)} Suscribirme en Google Calendar</a>
      <a class="btn-secondary" href="${escapeHtml(e.webcal)}">${icons.calendar(16)} Suscribirme en el iPhone</a>
    </div>
    <div class="aj-dato"><span>Tu dirección<br><small class="subtext"><code id="ajCalUrl">${escapeHtml(e.https)}</code></small></span><button type="button" class="btn-secondary" id="ajCalCopiar">Copiar</button></div>
    <p class="aj-nota">Es secreta: quien la tenga ve tus torneos y eventos. Si la compartes sin querer, <button type="button" class="link-btn" id="ajCalCambiar">cambia la clave</button> y la de antes deja de valer.</p>`
}

export async function montarCalendario(panel) {
  const { data, error } = await supabase.rpc('calendario_mio')
  if (error) {
    panel.innerHTML = `<h2>Calendario</h2><p class="aj-nota">${sinMigracion(error) ? 'Esto llega muy pronto: falta un último paso del equipo (supabase-migration-1321-calendario.sql).' : `No se ha podido cargar: ${escapeHtml(error.message || '')}`}</p>`
    return
  }
  pintar(panel, data)
}

function pintar(panel, c) {
  panel.innerHTML = calendarioHtml(c)
  panel.querySelectorAll('[data-cal]').forEach((x) => x.addEventListener('change', async () => {
    const valor = (id) => panel.querySelector(`[data-cal="${id}"]`).checked
    const { error } = await supabase.rpc('calendario_poner', { p_torneos: valor('torneos'), p_eventos: valor('eventos'), p_lanzamientos: valor('lanzamientos') })
    if (error) {
      x.checked = !x.checked
      showToast('No se ha podido guardar: ' + (error.message || ''), 'error')
    }
  }))
  panel.querySelector('#ajCalCopiar')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(panel.querySelector('#ajCalUrl').textContent)
      showToast('Dirección copiada.', 'success')
    } catch {
      showToast('No se ha podido copiar. Selecciónala a mano.')
    }
  })
  // Cambiar la clave en dos toques: el primero pide confirmar en el propio botón.
  const cambiar = panel.querySelector('#ajCalCambiar')
  cambiar?.addEventListener('click', async () => {
    if (!cambiar.dataset.seguro) {
      cambiar.dataset.seguro = '1'
      cambiar.textContent = 'toca otra vez para cambiarla'
      return
    }
    const { data, error } = await supabase.rpc('calendario_cambiar_clave')
    if (error) return showToast('No se ha podido cambiar: ' + (error.message || ''), 'error')
    pintar(panel, data)
    showToast('Clave cambiada. Vuelve a suscribirte con la dirección nueva.', 'success')
  })
}
