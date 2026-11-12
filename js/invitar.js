// Invitar a un amigo (1298, PINGU: «recuperar el enlace referido»). El enlace
// /r/<usuario> y sus logros existían desde la migración de referidos, pero
// solo se veían en Ajustes. Aquí viven las tres piezas que lo sacan a la vista:
//   · la tarjeta «Invita a tus amigos» de TU perfil (`montarTarjetaInvitar`),
//   · la hoja de compartir con la imagen (`abrirInvitar`, invitar-hoja.js),
//     que abren la tarjeta y la fila del menú del avatar (menu-tu.js),
//   · y la página de llegada de /r/<usuario> (auth.js).
// Lo puro (enlace, logros, textos) está en invitar-puro.js.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { getInitial, avatarStyle } from './app.js'
import { showToast } from './toast.js'
import {
  enlaceDeInvitacion, enlaceCorto, progresoEmbajador, textoDeTraidos, textoDeFalta, EMBAJADOR,
} from './invitar-puro.js'

const nombreDe = (p) => p?.display_name || p?.username || ''

// Quién ha llegado con tu enlace: cuántos y los últimos cinco (para las caras).
// La RLS deja leer los perfiles; si la columna no está (sin la migración de
// referidos), `null`: «no se sabe», que no es «cero».
export async function traidosDe(uid) {
  try {
    const { data, count, error } = await supabase.from('user_profiles')
      .select('id, username, display_name, avatar_url', { count: 'exact' })
      .eq('referred_by', uid).order('created_at', { ascending: false }).limit(5)
    if (error) return null
    return { n: count ?? (data || []).length, caras: data || [] }
  } catch { return null }
}

function tarjetaHtml({ enlace, traidos }) {
  const p = progresoEmbajador(traidos?.n || 0)
  const caras = traidos?.caras?.length
    ? `<span class="inv-caras" aria-hidden="true">${traidos.caras.slice(0, 5).map((x) => `<span class="mini-avatar" style="${avatarStyle(x)}">${x.avatar_url ? '' : escapeHtml(getInitial(nombreDe(x)))}</span>`).join('')}</span>`
    : ''
  return `
    <header class="inv-cab"><h2>${icons.gift(18)} Invita a tus amigos</h2></header>
    <p class="inv-lema">Quien se una con tu enlace y tú os lleváis logros y XP.</p>
    <div class="inv-enlace"><code>${escapeHtml(enlaceCorto(enlace))}</code><button type="button" class="inv-copiar" data-inv-copiar>${icons.link(14)} Copiar</button></div>
    <button type="button" class="btn-primary inv-compartir" data-inv-compartir>${icons.share(16)} Compartir invitación</button>
    ${traidos ? `<p class="inv-traidos">${caras}<span>${escapeHtml(textoDeTraidos(traidos.n))}</span></p>
    <div class="inv-progreso" role="img" aria-label="${escapeHtml(textoDeFalta(p))}"><span class="inv-barra"><i style="--pct:${p.pct}"></i></span><small>${escapeHtml(textoDeFalta(p))}</small></div>
    <ul class="inv-logros">${EMBAJADOR.map((l) => `<li class="${traidos.n >= l.cuantos ? 'si' : ''}"><span>${traidos.n >= l.cuantos ? '✓' : l.cuantos}</span>${escapeHtml(l.titulo)}</li>`).join('')}</ul>` : ''}`
}

// La tarjeta de tu perfil. Sin usuario no hay enlace: se queda escondida
// (el perfil ya pide ponerse uno).
export async function montarTarjetaInvitar(caja, { perfil, uid }) {
  if (!caja) return
  const enlace = enlaceDeInvitacion(perfil?.username, location.origin)
  if (!enlace || perfil?.tipo === 'tienda') { caja.hidden = true; return }
  caja.innerHTML = tarjetaHtml({ enlace, traidos: null })
  caja.hidden = false
  if (!caja.dataset.invListo) {
    caja.dataset.invListo = '1'
    caja.addEventListener('click', async (e) => {
      if (e.target.closest('[data-inv-copiar]')) {
        try { await navigator.clipboard.writeText(enlace); showToast('Enlace copiado. ¡A repartirlo!', 'success') }
        catch { showToast('No se ha podido copiar. Selecciónalo a mano.') }
      }
      if (e.target.closest('[data-inv-compartir]')) import('./invitar-hoja.js').then((m) => m.abrirInvitar(perfil)).catch(() => showToast('No se ha podido preparar la invitación.'))
    })
  }
  const traidos = await traidosDe(uid)
  if (traidos) caja.innerHTML = tarjetaHtml({ enlace, traidos })
}
