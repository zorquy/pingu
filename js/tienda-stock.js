// El stock de una tienda, en /tienda → Stock (tanda 1068). Entra por
// `import()` al abrir la pestaña: quien no es tienda no lo baja.
//
// Lo que se filtra, ordena, suma y cuenta lo hace la base
// (`tienda_stock_lista`): una tienda puede tener 20.000 líneas y Supabase
// corta cada respuesta a 1.000 (la 808). Aquí se pinta una página y se
// piden las fotos de esas cartas, con las mismas columnas y la misma cadena
// de escaneos que el resto de la web.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { IDIOMAS, ESTADOS, euros, valorDe, precioDeFila, idiomasParaAnadirEn, versionesDelIdioma } from './cardmarket.js'
import { idiomasDeSetSinEsperar, reglasDeVersiones, sinReglas } from './idiomas-de-set.js'
import { variantesDeCarta, nombreDeVariante } from './mi-coleccion/variantes.js'
import { rarezaDeCarta } from './rarezas-nombres.js'
import { buscarComoEnCartas } from './buscar-cartas.js'
import { buscarProductos } from './productos-valor.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { margenDe, precioSugerido, alternarFiltro, chapasDeFiltros, quitarChapa, csvDeStock, ofertaDe, precioRebajado } from './tiendas-puro.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
import { banderaHtml } from './precio-vista.js'
import { marcaDeRarezaHtml } from './rarezas.js'
import { iconoDeVersion } from './mi-coleccion/iconos-version.js'

const POR_PAGINA = 50
const COLUMNAS = COLUMNAS_CARTA_DE_SET.replace('tcg_sets(tcg_online_code,serie_id,release_date)', 'tcg_sets(name,name_en,tcg_online_code,serie_id,release_date,oculto)')
const OCCIDENTALES = ['es', 'en', 'fr', 'de', 'it', 'pt'].map((id) => IDIOMAS.find((i) => i.id === id))
const NOMBRE_IDIOMA = Object.fromEntries(IDIOMAS.map((i) => [i.id, i.nombre]))
const ORDENES = [
  ['recientes', 'Lo último que entró'],
  ['antiguas', 'Lo que más lleva'],
  ['nombre', 'Nombre'],
  ['precio_desc', 'Tu precio, de más a menos'],
  ['precio_asc', 'Tu precio, de menos a más'],
  ['cm_desc', 'Cardmarket, de más a menos'],
  ['margen_desc', 'Más margen'],
  ['margen_asc', 'Menos margen'],
  ['unidades', 'Más unidades'],
]
const ETIQUETAS = {
  catalogo: { WEST: 'Pokémon', JP: 'Japón', sellado: 'Sellado' },
  margen: { pierdes: 'Pierdes', '0-20': '0–20 %', '20-50': '20–50 %', '50+': '+50 %', sin_coste: 'Sin coste' },
  contra: { debajo: 'Por debajo', igual: 'Igual (±5 %)', encima: 'Por encima' },
  dias: { 30: 'Menos de 30 días', '30-90': '30–90 días', '90+': 'Más de 90 días' },
  unidades: { agotadas: 'Agotadas', una: 'Una', varias: 'Varias' },
  gradeadas: { si: 'Gradeadas', no: 'Sin gradear' },
  visible: { si: 'Se ve', no: 'Oculta' },
}

const est = {
  filtros: {},
  orden: 'recientes',
  filas: [],
  total: 0,
  enStock: 0,
  sumas: null,
  facetas: {},
  marcadas: new Set(),
  seleccionando: false,
  vistas: [],
  cartas: new Map(),
  productos: new Map(),
  sets: new Map(),
  pedido: 0,
  masAbierto: false,
}
let caja = null
let perfil = null

const $ = (sel) => caja.querySelector(sel)
const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')))

function nombreDe(grupo, valor) {
  if (grupo === 'sets') return est.sets.get(valor) || valor
  if (grupo === 'idioma') return NOMBRE_IDIOMA[valor] || valor
  if (grupo === 'estado') return valor === 'sellado' ? 'Sellado' : valor
  if (grupo === 'variante') return nombreDeVariante(valor)
  if (grupo === 'rareza') return rarezaDeCarta({ rarity_en: valor }) || valor
  return ETIQUETAS[grupo]?.[valor] || valor
}

// ── La base ──

async function pedir({ mas = false } = {}) {
  const n = ++est.pedido
  const desde = mas ? est.filas.length : 0
  $('.tds-tabla-caja').classList.add('cargando')
  const { data, error } = await supabase.rpc('tienda_stock_lista', { p_filtros: est.filtros, p_orden: est.orden, p_desde: desde, p_cuantas: POR_PAGINA })
  if (n !== est.pedido) return
  $('.tds-tabla-caja').classList.remove('cargando')
  // Sin respuesta (o sin la función) no es «no hay stock»: es que falta algo.
  if (error || !data) {
    $('.tds-tabla-caja').innerHTML = `<p class="tds-vacio">${!error || /tienda_stock_lista|schema cache|does not exist/i.test(error.message || '')
      ? 'El stock todavía no está listo: falta un paso en la base. Vuelve en un rato.'
      : `No se ha podido cargar el stock: ${escapeHtml(error.message || 'sin motivo')}.`}</p>`
    return
  }
  est.filas = mas ? est.filas.concat(data.filas || []) : data.filas || []
  est.total = data.total || 0
  est.enStock = data.en_stock || 0
  est.sumas = data.sumas || null
  est.facetas = data.facetas || {}
  // Sin la migración 1079 no hay estrella (ni la cuenta de las ocho).
  est.destacadas = data.destacadas ?? null
  await Promise.all([completarCartas(est.filas), completarProductos(est.filas), completarSets(Object.keys(est.facetas.sets || {}))])
  if (n !== est.pedido) return
  pintarTodo()
}

async function completarCartas(filas) {
  const porMercado = { WEST: [], JP: [] }
  for (const f of filas) if (f.card_id && !est.cartas.has(f.card_id)) porMercado[f.market === 'JP' ? 'JP' : 'WEST'].push(f.card_id)
  for (const [market, ids] of Object.entries(porMercado)) {
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('tcg_cards').select(COLUMNAS).eq('market', market).in('id', ids.slice(i, i + 150))
      for (const c of data || []) est.cartas.set(c.id, c)
    }
  }
}

async function completarProductos(filas) {
  const ids = [...new Set(filas.filter((f) => f.product_id && !est.productos.has(String(f.product_id))).map((f) => f.product_id))]
  if (!ids.length) return
  const { data } = await supabase.from('tcg_products').select('id,name,image,tipo,lang').in('id', ids)
  for (const p of data || []) est.productos.set(String(p.id), p)
}

async function completarSets(ids) {
  const faltan = ids.filter((id) => !est.sets.has(id))
  if (!faltan.length) return
  const { data } = await supabase.from('tcg_sets').select('id,name,name_en,market').in('id', faltan)
  for (const s of data || []) est.sets.set(s.id, nombreDeSet(s) || s.id)
}

async function cargarVistas() {
  const { data } = await supabase.from('tienda_vistas').select('id,nombre,filtros,orden').order('orden').order('created_at')
  est.vistas = data || []
  pintarVistas()
}

// ── Pintar ──

