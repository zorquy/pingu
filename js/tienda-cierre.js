// EL CIERRE DEL MES (tanda 1094). Para la gestoría: un PDF de una página con
// lo vendido en el mes, lo que costó, lo que dejó, lo que se compró a
// clientes, cada día, por dónde y lo más vendido; y los CSV de ese mes. Sale
// de lo que ya está apuntado (`tienda_ventas_lista` y `tienda_compras_lista`):
// no hay que escribir nada. Este sí lleva el coste y el beneficio: es para la
// tienda, no para quien compra (el recibo sigue sin ellos).
//
// Entra por `import()` desde Ventas (el botón de exportar abre un menú).
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { nombreDeSet } from './catalogo-series.js'
import { DONDE_VENTA, mesesDeCierre, rangoDeMes, cierreDelMes, csvDeVentas, csvDeCompras, pdfDeImagenes, PUNTOS_POR_MM } from './tiendas-puro.js'

const PX_MM = 8
const C = { papel: '#ffffff', tinta: '#0d1b2a', suave: '#52717f', raya: '#e1eaee', fondo: '#e1f0f4', barra: '#0b7285', verde: '#0d9e6e', rojo: '#dc2626' }
const LETRA = 'Inter, system-ui, sans-serif'
const TITULO = 'Outfit, Inter, system-ui, sans-serif'
const NOMBRE_DONDE = Object.fromEntries(DONDE_VENTA)
let dialogo = null
const sets = new Map()

async function completarSets(filas) {
  const faltan = [...new Set(filas.map((f) => f.set_id).filter((id) => id && !sets.has(id)))]
  if (!faltan.length) return
  const { data } = await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', faltan)
  for (const s of data || []) sets.set(s.id, nombreDeSet(s) || s.id)
}
const nombreSet = (id) => sets.get(id) || id || ''

// Lo del mes, de la base. Sin la migración de compras, sin compras (no es un
// error del cierre).
export async function datosDelMes(clave) {
  const { desde, hasta } = rangoDeMes(clave)
  const [v, c] = await Promise.all([
    supabase.rpc('tienda_ventas_lista', { p_filtros: { desde, hasta }, p_desde: 0, p_cuantas: 5000 }),
    supabase.rpc('tienda_compras_lista', { p_filtros: { desde, hasta }, p_desde: 0, p_cuantas: 5000 }),
  ])
  if (v.error || !v.data) throw v.error || new Error('sin ventas')
  const ventas = v.data.filas || []
  const compras = c.error ? null : c.data?.filas || []
  await completarSets([...ventas, ...(compras || [])])
  return { ventas, compras, incompleto: (v.data.total || 0) > ventas.length }
}

function cortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

