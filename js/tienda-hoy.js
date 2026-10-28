// /tienda → Hoy (tanda 1073): lo que vendió y ganó la tienda en el periodo
// (hoy, la semana, el mes o el año), contra el anterior a la misma altura;
// la gráfica de sus ventas, el valor del stock, los avisos, lo que busca la
// gente y tiene (solo cuántos: PINGU no quiso nombres) y las visitas a su
// escaparate. Todo sale de UNA llamada (`tienda_hoy`) más las tres últimas
// ventas; y debajo, las cifras de la 1083 (`tienda_cifras`). Entra por
// `import()`: quien no es tienda no lo baja.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { nombreDeSet } from './catalogo-series.js'
import { PERIODOS_HOY, periodoDeHoy, comparacion, DONDE_VENTA } from './tiendas-puro.js'
import { detalleDeLinea } from './tienda-vender.js'

const CLAVE = 'pd-tienda-periodo'
const est = { periodo: 'hoy', pedido: 0, top: 'cartas', cifras: null }
const sets = new Map()
const nombreSet = (id) => sets.get(id) || id
let caja = null
const $ = (sel) => caja.querySelector(sel)

// Los avisos llevan al Stock con su filtro (los de `tienda_cumple`).
export const FILTROS_DE_AVISO = {
  debajo: { contra: ['debajo'] },
  pierden: { margen: ['pierdes'] },
  viejas: { dias: ['90+'] },
  agotadas: { unidades: ['agotadas'] },
  // Desde la Colección → Productos (1076): lo sellado del stock.
  sellado: { catalogo: ['sellado'] },
}
const AVISOS = [
  ['debajo', 'tdh-ambar', (n) => `${n} por debajo de Cardmarket`],
  ['pierden', 'tdh-rojo', (n) => `${n} ${n === 1 ? 'vende' : 'venden'} con pérdida`],
  ['viejas', 'tdh-gris', (n) => `${n} ${n === 1 ? 'lleva' : 'llevan'} más de 90 días`],
  ['agotadas', 'tdh-gris', (n) => `${n} ${n === 1 ? 'agotada' : 'agotadas'}`],
]

function leerPeriodo() {
  try { return localStorage.getItem(CLAVE) || 'hoy' } catch { return 'hoy' }
}