function fotoHtml(f) {
  if (f.product_id) {
    const p = est.productos.get(String(f.product_id))
    return `<span class="tds-foto-caja tds-foto-caja-producto">${p?.image ? `<img src="${escapeHtml(p.image)}" alt="" width="40" height="40" loading="lazy" class="tds-foto" onerror="this.remove()" />` : ''}</span>`
  }
  const c = est.cartas.get(f.card_id)
  const attrs = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  // En su caja: si ninguna foto de la cadena contesta, la imagen se quita y
  // queda el hueco con su forma, no una fila sin carta (la 441).
  return `<span class="tds-foto-caja">${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" class="tds-foto" />` : ''}</span>`
}

function nombreFila(f) {
  if (f.product_id) return est.productos.get(String(f.product_id))?.name || f.nombre || 'Producto'
  const c = est.cartas.get(f.card_id)
  return (c && nombreDeCarta(c)) || f.nombre || f.card_id
}

function detalleFila(f) {
  if (f.product_id) return 'Sellado'
  const c = est.cartas.get(f.card_id)
  const set = c?.tcg_sets ? nombreDeSet(c.tcg_sets) : est.sets.get(f.set_id) || f.set_id || ''
  return [set, f.numero].filter(Boolean).join(' · ')
}

// La estrella (1079): lo que sale arriba en tu escaparate, ocho como mucho.
function estrellaHtml(f) {
  if (est.destacadas == null) return ''
  return `<button type="button" class="tds-estrella${f.destacada ? ' activa' : ''}" data-estrella="${escapeHtml(f.id)}" aria-pressed="${f.destacada ? 'true' : 'false'}" aria-label="${f.destacada ? 'Quitar de destacadas' : 'Destacar en tu escaparate'}" title="${f.destacada ? 'Destacada en tu escaparate' : 'Destacar en tu escaparate'}">${icons.star(18)}</button>`
}

const MAS_DE_OCHO = 'Como mucho 8 destacadas: quita la estrella a otra antes.'

// Cambia ya, confirma después y deshace si falla (la 896).
async function alternarEstrella(id) {
  const f = est.filas.find((x) => x.id === id)
  if (!f) return
  const antes = Boolean(f.destacada)
  if (!antes && est.destacadas >= 8) return showToast(MAS_DE_OCHO, 'error')
  const poner = (v) => {
    f.destacada = v
    est.destacadas += v ? 1 : -1
    pintarTabla()
  }
  poner(!antes)
  const { data, error } = await supabase.from('tienda_stock').update({ destacada: !antes }).eq('id', id).select('id')
  if (error || !data?.length) {
    poner(antes)
    return showToast(/Como mucho/.test(error?.message || '') ? MAS_DE_OCHO : 'No se ha podido guardar.', 'error')
  }
  showToast(antes ? 'Ya no sale destacada.' : `Destacada en tu escaparate (${est.destacadas} de 8).`, 'success')
}

// Una oferta (1082): el precio rebajado en rojo, el de siempre tachado y
// hasta cuándo. Una que ya acabó no se ve en el escaparate: se dice.
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
function precioCeldaHtml(f) {
  const o = ofertaDe(f)
  if (o) {
    return `<span class="tds-oferta">${o.antes != null ? `<s>${euros(o.antes)}</s>` : ''}<strong>${euros(o.precio)}</strong></span><small class="tds-oferta-chapa">${o.pct ? `−${o.pct} %` : 'Oferta'}${o.hasta ? ` · hasta el ${fechaCorta(o.hasta)}` : ''}</small>`
  }
  const acabada = f.oferta_precio != null ? '<small class="tds-falta">Oferta acabada</small>' : ''
  return `<strong>${f.precio != null ? euros(f.precio) : '<span class="tds-falta">Sin precio</span>'}</strong>${acabada}`
}

function filaHtml(f) {
  const m = margenDe(f.precio, f.coste)
  const debajo = f.precio != null && f.cm > 0 && f.precio < f.cm * 0.95
  const pierde = m && m.euros < 0
  const dias = Math.max(0, Math.floor((Date.now() - new Date(f.entro_el).getTime()) / 864e5))
  const marcada = est.marcadas.has(f.id)
  return `<tr class="${pierde || dias > 90 ? 'tds-mal' : debajo ? 'tds-alerta' : ''}${marcada ? ' tds-marcada' : ''}" data-fila="${escapeHtml(f.id)}">
    ${est.seleccionando ? `<td class="tds-check"><input type="checkbox" aria-label="Marcar" data-marcar="${escapeHtml(f.id)}" ${marcada ? 'checked' : ''} /></td>` : ''}
    <td class="tds-c-nombre"><div class="tds-nombre">${fotoHtml(f)}<span><strong>${escapeHtml(nombreFila(f))}</strong><small>${escapeHtml(detalleFila(f))}${f.variante && f.variante !== 'normal' && !f.product_id ? ` · ${escapeHtml(nombreDeVariante(f.variante))}` : ''}${f.gradeo ? ` · ${escapeHtml(f.gradeo)}` : ''}</small></span>${estrellaHtml(f)}</div></td>
    <td class="tds-c-idioma">${f.idioma ? banderaHtml(f.idioma) : ''}<span>${escapeHtml(String(f.idioma || '').toUpperCase())}</span></td>
    <td class="tds-c-estado"><span class="tds-chapa">${dibujoDe('estado', f.estado)}${escapeHtml(f.estado === 'sellado' ? 'Sellado' : f.estado)}</span></td>
    <td class="tds-num tds-c-uds">${f.unidades}</td>
    <td class="tds-num tds-c-coste">${f.coste != null ? euros(f.coste) : '<span class="tds-falta">—</span>'}</td>
    <td class="tds-num tds-c-precio">${precioCeldaHtml(f)}</td>
    <td class="tds-num tds-c-cm${debajo ? ' tds-ambar' : ''}">${f.cm > 0 ? euros(f.cm) : '<span class="tds-falta">—</span>'}</td>
    <td class="tds-num tds-c-margen">${m ? `<span class="${m.euros < 0 ? 'tds-rojo' : 'tds-verde'}">${m.euros > 0 ? '+' : ''}${euros(m.euros)}</span> <small>${m.pct} %</small>` : '<span class="tds-falta">—</span>'}</td>
    <td class="tds-num tds-c-dias${dias > 90 ? ' tds-rojo' : ''}">${dias} d</td>
    <td class="tds-c-vis">${f.visible ? '<span class="tds-chapa tds-chapa-si">Se ve</span>' : '<span class="tds-chapa">Oculta</span>'}${f.ubicacion ? `<small class="tds-ubi">${escapeHtml(f.ubicacion)}</small>` : ''}</td>
  </tr>`
}

function pintarTabla() {
  const tabla = $('.tds-tabla-caja')
  if (!est.enStock && !Object.keys(est.filtros).length) {
    tabla.innerHTML = `<div class="tds-vacio"><h3>Tu stock está vacío</h3><p>Añade tus cartas una a una con el buscador o importa tu Excel de golpe.</p>
      <div class="tds-vacio-botones"><button type="button" class="btn-primary" data-tds="anadir">+ Añadir</button><button type="button" class="btn-secondary" data-tds="importar">Importar CSV</button></div></div>`
    return
  }
  if (!est.filas.length) {
    tabla.innerHTML = '<p class="tds-vacio">Nada de tu stock cumple estos filtros. <button type="button" class="link-btn" data-tds="limpiar">Quitar los filtros</button></p>'
    return
  }
  tabla.innerHTML = `<table class="tds-tabla">
    <thead><tr>${est.seleccionando ? '<th class="tds-check"><input type="checkbox" aria-label="Marcar todas las de esta lista" data-tds="todas" /></th>' : ''}<th>Carta</th><th>Idioma</th><th>Estado</th><th class="tds-num">Uds.</th><th class="tds-num">Coste</th><th class="tds-num">Tu precio</th><th class="tds-num">Cardmarket</th><th class="tds-num">Margen</th><th class="tds-num">En stock</th><th>Escaparate</th></tr></thead>
    <tbody>${est.filas.map(filaHtml).join('')}</tbody>
  </table>
  ${est.filas.length < est.total ? `<button type="button" class="btn-secondary tds-mas" data-tds="mas">Ver ${Math.min(POR_PAGINA, est.total - est.filas.length)} más</button>` : ''}`
}

function pintarPie() {
  const s = est.sumas || {}
  const parte = est.total !== est.enStock
  $('.tds-pie').innerHTML = `<span><strong>${est.total.toLocaleString('es-ES')}</strong>${parte ? ` de ${est.enStock.toLocaleString('es-ES')}` : ''} ${est.total === 1 ? 'línea' : 'líneas'} · ${Number(s.unidades || 0).toLocaleString('es-ES')} unidades</span>
    <span>Te costaron <strong>${euros(s.coste || 0)}</strong>${s.sin_coste ? ` <small>(${s.sin_coste} sin coste)</small>` : ''}</span>
    <span>A tu precio <strong>${euros(s.precio || 0)}</strong>${s.sin_precio ? ` <small>(${s.sin_precio} sin precio)</small>` : ''}</span>
    <span>En Cardmarket <strong>${euros(s.cm || 0)}</strong></span>`
}

// El dibujo de cada opción (1077, PINGU: «los idiomas con las banderas, las
// rarezas con su icono de rareza»): los de toda la web — la bandera de
// precio-vista, la marca de rareza de rarezas.js y el icono de versión.
function dibujoDe(grupo, v) {
  if (grupo === 'idioma') return banderaHtml(v)
  if (grupo === 'catalogo') return v === 'sellado' ? icons.package(14) : banderaHtml(v === 'JP' ? 'ja' : 'en')
  if (grupo === 'rareza') return marcaDeRarezaHtml(v)
  if (grupo === 'variante') return `<span class="tds-pill-icono">${iconoDeVersion(v, 14)}</span>`
  if (grupo === 'estado') return `<i class="tds-estado" data-estado="${escapeHtml(v)}" aria-hidden="true"></i>`
  return ''
}

function opcionesHtml(grupo, valores, { contar = true } = {}) {
  const puestas = new Set(est.filtros[grupo] || [])
  const cuentas = est.facetas[grupo] || {}
  return `<div class="tds-pills">${valores.map((v) => {
    const n = cuentas[v]
    return `<button type="button" class="tds-pill${puestas.has(v) ? ' activa' : ''}" aria-pressed="${puestas.has(v)}" data-filtro="${grupo}" data-valor="${escapeHtml(v)}">${dibujoDe(grupo, v)}<span>${escapeHtml(nombreDe(grupo, v))}</span>${contar ? `<small>${n || 0}</small>` : ''}</button>`
  }).join('')}</div>`
}

// Las expansiones, en un DESPLEGABLE con su buscador (1077, PINGU: «cuantas
// más haya irás poniéndolas hacia abajo, que sea un desplegable, pero que se
// mantenga la búsqueda»): cerrado dice cuáles hay puestas; abierto, todas.
function desplegableDeSets(sets, buscaSet) {
  const puestas = est.filtros.sets || []
  const vistos = buscaSet ? sets.filter((s) => nombreDe('sets', s).toLowerCase().includes(buscaSet)) : sets
  const resumen = !puestas.length ? `Todas (${sets.length})` : puestas.length === 1 ? nombreDe('sets', puestas[0]) : `${puestas.length} expansiones`
  return `<details class="tds-desplegable" data-tds-sets ${est.setsAbierto ? 'open' : ''}>
    <summary><span>${escapeHtml(resumen)}</span>${icons.chevronRight?.(16) || ''}</summary>
    <div class="tds-desplegable-caja">
      <input type="search" class="tds-busca" data-tds-buscaset placeholder="Buscar expansión…" value="${escapeHtml(buscaSet)}" aria-label="Buscar expansión" />
      <div class="tds-checks">${vistos.map((s) => `<label><input type="checkbox" data-filtro="sets" data-valor="${escapeHtml(s)}" ${puestas.includes(s) ? 'checked' : ''} /><span>${escapeHtml(nombreDe('sets', s))}</span><small>${est.facetas.sets?.[s] || 0}</small></label>`).join('') || '<p class="tds-nada">Ninguna con ese nombre.</p>'}</div>
    </div>
  </details>`
}

function rangoHtml(min, max, texto) {
  return `<div class="tds-rango"><label>Desde<input type="number" inputmode="decimal" min="0" step="0.01" data-rango="${min}" value="${est.filtros[min] ?? ''}" placeholder="0" /></label><label>Hasta<input type="number" inputmode="decimal" min="0" step="0.01" data-rango="${max}" value="${est.filtros[max] ?? ''}" placeholder="—" /></label><span class="sr-only">${texto} en euros</span></div>`
}

function valoresDe(grupo) {
  const presentes = Object.keys(est.facetas[grupo] || {})
  const puestas = est.filtros[grupo] || []
  return [...new Set([...presentes, ...puestas])]
}

function pintarFiltros() {
  const sets = valoresDe('sets').sort((a, b) => (est.facetas.sets?.[b] || 0) - (est.facetas.sets?.[a] || 0))
  const buscaSet = ($('[data-tds-buscaset]')?.value || '').toLowerCase()
  const puestos = Object.keys(est.filtros).length
  const ordenIdiomas = IDIOMAS.map((i) => i.id)
  const ordenEstados = [...ESTADOS.map((e) => e.id), 'sellado']
  const grupo = (titulo, cuerpo, n = 0) => `<div class="tds-grupo"><h3>${titulo}${n ? ` <em>${n}</em>` : ''}</h3>${cuerpo}</div>`
  $('.tds-filtros').innerHTML = `
    <div class="tds-filtros-cab"><h2>Filtros</h2>${puestos ? `<button type="button" class="link-btn" data-tds="limpiar">Limpiar (${puestos})</button>` : ''}<button type="button" class="tds-cerrar" data-tds="cerrar-filtros" aria-label="Cerrar los filtros">×</button></div>
    ${grupo('Catálogo', opcionesHtml('catalogo', ['WEST', 'JP', 'sellado'].filter((v) => valoresDe('catalogo').includes(v))))}
    ${sets.length ? grupo('Expansión', desplegableDeSets(sets, buscaSet), (est.filtros.sets || []).length) : ''}
    ${grupo('Tu precio (€)', rangoHtml('precio_min', 'precio_max', 'Tu precio'))}
    ${grupo('Margen sobre lo pagado', opcionesHtml('margen', ['pierdes', '0-20', '20-50', '50+', 'sin_coste'], { contar: false }))}
    ${grupo('Contra Cardmarket', opcionesHtml('contra', ['debajo', 'igual', 'encima'], { contar: false }))}
    ${grupo('Idioma', opcionesHtml('idioma', valoresDe('idioma').sort((a, b) => ordenIdiomas.indexOf(a) - ordenIdiomas.indexOf(b))))}
    ${grupo('Estado', opcionesHtml('estado', valoresDe('estado').sort((a, b) => ordenEstados.indexOf(a) - ordenEstados.indexOf(b))))}
    ${valoresDe('variante').length > 1 ? grupo('Versión', opcionesHtml('variante', valoresDe('variante'))) : ''}
    ${valoresDe('rareza').length ? grupo('Rareza', opcionesHtml('rareza', valoresDe('rareza').sort((a, b) => (est.facetas.rareza?.[b] || 0) - (est.facetas.rareza?.[a] || 0)))) : ''}
    <details class="tds-grupo tds-mas-filtros" ${est.masAbierto ? 'open' : ''}><summary>Más filtros</summary>
      ${grupo('Cardmarket (€)', rangoHtml('cm_min', 'cm_max', 'Cardmarket'))}
      ${grupo('Lo que pagaste (€)', rangoHtml('coste_min', 'coste_max', 'Coste'))}
      ${grupo('Días en stock', opcionesHtml('dias', ['30', '30-90', '90+'], { contar: false }))}
      ${grupo('Unidades', opcionesHtml('unidades', ['agotadas', 'una', 'varias'], { contar: false }))}
      ${grupo('Gradeadas', opcionesHtml('gradeadas', ['si', 'no'], { contar: false }))}
      ${valoresDe('ubicacion').length ? grupo('Dónde está', opcionesHtml('ubicacion', valoresDe('ubicacion'))) : ''}
      ${grupo('Escaparate', opcionesHtml('visible', ['si', 'no'], { contar: false }))}
    </details>
    <div class="tds-filtros-pie"><button type="button" class="btn-secondary" data-tds="limpiar">Limpiar</button><button type="button" class="btn-primary" data-tds="cerrar-filtros">Ver ${est.total.toLocaleString('es-ES')}</button></div>`
}

function pintarAplicados() {
  const chapas = chapasDeFiltros(est.filtros, nombreDe)
  $('.tds-aplicados').innerHTML = chapas.length
    ? `${chapas.map((c, i) => `<button type="button" class="tds-aplicado" data-quitar="${i}" aria-label="Quitar ${escapeHtml(c.texto)}">${escapeHtml(c.texto)} <span aria-hidden="true">×</span></button>`).join('')}<button type="button" class="link-btn" data-tds="limpiar">Limpiar todo</button>`
    : ''
  est.chapas = chapas
}

function pintarVistas() {
  const actual = JSON.stringify(est.filtros)
  $('.tds-vistas').innerHTML = `<button type="button" class="tds-vista${actual === '{}' ? ' activa' : ''}" data-vista="">Todo</button>
    ${est.vistas.map((v) => `<span class="tds-vista-caja"><button type="button" class="tds-vista${JSON.stringify(v.filtros) === actual ? ' activa' : ''}" data-vista="${escapeHtml(v.id)}">${escapeHtml(v.nombre)}</button><button type="button" class="tds-vista-quitar" data-quitar-vista="${escapeHtml(v.id)}" aria-label="Borrar la vista ${escapeHtml(v.nombre)}">×</button></span>`).join('')}
    ${actual !== '{}' && !est.vistas.some((v) => JSON.stringify(v.filtros) === actual) ? '<button type="button" class="tds-vista tds-vista-nueva" data-tds="guardar-vista">+ Guardar esta vista</button>' : ''}`
}

function pintarSeleccion() {
  const barra = $('.tds-sel')
  barra.hidden = !est.seleccionando
  $('[data-tds="seleccionar"]').setAttribute('aria-pressed', String(est.seleccionando))
  $('[data-tds="seleccionar"]').classList.toggle('activa', est.seleccionando)
  const n = est.marcadas.size
  barra.querySelector('.tds-sel-n').textContent = n ? `${n} ${n === 1 ? 'marcada' : 'marcadas'}` : 'Marca las que quieras'
  for (const b of barra.querySelectorAll('button[data-bloque]')) b.disabled = !n
  barra.querySelector('[data-bloque="destacar"]').hidden = est.destacadas == null
  barra.querySelector('[data-bloque="oferta"]').hidden = est.destacadas == null
}

function pintarTodo() {
  pintarTabla()
  pintarPie()
  pintarFiltros()
  pintarAplicados()
  pintarVistas()
  pintarSeleccion()
}

// ── Cambiar filtros ──

let espera = null
function cambiar(filtros, { ya = true } = {}) {
  est.filtros = filtros
  est.marcadas.clear()
  clearTimeout(espera)
  if (ya) pedir()
  else espera = setTimeout(pedir, 350)
}

function rango(campo, valor) {
  const f = { ...est.filtros }
  const v = num(valor)
  if (v == null || !Number.isFinite(v)) delete f[campo]
  else f[campo] = v
  cambiar(f, { ya: false })
}

// ── Añadir ──

function dialogo(id, clase, html) {
  let d = document.getElementById(id)
  if (!d) {
    d = document.createElement('dialog')
    d.id = id
    d.className = `tds-dialogo ${clase}`
    document.body.append(d)
    d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  }
  d.innerHTML = html
  return d
}

async function abrirAnadir() {
  const d = dialogo('tdsAnadir', 'tds-anadir', `
    <div class="tds-dialogo-cuerpo">
      <div class="tds-dialogo-cab"><h2>Añadir al stock</h2><button type="button" class="tds-cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <div class="seg" role="group" aria-label="Qué añadir">
        <button type="button" class="seg-btn activa" aria-pressed="true" data-que="WEST">Cartas</button>
        <button type="button" class="seg-btn" aria-pressed="false" data-que="JP">Japón</button>
        <button type="button" class="seg-btn" aria-pressed="false" data-que="sellado">Sellado</button>
      </div>
      <input type="search" class="tds-busca tds-busca-grande" id="tdsAnadirQ" placeholder="Nombre, número (Pikachu 25) o expansión…" autocomplete="off" />
      <div class="tds-resultados" id="tdsAnadirLista" aria-live="polite"></div>
      <form class="tds-form hidden" id="tdsAnadirForm" novalidate></form>
    </div>`)
  let que = 'WEST'
  let n = 0
  const lista = d.querySelector('#tdsAnadirLista')
  const buscar = async () => {
    const q = d.querySelector('#tdsAnadirQ').value.trim()
    const mio = ++n
    if (q.length < 2) {
      lista.innerHTML = '<p class="tds-nota">Escribe al menos dos letras.</p>'
      return
    }
    lista.innerHTML = '<p class="tds-nota">Buscando…</p>'
    try {
      if (que === 'sellado') {
        const r = await buscarProductos(q, { limite: 30 })
        if (mio !== n) return
        if (r.error) throw r.error
        const productos = r.data || []
        lista.innerHTML = productos.length ? productos.map((p) => `<button type="button" class="tds-resultado" data-producto="${escapeHtml(String(p.id))}"><span class="tds-foto-caja tds-foto-caja-producto">${p.image ? `<img src="${escapeHtml(p.image)}" alt="" width="40" height="40" loading="lazy" class="tds-foto" onerror="this.remove()" />` : ''}</span><span><strong>${escapeHtml(p.name)}</strong><small>Sellado${p.lang ? ` · ${escapeHtml(String(p.lang).toUpperCase())}` : ''}</small></span></button>`).join('') : '<p class="tds-nota">No sale ningún producto con eso.</p>'
        for (const p of productos) est.productos.set(String(p.id), p)
        return
      }
      const { lista: cartas } = await buscarComoEnCartas(q, 40, { columnas: COLUMNAS, market: que })
      if (mio !== n) return
      for (const c of cartas) est.cartas.set(c.id, c)
      lista.innerHTML = cartas.length ? cartas.map((c) => {
        const attrs = atributosDeEscaneo(cadenaDeEscaneo(c))
        return `<button type="button" class="tds-resultado" data-carta="${escapeHtml(c.id)}"><span class="tds-foto-caja">${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" class="tds-foto" />` : ''}</span><span><strong>${escapeHtml(nombreDeCarta(c))}</strong><small>${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} · ${escapeHtml(c.local_id || '')}</small></span></button>`
      }).join('') : '<p class="tds-nota">No sale ninguna carta con eso.</p>'
    } catch (e) {
      if (mio === n) lista.innerHTML = `<p class="tds-nota">No se ha podido buscar: ${escapeHtml(e?.message || 'sin motivo')}.</p>`
    }
  }
  let t = null
  d.querySelector('#tdsAnadirQ').addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 300) })
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) return d.close()
    const b = e.target.closest('[data-que]')
    if (b) {
      que = b.dataset.que
      for (const x of d.querySelectorAll('[data-que]')) { x.classList.toggle('activa', x === b); x.setAttribute('aria-pressed', String(x === b)) }
      d.querySelector('#tdsAnadirForm').classList.add('hidden')
      lista.classList.remove('hidden')
      buscar()
      return
    }
    const carta = e.target.closest('[data-carta]')
    if (carta) return montarForm(d, { carta: est.cartas.get(carta.dataset.carta) })
    const producto = e.target.closest('[data-producto]')
    if (producto) return montarForm(d, { producto: est.productos.get(producto.dataset.producto) })
  })
  d.showModal()
  d.querySelector('#tdsAnadirQ').focus()
}

