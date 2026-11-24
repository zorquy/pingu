// ── El cartel del modo evento (tanda 1428, «C» de «Modo evento y QR») ──
//
// PINGU, con un evento en un mes: «quiero decirle a la gente que use pokedoc
// para los eventos». Un A4 para las mesas y la entrada: «¿Cambias cartas hoy?
// Enseña tu QR», tres pasos y un QR a /evento. Genérico o con el nombre, la
// fecha y la ciudad de un evento de la agenda (/admin → Eventos).
//
// Se dibuja en un lienzo y va al PDF como JPEG con `pdfDeImagenes` (la norma
// de los PDF de la web: sin librerías), y también se baja como PNG para redes.
// Entra por `import()`: solo lo baja quien lo pide.
import { escapeHtml } from './html.js'
import { matrizQR } from './qr.js'
import { pdfDeImagenes, PUNTOS_POR_MM } from './tiendas-puro.js'

// A4 a 150 ppp: de sobra para un QR de 8 cm y un PDF que pesa poco.
const ANCHO = 1240
const ALTO = 1754
const C = { tinta: '#0d1b2a', medio: '#52717f', azul: '#1f8acb', oro: '#e4b44a', rosa: '#f06c9b', teal: '#3cc8c0', papel: '#ffffff', suave: '#f3f6f8', raya: '#e1eaee' }
const LETRA = "'Outfit', 'Inter', sans-serif"
const CUERPO = "'Inter', sans-serif"

export const PASOS = [
  'Apunta en PokeDoc las cartas que das y las que buscas.',
  'Abre «Modo evento»: sale tu QR con tus cartas, y funciona sin cobertura.',
  'Quien lo escanea ve al momento qué os podéis cambiar.',
]

// El mismo molde para las TIENDAS (1429, PINGU: «ir a card shows… que las
// tiendas lo utilicen de prueba»): para dejar en sus mesas de una feria. El
// QR lleva a /para-tiendas con su campaña.
export const PASOS_TIENDAS = [
  'Tu stock carta a carta, con el precio de Cardmarket al lado.',
  'Vende, compra y cambia desde el móvil, y la caja te cuadra sola.',
  'Tu escaparate con QR: te encuentra quien busca esa carta.',
]
const TEXTOS = {
  evento: { titular: '¿Cambias cartas hoy?', partido: ['¿Cambias cartas', 'hoy?'], sub: 'Enseña tu QR de PokeDoc', pie: 'Escanéalo y abre tu modo evento · pokedoc.es/evento', pasos: PASOS, final: 'Gratis y en español', nombre: 'cartel-modo-evento', titulo: 'Cartel del modo evento' },
  tiendas: { titular: '¿Tienes tienda de cartas?', partido: ['¿Tienes tienda', 'de cartas?'], sub: 'Pruébalo 2 meses gratis', pie: 'Escanéalo y pide tu acceso · pokedoc.es/para-tiendas', pasos: PASOS_TIENDAS, final: 'Tiendas fundadoras: su precio, mientras sigan', nombre: 'cartel-tiendas', titulo: 'Cartel para tiendas' },
}
const textosDe = (tipo) => TEXTOS[tipo] || TEXTOS.evento

// A dónde lleva el QR: /evento, con la campaña para contar en la analítica
// cuántos llegan del cartel (y de qué evento).
export function enlaceDelCartel(evento = null, tipo = 'evento') {
  const p = new URLSearchParams({ utm_source: tipo === 'tiendas' ? 'cartel-tiendas' : 'cartel' })
  if (evento?.slug) p.set('utm_campaign', evento.slug)
  return `https://pokedoc.es/${tipo === 'tiendas' ? 'para-tiendas' : 'evento'}?${p}`
}

// La línea de arriba con el evento: «IBERIAN CARD SHOW · 7 DIC · MADRID».
export function lineaDelEvento(evento = null) {
  if (!evento?.nombre) return ''
  const fecha = evento.empieza ? new Date(evento.empieza).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') : ''
  return [evento.nombre, fecha, evento.ciudad].filter(Boolean).join(' · ').toUpperCase()
}

