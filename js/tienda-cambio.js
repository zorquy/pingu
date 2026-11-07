// «LE DAS» del Cambio (tanda 1266). Una tienda en un evento: «yo compro al
// 80 %… me está dando 80 y luego me tiene que dar 20 en cash». El Cambio es la
// hoja de Comprar en otro modo (js/tienda-comprar.js): «Te da» son sus líneas
// de siempre (con «Vale» y Cardmarket en gris) y esto es la otra mitad, lo que
// sale de tu stock, como en Vender: el mismo buscador (y el lector de SKU), y
// cada línea con «Tu precio» fijo y «Lo dejas en» con ese precio en gris.
//
// Los atributos van con `data-tdx-…` a propósito: la hoja de Comprar escucha
// `data-paso`, `data-quitar` y `data-linea` para sus propias líneas, y un
// clic aquí no debe tocarlas.
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { euros } from './cardmarket.js'
import { pareceSku } from './tiendas-puro.js'
import { buscarEnStock, resultadoHtml, filaPorSku, fotoHtml, chapasHtml, nueva, cargarPorPoner } from './tienda-vender.js'

const dinero = (n) => (n == null ? '' : Number(n).toFixed(2))

// `alCambiar()` se llama cada vez que cambia algo que mueve la cuenta.
export function montarLeDas(caja, alCambiar = () => {}) {
  let lineas = []
  caja.innerHTML = `
    <div class="tdx-lado-cab"><h3 class="tdx-lado-titulo">Le das</h3><span>de tu stock</span></div>
    <div class="tdm-busca-caja"><input type="search" class="tdv-busca tdm-busca tdx-busca" data-tdx-busca placeholder="Busca en tu stock o escanea la etiqueta" aria-label="Lo que le das: busca en tu stock o escanea la etiqueta" autocomplete="off" /></div>
    <ul class="tdv-resultados" data-tdx-resultados hidden></ul>
    <ul class="tdv-lineas tdx-lineas" data-tdx-lineas></ul>`
  const $ = (sel) => caja.querySelector(sel)
  const busca = $('[data-tdx-busca]')
  const resultados = $('[data-tdx-resultados]')
  cargarPorPoner()

  let espera = null
  let pedido = 0
  busca.addEventListener('input', () => {
    clearTimeout(espera)
    const q = busca.value.trim()
    if (!q) {
      resultados.hidden = true
      return
    }
    espera = setTimeout(async () => {
      const yo = ++pedido
      const filas = await buscarEnStock(q)
      if (yo !== pedido) return
      resultados.hidden = false
      resultados.innerHTML = !filas
        ? '<li class="tdv-nada">No se ha podido buscar. Inténtalo de nuevo.</li>'
        : filas.length
          ? filas.map(resultadoHtml).join('')
          : `<li class="tdv-nada">Nada con unidades en tu stock que case con «${escapeHtml(q)}».</li>`
    }, 200)
  })
  // Un lector de códigos escribe el SKU y un Intro (1253): entra sin elegirla.
  busca.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !pareceSku(busca.value)) return
    e.preventDefault()
    clearTimeout(espera)
    pedido++
    const sku = busca.value.trim().toUpperCase()
    busca.value = ''
    resultados.hidden = true
    const r = await filaPorSku(sku, (id) => lineas.find((l) => l.id === id)?.vender || 0)
    if (!r.fila) return showToast(r.aviso, r.tipo)
    anadir(r.fila)
    busca.focus()
  })

  const lineaDe = (el) => lineas.find((x) => x.id === el.closest('[data-tdx-linea]')?.dataset.tdxLinea)
  caja.addEventListener('click', (e) => {
    const res = e.target.closest('.tdv-resultado[data-fila]')
    if (res) {
      anadir(JSON.parse(res.dataset.fila))
      busca.value = ''
      resultados.hidden = true
      busca.focus()
      return
    }
    const paso = e.target.closest('[data-tdx-paso]')
    if (paso) {
      const l = lineaDe(paso)
      if (!l) return
      l.vender = Math.min(l.unidades, Math.max(1, l.vender + Number(paso.dataset.tdxPaso)))
      return pintar()
    }
    const quitar = e.target.closest('[data-tdx-quitar]')
    if (quitar) {
      lineas = lineas.filter((x) => x !== lineaDe(quitar))
      return pintar()
    }
  })
  caja.addEventListener('input', (e) => {
    if (!e.target.matches('[data-tdx-precio]')) return
    const l = lineaDe(e.target)
    if (!l) return
    l.cobrar = e.target.value === '' ? null : Number(String(e.target.value).replace(',', '.'))
    alCambiar()
  })

  function anadir(f) {
    const ya = lineas.find((x) => x.id === f.id)
    if (ya) ya.vender = Math.min(ya.unidades, ya.vender + 1)
    else lineas.push(nueva(f))
    pintar()
  }

  function pintar() {
    $('[data-tdx-lineas]').innerHTML = lineas.length
      ? lineas.map((l) => `<li class="tdv-linea tdm-linea" data-tdx-linea="${escapeHtml(l.id)}">
          <div class="tdm-linea-cab">${fotoHtml(l)}<div class="tdv-linea-que"><strong>${escapeHtml(l.nombre || l.card_id || 'Producto')}</strong><small class="tdm-chapas">${chapasHtml(l)} · te ${l.unidades === 1 ? 'queda 1' : `quedan ${l.unidades}`}</small></div><button type="button" class="tdv-quitar" data-tdx-quitar aria-label="Quitar ${escapeHtml(l.nombre || '')}">&times;</button></div>
          <div class="tdm-dos-campos">
            <span class="tdm-campo tdm-campo-fijo"><span>Tu precio</span><b>${l.lista != null ? euros(l.lista) : '—'}</b></span>
            <label class="tdm-campo"><span>Lo dejas en</span><span class="tdm-input"><input type="number" inputmode="decimal" min="0" step="0.01" data-tdx-precio value="${dinero(l.cobrar)}" placeholder="${l.lista != null ? dinero(l.lista).replace('.', ',') : 'Precio'}" /> €</span></label>
          </div>
          ${l.unidades > 1 ? `<div class="tdm-uds"><span>Unidades</span><span class="tdv-paso" role="group" aria-label="Unidades"><button type="button" data-tdx-paso="-1" aria-label="Una menos" ${l.vender <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${l.vender}</b><button type="button" data-tdx-paso="1" aria-label="Una más" ${l.vender >= l.unidades ? 'disabled' : ''}>+</button></span></div>` : ''}
        </li>`).join('')
      : '<li class="tdv-nada">Busca la carta de tu stock que se lleva (o escanea su etiqueta).</li>'
    alCambiar()
  }

  pintar()
  return {
    lineas: () => lineas,
    vaciar() {
      lineas = []
      busca.value = ''
      resultados.hidden = true
      pintar()
    },
    enfocar: () => busca.focus(),
  }
}