// El formulario de una línea: para añadir (carta o producto) o para editar
// (`fila`). Los idiomas son los del SET (911) y las versiones, las que
// existen en ese idioma (922, 956): lo mismo que la hoja de Mi colección.
async function montarForm(d, { carta = null, producto = null, fila = null }) {
  const form = d.querySelector('form')
  const lista = d.querySelector('.tds-resultados')
  lista?.classList.add('hidden')
  form.classList.remove('hidden')
  const market = carta?.market || fila?.market || 'WEST'
  const esProducto = !!(producto || fila?.product_id)
  let idiomas = market === 'JP' ? idiomasParaAnadirEn('JP', [], null) : OCCIDENTALES
  let reglas = sinReglas()
  let versiones = []
  if (carta) {
    const [delSet, rs] = await Promise.all([idiomasDeSetSinEsperar(carta.set_id, market), reglasDeVersiones(carta.set_id, market).catch(() => sinReglas())])
    idiomas = idiomasParaAnadirEn(market, OCCIDENTALES, delSet)
    reglas = rs
    versiones = variantesDeCarta(carta).map((v) => ({ id: v.nuestro, nombre: v.nombre }))
  }
  const v = fila || {}
  const idioma = v.idioma || (market === 'JP' ? 'ja' : idiomas.some((i) => i.id === 'es') ? 'es' : idiomas[0]?.id)
  if (fila && !idiomas.some((i) => i.id === fila.idioma)) idiomas = [...idiomas, IDIOMAS.find((i) => i.id === fila.idioma) || { id: fila.idioma, nombre: fila.idioma }]
  const versionesDe = (id) => (versiones.length ? versionesDelIdioma(versiones, reglas, id, carta?.id).versiones : [])
  const titulo = esProducto ? producto?.name || nombreFila(fila) : carta ? nombreDeCarta(carta) : nombreFila(fila)
  form.innerHTML = `
    <p class="tds-form-titulo"><strong>${escapeHtml(titulo)}</strong>${carta ? `<small>${escapeHtml(nombreDeSet(carta.tcg_sets) || carta.set_id)} · ${escapeHtml(carta.local_id || '')}</small>` : ''}</p>
    ${esProducto ? '' : `<div class="tds-form-fila">
      <label>Idioma<select name="idioma">${idiomas.map((i) => `<option value="${i.id}" ${i.id === idioma ? 'selected' : ''}>${escapeHtml(i.nombre)}</option>`).join('')}</select></label>
      <label>Estado<select name="estado">${ESTADOS.map((e) => `<option value="${e.id}" ${(v.estado || 'NM') === e.id ? 'selected' : ''}>${e.id} · ${escapeHtml(e.nombre)}</option>`).join('')}</select></label>
    </div>
    <label class="tds-version${versionesDe(idioma).length > 1 ? '' : ' hidden'}">Versión<select name="variante"></select></label>
    <label>Gradeada (opcional)<input name="gradeo" maxlength="20" placeholder="PSA 10" value="${escapeHtml(v.gradeo || '')}" /></label>`}
    <div class="tds-form-fila">
      <label>Unidades<input name="unidades" type="number" inputmode="numeric" min="0" max="99999" value="${v.unidades ?? 1}" /></label>
      <label>Lo que pagaste (€/u)<input name="coste" type="number" inputmode="decimal" min="0" step="0.01" value="${v.coste ?? ''}" /></label>
      <label>Tu precio (€/u)<input name="precio" type="number" inputmode="decimal" min="0" step="0.01" value="${v.precio ?? ''}" /></label>
    </div>
    <p class="tds-cm" data-cm></p>
    ${est.destacadas != null ? `<details class="tds-oferta-form"${ofertaDe(v) ? ' open' : ''}>
      <summary>Oferta${ofertaDe(v) ? ` · ${euros(ofertaDe(v).precio)}` : ''}</summary>
      <div class="tds-form-fila">
        <label>Precio de oferta (€/u)<input name="oferta_precio" type="number" inputmode="decimal" min="0" step="0.01" value="${v.oferta_precio ?? ''}" /></label>
        <label>Hasta (opcional)<input name="oferta_hasta" type="date" value="${v.oferta_hasta ? new Date(v.oferta_hasta).toLocaleDateString('sv') : ''}" /></label>
      </div>
      <p class="tds-nota">En el escaparate sale este precio, con el tuyo tachado. Sin fecha, dura hasta que la quites (deja el precio vacío).</p>
    </details>
    <label class="tds-check-label"><input type="checkbox" name="destacada" ${v.destacada ? 'checked' : ''} /> Destacada en tu escaparate (${est.destacadas} de 8)</label>` : ''}
    <div class="tds-form-fila">
      <label>Dónde está (opcional)<input name="ubicacion" maxlength="60" list="tdsUbicaciones" placeholder="Vitrina, carpeta 3…" value="${escapeHtml(v.ubicacion || '')}" /></label>
      <label class="tds-check-label"><input type="checkbox" name="visible" ${v.visible === false ? '' : 'checked'} /> Se ve en el escaparate</label>
    </div>
    <datalist id="tdsUbicaciones">${Object.keys(est.facetas.ubicacion || {}).map((u) => `<option value="${escapeHtml(u)}"></option>`).join('')}</datalist>
    <label>Notas (opcional)<input name="notas" maxlength="300" value="${escapeHtml(v.notas || '')}" /></label>
    <p class="tds-error" role="alert"></p>
    <div class="tds-form-pie">
      ${fila ? `<button type="button" class="btn-secondary tds-borrar" data-borrar="${escapeHtml(fila.id)}">Borrar</button>` : '<button type="button" class="btn-secondary" data-volver>← Otra</button>'}
      ${fila && fila.unidades > 0 ? '<button type="button" class="btn-secondary" data-vender-esta>Vender</button>' : ''}
      ${fila ? '' : '<button type="submit" class="btn-secondary" data-seguir>Añadir y seguir</button>'}
      <button type="submit" class="btn-primary">${fila ? 'Guardar' : 'Añadir'}</button>
    </div>`
  const sel = form.querySelector('[name="variante"]')
  const ponerVersiones = () => {
    if (!sel) return
    const id = form.querySelector('[name="idioma"]').value
    const vs = versionesDe(id)
    const antes = sel.value || v.variante || vs[0]?.id || 'normal'
    // Un <select> con un valor que no está entre sus opciones se queda con la
    // primera y la escribe al guardar (la 472): el de la fila va siempre.
    const conLaSuya = fila?.variante && !vs.some((x) => x.id === fila.variante) ? [...vs, { id: fila.variante, nombre: nombreDeVariante(fila.variante) }] : vs
    sel.innerHTML = conLaSuya.map((x) => `<option value="${escapeHtml(x.id)}" ${x.id === antes ? 'selected' : ''}>${escapeHtml(x.nombre)}</option>`).join('')
    form.querySelector('.tds-version').classList.toggle('hidden', conLaSuya.length < 2)
  }
  ponerVersiones()
  // Lo que vale en Cardmarket, como en la ficha (la 900): el mínimo de SU
  // idioma y su versión, con un «poner» rápido.
  let filaPrecio = null
  if (carta) filaPrecio = (await supabase.from('tcg_card_prices').select('*').eq('card_id', carta.id).maybeSingle()).data
  const pintarCm = () => {
    const caja = form.querySelector('[data-cm]')
    let cm = null
    if (esProducto) {
      const p = producto || est.productos.get(String(fila?.product_id))
      cm = fila?.cm ?? p?.cm_lowest_es ?? p?.cm_lowest_eu ?? p?.cm_lowest ?? null
    } else if (filaPrecio) {
      cm = valorDe(precioDeFila(filaPrecio, { variante: sel?.value || 'normal' }), form.querySelector('[name="idioma"]').value)
    } else if (fila) cm = fila.cm
    caja.innerHTML = cm > 0
      ? `Cardmarket: <strong>${euros(cm)}</strong> · <button type="button" class="link-btn" data-poner="${cm}">Poner ese</button> · <button type="button" class="link-btn" data-poner="${precioSugerido(cm, 10, '95')}">+10 % (${euros(precioSugerido(cm, 10, '95'))})</button>`
      : 'Sin precio de Cardmarket para este idioma.'
  }
  pintarCm()
  form.querySelector('[name="idioma"]')?.addEventListener('change', () => { ponerVersiones(); pintarCm() })
  sel?.addEventListener('change', pintarCm)
  form.onclick = async (e) => {
    const poner = e.target.closest('[data-poner]')
    if (poner) form.querySelector('[name="precio"]').value = Number(poner.dataset.poner).toFixed(2)
    if (e.target.closest('[data-volver]')) {
      form.classList.add('hidden')
      lista?.classList.remove('hidden')
    }
    // Vender esta línea (1072): la hoja de Vender, con ella ya puesta.
    if (e.target.closest('[data-vender-esta]')) {
      d.close()
      return document.dispatchEvent(new CustomEvent('pokedoc:tienda-vender', { detail: [fila] }))
    }
    const borrar = e.target.closest('[data-borrar]')
    if (borrar) {
      if (borrar.dataset.seguro !== 'si') {
        borrar.dataset.seguro = 'si'
        borrar.textContent = '¿Seguro? Tócalo otra vez'
        return
      }
      const { error } = await supabase.from('tienda_stock').delete().eq('id', borrar.dataset.borrar)
      if (error) return (form.querySelector('.tds-error').textContent = 'No se ha podido borrar.')
      d.close()
      showToast('Borrada del stock.', 'success')
      pedir()
    }
  }
  form.onsubmit = async (e) => {
    e.preventDefault()
    const seguir = e.submitter?.hasAttribute('data-seguir')
    const datos = Object.fromEntries(new FormData(form))
    const unidades = Math.round(num(datos.unidades) ?? 1)
    const coste = num(datos.coste)
    const precio = num(datos.precio)
    const error = form.querySelector('.tds-error')
    if (!Number.isFinite(unidades) || unidades < 0) return (error.textContent = 'Revisa las unidades.')
    if ((coste != null && !(coste >= 0)) || (precio != null && !(precio >= 0))) return (error.textContent = 'Revisa los precios.')
    const linea = {
      unidades,
      coste,
      precio,
      ubicacion: (datos.ubicacion || '').trim() || null,
      visible: form.querySelector('[name="visible"]').checked,
      notas: (datos.notas || '').trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (!esProducto) Object.assign(linea, { idioma: datos.idioma, estado: datos.estado, variante: sel?.value || 'normal', gradeo: (datos.gradeo || '').trim() || null })
    // La oferta y la estrella (1079, 1082): solo con la migración.
    if (est.destacadas != null) {
      const oferta = num(datos.oferta_precio)
      if (oferta != null && !(oferta >= 0)) return (error.textContent = 'Revisa el precio de oferta.')
      linea.oferta_precio = oferta
      // El día que se pone es el último de la oferta: hasta el final de ese día.
      linea.oferta_hasta = oferta != null && datos.oferta_hasta ? new Date(`${datos.oferta_hasta}T23:59:59`).toISOString() : null
      const destacada = form.querySelector('[name="destacada"]').checked
      if (destacada && !v.destacada && est.destacadas >= 8) return (error.textContent = 'Como mucho 8 destacadas: quita la estrella a otra antes.')
      linea.destacada = destacada
    }
    const boton = e.submitter
    if (boton) boton.disabled = true
    const r = fila
      ? await supabase.from('tienda_stock').update(linea).eq('id', fila.id).select('id')
      : await supabase.from('tienda_stock').insert({
          ...linea,
          tienda_id: perfil.id,
          ...(esProducto ? { product_id: Number(producto.id), estado: 'sellado', idioma: producto.lang || 'en', variante: 'normal', market: producto.market === 'JP' ? 'JP' : 'WEST' } : { card_id: carta.id, market }),
        }).select('id')
    if (boton) boton.disabled = false
    // Una escritura que la política no deja pasar vuelve vacía (la 510).
    if (r.error || !(r.data && r.data.length)) return (error.textContent = `No se ha podido guardar${r.error?.message ? `: ${r.error.message}` : ''}.`)
    showToast(fila ? 'Guardado.' : `Añadida: ${titulo}.`, 'success')
    pedir()
    if (seguir) {
      form.classList.add('hidden')
      lista?.classList.remove('hidden')
      d.querySelector('#tdsAnadirQ')?.select()
    } else d.close()
  }
}

function abrirEditar(id) {
  const fila = est.filas.find((f) => f.id === id)
  if (!fila) return
  const d = dialogo('tdsEditar', 'tds-editar', `<div class="tds-dialogo-cuerpo"><div class="tds-dialogo-cab"><h2>Editar</h2><button type="button" class="tds-cerrar" data-cerrar aria-label="Cerrar">×</button></div><form class="tds-form" novalidate></form></div>`)
  d.querySelector('[data-cerrar]').addEventListener('click', () => d.close())
  d.showModal()
  montarForm(d, { carta: fila.card_id ? est.cartas.get(fila.card_id) || null : null, fila })
}

// ── En bloque ──

function abrirPrecioBloque() {
  const ids = [...est.marcadas]
  const d = dialogo('tdsPrecio', 'tds-precio', `
    <form class="tds-dialogo-cuerpo tds-form" novalidate>
      <div class="tds-dialogo-cab"><h2>Poner precio a ${ids.length}</h2><button type="button" class="tds-cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <p class="tds-nota">Tu precio será lo que vale en Cardmarket (el mínimo de su idioma) más lo que digas, redondeado.</p>
      <div class="tds-form-fila">
        <label>Cardmarket +<span class="tds-pct"><input name="pct" type="number" inputmode="decimal" step="1" min="-90" max="1000" value="10" /> %</span></label>
        <label>Redondeo<select name="redondeo"><option value="95">A ,95</option><option value="99">A ,99</option><option value="entero">Al euro de arriba</option><option value="centimo">Tal cual</option></select></label>
      </div>
      <p class="tds-nota" data-ejemplo></p>
      <p class="tds-error" role="alert"></p>
      <div class="tds-form-pie"><button type="button" class="btn-secondary" data-cerrar>Cancelar</button><button type="submit" class="btn-primary">Poner precio</button></div>
    </form>`)
  const form = d.querySelector('form')
  const ejemplo = () => {
    const pct = num(form.pct.value) || 0
    form.querySelector('[data-ejemplo]').textContent = `Por ejemplo, una de 12,40 € en Cardmarket quedaría a ${euros(precioSugerido(12.4, pct, form.redondeo.value))}.`
  }
  form.addEventListener('input', ejemplo)
  ejemplo()
  d.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) d.close() })
  form.onsubmit = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.rpc('tienda_stock_precio_bloque', { p_ids: ids, p_pct: num(form.pct.value) || 0, p_redondeo: form.redondeo.value })
    if (error) return (form.querySelector('.tds-error').textContent = error.message || 'No se ha podido.')
    d.close()
    showToast(`Precio puesto a ${data?.cambiadas ?? 0}${data?.sin_cardmarket ? `; ${data.sin_cardmarket} sin precio de Cardmarket se quedan como estaban` : ''}.`, 'success')
    est.marcadas.clear()
    pedir()
  }
  d.showModal()
}

