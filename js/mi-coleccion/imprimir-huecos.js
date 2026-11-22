// «IMPRIMIR LOS HUECOS» (tanda 1414, PINGU, de «Dónde va cada función»: «3,
// sí, pero solo el de imprimir los huecos»). En el ⋯ de un álbum tuyo: las
// cartas que te faltan a TAMAÑO REAL (63 × 88 mm), nueve por A4, para
// imprimirlas, recortarlas y meterlas en su bolsillo hasta que llegue la de
// verdad. Con la foto en gris y el nombre encima, o solo el nombre (gasta
// menos tinta). Marcas de corte en las esquinas.
//
// Sin librerías, como el Informe (1413): cada hoja es un lienzo y
// `pdfDeImagenes` las junta. Entra por `import()` al pulsar.
import { escapeHtml } from '../app.js'
import { nombreDeSet } from '../catalogo-series.js'
import { cadenaDeEscaneo } from '../escaneo-carta.js'
import { fotoParaElLienzo, redondeado } from '../imagen-compartir.js'
import { pdfDeImagenes, PUNTOS_POR_MM } from '../tiendas-puro.js'
import { showToast } from '../toast.js'

// 8 px por mm (203 ppp): la foto se ve nítida en una carta de verdad.
const PX_MM = 8
export const CARTA = { w: 63, h: 88 }
export const POR_HOJA = 9
// Más de esto es un set entero sin empezar: mejor por partes.
export const HOJAS_MAXIMAS = 30
const LETRA = 'Inter, system-ui, sans-serif'
const TITULO = 'Outfit, Inter, system-ui, sans-serif'

// ── Lo puro ──

// Los huecos: las cartas del álbum que no tienes, en el orden del álbum. Un
// bolsillo vacío de un binder no tiene carta que imprimir.
export function huecosDelAlbum(cartas, tiene) {
  return (cartas || []).filter((c) => c?.id && !tiene(c))
}

// Dónde va cada carta en la hoja: la rejilla de 3 × 3 centrada, sin hueco
// entre cartas (un corte vale para las dos).
export function rejillaA4() {
  const ancho = CARTA.w * 3
  const alto = CARTA.h * 3
  const x0 = (210 - ancho) / 2
  const y0 = (297 - alto) / 2
  return Array.from({ length: POR_HOJA }, (_, i) => ({ x: x0 + (i % 3) * CARTA.w, y: y0 + Math.floor(i / 3) * CARTA.h, w: CARTA.w, h: CARTA.h }))
}

export function hojasDe(huecos, maximas = HOJAS_MAXIMAS) {
  const lista = huecos.slice(0, maximas * POR_HOJA)
  const hojas = []
  for (let i = 0; i < lista.length; i += POR_HOJA) hojas.push(lista.slice(i, i + POR_HOJA))
  return { hojas, fuera: huecos.length - lista.length }
}

// «12/165», o el número solo si no se sabe cuántas tiene el set.
export function numeroDe(carta, v = '') {
  const oficial = Number(carta?.tcg_sets?.card_count_official) || 0
  const n = carta?.local_id ?? '?'
  const ver = v === 'reverse' ? ' · Reverse' : v === 'holo' ? ' · Holo' : ''
  return `${oficial && /^\d+$/.test(String(n)) ? `${n}/${oficial}` : n}${ver}`
}

// ── El dibujo ──

const mm = (v) => v * PX_MM
function cortar(ctx, texto, ancho) {
  const t0 = String(texto ?? '')
  if (ctx.measureText(t0).width <= ancho) return t0
  let t = t0
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}
// El nombre en una o dos líneas, lo más grande que quepa.
function nombreEnLineas(ctx, texto, ancho, tam) {
  ctx.font = `800 ${mm(tam)}px ${TITULO}`
  if (ctx.measureText(texto).width <= ancho) return [texto]
  const palabras = String(texto).split(' ')
  let a = ''
  for (let i = 0; i < palabras.length; i++) {
    const prueba = a ? `${a} ${palabras[i]}` : palabras[i]
    if (ctx.measureText(prueba).width > ancho && a) return [a, cortar(ctx, palabras.slice(i).join(' '), ancho)]
    a = prueba
  }
  return [cortar(ctx, a, ancho)]
}