function partir(ctx, texto, ancho) {
  const lineas = []
  let linea = ''
  for (const p of String(texto).split(' ')) {
    const prueba = linea ? `${linea} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && linea) { lineas.push(linea); linea = p } else linea = prueba
  }
  if (linea) lineas.push(linea)
  return lineas
}

function caja(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function dibujarCartel({ evento = null, tipo = 'evento' } = {}) {
  const tx = textosDe(tipo)
  try { await Promise.all([document.fonts.load(`800 80px ${LETRA}`), document.fonts.load(`500 30px ${CUERPO}`)]) } catch {}
  const c = document.createElement('canvas')
  c.width = ANCHO
  c.height = ALTO
  const ctx = c.getContext('2d')
  ctx.fillStyle = C.papel
  ctx.fillRect(0, 0, ANCHO, ALTO)
  // La franja de los tres colores de la web, arriba y abajo.
  const franja = (y, h) => {
    const g = ctx.createLinearGradient(0, 0, ANCHO, 0)
    g.addColorStop(0, C.oro); g.addColorStop(0.5, C.rosa); g.addColorStop(1, C.teal)
    ctx.fillStyle = g
    ctx.fillRect(0, y, ANCHO, h)
  }
  franja(0, 28)
  franja(ALTO - 28, 28)
  const M = 110
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  // La marca.
  ctx.font = `800 64px ${LETRA}`
  const poke = ctx.measureText('Poke').width
  const doc = ctx.measureText('Doc').width
  const x0 = (ANCHO - poke - doc) / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = C.tinta
  ctx.fillText('Poke', x0, 150)
  ctx.fillStyle = C.azul
  ctx.fillText('Doc', x0 + poke, 150)
  ctx.textAlign = 'center'
  let y = 150
  const linea = lineaDelEvento(evento)
  if (linea) {
    ctx.font = `700 30px ${CUERPO}`
    ctx.fillStyle = C.rosa
    for (const l of partir(ctx, linea, ANCHO - 2 * M)) { y += 52; ctx.fillText(l, ANCHO / 2, y) }
  }
  // El titular.
  ctx.fillStyle = C.tinta
  ctx.font = `800 104px ${LETRA}`
  // En una línea si cabe; si no (otra letra de respaldo), en dos.
  const titular = ctx.measureText(tx.titular).width <= ANCHO - 2 * M ? [tx.titular] : tx.partido
  for (const l of titular) { y += 130; ctx.fillText(l, ANCHO / 2, y) }
  ctx.font = `800 72px ${LETRA}`
  ctx.fillStyle = C.azul
  y += 100
  ctx.fillText(tx.sub, ANCHO / 2, y)
  // El QR, en su tarjeta.
  const lado = 520
  const qx = (ANCHO - lado) / 2
  const qy = y + 60
  ctx.fillStyle = C.suave
  caja(ctx, qx - 30, qy - 30, lado + 60, lado + 60, 36)
  ctx.fill()
  ctx.strokeStyle = C.raya
  ctx.lineWidth = 3
  ctx.stroke()
  const m = matrizQR(enlaceDelCartel(evento, tipo))
  const n = m.length + 2
  const paso = lado / n
  ctx.fillStyle = C.papel
  ctx.fillRect(qx, qy, lado, lado)
  ctx.fillStyle = C.tinta
  m.forEach((fila, j) => fila.forEach((v, i) => { if (v) ctx.fillRect(Math.floor(qx + (i + 1) * paso), Math.floor(qy + (j + 1) * paso), Math.ceil(paso), Math.ceil(paso)) }))
  y = qy + lado + 90
  ctx.font = `600 32px ${CUERPO}`
  ctx.fillStyle = C.medio
  ctx.fillText(tx.pie, ANCHO / 2, y)
  // Los tres pasos.
  y += 70
  ctx.textAlign = 'left'
  const colores = [C.oro, C.rosa, C.teal]
  tx.pasos.forEach((texto, i) => {
    const cy = y + 46
    ctx.fillStyle = colores[i]
    ctx.beginPath()
    ctx.arc(M + 34, cy, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.tinta
    ctx.font = `800 40px ${LETRA}`
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), M + 34, cy + 14)
    ctx.textAlign = 'left'
    ctx.font = `500 36px ${CUERPO}`
    const ls = partir(ctx, texto, ANCHO - 2 * M - 110)
    ls.forEach((l, k) => ctx.fillText(l, M + 100, cy + 12 + (k - (ls.length - 1) / 2) * 46))
    y += Math.max(104, ls.length * 46 + 34)
  })
  // El pie, debajo de los pasos y nunca encima (con letras de respaldo más
  // anchas los pasos pueden ocupar una línea más).
  ctx.textAlign = 'center'
  ctx.font = `700 34px ${CUERPO}`
  ctx.fillStyle = C.tinta
  ctx.fillText(tx.final, ANCHO / 2, Math.max(y + 30, ALTO - 80))
  return c
}

const comoJpeg = (c) => new Promise((ok, mal) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a)), mal) : mal(new Error('sin imagen'))), 'image/jpeg', 0.92))

export async function pdfDelCartel(opciones = {}) {
  const c = await dibujarCartel(opciones)
  const pdf = pdfDeImagenes([{ jpeg: await comoJpeg(c), ancho: c.width, alto: c.height }], { anchoPt: Math.round(210 * PUNTOS_POR_MM * 100) / 100, altoPt: Math.round(297 * PUNTOS_POR_MM * 100) / 100 })
  return { pdf, lienzo: c }
}

function bajar(blob, nombre) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

const nombreDeFichero = (evento, tipo) => `${textosDe(tipo).nombre}${evento?.slug ? `-${evento.slug}` : ''}`

// El pop-up: cómo queda, «Descargar PDF» (para imprimir) e «Imagen» (redes).
let dialogo = null
export async function abrirCartel({ evento = null, tipo = 'evento' } = {}) {
  const tx = textosDe(tipo)
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'cartel-me'
    dialogo.setAttribute('aria-labelledby', 'cartelMeTitulo')
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo || e.target.closest('[data-cme="cerrar"]')) dialogo.close() })
  }
  dialogo.innerHTML = `<div class="cartel-me-caja">
      <header class="cartel-me-cab"><h2 id="cartelMeTitulo">${tx.titulo}${evento?.nombre ? ` · ${escapeHtml(evento.nombre)}` : ''}</h2><button type="button" class="cartel-me-cerrar" data-cme="cerrar" aria-label="Cerrar">&times;</button></header>
      <div class="cartel-me-vista"><img alt="Cómo queda el cartel" data-cme="vista" width="1240" height="1754" /></div>
      <p class="cartel-me-nota">${tipo === 'tiendas' ? 'A4, para dejar en las mesas de las tiendas en una feria. El QR lleva a pokedoc.es/para-tiendas y la analítica cuenta las visitas que llegan del cartel.' : `A4, para las mesas y la entrada. El QR lleva a pokedoc.es/evento${evento?.slug ? ' y cuenta en la analítica las visitas que llegan de este evento' : ''}.`}</p>
      <footer class="cartel-me-pie"><button type="button" class="btn-secondary" data-cme="png">Imagen</button><button type="button" class="btn-primary" data-cme="pdf">Descargar PDF</button></footer>
    </div>`
  // Lo justo para que se vea centrado sin hoja propia (1045: centrado y con tope).
  Object.assign(dialogo.style, { maxWidth: 'min(560px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', padding: '0', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--white)', color: 'var(--text)', overflow: 'auto' })
  dialogo.querySelector('.cartel-me-caja').style.cssText = 'display:grid;gap:var(--e-md);padding:var(--e-lg)'
  dialogo.querySelector('.cartel-me-cab').style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:var(--e-md)'
  dialogo.querySelector('.cartel-me-cab h2').style.cssText = 'margin:0;font-family:var(--font-display);font-size:var(--t-lg)'
  dialogo.querySelector('.cartel-me-cerrar').style.cssText = 'width:44px;height:44px;border:0;border-radius:50%;background:none;color:var(--text-mid);font-size:var(--t-xl);cursor:pointer'
  dialogo.querySelector('[data-cme="vista"]').style.cssText = 'display:block;width:100%;height:auto;border:1px solid var(--border);border-radius:var(--radius-md)'
  dialogo.querySelector('.cartel-me-nota').style.cssText = 'margin:0;color:var(--text-mid);font-size:var(--t-sm)'
  dialogo.querySelector('.cartel-me-pie').style.cssText = 'display:flex;justify-content:flex-end;gap:var(--e-sm)'
  if (!dialogo.open) dialogo.showModal()
  const lienzo = await dibujarCartel({ evento, tipo })
  lienzo.toBlob((b) => { if (b) dialogo.querySelector('[data-cme="vista"]').src = URL.createObjectURL(b) }, 'image/png')
  dialogo.querySelector('[data-cme="png"]').onclick = () => lienzo.toBlob((b) => b && bajar(b, `${nombreDeFichero(evento, tipo)}.png`), 'image/png')
  dialogo.querySelector('[data-cme="pdf"]').onclick = async (e) => {
    e.target.disabled = true
    try {
      const { pdf } = await pdfDelCartel({ evento, tipo })
      bajar(new Blob([pdf], { type: 'application/pdf' }), `${nombreDeFichero(evento, tipo)}.pdf`)
    } finally {
      e.target.disabled = false
    }
  }
}