// La oferta en bloque (1082): un tanto por ciento sobre el precio de cada
// una (o un precio fijo para todas), con fecha de fin opcional; o quitarla.
function abrirOfertaBloque() {
  const marcadas = est.filas.filter((f) => est.marcadas.has(f.id))
  const d = dialogo('tdsOferta', 'tds-precio', `
    <form class="tds-dialogo-cuerpo tds-form" novalidate>
      <div class="tds-dialogo-cab"><h2>Oferta en ${marcadas.length}</h2><button type="button" class="tds-cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <div class="seg" role="radiogroup" aria-label="Cómo">
        <label class="seg-btn activa"><input type="radio" name="modo" value="pct" checked class="sr-only" /> Rebaja en %</label>
        <label class="seg-btn"><input type="radio" name="modo" value="fijo" class="sr-only" /> Un precio</label>
      </div>
      <div class="tds-form-fila">
        <label data-modo="pct">Rebaja<span class="tds-pct"><input name="pct" type="number" inputmode="decimal" step="1" min="1" max="90" value="10" /> %</span></label>
        <label data-modo="fijo" hidden>Precio de oferta (€/u)<input name="fijo" type="number" inputmode="decimal" min="0" step="0.01" /></label>
        <label>Hasta (opcional)<input name="hasta" type="date" min="${new Date().toLocaleDateString('sv')}" /></label>
      </div>
      <p class="tds-nota" data-ejemplo></p>
      <p class="tds-error" role="alert"></p>
      <div class="tds-form-pie"><button type="button" class="btn-secondary" data-quitar-oferta>Quitar la oferta</button><button type="submit" class="btn-primary">Poner la oferta</button></div>
    </form>`)
  const form = d.querySelector('form')
  const modo = () => form.querySelector('[name="modo"]:checked').value
  const sinPrecio = marcadas.filter((f) => f.precio == null).length
  const ejemplo = () => {
    for (const l of form.querySelectorAll('[data-modo]')) l.hidden = l.dataset.modo !== modo()
    for (const r of form.querySelectorAll('[name="modo"]')) r.closest('.seg-btn').classList.toggle('activa', r.checked)
    const una = marcadas.find((f) => f.precio != null)
    form.querySelector('[data-ejemplo]').textContent = modo() === 'pct'
      ? `${una ? `Por ejemplo, ${nombreFila(una)} pasa de ${euros(una.precio)} a ${euros(precioRebajado(una.precio, num(form.pct.value) || 0))}.` : ''}${sinPrecio ? ` ${sinPrecio === 1 ? 'Una no tiene precio: se queda' : `${sinPrecio} no tienen precio: se quedan`} sin oferta.` : ''}`
      : 'Todas a ese precio, sea cual sea el suyo.'
  }
  form.addEventListener('input', ejemplo)
  form.addEventListener('change', ejemplo)
  ejemplo()
  const escribir = async (cambios) => {
    const resultados = await Promise.all(cambios.map(([ids, valores]) => supabase.from('tienda_stock').update({ ...valores, updated_at: new Date().toISOString() }).in('id', ids).select('id')))
    const hechas = resultados.reduce((n, r) => n + (r.data?.length || 0), 0)
    if (resultados.some((r) => r.error) || !hechas) return (form.querySelector('.tds-error').textContent = 'No se ha podido.'), null
    return hechas
  }
  d.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cerrar]')) return d.close()
    if (!e.target.closest('[data-quitar-oferta]')) return
    const hechas = await escribir([[marcadas.map((f) => f.id), { oferta_precio: null, oferta_hasta: null }]])
    if (hechas == null) return
    d.close()
    showToast(`Sin oferta: ${hechas}.`, 'success')
    est.marcadas.clear()
    pedir()
  })
  form.onsubmit = async (e) => {
    e.preventDefault()
    const hasta = form.hasta.value ? new Date(`${form.hasta.value}T23:59:59`).toISOString() : null
    let cambios
    if (modo() === 'fijo') {
      const fijo = num(form.fijo.value)
      if (fijo == null || !(fijo >= 0)) return (form.querySelector('.tds-error').textContent = 'Pon el precio de oferta.')
      cambios = [[marcadas.map((f) => f.id), { oferta_precio: fijo, oferta_hasta: hasta }]]
    } else {
      const pct = num(form.pct.value)
      if (!(pct > 0 && pct < 100)) return (form.querySelector('.tds-error').textContent = 'La rebaja va del 1 al 90 %.')
      // Cada una con SU precio: una escritura por precio distinto.
      const porPrecio = new Map()
      for (const f of marcadas) {
        const o = precioRebajado(f.precio, pct)
        if (o == null) continue
        porPrecio.set(o, [...(porPrecio.get(o) || []), f.id])
      }
      cambios = [...porPrecio].map(([o, ids]) => [ids, { oferta_precio: o, oferta_hasta: hasta }])
      if (!cambios.length) return (form.querySelector('.tds-error').textContent = 'Ninguna de las marcadas tiene precio.')
    }
    const hechas = await escribir(cambios)
    if (hechas == null) return
    d.close()
    showToast(`Oferta puesta en ${hechas}${hechas < marcadas.length ? ` (${marcadas.length - hechas} sin precio, sin oferta)` : ''}.`, 'success')
    est.marcadas.clear()
    pedir()
  }
  d.showModal()
}

