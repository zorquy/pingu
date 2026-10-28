// El recibo de una venta (tanda 1084): una imagen con la tienda, lo vendido,
// el total y su enlace, para mandarla por WhatsApp o Instagram, o en PDF
// para imprimir. Sale del ticket (`tienda_ventas`, que solo ve su tienda) y
// NUNCA lleva el coste ni el beneficio: es para quien compra.
//
// Entra por `import()` desde el aviso de una venta («Recibo») y desde
// Ventas. Un lienzo pinta con colores fijos: el recibo es un papel, igual
// en el tema claro que en el oscuro.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { showToast } from './toast.js'
import { getSession, getProfile } from './app.js'
import { euros } from './cardmarket.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { cargarImagen, redondeado, comoBlob, descargarLienzo } from './imagen-compartir.js'
import { cuentaDeRecibo, pdfDeJpeg, DONDE_VENTA } from './tiendas-puro.js'

const ANCHO = 1080
const C = { papel: '#ffffff', tinta: '#0d1b2a', suave: '#52717f', raya: '#e1eaee', marca: '#1e5175', fondo: '#e1f0f4' }
const LETRA = 'Inter, system-ui, sans-serif'
const TITULO = 'Outfit, Inter, system-ui, sans-serif'

async function datosDelTicket(ticket) {
  const { data: lineas, error } = await supabase.from('tienda_ventas')
    .select('id,ticket,card_id,market,product_id,idioma,estado,variante,gradeo,unidades,precio,donde,vendida_el')
    .eq('ticket', ticket).order('created_at')
  if (error || !lineas?.length) return null
  const ids = [...new Set(lineas.filter((l) => l.card_id).map((l) => l.card_id))]
  const prods = [...new Set(lineas.filter((l) => l.product_id).map((l) => l.product_id))]
  const [cartas, productos] = await Promise.all([
    ids.length ? supabase.from('tcg_cards').select('id,name,name_es,set_id,local_id,market').in('id', ids).then((r) => r.data || []) : [],
    prods.length ? supabase.from('tcg_products').select('id,name').in('id', prods).then((r) => r.data || []) : [],
  ])
  const setIds = [...new Set(cartas.map((c) => c.set_id).filter(Boolean))]
  const sets = setIds.length ? (await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', setIds)).data || [] : []
  const porCarta = new Map(cartas.map((c) => [c.id, c]))
  const porProducto = new Map(productos.map((p) => [String(p.id), p]))
  const porSet = new Map(sets.map((s) => [s.id, nombreDeSet(s) || s.id]))
  return lineas.map((l) => {
    const c = l.card_id ? porCarta.get(l.card_id) : null
    const nombre = c ? nombreDeCarta(c) : porProducto.get(String(l.product_id))?.name || 'Producto'
    const detalle = l.product_id
      ? ['Sellado', String(l.idioma || '').toUpperCase()].filter(Boolean).join(' · ')
      : [c?.set_id ? porSet.get(c.set_id) : '', c?.local_id, String(l.idioma || '').toUpperCase(), l.estado, l.variante && l.variante !== 'normal' ? nombreDeVariante(l.variante) : '', l.gradeo || ''].filter(Boolean).join(' · ')
    return { ...l, nombre, detalle }
  })
}

// Corta un texto al ancho que cabe, con «…».
function cortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

export async function dibujarRecibo({ lineas, perfil, tienda }) {
  const { filas, total, unidades } = cuentaDeRecibo(lineas)
  const alto = 520 + filas.length * 112 + 300
  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  try { await document.fonts?.ready } catch {}
  ctx.fillStyle = C.papel
  ctx.fillRect(0, 0, ANCHO, alto)
  // La banda de arriba, con el logo y el nombre.
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, ANCHO, 260)
  const nombre = perfil.display_name || perfil.username || 'Tienda'
  let logo = null
  if (perfil.avatar_url) logo = await cargarImagen(perfil.avatar_url).catch(() => null)
  ctx.save()
  redondeado(ctx, 72, 64, 132, 132, 28)
  ctx.clip()
  if (logo) ctx.drawImage(logo, 72, 64, 132, 132)
  else {
    ctx.fillStyle = C.marca
    ctx.fillRect(72, 64, 132, 132)
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 64px ${TITULO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(nombre.slice(0, 1).toUpperCase(), 138, 132)
  }
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.tinta
  ctx.font = `700 54px ${TITULO}`
  ctx.fillText(cortar(ctx, nombre, ANCHO - 300), 236, 132)
  ctx.fillStyle = C.suave
  ctx.font = `500 30px ${LETRA}`
  const donde = [tienda?.direccion, tienda?.ciudad].filter(Boolean).join(', ') || `@${perfil.username || ''}`
  ctx.fillText(cortar(ctx, donde, ANCHO - 300), 236, 180)

  // Qué es, cuándo y su número.
  const primera = filas[0]
  const fecha = new Date(primera.vendida_el)
  ctx.fillStyle = C.tinta
  ctx.font = `700 40px ${TITULO}`
  ctx.fillText('Recibo', 72, 340)
  ctx.textAlign = 'right'
  ctx.fillStyle = C.suave
  ctx.font = `500 28px ${LETRA}`
  ctx.fillText(`${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · ${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, ANCHO - 72, 326)
  ctx.fillText(`N.º ${String(primera.ticket).slice(0, 8).toUpperCase()}`, ANCHO - 72, 364)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.raya
  ctx.fillRect(72, 410, ANCHO - 144, 2)

  // Las líneas.
  let y = 470
  for (const l of filas) {
    ctx.fillStyle = C.tinta
    ctx.font = `600 34px ${LETRA}`
    ctx.fillText(cortar(ctx, l.nombre, ANCHO - 460), 72, y)
    ctx.fillStyle = C.suave
    ctx.font = `500 26px ${LETRA}`
    ctx.fillText(cortar(ctx, l.detalle, ANCHO - 460), 72, y + 40)
    ctx.textAlign = 'right'
    ctx.fillStyle = C.tinta
    ctx.font = `700 34px ${LETRA}`
    ctx.fillText(euros(l.importe), ANCHO - 72, y)
    if (l.unidades > 1) {
      ctx.fillStyle = C.suave
      ctx.font = `500 26px ${LETRA}`
      ctx.fillText(`${l.unidades} × ${euros(l.precio)}`, ANCHO - 72, y + 40)
    }
    ctx.textAlign = 'left'
    y += 112
  }

  // El total.
  ctx.fillStyle = C.raya
  ctx.fillRect(72, y - 40, ANCHO - 144, 2)
  ctx.fillStyle = C.suave
  ctx.font = `600 30px ${LETRA}`
  ctx.fillText(`Total · ${unidades} ${unidades === 1 ? 'artículo' : 'artículos'}`, 72, y + 30)
  ctx.textAlign = 'right'
  ctx.fillStyle = C.tinta
  ctx.font = `800 64px ${TITULO}`
  ctx.fillText(euros(total), ANCHO - 72, y + 40)
  ctx.textAlign = 'left'
  const NOMBRE_DONDE = Object.fromEntries(DONDE_VENTA)
  if (primera.donde && primera.donde !== 'otro') {
    ctx.fillStyle = C.suave
    ctx.font = `500 26px ${LETRA}`
    ctx.fillText(`Venta: ${String(NOMBRE_DONDE[primera.donde] || primera.donde).toLowerCase()}`, 72, y + 74)
  }

  // Abajo, el enlace a su escaparate y la marca.
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, alto - 150, ANCHO, 150)
  ctx.fillStyle = C.tinta
  ctx.font = `600 30px ${LETRA}`
  ctx.fillText('¡Gracias por tu compra!', 72, alto - 86)
  ctx.fillStyle = C.marca
  ctx.font = `500 26px ${LETRA}`
  ctx.fillText(`pokedoc.es/usuario/${perfil.username || ''}`, 72, alto - 46)
  ctx.textAlign = 'right'
  ctx.font = `700 34px ${TITULO}`
  ctx.fillStyle = C.tinta
  ctx.fillText('Poke', ANCHO - 72 - ctx.measureText('Doc').width, alto - 62)
  ctx.fillStyle = C.marca
  ctx.fillText('Doc', ANCHO - 72, alto - 62)
  ctx.textAlign = 'left'
  return lienzo
}

function comoJpeg(lienzo) {
  return new Promise((resolve, reject) => {
    try {
      lienzo.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error('sin imagen'))), 'image/jpeg', 0.92)
    } catch (err) {
      reject(err)
    }
  })
}

let dialogo = null

export async function abrirRecibo(ticket) {
  hojaInyectada('css/tienda-vender.css')
  const sesion = await getSession()
  if (!sesion) return
  const [lineas, perfil, tienda] = await Promise.all([
    datosDelTicket(ticket),
    getProfile(sesion.user.id),
    supabase.from('tiendas').select('ciudad,direccion').eq('user_id', sesion.user.id).maybeSingle().then((r) => r.data || null),
  ])
  if (!lineas || !perfil) return showToast('No se ha encontrado esa venta.', 'error')
  const lienzo = await dibujarRecibo({ lineas, perfil, tienda })
  const nombreFichero = `recibo-${String(ticket).slice(0, 8)}`
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdr'
    dialogo.setAttribute('aria-labelledby', 'tdrTitulo')
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo || e.target.closest('[data-tdr="cerrar"]')) dialogo.close() })
  }
  const total = cuentaDeRecibo(lineas).total
  dialogo.innerHTML = `
    <div class="tdr-caja">
      <header class="tdr-cab"><h2 id="tdrTitulo">Recibo · ${escapeHtml(euros(total))}</h2><button type="button" class="tdv-cerrar" data-tdr="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="tdr-vista"><img alt="El recibo de la venta" width="${lienzo.width}" height="${lienzo.height}" /></div>
      <p class="tdr-nota">Sin lo que te costó ni lo que ganas: es para quien compra.</p>
      <footer class="tdr-botones">
        <button type="button" class="btn-primary" data-tdr="compartir">Compartir…</button>
        <button type="button" class="btn-secondary" data-tdr="imagen">Descargar imagen</button>
        <button type="button" class="btn-secondary" data-tdr="pdf">PDF para imprimir</button>
      </footer>
    </div>`
  comoBlob(lienzo).then((b) => {
    const img = dialogo.querySelector('.tdr-vista img')
    img.src = URL.createObjectURL(b)
  }).catch(() => {})
  dialogo.onclick = async (e) => {
    const que = e.target.closest('[data-tdr]')?.dataset.tdr
    if (que === 'imagen') return descargarLienzo(lienzo, `${nombreFichero}.png`)
    if (que === 'pdf') {
      try {
        const pdf = pdfDeJpeg(await comoJpeg(lienzo), lienzo.width, lienzo.height)
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
        a.download = `${nombreFichero}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      } catch {
        showToast('No se ha podido hacer el PDF.', 'error')
      }
      return
    }
    if (que === 'compartir') {
      // Por el menú del sistema (WhatsApp, Instagram…); sin él, se descarga.
      try {
        const fichero = new File([await comoBlob(lienzo)], `${nombreFichero}.png`, { type: 'image/png' })
        if (navigator.canShare?.({ files: [fichero] })) await navigator.share({ files: [fichero], text: `Recibo de ${perfil.display_name || perfil.username}` })
        else await descargarLienzo(lienzo, `${nombreFichero}.png`)
      } catch (err) {
        if (err?.name !== 'AbortError') showToast('No se ha podido compartir. Prueba a descargarlo.', 'error')
      }
    }
  }
  if (!dialogo.open) dialogo.showModal()
  return lienzo
}