// La página A4, en un lienzo.
export async function dibujarCierre({ cuentas, perfil, tienda, mes, incompleto = false }) {
  const W = 210 * PX_MM
  const H = 297 * PX_MM
  const mm = (v) => v * PX_MM
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  try { await document.fonts?.ready } catch {}
  ctx.fillStyle = C.papel
  ctx.fillRect(0, 0, W, H)
  const M = 16 // margen, en mm
  const dentro = 210 - M * 2
  ctx.textBaseline = 'alphabetic'
  // La cabecera.
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, W, mm(38))
  ctx.fillStyle = C.tinta
  ctx.font = `800 ${mm(8)}px ${TITULO}`
  ctx.fillText(`Cierre de ${mes}`, mm(M), mm(19))
  ctx.fillStyle = C.suave
  ctx.font = `500 ${mm(3.6)}px ${LETRA}`
  const quien = [perfil?.display_name || perfil?.username, tienda?.direccion, tienda?.ciudad].filter(Boolean).join(' · ')
  ctx.fillText(cortar(ctx, quien, mm(dentro)), mm(M), mm(28))
  // Las cuatro cifras.
  const cifras = [
    ['Vendido', euros(cuentas.importe), `${cuentas.ventas} ${cuentas.ventas === 1 ? 'venta' : 'ventas'} · ${cuentas.unidades} uds.`],
    ['Coste de lo vendido', euros(cuentas.coste), cuentas.sinCoste ? `${cuentas.sinCoste} sin coste, fuera` : 'lo que pagaste'],
    ['Beneficio', `${cuentas.beneficio > 0 ? '+' : ''}${euros(cuentas.beneficio)}`, cuentas.margen != null ? `${cuentas.margen} % sobre lo pagado` : '—'],
    ['Comprado', euros(cuentas.comprado), `${cuentas.compras} ${cuentas.compras === 1 ? 'compra' : 'compras'} · ${cuentas.unidadesCompradas} uds.`],
  ]
  const ancho = (dentro - 3 * 4) / 4
  cifras.forEach(([t, v, s], i) => {
    const x = M + i * (ancho + 4)
    ctx.strokeStyle = C.raya
    ctx.lineWidth = mm(0.3)
    ctx.strokeRect(mm(x), mm(46), mm(ancho), mm(26))
    ctx.fillStyle = C.suave
    ctx.font = `700 ${mm(2.6)}px ${LETRA}`
    ctx.fillText(t.toUpperCase(), mm(x + 3), mm(52))
    ctx.fillStyle = i === 2 ? (cuentas.beneficio < 0 ? C.rojo : C.verde) : C.tinta
    ctx.font = `800 ${mm(6)}px ${TITULO}`
    ctx.fillText(cortar(ctx, v, mm(ancho - 6)), mm(x + 3), mm(61))
    ctx.fillStyle = C.suave
    ctx.font = `500 ${mm(2.4)}px ${LETRA}`
    ctx.fillText(cortar(ctx, s, mm(ancho - 6)), mm(x + 3), mm(68))
  })
  // Cada día.
  ctx.fillStyle = C.tinta
  ctx.font = `700 ${mm(4.2)}px ${TITULO}`
  ctx.fillText('Vendido cada día', mm(M), mm(86))
  const maximo = Math.max(1, ...cuentas.porDia.map((d) => d.importe))
  const alto = 40
  const base = 132
  const paso = dentro / cuentas.porDia.length
  cuentas.porDia.forEach((d, i) => {
    const h = (d.importe / maximo) * alto
    ctx.fillStyle = C.barra
    if (h > 0) ctx.fillRect(mm(M + i * paso + paso * 0.15), mm(base - h), mm(paso * 0.7), mm(h))
    if (i === 0 || (i + 1) % 5 === 0) {
      ctx.fillStyle = C.suave
      ctx.font = `500 ${mm(2.2)}px ${LETRA}`
      ctx.textAlign = 'center'
      ctx.fillText(String(d.dia), mm(M + i * paso + paso / 2), mm(base + 4))
      ctx.textAlign = 'left'
    }
  })
  ctx.fillStyle = C.raya
  ctx.fillRect(mm(M), mm(base), mm(dentro), mm(0.3))
  const mejor = cuentas.porDia.reduce((a, b) => (b.importe > a.importe ? b : a), cuentas.porDia[0] || { importe: 0 })
  if (mejor?.importe > 0) {
    ctx.fillStyle = C.suave
    ctx.font = `500 ${mm(2.4)}px ${LETRA}`
    ctx.textAlign = 'right'
    ctx.fillText(`El mejor día, el ${mejor.dia}: ${euros(mejor.importe)}`, mm(210 - M), mm(86))
    ctx.textAlign = 'left'
  }
  // Por dónde y lo más vendido, en dos columnas.
  const col = (dentro - 8) / 2
  const tabla = (x, y, titulo, cabecera, filas) => {
    ctx.fillStyle = C.tinta
    ctx.font = `700 ${mm(4.2)}px ${TITULO}`
    ctx.fillText(titulo, mm(x), mm(y))
    ctx.fillStyle = C.suave
    ctx.font = `700 ${mm(2.4)}px ${LETRA}`
    ctx.fillText(cabecera[0].toUpperCase(), mm(x), mm(y + 8))
    ctx.textAlign = 'right'
    ctx.fillText(cabecera[1].toUpperCase(), mm(x + col - 22), mm(y + 8))
    ctx.fillText(cabecera[2].toUpperCase(), mm(x + col), mm(y + 8))
    ctx.textAlign = 'left'
    let yy = y + 14
    for (const f of filas) {
      ctx.fillStyle = C.raya
      ctx.fillRect(mm(x), mm(yy - 4.4), mm(col), mm(0.2))
      ctx.fillStyle = C.tinta
      ctx.font = `500 ${mm(3)}px ${LETRA}`
      ctx.fillText(cortar(ctx, f[0], mm(col - 44)), mm(x), mm(yy))
      ctx.textAlign = 'right'
      ctx.fillText(String(f[1]), mm(x + col - 22), mm(yy))
      ctx.font = `700 ${mm(3)}px ${LETRA}`
      ctx.fillText(f[2], mm(x + col), mm(yy))
      ctx.textAlign = 'left'
      yy += 7
    }
    if (!filas.length) {
      ctx.fillStyle = C.suave
      ctx.font = `500 ${mm(3)}px ${LETRA}`
      ctx.fillText('Nada este mes.', mm(x), mm(yy))
    }
  }
  tabla(M, 152, 'Por dónde', ['Dónde', 'Ventas', 'Importe'], Object.entries(cuentas.porDonde).sort((a, b) => b[1].importe - a[1].importe).map(([d, v]) => [NOMBRE_DONDE[d] || d, v.ventas, euros(v.importe)]))
  tabla(M + col + 8, 152, 'Lo más vendido', ['Carta', 'Uds.', 'Importe'], cuentas.top.map((t) => [[t.nombre, t.set_id ? nombreSet(t.set_id) : '', t.numero].filter(Boolean).join(' · '), t.unidades, euros(t.importe)]))
  // El pie.
  ctx.fillStyle = C.raya
  ctx.fillRect(mm(M), mm(279), mm(dentro), mm(0.3))
  ctx.fillStyle = C.suave
  ctx.font = `500 ${mm(2.4)}px ${LETRA}`
  ctx.fillText(`Hecho el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} con lo apuntado en PokeDoc.${incompleto ? ' Solo las 5.000 primeras líneas del mes.' : ''}`, mm(M), mm(285))
  ctx.textAlign = 'right'
  ctx.font = `700 ${mm(3.6)}px ${TITULO}`
  ctx.fillStyle = C.tinta
  ctx.fillText('PokeDoc', mm(210 - M), mm(285))
  ctx.textAlign = 'left'
  return c
}

