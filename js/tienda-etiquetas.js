// ETIQUETAS PARA IMPRIMIR (tanda 1093). Se marcan cartas en el Stock y sale
// un PDF de etiquetas: el nombre, la colección y el número, el idioma y el
// estado, el precio en grande (con la oferta, el de antes tachado) y un QR que
// abre esa carta en el escaparate de la tienda. En la hoja A4 de 24 de
// papelería o una por página para impresora de etiquetas. Nunca el coste.
//
// Cada página se dibuja en un lienzo y va al PDF como JPEG (`pdfDeImagenes`,
// sin librerías). Entra por `import()` desde «Seleccionar» del Stock.
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { matrizQR } from './qr.js'
import { FORMATOS_ETIQUETA, PUNTOS_POR_MM, etiquetasDeLineas, colocarEtiquetas, pdfDeImagenes, ofertaDe, precioQueCuenta } from './tiendas-puro.js'

const PX_MM = 8 // 203 ppp: lo de una impresora de etiquetas, y de sobra en A4
const C = { tinta: '#0d1b2a', suave: '#52717f', raya: '#c9dbe2' }
const LETRA = 'Inter, system-ui, sans-serif'
const TITULO = 'Outfit, Inter, system-ui, sans-serif'
const CLAVE = 'pd-tienda-etiquetas'
let dialogo = null

