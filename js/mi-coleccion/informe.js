// «INFORME PDF» (tanda 1413, PINGU, de «Dónde va cada función»: «1, sí»; va
// en el Panel › Más, junto a Exportar CSV). Tu colección en un PDF A4 para
// guardarla, imprimirla o enseñarla (un seguro, una herencia, una venta):
//   · la primera hoja con tus cifras (cartas, distintas, expansiones, valor y
//     lo pagado), las doce que más valen con su foto y el reparto por
//     expansión;
//   · y después TODAS tus cartas en una tabla, por expansión y número, con
//     idioma, estado, copias y valor. Página N de M al pie.
// Sin librerías: cada hoja es un lienzo y `pdfDeImagenes` (el del Cierre del
// mes de las tiendas, 1094) las junta. Entra por `import()` al pulsar.
import { euros, valorDeLinea } from '../cardmarket.js'
import { nombreDeSet } from '../catalogo-series.js'
import { cadenaDeEscaneo } from '../escaneo-carta.js'
import { fotoParaElLienzo, dibujarCarta } from '../imagen-compartir.js'
import { pdfDeImagenes, PUNTOS_POR_MM } from '../tiendas-puro.js'
import { showToast } from '../toast.js'

// 6 px por mm (152 ppp): se lee bien impreso y 40 hojas no pasan de unos MB.
const PX_MM = 6
const C = { papel: '#ffffff', tinta: '#0d1b2a', suave: '#52717f', raya: '#e1eaee', fondo: '#fbf3dc', oro: '#b7791f', banda: '#f6f9fa' }
const LETRA = 'Inter, system-ui, sans-serif'
const TITULO = 'Outfit, Inter, system-ui, sans-serif'
export const FILAS_POR_HOJA = 44
// A partir de aquí la lista se corta (y lo dice): las que más valen primero.
export const HOJAS_MAXIMAS = 60
const M = 14 // margen en mm

// ── Lo puro ──

const numero = (c) => Number.parseInt(String(c?.local_id ?? '').replace(/\D+/g, ''), 10) || 0

// Las filas de la tabla: una por línea de tu colección (dos idiomas o dos
// estados son dos filas, como en el CSV), por expansión (la más nueva antes)
// y número.
export function filasDelInforme(lineas, { cartaDe, valorDe, nombreDe }) {
  const filas = []
  for (const l of lineas || []) {
    const c = cartaDe(l)
    const set = c?.tcg_sets || null
    filas.push({
      nombre: c ? nombreDe(c) : l.card_id,
      set: set ? nombreDeSet(set) || c.set_id : c?.set_id || '',
      fecha: set?.release_date || '',
      numero: c?.local_id ?? '',
      idioma: String(l.idioma || '').toUpperCase(),
      estado: l.gradeo ? String(l.gradeo) : l.estado || '',
      copias: Number(l.cantidad) || 1,
      valor: valorDe(l) || 0,
      pagado: Number(l.precio_compra) > 0 ? Number(l.precio_compra) * (Number(l.cantidad) || 1) : 0,
      carta: c,
    })
  }
  return filas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || a.set.localeCompare(b.set, 'es') || numero({ local_id: a.numero }) - numero({ local_id: b.numero }) || a.nombre.localeCompare(b.nombre, 'es'))
}

export function cifrasDe(filas) {
  const copias = filas.reduce((s, f) => s + f.copias, 0)
  const distintas = new Set(filas.map((f) => f.carta?.id ? `${f.carta.id}|${f.carta.market || ''}` : f.nombre)).size
  const expansiones = new Set(filas.map((f) => f.set).filter(Boolean)).size
  const valor = filas.reduce((s, f) => s + f.valor, 0)
  const pagado = filas.reduce((s, f) => s + f.pagado, 0)
  return { copias, distintas, expansiones, valor, pagado }
}

// Por expansión, de más a menos valor: [{ set, copias, valor }].
export function porExpansion(filas, tope = 14) {
  const m = new Map()
  for (const f of filas) {
    const k = f.set || 'Sin expansión'
    const v = m.get(k) || { set: k, copias: 0, valor: 0 }
    v.copias += f.copias
    v.valor += f.valor
    m.set(k, v)
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor || b.copias - a.copias).slice(0, tope)
}

