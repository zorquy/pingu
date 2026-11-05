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
import { PERIODOS_HOY, periodoDeHoy, comparacion, DONDE_NOMBRE } from './tiendas-puro.js'
import { detalleDeLinea } from './tienda-vender.js'
import { showToast } from './toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'

const CLAVE = 'pd-tienda-periodo'
const est = { periodo: 'hoy', pedido: 0, top: 'cartas', cifras: null }
const sets = new Map()
// Las fotos de las cartas de las tiras (1252), una vez por carta.
const cartas = new Map()
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
function cifraHtml(titulo, valor, sub, clase = '', icono = '', extra = '') {
  const flecha = sub?.clase === 'tdh-sube' ? '▲ ' : sub?.clase === 'tdh-baja' ? '▼ ' : ''
  return `<div class="tdh-cifra${extra ? ` ${extra}` : ''}"><span class="tdh-cifra-icono" aria-hidden="true">${icono}</span><small>${titulo}</small><b class="${clase}">${valor}</b>${sub ? `<span class="${sub.clase || ''}">${flecha}${escapeHtml(sub.texto)}</span>` : ''}</div>`
}

// La foto de una carta en una tira (1252); lo sellado o lo que no se encuentra,
// su hueco con la misma medida, para que las filas no salten.
function fotoHtml(cardId) {
  const c = cardId ? cartas.get(cardId) : null
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  return `<span class="tdh-foto" aria-hidden="true">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>`
}

async function completarCartas(lista) {
  for (const market of ['WEST', 'JP']) {
    const faltan = [...new Set(lista.filter((x) => x?.card_id && (x.market || 'WEST') === market && !cartas.has(x.card_id)).map((x) => x.card_id))]
    if (!faltan.length) continue
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', faltan.slice(0, 150))
    for (const c of data || []) cartas.set(c.id, c)
  }
}

// Lo que te espera (1252): las ofertas por contestar y las fotos que te piden
// (1250, 1251), en pastillas que llevan a Ofertas. Sin las migraciones, nada.
async function pintarPendientes() {
  const caja2 = $('.tdh-espera')
  if (!caja2) return
  const yo = (await supabase.auth.getSession()).data?.session?.user?.id
  if (!yo) return
  const [o, f] = await Promise.all([
    supabase.from('tienda_ofertas').select('id', { count: 'exact', head: true }).eq('tienda_id', yo).eq('estado', 'abierta').eq('turno', 'tienda').then((r) => (r.error ? 0 : r.count || 0), () => 0),
    supabase.from('tienda_fotos_pedidas').select('id', { count: 'exact', head: true }).eq('tienda_id', yo).is('atendida_at', null).then((r) => (r.error ? 0 : r.count || 0), () => 0),
  ])
  caja2.innerHTML = [
    o ? `<a class="tdh-aviso tdh-pill-toca" href="/tienda?ver=ofertas" data-ver="ofertas"><b class="tdh-pill-n">${o}</b><span>${o === 1 ? 'oferta por contestar' : 'ofertas por contestar'}</span>${icons.chevronRight(14)}</a>` : '',
    f ? `<a class="tdh-aviso tdh-pill-toca" href="/tienda?ver=ofertas" data-ver="ofertas"><b class="tdh-pill-n">${f}</b><span>${f === 1 ? 'te pide fotos' : 'te piden fotos'}</span>${icons.chevronRight(14)}</a>` : '',
  ].join('')
}