// La foto, en gris y aclarada: que se vea qué carta va, pero que no se
// confunda con la de verdad. A mano con los píxeles (el `filter` del lienzo
// no lo tienen todos los Safari).
function fotoEnGris(ctx, img, x, y, w, h) {
  ctx.drawImage(img, x, y, w, h)
  try {
    const d = ctx.getImageData(x, y, w, h)
    const p = d.data
    for (let i = 0; i < p.length; i += 4) {
      const g = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]
      const v = 255 - (255 - g) * 0.45
      p[i] = p[i + 1] = p[i + 2] = v
    }
    ctx.putImageData(d, x, y)
  } catch {
    // Si el lienzo no deja leer los píxeles, un velo blanco hace lo mismo.
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillRect(x, y, w, h)
  }
}

function dibujarHueco(ctx, caja, { nombre, numero, set, img, conFoto }) {
  const x = Math.round(mm(caja.x))
  const y = Math.round(mm(caja.y))
  const w = Math.round(mm(caja.w))
  const h = Math.round(mm(caja.h))
  ctx.save()
  redondeado(ctx, x, y, w, h, mm(3))
  ctx.clip()
  ctx.fillStyle = '#f2f4f5'
  ctx.fillRect(x, y, w, h)
  if (conFoto && img) fotoEnGris(ctx, img, x, y, w, h)
  ctx.restore()
  // El borde de la carta, fino y discontinuo: por donde se recorta.
  ctx.save()
  ctx.setLineDash([mm(1.2), mm(1)])
  ctx.strokeStyle = '#9aa7ae'
  ctx.lineWidth = mm(0.2)
  redondeado(ctx, x + 0.5, y + 0.5, w - 1, h - 1, mm(3))
  ctx.stroke()
  ctx.restore()
  // La etiqueta: arriba «Te falta», abajo nombre, número y expansión.
  const pad = mm(3)
  if (conFoto && img) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    redondeado(ctx, x + pad, y + h - mm(24) - pad, w - 2 * pad, mm(24), mm(2))
    ctx.fill()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#7a8a93'
  ctx.font = `700 ${mm(2.4)}px ${LETRA}`
  const rotulo = 'TE FALTA'
  if (conFoto && img) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    const rw = ctx.measureText(rotulo).width + mm(4)
    redondeado(ctx, x + w / 2 - rw / 2, y + pad, rw, mm(5), mm(2.5))
    ctx.fill()
    ctx.fillStyle = '#52717f'
  }
  ctx.fillText(rotulo, x + w / 2, y + pad + mm(3.6))
  const ancho = w - 2 * pad - mm(4)
  if (conFoto && img) {
    const lineas = nombreEnLineas(ctx, nombre, ancho, 3.6)
    ctx.fillStyle = '#0d1b2a'
    lineas.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h - pad - mm(lineas.length === 2 ? 15.5 : 12.5) + i * mm(4.2)))
    ctx.fillStyle = '#52717f'
    ctx.font = `600 ${mm(2.6)}px ${LETRA}`
    ctx.fillText(cortar(ctx, numero, ancho), x + w / 2, y + h - pad - mm(7))
    ctx.font = `500 ${mm(2.4)}px ${LETRA}`
    ctx.fillText(cortar(ctx, set, ancho), x + w / 2, y + h - pad - mm(3))
  } else {
    // Solo el nombre: en el centro, grande.
    const lineas = nombreEnLineas(ctx, nombre, ancho, 5)
    ctx.fillStyle = '#0d1b2a'
    const yc = y + h / 2 - (lineas.length - 1) * mm(3)
    lineas.forEach((l, i) => ctx.fillText(l, x + w / 2, yc + i * mm(6)))
    ctx.fillStyle = '#52717f'
    ctx.font = `600 ${mm(3)}px ${LETRA}`
    ctx.fillText(cortar(ctx, numero, ancho), x + w / 2, yc + (lineas.length - 1) * mm(6) + mm(7))
    ctx.font = `500 ${mm(2.6)}px ${LETRA}`
    ctx.fillText(cortar(ctx, set, ancho), x + w / 2, yc + (lineas.length - 1) * mm(6) + mm(11.5))
  }
  ctx.textAlign = 'left'
}

