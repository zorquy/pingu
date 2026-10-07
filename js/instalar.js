// INSTALAR POKEDOC EN LA PANTALLA DE INICIO (732, A1 de la lista). La web
// ya era instalable —manifiesto con `display: standalone`, iconos, y los
// avisos push con su service worker—, pero nadie lo sabía: en el iPhone
// Safari no lo ofrece nunca, hay que ir a Compartir → «Añadir a pantalla de
// inicio». Así que se dice, una vez, con los dos pasos.
//
// Sale en el móvil (entra por `barra-movil.js`) y en la portada, a partir
// de la SEGUNDA visita —a la primera nadie sabe aún si quiere la web—,
// nunca si ya está instalada, y «Ahora no» la calla un mes. En Chrome y Android, donde el
// navegador sí sabe instalar, el botón lo hace de verdad.
import { icons } from './icons.js'

const VISITAS = 'pokedoc-visitas'
const CALLADA = 'pokedoc-instalar-no'
const UN_MES = 30 * 86400000

export function estaInstalada(win = window) {
  return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone)
}

export function esIOS(win = window) {
  const ua = win.navigator?.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (win.navigator?.maxTouchPoints || 0) > 1)
}

// ¿Toca enseñarla? Pura: le llega lo que hay guardado.
export function tocaOfrecer({ instalada, visitas, calladaEn, ahora = Date.now() }) {
  if (instalada) return false
  if ((Number(visitas) || 0) < 2) return false
  if (calladaEn && ahora - Number(calladaEn) < UN_MES) return false
  return true
}

const leer = (k, almacen) => { try { return almacen.getItem(k) } catch { return null } }
const escribir = (k, v, almacen) => { try { almacen.setItem(k, v) } catch {} }

export function montarInstalar({ doc = document, win = window, almacen = win.localStorage } = {}) {
  if (estaInstalada(win)) return null
  // Una visita es una pestaña nueva, no cada página: se cuenta una vez por
  // sesión del navegador.
  let visitas = Number(leer(VISITAS, almacen)) || 0
  try {
    if (!win.sessionStorage.getItem(VISITAS)) {
      visitas++
      escribir(VISITAS, String(visitas), almacen)
      win.sessionStorage.setItem(VISITAS, '1')
    }
  } catch {}
  let aviso = null
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    aviso = e
  })
  if (!tocaOfrecer({ instalada: false, visitas, calladaEn: leer(CALLADA, almacen) })) return null
  // Solo en la portada: en una ficha o en un hilo estás haciendo otra cosa,
  // y una banda encima de lo que lees no se agradece.
  if (!/^\/(index\.html)?$/.test(win.location.pathname)) return null

  const hoja = doc.createElement('div')
  hoja.className = 'bm-instalar'
  hoja.setAttribute('role', 'region')
  hoja.setAttribute('aria-label', 'Instalar PokeDoc')
  hoja.innerHTML = `
    <img src="/assets/icon-192.png" alt="" width="40" height="40">
    <div class="bm-instalar-texto">
      <b>Instala PokeDoc en tu móvil</b>
      <span>Se abre a pantalla completa, como una app, y te llegan los avisos.</span>
      <ol class="bm-instalar-pasos hidden">
        <li>Toca <b>Compartir</b> ${icons.share(16)} abajo en Safari.</li>
        <li>Elige <b>«Añadir a pantalla de inicio»</b>.</li>
      </ol>
    </div>
    <div class="bm-instalar-botones">
      <button type="button" class="btn-primary" data-instalar="si">${esIOS(win) ? 'Cómo' : 'Instalar'}</button>
      <button type="button" class="bm-instalar-no" data-instalar="no">Ahora no</button>
    </div>`
  doc.body.appendChild(hoja)
  hoja.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-instalar]')
    if (!b) return
    if (b.dataset.instalar === 'no') {
      escribir(CALLADA, String(Date.now()), almacen)
      hoja.remove()
      return
    }
    if (aviso) {
      aviso.prompt()
      const { outcome } = await aviso.userChoice.catch(() => ({}))
      aviso = null
      if (outcome === 'accepted') hoja.remove()
      return
    }
    // Sin instalador del navegador (Safari): los dos pasos.
    hoja.querySelector('.bm-instalar-pasos').classList.remove('hidden')
    b.remove()
  })
  return hoja
}
