// /mi-coleccion: tus cartas, lo que valen y tu álbum (tanda 365).
//
// Tres pestañas:
//   · Cartas: la lista, con su valor y el enlace a Cardmarket con el
//     idioma, el estado y la versión de CADA línea ya filtrados.
//   · Álbum: una colección entera como las páginas de un archivador de
//     nueve bolsillos, con lo que tienes a color y lo que te falta en
//     gris. Con «tocar para añadir», rellenarlo es ir tocando cartas.
//   · Añadir: buscar una carta y guardarla.
//
// /mi-coleccion?u=<usuario> enseña la de otra persona si la ha hecho
// pública, sin nada que se pueda tocar.
import { escapeHtml, getSession } from './app.js'
import { showToast } from './toast.js'
import { supabase } from './supabase.js'
import { normalizeSearch } from './tcgdex.js'
import { rutaDeCarta, urlDeLogo } from './carta-ruta.js'
// El escaneo con su respaldo (tanda 370): TCGdex no tiene imagen de
// muchas cartas viejas, y sin esto el bolsillo se quedaba en blanco.
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { esDelTCG } from './catalogo-series.js'
import {
  IDIOMAS,
  ESTADOS,
  VARIANTES,
  IDIOMA_POR_DEFECTO,
  ESTADO_POR_DEFECTO,
  idiomaDe,
  estadoDe,
  varianteDe,
  euros,
  enlaceCardmarket,
  valorDeLinea,
} from './cardmarket.js'
import { icons } from './icons.js'
// La marca de Cardmarket, dibujada (su CSS va en css/cardmarket.css, que
// cargan esta página y la ficha de una carta).
import { marcaCardmarket } from './cardmarket-marca.js'
import * as datos from './mi-coleccion/datos.js'
import * as albumes from './mi-coleccion/albumes.js'
import { archivadorHtml, textoDePaginas, opcionesDeSalto, tapaGuardada, guardarTapa, TAPAS } from './mi-coleccion/archivador.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)

// ── Estado de la página ──
let sesion = null
let dueno = null // { id, username, display_name, coleccion_publica }
let esMia = false
let lineas = []
let cartas = new Map() // id → fila de tcg_cards
let guardados = new Map() // id → fila de tcg_card_prices
const vivos = new Map() // id → { pricing, variants } pedido a TCGdex
let pestania = ['cartas', 'album', 'albumes', 'anadir'].includes(params.get('ver')) ? params.get('ver') : 'cartas'
let albumesAbiertos = false

const nombreDe = (c) => c?.name_es || c?.name || 'Carta'

