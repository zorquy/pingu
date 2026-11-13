// Los torneos de la tienda (tanda 1331, G11 del plan 2027): la pestaña
// «Torneos» del panel. Los crea y los edita el editor de siempre (/torneos y
// la ficha del torneo, que una tienda puede abrir desde la 1331); aquí se ven
// los suyos y tres cifras. Lo que la tienda vende en un torneo ya entra en su
// caja del día: es una venta como otra.
//
// Lo puro (precio, próximos, cifras) vive en js/torneos/torneo-tienda.js.

import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { textoDePrecio, proximosDeTienda, cifrasDeTorneos } from './torneos/torneo-tienda.js'

const DIA = 86400000
const ESTADO = { draft: 'Borrador', registration_open: 'Inscripciones abiertas', registration_closed: 'Inscripciones cerradas', in_progress: 'En juego', finished: 'Terminado' }

const cuando = (iso) => {
  const f = new Date(iso)
  return `${f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })} · ${f.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

function filaHtml(t, ocupadas) {
  const plazas = t.max_players == null ? `${ocupadas} apuntados` : `${ocupadas} de ${t.max_players} plazas`
  const precio = textoDePrecio(t.precio_entrada, { deTienda: true })
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  return `<li class="tdtn-fila">
    <span class="tdtn-cuando">${escapeHtml(cuando(t.start_at))}</span>
    <a class="tdtn-nombre" href="${url}">${escapeHtml(t.name)}</a>
    <span class="tdtn-datos">${escapeHtml([ESTADO[t.status] || '', t.format === 'league' ? 'Liga' : '', plazas, precio].filter(Boolean).join(' · '))}</span>
    <a class="btn-secondary tdtn-ir" href="${url}">${t.status === 'draft' || t.status === 'registration_open' ? 'Editar' : 'Ver'}</a>
  </li>`
}

const cifraHtml = (icono, titulo, valor, pie) => `<div class="tdh-cifra"><span class="tdh-cifra-icono" aria-hidden="true">${icons[icono]?.(20) || ''}</span><small>${escapeHtml(titulo)}</small><b>${escapeHtml(valor)}</b><span>${escapeHtml(pie)}</span></div>`

export async function montarTorneos(caja, { perfil, ahora = new Date() } = {}) {
  if (!caja || !perfil?.id) return
  const { data: torneos, error } = await supabase.from('tournaments').select('*').eq('admin_id', perfil.id).order('start_at', { ascending: false }).limit(200)
  if (error) {
    caja.innerHTML = '<p class="subtext">No se han podido traer tus torneos. Recarga la página.</p>'
    return
  }
  const lista = torneos || []
  const ids = lista.map((t) => t.id)
  const desde = new Date(ahora.getTime() - 90 * DIA).toISOString()
  const [insc, ventas] = await Promise.all([
    ids.length ? supabase.from('tournament_registrations').select('tournament_id, user_id, status').in('tournament_id', ids).then((r) => r.data || [], () => []) : [],
    supabase.from('tienda_ventas').select('vendida_el, unidades, precio').gte('vendida_el', desde).limit(5000).then((r) => r.data || [], () => []),
  ])
  const ocupadas = {}
  for (const r of insc) if (r.status !== 'dropped' && r.status !== 'waitlist') ocupadas[r.tournament_id] = (ocupadas[r.tournament_id] || 0) + 1
  const c = cifrasDeTorneos(lista, insc, ventas.map((v) => ({ creado: v.vendida_el, total: Number(v.precio) * (Number(v.unidades) || 0) })), { ahora })
  const proximos = proximosDeTienda(lista, { ahora, conBorradores: true })
  const pasados = lista.filter((t) => t.status === 'finished').slice(0, 10)
  caja.innerHTML = `
    <div class="tdtn">
      <div class="tdtn-cab">
        <h2>Torneos de tu tienda</h2>
        <a class="btn-primary" href="/torneos?crear=1">+ Nuevo torneo</a>
      </div>
      <p class="subtext tdtn-lema">Salen en /torneos con «Torneo de tienda» y en tu escaparate. La inscripción es informativa: se paga aquí, en la tienda.</p>
      <div class="tdh-cifras tdtn-cifras">
        ${cifraHtml('trophy', 'Este mes', String(c.esteMes), c.esteMes === 1 ? 'torneo' : 'torneos')}
        ${cifraHtml('users', 'Jugadores', String(c.jugadores), 'distintos, en todos tus torneos')}
        ${c.mejora == null ? '' : cifraHtml('barChart', 'Días de torneo', `${c.mejora > 0 ? '+' : ''}${c.mejora} %`, 'de ventas frente a un día cualquiera')}
      </div>
      ${proximos.length
        ? `<h3 class="tdtn-titulo">Lo que viene</h3><ul class="tdtn-lista">${proximos.map((t) => filaHtml(t, ocupadas[t.id] || 0)).join('')}</ul>`
        : '<p class="empty-state tdtn-vacio">Aún no tienes ningún torneo. Crea el primero: sale en /torneos y en tu escaparate.</p>'}
      ${pasados.length ? `<details class="tdtn-pasados"><summary>Los que ya se jugaron (${pasados.length})</summary><ul class="tdtn-lista">${pasados.map((t) => filaHtml(t, ocupadas[t.id] || 0)).join('')}</ul></details>` : ''}
    </div>`
}