function pintar(d, ultimas) {
  const p = periodoDeHoy(est.periodo)
  const a = d.actual || {}
  const b = d.anterior || null
  const margen = a.coste > 0 && a.beneficio != null ? Math.round((a.beneficio / a.coste) * 100) : null
  const cmp = comparacion(a.importe, b?.importe, p.frente)
  const s = d.stock || {}
  // La cartera (1252, el molde del Panel de Mi colección): lo vendido en grande,
  // con cómo va contra el periodo anterior y cuántas ventas.
  const flecha = cmp?.sube === false ? '▼ ' : cmp?.sube ? '▲ ' : ''
  $('.tdh-vendido').innerHTML = `<small>${escapeHtml({ hoy: 'Vendido hoy', semana: 'Vendido esta semana', mes: 'Vendido este mes', anio: 'Vendido este año' }[est.periodo])}</small>
    <b class="tdh-vendido-cifra">${euros(a.importe || 0)}</b>
    <span class="tdh-vendido-sub">${cmp ? `<span class="${cmp.sube === false ? 'tdh-baja' : cmp.sube ? 'tdh-sube' : ''}">${flecha}${escapeHtml(cmp.texto)}</span>` : ''}<span>${a.ventas || 0} ${a.ventas === 1 ? 'venta' : 'ventas'}</span></span>`
  const v = d.visitas || {}
  const cv = comparacion(v.actual, v.anterior, p.frente.replace('a esta hora', 'en todo el día'))
  $('.tdh-cifras').innerHTML = [
    cifraHtml('Beneficio', a.beneficio == null ? '—' : `${a.beneficio > 0 ? '+' : ''}${euros(a.beneficio)}`, { texto: a.sin_coste ? `${a.sin_coste} sin coste, fuera de la cuenta` : 'sobre lo que pagaste' }, a.beneficio < 0 ? 'tdh-rojo-texto' : '', icons.trendingUp(20)),
    cifraHtml('Margen medio', margen == null ? '—' : `${margen} %`, { texto: 'sobre lo pagado' }, '', icons.target(20)),
    cifraHtml('Valor del stock', euros(s.valor || 0), { texto: `a tu precio · ${s.unidades || 0} uds.${s.cm ? ` · Cardmarket ${euros(s.cm)}` : ''}` }, '', icons.package(20)),
    // Las visitas a su escaparate, como una cifra más (antes, su tarjeta).
    cifraHtml('Visitas', String(v.actual || 0), { texto: `${v.actual === 1 ? 'visita' : 'visitas'}${v.qr ? ` · ${v.qr} desde el QR` : ''}${cv ? ` · ${cv.texto}` : ''}`, clase: '' }, '', icons.eye(20), 'tdh-visitas'),
  ].join('')

  $('.tdh-grafica-titulo').textContent = { hoy: 'Ventas de hoy', semana: 'Ventas de la semana', mes: 'Ventas del mes', anio: 'Ventas del año' }[est.periodo]
  $('.tdh-grafica').innerHTML = graficaHtml(d.serie || [], p.paso)
  const NOMBRE_DONDE = DONDE_NOMBRE
  $('.tdh-ultimas').innerHTML = (ultimas || []).map((f) => {
    const ben = f.coste == null ? null : Math.round((Number(f.precio) - Number(f.coste)) * f.unidades * 100) / 100
    return `<li>${fotoHtml(f.card_id)}<span><strong>${escapeHtml(f.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(f, nombreSet))} · ${escapeHtml(NOMBRE_DONDE[f.donde] || f.donde)}</small></span><b>${euros(Number(f.precio) * f.unidades)}${ben == null ? '' : `<small class="${ben < 0 ? 'tdh-rojo-texto' : 'tdh-verde'}">${ben > 0 ? '+' : ''}${euros(ben)}</small>`}</b></li>`
  }).join('') || '<li class="tdh-sin">Todavía no hay ventas en este periodo.</li>'

  const avisos = AVISOS.filter(([k]) => d.avisos?.[k] > 0)
  $('.tdh-avisos').innerHTML = avisos.length
    ? avisos.map(([k, clase, texto]) => `<a class="tdh-aviso ${clase}" href="/tienda?ver=stock&filtro=${k}" data-ver="stock" data-filtro="${k}"><b class="tdh-pill-n">${d.avisos[k]}</b><span>${escapeHtml(texto(d.avisos[k]).replace(/^\d+\s/, ''))}</span>${icons.chevronRight(14)}</a>`).join('')
    : `<p class="tdh-bien">${icons.checkCircle(18)}<span>Todo en orden: nada por debajo de Cardmarket, nada con pérdida.</span></p>`

  const dem = d.demanda || []
  $('.tdh-demanda').innerHTML = dem.length
    ? dem.map((x) => `<li>${fotoHtml(x.card_id)}<span><strong>${escapeHtml(x.nombre || x.card_id)}</strong><small>${escapeHtml([x.set_id ? nombreSet(x.set_id) : '', x.numero].filter(Boolean).join(' · '))}</small></span><span class="tdh-quieren" title="${x.quieren} ${x.quieren === 1 ? 'persona la tiene' : 'personas la tienen'} en «La quiero»">${icons.heart(14)} ${x.quieren}</span><small class="tdh-tienes">tienes ${x.tienes}</small><span class="tdh-avisar" data-tdh-avisar="${escapeHtml(x.card_id)}" data-market="${escapeHtml(x.market || 'WEST')}"></span></li>`).join('')
    : '<li class="tdh-sin">Nadie tiene en su lista nada de lo que enseñas ahora.</li>'
  if (dem.length) pintarAvisar(dem)

  // Cuánto stock tiene, en la cabecera de /tienda (fuera de esta caja).
  const st = document.querySelector('[data-tdh-stock]')
  if (st) st.textContent = `${(s.lineas || 0).toLocaleString('es-ES')} ${s.lineas === 1 ? 'línea' : 'líneas'} · ${(s.unidades || 0).toLocaleString('es-ES')} uds.`
}

