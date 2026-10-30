import { supabase } from './supabase.js'
import { hojaInyectada } from './hoja.js'
import { estadoDeAviso, seVeAviso, huellaDeAviso, franjaHtml } from './aviso-puro.js'

// La franja de AVISO GLOBAL del equipo: "el sábado hay torneo",
// "mantenimiento a las 22h". Se escribe desde /admin → Avisos (tabla
// site_settings, clave `aviso_global`) y sale debajo de la navbar en
// toda la web. Cada cual puede cerrarla, y el cierre se recuerda POR
// AVISO: si el equipo publica uno nuevo, vuelve a salir aunque hubieras
// cerrado el anterior. Las reglas (tipo, desde y hasta, a quién, enlace)
// están en js/aviso-puro.js.

const CLAVE_CIERRE = 'pokedoc-aviso-cerrado'

export async function pintarAvisoGlobal() {
  try {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'aviso_global').maybeSingle()
    // Sin la tabla (migración sin ejecutar) o sin aviso: nada que pintar.
    if (error || !data) return
    const aviso = data.value || {}
    if (estadoDeAviso(aviso) !== 'activo') return
    const raiz = document.documentElement
    const movil = raiz.classList.contains('con-barra-movil') || matchMedia('(max-width: 760px)').matches
    const conCuenta = aviso.publico === 'cuenta' ? Boolean((await supabase.auth.getSession()).data?.session) : false
    if (!seVeAviso(aviso, { conCuenta, movil })) return

    const marca = huellaDeAviso(aviso)
    try {
      if (sessionStorage.getItem(CLAVE_CIERRE) === marca) return
    } catch {}

    // Su hoja solo la baja quien lo ve (1120: salió de components.css).
    await hojaInyectada('css/aviso-global.css')
    const caja = document.createElement('div')
    caja.innerHTML = franjaHtml(aviso)
    const franja = caja.firstElementChild
    const navbar = document.querySelector('.navbar, nav')
    if (navbar?.parentNode) navbar.after(franja)
    else document.body.prepend(franja)

    franja.querySelector('.aviso-global-cerrar').addEventListener('click', () => {
      franja.remove()
      try {
        sessionStorage.setItem(CLAVE_CIERRE, marca)
      } catch {}
    })
  } catch {
    // El aviso jamás puede tumbar una página.
  }
}
