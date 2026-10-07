// INSTALAR POKEDOC EN LA PANTALLA DE INICIO (732, A1 de la lista). La web
// ya era instalable —manifiesto con `display: standalone`, iconos, y los
// avisos push con su service worker—, pero nadie lo sabía: en el iPhone
// Safari no lo ofrece nunca, hay que ir a Compartir → «Añadir a pantalla de
// inicio». Así que se dice, una vez.
//
// Desde la 753, como en la maqueta A1: en el iPhone una hoja desde abajo
// con los tres pasos; en Android una tarjeta con «Instalar» cuando el
// navegador dice que se puede. Sale en el móvil (entra por
// `barra-movil.js`), en las páginas de lista de cada sección, a partir de
// la segunda visita o la tercera página vista, nunca si ya está instalada,
// y «Ahora no» la calla un mes.
import { icons, icon } from './icons.js'

const VISITAS = 'pokedoc-visitas'
const VISTAS = 'pokedoc-vistas'
const CALLADA = 'pokedoc-instalar-no'
const UN_MES = 30 * 86400000

export function estaInstalada(win = window) {
  return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone)
}

export function esIOS(win = window) {
  const ua = win.navigator?.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (win.navigator?.maxTouchPoints || 0) > 1)
}

// ¿Toca enseñarla? Pura: le llega lo que hay guardado. Desde la 753 vale
// la segunda visita O la tercera página vista: PINGU no la había visto
// nunca, porque solo salía en la portada y a partir de la segunda sesión.
export function tocaOfrecer({ instalada, visitas, vistas = 0, calladaEn, ahora = Date.now() }) {
  if (instalada) return false
  if ((Number(visitas) || 0) < 2 && (Number(vistas) || 0) < 3) return false
  if (calladaEn && ahora - Number(calladaEn) < UN_MES) return false
  return true
}

const leer = (k, almacen) => { try { return almacen.getItem(k) } catch { return null } }
const escribir = (k, v, almacen) => { try { almacen.setItem(k, v) } catch {} }
const MAS = (n) => icon('<rect x="3" y="3" width="18" height="18" rx="4"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>', n)

// `aqui`: si en esta página se puede ofrecer. La decide quien monta (la
// barra de abajo sabe si es una página de la lista de su sección): en una
// ficha o en un hilo estás haciendo otra cosa.
export function montarInstalar({ doc = document, win = window, almacen = win.localStorage, aqui = /^\/(index\.html)?$/.test(win.location.pathname) } = {}) {
  if (estaInstalada(win)) return null
  // Una visita es una pestaña nueva, no cada página: se cuenta una vez por
  // sesión del navegador. Las páginas vistas, todas.
  let visitas = Number(leer(VISITAS, almacen)) || 0
  const vistas = (Number(leer(VISTAS, almacen)) || 0) + 1
  escribir(VISTAS, String(vistas), almacen)
  try {
    if (!win.sessionStorage.getItem(VISITAS)) {
      visitas++
      escribir(VISITAS, String(visitas), almacen)
      win.sessionStorage.setItem(VISITAS, '1')
    }
  } catch {}
  if (!aqui || !tocaOfrecer({ instalada: false, visitas, vistas, calladaEn: leer(CALLADA, almacen) })) return null
  const callar = () => escribir(CALLADA, String(Date.now()), almacen)
  return esIOS(win) ? hojaDeSafari(doc, callar) : avisoDeInstalar(doc, win, callar)
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
      <img src="/assets/icon-192.png" alt="" loading="lazy" width="56" height="56">
      <div><b id="bmInstalarTitulo">Ten PokeDoc como una app</b><span>En tu pantalla de inicio, a pantalla completa y con los avisos en el móvil.</span></div>
    </div>
    <ol class="bm-instalar-pasos">
      <li><span class="bm-instalar-n">1</span>${icons.share(20)}<span>Toca <b>Compartir</b> en la barra de Safari</span></li>
      <li><span class="bm-instalar-n">2</span>${MAS(20)}<span>Baja y elige <b>«Añadir a pantalla de inicio»</b></span></li>
      <li><span class="bm-instalar-n">3</span>${icons.checkCircle(20)}<span>Toca <b>Añadir</b>. Ya está.</span></li>
    </ol>
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

// EN ANDROID (y donde el navegador sabe instalar): una tarjeta encima de la
// barra con «Instalar», que abre el instalador del propio navegador. Sale
// cuando el navegador dice que se puede (`beforeinstallprompt`); si no lo
// dice nunca, no se ofrece un botón que no haría nada.
function avisoDeInstalar(doc, win, callar) {
  let tarjeta = null
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    if (tarjeta) return
    tarjeta = doc.createElement('div')
    tarjeta.className = 'bm-instalar bm-instalar-tarjeta'
    tarjeta.setAttribute('role', 'region')
    tarjeta.setAttribute('aria-label', 'Instalar PokeDoc')
    tarjeta.innerHTML = `
      <img src="/assets/icon-192.png" alt="" loading="lazy" width="44" height="44">
      <div class="bm-instalar-texto"><b>Instala PokeDoc</b><span>Se abre como una app, sin el navegador.</span></div>
      <button type="button" class="btn-primary" data-instalar="si">Instalar</button>
      <button type="button" class="bm-instalar-no" data-instalar="no" aria-label="Ahora no">${icons.xCircle(18)}</button>`
    doc.body.appendChild(tarjeta)
    tarjeta.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-instalar]')
      if (!b) return
      if (b.dataset.instalar === 'no') {
        callar()
        tarjeta.remove()
        return
      }
      e.prompt()
      const { outcome } = await e.userChoice.catch(() => ({}))
      if (outcome !== 'accepted') callar()
      tarjeta.remove()
    })
  }, { once: true })
  return null
}
