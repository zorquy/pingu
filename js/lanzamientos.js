// El calendario de lanzamientos (tanda 656): TODAS las expansiones, del
// catálogo, con su fecha de salida.
//
// Hasta la 656 era una lista corta mantenida a mano desde /admin
// (`site_settings`, clave `lanzamientos`). PINGU: «podríamos transformar
// la página en un calendario de lanzamientos REAL, trayéndonos las fechas
// de la API. Tenemos todo: los nombres, las fechas de salida… dos
// catálogos, el occidental y el japonés, con un desplegable; el próximo
// lanzamiento arriba y todos los demás más abajo en orden de fecha. Y que
// sea automático». Lo es: sale de `tcg_sets`, que llenan el catálogo de
// TCGGO y las pasadas de precios (fechas y logos incluidos).
//
// La lista a mano NO desaparece: queda como COMPLEMENTO para un set
// anunciado que TCGGO todavía no tiene (se funde por nombre, para no salir
// dos veces). Sin ella, el día del anuncio el calendario no sabría nada.
//
// Las fechas son AAAA-MM-DD y se comparan como texto contra el día de hoy
// en UTC (como todas las fechas de la casa): el formato ordena solo.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { urlDeLogo, urlDeLogoPorPartes } from './carta-ruta.js'
import { nombreDeSet, plegarHermanos, esDelTCG } from './catalogo-series.js'
import { MERCADOS_VISIBLES, MERCADO_POR_DEFECTO } from './mercados.js'
import { normalizeSearch } from './texto.js'

export function diasHasta(fecha, hoy = new Date().toISOString().slice(0, 10)) {
  const ms = Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)
  return Math.round(ms / 86400_000)
}

export function cuentaAtras(dias) {
  if (dias === 0) return '¡Sale hoy!'
  if (dias === 1) return 'Sale mañana'
  return `Faltan ${dias} días`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fechaBonita(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number)
  if (!a || !m || !d) return fecha
  return `${d} de ${MESES[m - 1]} de ${a}`
}

// Los dos catálogos que se pueden mirar, con el nombre de /mi-coleccion
// (648): «Pokémon» y «Pokémon Japón», como en la API.
export const CATALOGOS = [
  { mercado: 'WEST', nombre: 'Pokémon', bandera: '🇬🇧' },
  { mercado: 'JP', nombre: 'Pokémon Japón', bandera: '🇯🇵' },
].filter((c) => MERCADOS_VISIBLES.includes(c.mercado))

const CLAVE_CATALOGO = 'lanz-catalogo'
const FECHA = /^\d{4}-\d{2}-\d{2}$/

// De una fila de `tcg_sets` a un evento del calendario. El logo sigue la
// cadena de la estantería (Scrydex → TCGGO → TCGdex por ruta → TCGdex
// montado a mano); sin ninguno, el hueco con el icono. El enlace va al
// catálogo público (/cartas, 649) con el catálogo puesto (`catalogo=`),
// que es lo que hace que un set japonés abra el catálogo japonés.
export function eventoDeSet(s, mercado = MERCADO_POR_DEFECTO) {
  return {
    id: String(s.id),
    mercado,
    nombre: nombreDeSet(s),
    fecha: String(s.release_date || '').slice(0, 10),
    imagen: s.logo_scrydex || s.logo_tcggo || urlDeLogo(s.logo_path, mercado) || urlDeLogoPorPartes(s.serie_id, s.id, mercado) || null,
    codigo: s.tcg_online_code || null,
    cartas: s.card_count_official || s.card_count_total || null,
    href: `/cartas.html?ver=album&set=${encodeURIComponent(String(s.id))}&catalogo=${encodeURIComponent(mercado)}`,
  }
}

// Las filas del catálogo, limpias: con fecha, sin las escondidas, sin
// Pocket, y con los hermanos plegados (30th + Classic son UNA expansión).
export function eventosDelCatalogo(filas, mercado = MERCADO_POR_DEFECTO) {
  const sets = (filas || []).filter((s) => s && s.id && !s.oculto && FECHA.test(String(s.release_date || '').slice(0, 10)) && esDelTCG(s))
  return plegarHermanos(sets.map((s) => ({ ...s }))).map((s) => eventoDeSet(s, mercado))
}

