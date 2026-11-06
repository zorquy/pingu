// POR PONER A LA VENTA (tanda 1255). PINGU: «se te guarda en el stock, pero
// aún no está en venta… se quedaría en un apartado de compradas, para luego
// gestionarlas». Lo comprado en el Mostrador entra oculto y sin precio
// (`tienda_stock.por_poner`); aquí se le pone precio (de partida, lo que dijiste
// que valía: `valorado`) y se publica con `tienda_poner_a_la_venta`, de una en
// una o todas. Mientras tanto, Vender no lo ofrece y la gente no lo ve.
//
// Lo usan el Stock (la franja de arriba y `?porponer=1`) y el Panel (la
// pastilla «N por poner a la venta»). Sin la migración 1255 la columna no
// existe (42703): no hay ninguna y no sale nada.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { banderaHtml } from './precio-vista.js'
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'

const COLUMNAS_CARTA = COLUMNAS_CARTA_DE_SET.replace('tcg_sets(tcg_online_code,serie_id,release_date)', 'tcg_sets(name,name_en,tcg_online_code,serie_id,release_date)')

// Cuántas hay (con unidades): la franja del Stock y la pastilla del Panel.
export async function cuantasPorPoner() {
  const r = await supabase.from('tienda_stock').select('id', { count: 'exact', head: true }).eq('por_poner', true).gt('unidades', 0)
  return r.error ? 0 : r.count || 0
}

async function lineasPorPoner() {
  const { data, error } = await supabase.from('tienda_stock')
    .select('id,card_id,market,product_id,idioma,estado,variante,gradeo,unidades,coste,valorado,precio,entro_el')
    .eq('por_poner', true).gt('unidades', 0).order('entro_el', { ascending: false }).limit(500)
  if (error) throw error
  const filas = data || []
  const ids = [...new Set(filas.filter((f) => f.card_id).map((f) => f.card_id))]
  const prods = [...new Set(filas.filter((f) => f.product_id).map((f) => f.product_id))]
  const [cartas, productos] = await Promise.all([
    ids.length ? supabase.from('tcg_cards').select(COLUMNAS_CARTA).in('id', ids).then((r) => r.data || [], () => []) : [],
    prods.length ? supabase.from('tcg_products').select('id,name,image').in('id', prods).then((r) => r.data || [], () => []) : [],
  ])
  const carta = new Map(cartas.map((c) => [`${c.id}|${c.market || 'WEST'}`, c]))
  const producto = new Map(productos.map((p) => [String(p.id), p]))
  return filas.map((f) => ({ ...f, carta: f.card_id ? carta.get(`${f.card_id}|${f.market || 'WEST'}`) || null : null, producto: f.product_id ? producto.get(String(f.product_id)) || null : null }))
}

function fotoHtml(f) {
  if (f.product_id) return `<span class="tdc-foto tdc-foto-producto">${f.producto?.image ? `<img src="${escapeHtml(f.producto.image)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()" />` : ''}</span>`
  const attrs = f.carta ? atributosDeEscaneo(cadenaDeEscaneo(f.carta)) : ''
  return `<span class="tdc-foto">${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}</span>`
}

function filaHtml(f) {
  const nombre = f.carta ? nombreDeCarta(f.carta) : f.producto?.name || f.card_id || 'Producto'
  const sitio = f.carta ? [nombreDeSet(f.carta.tcg_sets) || f.carta.set_id, f.carta.local_id].filter(Boolean).join(' · ') : 'Sellado'
  const partida = f.precio ?? f.valorado
  return `<li class="tdv-linea tdm-linea tdpp-linea" data-linea="${escapeHtml(f.id)}">
    <div class="tdm-linea-cab">${fotoHtml(f)}<div class="tdv-linea-que"><strong>${escapeHtml(nombre)}</strong><small class="tdm-chapas"><span class="tdm-idi">${f.product_id ? '' : banderaHtml(f.idioma)}${escapeHtml(String(f.idioma || '').toUpperCase())}</span>${f.product_id ? '' : f.gradeo ? chapaDeGradeoHtml(f.gradeo) : chapaDeEstadoHtml(f.estado)}<span>${escapeHtml(sitio)}${f.variante && f.variante !== 'normal' ? ` · ${escapeHtml(nombreDeVariante(f.variante))}` : ''} · ${f.unidades} ${f.unidades === 1 ? 'ud.' : 'uds.'}</span></small></div></div>
    <div class="tdm-dos-campos">
      <span class="tdm-campo tdm-campo-fijo"><span>Pagaste · vale</span><b>${f.coste != null ? euros(f.coste) : '—'} · ${f.valorado != null ? euros(f.valorado) : '—'}</b></span>
      <label class="tdm-campo"><span>A la venta por</span><span class="tdm-input"><input type="number" inputmode="decimal" min="0" step="0.01" data-precio placeholder="${partida != null ? String(Number(partida).toFixed(2)).replace('.', ',') : 'Precio'}" /> €</span></label>
    </div>
    <button type="button" class="btn-primary tdpp-poner" data-poner="${escapeHtml(f.id)}">A la venta</button>
  </li>`
}

