// Ajustes › «Instalar PokeDoc» (tanda 1317, A3 del plan): lo que toca en este
// aparato. Aparte de instalar.js porque pinta clases de css/ajustes.css, y
// instalar.js lo baja el móvil en todas las páginas.
import { icons } from './icons.js'
import { estaInstalada, esIOS, pasosDeSafariHtml, instalarAhora } from './instalar.js'

// Ajustes › «Instalar PokeDoc»: lo que toca en este aparato.
export function instalarHtml(win = window) {
  const cabeza = '<h2>Instalar PokeDoc</h2><p>Con PokeDoc instalado se abre desde el icono, a pantalla completa y con los avisos en el móvil.</p>'
  if (estaInstalada(win)) return `${cabeza}<p class="aj-nota">${icons.checkCircle(16)} Ya lo tienes instalado en este aparato.</p>`
  if (esIOS(win)) return `${cabeza}<h3>En el iPhone o el iPad, desde Safari</h3><div class="aj-instalar">${pasosDeSafariHtml()}</div>`
  return `${cabeza}
    <div class="aj-dato" id="ajInstalarBoton"${win.__pdInstalar ? '' : ' hidden'}><span>En este navegador<br><small class="subtext">Se instala en un momento, sin tienda de apps.</small></span><button type="button" class="btn-primary" data-instalar="si">Instalar</button></div>
    <h3>Si no te sale el botón</h3>
    <ul class="aj-instalar-lista">
      <li><b>Android (Chrome):</b> menú ⋮ › «Instalar aplicación» o «Añadir a pantalla de inicio».</li>
      <li><b>Ordenador (Chrome o Edge):</b> el icono de instalar al final de la barra de direcciones.</li>
      <li><b>iPhone:</b> ábrelo en Safari › Compartir › «Añadir a pantalla de inicio».</li>
    </ul>`
}

export function montarInstalarEnAjustes(panel, win = window) {
  const caja = panel.querySelector('#ajInstalarBoton')
  if (!caja) return
  // Si el navegador lo dice después de pintar, el botón aparece.
  win.addEventListener('beforeinstallprompt', () => { caja.hidden = false }, { once: true })
  caja.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-instalar]')) return
    const r = await instalarAhora(win)
    caja.hidden = true
    if (r === true) panel.insertAdjacentHTML('beforeend', `<p class="aj-nota">${icons.checkCircle(16)} Instalado. Ya lo tienes en tu pantalla de inicio.</p>`)
  })
}