// Lo que dice cada trozo de la gráfica: «18 h», «lun 22», «oct».
export function rotuloDePaso(t, paso, corto = false) {
  const [f, h] = String(t).split('T')
  const [a, m, d] = f.split('-').map(Number)
  const fecha = new Date(a, m - 1, d)
  if (paso === 'hour') return `${Number(h.slice(0, 2))} h`
  if (paso === 'month') return fecha.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  return corto ? String(d) : fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

function graficaHtml(serie, paso) {
  const max = Math.max(0, ...serie.map((s) => Number(s.importe) || 0))
  if (!max) return '<p class="tdh-sin">Sin ventas en este periodo.</p>'
  const iMax = serie.findIndex((s) => Number(s.importe) === max)
  return `<div class="tdh-barras" role="img" aria-label="Ventas por ${paso === 'hour' ? 'hora' : paso === 'month' ? 'mes' : 'día'}: la mayor, ${euros(max)} (${escapeHtml(rotuloDePaso(serie[iMax].t, paso))})">
    ${serie.map((s, i) => {
      const v = Number(s.importe) || 0
      const alto = v ? Math.max(4, Math.round((v / max) * 100)) : 0
      return `<span class="tdh-barra${i === iMax ? ' tdh-barra-max' : ''}" title="${escapeHtml(rotuloDePaso(s.t, paso))} · ${euros(v)}">${i === iMax ? `<b class="tdh-barra-cifra">${euros(v)}</b>` : ''}<i style="height:${alto}%"></i></span>`
    }).join('')}
  </div>
  <div class="tdh-eje"><span>${escapeHtml(rotuloDePaso(serie[0].t, paso))}</span><span>${escapeHtml(rotuloDePaso(serie.at(-1).t, paso))}</span></div>`
}

// Una cifra (1078): su icono en un círculo del color de la sección, el
// número grande y debajo cómo va contra el periodo anterior (con su flecha)
// o lo que la explica.
function cifraHtml(titulo, valor, sub, clase = '', icono = '') {
  const flecha = sub?.clase === 'tdh-sube' ? '▲ ' : sub?.clase === 'tdh-baja' ? '▼ ' : ''
  return `<div class="tdh-cifra"><span class="tdh-cifra-icono" aria-hidden="true">${icono}</span><small>${titulo}</small><b class="${clase}">${valor}</b>${sub ? `<span class="${sub.clase || ''}">${flecha}${escapeHtml(sub.texto)}</span>` : ''}</div>`
}

function pintar(d, ultimas) {
  const p = periodoDeHoy(est.periodo)
  const a = d.actual || {}
  const b = d.anterior || null
  const margen = a.coste > 0 && a.beneficio != null ? Math.round((a.beneficio / a.coste) * 100) : null
  const cmp = comparacion(a.importe, b?.importe, p.frente)
  const s = d.stock || {}
  $('.tdh-cifras').innerHTML = [
    cifraHtml('Vendido', euros(a.importe || 0), cmp ? { texto: cmp.texto, clase: cmp.sube === false ? 'tdh-baja' : cmp.sube ? 'tdh-sube' : '' } : { texto: `${a.ventas || 0} ${a.ventas === 1 ? 'venta' : 'ventas'}` }, '', icons.coins(20)),
    cifraHtml('Beneficio', a.beneficio == null ? '—' : `${a.beneficio > 0 ? '+' : ''}${euros(a.beneficio)}`, { texto: a.sin_coste ? `${a.sin_coste} sin coste, fuera de la cuenta` : 'sobre lo que pagaste' }, a.beneficio < 0 ? 'tdh-rojo-texto' : '', icons.trendingUp(20)),
    cifraHtml('Margen medio', margen == null ? '—' : `${margen} %`, { texto: 'sobre lo pagado' }, '', icons.target(20)),
    cifraHtml('Valor del stock', euros(s.valor || 0), { texto: `a tu precio · ${s.unidades || 0} uds.${s.cm ? ` · Cardmarket ${euros(s.cm)}` : ''}` }, '', icons.package(20)),
  ].join('')

  $('.tdh-grafica-titulo').textContent = { hoy: 'Ventas de hoy', semana: 'Ventas de la semana', mes: 'Ventas del mes', anio: 'Ventas del año' }[est.periodo]
  $('.tdh-grafica').innerHTML = graficaHtml(d.serie || [], p.paso)
  const NOMBRE_DONDE = Object.fromEntries(DONDE_VENTA)
  $('.tdh-sub').hidden = !(ultimas || []).length
  $('.tdh-ultimas').innerHTML = (ultimas || []).map((f) => {
    const ben = f.coste == null ? null : Math.round((Number(f.precio) - Number(f.coste)) * f.unidades * 100) / 100
    return `<li><span><strong>${escapeHtml(f.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(f, nombreSet))} · ${escapeHtml(NOMBRE_DONDE[f.donde] || f.donde)}</small></span><b>${euros(Number(f.precio) * f.unidades)}${ben == null ? '' : `<small class="${ben < 0 ? 'tdh-rojo-texto' : 'tdh-verde'}">${ben > 0 ? '+' : ''}${euros(ben)}</small>`}</b></li>`
  }).join('')

  const avisos = AVISOS.filter(([k]) => d.avisos?.[k] > 0)
  $('.tdh-avisos').innerHTML = avisos.length
    ? avisos.map(([k, clase, texto]) => `<a class="tdh-aviso ${clase}" href="/tienda?ver=stock&filtro=${k}" data-ver="stock" data-filtro="${k}">${icons.triangleAlert(16)}<span>${escapeHtml(texto(d.avisos[k]))}</span>${icons.chevronRight(16)}</a>`).join('')
    : `<p class="tdh-bien">${icons.checkCircle(18)}<span>Todo en orden: nada por debajo de Cardmarket, nada con pérdida.</span></p>`

  const dem = d.demanda || []
  $('.tdh-demanda').innerHTML = dem.length
    ? dem.map((x) => `<li><span><strong>${escapeHtml(x.nombre || x.card_id)}</strong><small>${escapeHtml([x.set_id ? nombreSet(x.set_id) : '', x.numero].filter(Boolean).join(' · '))}</small></span><span class="tdh-quieren" title="${x.quieren} ${x.quieren === 1 ? 'persona la tiene' : 'personas la tienen'} en «La quiero»">${icons.heart(14)} ${x.quieren}</span><small class="tdh-tienes">tienes ${x.tienes}</small></li>`).join('')
    : '<li class="tdh-sin">Nadie tiene en su lista nada de lo que enseñas ahora.</li>'

  const v = d.visitas || {}
  const cv = comparacion(v.actual, v.anterior, p.frente.replace('a esta hora', 'en todo el día'))
  $('.tdh-visitas').innerHTML = `<b>${v.actual || 0}</b> ${v.actual === 1 ? 'visita' : 'visitas'}${v.qr ? ` · ${v.qr} desde el QR` : ''}${cv ? `<small class="${cv.sube === false ? 'tdh-baja' : cv.sube ? 'tdh-sube' : ''}">${escapeHtml(cv.texto)}</small>` : ''}`
  // Cuánto stock tiene, en la cabecera de /tienda (fuera de esta caja).
  const st = document.querySelector('[data-tdh-stock]')
  if (st) st.textContent = `${(s.lineas || 0).toLocaleString('es-ES')} ${s.lineas === 1 ? 'línea' : 'líneas'} · ${(s.unidades || 0).toLocaleString('es-ES')} uds.`
}

// Las cifras de la 1083: lo más vendido (por carta o por expansión), lo que
// no rota y el valor del stock en el tiempo. Sin la migración 1079 el bloque
// no sale (no es «no hay nada»: es que no se puede preguntar).
function cifrasHtml(c) {
  const lista = est.top === 'sets' ? c.sets || [] : c.cartas || []
  const top = lista.length
    ? `<ol class="tdh-top">${lista.map((x, i) => `<li><span class="tdh-top-n">${i + 1}</span><span><strong>${escapeHtml(est.top === 'sets' ? nombreSet(x.set_id) || x.nombre || x.set_id : x.nombre || x.card_id || 'Producto')}</strong><small>${est.top === 'sets' ? `${x.cartas} ${x.cartas === 1 ? 'carta distinta' : 'cartas distintas'}` : escapeHtml([x.set_id ? nombreSet(x.set_id) : x.product_id ? 'Sellado' : '', x.numero].filter(Boolean).join(' · '))}</small></span><b>${x.unidades} ${x.unidades === 1 ? 'ud.' : 'uds.'}<small>${euros(x.importe || 0)}</small></b></li>`).join('')}</ol>`
    : '<p class="tdh-sin">Sin ventas en este periodo.</p>'
  const q = c.quietas || {}
  const quietas = q.lineas
    ? `<p class="tdh-quietas-total"><b>${euros(q.valor || 0)}</b> parados en ${q.lineas} ${q.lineas === 1 ? 'línea' : 'líneas'} (${q.unidades} uds.)</p>
      <ul class="tdh-quietas">${(q.filas || []).slice(0, 5).map((x) => `<li><span><strong>${escapeHtml(x.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(x, nombreSet))} · ${Math.floor((Date.now() - new Date(x.entro_el)) / 864e5)} días</small></span><b>${x.precio == null ? '—' : euros(Number(x.precio) * x.unidades)}</b></li>`).join('')}</ul>
      <a class="tdh-ir" href="/tienda?ver=stock&filtro=viejas" data-ver="stock" data-filtro="viejas">Verlas en el stock ${icons.chevronRight(14)}</a>`
    : `<p class="tdh-bien">${icons.checkCircle(18)}<span>Todo rota: nada lleva más de 90 días sin venderse.</span></p>`
  return `
    <section class="tdh-tarjeta">
      <h3>${icons.trophy(18)} Lo más vendido</h3>
      <div class="tdvt-chips" role="group" aria-label="Por"><button type="button" class="tdvt-chip" data-top="cartas" aria-pressed="${est.top !== 'sets'}">Cartas</button><button type="button" class="tdvt-chip" data-top="sets" aria-pressed="${est.top === 'sets'}">Expansiones</button></div>
      ${top}
    </section>
    <section class="tdh-tarjeta">
      <h3>${icons.snowflake(18)} Lo que no rota</h3>
      <p class="tdh-nota">Más de 90 días en tu stock sin vender una sola unidad; lo que más dinero tiene parado, primero.</p>
      ${quietas}
    </section>
    <section class="tdh-tarjeta">
      <h3>${icons.trendingUp(18)} Valor del stock</h3>
      ${valorHtml(c.valor || [])}
    </section>`
}

// La curva del valor (a tu precio), un punto por día que se abrió el Panel.
// Los textos van en HTML y no en el SVG estirado (la 653).
function valorHtml(serie) {
  const puntos = serie.map((x) => ({ dia: x.dia, v: Number(x.valor) || 0, cm: Number(x.cm) || 0 }))
  const ultimo = puntos.at(-1)
  if (puntos.length < 2) {
    return `${ultimo ? `<p class="tdh-valor-hoy"><b>${euros(ultimo.v)}</b> hoy</p>` : ''}<p class="tdh-nota">Se apunta un punto cada día que abres el Panel: en unos días verás aquí cómo cambia.</p>`
  }
  const max = Math.max(...puntos.map((x) => x.v))
  const min = Math.min(...puntos.map((x) => x.v))
  const alto = (v) => (max === min ? 50 : 92 - ((v - min) / (max - min)) * 84)
  const xs = (i) => (i / (puntos.length - 1)) * 100
  const linea = puntos.map((x, i) => `${xs(i).toFixed(2)},${alto(x.v).toFixed(2)}`).join(' ')
  const primero = puntos[0]
  const cambio = comparacion(ultimo.v, primero.v, `desde el ${new Date(primero.dia).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`)
  const fecha = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `<p class="tdh-valor-hoy"><b>${euros(ultimo.v)}</b>${cambio ? ` <small class="${cambio.sube === false ? 'tdh-baja' : cambio.sube ? 'tdh-sube' : ''}">${escapeHtml(cambio.texto)}</small>` : ''}</p>
    <div class="tdh-valor" role="img" aria-label="Valor del stock: de ${euros(primero.v)} el ${fecha(primero.dia)} a ${euros(ultimo.v)} el ${fecha(ultimo.dia)}">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,100 ${linea} 100,100" class="tdh-valor-area" /><polyline points="${linea}" class="tdh-valor-linea" /></svg>
    </div>
    <div class="tdh-eje"><span>${fecha(primero.dia)}</span><span>${fecha(ultimo.dia)}</span></div>
    ${ultimo.cm ? `<p class="tdh-nota">En Cardmarket, hoy: ${euros(ultimo.cm)}</p>` : ''}`
}

async function completarSets(ids) {
  const faltan = [...new Set(ids.filter((id) => id && !sets.has(id)))]
  if (!faltan.length) return
  const { data } = await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', faltan)
  for (const s of data || []) sets.set(s.id, nombreDeSet(s) || s.id)
}

async function pedir() {
  const yo = ++est.pedido
  const p = periodoDeHoy(est.periodo)
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  const [r, u, c] = await Promise.all([
    supabase.rpc('tienda_hoy', { p_desde: p.desde, p_hasta: p.hasta, p_antes_desde: p.antesDesde, p_antes_hasta: p.antesHasta, p_paso: p.paso, p_zona: zona }),
    supabase.rpc('tienda_ventas_lista', { p_filtros: { desde: p.desde, hasta: p.hasta }, p_desde: 0, p_cuantas: 3 }),
    // La foto del día va antes que las cifras, para que la curva llegue a hoy.
    supabase.rpc('tienda_apuntar_valor', { p_zona: zona }).then(() => supabase.rpc('tienda_cifras', { p_desde: p.desde, p_hasta: p.hasta }), () => ({ data: null })),
  ])
  if (yo !== est.pedido) return
  est.cifras = c?.error ? null : c?.data || null
  if (r.error || !r.data) {
    const sin = ['PGRST202', '42883'].includes(r.error?.code) || /Could not find/i.test(r.error?.message || '')
    caja.querySelector('.tdh-cuerpo').innerHTML = `<p class="tdh-sin">${sin ? 'Falta un paso en la base para ver tus cifras (las migraciones 1072 y 1073).' : 'No se han podido traer tus cifras. Recarga la página.'}</p>`
    return
  }
  await completarSets([...(r.data.demanda || []).map((x) => x.set_id), ...((u.data?.filas) || []).map((f) => f.set_id), ...['cartas', 'sets'].flatMap((k) => (est.cifras?.[k] || []).map((x) => x.set_id)), ...(est.cifras?.quietas?.filas || []).map((x) => x.set_id)])
  if (yo !== est.pedido) return
  pintar(r.data, u.data?.filas || [])
  pintarCifras()
}

function pintarCifras() {
  const tres = $('.tdh-tres')
  tres.hidden = !est.cifras
  tres.innerHTML = est.cifras ? cifrasHtml(est.cifras) : ''
}

export function montarHoy(destino) {
  caja = destino
  est.periodo = leerPeriodo()
  caja.innerHTML = `
    <div class="tdh">
      <div class="tdh-cab">
        <h2>Cómo va</h2>
        <div class="tdvt-chips" role="group" aria-label="Periodo">${PERIODOS_HOY.map(([v, t]) => `<button type="button" class="tdvt-chip" data-periodo="${v}" aria-pressed="${v === est.periodo}">${t}</button>`).join('')}</div>
      </div>
      <div class="tdh-cuerpo">
        <div class="tdh-cifras"></div>
        <div class="tdh-dos">
          <section class="tdh-tarjeta tdh-tarjeta-grafica">
            <h3><span class="tdh-grafica-titulo">Ventas</span> <a class="tdh-ir" href="/tienda?ver=ventas" data-ver="ventas">Ver ventas ${icons.chevronRight(14)}</a></h3>
            <div class="tdh-grafica"></div>
            <h4 class="tdh-sub">Últimas ventas</h4>
            <ul class="tdh-ultimas"></ul>
          </section>
          <div class="tdh-col">
            <section class="tdh-tarjeta"><h3>${icons.triangleAlert(18)} Necesita atención</h3><div class="tdh-avisos"></div></section>
            <section class="tdh-tarjeta"><h3>${icons.heart(18)} Lo que busca la gente y tienes</h3><ul class="tdh-demanda"></ul></section>
            <section class="tdh-tarjeta"><h3>${icons.eye(18)} Visitas a tu escaparate</h3><p class="tdh-visitas"></p></section>
          </div>
        </div>
        <div class="tdh-tres" hidden></div>
      </div>
    </div>`
  caja.addEventListener('click', (e) => {
    const top = e.target.closest('[data-top]')
    if (top) {
      est.top = top.dataset.top
      return pintarCifras()
    }
    const b = e.target.closest('[data-periodo]')
    if (!b) return
    est.periodo = b.dataset.periodo
    try { localStorage.setItem(CLAVE, est.periodo) } catch {}
    for (const x of caja.querySelectorAll('[data-periodo]')) x.setAttribute('aria-pressed', String(x === b))
    pedir()
  })
  document.addEventListener('pokedoc:tienda-vendida', () => pedir())
  pedir()
}
