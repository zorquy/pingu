import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'

// La franja de AVISO GLOBAL del admin: "el sábado hay torneo",
// "mantenimiento a las 22h". Se escribe desde /admin (tabla
// site_settings, clave `aviso_global`) y sale debajo de la navbar en
// toda la web. Cada cual puede cerrarla, y el cierre se recuerda POR
// TEXTO: si el admin publica un aviso nuevo, vuelve a salir aunque
// hubieras cerrado el anterior.

const CLAVE_CIERRE = 'pokedoc-aviso-cerrado'

// Un resumen barato del texto, solo para saber si es EL MISMO aviso que
// ya cerraste. No es criptografía: es una huella.
function huella(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return String(h)
}

export async function pintarAvisoGlobal() {
  try {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'aviso_global').maybeSingle()
    // Sin la tabla (migración sin ejecutar) o sin aviso: nada que pintar.
    if (error || !data) return
    const aviso = data.value || {}
    const texto = String(aviso.texto || '').trim()
    if (!aviso.activo || !texto) return

    const marca = huella(texto)
    try {
      if (sessionStorage.getItem(CLAVE_CIERRE) === marca) return
    } catch {}

    const franja = document.createElement('div')
    franja.className = `aviso-global ${aviso.tono === 'aviso' ? 'aviso-global-serio' : ''}`
    franja.setAttribute('role', 'status')
    franja.innerHTML = `
      <span class="aviso-global-texto">${escapeHtml(texto)}</span>
      <button type="button" class="aviso-global-cerrar" aria-label="Cerrar el aviso">✕</button>`
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
