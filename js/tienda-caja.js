// LA CAJA DE HOY (tanda 1256). PINGU: «que todos los cálculos se vayan al
// panel». Las ventas y las compras de hoy por forma de pago, lo ganado, lo
// rebajado al regatear y cuánto efectivo debería haber en la caja (lo que
// entró en efectivo menos lo que salió). Sin migración propia: sale de lo que
// guardan la 1254 (`tienda_ventas.pago`, `precio_lista`) y la 1255
// (`tienda_compras.pago`); sin ellas, todo cae en «Sin decir». Los cambios
// (1266, `tienda_cambios`): lo que se pagó en cartas va en «En cartas» y la
// diferencia, por su forma de pago (sin la migración, no hay cambios).
//
// La abren el abanico del Mostrador (y su línea «Hoy: …») y el Panel.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { cuentaDeCaja, rangoDePeriodo, PAGOS_VENTA, PAGOS_COMPRA, NOMBRE_DE_PAGO } from './tiendas-puro.js'
import { DIBUJOS } from './tienda-mostrador.js'

// Una consulta que pide columnas nuevas y, sin la migración (42703), las de
// antes. Las RLS dejan a la tienda leer solo lo suyo.
async function pedir(tabla, columnas, nuevas, fecha, rango) {
  const ir = (cols) => supabase.from(tabla).select(cols).gte(fecha, rango.desde).lt(fecha, rango.hasta).limit(1000)
  let r = await ir(`${columnas},${nuevas}`)
  if (r.error?.code === '42703') r = await ir(columnas)
  if (r.error) throw r.error
  return r.data || []
}

export async function cajaDeHoy(ahora = new Date()) {
  const rango = rangoDePeriodo('hoy', ahora)
  const [ventas, compras, cambios] = await Promise.all([
    pedir('tienda_ventas', 'ticket,unidades,precio,coste', 'pago,precio_lista', 'vendida_el', rango),
    pedir('tienda_compras', 'ticket,unidades,coste', 'pago', 'comprada_el', rango),
    supabase.from('tienda_cambios').select('diferencia,pago').gte('hecho_el', rango.desde).lt('hecho_el', rango.hasta).limit(1000).then((r) => r.data || [], () => []),
  ])
  return cuentaDeCaja(ventas, compras, cambios)
}

// Las filas de la tabla: primero las formas que se usaron, en el orden de
// siempre, y «Sin decir» al final si hay algo.
function filasHtml(c) {
  const orden = [...new Set([...PAGOS_VENTA, ...PAGOS_COMPRA].map(([v]) => v)), 'cambio', 'sin']
  const usadas = orden.filter((m) => c.metodos[m] && (c.metodos[m].entra || c.metodos[m].sale))
  if (!usadas.length) return '<p class="tdk-nada">Hoy todavía no has vendido ni comprado nada.</p>'
  return `<table class="tdk-tabla">
    <thead><tr><th scope="col">Cómo</th><th scope="col">Entra</th><th scope="col">Sale</th></tr></thead>
    <tbody>${usadas.map((m) => `<tr${m === 'efectivo' ? ' class="tdk-efectivo"' : ''}><th scope="row">${DIBUJOS[m] || ''}<span>${escapeHtml(m === 'sin' ? 'Sin decir' : NOMBRE_DE_PAGO[m] || m)}</span></th><td>${c.metodos[m].entra ? euros(c.metodos[m].entra) : '—'}</td><td>${c.metodos[m].sale ? `−${euros(c.metodos[m].sale)}` : '—'}</td></tr>`).join('')}</tbody>
  </table>`
}

function cajaHtml(c) {
  const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return `
    <p class="tdk-fecha">${escapeHtml(fecha)}</p>
    <div class="tdk-cifras">
      <span><small>Vendido</small><b>${euros(c.vendido)}</b><em>${c.ventas} ${c.ventas === 1 ? 'venta' : 'ventas'}</em></span>
      <span><small>Comprado</small><b>${euros(c.comprado)}</b><em>${c.compras} ${c.compras === 1 ? 'compra' : 'compras'}</em></span>
      <span><small>Ganado</small><b class="${c.ganado < 0 ? 'tdv-rojo' : 'tdv-verde'}">${c.ganado > 0 ? '+' : ''}${euros(c.ganado)}</b><em>${c.sinCoste ? `${c.sinCoste} sin coste` : 'en lo vendido'}</em></span>
      <span><small>Rebajado</small><b>${euros(c.rebajas)}</b><em>al regatear</em></span>
    </div>
    ${c.cambios ? `<p class="tdk-cambios">${DIBUJOS.cambio}<span>De ello, <b>${c.cambios} ${c.cambios === 1 ? 'cambio' : 'cambios'}</b>: ${c.enCambios === 0 ? 'en paz' : `${c.enCambios > 0 ? '+' : '−'}${euros(Math.abs(c.enCambios))} en dinero`}</span></p>` : ''}
    ${filasHtml(c)}
    <div class="tdk-efectivo-caja"><span>${DIBUJOS.efectivo}<span>Debería haber en efectivo</span></span><b class="${c.efectivo < 0 ? 'tdv-rojo' : ''}">${c.efectivo < 0 ? '−' : ''}${euros(Math.abs(c.efectivo))}</b></div>
    <p class="tdk-nota">Lo que entró en efectivo menos lo que pagaste en efectivo. Sin contar el cambio con el que empezaste.</p>`
}

let dialogo = null
export async function abrirCaja() {
  hojaInyectada('css/tienda-vender.css')
  hojaInyectada('css/tienda-mostrador.css')
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdv tdk'
    dialogo.setAttribute('aria-labelledby', 'tdkTitulo')
    dialogo.innerHTML = `
      <div class="tdv-caja">
        <header class="tdv-cab"><h2 id="tdkTitulo">Caja de hoy</h2><button type="button" class="tdv-cerrar" data-tdk="cerrar" aria-label="Cerrar">&times;</button></header>
        <div class="tdv-cuerpo" id="tdkCuerpo"></div>
      </div>`
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-tdk="cerrar"]')) dialogo.close()
    })
  }
  const cuerpo = dialogo.querySelector('#tdkCuerpo')
  cuerpo.innerHTML = '<p class="tdk-nada">Sumando…</p>'
  if (!dialogo.open) dialogo.showModal()
  try {
    cuerpo.innerHTML = cajaHtml(await cajaDeHoy())
  } catch {
    cuerpo.innerHTML = '<p class="tdk-nada">No se ha podido sumar la caja. Inténtalo de nuevo.</p>'
  }
}