// Las marcas de corte, fuera de la rejilla: una raya por cada corte.
function marcasDeCorte(ctx, cajas) {
  const xs = [...new Set(cajas.flatMap((c) => [c.x, c.x + c.w]))]
  const ys = [...new Set(cajas.flatMap((c) => [c.y, c.y + c.h]))]
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  ctx.strokeStyle = '#52717f'
  ctx.lineWidth = mm(0.2)
  ctx.beginPath()
  for (const x of xs) {
    ctx.moveTo(mm(x), mm(y0 - 8)); ctx.lineTo(mm(x), mm(y0 - 2))
    ctx.moveTo(mm(x), mm(y1 + 2)); ctx.lineTo(mm(x), mm(y1 + 8))
  }
  for (const y of ys) {
    ctx.moveTo(mm(x0 - 8), mm(y)); ctx.lineTo(mm(x0 - 2), mm(y))
    ctx.moveTo(mm(x1 + 2), mm(y)); ctx.lineTo(mm(x1 + 8), mm(y))
  }
  ctx.stroke()
}

async function dibujarHoja({ fichas, conFoto, album, pagina, total }) {
  const c = document.createElement('canvas')
  c.width = 210 * PX_MM
  c.height = 297 * PX_MM
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  const cajas = rejillaA4()
  fichas.forEach((f, i) => dibujarHueco(ctx, cajas[i], { ...f, conFoto }))
  marcasDeCorte(ctx, cajas.slice(0, fichas.length))
  ctx.fillStyle = '#7a8a93'
  ctx.font = `500 ${mm(2.6)}px ${LETRA}`
  ctx.fillText(cortar(ctx, `${album} · imprime al 100 % (tamaño real)`, mm(150)), mm(10.5), mm(8))
  ctx.textAlign = 'right'
  ctx.fillText(`PokeDoc · ${pagina} de ${total}`, mm(199.5), mm(8))
  ctx.textAlign = 'left'
  return c
}

const comoJpeg = (c) => new Promise((ok, mal) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok({ jpeg: new Uint8Array(a), ancho: c.width, alto: c.height }), mal) : mal(new Error('sin imagen'))), 'image/jpeg', 0.85))

// El PDF entero, en bytes (lo usa la prueba).
export async function pdfDeHuecos({ album, huecos, cartaDe, nombreDe, conFoto = true, alAvanzar }) {
  const { hojas, fuera } = hojasDe(huecos)
  const paginas = []
  for (let i = 0; i < hojas.length; i++) {
    alAvanzar?.(i + 1, hojas.length)
    const fichas = await Promise.all(hojas[i].map(async (h) => {
      const carta = cartaDe(h.id)
      const img = conFoto && carta ? await fotoParaElLienzo(cadenaDeEscaneo(carta, null, 'high')).catch(() => null) : null
      return { carta, nombre: carta ? nombreDe(carta) : h.id, numero: numeroDe(carta, h.v), set: carta?.tcg_sets ? nombreDeSet(carta.tcg_sets) || carta.set_id : carta?.set_id || '', img }
    }))
    paginas.push(await comoJpeg(await dibujarHoja({ fichas, conFoto, album: album.nombre || 'Mi álbum', pagina: i + 1, total: hojas.length })))
  }
  return { bytes: pdfDeImagenes(paginas, { anchoPt: 210 * PUNTOS_POR_MM, altoPt: 297 * PUNTOS_POR_MM }), hojas: hojas.length, fuera }
}