async function enBloque(accion) {
  const ids = [...est.marcadas]
  if (!ids.length) return
  if (accion === 'precio') return abrirPrecioBloque()
  if (accion === 'oferta') return abrirOfertaBloque()
  if (accion === 'destacar') {
    const nuevas = est.filas.filter((f) => est.marcadas.has(f.id) && !f.destacada).length
    if (est.destacadas + nuevas > 8) return showToast(`Como mucho 8 destacadas: te quedan ${Math.max(0, 8 - est.destacadas)}.`, 'error')
    const { data, error } = await supabase.from('tienda_stock').update({ destacada: true }).in('id', ids).select('id')
    if (error || !data?.length) return showToast(/Como mucho/.test(error?.message || '') ? MAS_DE_OCHO : 'No se ha podido.', 'error')
    showToast(`Destacadas en tu escaparate: ${est.destacadas + nuevas} de 8.`, 'success')
    est.marcadas.clear()
    return pedir()
  }
  if (accion === 'vender') return document.dispatchEvent(new CustomEvent('pokedoc:tienda-vender', { detail: est.filas.filter((f) => est.marcadas.has(f.id) && f.unidades > 0) }))
  if (accion === 'borrar') {
    const b = $('[data-bloque="borrar"]')
    if (b.dataset.seguro !== 'si') {
      b.dataset.seguro = 'si'
      b.textContent = `¿Borrar ${ids.length}? Toca otra vez`
      return
    }
    b.dataset.seguro = ''
    b.textContent = 'Borrar'
  }
  const consulta = accion === 'borrar'
    ? supabase.from('tienda_stock').delete().in('id', ids).select('id')
    : supabase.from('tienda_stock').update({ visible: accion === 'ensenar', updated_at: new Date().toISOString() }).in('id', ids).select('id')
  const { data, error } = await consulta
  if (error || !(data && data.length)) return showToast('No se ha podido.', 'error')
  showToast(accion === 'borrar' ? `Borradas ${data.length}.` : accion === 'ensenar' ? `Ahora se ven ${data.length}.` : `Ocultas ${data.length}.`, 'success')
  est.marcadas.clear()
  pedir()
}

