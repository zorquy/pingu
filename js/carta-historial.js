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
//   · UNA LÍNEA POR SERIE, y se eligen (1062, PINGU: «faltan idiomas, los
//     colores no coinciden, no lo entiendo»): botones con su color y su
//     bandera encienden y apagan cada una. De serie, tu idioma y «Cualquier
//     idioma» (el mínimo general); TCGplayer (EE. UU.) apagado y a trazos,
//     que a otra escala aplastaba las de Cardmarket. Cada serie SOLO con sus
//     datos: caer al general cuando faltaba tu idioma hacía saltar la raya y
//     decía «+586 %» sin que nada subiera.
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
// En el eje, de 100 € para arriba sin céntimos: «2.322,50 €» no cabe en el móvil.
const ejeEuros = (v) => (v >= 100 ? `${Math.round(v).toLocaleString('es-ES')} €` : euros(v))
const pct1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// El valor de una fila para un idioma: el suyo si lo tiene, si no el general.
export function valorDeFila(fila, idioma) {
  if (idioma === 'todos') return num(fila?.cm_low)
  return IDIOMAS_CON_PRECIO.includes(idioma) ? num(fila?.[`cm_low_${idioma}`]) : null
}

// Las series que se pueden enseñar, en orden: el idioma de la carta, «cualquier
// idioma» (el mínimo general de Cardmarket) y los demás idiomas con cifra.
// El inglés de TCGGO ES el general (no lo da aparte): no se ofrece dos veces.
export function seriesDisponibles(filas, idioma) {
  if (idioma === 'en') idioma = 'todos'
  const ids = IDIOMAS_CON_PRECIO.filter((id) => id !== 'en' && serieDe(filas, (f) => valorDeFila(f, id)).length >= 2)
  const general = serieDe(filas, (f) => num(f?.cm_low)).length >= 2 ? ['todos'] : []
  const orden = idioma === 'todos' ? [...general, ...ids] : [...(ids.includes(idioma) ? [idioma] : []), ...general, ...ids.filter((id) => id !== idioma)]
  if (serieDe(filas, (f) => num(f?.tp_market_eur)).length >= 2) orden.push('tp')
  return orden
}
const nombreSerie = (id, general = 'Cualquier idioma') => (id === 'todos' ? general : id === 'tp' ? 'TCGplayer (EE. UU.)' : idiomaDe(id).nombre)
const valorSerie = (f, id) => (id === 'tp' ? num(f?.tp_market_eur) : valorDeFila(f, id))

