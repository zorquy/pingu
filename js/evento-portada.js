// El próximo evento en la portada (1192): al lado del torneo, el card show o
// la quedada más cercana de los próximos 14 días, con cuántos de PokeDoc van.
// Entra por import() desde home.js: la portada no lo baja si no hay hueco.
// Sin evento cerca (o sin la migración), la sección se recoge.
import { supabase } from './supabase.js'
import { escapeHtml, urlParaCss } from './html.js'
import { TIPOS, MESES, cuandoEs, proximoEvento, vanTexto, webSegura } from './eventos-puro.js'

export function eventoPortadaHtml(e, ahora = new Date()) {
  const d = new Date(e.empieza)
  const cuando = cuandoEs(e.empieza, ahora)
  const linea = [TIPOS[e.tipo], e.ciudad, cuando, e.van ? `${vanTexto(e.van)} de PokeDoc` : ''].filter(Boolean).join(' · ')
  // De fondo, su cartel o su color (1194), oscurecidos para que se lea encima.
  const color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : ''
  const cartel = urlParaCss(webSegura(e.cartel_url))
  const estilo = [color ? `--ev-color:${color}` : '', cartel ? `--ev-cartel:url('${cartel}')` : ''].filter(Boolean).join(';')
  return `<a class="portada-torneo portada-evento${cartel ? ' con-imagen' : ''}" href="/eventos/${encodeURIComponent(e.slug)}"${estilo ? ` style="${estilo}"` : ''}>
      <span class="portada-torneo-fecha"><b>${d.getDate()}</b><span>${MESES[d.getMonth()]}</span></span>
      <span class="portada-torneo-cuerpo"><strong>${escapeHtml(e.nombre)}</strong><small>${escapeHtml(linea)}</small></span>
      <span class="portada-torneo-boton">${e.voy ? 'Vas' : 'Ver'}</span>
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
