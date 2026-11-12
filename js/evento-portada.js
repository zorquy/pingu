// El evento de la portada (1192): al lado del torneo, el card show o la
// quedada que toca, con cuántos de PokeDoc van. Entra por import() desde
// home.js: la portada no lo baja si no hay hueco. Sin evento (o sin la
// migración), la sección se recoge.
//
// Desde la 1293 (PINGU eligió la A «Limpio» de la propuesta v2: «me gusta que
// ocupe poquito y a lo ancho») es una FRANJA FINA: el logo sin caja, una
// hojita de calendario con la fecha, el nombre, una línea con las caras, «N
// van» y «faltan N días», y el «¡Voy!» en forma de entrada, que funciona desde
// aquí. Toda la franja abre la FICHA del evento. Si hay un DESTACADO (1292)
// sale ese, esté cuando esté, con una estrella y una luz dorada que recorre el
// borde; si no, el siguiente de las dos próximas semanas, como antes.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { cuentaAtras, eventoDePortada, pastillaDe, fechaCorta, siglasDe, vanTexto, webSegura } from './eventos-puro.js'
import { caraHtml, ic } from './pb-comun.js'

const rutaDe = (e) => `/eventos/${encodeURIComponent(e.slug)}`

// El «¡Voy!» de la franja: la entrada de la agenda en pequeño. Sin sesión
// lleva a registrarse y vuelve a la ficha; ya apuntado, «Vas» en verde.
function voyHtml(e, conSesion) {
  const talon = e.van ? `<span class="pe-voy-talon">${Number(e.van)}</span>` : ''
  if (!conSesion) return `<a class="pe-voy" href="/auth.html?registro=1&volver=${encodeURIComponent(rutaDe(e))}"><span class="pe-voy-cuerpo">¡Voy!</span>${talon}</a>`
  return `<button type="button" class="pe-voy" data-pe-voy aria-pressed="${e.voy ? 'true' : 'false'}"><span class="pe-voy-cuerpo">${e.voy ? `${ic('checkCircle', 14)} Vas` : '¡Voy!'}</span>${talon}</button>`
}

export function eventoPortadaHtml(e, { conSesion = false, ahora = new Date() } = {}) {
  const color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : ''
  const logo = webSegura(e.logo_url)
  const caras = (Array.isArray(e.caras) ? e.caras : []).slice(0, 3)
  const van = Number(e.van) || 0
  const p = pastillaDe(e)
  // El destacado cuenta los días esté cuando esté; los demás, hasta dos semanas.
  const cuenta = cuentaAtras(e, ahora, e.destacado ? Infinity : 14)
  const quien = van
    ? `<span class="pe-quien">${caras.length ? `<span class="pe-caras">${caras.map((x) => caraHtml(x, 20)).join('')}</span>` : ''}${escapeHtml(vanTexto(van))}</span>`
    : '<span class="pe-quien">Sé el primero</span>'
  const fecha = fechaCorta(e)
  // La fecha solo se ve en el móvil: lleva su punto DENTRO, para no dejar un
  // «·» suelto delante en el PC.
  const linea = [
    quien,
    cuenta ? `<span class="pe-cuenta">${escapeHtml(cuenta.charAt(0).toLowerCase() + cuenta.slice(1))}</span>` : '',
  ].filter(Boolean).join('<span class="pe-punto" aria-hidden="true">·</span>')
  const fechaHtml = fecha ? `<span class="pe-fecha">${escapeHtml(fecha)}<span class="pe-punto" aria-hidden="true">·</span></span>` : ''
  const logoHtml = logo
    ? `<span class="pe-logo${e.logo_sin_fondo ? ' sin-fondo' : ''}"><img src="${escapeHtml(logo)}" alt="" width="44" height="44" loading="lazy" decoding="async"></span>`
    : `<span class="pe-logo pe-siglas"><b>${escapeHtml(siglasDe(e))}</b></span>`
  return `<div class="portada-evento${e.destacado ? ' destacado' : ''}"${color ? ` style="--ev-color:${color}"` : ''}>
      ${logoHtml}
      ${p.dia ? `<span class="pe-cal" aria-hidden="true"><small>${escapeHtml(p.arriba)}</small>${escapeHtml(p.dia)}</span>` : ''}
      <span class="pe-cuerpo">
        <a class="pe-nombre" href="${rutaDe(e)}">${e.destacado ? `<span class="pe-estrella" title="Destacado">${ic('star', 14)}</span>` : ''}<span class="pe-nombre-txt">${escapeHtml(e.nombre)}</span></a>
        <small class="pe-linea">${fechaHtml}${linea}</small>
      </span>
      ${voyHtml(e, conSesion)}
    </div>`
}

export async function pintarEventoPortada(seccion, hueco, recoger) {
  try {
    const [{ data, error }, { data: ses }] = await Promise.all([
      supabase.rpc('eventos_lista', { p_desde: new Date().toISOString() }),
      supabase.auth.getSession(),
    ])
    const e = !error && eventoDePortada(Array.isArray(data) ? data : [])
    if (!e) return recoger()
    const conSesion = !!ses?.session
    const pintar = () => { hueco.innerHTML = eventoPortadaHtml(e, { conSesion }) }
    pintar()
    seccion.style.display = ''
    if (conSesion) engancharVoy(hueco, e, pintar)
  } catch {
    recoger()
  }
}

// «¡Voy!» desde la portada: cambia YA, confirma después y deshace si falla
// (la 896), como en la agenda.
function engancharVoy(hueco, e, pintar) {
  hueco.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-pe-voy]')) return
    ev.preventDefault()
    const antes = { voy: e.voy, van: e.van }
    const voy = !e.voy
    e.voy = voy
    e.van = Math.max(0, (Number(e.van) || 0) + (voy ? 1 : -1))
    pintar()
    const { data, error } = await supabase.rpc('evento_voy', { p_evento: e.id, p_voy: voy, p_oculto: false })
    if (error) {
      Object.assign(e, antes)
      pintar()
      const { showToast } = await import('./toast.js')
      showToast(/ya pasó/.test(error.message || '') ? 'Ese evento ya pasó.' : 'No se ha podido guardar. Vuelve a intentarlo.')
      return
    }
    if (data) { e.van = data.van; e.voy = data.voy }
    pintar()
  })
}
