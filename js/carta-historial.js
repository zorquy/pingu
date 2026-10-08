// La gráfica del histórico de precios de una carta (tanda 643; rehecha en
// la 661 con la de TCGGO delante).
//
// Pide a `tcggo-historial` las filas (una por día: mínimo de Cardmarket
// por idioma y TCGplayer en euros) y dibuja UN SVG a mano, sin librerías
// (aquí no hay npm para el cliente). PINGU, con la ficha de TCGGO: «hay
// historial de precios… me gusta mucho la interfaz: un selector de rango,
// una línea por idioma, y marcas verticales de los lanzamientos». Así que:
//
//   · EL RANGO: 7 días, 1, 3 y 6 meses, 1 año y todo; un botón sin datos
//     se apaga (la 464). Por defecto 3 meses, si los hay.
//   · UNA LÍNEA POR IDIOMA (`todas`): el elegido gorda, los demás finos y
//     con su color (`data-idioma`, lo pinta el CSS); TCGplayer a trazos.
//   · LAS MARCAS: las expansiones grandes que salieron dentro del tramo,
//     como rayas verticales con su código. Las trae quien monta (`marcas`),
//     porque este módulo no toca la base.
//   · LOS CHIPS de 7 y 30 días del idioma elegido, solo si el tramo cubre
//     esos días (la lección de la 653: lo que no se sabe no se pinta).
//   · LA LECTURA al pasar el dedo: el día y el precio del idioma elegido.
//
// El dibujo es puro (`svgDeHistorial`) para poder probarlo en Node; el
// montaje (`montarHistorial`) es lo único que toca el DOM.
import { escapeHtml } from './html.js'
import { euros, idiomaDe, IDIOMAS_CON_PRECIO } from './cardmarket.js'

export const ANCHO = 600
export const ALTO = 200
// El de la izquierda da sitio a «193,90 €» también en el móvil (664), donde
// la letra de los ejes va un paso más grande.
const MARGEN = { arriba: 16, abajo: 24, izquierda: 72, derecha: 12 }

export const RANGOS = [
  { id: '7D', dias: 7, nombre: 'siete días' },
  { id: '1M', dias: 30, nombre: 'un mes' },
  { id: '3M', dias: 90, nombre: 'tres meses' },
  { id: '6M', dias: 180, nombre: 'seis meses' },
  { id: '1A', dias: 365, nombre: 'un año' },
  { id: 'MAX', dias: null, nombre: 'todo' },
]
export const RANGO_POR_DEFECTO = '3M'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : typeof v === 'string' && Number(v) > 0 ? Number(v) : null)
const ms = (dia) => new Date(`${String(dia).slice(0, 10)}T00:00:00Z`).getTime()
const pct1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

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

// Los idiomas con cifra PROPIA en las filas (dos puntos o más).
export function idiomasConSerie(filas) {
  return IDIOMAS_CON_PRECIO.filter((id) => (filas || []).filter((f) => num(f?.[`cm_low_${id}`])).length >= 2)
}

// Las filas de un rango: desde `dias` antes del último día. MAX, todas.
// Con menos de dos no es una línea: vacío, y quien pregunta apaga el botón.
export function filasDelRango(filas, rango) {
  const r = RANGOS.find((x) => x.id === rango)
  const todas = [...(filas || [])].filter((f) => /^\d{4}-\d{2}-\d{2}/.test(String(f?.dia))).sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
  if (!r || r.dias === null || !todas.length) return todas
  const corte = ms(todas[todas.length - 1].dia) - r.dias * 86_400_000
  const dentro = todas.filter((f) => ms(f.dia) >= corte)
  return dentro.length >= 2 ? dentro : []
}

// Qué rango se dibuja: el pedido si tiene datos; si no, el de por defecto;
// si no, el más ancho que los tenga.
export function rangoElegido(filas, rango = RANGO_POR_DEFECTO) {
  const hay = RANGOS.map((x) => ({ ...x, filas: filasDelRango(filas, x.id) }))
  return hay.find((x) => x.id === rango && x.filas.length >= 2)
    || hay.find((x) => x.id === RANGO_POR_DEFECTO && x.filas.length >= 2)
    || hay.filter((x) => x.filas.length >= 2).pop()
    || null
}