// «Avisar a los que la buscan» (1089): por cada carta, cuántos quedan por
// avisar y cuántos se avisaron, siempre en cifras (quién, nunca: lo dice la
// base). Sin la migración no sale nada: no es «no hay a quién», es que no se
// puede preguntar.
async function pintarAvisar(dem) {
  const yo = est.pedido
  const { data, error } = await supabase.rpc('tienda_avisos_de', { p_cartas: dem.map((x) => ({ card_id: x.card_id, market: x.market || 'WEST' })) })
  if (error || !Array.isArray(data) || yo !== est.pedido) return
  for (const a of data) {
    const hueco = [...caja.querySelectorAll('[data-tdh-avisar]')].find((h) => h.dataset.tdhAvisar === a.card_id && h.dataset.market === a.market)
    if (hueco) hueco.innerHTML = avisarHtml(a)
  }
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

function avisarHtml(a) {
  if (a.pendientes > 0) return `<button type="button" class="btn-secondary tdh-avisar-btn" data-avisar title="Les llega un aviso a la campanita con tu tienda y la carta. No verás quiénes son.">${icons.bell(16)}<span>Avisar${a.avisadas > 0 ? ` a ${a.pendientes} más` : ''}</span></button>`
  if (a.avisadas > 0) return `<small class="tdh-avisadas" title="${a.avisadas} ${a.avisadas === 1 ? 'persona avisada' : 'personas avisadas'}">${icons.checkCircle(14)} Avisadas${a.ultimo ? `<span class="tdh-avisadas-dia"> · ${escapeHtml(fechaCorta(a.ultimo))}</span>` : ''}</small>`
  return ''
}

// Cambia ya y confirma después (896): si la base dice que no, vuelve.
async function avisar(boton) {
  const hueco = boton.closest('[data-tdh-avisar]')
  const antes = hueco.innerHTML
  hueco.innerHTML = avisarHtml({ pendientes: 0, avisadas: 1, ultimo: new Date().toISOString() })
  const { data, error } = await supabase.rpc('tienda_avisar', { p_card: hueco.dataset.tdhAvisar, p_market: hueco.dataset.market })
  if (error) {
    hueco.innerHTML = antes
    return showToast(/no está a la vista/.test(error.message || '') ? 'Esa carta ya no está a la vista en tu escaparate.' : 'No se ha podido avisar. Prueba otra vez.', 'error')
  }
  const n = data?.avisadas || 0
  showToast(n ? `Avisamos a ${n} ${n === 1 ? 'persona' : 'personas'} que la ${n === 1 ? 'busca' : 'buscan'}.` : 'Ya estaban todas avisadas.', 'success')
}

// Las cifras de la 1083: lo más vendido (por carta o por expansión), lo que
// no rota y el valor del stock en el tiempo. Sin la migración 1079 el bloque
// no sale (no es «no hay nada»: es que no se puede preguntar).
function cifrasHtml(c) {
  const lista = est.top === 'sets' ? c.sets || [] : c.cartas || []
  const top = lista.length
    ? `<ol class="tdh-top">${lista.map((x, i) => `<li><span class="tdh-top-n">${i + 1}</span>${est.top === 'sets' ? '' : fotoHtml(x.card_id)}<span><strong>${escapeHtml(est.top === 'sets' ? nombreSet(x.set_id) || x.nombre || x.set_id : x.nombre || x.card_id || 'Producto')}</strong><small>${est.top === 'sets' ? `${x.cartas} ${x.cartas === 1 ? 'carta distinta' : 'cartas distintas'}` : escapeHtml([x.set_id ? nombreSet(x.set_id) : x.product_id ? 'Sellado' : '', x.numero].filter(Boolean).join(' · '))}</small></span><b>${x.unidades} ${x.unidades === 1 ? 'ud.' : 'uds.'}<small>${euros(x.importe || 0)}</small></b></li>`).join('')}</ol>`
    : '<p class="tdh-sin">Sin ventas en este periodo.</p>'
  const q = c.quietas || {}
  const quietas = q.lineas
    ? `<p class="tdh-quietas-total"><b>${euros(q.valor || 0)}</b> parados en ${q.lineas} ${q.lineas === 1 ? 'línea' : 'líneas'} (${q.unidades} uds.)</p>
      <ul class="tdh-quietas">${(q.filas || []).slice(0, 5).map((x) => `<li>${fotoHtml(x.card_id)}<span><strong>${escapeHtml(x.nombre || 'Producto')}</strong><small>${escapeHtml(detalleDeLinea(x, nombreSet))} · ${Math.floor((Date.now() - new Date(x.entro_el)) / 864e5)} días</small></span><b>${x.precio == null ? '—' : euros(Number(x.precio) * x.unidades)}</b></li>`).join('')}</ul>
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
  await completarCartas([...(u.data?.filas || []), ...(r.data.demanda || []), ...(est.cifras?.cartas || []), ...(est.cifras?.quietas?.filas || []).slice(0, 5)]).catch(() => {})
  if (yo !== est.pedido) return
  pintar(r.data, u.data?.filas || [])
  pintarPendientes().catch(() => {})
  pintarCifras()
  pintarApartadas()
}

// Apartadas (1092): lo que la tienda guarda para alguien, lo que antes acaba
// primero. Sin la migración, la tarjeta no sale. Las caducadas vuelven al
// stock al pedirlas, y se dice.
async function pintarApartadas() {
  const m = await import('./tienda-apartar.js').catch(() => null)
  const r = m ? await m.apartadas().catch(() => null) : null
  const tarjeta = $('.tdh-apartadas')
  if (!r || !tarjeta) return
  await completarSets(r.filas.map((f) => f.set_id))
  tarjeta.hidden = !r.filas.length
  $('.tdh-apartadas-n').textContent = r.filas.length ? String(r.filas.length) : ''
  $('.tda-lista').innerHTML = m.apartadasHtml(r.filas, nombreSet)
  if (r.caducadas) showToast(`${r.caducadas === 1 ? 'Una reserva caducó y vuelve' : `${r.caducadas} reservas caducaron y vuelven`} a tu stock.`, 'info')
}

async function recogerApartada(boton) {
  boton.disabled = true
  const m = await import('./tienda-apartar.js')
  try {
    await m.recoger(boton.dataset.recoger)
    document.dispatchEvent(new CustomEvent('pokedoc:tienda-vendida'))
  } catch {
    boton.disabled = false
  }
}

// Quitar pide un segundo toque: vuelven al stock.
async function quitarApartada(boton) {
  if (boton.dataset.seguro !== 'si') {
    boton.dataset.seguro = 'si'
    boton.textContent = '¿Seguro?'
    setTimeout(() => { if (boton.isConnected) { boton.dataset.seguro = ''; boton.textContent = 'Quitar' } }, 4000)
    return
  }
  boton.disabled = true
  const m = await import('./tienda-apartar.js')
  try {
    await m.quitar(boton.dataset.quitarReserva)
    document.dispatchEvent(new CustomEvent('pokedoc:tienda-vendida'))
  } catch {
    boton.disabled = false
  }
}

function pintarCifras() {
  const tres = $('.tdh-tres')
  tres.hidden = !est.cifras
  tres.innerHTML = est.cifras ? cifrasHtml(est.cifras) : ''
}

export function montarHoy(destino) {
  caja = destino
  est.periodo = leerPeriodo()
  // El Panel nuevo (1252, PINGU: «rehazme el panel… que se viese más moderno,
  // como el resto de la web»): el molde del Panel de Mi colección. Arriba una
  // caja, la CARTERA (lo vendido en grande, su gráfica y cuatro cifras);
  // debajo, en pastillas, lo que te espera; y luego bloques iguales con
  // cartas: lo que busca la gente, lo último vendido y lo reservado, y las
  // tres de las cifras (lo más vendido, lo que no rota, el valor del stock).
  caja.innerHTML = `
    <div class="tdh">
      <h2 class="sr-only">Cómo va</h2>
      <div class="tdh-cuerpo">
        <section class="tdh-cartera" aria-label="Lo vendido">
          <div class="tdh-cartera-cab">
            <div class="tdh-vendido" aria-live="polite"></div>
            <div class="tdvt-chips" role="group" aria-label="Periodo">${PERIODOS_HOY.map(([v, t]) => `<button type="button" class="tdvt-chip" data-periodo="${v}" aria-pressed="${v === est.periodo}">${t}</button>`).join('')}</div>
          </div>
          <p class="tdh-grafica-cab"><span class="tdh-grafica-titulo">Ventas</span> <a class="tdh-ir" href="/tienda?ver=ventas" data-ver="ventas">Ver ventas ${icons.chevronRight(14)}</a></p>
          <div class="tdh-grafica"></div>
          <div class="tdh-cifras"></div>
        </section>
        <div class="tdh-pendientes" aria-label="Lo que te espera"><div class="tdh-espera"></div><div class="tdh-avisos"></div></div>
        <div class="tdh-dos">
          <section class="tdh-tarjeta"><h3>${icons.heart(18)} Lo que busca la gente y tienes</h3><ul class="tdh-demanda"></ul></section>
          <div class="tdh-col">
            <section class="tdh-tarjeta tdh-apartadas" hidden><h3>${icons.clock(18)} Reservadas <small class="tdh-apartadas-n"></small></h3><ul class="tda-lista"></ul></section>
            <section class="tdh-tarjeta"><h3>${icons.receipt(18)} Últimas ventas</h3><ul class="tdh-ultimas"></ul></section>
          </div>
        </div>
        <div class="tdh-tres" hidden></div>
      </div>
    </div>`
  caja.addEventListener('click', (e) => {
    const av = e.target.closest('[data-avisar]')
    if (av) return avisar(av)
    const rc = e.target.closest('[data-recoger]')
    if (rc) return recogerApartada(rc)
    const qr = e.target.closest('[data-quitar-reserva]')
    if (qr) return quitarApartada(qr)
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