// Las que más valen, una por carta (la línea de más valor por copia).
export function lasQueMasValen(filas, n = 12) {
  const vistas = new Set()
  const out = []
  for (const f of [...filas].filter((x) => x.valor > 0).sort((a, b) => b.valor / b.copias - a.valor / a.copias)) {
    const k = f.carta?.id || f.nombre
    if (vistas.has(k)) continue
    vistas.add(k)
    out.push(f)
    if (out.length === n) break
  }
  return out
}

// Las hojas de la tabla: trozos de `porHoja`, sin pasar de `maximas`. Si no
// caben todas, entran las que más valen (en su orden de expansión).
export function hojasDeLista(filas, porHoja = FILAS_POR_HOJA, maximas = HOJAS_MAXIMAS) {
  let lista = filas
  const caben = porHoja * maximas
  const cortada = filas.length > caben
  if (cortada) {
    const dentro = new Set([...filas].sort((a, b) => b.valor - a.valor).slice(0, caben))
    lista = filas.filter((f) => dentro.has(f))
  }
  const hojas = []
  for (let i = 0; i < lista.length; i += porHoja) hojas.push(lista.slice(i, i + porHoja))
  return { hojas, cortada, fuera: filas.length - lista.length }
}

const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

// ── El dibujo ──

function lienzo() {
  const c = document.createElement('canvas')
  c.width = 210 * PX_MM
  c.height = 297 * PX_MM
  const ctx = c.getContext('2d')
  ctx.fillStyle = C.papel
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.textBaseline = 'alphabetic'
  return { c, ctx }
}
const mm = (v) => v * PX_MM
function cortar(ctx, texto, ancho) {
  const t0 = String(texto ?? '')
  if (ctx.measureText(t0).width <= ancho) return t0
  let t = t0
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}
function texto(ctx, t, x, y, { peso = 500, tam = 3, color = C.tinta, fuente = LETRA, alinear = 'left', ancho = 0 } = {}) {
  ctx.fillStyle = color
  ctx.font = `${peso} ${mm(tam)}px ${fuente}`
  ctx.textAlign = alinear
  ctx.fillText(ancho ? cortar(ctx, t, mm(ancho)) : String(t), mm(x), mm(y))
  ctx.textAlign = 'left'
}

function pie(ctx, pagina, total, quien) {
  ctx.fillStyle = C.raya
  ctx.fillRect(mm(M), mm(284), mm(210 - 2 * M), mm(0.3))
  texto(ctx, `${quien ? `${quien} · ` : ''}Hecho el ${fechaLarga()} con los precios de Cardmarket en PokeDoc.`, M, 290, { tam: 2.4, color: C.suave, ancho: 140 })
  texto(ctx, `Página ${pagina} de ${total}`, 210 - M, 290, { tam: 2.4, color: C.suave, alinear: 'right' })
}