// ── Vistas ──

async function guardarVista() {
  const caja = $('.tds-vistas')
  if (caja.querySelector('.tds-vista-form')) return
  caja.insertAdjacentHTML('beforeend', '<form class="tds-vista-form"><input name="nombre" maxlength="40" placeholder="Nombre de la vista" aria-label="Nombre de la vista" required /><button type="submit" class="btn-secondary">Guardar</button></form>')
  const form = caja.querySelector('.tds-vista-form')
  form.nombre.focus()
  form.onsubmit = async (e) => {
    e.preventDefault()
    const nombre = form.nombre.value.trim()
    if (!nombre) return
    const { error } = await supabase.from('tienda_vistas').insert({ tienda_id: perfil.id, nombre, filtros: est.filtros, orden: est.vistas.length })
    if (error) return showToast('No se ha podido guardar la vista.', 'error')
    cargarVistas()
  }
}

// ── CSV ──

async function exportar() {
  const boton = $('[data-tds="exportar"]')
  boton.disabled = true
  const todas = []
  for (let desde = 0; ; desde += 5000) {
    const { data, error } = await supabase.rpc('tienda_stock_lista', { p_filtros: est.filtros, p_orden: 'nombre', p_desde: desde, p_cuantas: 5000 })
    if (error) { boton.disabled = false; return showToast('No se ha podido exportar.', 'error') }
    todas.push(...(data.filas || []))
    if (todas.length >= (data.total || 0) || !(data.filas || []).length) break
  }
  await completarSets([...new Set(todas.map((f) => f.set_id).filter(Boolean))])
  const blob = new Blob(['﻿' + csvDeStock(todas, (id) => est.sets.get(id) || id)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `stock-${(perfil.username || 'tienda')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  boton.disabled = false
}

async function abrirImportar() {
  const { abrirImportarStock } = await import('./tienda-importar.js')
  abrirImportarStock({ perfil, alTerminar: () => pedir() })
}

// Poner unos filtros desde fuera (los avisos de Hoy, 1073).
export function filtrarStock(filtros) {
  if (!caja) return
  const q = $('[data-tds-q]')
  if (q) q.value = filtros?.q || ''
  cambiar({ ...(filtros || {}) })
}

// ── Montar ──

export function montarStock(destino, { perfil: p }) {
  caja = destino
  perfil = p
  // Las banderas y las marcas de rareza de los filtros (1077) viven en las
  // hojas de toda la web: se piden aquí, que solo lo abre una tienda.
  hojaInyectada('css/cardmarket.css')
  hojaInyectada('css/carta-holo.css')
  caja.innerHTML = `
    <div class="tds">
      <aside class="tds-filtros" aria-label="Filtros del stock"></aside>
      <div class="tds-cuerpo">
        <div class="tds-arriba">
          <input type="search" class="tds-busca" data-tds-q placeholder="Buscar por nombre o número…" aria-label="Buscar en tu stock" />
          <div class="tds-barra">
          <select class="tds-orden" data-tds-orden aria-label="Orden">${ORDENES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
          <button type="button" class="btn-secondary tds-boton tds-ver-filtros" data-tds="abrir-filtros">${ICONOS_COLECCION.sliders(18)}<span>Filtros</span></button>
          <button type="button" class="btn-secondary tds-boton" data-tds="seleccionar" aria-pressed="false">${icons.checkSquare(18)}<span>Seleccionar</span></button>
          <button type="button" class="btn-secondary tds-boton tds-boton-icono" data-tds="importar" aria-label="Importar un CSV" title="Importar un CSV">${icons.upload(18)}</button>
          <button type="button" class="btn-secondary tds-boton tds-boton-icono" data-tds="exportar" aria-label="Exportar a CSV" title="Exportar a CSV">${icons.arrowDown(18)}</button>
          <a class="btn-secondary tds-boton" href="/cartas" title="Busca cartas por expansión, Pokédex o nombre y añádelas a tu stock">${icons.layers(18)}<span>Colección</span></a>
          <button type="button" class="btn-primary tds-boton tds-anadir" data-tds="anadir"><span aria-hidden="true">+</span><span>Añadir</span></button>
          </div>
        </div>
        <div class="tds-vistas"></div>
        <div class="tds-aplicados"></div>
        <div class="tds-tabla-caja"><p class="tds-vacio">Cargando tu stock…</p></div>
        <div class="tds-pie"></div>
        <div class="tds-sel" hidden>
          <span class="tds-sel-n"></span>
          <button type="button" class="btn-primary" data-bloque="vender">Vender</button>
          <button type="button" class="btn-secondary" data-bloque="precio">Poner precio</button>
          <button type="button" class="btn-secondary" data-bloque="oferta" hidden>Oferta</button>
          <button type="button" class="btn-secondary" data-bloque="destacar" hidden>${icons.star(16)}<span>Destacar</span></button>
          <button type="button" class="btn-secondary" data-bloque="ocultar">Ocultar</button>
          <button type="button" class="btn-secondary" data-bloque="ensenar">Enseñar</button>
          <button type="button" class="btn-secondary tds-borrar" data-bloque="borrar">Borrar</button>
        </div>
      </div>
    </div>`

  caja.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-tds]')?.dataset.tds
    if (accion === 'anadir') return abrirAnadir()
    if (accion === 'importar') return abrirImportar()
    if (accion === 'exportar') return exportar()
    if (accion === 'limpiar') { $('[data-tds-q]').value = ''; return cambiar({}) }
    if (accion === 'mas') return pedir({ mas: true })
    if (accion === 'abrir-filtros') return $('.tds-filtros').classList.add('abierta')
    if (accion === 'cerrar-filtros') return $('.tds-filtros').classList.remove('abierta')
    if (accion === 'guardar-vista') return guardarVista()
    if (accion === 'seleccionar') {
      est.seleccionando = !est.seleccionando
      if (!est.seleccionando) est.marcadas.clear()
      pintarTabla()
      return pintarSeleccion()
    }
    if (accion === 'todas') {
      const todas = e.target.checked
      for (const f of est.filas) todas ? est.marcadas.add(f.id) : est.marcadas.delete(f.id)
      pintarTabla()
      return pintarSeleccion()
    }
    const filtro = e.target.closest('[data-filtro]')
    if (filtro) return cambiar(alternarFiltro(est.filtros, filtro.dataset.filtro, filtro.dataset.valor))
    const quitar = e.target.closest('[data-quitar]')
    if (quitar) return cambiar(quitarChapa(est.filtros, est.chapas[Number(quitar.dataset.quitar)]))
    const vista = e.target.closest('[data-vista]')
    if (vista) {
      const v = est.vistas.find((x) => x.id === vista.dataset.vista)
      $('[data-tds-q]').value = v?.filtros?.q || ''
      return cambiar(v ? { ...v.filtros } : {})
    }
    const quitarVista = e.target.closest('[data-quitar-vista]')
    if (quitarVista) {
      supabase.from('tienda_vistas').delete().eq('id', quitarVista.dataset.quitarVista).then(() => cargarVistas())
      return
    }
    const estrella = e.target.closest('[data-estrella]')
    if (estrella) return alternarEstrella(estrella.dataset.estrella)
    const bloque = e.target.closest('[data-bloque]')
    if (bloque) return enBloque(bloque.dataset.bloque)
    const marcar = e.target.closest('[data-marcar]')
    if (marcar) {
      marcar.checked ? est.marcadas.add(marcar.dataset.marcar) : est.marcadas.delete(marcar.dataset.marcar)
      marcar.closest('tr').classList.toggle('tds-marcada', marcar.checked)
      return pintarSeleccion()
    }
    const fila = e.target.closest('[data-fila]')
    if (fila && !e.target.closest('a, button, input')) {
      if (est.seleccionando) {
        const id = fila.dataset.fila
        est.marcadas.has(id) ? est.marcadas.delete(id) : est.marcadas.add(id)
        pintarTabla()
        return pintarSeleccion()
      }
      return abrirEditar(fila.dataset.fila)
    }
  })
  caja.addEventListener('toggle', (e) => {
    if (e.target.classList?.contains('tds-mas-filtros')) est.masAbierto = e.target.open
    if (e.target.matches?.('[data-tds-sets]')) est.setsAbierto = e.target.open
  }, true)
  caja.addEventListener('input', (e) => {
    if (e.target.matches('[data-tds-q]')) {
      const f = { ...est.filtros }
      const q = e.target.value.trim()
      if (q) f.q = q
      else delete f.q
      return cambiar(f, { ya: false })
    }
    if (e.target.matches('[data-tds-buscaset]')) {
      const pos = e.target.selectionStart
      pintarFiltros()
      const nuevo = $('[data-tds-buscaset]')
      nuevo.focus()
      nuevo.setSelectionRange(pos, pos)
      return
    }
    if (e.target.matches('[data-rango]')) return rango(e.target.dataset.rango, e.target.value)
  })
  caja.addEventListener('change', (e) => {
    if (e.target.matches('[data-tds-orden]')) {
      est.orden = e.target.value
      pedir()
    }
  })

  // Lo vendido (1072) cambia las unidades: la tabla se vuelve a pedir.
  document.addEventListener('pokedoc:tienda-vendida', () => pedir())
  pedir()
  cargarVistas()
}
