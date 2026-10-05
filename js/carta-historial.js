// La gráfica del histórico de precios de una carta, en /carta (tanda 643).
//
// Pide a `tcggo-historial` las filas (una por día: mínimo de Cardmarket
// por idioma y TCGplayer en euros) y dibuja UN SVG a mano: la línea del
// idioma elegido (o el general, si ese idioma no tiene) y, a trazos, la
// de TCGplayer. Sin librerías —aquí no hay npm para el cliente— y sin
// ejes de más: el mínimo y el máximo a la izquierda, la primera y la
// última fecha abajo. Con menos de dos puntos no hay gráfica que valga, y
// el bloque se queda escondido.
//
// El dibujo es una función pura (`svgDeHistorial`) para poder probarla en
// Node; el montaje (`montarHistorial`) es lo único que toca el DOM.
import { escapeHtml } from './html.js'
import { euros, idiomaDe, IDIOMAS_CON_PRECIO } from './cardmarket.js'

export const ANCHO = 600
export const ALTO = 200
const MARGEN = { arriba: 12, abajo: 24, izquierda: 56, derecha: 12 }

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : typeof v === 'string' && Number(v) > 0 ? Number(v) : null)

// El valor de una fila para un idioma: el suyo si lo tiene, si no el general.
export function valorDeFila(fila, idioma) {
  const propio = IDIOMAS_CON_PRECIO.includes(idioma) ? num(fila?.[`cm_low_${idioma}`]) : null
  return propio ?? num(fila?.cm_low) ?? null
}

const fecha = (dia) => {
  const d = new Date(`${dia}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? String(dia) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Los puntos de una serie: [{ dia, valor }] solo con los días que tienen cifra.
export function serieDe(filas, tomar) {
  return (filas || []).map((f) => ({ dia: String(f.dia), valor: tomar(f) })).filter((p) => p.valor !== null && /^\d{4}-\d{2}-\d{2}/.test(p.dia))
}

// El SVG. Devuelve '' si no hay con qué dibujar.
export function svgDeHistorial(filas, { idioma = 'es' } = {}) {
  const cm = serieDe(filas, (f) => valorDeFila(f, idioma))
  const tp = serieDe(filas, (f) => num(f?.tp_market_eur))
  const puntos = [...cm, ...tp]
  if (cm.length < 2 && tp.length < 2) return ''
  const dias = [...new Set(puntos.map((p) => p.dia))].sort()
  const t0 = new Date(`${dias[0]}T00:00:00Z`).getTime()
  const t1 = new Date(`${dias[dias.length - 1]}T00:00:00Z`).getTime()
  const valores = puntos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (dia) => (t1 === t0 ? MARGEN.izquierda + anchoUtil / 2 : MARGEN.izquierda + ((new Date(`${dia}T00:00:00Z`).getTime() - t0) / (t1 - t0)) * anchoUtil)
  const y = (v) => (max === min ? MARGEN.arriba + altoUtil / 2 : MARGEN.arriba + (1 - (v - min) / (max - min)) * altoUtil)
  const linea = (serie, clase) => (serie.length < 2 ? '' : `<polyline class="${clase}" points="${serie.map((p) => `${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}"/>`)
  const rejaY = [MARGEN.arriba, MARGEN.arriba + altoUtil / 2, MARGEN.arriba + altoUtil]
  return (
    `<svg viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${escapeHtml(`Histórico: de ${euros(min)} a ${euros(max)} entre el ${fecha(dias[0])} y el ${fecha(dias[dias.length - 1])}`)}">` +
    rejaY.map((yy) => `<line class="carta-historial-reja" x1="${MARGEN.izquierda}" x2="${ANCHO - MARGEN.derecha}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>`).join('') +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda - 6}" y="${(MARGEN.arriba + 4).toFixed(1)}" text-anchor="end">${escapeHtml(euros(max))}</text>` +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda - 6}" y="${(MARGEN.arriba + altoUtil + 4).toFixed(1)}" text-anchor="end">${escapeHtml(euros(min))}</text>` +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda}" y="${ALTO - 6}">${escapeHtml(fecha(dias[0]))}</text>` +
    `<text class="carta-historial-eje" x="${ANCHO - MARGEN.derecha}" y="${ALTO - 6}" text-anchor="end">${escapeHtml(fecha(dias[dias.length - 1]))}</text>` +
    linea(tp, 'carta-historial-linea carta-historial-linea-tp') +
    linea(cm, 'carta-historial-linea') +
    '</svg>'
  )
}

// El pie: qué líneas hay y de qué idioma.
export function pieDeHistorial(filas, idioma) {
  const cm = serieDe(filas, (f) => valorDeFila(f, idioma))
  const tp = serieDe(filas, (f) => num(f?.tp_market_eur))
  const conPropio = (filas || []).some((f) => IDIOMAS_CON_PRECIO.includes(idioma) && num(f?.[`cm_low_${idioma}`]))
  const partes = []
  if (cm.length >= 2) partes.push(`Línea: mínimo en Cardmarket${conPropio ? ` en ${idiomaDe(idioma).nombre.toLowerCase()}` : ', cualquier idioma'}`)
  if (tp.length >= 2) partes.push('a trazos, TCGplayer en euros')
  return partes.join(' · ') + (partes.length ? `. ${filas.length} ${filas.length === 1 ? 'día' : 'días'}.` : '')
}

// Monta la gráfica en `caja` y devuelve la función para repintarla (al
// cambiar de idioma). `idiomaActual` se consulta cada vez.
export async function montarHistorial(caja, cardId, idiomaActual = () => 'es') {
  if (!caja || !cardId) return () => {}
  let filas = []
  try {
    const res = await fetch(`/.netlify/functions/tcggo-historial?card=${encodeURIComponent(cardId)}`, { headers: { accept: 'application/json' } })
    const r = res.ok ? await res.json() : null
    filas = Array.isArray(r?.filas) ? r.filas : []
  } catch {
    filas = []
  }
  const pintar = () => {
    const idioma = idiomaActual()
    const svg = svgDeHistorial(filas, { idioma })
    if (!svg) {
      caja.classList.add('hidden')
      caja.innerHTML = ''
      return
    }
    caja.innerHTML = `<p class="carta-historial-titulo">Histórico de precios</p>${svg}<p class="carta-historial-pie">${escapeHtml(pieDeHistorial(filas, idioma))}</p>`
    caja.classList.remove('hidden')
  }
  pintar()
  return pintar
}