const fecha = (dia, conAnio = false) => {
  const d = new Date(`${dia}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? String(dia) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

// Los puntos de una serie: [{ dia, valor }] solo con los días que tienen cifra.
export function serieDe(filas, tomar) {
  return (filas || []).map((f) => ({ dia: String(f.dia), valor: tomar(f) })).filter((p) => p.valor !== null && /^\d{4}-\d{2}-\d{2}/.test(p.dia))
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
  const serie = serieDe([...(filas || [])].sort((a, b) => String(a.dia).localeCompare(String(b.dia))), (f) => valorSerie(f, idioma))
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
// `visibles`: las series a dibujar, la primera gorda (sin ella, tu idioma y
// el general, como al abrir).
// `marcas`: [{ dia, codigo, nombre }] de expansiones a marcar; solo las
// que caen dentro del tramo. `alto`: el dibujo más bajo para la ficha del
// ordenador (923), que tiene que caber sin desplazarse; el texto no se
// deforma porque el SVG no se estira, se dibuja con otra proporción.
export function svgDeHistorial(filas, { idioma = 'es', visibles = null, marcas = [], alto = ALTO } = {}) {
  const ids = visibles || seriesDisponibles(filas, idioma).filter((id) => id !== 'tp').slice(0, 2)
  const series = ids.map((id) => ({ id, serie: serieDe(filas, (f) => valorSerie(f, id)) })).filter((x) => x.serie.length >= 2)
  if (!series.length) return ''
  const puntos = series.flatMap((x) => x.serie)
  const dias = [...new Set(puntos.map((p) => p.dia))].sort()
  const t0 = ms(dias[0]); const t1 = ms(dias[dias.length - 1])
  const conAnio = t1 - t0 > 200 * 86_400_000
  const valores = puntos.map((p) => p.valor)
  let min = Math.min(...valores); let max = Math.max(...valores)
  if (max === min) { min *= 0.9; max *= 1.1 }
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const altoUtil = alto - MARGEN.arriba - MARGEN.abajo
  const x = (dia) => (t1 === t0 ? MARGEN.izquierda + anchoUtil / 2 : MARGEN.izquierda + ((ms(dia) - t0) / (t1 - t0)) * anchoUtil)
  const y = (v) => MARGEN.arriba + (1 - (v - min) / (max - min)) * altoUtil
  const rejaY = [0, 0.5, 1].map((k) => MARGEN.arriba + k * altoUtil)
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
    return `<line class="carta-historial-marca" x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${MARGEN.arriba}" y2="${(MARGEN.arriba + altoUtil).toFixed(1)}"><title>${escapeHtml(`${m.nombre || rotulo} · ${fecha(String(m.dia).slice(0, 10), true)}`)}</title></line>` +
      (conRotulo && rotulo ? `<text class="carta-historial-marca-texto" x="${(xx + 3).toFixed(1)}" y="${MARGEN.arriba - 4}">${escapeHtml(String(rotulo).slice(0, 6))}</text>` : '')
  }).join('')
  // Cada serie: su línea y un punto en cada muestra (un tramo sin muestras
  // se ve como lo que es: una recta entre dos puntos, no un precio quieto).
  const dibujo = series.map(({ id, serie }, k) => {
    const clase = `carta-historial-linea${k === 0 ? ' principal' : ''}${id === 'tp' ? ' carta-historial-linea-tp' : ''}`
    const pts = serie.map((p) => `${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`)
    return `<polyline class="${clase}" data-serie="${id}" points="${pts.join(' ')}"/>` + (serie.length <= 60 ? serie.map((p) => `<circle class="carta-historial-punto" data-serie="${id}" cx="${x(p.dia).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="${k === 0 ? 2.5 : 2}"/>`).join('') : '')
  }).reverse().join('')
  const principal = series[0].serie
  const lectura = principal.map((p) => [p.dia, Number(p.valor.toFixed(2)), Number(((x(p.dia) / ANCHO) * 100).toFixed(2)), Number(((y(p.valor) / alto) * 100).toFixed(2))])
  return (
    `<svg viewBox="0 0 ${ANCHO} ${alto}" role="img" data-puntos="${escapeHtml(JSON.stringify(lectura))}" aria-label="${escapeHtml(`Histórico: de ${euros(min)} a ${euros(max)} entre el ${fecha(dias[0], true)} y el ${fecha(dias[dias.length - 1], true)}`)}">` +
    rejaY.map((yy) => `<line class="carta-historial-reja" x1="${MARGEN.izquierda}" x2="${ANCHO - MARGEN.derecha}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>`).join('') +
    marcasSvg +
    [max, (max + min) / 2, min].map((v, k) => `<text class="carta-historial-eje" x="${MARGEN.izquierda - 6}" y="${(rejaY[k] + 4).toFixed(1)}" text-anchor="end">${escapeHtml(ejeEuros(v))}</text>`).join('') +
    `<text class="carta-historial-eje" x="${MARGEN.izquierda}" y="${alto - 6}">${escapeHtml(fecha(dias[0], conAnio))}</text>` +
    `<text class="carta-historial-eje" x="${ANCHO - MARGEN.derecha}" y="${alto - 6}" text-anchor="end">${escapeHtml(fecha(dias[dias.length - 1], conAnio))}</text>` +
    dibujo + '</svg>'
  )
}

// Los mandos de las series: un botón por serie que se enciende y se apaga,
// con su color (el mismo que su línea, por `data-serie`) y su bandera.
export function mandosHtml(filas, idioma, visibles, { general } = {}) {
  return `<div class="carta-historial-series" role="group" aria-label="Qué líneas ver">${seriesDisponibles(filas, idioma).map((id) => `<button type="button" class="carta-historial-serie" data-serie="${id}" aria-pressed="${visibles.includes(id)}"><i></i>${IDIOMAS_CON_PRECIO.includes(id) ? `<span class="pv-bandera" data-idioma="${id}"></span>` : ''}${escapeHtml(nombreSerie(id, general))}${id === idioma || (idioma === 'en' && id === 'todos') ? ' <small>(la tuya)</small>' : ''}</button>`).join('')}</div>`
}