// El cambio en los últimos N días del idioma elegido, solo si el histórico
// CUBRE esos días: con tres fotos, «30 d: +20 %» afirmaría un mes que no
// existe. Devuelve { cambio, pct } o null.
export function cambioEnDias(filas, idioma, dias) {
  const serie = serieDe([...(filas || [])].sort((a, b) => String(a.dia).localeCompare(String(b.dia))), (f) => valorDeFila(f, idioma))
  if (serie.length < 2) return null
  const ultimo = serie[serie.length - 1]
  const corte = ms(ultimo.dia) - dias * 86_400_000
  const dentro = serie.filter((p) => ms(p.dia) >= corte)
  const i = serie.indexOf(dentro[0])
  // El punto de ANTES del corte si no hay uno justo en el borde: así el
  // tramo cubre los días que dice. Si ni así llega, no se afirma.
  const primero = dentro.length && ms(dentro[0].dia) > corte && i > 0 ? serie[i - 1] : dentro[0]
  if (!primero || primero === ultimo || ms(ultimo.dia) - ms(primero.dia) < dias * 86_400_000) return null
  const cambio = ultimo.valor - primero.valor
  return { cambio, pct: primero.valor > 0 ? (cambio / primero.valor) * 100 : null }
}

const tono = (c) => (c > 0 ? 'sube' : c < 0 ? 'baja' : 'igual')

export function chipsHtml(filas, idioma) {
  const chips = [[7, '7 d'], [30, '30 d']].map(([dias, rotulo]) => {
    const c = cambioEnDias(filas, idioma, dias)
    if (!c) return ''
    const texto = c.pct === null ? `${c.cambio > 0 ? '+' : ''}${euros(c.cambio)}` : `${c.pct > 0 ? '+' : ''}${pct1.format(c.pct)} %`
    return `<span class="carta-historial-chip ${tono(c.cambio)}">${rotulo} <b>${escapeHtml(texto)}</b></span>`
  }).join('')
  return chips ? `<div class="carta-historial-chips">${chips}</div>` : ''
}

// El SVG. Devuelve '' si no hay con qué dibujar.
//
// `todas`: una línea por idioma con cifra propia (el elegido, gorda).
// `marcas`: [{ dia, codigo, nombre }] de expansiones a marcar; solo las
// que caen dentro del tramo.
export function svgDeHistorial(filas, { idioma = 'es', todas = false, marcas = [] } = {}) {
  const cm = serieDe(filas, (f) => valorDeFila(f, idioma))
  const tp = serieDe(filas, (f) => num(f?.tp_market_eur))
  const otras = todas ? idiomasConSerie(filas).filter((id) => id !== idioma).map((id) => ({ id, serie: serieDe(filas, (f) => num(f?.[`cm_low_${id}`])) })) : []
  const puntos = [...cm, ...tp, ...otras.flatMap((o) => o.serie)]
  if (cm.length < 2 && tp.length < 2) return ''
  const dias = [...new Set(puntos.map((p) => p.dia))].sort()
  const t0 = ms(dias[0])
  const t1 = ms(dias[dias.length - 1])
  const valores = puntos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (dia) => (t1 === t0 ? MARGEN.izquierda + anchoUtil / 2 : MARGEN.izquierda + ((ms(dia) - t0) / (t1 - t0)) * anchoUtil)
  const y = (v) => (max === min ? MARGEN.arriba + altoUtil / 2 : MARGEN.arriba + (1 - (v - min) / (max - min)) * altoUtil)
  const linea = (serie, clase, extra = '') => (serie.length < 2 ? '' : `<polyline class="${clase}"${extra} points="${serie.map((p) => `${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}"/>`)
  const rejaY = [MARGEN.arriba, MARGEN.arriba + altoUtil / 2, MARGEN.arriba + altoUtil]
  // Las marcas de lanzamiento, dentro del tramo y sin pisarse: si dos caen
  // a menos de un 4 % del ancho, la segunda se queda sin rótulo.
  const dentro = (marcas || [])
    .filter((m) => m && /^\d{4}-\d{2}-\d{2}/.test(String(m.dia)) && ms(m.dia) >= t0 && ms(m.dia) <= t1)
    .sort((a, b) => ms(a.dia) - ms(b.dia))
  let ultimaX = -Infinity
  const marcasSvg = dentro.map((m) => {
    const xx = x(m.dia)
    const conRotulo = xx - ultimaX > ANCHO * 0.04
    if (conRotulo) ultimaX = xx
    const rotulo = m.codigo || m.nombre || ''
    return `<line class="carta-historial-marca" x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${MARGEN.arriba}" y2="${(MARGEN.arriba + altoUtil).toFixed(1)}"><title>${escapeHtml(`${m.nombre || rotulo} · ${fecha(String(m.dia).slice(0, 10))}`)}</title></line>` +
      (conRotulo && rotulo ? `<text class="carta-historial-marca-texto" x="${(xx + 3).toFixed(1)}" y="${MARGEN.arriba - 4}">${escapeHtml(String(rotulo).slice(0, 6))}</text>` : '')
  }).join('')
  // Los puntos de lectura del idioma elegido (o de TCGplayer si no hay
  // Cardmarket): [dia, valor, x %, y %], para `engancharLectura`.
  const lectura = (cm.length >= 2 ? cm : tp).map((p) => [p.dia, Number(p.valor.toFixed(2)), Number(((x(p.dia) / ANCHO) * 100).toFixed(2)), Number(((y(p.valor) / ALTO) * 100).toFixed(2))])
  return (
    `<svg viewBox="0 0 ${ANCHO} ${ALTO}" role="img" data-puntos="${escapeHtml(JSON.stringify(lectura))}" aria-label="${escapeHtml(`Histórico: de ${euros(min)} a ${euros(max)} entre el ${fecha(dias[0])} y el ${fecha(dias[dias.length - 1])}`)}">` +
    rejaY.map((yy) => `<line class="carta-historial-reja" x1="${MARGEN.izquierda}" x2="${ANCHO - MARGEN.derecha}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>`).join('') +
    marcasSvg +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda - 6}" y="${(MARGEN.arriba + 4).toFixed(1)}" text-anchor="end">${escapeHtml(euros(max))}</text>` +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda - 6}" y="${(MARGEN.arriba + altoUtil + 4).toFixed(1)}" text-anchor="end">${escapeHtml(euros(min))}</text>` +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda}" y="${ALTO - 6}">${escapeHtml(fecha(dias[0]))}</text>` +
    `<text class="carta-historial-eje" x="${ANCHO - MARGEN.derecha}" y="${ALTO - 6}" text-anchor="end">${escapeHtml(fecha(dias[dias.length - 1]))}</text>` +
    linea(tp, 'carta-historial-linea carta-historial-linea-tp') +
    otras.map((o) => linea(o.serie, 'carta-historial-linea carta-historial-linea-otra', ` data-idioma="${o.id}"`)).join('') +
    linea(cm, 'carta-historial-linea', IDIOMAS_CON_PRECIO.includes(idioma) && cm.some((p, i) => num(filas?.[i]?.[`cm_low_${idioma}`])) ? ` data-idioma="${idioma}"` : '') +
    '</svg>'
  )
}

