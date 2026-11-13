// INSTALAR POKEDOC EN LA PANTALLA DE INICIO (732, A1 de la lista). La web
// ya era instalable —manifiesto con `display: standalone`, iconos, y los
// avisos push con su service worker—, pero nadie lo sabía: en el iPhone
// Safari no lo ofrece nunca, hay que ir a Compartir → «Añadir a pantalla de
// inicio». Así que se dice, una vez.
//
// Desde la 1317 (A3 del plan) ya no sale al llegar, que es cuando tapa: sale
// justo DESPUÉS de algo que ha ido bien (tu carta número 10, acabar un reto,
// apuntarte a un torneo: `avisarExito`, js/exito.js), como mucho una vez a la
// semana, y «Ahora no» la calla un mes. Es una tarjeta encima de la barra:
// en Android «Instalar» abre el instalador del navegador (si el navegador ha
// dicho que se puede: lo guarda app.js en `window.__pdInstalar`); en el
// iPhone abre la hoja con los tres pasos de Safari. Y siempre a mano en
// Ajustes › «Instalar PokeDoc» (`instalarHtml`, `montarInstalarEnAjustes`).
import { icons, icon } from './icons.js'
import { EXITO_PENDIENTE } from './exito.js'

const CALLADA = 'pokedoc-instalar-no'
const UN_MES = 30 * 86400000
const SEMANA = 7 * 86400000
const ULTIMA = 'pokedoc-instalar-ultima'

export function estaInstalada(win = window) {
  return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone)
}

export function esIOS(win = window) {
  const ua = win.navigator?.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (win.navigator?.maxTouchPoints || 0) > 1)
}

// ¿Toca ofrecerla tras un buen momento? Pura: le llega lo guardado.
export function tocaTrasExito({ instalada, calladaEn, ultimaEn, ahora = Date.now() }) {
  if (instalada) return false
  if (calladaEn && ahora - Number(calladaEn) < UN_MES) return false
  if (ultimaEn && ahora - Number(ultimaEn) < SEMANA) return false
  return true
}

// Lo que dice la tarjeta según lo que acaba de salir bien.
export const TITULOS_DE_EXITO = {
  cartas: '¡Ya tienes 10 cartas!',
  reto: '¡Reto hecho!',
  torneo: '¡Ya estás dentro!',
}

const leer = (k, almacen) => { try { return almacen.getItem(k) } catch { return null } }
const escribir = (k, v, almacen) => { try { almacen.setItem(k, v) } catch {} }
const MAS = (n) => icon('<rect x="3" y="3" width="18" height="18" rx="4"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>', n)

// Se monta en el móvil (barra-movil.js) en cualquier página: lo que importa
// es el momento, no la página. Escucha `pd-exito` y mira si llegó uno justo
// antes de cambiar de página.
export function montarInstalar({ doc = document, win = window, almacen = win.localStorage } = {}) {
  if (estaInstalada(win)) return null
  const ofrecer = (motivo) => {
    try { win.sessionStorage.removeItem(EXITO_PENDIENTE) } catch {}
    if (doc.querySelector('.bm-instalar')) return
    if (!tocaTrasExito({ instalada: estaInstalada(win), calladaEn: leer(CALLADA, almacen), ultimaEn: leer(ULTIMA, almacen) })) return
    // Fuera del iPhone, sin el permiso del navegador no hay botón que sirva.
    if (!esIOS(win) && !win.__pdInstalar) return
    escribir(ULTIMA, String(Date.now()), almacen)
    tarjetaDeInstalar(doc, win, motivo, () => escribir(CALLADA, String(Date.now()), almacen))
  }
  win.addEventListener('pd-exito', (e) => ofrecer(e.detail?.motivo))
  let pendiente = null
  try { pendiente = win.sessionStorage.getItem(EXITO_PENDIENTE) } catch {}
  if (pendiente) ofrecer(pendiente)
  return { ofrecer }
}