function bajar(bytes, nombre) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// ── La hoja de elegir ──

let dialogo = null
function crear() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'mc-idd mc-huecos'
  dialogo.id = 'mcHuecos'
  dialogo.setAttribute('aria-labelledby', 'mcHuecosTitulo')
  dialogo.innerHTML = `
    <div class="mc-idd-cuerpo">
      <h2 id="mcHuecosTitulo">Imprimir los huecos</h2>
      <p class="mc-idd-carta" id="mcHuecosCuenta"></p>
      <div class="mc-idd-bloque">
        <p class="mc-idd-rot">Cómo salen</p>
        <div class="mc-idioma-chips" id="mcHuecosEstilo" role="radiogroup" aria-label="Cómo salen">
          <button type="button" class="mc-idioma-chip activo" role="radio" aria-checked="true" data-estilo="foto"><span>Con la foto en gris</span></button>
          <button type="button" class="mc-idioma-chip" role="radio" aria-checked="false" data-estilo="nombre"><span>Solo el nombre</span></button>
        </div>
      </div>
      <p class="mc-idd-nota">A tamaño real (63 × 88 mm), nueve por hoja. Imprime al 100 %, recorta por la raya y mete cada una en su bolsillo hasta que tengas la de verdad.</p>
      <div class="mc-idd-pie">
        <button type="button" class="btn-secondary" data-huecos="no">Cancelar</button>
        <button type="button" class="btn-primary" data-huecos="si">Descargar PDF</button>
      </div>
    </div>`
  document.body.append(dialogo)
  dialogo.addEventListener('click', (e) => {
    const chip = e.target.closest('[role="radio"]')
    if (chip) {
      for (const x of chip.parentElement.querySelectorAll('[role="radio"]')) {
        x.classList.toggle('activo', x === chip)
        x.setAttribute('aria-checked', String(x === chip))
      }
      return
    }
    const b = e.target.closest('[data-huecos]')
    if (b) return dialogo.close(b.dataset.huecos)
    if (e.target === dialogo) dialogo.close('no')
  })
  return dialogo
}

export async function imprimirHuecos({ album, cartaDe, nombreDe, tiene }) {
  const huecos = huecosDelAlbum(album?.cartas, tiene)
  if (!huecos.length) return void showToast('En este álbum no te falta ninguna carta.', 'info')
  const d = crear()
  const { hojas, fuera } = hojasDe(huecos)
  d.querySelector('#mcHuecosCuenta').innerHTML = `${huecos.length} ${huecos.length === 1 ? 'carta te falta' : 'cartas te faltan'} · ${hojas.length} ${hojas.length === 1 ? 'hoja' : 'hojas'} A4${fuera ? ` <small>(las ${escapeHtml(String(hojas.length * POR_HOJA))} primeras)</small>` : ''}`
  d.returnValue = ''
  const sigue = await new Promise((ok) => {
    d.addEventListener('close', () => ok(d.returnValue === 'si'), { once: true })
    d.showModal()
    d.querySelector('[data-huecos="si"]')?.focus()
  })
  if (!sigue) return
  const conFoto = d.querySelector('#mcHuecosEstilo [aria-checked="true"]')?.dataset.estilo !== 'nombre'
  showToast(conFoto ? 'Preparando las hojas con sus fotos…' : 'Preparando las hojas…', 'info')
  const { bytes, hojas: n } = await pdfDeHuecos({ album, huecos, cartaDe, nombreDe, conFoto })
  const slug = String(album.nombre || 'album').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'album'
  bajar(bytes, `huecos-${slug}.pdf`)
  showToast(`Listo: ${n} ${n === 1 ? 'hoja' : 'hojas'} para imprimir.`, 'success')
}