// La lista a mano, fundida: solo entra lo que el catálogo NO tiene ya
// (mismo nombre, sin acentos ni mayúsculas). Un set que está en los dos
// sitios saldría dos veces, y el del catálogo es el que lleva su página.
export function fundirConManuales(eventos, manuales) {
  const nombres = new Set(eventos.map((e) => normalizeSearch(e.nombre)))
  const extra = (manuales || [])
    .filter((m) => m && m.nombre && FECHA.test(m.fecha || '') && !nombres.has(normalizeSearch(m.nombre)))
    .map((m) => ({ id: null, mercado: null, nombre: m.nombre, fecha: m.fecha, imagen: m.imagen || null, codigo: null, cartas: null, href: null, notas: m.notas || '', manual: true }))
  return [...eventos, ...extra]
}

// Ordenados por fecha y partidos en lo que viene y lo que ya está: el
// siguiente es el primero de los futuros. Los pasados, del más reciente
// al más viejo — TODOS (PINGU: «así podemos tener todos, literal todos»).
export function partir(eventos, hoy = new Date().toISOString().slice(0, 10)) {
  const todos = [...eventos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.nombre.localeCompare(b.nombre)))
  const proximos = todos.filter((e) => e.fecha >= hoy)
  const pasados = todos.filter((e) => e.fecha < hoy).reverse()
  return { siguiente: proximos[0] || null, proximos: proximos.slice(1), pasados }
}

// Los pasados, por año: con cuatrocientas expansiones japonesas, una lista
// sin cortes no se recorre; con el año como rótulo, sí.
export function porAnno(eventos) {
  const grupos = []
  for (const e of eventos) {
    const anno = e.fecha.slice(0, 4)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.anno === anno) ultimo.eventos.push(e)
    else grupos.push({ anno, eventos: [e] })
  }
  return grupos
}

// El catálogo que se mira: la dirección manda (`?catalogo=JP`), después lo
// que se eligió la última vez, después el occidental.
export function catalogoElegido(search = '', guardado = null) {
  const pedido = new URLSearchParams(search).get('catalogo')
  if (CATALOGOS.some((c) => c.mercado === pedido)) return pedido
  if (CATALOGOS.some((c) => c.mercado === guardado)) return guardado
  return CATALOGOS[0]?.mercado || MERCADO_POR_DEFECTO
}

// ── Las consultas ──
async function filasDelCatalogo(mercado) {
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,release_date,card_count_official,card_count_total,tcg_online_code,oculto,tcggo_id')
    .eq('market', mercado)
    .limit(2000)
  if (error) throw error
  return data || []
}

async function manuales() {
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'lanzamientos').maybeSingle()
    return data?.value?.sets || []
  } catch {
    return []
  }
}

// Lo que se enseña de un catálogo. La lista a mano solo se funde con el
// occidental: es donde se anuncian los sets que TCGGO aún no tiene.
export async function cargarCalendario(mercado) {
  const [filas, aMano] = await Promise.all([filasDelCatalogo(mercado), mercado === 'WEST' ? manuales() : []])
  return partir(fundirConManuales(eventosDelCatalogo(filas, mercado), aMano))
}

// ── Pintar ──
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

// Un logo que no llega se esconde y queda el nombre, que siempre está: una
// tarjeta con un rectángulo roto no es una tarjeta.
const logoHtml = (e, clase) => (e.imagen
  ? `<img class="${clase}" src="${escapeHtml(e.imagen)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true" />`
  : `<span class="${clase} lanzamiento-logo-hueco">${icons.cards(22)}</span>`)

const detalleHtml = (e) => [
  fechaBonita(e.fecha),
  e.cartas ? `${e.cartas} cartas` : '',
  e.notas ? escapeHtml(e.notas) : '',
  e.manual ? 'anunciado' : '',
].filter(Boolean).join(' · ')

// Cada set es un evento de agenda: el bloque de la fecha a la izquierda,
// la tarjeta con el logo al lado —que es un ENLACE a su página— y la
// cuenta atrás (o «Ya salió», apagado) de pastilla.
function eventoHtml(e, futuro) {
  const [a, m, d] = String(e.fecha).split('-').map(Number)
  const etiqueta = e.href ? 'a' : 'div'
  return `
    <div class="lanz-evento ${futuro ? '' : 'lanzamiento-pasado'}">
      <div class="lanz-dia">
        <strong>${d}</strong>
        <span>${MESES_CORTOS[m - 1]}</span>
        <span class="lanz-anno">${a}</span>
      </div>
      <${etiqueta} class="lanzamiento-tarjeta"${e.href ? ` href="${escapeHtml(e.href)}"` : ''}>
        ${logoHtml(e, 'lanzamiento-logo')}
        <div class="lanzamiento-texto">
          <strong>${escapeHtml(e.nombre)}${e.codigo ? ` <span class="lanz-chapa">${escapeHtml(e.codigo)}</span>` : ''}</strong>
          <span class="subtext">${detalleHtml(e)}</span>
        </div>
        ${futuro ? `<span class="lanzamiento-cuenta">${cuentaAtras(diasHasta(e.fecha))}</span>` : '<span class="lanzamiento-cuenta lanzamiento-cuenta-gris">Ya salió</span>'}
      </${etiqueta}>
    </div>`
}