// El número impreso ordena «como en el álbum»: 2 antes que 10, y los
// que llevan letras (TG12, SV045) detrás de los numéricos.
function porNumero(a, b) {
  const na = parseInt(a.local_id, 10)
  const nb = parseInt(b.local_id, 10)
  const ea = String(a.local_id).match(/^\d+$/) ? 0 : 1
  const eb = String(b.local_id).match(/^\d+$/) ? 0 : 1
  return ea - eb || (Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || String(a.local_id).localeCompare(String(b.local_id))
}

function aviso(html) {
  $('mcAviso').innerHTML = html
  $('mcAviso').classList.toggle('hidden', !html)
}

function opciones(lista, activo) {
  return lista.map((o) => `<option value="${escapeHtml(o.id)}"${o.id === activo ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')
}

// ── Precios ──
const precioDe = (l) => datos.precioDeLinea(l, guardados, vivos)

// Las cartas sin precio guardado se piden a TCGdex en el momento, con
// un tope: la función programada rellenará el resto en sus pasadas, y
// pedir 500 fichas de golpe a un servicio gratuito no se hace.
const EN_VIVO_POR_VISITA = 40

async function completarPrecios() {
  const faltan = [...new Set(lineas.map((l) => l.card_id))].filter((id) => !guardados.has(id) && !vivos.has(id)).slice(0, EN_VIVO_POR_VISITA)
  let i = 0
  const trabajador = async () => {
    while (i < faltan.length) {
      const id = faltan[i++]
      const v = await datos.preciosEnVivo(id)
      if (v) vivos.set(id, v)
    }
  }
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()])
}

// ── El resumen ──
function pintarResumen() {
  const copias = lineas.reduce((s, l) => s + l.cantidad, 0)
  const distintas = new Set(lineas.map((l) => l.card_id)).size
  let valor = 0
  let sinPrecio = 0
  let pagado = 0
  for (const l of lineas) {
    const v = valorDeLinea(l, precioDe(l))
    if (v) valor += v
    else sinPrecio += l.cantidad
    if (Number(l.precio_compra) > 0) pagado += Number(l.precio_compra) * l.cantidad
  }
  const sets = new Set(lineas.map((l) => cartas.get(l.card_id)?.set_id).filter(Boolean)).size
  $('mcResumen').innerHTML = `
    <div class="mc-cifra"><dt>Cartas</dt><dd>${copias.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra"><dt>Distintas</dt><dd>${distintas.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra"><dt>Colecciones</dt><dd>${sets.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra mc-cifra-valor"><dt>Valor estimado</dt><dd>${euros(valor)}</dd></div>
    ${pagado > 0 && esMia ? `<div class="mc-cifra"><dt>Pagado</dt><dd>${euros(pagado)}</dd></div>` : ''}`
  $('mcResumenNota').textContent = lineas.length
    ? `El valor suma la tendencia de Cardmarket de cada carta (o el valor que le hayas puesto tú), sin ajustar por estado.${sinPrecio ? ` ${sinPrecio} ${sinPrecio === 1 ? 'carta no tiene' : 'cartas no tienen'} precio todavía.` : ''}`
    : ''
}

// ── Pestaña «Cartas» ──
function chipsDe(l) {
  const chips = [idiomaDe(l.idioma).id.toUpperCase(), estadoDe(l.estado).id]
  if (l.variante !== 'normal') chips.push(varianteDe(l.variante).nombre)
  if (l.gradeo) chips.push(l.gradeo)
  return chips.map((c) => `<span class="mc-chip">${escapeHtml(c)}</span>`).join('')
}

function lineaHtml(l) {
  const c = cartas.get(l.card_id)
  const precio = precioDe(l)
  const valor = valorDeLinea(l, precio)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const cm = enlaceCardmarket({ idProduct: precio?.idProduct, idioma: l.idioma, estado: l.estado, variante: l.variante, nombre: nombreDe(c) })
  return `
    <article class="mc-carta" data-linea="${escapeHtml(l.id)}">
      <a class="mc-carta-foto" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}" tabindex="-1" aria-hidden="true">
        ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
        ${l.cantidad > 1 ? `<span class="mc-cantidad">×${l.cantidad}</span>` : ''}
      </a>
      <div class="mc-carta-info">
        <a class="mc-carta-nombre" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}">${escapeHtml(nombreDe(c))}</a>
        <p class="mc-carta-set">${escapeHtml(c?.tcg_sets?.name || l.card_id)}${c ? ` · ${escapeHtml(c.local_id)}` : ''}</p>
        <p class="mc-chips">${chipsDe(l)}</p>
        <p class="mc-carta-valor">${valor ? euros(valor) : '<span class="mc-sin-precio">Sin precio</span>'}${l.cantidad > 1 && valor ? ` <span class="mc-unidad">(${euros(valor / l.cantidad)} c/u)</span>` : ''}</p>
        <div class="mc-carta-acciones">
          <a class="mc-accion mc-accion-cm" href="${escapeHtml(cm)}" target="_blank" rel="noopener" aria-label="Ver en Cardmarket, en ${escapeHtml(idiomaDe(l.idioma).nombre.toLowerCase())} y ${escapeHtml(estadoDe(l.estado).nombre)}" title="Cardmarket con el idioma, el estado y la versión de esta carta">${marcaCardmarket(18)}<span>Cardmarket</span></a>
          ${esMia ? `<button type="button" class="mc-accion" data-editar aria-label="Editar ${escapeHtml(nombreDe(c))}">${icons.edit(15)}<span>Editar</span></button>` : ''}
        </div>
      </div>
    </article>`
}

function lineasFiltradas() {
  const texto = normalizeSearch($('mcBuscar').value)
  const set = $('mcFiltroSet').value
  const idioma = $('mcFiltroIdioma').value
  const orden = $('mcOrden').value
  const filtradas = lineas.filter((l) => {
    const c = cartas.get(l.card_id)
    if (set && c?.set_id !== set) return false
    if (idioma && l.idioma !== idioma) return false
    if (texto && !normalizeSearch(`${c?.name || ''} ${c?.name_es || ''} ${c?.tcg_sets?.name || ''}`).includes(texto)) return false
    return true
  })
  const valor = (l) => valorDeLinea(l, precioDe(l)) || 0
  const cmp = {
    valor: (a, b) => valor(b) - valor(a),
    recientes: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    nombre: (a, b) => nombreDe(cartas.get(a.card_id)).localeCompare(nombreDe(cartas.get(b.card_id)), 'es'),
    coleccion: (a, b) => {
      const ca = cartas.get(a.card_id)
      const cb = cartas.get(b.card_id)
      return String(cb?.tcg_sets?.release_date || '').localeCompare(String(ca?.tcg_sets?.release_date || '')) || String(ca?.set_id).localeCompare(String(cb?.set_id)) || porNumero(ca || {}, cb || {})
    },
  }[orden]
  return filtradas.sort(cmp)
}

function pintarCartas() {
  const lista = lineasFiltradas()
  $('mcCartas').innerHTML = lista.map(lineaHtml).join('')
  $('mcCartasVacio').classList.toggle('hidden', lineas.length > 0)
  $('mcFiltros').classList.toggle('hidden', !lineas.length)
  $('mcSinResultados').classList.toggle('hidden', !lineas.length || lista.length > 0)
}

function pintarFiltros() {
  const sets = new Map()
  for (const l of lineas) {
    const c = cartas.get(l.card_id)
    if (c?.set_id) sets.set(c.set_id, c.tcg_sets?.name || c.set_id)
  }
  const actual = $('mcFiltroSet').value
  $('mcFiltroSet').innerHTML = '<option value="">Todas las colecciones</option>' + [...sets].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, n]) => `<option value="${escapeHtml(id)}"${id === actual ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')
}

// ── Editar una línea ──
function abrirEditor(l) {
  const c = cartas.get(l.card_id)
  const d = $('mcEditor')
  // La carta, a la vista (tanda 369): el escaneo, el nombre y de qué
  // colección es. Antes la ventana solo decía el nombre en un título, y
  // con dos impresiones de la misma carta en la colección no había forma
  // de saber cuál estabas tocando hasta guardar.
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  $('mcEdFoto').innerHTML = escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''
  $('mcEditorTitulo').textContent = nombreDe(c)
  $('mcEdSet').textContent = c ? `${c.tcg_sets?.name || ''} · ${c.local_id}` : l.card_id
  $('mcEdIdioma').innerHTML = opciones(IDIOMAS, l.idioma)
  $('mcEdEstado').innerHTML = opciones(ESTADOS, l.estado)
  $('mcEdVariante').innerHTML = opciones(VARIANTES, l.variante)
  $('mcEdCantidad').value = l.cantidad
  $('mcEdGradeo').value = l.gradeo || ''
  $('mcEdValor').value = l.valor_manual ?? ''
  $('mcEdCompra').value = l.precio_compra ?? ''
  $('mcEdNotas').value = l.notas || ''
  const precio = precioDe(l)
  $('mcEdPrecio').textContent = precio ? `Desde ${euros(precio.desde)} · tendencia ${euros(precio.tendencia)}` : 'Sin precio de Cardmarket.'
  // Y el enlace a Cardmarket también aquí, con los filtros de ESTA línea:
  // es justo cuando estás mirando lo que vale cuando quieres ir a verla.
  const cm = $('mcEdCardmarket')
  cm.href = enlaceCardmarket({ idProduct: precio?.idProduct, idioma: l.idioma, estado: l.estado, variante: l.variante, nombre: nombreDe(c) })
  cm.innerHTML = `${marcaCardmarket(18)}<span>Ver en Cardmarket</span>`
  d.dataset.linea = l.id
  d.showModal()
}

async function guardarEditor(e) {
  e.preventDefault()
  const d = $('mcEditor')
  const id = d.dataset.linea
  const num = (v) => (String(v).trim() === '' ? null : Math.max(0, Math.round(Number(String(v).replace(',', '.')) * 100) / 100))
  const cambios = {
    idioma: $('mcEdIdioma').value,
    estado: $('mcEdEstado').value,
    variante: $('mcEdVariante').value,
    cantidad: Math.max(1, Math.min(999, Math.round(Number($('mcEdCantidad').value) || 1))),
    gradeo: $('mcEdGradeo').value.trim().slice(0, 20) || null,
    valor_manual: num($('mcEdValor').value),
    precio_compra: num($('mcEdCompra').value),
    notas: $('mcEdNotas').value.trim().slice(0, 280) || null,
  }
  try {
    const nueva = await datos.actualizar(id, cambios)
    lineas = lineas.map((l) => (l.id === id ? nueva : l))
    d.close()
    showToast('Guardado.', 'success')
    repintar()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

async function borrarDesdeEditor() {
  const d = $('mcEditor')
  const id = d.dataset.linea
  // confirm() a propósito, como en /mazos: no se puede deshacer.
  if (!window.confirm('¿Quitar esta carta de tu colección? No se puede deshacer.')) return
  try {
    await datos.borrar(id)
    lineas = lineas.filter((l) => l.id !== id)
    d.close()
    showToast('Quitada de tu colección.', 'success')
    repintar()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// ── Pestaña «Álbum» ──
//
// Un archivador de nueve bolsillos: páginas de 3×3, de dos en dos en
// pantalla ancha (como al abrirlo) y de una en una en el móvil.
let album = { set: null, cartas: [], pagina: 0, soloFaltan: false }
let todosLosSets = null

async function cargarSets() {
  if (todosLosSets) return todosLosSets
  const { data } = await supabase
    .from('tcg_sets')
    // El logo y la serie viajan desde la tanda 372: la estantería se ve
    // por los logos, y agrupar por serie es lo que hace navegable una
    // lista de 220 colecciones.
    .select('id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total')
    .eq('market', 'WEST')
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(1000)
  todosLosSets = (data || []).filter((s) => esDelTCG(s))
  return todosLosSets
}

function tengoDe(cardId) {
  return lineas.filter((l) => l.card_id === cardId).reduce((s, l) => s + l.cantidad, 0)
}

// ── La estantería (tanda 372) ──
//
// Aquí había un `<select>` con 220 colecciones dentro. PINGU, enseñando
// HoloNook: «en general mejora visualmente todo». Un desplegable es lo
// menos vistoso que hay y, peor, **esconde lo único que engancha de
// coleccionar: cuánto llevas**. Con la lista abierta ves de un vistazo
// dónde te falta poco para completar, que es exactamente lo que hace
// volver al día siguiente.
//
// Dos estados, como en los álbumes soñados: la estantería y el
// archivador abierto. Se parecen a propósito — son la misma idea.
async function pintarEstanteria() {
  const sets = await cargarSets()
  // Cuántas DISTINTAS tienes de cada colección. Distintas y no copias:
  // el progreso de un álbum es cuántos bolsillos has llenado, y tres
  // Charizards llenan uno.
  const cuantas = new Map()
  for (const id of new Set(lineas.map((l) => l.card_id))) {
    const s = cartas.get(id)?.set_id
    if (s) cuantas.set(s, (cuantas.get(s) || 0) + 1)
  }
  const texto = normalizeSearch($('mcEstanteriaBuscar')?.value || '').trim()
  const serie = $('mcEstanteriaSerie')?.value || ''
  const cumple = (s) =>
    (!serie || s.serie_id === serie) && (!texto || normalizeSearch(`${s.name} ${s.id}`).includes(texto))

  // Las tuyas primero y por lo lleno que está el álbum, no por cuántas
  // cartas tienes: lo que se quiere ver arriba es lo que estás a punto
  // de completar.
  const mias = sets.filter((s) => cuantas.has(s.id) && cumple(s)).sort((a, b) => pctDe(b, cuantas) - pctDe(a, cuantas))
  const resto = esMia ? sets.filter((s) => !cuantas.has(s.id) && cumple(s)) : []

  const series = [...new Map(sets.filter((s) => s.serie_id).map((s) => [s.serie_id, s.serie_name || s.serie_id])).entries()]
  const sel = $('mcEstanteriaSerie')
  if (sel && !sel.dataset.montado) {
    sel.dataset.montado = '1'
    sel.innerHTML = '<option value="">Todas las series</option>' + series.map(([id, n]) => `<option value="${escapeHtml(id)}">${escapeHtml(n)}</option>`).join('')
  }

  $('mcEstanteriaRejilla').innerHTML =
    (mias.length ? `<h3 class="mc-estanteria-titulo">Tus colecciones</h3><div class="mc-estanteria">${mias.map((s) => tarjetaDeSet(s, cuantas.get(s.id) || 0)).join('')}</div>` : '') +
    (resto.length ? `<h3 class="mc-estanteria-titulo">Empezar otra</h3><div class="mc-estanteria">${resto.map((s) => tarjetaDeSet(s, 0)).join('')}</div>` : '')
  $('mcAlbumVacio').classList.toggle('hidden', Boolean(mias.length || resto.length))
}

// Cuántas cartas tiene una colección. `card_count_official` es la
// numeración impresa («1/198») y es la que cuenta para un álbum; si no
// la sabemos, el total. Si no hay ninguna, no se inventa un porcentaje.
function totalDe(set) {
  return set?.card_count_official || set?.card_count_total || 0
}

function pctDe(set, cuantas) {
  const total = totalDe(set)
  return total ? (cuantas.get(set.id) || 0) / total : 0
}

function tarjetaDeSet(set, tengo) {
  const total = totalDe(set)
  const pct = total ? Math.round((tengo / total) * 100) : 0
  const logo = urlDeLogo(set.logo_path)
  const completo = total && tengo >= total
  return `
    <button type="button" class="mc-set-tarjeta${completo ? ' completo' : ''}" data-set="${escapeHtml(set.id)}">
      <span class="mc-set-logo">${
        logo
          // El logo LLEVA el nombre escrito, así que el <span> de abajo
          // se esconde a la vista cuando hay logo y se queda para quien
          // navega con lector de pantalla (misma decisión que la 346).
          ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.remove()" />`
          : ''
      }</span>
      <span class="mc-set-nombre${logo ? ' sr-only' : ''}">${escapeHtml(set.name || set.id)}</span>
      ${
        total
          ? `<span class="mc-set-cuenta">${tengo} de ${total}${completo ? ' · completa' : ` · ${pct} %`}</span>
             <span class="mc-barra" aria-hidden="true"><i style="--ancho:${pct}%"></i></span>`
          : '<span class="mc-set-cuenta">Sin numeración</span>'
      }
    </button>`
}

// ── Abrir y cerrar el archivador ──
function volverALaEstanteria() {
  album.set = null
  album.pagina = 0
  $('mcEstanteriaZona').classList.remove('hidden')
  $('mcArchivadorZona').classList.add('hidden')
  pintarEstanteria()
}

async function abrirAlbum(setId) {
  album.set = setId
  album.pagina = 0
  // La estantería se va y sale el archivador (tanda 372). Los dos viven
  // en la misma pestaña, como en los álbumes soñados.
  $('mcEstanteriaZona').classList.add('hidden')
  $('mcArchivadorZona').classList.remove('hidden')
  const set = (todosLosSets || []).find((s) => s.id === setId)
  $('mcAlbumTitulo').textContent = set?.name || ''
  $('mcAlbum').innerHTML = '<p class="subtext">Cargando la colección…</p>'
  try {
    album.cartas = (await datos.cartasDeSet(setId)).sort(porNumero)
  } catch (err) {
    $('mcAlbum').innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  pintarAlbum()
}

// ── El bolsillo del archivador (tanda 368) ──
//
// Hasta hoy el bolsillo era UNA cosa o la OTRA, según un interruptor de
// arriba: o un enlace a la ficha, o un botón que añadía una copia. Y eso
// obligaba a elegir — lo dijo PINGU: «para añadir a la colección, cuando
// estoy en el álbum, debería haber un botoncito en la carta para añadir o
// quitar sin tener que ir a la carta».
//
// Ahora son las dos: el bolsillo entero sigue llevando a la ficha y
// encima lleva su mando de − y +. Por eso es un `div` con un enlace
// ENCIMA en vez de un `<a>` con todo dentro: un `<button>` dentro de un
// `<a>` no es HTML válido y el navegador lo desmonta por su cuenta.
function bolsilloHtml(c) {
  const n = tengoDe(c.id)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDe(c)
  const etiqueta = `${nombre} (${c.local_id})${n ? `, tienes ${n}` : ', te falta'}`
  const dentro = `
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    <span class="mc-bolsillo-num">${escapeHtml(c.local_id)}</span>`
  const enlace = `<a class="mc-bolsillo-enlace" href="${escapeHtml(rutaDeCarta(c))}" aria-label="${escapeHtml(etiqueta)}">${dentro}</a>`
  if (!esMia) return `<div class="mc-bolsillo${n ? ' tengo' : ''}">${enlace}</div>`
  // El número de copias vive DENTRO del mando y no suelto en una
  // esquina: así lo que dice cuántas tienes está pegado a lo que lo
  // cambia, y de paso no hay dos chapas peleándose por el mismo sitio.
  return `<div class="mc-bolsillo${n ? ' tengo' : ''} mc-bolsillo-con-mando">${enlace}
    <span class="mc-bolsillo-controles mc-bolsillo-mando">
      <button type="button" data-quitar="${escapeHtml(c.id)}" ${n ? '' : 'disabled'} aria-label="Quitar una copia de ${escapeHtml(nombre)}">−</button>
      <span class="mc-bolsillo-cuenta" aria-hidden="true">${n}</span>
      <button type="button" data-anadir="${escapeHtml(c.id)}" aria-label="Añadir una copia de ${escapeHtml(nombre)}">+</button>
    </span></div>`
}

function pintarAlbum() {
  const lista = album.soloFaltan ? album.cartas.filter((c) => !tengoDe(c.id)) : album.cartas
  const tengo = album.cartas.filter((c) => tengoDe(c.id)).length
  const total = album.cartas.length
  const pct = total ? Math.round((tengo / total) * 100) : 0
  $('mcAlbumProgreso').innerHTML = total
    ? `<span><strong>${tengo}</strong> de ${total} cartas · ${pct} %</span><span class="mc-barra" aria-hidden="true"><i style="--ancho:${pct}%"></i></span>`
    : ''
  const ancho = window.matchMedia('(min-width: 900px)').matches
  const deUnaVez = ancho ? 2 : 1
  if (!lista.length) {
    $('mcAlbum').innerHTML = '<p class="subtext">¡No te falta ninguna! Colección completa.</p>'
    $('mcAlbumPaginas').textContent = ''
    $('mcAlbumSalto').innerHTML = ''
    $('mcAlbumSalto').classList.add('hidden')
    $('mcAlbumAnterior').disabled = true
    $('mcAlbumSiguiente').disabled = true
    return
  }
  // El archivador entero lo monta js/mi-coleccion/archivador.js, que lo
  // comparten esta pantalla y los álbumes soñados: era el mismo dibujo
  // escrito dos veces, y ya había empezado a separarse.
  const armado = archivadorHtml({
    lista,
    pagina: album.pagina,
    deUnaVez,
    tapa: tapaGuardada(),
    pintarBolsillo: (c) => bolsilloHtml(c),
  })
  album.pagina = armado.pagina
  $('mcAlbum').innerHTML = armado.html
  $('mcAlbumPaginas').textContent = textoDePaginas(album.pagina, armado.paginas, deUnaVez)
  // El «Ir a…»: en un set de 200 cartas son 22 pliegos, y pasarlos de
  // dos en dos con el botón es media docena de clics para nada.
  const salto = $('mcAlbumSalto')
  salto.innerHTML = opcionesDeSalto(armado.paginas, deUnaVez, album.pagina)
  salto.classList.toggle('hidden', armado.paginas <= deUnaVez)
  $('mcAlbumAnterior').disabled = album.pagina === 0
  $('mcAlbumSiguiente').disabled = album.pagina + deUnaVez >= armado.paginas
  $('mcAlbumAnterior').dataset.paso = String(deUnaVez)
}

async function tocarBolsillo(cardId) {
  const idioma = $('mcTocarIdioma').value
  const estado = $('mcTocarEstado').value
  try {
    const nueva = await datos.anadir(sesion.user.id, { card_id: cardId, idioma, estado, variante: 'normal', cantidad: 1 })
    const i = lineas.findIndex((l) => l.id === nueva.id)
    if (i >= 0) lineas[i] = nueva
    else lineas.unshift(nueva)
    if (!cartas.has(cardId)) {
      const c = album.cartas.find((x) => x.id === cardId)
      const set = (todosLosSets || []).find((s) => s.id === album.set)
      if (c) cartas.set(cardId, { ...c, tcg_sets: set ? { id: set.id, name: set.name, release_date: set.release_date } : null })
    }
    pintarAlbum()
    pintarResumen()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// ── Quitar una copia desde el bolsillo (tanda 368) ──
//
// De qué línea se quita, que es lo único que tiene enjundia: de la MÁS
// NUEVA. Una misma carta puede estar en la colección varias veces —una
// española en NM y otra inglesa en played son dos líneas distintas— y el
// botón no pregunta cuál. La más nueva es la que acabas de meter, que es
// lo que quiere deshacer quien pulsa «−» justo después de pulsar «+».
// Para quitar una concreta está el editor de la pestaña «Mi colección»,
// que sí enseña las líneas una a una.
async function quitarDelBolsillo(cardId) {
  const suyas = lineas.filter((l) => l.card_id === cardId)
  if (!suyas.length) return
  const l = suyas.reduce((a, b) => (String(a.created_at || '') >= String(b.created_at || '') ? a : b))
  try {
    if ((Number(l.cantidad) || 1) > 1) {
      const nueva = await datos.actualizar(l.id, { cantidad: Number(l.cantidad) - 1 })
      lineas[lineas.indexOf(l)] = nueva
    } else {
      await datos.borrar(l.id)
      lineas.splice(lineas.indexOf(l), 1)
    }
    pintarAlbum()
    pintarResumen()
    pintarCartas()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// ── Pestaña «Añadir» ──
let seleccion = null
let turnoBusqueda = 0

async function buscar() {
  const texto = normalizeSearch($('mcAnadirBuscar').value)
  const mio = ++turnoBusqueda
  if (texto.length < 2) {
    $('mcAnadirResultados').innerHTML = ''
    return
  }
  let q = supabase.from('tcg_cards').select('id,set_id,local_id,name,name_es,image_path,rarity,tcg_sets(id,name,serie_id,release_date)').eq('market', 'WEST')
  for (const p of texto.split(/\s+/).filter(Boolean)) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(60)
  if (mio !== turnoBusqueda) return
  if (error) {
    $('mcAnadirResultados').innerHTML = `<p class="subtext">${escapeHtml(error.message)}</p>`
    return
  }
  const lista = (data || []).filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }))
  $('mcAnadirResultados').innerHTML = lista.length
    ? lista
        .map((c) => {
          const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
          return `<button type="button" class="mc-resultado" data-carta="${escapeHtml(c.id)}">
            ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
            <span class="mc-resultado-nombre">${escapeHtml(nombreDe(c))}</span>
            <span class="mc-resultado-set">${escapeHtml(c.tcg_sets?.name || c.set_id)} · ${escapeHtml(c.local_id)}</span>
          </button>`
        })
        .join('')
    : '<p class="subtext">No encuentro ninguna carta con ese nombre.</p>'
  buscar.ultimas = new Map(lista.map((c) => [c.id, c]))
}

async function elegir(cardId) {
  const c = buscar.ultimas?.get(cardId)
  if (!c) return
  seleccion = c
  const escaneoElegida = atributosDeEscaneo(cadenaDeEscaneo(c))
  $('mcAnadirElegida').innerHTML = `${escaneoElegida ? `<img ${escaneoElegida} alt="" width="245" height="342" loading="lazy" />` : ''}
    <div><strong>${escapeHtml(nombreDe(c))}</strong><p class="subtext">${escapeHtml(c.tcg_sets?.name || '')} · ${escapeHtml(c.local_id)}</p><p class="subtext" id="mcAnadirPrecio">Buscando precio…</p></div>`
  $('mcAnadirForm').classList.remove('hidden')
  $('mcAnadirForm').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const v = await datos.preciosEnVivo(c.id)
  if (seleccion?.id !== c.id) return
  if (v) vivos.set(c.id, v)
  const p = datos.precioDeLinea({ card_id: c.id, variante: $('mcAnadirVariante').value }, guardados, vivos)
  $('mcAnadirPrecio').textContent = p ? `Cardmarket: desde ${euros(p.desde)} · tendencia ${euros(p.tendencia)}` : 'Sin precio de Cardmarket.'
}

async function anadirSeleccion(e) {
  e.preventDefault()
  if (!seleccion) return
  const boton = $('mcAnadirBoton')
  boton.disabled = true
  try {
    const nueva = await datos.anadir(sesion.user.id, {
      card_id: seleccion.id,
      idioma: $('mcAnadirIdioma').value,
      estado: $('mcAnadirEstado').value,
      variante: $('mcAnadirVariante').value,
      cantidad: Math.max(1, Math.min(999, Math.round(Number($('mcAnadirCantidad').value) || 1))),
    })
    const i = lineas.findIndex((l) => l.id === nueva.id)
    if (i >= 0) lineas[i] = nueva
    else lineas.unshift(nueva)
    cartas.set(seleccion.id, seleccion)
    showToast(`${nombreDe(seleccion)} añadida.`, 'success')
    $('mcAnadirCantidad').value = 1
    repintar()
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    boton.disabled = false
  }
}

// ── Pestañas y repintado ──
function cambiarPestania(nueva) {
  pestania = nueva
  for (const b of document.querySelectorAll('[data-pestania]')) {
    const activa = b.dataset.pestania === nueva
    b.classList.toggle('activa', activa)
    b.setAttribute('aria-selected', String(activa))
  }
  for (const [id, nombre] of [['mcPanelCartas', 'cartas'], ['mcPanelAlbum', 'album'], ['mcPanelAlbumes', 'albumes'], ['mcPanelAnadir', 'anadir']]) {
    $(id).classList.toggle('hidden', nombre !== nueva)
  }
  const url = new URL(location.href)
  if (nueva === 'cartas') url.searchParams.delete('ver')
  else url.searchParams.set('ver', nueva)
  if (nueva !== 'albumes') url.searchParams.delete('album')
  history.replaceState(null, '', url)
  // Los álbumes soñados (tanda 366) se cargan la primera vez que se abren.
  if (nueva === 'albumes' && !albumesAbiertos && esMia) {
    albumesAbiertos = true
    albumes.entrar(params.get('album'))
  }
  if (nueva === 'album' && !album.set) pintarEstanteria()
  if (nueva === 'anadir') $('mcAnadirBuscar').focus()
}

function repintar() {
  pintarResumen()
  pintarFiltros()
  pintarCartas()
  if (album.set) pintarAlbum()
}

function enganchar() {
  for (const b of document.querySelectorAll('[data-pestania]')) b.addEventListener('click', () => cambiarPestania(b.dataset.pestania))
  for (const id of ['mcBuscar', 'mcFiltroSet', 'mcFiltroIdioma', 'mcOrden']) $(id).addEventListener(id === 'mcBuscar' ? 'input' : 'change', pintarCartas)
  $('mcCartas').addEventListener('click', (e) => {
    if (!e.target.closest('[data-editar]')) return
    const l = lineas.find((x) => x.id === e.target.closest('[data-linea]').dataset.linea)
    if (l) abrirEditor(l)
  })
  $('mcEditorForm').addEventListener('submit', guardarEditor)
  $('mcEdBorrar').addEventListener('click', borrarDesdeEditor)
  $('mcEdCancelar').addEventListener('click', () => $('mcEditor').close())

  // La estantería: buscar, filtrar por serie y abrir una colección.
  for (const id of ['mcEstanteriaBuscar', 'mcEstanteriaSerie']) {
    $(id).addEventListener(id === 'mcEstanteriaBuscar' ? 'input' : 'change', () => pintarEstanteria())
  }
  $('mcEstanteriaRejilla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (b) abrirAlbum(b.dataset.set)
  })
  $('mcAlbumVolver').addEventListener('click', volverALaEstanteria)
  $('mcAlbumSoloFaltan').addEventListener('change', (e) => {
    album.soloFaltan = e.target.checked
    album.pagina = 0
    pintarAlbum()
  })
  // ── El color de la tapa (tanda 371) ──
  //
  // Es lo que convierte «una rejilla de cartas» en «mi archivador». Se
  // guarda en el navegador y no en la base: es gusto de quien mira, no
  // un dato de la colección, y así no hace falta migración para esto.
  $('mcAlbumTapa').addEventListener('click', () => {
    const caja = $('mcAlbumTapas')
    const abierto = caja.classList.toggle('hidden')
    $('mcAlbumTapa').setAttribute('aria-expanded', String(!abierto))
    if (!abierto && !caja.dataset.montado) {
      caja.dataset.montado = '1'
      const puesta = tapaGuardada()
      caja.innerHTML = TAPAS.map(
        (t) =>
          `<button type="button" class="mc-tapa" data-tapa="${t.id}" aria-pressed="${t.id === puesta}" title="${escapeHtml(t.nombre)}">` +
          `<span class="sr-only">${escapeHtml(t.nombre)}</span></button>`
      ).join('')
    }
  })
  $('mcAlbumTapas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tapa]')
    if (!b) return
    guardarTapa(b.dataset.tapa)
    for (const otro of $('mcAlbumTapas').querySelectorAll('[data-tapa]')) {
      otro.setAttribute('aria-pressed', String(otro === b))
    }
    // Se repintan los dos: el álbum de la colección y el soñado que haya
    // abierto. La tapa es una sola para toda la pantalla.
    if (album.set) pintarAlbum()
    albumes.repintar?.()
  })
  $('mcAlbumSalto').addEventListener('change', (e) => {
    album.pagina = Number(e.target.value) || 0
    pintarAlbum()
  })
  $('mcAlbumAnterior').addEventListener('click', () => {
    album.pagina = Math.max(0, album.pagina - Number($('mcAlbumAnterior').dataset.paso || 1))
    pintarAlbum()
  })
  $('mcAlbumSiguiente').addEventListener('click', () => {
    album.pagina += Number($('mcAlbumAnterior').dataset.paso || 1)
    pintarAlbum()
  })
  // El mando del bolsillo (tanda 368). Va delegado en el archivador y no
  // botón a botón: el álbum se repinta entero en cada cambio, así que un
  // oyente por bolsillo habría que volver a colgarlo cada vez.
  $('mcAlbum').addEventListener('click', (e) => {
    const mas = e.target.closest('button[data-anadir]')
    if (mas) return void tocarBolsillo(mas.dataset.anadir)
    const menos = e.target.closest('button[data-quitar]')
    if (menos) return void quitarDelBolsillo(menos.dataset.quitar)
  })
  let espera = null
  $('mcAnadirBuscar').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 250)
  })
  $('mcAnadirResultados').addEventListener('click', (e) => {
    const b = e.target.closest('[data-carta]')
    if (b) elegir(b.dataset.carta)
  })
  $('mcAnadirForm').addEventListener('submit', anadirSeleccion)
  $('mcPublica')?.addEventListener('change', async (e) => {
    try {
      dueno.coleccion_publica = await datos.ponerPublica(sesion.user.id, e.target.checked)
      pintarCompartir()
      showToast(dueno.coleccion_publica ? 'Tu colección ya es pública.' : 'Tu colección vuelve a ser privada.', 'success')
    } catch (err) {
      e.target.checked = !e.target.checked
      showToast(err.message, 'error')
    }
  })
  $('mcCopiarEnlace')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/mi-coleccion?u=${encodeURIComponent(dueno.username)}`)
      showToast('Enlace copiado.', 'success')
    } catch {
      showToast('No se ha podido copiar.', 'error')
    }
  })
}

function pintarCompartir() {
  if (!esMia) return
  $('mcCompartir').classList.remove('hidden')
  $('mcPublica').checked = Boolean(dueno.coleccion_publica)
  $('mcCopiarEnlace').classList.toggle('hidden', !dueno.coleccion_publica || !dueno.username)
}

function prepararOpcionesDeFormulario() {
  $('mcFiltroIdioma').innerHTML = '<option value="">Todos los idiomas</option>' + opciones(IDIOMAS, '')
  $('mcAnadirIdioma').innerHTML = opciones(IDIOMAS, IDIOMA_POR_DEFECTO)
  $('mcAnadirEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
  $('mcAnadirVariante').innerHTML = opciones(VARIANTES, 'normal')
  $('mcTocarIdioma').innerHTML = opciones(IDIOMAS, IDIOMA_POR_DEFECTO)
  $('mcTocarEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
}

// Lo que los álbumes soñados necesitan de esta página. Con getters: la
// colección y sus cartas se cargan después y se reasignan.
const contexto = {
  get sesion() {
    return sesion
  },
  lineas: () => lineas,
  get cartas() {
    return cartas
  },
  sets: () => cargarSets(),
  porNumero,
}

// /mi-coleccion?album=<id> de OTRA persona: solo ese álbum, para verlo.
async function verAlbumAjeno(fila) {
  $('mcTitulo').textContent = 'Álbum soñado'
  document.title = `${fila.nombre} — Álbum soñado — PokeDoc`
  for (const id of ['mcResumen', 'mcResumenNota', 'mcCargando', 'mcCompartir']) $(id)?.classList.add('hidden')
  document.querySelector('.mc-pestanias').classList.add('hidden')
  cambiarPestania('albumes')
  await albumes.abrir(fila.id, { soloVer: true })
}

async function iniciar() {
  prepararOpcionesDeFormulario()
  enganchar()
  albumes.iniciarAlbumes(contexto)
  sesion = await getSession().catch(() => null)
  const idAlbum = params.get('album')
  if (idAlbum) {
    const fila = await albumes.cargarParaVer(idAlbum)
    if (!fila) {
      aviso('<p>Ese álbum no existe o es privado.</p>')
      if (!sesion) {
        $('mcContenido').classList.add('hidden')
        return
      }
    } else if (fila.user_id !== sesion?.user.id) {
      await verAlbumAjeno(fila)
      return
    } else {
      pestania = 'albumes'
    }
  }
  const usuario = params.get('u')
  try {
    if (usuario) {
      dueno = await datos.perfilPorUsuario(usuario)
      if (!dueno) {
        aviso('<p>No existe nadie con ese nombre de usuario.</p>')
        $('mcContenido').classList.add('hidden')
        return
      }
      esMia = sesion?.user.id === dueno.id
      if (!esMia && !dueno.coleccion_publica) {
        aviso(`<p>La colección de <strong>${escapeHtml(dueno.display_name || dueno.username)}</strong> es privada.</p>`)
        $('mcContenido').classList.add('hidden')
        return
      }
    } else {
      if (!sesion) {
        $('mcContenido').classList.add('hidden')
        $('mcEntrar').classList.remove('hidden')
        return
      }
      const { data } = await supabase.from('user_profiles').select('id,username,display_name,coleccion_publica').eq('id', sesion.user.id).maybeSingle()
      dueno = data || { id: sesion.user.id }
      esMia = true
    }
  } catch (err) {
    aviso(`<p>${escapeHtml(err.message)}</p>`)
    return
  }

  if (!esMia) {
    const quien = dueno.display_name || dueno.username
    $('mcTitulo').textContent = `Colección de ${quien}`
    document.title = `Colección de ${quien} — PokeDoc`
    document.querySelector('[data-pestania="anadir"]').classList.add('hidden')
    document.querySelector('[data-pestania="albumes"]').classList.add('hidden')
    // Mirando la colección de otro no hay nada que añadir: los bolsillos
    // salen sin mando (bolsilloHtml) y esta línea sobraría en pantalla.
    $('mcTocarOpciones').classList.add('hidden')
    if (pestania === 'anadir' || pestania === 'albumes') pestania = 'cartas'
  }
  pintarCompartir()
  cambiarPestania(pestania)

  try {
    lineas = await datos.lineasDe(dueno.id)
    const ids = lineas.map((l) => l.card_id)
    ;[cartas, guardados] = await Promise.all([datos.cartasPorIds(ids), datos.preciosGuardados(ids)])
  } catch (err) {
    aviso(`<p>${escapeHtml(err.message)}</p>`)
    return
  }
  $('mcCargando').classList.add('hidden')
  repintar()
  if (pestania === 'album') pintarEstanteria()
  // Si se entró directo a un álbum, se repinta ahora que se sabe qué
  // cartas tienes.
  if (pestania === 'albumes' && params.get('album')) albumes.abrir(params.get('album'))
  // Los precios que falten llegan después y repintan: la lista no espera.
  await completarPrecios()
  repintar()
  window.addEventListener('resize', () => album.set && pintarAlbum())
}

iniciar()