async function dibujarPortada({ cifras, top, fotos, sets, quien, pagina, total }) {
  const { c, ctx } = lienzo()
  try { await document.fonts?.ready } catch {}
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, c.width, mm(40))
  ctx.fillStyle = C.oro
  ctx.fillRect(0, mm(40), c.width, mm(1.2))
  texto(ctx, 'MI COLECCIÓN', M, 15, { peso: 700, tam: 2.8, color: C.oro })
  texto(ctx, quien ? `La colección de ${quien}` : 'Mi colección de Pokémon TCG', M, 26, { peso: 800, tam: 8, fuente: TITULO, ancho: 210 - 2 * M })
  texto(ctx, `A ${fechaLarga()}`, M, 34, { tam: 3.4, color: C.suave })
  // Las cifras.
  const lista = [
    ['Cartas', cifras.copias.toLocaleString('es-ES'), `${cifras.distintas.toLocaleString('es-ES')} distintas`],
    ['Expansiones', cifras.expansiones.toLocaleString('es-ES'), 'con alguna carta'],
    ['Valor', euros(cifras.valor), 'precio de Cardmarket hoy'],
    ...(cifras.pagado > 0 ? [['Pagado', euros(cifras.pagado), 'lo que apuntaste']] : []),
  ]
  const dentro = 210 - 2 * M
  const ancho = (dentro - (lista.length - 1) * 4) / lista.length
  lista.forEach(([t, v, s], i) => {
    const x = M + i * (ancho + 4)
    ctx.strokeStyle = C.raya
    ctx.lineWidth = mm(0.3)
    ctx.strokeRect(mm(x), mm(48), mm(ancho), mm(24))
    texto(ctx, t.toUpperCase(), x + 3, 54, { peso: 700, tam: 2.6, color: C.suave })
    texto(ctx, v, x + 3, 63, { peso: 800, tam: 6, fuente: TITULO, ancho: ancho - 6 })
    texto(ctx, s, x + 3, 69, { tam: 2.4, color: C.suave, ancho: ancho - 6 })
  })
  // Las que más valen, en dos filas de seis.
  texto(ctx, 'Las que más valen', M, 84, { peso: 700, tam: 4.4, fuente: TITULO })
  const cw = (dentro - 5 * 4) / 6
  const ch = cw * (342 / 245)
  top.forEach((f, i) => {
    const x = M + (i % 6) * (cw + 4)
    const y = 89 + Math.floor(i / 6) * (ch + 13)
    dibujarCarta(ctx, fotos[i], { x: mm(x), y: mm(y), w: mm(cw), h: mm(ch), r: mm(1.4), nombre: '' })
    texto(ctx, f.nombre, x, y + ch + 4, { peso: 700, tam: 2.4, ancho: cw })
    texto(ctx, `${euros(f.valor / f.copias)}${f.copias > 1 ? ` · ×${f.copias}` : ''}`, x, y + ch + 8, { tam: 2.4, color: C.suave, ancho: cw })
  })
  if (!top.length) texto(ctx, 'Todavía ninguna carta tiene precio.', M, 94, { tam: 3, color: C.suave })
  // Por expansión.
  const y0 = top.length > 6 ? 89 + 2 * (ch + 13) + 6 : top.length ? 89 + ch + 19 : 104
  texto(ctx, 'Por expansión', M, y0, { peso: 700, tam: 4.4, fuente: TITULO })
  texto(ctx, 'EXPANSIÓN', M, y0 + 7, { peso: 700, tam: 2.4, color: C.suave })
  texto(ctx, 'CARTAS', 210 - M - 34, y0 + 7, { peso: 700, tam: 2.4, color: C.suave, alinear: 'right' })
  texto(ctx, 'VALOR', 210 - M, y0 + 7, { peso: 700, tam: 2.4, color: C.suave, alinear: 'right' })
  let y = y0 + 13
  for (const s of sets) {
    if (y > 278) break
    ctx.fillStyle = C.raya
    ctx.fillRect(mm(M), mm(y - 4.2), mm(dentro), mm(0.2))
    texto(ctx, s.set, M, y, { tam: 3, ancho: dentro - 60 })
    texto(ctx, s.copias.toLocaleString('es-ES'), 210 - M - 34, y, { tam: 3, alinear: 'right' })
    texto(ctx, euros(s.valor), 210 - M, y, { peso: 700, tam: 3, alinear: 'right' })
    y += 6.4
  }
  pie(ctx, pagina, total, quien)
  return c
}

// Columnas de la tabla (x en mm desde el margen, ancho, alineación).
const COLS = [
  { k: 'nombre', t: 'Carta', x: 0, w: 52 },
  { k: 'set', t: 'Expansión', x: 54, w: 44 },
  { k: 'numero', t: 'Nº', x: 100, w: 12 },
  { k: 'idioma', t: 'Idioma', x: 114, w: 12 },
  { k: 'estado', t: 'Estado', x: 128, w: 18 },
  { k: 'copias', t: 'Copias', x: 148, w: 12, derecha: true },
  { k: 'valor', t: 'Valor', x: 162, w: 20, derecha: true },
]

