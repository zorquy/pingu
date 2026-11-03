// El próximo evento en la portada (1192): al lado del torneo, el card show o
// la quedada más cercana de los próximos 14 días, con cuántos de PokeDoc van.
// Entra por import() desde home.js: la portada no lo baja si no hay hueco.
// Sin evento cerca (o sin la migración), la sección se recoge.
//
// Desde la 1204 (PINGU: «solo dejaría el título… y las fechas… donde va el 7
// de noviembre yo pondría el logo»): el logo, el nombre y una línea con la
// fecha corta y las caras de quien va («2 van»). Lleva a la AGENDA (1202), y
// en el móvil el botón es una flecha redonda para que quepa en dos líneas.
import { supabase } from './supabase.js'
import { escapeHtml, urlParaCss } from './html.js'
import { fechaCorta, proximoEvento, siglasDe, vanTexto, webSegura } from './eventos-puro.js'
import { caraHtml, ic } from './pb-comun.js'

export function eventoPortadaHtml(e) {
  // De fondo, su cartel o su color (1194), oscurecidos para que se lea encima.
  const color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : ''
  const cartel = urlParaCss(webSegura(e.cartel_url))
  const estilo = [color ? `--ev-color:${color}` : '', cartel ? `--ev-cartel:url('${cartel}')` : ''].filter(Boolean).join(';')
  const logo = webSegura(e.logo_url)
  const caras = (Array.isArray(e.caras) ? e.caras : []).slice(0, 3)
  const van = Number(e.van) || 0
  const quien = van
    ? `${caras.length ? `<span class="pe-caras">${caras.map((p) => caraHtml(p, 20)).join('')}</span>` : ''}<span>${vanTexto(van)}</span>`
    : '<span>sé el primero</span>'
  const fecha = fechaCorta(e)
  return `<a class="portada-torneo portada-evento${cartel ? ' con-imagen' : ''}" href="/eventos"${estilo ? ` style="${estilo}"` : ''} aria-label="${escapeHtml(`${e.nombre}: ver todos los eventos`)}">
      <span class="pe-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" width="52" height="52" loading="lazy" decoding="async">` : `<b>${escapeHtml(siglasDe(e))}</b>`}</span>
      <span class="portada-torneo-cuerpo"><strong class="pe-nombre">${escapeHtml(e.nombre)}</strong><small class="pe-linea">${fecha ? `<span>${escapeHtml(fecha)}</span><span aria-hidden="true">·</span>` : ''}${quien}</small></span>
      ${e.voy ? '<span class="portada-torneo-boton">Vas</span>' : `<span class="portada-torneo-boton pe-boton"><span class="pe-largo">Ver eventos</span><span class="pe-flecha" aria-hidden="true">${ic('arrowRight', 16)}</span></span>`}
    </a>`
}

export async function pintarEventoPortada(seccion, hueco, recoger) {
  try {
    const { data, error } = await supabase.rpc('eventos_lista', { p_desde: new Date().toISOString() })
    const e = !error && proximoEvento(Array.isArray(data) ? data : [])
    if (!e) return recoger()
    hueco.innerHTML = eventoPortadaHtml(e)
    seccion.style.display = ''
  } catch {
    recoger()
  }
}
