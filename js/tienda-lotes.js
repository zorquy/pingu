// LOS LOTES POR DESGLOSAR (tanda 1277). PINGU eligió la opción A del cambio
// rápido: en un evento, lo que te da el cliente (o lo que le compras) se
// apunta como UN LOTE —lo que vale, tu tanto por ciento y una foto— y las
// cartas se dicen luego. Esta hoja es el «luego»: los lotes que esperan, con
// su foto, de qué compra o cambio vienen y lo que costaron, y «Desglosar»
// abre la hoja de Comprar en modo lote (js/tienda-comprar.js), con el
// buscador de siempre.
//
// La abre la pastilla «N lotes por desglosar» del Panel (`data-ver="lotes"`,
// enganchada en js/tienda-mostrador.js) y `/tienda?lotes=1`. Sin la migración
// 1277 la tabla no existe y la hoja lo dice (no es «no hay lotes»).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { urlDeFotoDeTienda } from './tienda-fotos.js'
import { recargarSiDesajuste } from './error-log.js'
import { showToast } from './toast.js'

let dialogo = null
let alTerminar = null
let lotes = []

// «hoy, 17:42», «ayer, 11:05» o «3 nov».
export function cuandoDeLote(iso, ahora = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(ahora) - dia(d)) / 86400000)
  if (dias === 0) return `hoy, ${hora}`
  if (dias === 1) return `ayer, ${hora}`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Los lotes que esperan, lo más nuevo arriba, con `cambio` si vienen de uno.
// null: no se ha podido preguntar (o falta la migración).
export async function lotesPorDesglosar() {
  const { data, error } = await supabase.from('tienda_lotes')
    .select('id,compra_ticket,vale,coste,pct,cartas,foto,cliente,creado_el')
    .eq('estado', 'por_desglosar')
    .order('creado_el', { ascending: false })
    .limit(100)
  if (error) return { error }
  const lista = data || []
  if (lista.length) {
    const { data: cambios } = await supabase.from('tienda_cambios').select('compra_ticket').in('compra_ticket', lista.map((l) => l.compra_ticket))
    const deCambio = new Set((cambios || []).map((c) => c.compra_ticket))
    for (const l of lista) l.cambio = deCambio.has(l.compra_ticket)
  }
  return { lista }
}

function filaHtml(l) {
  const foto = l.foto ? urlDeFotoDeTienda(l.foto) : ''
  return `<li class="tdl-lote">
    ${foto
      ? `<a class="tdc-lote-mini" href="${escapeHtml(foto)}" target="_blank" rel="noopener" aria-label="Ver la foto del lote en grande"><img src="${escapeHtml(foto)}" alt="" width="56" height="56" loading="lazy" onerror="this.remove()" /></a>`
      : `<span class="tdc-lote-mini">${icons.layers(24)}</span>`}
    <span class="tdc-lote-que"><strong>${l.cartas ? `Lote de ${l.cartas} cartas` : 'Lote'}</strong>
      <small>${l.cambio ? 'Cambio' : 'Compra'} · ${escapeHtml(cuandoDeLote(l.creado_el))}${l.cliente ? ` · ${escapeHtml(l.cliente)}` : ''}</small>
      <small>Coste <b>${euros(Number(l.coste))}</b>${l.vale != null ? ` · vale ${euros(Number(l.vale))}` : ''}${l.pct != null ? ` (al ${l.pct} %)` : ''}</small></span>
    <button type="button" class="btn-primary tdl-desglosar" data-desglosar="${escapeHtml(l.id)}">Desglosar</button>
  </li>`
}

async function pintar() {
  const cuerpo = dialogo.querySelector('#tdlCuerpo')
  cuerpo.innerHTML = '<p class="tdv-nada">Cargando…</p>'
  const r = await lotesPorDesglosar()
  if (r.error) {
    const sin = r.error.code === '42P01' || /tienda_lotes/.test(r.error.message || '')
    cuerpo.innerHTML = `<p class="tdv-nada">${sin ? 'Para los lotes falta un paso en la base (la migración 1277).' : 'No se han podido traer tus lotes. Inténtalo de nuevo.'}</p>`
    return
  }
  lotes = r.lista
  cuerpo.innerHTML = lotes.length
    ? `<p class="tdc-nota">Abre uno y añade sus cartas con el buscador de Comprar. El coste del lote se reparte según lo que vale cada una.</p><ul class="tdl-lista">${lotes.map(filaHtml).join('')}</ul>`
    : `<p class="tdv-nada">No te queda ningún lote por desglosar.</p>`
}

export function abrirLotes({ alTerminar: alFin = null } = {}) {
  hojaInyectada('css/tienda-vender.css')
  hojaInyectada('css/tienda-mostrador.css')
  alTerminar = alFin
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdv tdl tdm-hoja tdm-hoja-comprar'
    dialogo.setAttribute('aria-labelledby', 'tdlTitulo')
    dialogo.innerHTML = `
      <div class="tdv-caja">
        <header class="tdv-cab"><h2 id="tdlTitulo">Lotes por desglosar</h2><button type="button" class="tdv-cerrar" data-tdl="cerrar" aria-label="Cerrar">&times;</button></header>
        <div class="tdv-cuerpo" id="tdlCuerpo"></div>
      </div>`
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-tdl="cerrar"]')) return dialogo.close()
      const b = e.target.closest('[data-desglosar]')
      if (!b) return
      const lote = lotes.find((l) => l.id === b.dataset.desglosar)
      if (!lote) return
      dialogo.close()
      import('./tienda-comprar.js')
        .then((m) => m.abrirComprar({ lote, alTerminar }))
        .catch((err) => { if (!recargarSiDesajuste(err)) showToast('No se ha podido abrir el lote. Recarga la página.', 'error') })
    })
  }
  if (!dialogo.open) dialogo.showModal()
  return pintar()
}
