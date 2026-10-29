// «APÁRTAMELA» (tanda 1092). Cuando alguien pide «me la guardas hasta el
// sábado», la tienda aparta unidades para esa persona hasta un día. Apartar
// las saca del stock mientras dure (`tienda_apartar`), así que ni el
// escaparate ni Vender las ofrecen; «Recogida» apunta la venta al precio que
// quedó (`tienda_reserva_recoger`) y «Quitar» las devuelve. Las caducadas
// vuelven solas cuando alguien mira (`tienda_reservas_al_dia`).
//
// Entra por `import()`: desde la ficha de una línea del stock, desde un «Me
// interesa» del chat y desde el Panel (la lista de apartadas). Usa la hoja de
// Vender (`css/tienda-vender.css`).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { precioQueCuenta } from './tiendas-puro.js'
import { detalleDeLinea } from './tienda-vender.js'

const PLAZOS = [['24', '24 h'], ['48', '48 h'], ['168', 'Una semana'], ['otro', 'Otro día']]
const CLAVE_DONDE = 'pd-tienda-donde'
let dialogo = null

const sinMigracion = (error) => ['PGRST202', '42883', '42P01'].includes(error?.code) || /Could not find|does not exist/i.test(error?.message || '')

// «Hoy 20:00», «mañana 13:00», «sáb 2 nov»: cuándo se acaba.
export function rotuloDeHasta(hasta, ahora = new Date()) {
  const d = new Date(hasta)
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(d) - dia(ahora)) / 864e5)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (dias === 0) return `hoy ${hora}`
  if (dias === 1) return `mañana ${hora}`
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// El día en que acaba un plazo de la hoja: en horas, o el final del día que
// se elija.
export function hastaDePlazo(plazo, dia, ahora = new Date()) {
  if (plazo === 'otro') return dia ? new Date(`${dia}T23:59:59`) : null
  const h = Number(plazo)
  return h > 0 ? new Date(ahora.getTime() + h * 36e5) : null
}

function montar() {
  if (dialogo) return dialogo
  hojaInyectada('css/tienda-vender.css')
  dialogo = document.createElement('dialog')
  dialogo.className = 'tdv tda'
  dialogo.setAttribute('aria-labelledby', 'tdaTitulo')
  document.body.appendChild(dialogo)
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo || e.target.closest('[data-tda="cerrar"]')) dialogo.close() })
  return dialogo
}