let dialogo = null
let alCambiar = null
const $ = (sel) => dialogo?.querySelector(sel)

async function pintar() {
  const lista = $('#tdppLista')
  lista.innerHTML = '<li class="tdv-nada">Cargando…</li>'
  try {
    const filas = await lineasPorPoner()
    lista.innerHTML = filas.length ? filas.map(filaHtml).join('') : '<li class="tdv-nada">No tienes nada por poner a la venta. Lo que compres en el Mostrador espera aquí.</li>'
    $('#tdppTodas').hidden = filas.length < 2
    $('#tdppN').textContent = filas.length ? `· ${filas.length}` : ''
  } catch {
    lista.innerHTML = '<li class="tdv-nada">No se ha podido traer lo que tienes por poner a la venta.</li>'
    $('#tdppTodas').hidden = true
  }
}

async function poner(ids, precio = null) {
  const { data, error } = await supabase.rpc('tienda_poner_a_la_venta', { p_ids: ids, p_precio: precio })
  if (error) {
    showToast(/tienda_poner_a_la_venta|schema cache|Could not find/i.test(error.message || '') ? 'Para esto falta un paso en la base (la migración 1255).' : error.message || 'No se ha podido poner a la venta.', 'error')
    return null
  }
  const n = data?.puestas || 0
  const sin = data?.sin_precio || 0
  if (n) showToast(`${n === 1 ? 'Ya está a la venta' : `${n} ya están a la venta`}.${sin ? ` ${sin === 1 ? 'Una no tiene' : `${sin} no tienen`} precio: pónselo.` : ''}`, 'success')
  else if (sin) showToast('Pon el precio antes de ponerla a la venta.', 'info')
  alCambiar?.()
  return data
}

export function abrirPorPoner({ alTerminar = null } = {}) {
  alCambiar = alTerminar
  hojaInyectada('css/tienda-vender.css')
  hojaInyectada('css/tienda-mostrador.css')
  hojaInyectada('css/cardmarket.css')
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdv tdpp tdm-hoja'
    dialogo.setAttribute('aria-labelledby', 'tdppTitulo')
    dialogo.innerHTML = `
      <div class="tdv-caja">
        <header class="tdv-cab"><h2 id="tdppTitulo">Por poner a la venta <span id="tdppN"></span></h2><button type="button" class="tdv-cerrar" data-tdpp="cerrar" aria-label="Cerrar">&times;</button></header>
        <div class="tdv-cuerpo">
          <p class="tdc-pista">Lo que has comprado y aún no ve nadie. Vacío, se pone por lo que dijiste que valía.</p>
          <ul class="tdv-lineas" id="tdppLista"></ul>
        </div>
        <footer class="tdv-pie"><button type="button" class="btn-primary tdv-vendida tdm-boton-vender" id="tdppTodas" hidden>Todas a la venta</button></footer>
      </div>`
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', async (e) => {
      if (e.target === dialogo || e.target.closest('[data-tdpp="cerrar"]')) return dialogo.close()
      const b = e.target.closest('[data-poner]')
      if (b) {
        const campo = b.closest('[data-linea]').querySelector('[data-precio]').value
        const precio = campo === '' ? null : Number(String(campo).replace(',', '.'))
        if (precio != null && !(precio >= 0)) return showToast('Revisa el precio.', 'error')
        b.disabled = true
        const r = await poner([b.dataset.poner], precio)
        if (r?.puestas) b.closest('[data-linea]').remove()
        else b.disabled = false
        if (!$('#tdppLista').children.length) pintar()
        return
      }
      if (e.target.closest('#tdppTodas')) {
        const boton = e.target.closest('#tdppTodas')
        boton.disabled = true
        // Las que llevan un precio escrito, cada una con el suyo; las demás, juntas.
        const lis = [...dialogo.querySelectorAll('[data-linea]')]
        const escritas = lis.filter((li) => li.querySelector('[data-precio]').value !== '')
        let puestas = 0
        let sinPrecio = 0
        for (const li of escritas) {
          const r = await supabase.rpc('tienda_poner_a_la_venta', { p_ids: [li.dataset.linea], p_precio: Number(li.querySelector('[data-precio]').value) })
          puestas += r.data?.puestas || 0
        }
        const resto = lis.filter((li) => !escritas.includes(li)).map((li) => li.dataset.linea)
        if (resto.length) {
          const r = await supabase.rpc('tienda_poner_a_la_venta', { p_ids: resto, p_precio: null })
          if (r.error) showToast('No se han podido poner a la venta.', 'error')
          puestas += r.data?.puestas || 0
          sinPrecio += r.data?.sin_precio || 0
        }
        if (puestas) showToast(`${puestas === 1 ? 'Una ya está' : `${puestas} ya están`} a la venta.${sinPrecio ? ` ${sinPrecio === 1 ? 'Una no tiene' : `${sinPrecio} no tienen`} precio: pónselo.` : ''}`, 'success')
        else if (sinPrecio) showToast('Pon el precio antes de ponerlas a la venta.', 'info')
        alCambiar?.()
        boton.disabled = false
        pintar()
      }
    })
  }
  if (!dialogo.open) dialogo.showModal()
  pintar()
}
