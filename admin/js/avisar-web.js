// ── QUE LA WEB LO ENSEÑE YA (tanda 908; aquí desde la 978) ──
//
// PINGU: «ordeno las eras, meto las expansiones o cambio cosas y luego en
// la web no se ha cambiado». La estantería sale de una copia que guarda la
// CDN (813), y desde la 978 también las cartas de cada set: después de
// guardar se le pide a Netlify que tire las dos (llevan la misma etiqueta).
// Una vez por tanda de cambios: arrastrar diez colecciones son diez
// guardados y un solo vaciado, un segundo después del último.
import { getSession } from '../../js/app.js'
import { showToast } from '../../js/toast.js'

let vaciado = null
export function avisarALaWeb() {
  clearTimeout(vaciado)
  vaciado = setTimeout(async () => {
    try {
      const session = await getSession()
      const res = await fetch('/.netlify/functions/sets-purgar', { method: 'POST', headers: { authorization: `Bearer ${session?.access_token || ''}` } })
      const r = await res.json().catch(() => ({}))
      if (!res.ok || !r.ok) throw new Error(r.error || `Error ${res.status}`)
      showToast('La web ya enseña los cambios.', 'success')
    } catch (e) {
      showToast(`Guardado, pero la web puede tardar hasta diez minutos en enseñarlo (${String(e?.message || e).slice(0, 90)}).`, 'error')
    }
  }, 1000)
}