function destacadoHtml(e) {
  return `
    <div class="lanzamiento-destacado">
      ${logoHtml(e, 'lanzamiento-logo-grande')}
      <div>
        <span class="eyebrow">El siguiente set</span>
        <h2>${e.href ? `<a href="${escapeHtml(e.href)}">${escapeHtml(e.nombre)}</a>` : escapeHtml(e.nombre)}</h2>
        <p class="subtext">${detalleHtml(e)}</p>
      </div>
      <span class="lanzamiento-cuenta lanzamiento-cuenta-grande">${cuentaAtras(diasHasta(e.fecha))}</span>
    </div>`
}

const $ = (id) => document.getElementById(id)

async function pintar(mercado) {
  const destacadoEl = $('proximoDestacado')
  for (const id of ['proximoDestacado', 'seccionProximos', 'seccionPasados', 'lanzamientosVacio', 'lanzamientosError']) $(id)?.classList.add('hidden')
  $('lanzamientosCargando')?.classList.remove('hidden')
  let cal
  try {
    cal = await cargarCalendario(mercado)
  } catch {
    // Tres finales distintos no caben en un `return` (la 510): esto es
    // «no se ha podido preguntar», que no es «no hay nada».
    $('lanzamientosCargando')?.classList.add('hidden')
    $('lanzamientosError')?.classList.remove('hidden')
    return
  }
  $('lanzamientosCargando')?.classList.add('hidden')
  const { siguiente, proximos, pasados } = cal
  if (!siguiente && !pasados.length) {
    $('lanzamientosVacio').classList.remove('hidden')
    return
  }
  if (siguiente) {
    destacadoEl.innerHTML = destacadoHtml(siguiente)
    destacadoEl.classList.remove('hidden')
  }
  if (proximos.length) {
    $('listaProximos').innerHTML = proximos.map((e) => eventoHtml(e, true)).join('')
    $('seccionProximos').classList.remove('hidden')
  }
  if (pasados.length) {
    $('listaPasados').innerHTML = porAnno(pasados)
      .map((g) => `<h3 class="lanz-anno-titulo">${g.anno}</h3>${g.eventos.map((e) => eventoHtml(e, false)).join('')}`)
      .join('')
    $('cuantosPasados').textContent = `${pasados.length} ${pasados.length === 1 ? 'expansión' : 'expansiones'}`
    $('seccionPasados').classList.remove('hidden')
  }
}

function init() {
  const sel = $('lanzCatalogo')
  if (!sel) return
  let guardado = null
  try { guardado = localStorage.getItem(CLAVE_CATALOGO) } catch { guardado = null }
  let mercado = catalogoElegido(location.search, guardado)
  sel.innerHTML = CATALOGOS.map((c) => `<option value="${c.mercado}">${c.bandera} ${escapeHtml(c.nombre)}</option>`).join('')
  sel.value = mercado
  // Los botones con bandera (675), como el selector de Mi colección: el
  // select sigue mandando; cada botón le pone su valor y dispara change.
  const seg = $('lanzVistaSeg')
  const pintarSeg = () => {
    if (!seg) return
    seg.innerHTML = CATALOGOS.map((c) => `<button type="button" class="seg-btn" data-mercado="${c.mercado}" aria-pressed="${c.mercado === sel.value}" title="${escapeHtml(c.nombre)}"><i class="lanz-bandera" data-idioma="${c.mercado === 'JP' ? 'ja' : 'en'}" aria-hidden="true"></i><span>${escapeHtml(c.nombre)}</span></button>`).join('')
  }
  pintarSeg()
  seg?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mercado]')
    if (!b || sel.value === b.dataset.mercado) return
    sel.value = b.dataset.mercado
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  sel.addEventListener('change', () => {
    mercado = sel.value
    pintarSeg()
    try { localStorage.setItem(CLAVE_CATALOGO, mercado) } catch {}
    const u = new URL(location.href)
    u.searchParams.set('catalogo', mercado)
    history.replaceState(null, '', u)
    void pintar(mercado)
  })
  void pintar(mercado)
}

// Solo en el navegador: en Node (las pruebas) el módulo se importa por
// sus funciones puras y no hay documento que pintar.
if (typeof document !== 'undefined') init()