function recordado() {
  try { return { formato: 'a4', porUnidad: true, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') } } catch { return { formato: 'a4', porUnidad: true } }
}

// Corta un texto al ancho que cabe, con «…».
function cortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

// Hasta dos renglones; el segundo, cortado.
function renglones(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return [texto]
  const palabras = texto.split(/\s+/)
  let uno = ''
  let i = 0
  while (i < palabras.length && ctx.measureText(`${uno ? `${uno} ` : ''}${palabras[i]}`).width <= ancho) uno = `${uno ? `${uno} ` : ''}${palabras[i++]}`
  if (!uno) return [cortar(ctx, texto, ancho)]
  return [uno, cortar(ctx, palabras.slice(i).join(' '), ancho)]
}

function pintarQR(ctx, texto, x, y, lado) {
  const m = matrizQR(texto)
  const n = m.length + 2 // un poco de margen blanco alrededor
  const paso = lado / n
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, lado, lado)
  ctx.fillStyle = C.tinta
  m.forEach((fila, j) => fila.forEach((v, i) => { if (v) ctx.fillRect(Math.floor(x + (i + 1) * paso), Math.floor(y + (j + 1) * paso), Math.ceil(paso), Math.ceil(paso)) }))
}

// Una etiqueta, en mm desde (x, y), de ancho w y alto h.
export function dibujarEtiqueta(ctx, e, { x, y, w, h, enlace }) {
  const mm = (v) => v * PX_MM
  const pad = 2.5
  const qr = Math.min(h - pad * 2, w * 0.36)
  const texto = w - pad * 3 - qr
  const X = mm(x + pad)
  pintarQR(ctx, enlace, mm(x + w - pad - qr), mm(y + (h - qr) / 2), mm(qr))
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  // El nombre, en uno o dos renglones.
  ctx.fillStyle = C.tinta
  ctx.font = `700 ${mm(h > 32 ? 3.6 : 3.1)}px ${LETRA}`
  const lineas = renglones(ctx, e.nombre || 'Producto', mm(texto))
  let Y = mm(y + pad + (h > 32 ? 3.6 : 3.1))
  for (const l of lineas) {
    ctx.fillText(l, X, Y)
    Y += mm(h > 32 ? 4.2 : 3.6)
  }
  // Colección · número · idioma · estado · versión.
  ctx.fillStyle = C.suave
  ctx.font = `500 ${mm(2.4)}px ${LETRA}`
  ctx.fillText(cortar(ctx, e.detalle, mm(texto)), X, Y + mm(0.2))
  // El precio, abajo y en grande; con oferta, el de antes tachado encima.
  const o = ofertaDe(e)
  const precio = precioQueCuenta(e)
  const abajo = mm(y + h - pad)
  if (o && o.antes != null) {
    ctx.fillStyle = C.suave
    ctx.font = `500 ${mm(2.6)}px ${LETRA}`
    const antes = euros(o.antes)
    const ya = abajo - mm(h > 32 ? 7.6 : 6.6)
    ctx.fillText(antes, X, ya)
    const ancho = ctx.measureText(antes).width
    ctx.fillRect(X, ya - mm(0.95), ancho, Math.max(1, mm(0.25)))
  }
  ctx.fillStyle = C.tinta
  ctx.font = `800 ${mm(h > 32 ? 7 : 6)}px ${TITULO}`
  ctx.fillText(cortar(ctx, precio != null ? euros(precio) : '—', mm(texto)), X, abajo)
}

// El detalle de una línea en una etiqueta: el código de la colección si lo
// hay (cabe mejor que el nombre), el número, el idioma, el estado y la versión.
export function detalleDeEtiqueta(f, { codigo = '', nombreSet = '' } = {}) {
  if (f.product_id) return ['Sellado', String(f.idioma || '').toUpperCase()].filter(Boolean).join(' · ')
  return [codigo || nombreSet, f.numero, String(f.idioma || '').toUpperCase(), f.estado, f.variante && f.variante !== 'normal' ? nombreDeVariante(f.variante) : '', f.gradeo || ''].filter(Boolean).join(' · ')
}

// Las páginas, cada una un lienzo.
export async function dibujarPaginas(etiquetas, { formato = 'a4', saltar = 0, enlaceDe }) {
  const f = FORMATOS_ETIQUETA[formato] || FORMATOS_ETIQUETA.a4
  const { sitios, paginas } = colocarEtiquetas(etiquetas.length, formato, saltar)
  try { await document.fonts?.ready } catch {}
  const lienzos = Array.from({ length: paginas }, () => {
    const c = document.createElement('canvas')
    c.width = Math.round(f.paginaMm[0] * PX_MM)
    c.height = Math.round(f.paginaMm[1] * PX_MM)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    return c
  })
  etiquetas.forEach((e, i) => {
    const s = sitios[i]
    const ctx = lienzos[s.pagina].getContext('2d')
    dibujarEtiqueta(ctx, e, { x: s.x, y: s.y, w: f.anchoMm, h: f.altoMm, enlace: enlaceDe(e) })
    // En la hoja, una raya muy suave donde corta la etiqueta (ayuda a cuadrar
    // al imprimir en papel normal; en la de etiquetas cae en el corte).
    if (formato === 'a4') {
      ctx.strokeStyle = C.raya
      ctx.lineWidth = 1
      ctx.strokeRect(s.x * PX_MM + 0.5, s.y * PX_MM + 0.5, f.anchoMm * PX_MM - 1, f.altoMm * PX_MM - 1)
    }
  })
  return lienzos
}

const comoJpeg = (c) => new Promise((ok, mal) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a)), mal) : mal(new Error('sin imagen'))), 'image/jpeg', 0.92))

export async function pdfDeEtiquetas(etiquetas, opciones) {
  const f = FORMATOS_ETIQUETA[opciones.formato] || FORMATOS_ETIQUETA.a4
  const lienzos = await dibujarPaginas(etiquetas, opciones)
  const paginas = []
  for (const c of lienzos) paginas.push({ jpeg: await comoJpeg(c), ancho: c.width, alto: c.height })
  return { pdf: pdfDeImagenes(paginas, { anchoPt: Math.round(f.paginaMm[0] * PUNTOS_POR_MM * 100) / 100, altoPt: Math.round(f.paginaMm[1] * PUNTOS_POR_MM * 100) / 100 }), paginas: lienzos.length, primera: lienzos[0] }
}

