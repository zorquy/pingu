// Las últimas ventas de una carta gradeada (tanda 1364, la C de «Lo nuevo de
// la API de TCGGO»). Se monta DENTRO de «Gradeadas» del bloque de precio, y
// solo cuando alguien lo abre: cada carta que se pregunta por primera vez es
// una petición de pago (la función la guarda una semana y no pregunta por
// cartas de menos de 20 €).
//
// Entra por `import()` desde `engancharVentasGradeadas` (precio-vista.js):
// /carta y la ficha de Mi colección no lo bajan hasta que se abre.
import { escapeHtml } from './html.js'

const fmtEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' })
const VISIBLES = 6

// «hoy», «ayer», «hace 3 días», «hace 2 semanas» o la fecha.
export function cuandoFue(iso, ahora = new Date()) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const dias = Math.floor((ahora.getTime() - t) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

const cifra = (v) => (v.moneda === 'EUR' ? fmtEuros.format(v.precio) : `${v.precio.toLocaleString('es-ES')} ${v.moneda}`)

// Lo puro: la lista, con su fila de casas encima si hay más de una. `casa`
// filtra; sin filtro se ven las seis primeras y «Ver las N».
export function ventasHtml(ventas, { casa = '', todas = false, ahora = new Date() } = {}) {
  const lista = Array.isArray(ventas) ? ventas : []
  if (!lista.length) return '<p class="pv-pie pv-ventas-vacio">No hay ventas recientes de esta carta gradeada en eBay.</p>'
  const casas = [...new Set(lista.map((v) => v.casa))]
  const filtradas = casa ? lista.filter((v) => v.casa === casa) : lista
  const vistas = todas ? filtradas : filtradas.slice(0, VISIBLES)
  const chips = casas.length > 1
    ? `<div class="pv-ventas-casas" role="group" aria-label="Filtrar por casa">${['', ...casas].map((c) => `<button type="button" class="pv-ventas-casa" data-casa-filtro="${escapeHtml(c)}" aria-pressed="${c === casa ? 'true' : 'false'}">${c ? escapeHtml(c) : 'Todas'}</button>`).join('')}</div>`
    : ''
  const filas = vistas.map((v) => {
    const dentro = `<span class="pv-chapa pv-gradeada pv-venta-nota" data-casa="${escapeHtml(v.casa)}"><b>${escapeHtml(v.casa)} ${escapeHtml(v.nota)}</b></span>`
      + `<span class="pv-venta-que"><span class="pv-venta-titulo">${escapeHtml(v.titulo || `${v.casa} ${v.nota}`)}</span><span class="pv-venta-cuando">${escapeHtml(cuandoFue(v.fecha, ahora))}</span></span>`
      + `<span class="pv-venta-precio">${escapeHtml(cifra(v))}</span>`
    return v.enlace
      ? `<li><a class="pv-venta" href="${escapeHtml(v.enlace)}" target="_blank" rel="noopener noreferrer" title="Ver el anuncio en eBay">${dentro}</a></li>`
      : `<li><span class="pv-venta">${dentro}</span></li>`
  }).join('')
  const mas = !todas && filtradas.length > VISIBLES ? `<button type="button" class="btn-secondary pv-ventas-mas" data-ventas-todas>Ver las ${filtradas.length} ventas</button>` : ''
  return `${chips}<ul class="pv-ventas-lista">${filas}</ul>${mas}`
}

// Monta las ventas en el «Gradeadas» abierto. Una vez por carta: se queda
// pintado si se cierra y se vuelve a abrir.
export async function montarVentas(detalles, cardId, { fetchImpl = fetch } = {}) {
  if (!detalles || detalles.dataset.ventasDe === String(cardId)) return
  detalles.dataset.ventasDe = String(cardId)
  let caja = detalles.querySelector('.pv-ventas')
  if (!caja) {
    caja = document.createElement('section')
    caja.className = 'pv-ventas'
    caja.setAttribute('aria-live', 'polite')
    detalles.append(caja)
  }
  caja.innerHTML = '<h4 class="pv-ventas-t">Últimas ventas en eBay</h4><p class="pv-pie">Buscando ventas…</p>'
  let cuerpo = null
  try {
    const res = await fetchImpl(`/.netlify/functions/tcggo-ventas-gradeadas?card=${encodeURIComponent(cardId)}`, { headers: { accept: 'application/json' } })
    cuerpo = res.ok ? await res.json() : null
  } catch { cuerpo = null }
  // La carta pudo cambiar mientras llegaba (pasar de carta en la ficha).
  if (detalles.dataset.ventasDe !== String(cardId)) return
  const ventas = Array.isArray(cuerpo?.ventas) ? cuerpo.ventas : null
  // Sin respuesta, o una carta barata sin nada guardado: no se pinta nada
  // (la frase «no hay ventas» sería mentira si no se ha preguntado).
  if (!ventas || (!ventas.length && !cuerpo?.pedido && !cuerpo?.pedidoAt)) { caja.remove(); return }
  const estado = { casa: '', todas: false }
  const pintar = () => {
    caja.innerHTML = `<h4 class="pv-ventas-t">Últimas ventas en eBay</h4>${ventasHtml(ventas, estado)}<p class="pv-pie">Ventas de cartas gradeadas cerradas en eBay, en euros.</p>`
  }
  pintar()
  caja.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-casa-filtro]')
    if (chip) { estado.casa = chip.dataset.casaFiltro || ''; estado.todas = false; pintar(); return }
    if (e.target.closest('[data-ventas-todas]')) { estado.todas = true; pintar() }
  })
}