// `fila`: la línea del stock (con su nombre y lo que haga falta para
// detallarla). `para` y `paraUsuario`: quién, si se sabe (el chat).
export function abrirApartar({ fila, para = '', paraUsuario = null, nombreSet = (id) => id, alTerminar = null } = {}) {
  if (!fila) return
  montar()
  const max = Math.max(1, Number(fila.unidades) || 1)
  let n = 1
  let plazo = '48'
  const precio = precioQueCuenta(fila)
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab"><h2 id="tdaTitulo">Apartar</h2><button type="button" class="tdv-cerrar" data-tda="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="tdv-cuerpo">
        <div class="tdv-linea"><div class="tdv-linea-que"><strong>${escapeHtml(fila.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(fila, nombreSet))} · quedan ${fila.unidades}</small></div></div>
        <label class="tdc-campo">Para quién<input type="text" maxlength="80" data-para value="${escapeHtml(para)}" placeholder="Un nombre o un @usuario" /></label>
        <div class="tdc-pct" role="group" aria-label="Hasta cuándo"><span>Hasta</span>${PLAZOS.map(([v, t]) => `<button type="button" class="tdv-chip" data-plazo="${v}" aria-pressed="${v === plazo}">${t}</button>`).join('')}</div>
        <label class="tdc-campo tda-dia" hidden>El día<input type="date" data-dia min="${new Date().toLocaleDateString('sv')}" /></label>
        <div class="tdv-linea-mandos">
          <span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-paso="-1" aria-label="Una menos">−</button><b aria-live="polite" data-n>1</b><button type="button" data-paso="1" aria-label="Una más">+</button></span>
          <label class="tdv-precio"><span class="sr-only">Precio por unidad</span><input type="number" inputmode="decimal" min="0" step="0.01" data-precio value="${precio ?? ''}" placeholder="Precio" /> €</label>
        </div>
        <label class="tdc-campo">Nota (opcional)<input type="text" maxlength="200" data-nota placeholder="Viene el sábado por la tarde" /></label>
        <p class="tdc-cm">Mientras esté apartada no sale en tu escaparate ni en Vender. Si nadie la recoge, vuelve sola al stock.</p>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" data-error role="alert"></p><button type="button" class="btn-primary tdv-vendida" data-tda="apartar">Apartar</button></footer>
    </div>`
  const $ = (s) => dialogo.querySelector(s)
  const pintar = () => {
    $('[data-n]').textContent = n
    $('[data-paso="-1"]').disabled = n <= 1
    $('[data-paso="1"]').disabled = n >= max
    for (const b of dialogo.querySelectorAll('[data-plazo]')) b.setAttribute('aria-pressed', String(b.dataset.plazo === plazo))
    $('.tda-dia').hidden = plazo !== 'otro'
  }
  pintar()
  dialogo.onclick = async (e) => {
    const paso = e.target.closest('[data-paso]')
    if (paso) { n = Math.min(max, Math.max(1, n + Number(paso.dataset.paso))); return pintar() }
    const p = e.target.closest('[data-plazo]')
    if (p) { plazo = p.dataset.plazo; pintar(); if (plazo === 'otro') $('[data-dia]').focus(); return }
    if (!e.target.closest('[data-tda="apartar"]')) return
    const quien = $('[data-para]').value.trim()
    const hasta = hastaDePlazo(plazo, $('[data-dia]').value)
    const valor = $('[data-precio]').value
    if (!quien) return ($('[data-error]').textContent = 'Di para quién es.')
    if (!hasta) return ($('[data-error]').textContent = 'Elige el día.')
    const boton = e.target.closest('[data-tda="apartar"]')
    boton.disabled = true
    const { data, error } = await supabase.rpc('tienda_apartar', {
      p_stock: fila.id, p_unidades: n, p_para: quien, p_hasta: hasta.toISOString(),
      p_precio: valor === '' ? null : Number(String(valor).replace(',', '.')), p_nota: $('[data-nota]').value.trim() || null,
      p_para_usuario: paraUsuario,
    })
    boton.disabled = false
    if (error || !data?.id) {
      $('[data-error]').textContent = sinMigracion(error) ? 'Falta un paso en la base para apartar (la migración 1092).' : error?.message || 'No se ha podido apartar.'
      return
    }
    dialogo.close()
    alTerminar?.(data)
    showToast(`Apartada${n > 1 ? `s ${n}` : ''} para ${quien}, hasta ${rotuloDeHasta(hasta)}.`, 'success', {
      acciones: [{ texto: 'Deshacer', alPulsar: () => quitar(data.id).then(() => alTerminar?.(null), () => {}) }],
    })
  }
  if (!dialogo.open) dialogo.showModal()
  $('[data-para]').value ? $('[data-tda="apartar"]').focus() : $('[data-para]').focus()
}

export async function quitar(id) {
  const { error } = await supabase.rpc('tienda_reserva_quitar', { p_reserva: id })
  if (error) {
    showToast(error.message || 'No se ha podido quitar.', 'error')
    throw error
  }
  showToast('Ya no está apartada: vuelve a tu stock.', 'success')
}

// Recogida: la venta, al precio que quedó y en el sitio de siempre.
export async function recoger(id) {
  let donde = 'mostrador'
  try { donde = localStorage.getItem(CLAVE_DONDE) || 'mostrador' } catch {}
  const { data, error } = await supabase.rpc('tienda_reserva_recoger', { p_reserva: id, p_precio: null, p_donde: donde })
  if (error || !data?.ticket) {
    showToast(error?.message || 'No se ha podido apuntar la venta.', 'error')
    throw error || new Error('sin ticket')
  }
  showToast(`Recogida y vendida · ${euros(Number(data.total))}`, 'success', {
    acciones: [
      { texto: 'Deshacer', alPulsar: () => import('./tienda-vender.js').then((m) => m.deshacerVenta(data.ticket)).then(() => document.dispatchEvent(new CustomEvent('pokedoc:tienda-vendida')), () => {}) },
      { texto: 'Recibo', alPulsar: () => import('./tienda-recibo.js').then((m) => m.abrirRecibo(data.ticket)).catch(() => showToast('No se ha podido hacer el recibo.', 'error')) },
    ],
  })
  return data
}

// Lo apartado de la tienda, al día (las caducadas vuelven antes de pedirlo).
// `null` si la base no sabe apartar todavía: no se pinta nada.
export async function apartadas() {
  const al = await supabase.rpc('tienda_reservas_al_dia', {})
  if (al.error && sinMigracion(al.error)) return null
  const { data, error } = await supabase.rpc('tienda_reservas_lista')
  if (error) return null
  return { filas: data || [], caducadas: Number(al.data) || 0 }
}

// La tarjeta del Panel: lo apartado, lo que antes acaba primero.
export function apartadasHtml(filas, nombreSet = (id) => id) {
  hojaInyectada('css/tienda-vender.css')
  const ahora = Date.now()
  return filas.map((r) => {
    const pronto = new Date(r.hasta).getTime() - ahora < 864e5
    return `<li class="tda-fila" data-reserva="${escapeHtml(r.id)}">
      <span class="tda-que"><strong>${escapeHtml(r.nombre || 'Producto')}${r.unidades > 1 ? ` × ${r.unidades}` : ''}</strong><small>Para ${escapeHtml(r.para)}${r.para_username && !String(r.para).includes(r.para_username) ? ` (@${escapeHtml(r.para_username)})` : ''} · ${escapeHtml(detalleDeLinea(r, nombreSet))}${r.precio != null ? ` · ${escapeHtml(euros(Number(r.precio)))}` : ''}</small></span>
      <span class="tda-reloj${pronto ? ' tda-pronto' : ''}">${escapeHtml(rotuloDeHasta(r.hasta))}</span>
      <span class="tda-botones"><button type="button" class="btn-primary tda-btn" data-recoger="${escapeHtml(r.id)}">Recogida</button><button type="button" class="btn-secondary tda-btn" data-quitar-reserva="${escapeHtml(r.id)}">Quitar</button></span>
    </li>`
  }).join('')
}