// La leyenda: un chip por idioma dibujado, con su color (lo pone el CSS
// por `data-idioma`), el elegido marcado; y TCGplayer si está.
export function leyendaHtml(filas, idioma, { todas = false } = {}) {
  const ids = todas ? idiomasConSerie(filas) : idiomasConSerie(filas).filter((id) => id === idioma)
  // La línea elegida se llama «Cardmarket» (667, PINGU: «en vez de inglés
  // pon Cardmarket en azul»); las otras, por su idioma.
  const partes = ids.map((id) => `<span class="carta-historial-leyenda-item${id === idioma ? ' elegido' : ''}" data-idioma="${id}"><i></i>${id === idioma ? 'Cardmarket' : escapeHtml(idiomaDe(id).nombre)}</span>`)
  if (serieDe(filas, (f) => num(f?.tp_market_eur)).length >= 2) partes.push('<span class="carta-historial-leyenda-item" data-idioma="tp"><i></i>TCGplayer</span>')
  return partes.length ? `<div class="carta-historial-leyenda">${partes.join('')}</div>` : ''
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

export function botonesDeRango(filas, elegido) {
  return `<div class="carta-historial-rangos" role="group" aria-label="En cuántos días se mira">${RANGOS.map((r) => {
    const puede = filasDelRango(filas, r.id).length >= 2
    const puesto = elegido && r.id === elegido.id
    return `<button type="button" class="carta-historial-rango${puesto ? ' activo' : ''}" data-rango="${r.id}"${puede ? '' : ' disabled'} aria-pressed="${puesto ? 'true' : 'false'}" aria-label="Ver ${escapeHtml(r.nombre)}">${r.id}</button>`
  }).join('')}</div>`
}

// Las marcas de lanzamiento, con el cliente de Supabase que le pase quien
// monta: las expansiones GRANDES (cien cartas o más) del mercado de la
// carta, con fecha. Este módulo no importa Supabase a propósito.
export function cargadorDeMarcas(supabase, mercado = 'WEST') {
  return async (desde, hasta) => {
    try {
      const { data } = await supabase
        .from('tcg_sets')
        .select('id,name,name_en,tcg_online_code,release_date,card_count_official,card_count_total')
        .eq('market', mercado)
        .gte('release_date', desde)
        .lte('release_date', hasta)
        .order('release_date')
        .limit(200)
      return (data || [])
        .filter((s) => (s.card_count_official || s.card_count_total || 0) >= 100 && s.release_date)
        .map((s) => ({ dia: String(s.release_date).slice(0, 10), codigo: s.tcg_online_code || '', nombre: s.name_en || s.name || s.id }))
    } catch {
      return []
    }
  }
}

// La lectura al pasar el dedo (misma forma que la gráfica del valor de la
// colección, 653): los puntos vienen en `data-puntos` del SVG.
export function engancharLectura(lienzo) {
  if (!lienzo || lienzo.dataset.lectura) return
  const svg = lienzo.querySelector('svg')
  let puntos = []
  try { puntos = JSON.parse(svg?.dataset.puntos || '[]') } catch { puntos = [] }
  if (puntos.length < 2) return
  lienzo.dataset.lectura = '1'
  const lectura = lienzo.querySelector('.carta-historial-lectura')
  const globo = lienzo.querySelector('.carta-historial-globo')
  if (!lectura || !globo) return
  const leer = (e) => {
    const caja = lienzo.getBoundingClientRect()
    if (!caja.width) return
    const pct = Math.min(100, Math.max(0, ((e.clientX - caja.left) / caja.width) * 100))
    let i = 0
    let mejor = Infinity
    for (let k = 0; k < puntos.length; k++) {
      const d = Math.abs(puntos[k][2] - pct)
      if (d < mejor) { mejor = d; i = k }
    }
    const [dia, valor, px, py] = puntos[i]
    lienzo.style.setProperty('--lx', `${px}%`)
    lienzo.style.setProperty('--ly', `${py}%`)
    lectura.classList.toggle('a-la-izquierda', px > 60)
    globo.innerHTML = `<b>${escapeHtml(euros(valor))}</b> ${escapeHtml(fecha(dia))}`
    lectura.hidden = false
  }
  const soltar = () => { lectura.hidden = true }
  lienzo.addEventListener('pointermove', leer)
  lienzo.addEventListener('pointerdown', leer)
  lienzo.addEventListener('pointerleave', soltar)
  lienzo.addEventListener('pointercancel', soltar)
}

// Monta la gráfica en `caja` y devuelve la función para repintarla (al
// cambiar de idioma). `idiomaActual` se consulta cada vez. `marcas(desde,
// hasta)` trae los lanzamientos del tramo; sin ella, sin marcas.
// `url` (769): la de un producto sellado, que tiene su propia función; la
// gráfica es la misma.
export async function montarHistorial(caja, cardId, idiomaActual = () => 'es', { marcas = null, rango = RANGO_POR_DEFECTO, url = null } = {}) {
  if (!caja || !cardId) return () => {}
  let filas = []
  try {
    const res = await fetch(url || `/.netlify/functions/tcggo-historial?card=${encodeURIComponent(cardId)}`, { headers: { accept: 'application/json' } })
    const r = res.ok ? await res.json() : null
    filas = Array.isArray(r?.filas) ? r.filas : []
  } catch {
    filas = []
  }
  let rangoPuesto = rango
  let marcasTodas = null
  const pintar = () => {
    const idioma = idiomaActual()
    const elegido = rangoElegido(filas, rangoPuesto)
    const tramo = elegido ? elegido.filas : filas
    const svg = svgDeHistorial(tramo, { idioma, todas: true, marcas: marcasTodas || [] })
    if (!svg) {
      caja.classList.add('hidden')
      caja.innerHTML = ''
      return
    }
    caja.innerHTML = `<p class="carta-historial-titulo">Histórico de precios</p>${chipsHtml(filas, idioma)}<div class="carta-historial-lienzo">${svg}<div class="carta-historial-lectura" hidden aria-hidden="true"><span class="carta-historial-globo"></span></div></div>${leyendaHtml(tramo, idioma, { todas: true })}${botonesDeRango(filas, elegido)}`
    caja.classList.remove('hidden')
    engancharLectura(caja.querySelector('.carta-historial-lienzo'))
  }
  if (!caja.dataset.rangos) {
    caja.dataset.rangos = '1'
    caja.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rango]')
      if (!b || b.disabled) return
      rangoPuesto = b.dataset.rango
      pintar()
    })
  }
  pintar()
  // Las marcas llegan después y repintan: la gráfica no espera a la base.
  if (typeof marcas === 'function' && filas.length >= 2) {
    const dias = filas.map((f) => String(f.dia).slice(0, 10)).sort()
    marcas(dias[0], dias[dias.length - 1]).then((m) => {
      if (Array.isArray(m) && m.length) { marcasTodas = m; pintar() }
    }).catch(() => {})
  }
  return pintar
}