const comoJpeg = (c) => new Promise((ok, mal) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a)), mal) : mal(new Error('sin imagen'))), 'image/jpeg', 0.92))

function bajar(contenido, tipo, nombre) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export async function abrirCierre({ perfil, tienda = null }) {
  hojaInyectada('css/tienda-vender.css')
  // Dónde está, para la cabecera del PDF (si no se ha dado).
  if (!tienda && perfil?.id) tienda = (await supabase.from('tiendas').select('ciudad,direccion').eq('user_id', perfil.id).maybeSingle().then((r) => r.data, () => null)) || null
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdv tdcm'
    dialogo.setAttribute('aria-labelledby', 'tdcmTitulo')
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo || e.target.closest('[data-tdcm="cerrar"]')) dialogo.close() })
  }
  const meses = mesesDeCierre()
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab"><h2 id="tdcmTitulo">Cierre del mes</h2><button type="button" class="tdv-cerrar" data-tdcm="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="tdv-cuerpo">
        <label class="tdc-campo">El mes<select class="tdvt-select tdcm-mes" data-mes>${meses.map((m) => `<option value="${m.clave}">${escapeHtml(m.nombre)}</option>`).join('')}</select></label>
        <div class="tdcm-resumen" data-resumen><p class="tdc-cm">Calculando…</p></div>
        <p class="tdc-cm">Para la gestoría: sí lleva lo que costó y lo que dejó. El recibo de un cliente sigue sin llevarlo.</p>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" data-error role="alert"></p>
        <div class="tdcm-botones"><button type="button" class="btn-primary" data-tdcm="pdf" disabled>Descargar PDF</button><button type="button" class="btn-secondary" data-tdcm="csv" disabled>CSV de las ventas</button><button type="button" class="btn-secondary" data-tdcm="csv-compras" hidden>CSV de las compras</button></div>
      </footer>
    </div>`
  const $ = (s) => dialogo.querySelector(s)
  let datos = null
  let cuentas = null
  let version = 0
  const cargar = async () => {
    const yo = ++version
    const clave = $('[data-mes]').value
    $('[data-resumen]').innerHTML = '<p class="tdc-cm">Calculando…</p>'
    for (const b of dialogo.querySelectorAll('.tdcm-botones button')) b.disabled = true
    try {
      const d = await datosDelMes(clave)
      if (yo !== version) return
      datos = d
      cuentas = cierreDelMes(d.ventas, d.compras || [], clave)
      $('[data-resumen]').innerHTML = `
        <div class="tdcm-cifras">
          <span><small>Vendido</small><b>${euros(cuentas.importe)}</b><em>${cuentas.ventas} ${cuentas.ventas === 1 ? 'venta' : 'ventas'}</em></span>
          <span><small>Coste</small><b>${euros(cuentas.coste)}</b><em>${cuentas.sinCoste ? `${cuentas.sinCoste} sin coste` : 'de lo vendido'}</em></span>
          <span><small>Beneficio</small><b class="${cuentas.beneficio < 0 ? 'tdv-rojo' : 'tdv-verde'}">${cuentas.beneficio > 0 ? '+' : ''}${euros(cuentas.beneficio)}</b><em>${cuentas.margen != null ? `${cuentas.margen} %` : '—'}</em></span>
          <span><small>Comprado</small><b>${d.compras ? euros(cuentas.comprado) : '—'}</b><em>${d.compras ? `${cuentas.compras} ${cuentas.compras === 1 ? 'compra' : 'compras'}` : 'sin compras apuntadas'}</em></span>
        </div>`
      $('[data-tdcm="pdf"]').disabled = false
      $('[data-tdcm="csv"]').disabled = !d.ventas.length
      $('[data-tdcm="csv-compras"]').hidden = !d.compras?.length
      $('[data-tdcm="csv-compras"]').disabled = false
    } catch {
      if (yo === version) $('[data-resumen]').innerHTML = '<p class="tdc-cm">No se han podido traer las ventas de ese mes. Recarga la página.</p>'
    }
  }
  dialogo.onchange = (e) => { if (e.target.matches('[data-mes]')) cargar() }
  dialogo.onclick = async (e) => {
    const que = e.target.closest('[data-tdcm]')?.dataset.tdcm
    if (!que || que === 'cerrar' || !datos) return
    const clave = $('[data-mes]').value
    const quien = perfil?.username || 'tienda'
    if (que === 'csv') return bajar(`﻿${csvDeVentas(datos.ventas, nombreSet)}`, 'text/csv;charset=utf-8', `ventas-${quien}-${clave}.csv`)
    if (que === 'csv-compras') return bajar(`﻿${csvDeCompras(datos.compras || [], nombreSet)}`, 'text/csv;charset=utf-8', `compras-${quien}-${clave}.csv`)
    if (que === 'pdf') {
      const boton = e.target.closest('[data-tdcm]')
      boton.disabled = true
      try {
        const mes = meses.find((m) => m.clave === clave)?.nombre || clave
        const lienzo = await dibujarCierre({ cuentas, perfil, tienda, mes, incompleto: datos.incompleto })
        const pdf = pdfDeImagenes([{ jpeg: await comoJpeg(lienzo), ancho: lienzo.width, alto: lienzo.height }], { anchoPt: Math.round(210 * PUNTOS_POR_MM * 100) / 100, altoPt: Math.round(297 * PUNTOS_POR_MM * 100) / 100 })
        bajar(pdf, 'application/pdf', `cierre-${quien}-${clave}.pdf`)
      } catch {
        $('[data-error]').textContent = 'No se ha podido hacer el PDF.'
      }
      boton.disabled = false
    }
  }
  if (!dialogo.open) dialogo.showModal()
  cargar().catch(() => showToast('No se ha podido calcular el cierre.', 'error'))
}