// De dónde sale, en una línea: la gente pregunta.
export function origenHtml(filas) {
  const fotos = (filas || []).filter((f) => f.origen === 'foto').length
  const primero = (filas || [])[0]?.dia
  return primero ? `<p class="carta-historial-origen">Mínimo Near Mint de Cardmarket en cada idioma${fotos ? ': una muestra al día' : ''}${(filas || []).length > fotos ? '; antes, las fechas sueltas que da TCGGO' : ''}. Desde el ${escapeHtml(fecha(String(primero), true))}.</p>` : ''
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
export async function montarHistorial(caja, cardId, idiomaActual = () => 'es', { marcas = null, rango = RANGO_POR_DEFECTO, url = null, alto = ALTO } = {}) {
  if (!caja || !cardId) return () => {}
  let filas = []
  try {
    const res = await fetch(url || `/.netlify/functions/tcggo-historial?card=${encodeURIComponent(cardId)}`, { headers: { accept: 'application/json' } })
    const r = res.ok ? await res.json() : null
    filas = Array.isArray(r?.filas) ? r.filas : []
  } catch {
    filas = []
  }
  // Sin rango pedido, el de siempre (3 meses) o, si tu idioma tiene menos, el
  // más corto que lo cubre entero: con 14 días de español, uno largo lo deja
  // en una esquina.
  let rangoPuesto = rango
  if (!rango || rango === RANGO_POR_DEFECTO) {
    const hay = seriesDisponibles(filas, idiomaActual())
    const serie = hay.length ? serieDe(filas, (f) => valorSerie(f, hay[0])) : []
    if (serie.length >= 2) {
      const desde = ms(serie[0].dia)
      const cubre = RANGOS.find((r) => { const fs = filasDelRango(filas, r.id); return fs.length >= 2 && ms(fs[0].dia) <= desde })
      const deSiempre = RANGOS.find((r) => r.id === RANGO_POR_DEFECTO)
      if (cubre && cubre.dias !== null && cubre.dias < deSiempre.dias) rangoPuesto = cubre.id
    }
  }
  let marcasTodas = null
  let visibles = null
  let idiomaPintado = null
  const pintar = () => {
    const idioma = idiomaActual()
    // Otro idioma en la ficha: vuelven las series de serie del nuevo.
    if (idioma !== idiomaPintado) { visibles = null; idiomaPintado = idioma }
    const elegido = rangoElegido(filas, rangoPuesto)
    const tramo = elegido ? elegido.filas : filas
    const hay = seriesDisponibles(tramo, idioma)
    visibles = (visibles || hay.filter((id) => id !== 'tp').slice(0, 2)).filter((id) => hay.includes(id))
    if (!visibles.length && hay.length) visibles = [hay[0]]
    const svg = svgDeHistorial(tramo, { idioma, visibles, marcas: marcasTodas || [], alto })
    if (!svg) {
      caja.classList.add('hidden')
      caja.innerHTML = ''
      return
    }
    caja.innerHTML = `<p class="carta-historial-titulo" title="${escapeHtml(origenHtml(filas).replace(/<[^>]+>/g, ''))}">Histórico de precios</p>${chipsHtml(filas, visibles[0])}${mandosHtml(tramo, idioma, visibles, { general: url ? 'Cardmarket' : undefined })}<div class="carta-historial-lienzo">${svg}<div class="carta-historial-lectura" hidden aria-hidden="true"><span class="carta-historial-globo"></span></div></div>${botonesDeRango(filas, elegido)}${origenHtml(filas)}`
    caja.classList.remove('hidden')
    engancharLectura(caja.querySelector('.carta-historial-lienzo'))
  }
  if (!caja.dataset.rangos) {
    caja.dataset.rangos = '1'
    caja.addEventListener('click', (e) => {
      const sb = e.target.closest('.carta-historial-serie')
      if (sb) {
        const id = sb.dataset.serie
        visibles = visibles.includes(id) ? (visibles.length > 1 ? visibles.filter((v) => v !== id) : visibles) : [...visibles, id]
        pintar()
        return
      }
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