function dibujarLista({ filas, pagina, total, quien, cortada, fuera }) {
  const { c, ctx } = lienzo()
  texto(ctx, 'Todas tus cartas', M, 18, { peso: 800, tam: 5.6, fuente: TITULO })
  if (cortada && pagina === 2) texto(ctx, `Las que más valen: ${fuera.toLocaleString('es-ES')} líneas más no caben; están todas en el CSV.`, 210 - M, 18, { tam: 2.6, color: C.suave, alinear: 'right', ancho: 90 })
  const y0 = 28
  for (const col of COLS) texto(ctx, col.t.toUpperCase(), M + col.x + (col.derecha ? col.w : 0), y0, { peso: 700, tam: 2.3, color: C.suave, alinear: col.derecha ? 'right' : 'left' })
  ctx.fillStyle = C.raya
  ctx.fillRect(mm(M), mm(y0 + 2), mm(210 - 2 * M), mm(0.3))
  let y = y0 + 8
  filas.forEach((f, i) => {
    if (i % 2) {
      ctx.fillStyle = C.banda
      ctx.fillRect(mm(M - 1), mm(y - 4), mm(210 - 2 * M + 2), mm(5.6))
    }
    for (const col of COLS) {
      const v = col.k === 'valor' ? (f.valor ? euros(f.valor) : '—') : col.k === 'copias' ? String(f.copias) : f[col.k]
      texto(ctx, v, M + col.x + (col.derecha ? col.w : 0), y, { peso: col.k === 'nombre' || col.k === 'valor' ? 700 : 500, tam: 2.7, color: col.k === 'set' || col.k === 'numero' ? C.suave : C.tinta, alinear: col.derecha ? 'right' : 'left', ancho: col.w })
    }
    y += 5.6
  })
  pie(ctx, pagina, total, quien)
  return c
}

const comoJpeg = (c, calidad = 0.86) => new Promise((ok, mal) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok({ jpeg: new Uint8Array(a), ancho: c.width, alto: c.height }), mal) : mal(new Error('sin imagen'))), 'image/jpeg', calidad))

function bajar(bytes, nombre) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// El PDF entero, en bytes (lo usa la prueba sin descargar nada).
export async function pdfDelInforme(ctx, { alAvanzar } = {}) {
  const lineas = ctx.lineasTodo?.length ? ctx.lineasTodo : ctx.lineas
  const cartaDe = ctx.lineasTodo?.length ? ctx.cartaDeLineaTodo : ctx.cartaDeLinea
  if (!lineas?.length) throw new Error('Tu colección está vacía: añade alguna carta y vuelve.')
  const filas = filasDelInforme(lineas, { cartaDe, valorDe: (l) => valorDeLinea(l, ctx.precioDe(l)), nombreDe: ctx.nombreDe })
  const cifras = cifrasDe(filas)
  const top = lasQueMasValen(filas)
  const { hojas, cortada, fuera } = hojasDeLista(filas)
  const total = 1 + hojas.length
  const quien = ctx.dueno?.display_name || (ctx.dueno?.username ? `@${ctx.dueno.username}` : '')
  const fotos = await Promise.all(top.map((f) => (f.carta ? fotoParaElLienzo(cadenaDeEscaneo(f.carta, null, 'high')).catch(() => null) : null)))
  const paginas = [await comoJpeg(await dibujarPortada({ cifras, top, fotos, sets: porExpansion(filas), quien, pagina: 1, total }), 0.9)]
  for (let i = 0; i < hojas.length; i++) {
    alAvanzar?.(i + 2, total)
    paginas.push(await comoJpeg(dibujarLista({ filas: hojas[i], pagina: i + 2, total, quien, cortada, fuera })))
    // Respira entre hoja y hoja: con cuarenta, la página no se queda congelada.
    await new Promise((r) => setTimeout(r, 0))
  }
  return { bytes: pdfDeImagenes(paginas, { anchoPt: 210 * PUNTOS_POR_MM, altoPt: 297 * PUNTOS_POR_MM }), paginas: total, cortada }
}

let haciendo = false
export async function hacerInforme(ctx, boton) {
  if (haciendo) return
  haciendo = true
  const rotulo = boton?.querySelector('span:last-child')
  const antes = rotulo?.textContent
  if (boton) boton.disabled = true
  try {
    const { bytes, paginas } = await pdfDelInforme(ctx, { alAvanzar: (n, t) => { if (rotulo) rotulo.textContent = `Hoja ${n} de ${t}…` } })
    const dia = new Date().toISOString().slice(0, 10)
    bajar(bytes, `mi-coleccion-${dia}.pdf`)
    showToast(`Informe listo: ${paginas} ${paginas === 1 ? 'página' : 'páginas'}.`, 'success')
  } catch (err) {
    showToast(err.message || 'No se ha podido hacer el informe.', 'error')
  } finally {
    haciendo = false
    if (boton) boton.disabled = false
    if (rotulo && antes) rotulo.textContent = antes
  }
}