// `filas`: las líneas marcadas, ya con su `nombre` y su `detalle`. `enlaceDe`:
// a dónde lleva el QR de cada una.
export function abrirEtiquetas({ filas, enlaceDe, nombreFichero = 'etiquetas' }) {
  if (!filas?.length) return
  hojaInyectada('css/tienda-vender.css')
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdv tde'
    dialogo.setAttribute('aria-labelledby', 'tdeTitulo')
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo || e.target.closest('[data-tde="cerrar"]')) dialogo.close() })
  }
  const op = recordado()
  let saltar = 0
  dialogo.innerHTML = `
    <div class="tdv-caja">
      <header class="tdv-cab"><h2 id="tdeTitulo">Etiquetas</h2><button type="button" class="tdv-cerrar" data-tde="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="tdv-cuerpo">
        <div class="tdv-donde" role="group" aria-label="Formato">${Object.entries(FORMATOS_ETIQUETA).map(([id, f]) => `<button type="button" class="tdv-chip" data-formato="${id}" aria-pressed="${id === op.formato}">${escapeHtml(f.nombre)}</button>`).join('')}</div>
        <label class="tds-check-label"><input type="checkbox" data-por-unidad ${op.porUnidad ? 'checked' : ''} /> Una por cada unidad (para las fundas)</label>
        <label class="tdc-campo tde-saltar">Empezar en la etiqueta (de una hoja empezada)<input type="number" inputmode="numeric" min="1" max="24" step="1" value="1" data-saltar /></label>
        <p class="tdc-cm" data-cuenta></p>
        <div class="tde-vista"><img alt="Cómo queda la primera página" data-vista /></div>
        <p class="tdc-cm">El QR abre esa carta en tu escaparate. Ninguna lleva lo que te costó.</p>
      </div>
      <footer class="tdv-pie"><p class="tdv-error" data-error role="alert"></p><button type="button" class="btn-primary tdv-vendida" data-tde="pdf">Descargar PDF</button></footer>
    </div>`
  const $ = (s) => dialogo.querySelector(s)
  let ultimo = null
  let version = 0
  const repintar = async () => {
    const yo = ++version
    const etiquetas = etiquetasDeLineas(filas, { porUnidad: op.porUnidad })
    const f = FORMATOS_ETIQUETA[op.formato]
    $('.tde-saltar').hidden = op.formato !== 'a4'
    const { paginas } = colocarEtiquetas(etiquetas.length, op.formato, saltar)
    $('[data-cuenta]').textContent = `${etiquetas.length} ${etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'} · ${paginas} ${paginas === 1 ? 'página' : 'páginas'}${op.formato === 'a4' ? ` de ${f.cols * f.filas}` : ''}.`
    for (const b of dialogo.querySelectorAll('[data-formato]')) b.setAttribute('aria-pressed', String(b.dataset.formato === op.formato))
    try { localStorage.setItem(CLAVE, JSON.stringify(op)) } catch {}
    const [primera] = await dibujarPaginas(etiquetas.slice(0, op.formato === 'a4' ? Math.max(0, 24 - saltar) : 1), { formato: op.formato, saltar, enlaceDe })
    if (yo !== version || !primera) return
    primera.toBlob((b) => {
      if (!b || yo !== version) return
      if (ultimo) URL.revokeObjectURL(ultimo)
      ultimo = URL.createObjectURL(b)
      $('[data-vista]').src = ultimo
    }, 'image/png')
  }
  dialogo.onclick = async (e) => {
    const fb = e.target.closest('[data-formato]')
    if (fb) { op.formato = fb.dataset.formato; return repintar() }
    if (!e.target.closest('[data-tde="pdf"]')) return
    const boton = e.target.closest('[data-tde="pdf"]')
    boton.disabled = true
    try {
      const { pdf } = await pdfDeEtiquetas(etiquetasDeLineas(filas, { porUnidad: op.porUnidad }), { formato: op.formato, saltar, enlaceDe })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
      a.download = `${nombreFichero}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch {
      $('[data-error]').textContent = 'No se ha podido hacer el PDF.'
    }
    boton.disabled = false
  }
  dialogo.onchange = (e) => {
    if (e.target.matches('[data-por-unidad]')) { op.porUnidad = e.target.checked; repintar() }
    if (e.target.matches('[data-saltar]')) { saltar = Math.max(0, Math.min(23, (Number(e.target.value) || 1) - 1)); repintar() }
  }
  if (!dialogo.open) dialogo.showModal()
  repintar().catch(() => showToast('No se ha podido dibujar la vista previa.', 'error'))
}