// Instalar desde un botón (la tarjeta o Ajustes): en Android, el instalador
// del navegador; devuelve si se aceptó, o null si el navegador no lo ofrece.
export async function instalarAhora(win = window) {
  const e = win.__pdInstalar
  if (!e) return null
  win.__pdInstalar = null
  e.prompt()
  const { outcome } = await e.userChoice.catch(() => ({}))
  return outcome === 'accepted'
}

// EN EL IPHONE (753, la maqueta A1): Safari no instala solo, así que una
// hoja desde abajo con los tres pasos a la vista, y una flecha hacia su
// barra, que es donde está «Compartir».
function hojaDeSafari(doc, callar) {
  const velo = doc.createElement('div')
  velo.className = 'bm-instalar-velo'
  const hoja = doc.createElement('div')
  hoja.className = 'bm-instalar bm-instalar-hoja'
  hoja.setAttribute('role', 'dialog')
  hoja.setAttribute('aria-modal', 'true')
  hoja.setAttribute('aria-labelledby', 'bmInstalarTitulo')
  hoja.innerHTML = `
    <span class="bm-instalar-asa" aria-hidden="true"></span>
    <div class="bm-instalar-cabeza">
      <img src="/assets/app-icon-192.png" alt="" loading="lazy" width="56" height="56">
      <div><b id="bmInstalarTitulo">Ten PokeDoc como una app</b><span>En tu pantalla de inicio, a pantalla completa y con los avisos en el móvil.</span></div>
    </div>
    ${pasosDeSafariHtml()}
    <div class="bm-instalar-botones">
      <button type="button" class="btn-secondary" data-instalar="no">Ahora no</button>
      <button type="button" class="btn-primary" data-instalar="vale">Entendido</button>
    </div>
    <p class="bm-instalar-nota">Si dices «Ahora no», no vuelve a salir en un mes.</p>`
  doc.body.append(velo, hoja)
  const cerrar = () => { velo.remove(); hoja.remove() }
  velo.addEventListener('click', () => { callar(); cerrar() })
  hoja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-instalar]')
    if (!b) return
    // «Entendido» también calla un mes: ya sabe cómo, y si no lo hace es
    // que no quiere.
    callar()
    cerrar()
  })
  return hoja
}

// La tarjeta, encima de la barra de abajo.
function tarjetaDeInstalar(doc, win, motivo, callar) {
  const tarjeta = doc.createElement('div')
  tarjeta.className = 'bm-instalar bm-instalar-tarjeta'
  tarjeta.setAttribute('role', 'region')
  tarjeta.setAttribute('aria-label', 'Instalar PokeDoc')
  tarjeta.innerHTML = `
    <img src="/assets/app-icon-192.png" alt="" loading="lazy" width="44" height="44">
    <div class="bm-instalar-texto"><b>${TITULOS_DE_EXITO[motivo] || 'Ten PokeDoc a mano'}</b><span>Instálalo: se abre como una app, sin el navegador.</span></div>
    <button type="button" class="btn-primary" data-instalar="si">Instalar</button>
    <button type="button" class="bm-instalar-no" data-instalar="no" aria-label="Ahora no">${icons.xCircle(18)}</button>`
  doc.body.appendChild(tarjeta)
  tarjeta.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-instalar]')
    if (!b) return
    tarjeta.remove()
    if (b.dataset.instalar === 'no') return callar()
    if (esIOS(win)) return hojaDeSafari(doc, callar)
    if ((await instalarAhora(win)) !== true) callar()
  })
  return tarjeta
}

// Los tres pasos de Safari (la hoja y Ajustes).
export function pasosDeSafariHtml() {
  return `<ol class="bm-instalar-pasos">
      <li><span class="bm-instalar-n">1</span>${icons.share(20)}<span>Toca <b>Compartir</b> en la barra de Safari</span></li>
      <li><span class="bm-instalar-n">2</span>${MAS(20)}<span>Baja y elige <b>«Añadir a pantalla de inicio»</b></span></li>
      <li><span class="bm-instalar-n">3</span>${icons.checkCircle(20)}<span>Toca <b>Añadir</b>. Ya está.</span></li>
    </ol>`
}
