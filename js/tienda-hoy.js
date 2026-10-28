// /tienda → Hoy (tanda 1073): lo que vendió y ganó la tienda en el periodo
// (hoy, la semana, el mes o el año), contra el anterior a la misma altura;
// la gráfica de sus ventas, el valor del stock, los avisos, lo que busca la
// gente y tiene (solo cuántos: PINGU no quiso nombres) y las visitas a su
// escaparate. Todo sale de UNA llamada (`tienda_hoy`) más las tres últimas
// ventas. Entra por `import()`: quien no es tienda no lo baja.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { nombreDeSet } from './catalogo-series.js'
import { PERIODOS_HOY, periodoDeHoy, comparacion, DONDE_VENTA } from './tiendas-puro.js'
import { detalleDeLinea } from './tienda-vender.js'

const CLAVE = 'pd-tienda-periodo'
const est = { periodo: 'hoy', pedido: 0 }
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

function cifraHtml(titulo, valor, sub, clase = '') {
  return `<div class="tdh-cifra"><small>${titulo}</small><b class="${clase}">${valor}</b>${sub ? `<span class="${sub.clase || ''}">${escapeHtml(sub.texto)}</span>` : ''}</div>`
}

function pintar(d, ultimas) {
  const p = periodoDeHoy(est.periodo)
  const a = d.actual || {}
  const b = d.anterior || null
  const margen = a.coste > 0 && a.beneficio != null ? Math.round((a.beneficio / a.coste) * 100) : null
  const cmp = comparacion(a.importe, b?.importe, p.frente)
  const s = d.stock || {}
  $('.tdh-cifras').innerHTML = [
    cifraHtml('Vendido', euros(a.importe || 0), cmp ? { texto: cmp.texto, clase: cmp.sube === false ? 'tdh-baja' : cmp.sube ? 'tdh-sube' : '' } : { texto: `${a.ventas || 0} ${a.ventas === 1 ? 'venta' : 'ventas'}` }),
    cifraHtml('Beneficio', a.beneficio == null ? '—' : `${a.beneficio > 0 ? '+' : ''}${euros(a.beneficio)}`, { texto: a.sin_coste ? `${a.sin_coste} sin coste, fuera de la cuenta` : 'sobre lo que pagaste' }, a.beneficio < 0 ? 'tdh-rojo-texto' : ''),
    cifraHtml('Margen medio', margen == null ? '—' : `${margen} %`, { texto: 'sobre lo pagado' }),
    cifraHtml('Valor del stock', euros(s.valor || 0), { texto: `a tu precio · ${s.unidades || 0} uds.${s.cm ? ` · Cardmarket ${euros(s.cm)}` : ''}` }),
  ].join('')

  $('.tdh-grafica-titulo').textContent = { hoy: 'Ventas de hoy', semana: 'Ventas de la semana', mes: 'Ventas del mes', anio: 'Ventas del año' }[est.periodo]
  $('.tdh-grafica').innerHTML = graficaHtml(d.serie || [], p.paso)
  const NOMBRE_DONDE = Object.fromEntries(DONDE_VENTA)
  $('.tdh-ultimas').innerHTML = (ultimas || []).map((f) => {
    const ben = f.coste == null ? null : Math.round((Number(f.precio) - Number(f.coste)) * f.unidades * 100) / 100
    return `<li><span><strong>${escapeHtml(f.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(f, nombreSet))} · ${escapeHtml(NOMBRE_DONDE[f.donde] || f.donde)}</small></span><b>${euros(Number(f.precio) * f.unidades)}${ben == null ? '' : `<small class="${ben < 0 ? 'tdh-rojo-texto' : 'tdh-verde'}">${ben > 0 ? '+' : ''}${euros(ben)}</small>`}</b></li>`
  }).join('')

  const avisos = AVISOS.filter(([k]) => d.avisos?.[k] > 0)
  $('.tdh-avisos').innerHTML = avisos.length
    ? avisos.map(([k, clase, texto]) => `<a class="tdh-aviso ${clase}" href="/tienda?ver=stock&filtro=${k}" data-ver="stock" data-filtro="${k}"><span>${escapeHtml(texto(d.avisos[k]))}</span><small>Ver</small></a>`).join('')
    : `<p class="tdh-bien">${icons.checkCircle(18)}<span>Todo en orden: nada por debajo de Cardmarket, nada con pérdida.</span></p>`

  const dem = d.demanda || []
  $('.tdh-demanda').innerHTML = dem.length
    ? dem.map((x) => `<li><span><strong>${escapeHtml(x.nombre || x.card_id)}</strong><small>${escapeHtml([x.set_id ? nombreSet(x.set_id) : '', x.numero].filter(Boolean).join(' · '))}</small></span><span class="tdh-quieren" title="${x.quieren} ${x.quieren === 1 ? 'persona la tiene' : 'personas la tienen'} en «La quiero»">${icons.heart(14)} ${x.quieren}</span><small class="tdh-tienes">tienes ${x.tienes}</small></li>`).join('')
    : '<li class="tdh-sin">Nadie tiene en su lista nada de lo que enseñas ahora.</li>'

  const v = d.visitas || {}
  const cv = comparacion(v.actual, v.anterior, p.frente.replace('a esta hora', 'en todo el día'))
  $('.tdh-visitas').innerHTML = `<b>${v.actual || 0}</b> ${v.actual === 1 ? 'visita' : 'visitas'}${v.qr ? ` · ${v.qr} desde el QR` : ''}${cv ? `<small class="${cv.sube === false ? 'tdh-baja' : cv.sube ? 'tdh-sube' : ''}">${escapeHtml(cv.texto)}</small>` : ''}`
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
  const [r, u] = await Promise.all([
    supabase.rpc('tienda_hoy', { p_desde: p.desde, p_hasta: p.hasta, p_antes_desde: p.antesDesde, p_antes_hasta: p.antesHasta, p_paso: p.paso, p_zona: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid' }),
    supabase.rpc('tienda_ventas_lista', { p_filtros: { desde: p.desde, hasta: p.hasta }, p_desde: 0, p_cuantas: 3 }),
  ])
  if (yo !== est.pedido) return
  if (r.error || !r.data) {
    const sin = ['PGRST202', '42883'].includes(r.error?.code) || /Could not find/i.test(r.error?.message || '')
    caja.querySelector('.tdh-cuerpo').innerHTML = `<p class="tdh-sin">${sin ? 'Falta un paso en la base para ver tus cifras (las migraciones 1072 y 1073).' : 'No se han podido traer tus cifras. Recarga la página.'}</p>`
    return
  }
  await completarSets([...(r.data.demanda || []).map((x) => x.set_id), ...((u.data?.filas) || []).map((f) => f.set_id)])
  if (yo !== est.pedido) return
  pintar(r.data, u.data?.filas || [])
}

export function montarHoy(destino) {
  caja = destino
  est.periodo = leerPeriodo()
  caja.innerHTML = `
    <div class="tdh">
      <div class="tdh-cab">
        <h2>Hoy</h2>
        <div class="tdvt-chips" role="group" aria-label="Periodo">${PERIODOS_HOY.map(([v, t]) => `<button type="button" class="tdvt-chip" data-periodo="${v}" aria-pressed="${v === est.periodo}">${t}</button>`).join('')}</div>
      </div>
      <div class="tdh-cuerpo">
        <div class="tdh-cifras"></div>
        <div class="tdh-dos">
          <section class="tdh-tarjeta">
            <h3><span class="tdh-grafica-titulo">Ventas</span> <a class="tdh-ir" href="/tienda?ver=ventas" data-ver="ventas">Ver ventas</a></h3>
            <div class="tdh-grafica"></div>
            <ul class="tdh-ultimas"></ul>
          </section>
          <div class="tdh-col">
            <section class="tdh-tarjeta"><h3>Avisos de tu stock</h3><div class="tdh-avisos"></div></section>
            <section class="tdh-tarjeta"><h3>Lo que busca la gente y tienes</h3><ul class="tdh-demanda"></ul></section>
            <section class="tdh-tarjeta"><h3>Tu escaparate</h3><p class="tdh-visitas"></p></section>
          </div>
        </div>
      </div>
    </div>`
  caja.addEventListener('click', (e) => {
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
