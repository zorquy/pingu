// EL MERCADO (tanda 770): todo lo que la gente da, lo busques o no.
//
// PINGU: «que salga públicamente lo que la gente tiene para cambio aunque tú
// no lo desees». Es la primera vista de Deseos y cambios y se ve sin cuenta
// (/mi-coleccion?ver=mercado): lo que alguien marca «para cambio» ya era
// público en la ficha de cada carta, aquí solo se junta.
//
// Una baldosa por CARTA, no por persona: se viene a mirar cartas. Cada una
// dice quién la da (avatares), en qué idiomas y por cuánto sale; las que
// buscas llevan el corazón lleno y «La buscas», y si alguien que la da busca
// algo tuyo, su avatar lleva un aro (939: el cruce es con una PERSONA, no
// con la carta; antes la baldosa decía «Cruce» de una carta que no buscas).
// Tocarla abre su ficha con la lista de personas, una tarjeta por persona
// (1056): en el PC, centrada encima (1056; en la 939 iba al lado); en el
// móvil, desde abajo. La misma ficha
// abren La quiero, Las que doy y Cruces (`abrirFichaDe`), con `modo`:
// 'da' (quién la da) o 'busca' (quién la busca, para lo que das tú).
//
// Entra por un `import()` al abrir la pestaña, y su CSS va en
// css/mi-coleccion.css (el barrido de la 299 sigue los dinámicos). Lo que es
// de la página —las cartas en memoria, los precios, tus deseos— llega por el
// contexto: este módulo no toca `user_wants` por su cuenta.
import { escapeHtml, avatarStyle, getInitial, profileUrl } from '../app.js'
import { atributosDeRango } from '../rangos.js'
import { icons } from '../icons.js'
import { nombreDeVariante } from './variantes.js'
import { ICONOS_COLECCION } from './iconos.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from '../catalogo-series.js'
import { normalizeSearch } from '../texto.js'
import { banderaHtml } from '../precio-vista.js'
import { euros, idiomaDe } from '../cardmarket.js'
import { crecerDesde } from './gestos-ficha.js'
import { entenderBusqueda } from './busqueda.js'
import { mercado as pedirMercado, quienDaEsta, mercadoConTiendas } from './cambios.js'
import { supabase } from '../supabase.js'
import { tiendasQueTienen, enTiendasHtml } from '../en-tiendas.js'
import { senasDe, borradorDe } from './tablon.js'
import { porCatalogo, rotuloDeCatalogo } from './rotulos-catalogo.js'
import { showToast } from '../toast.js'
import * as listasDeseo from './listas-deseo.js'
import { lineaDeSetHtml } from './linea-set.js'

const $ = (id) => document.getElementById(id)
const POR_PAGINA = 60
// A un lado, encima de la rejilla, en cuanto no es un móvil (939).
export const CONSULTA_AL_LADO = '(min-width: 900px)'

let ctx = null
// Sin selector de catálogo desde la 1038 (PINGU eligió lo recomendado): se
// piden los dos a la vez y cada uno sale en su tramo, como en La quiero. Cada
// catálogo lleva su página y su total, porque «Ver más» sigue a los dos.
const MERCADOS = ['WEST', 'JP']
// `quien` (1069): todos, solo personas o solo tiendas.
const estado = { idioma: '', orden: 'nuevo', soloMias: false, texto: '', quien: 'todos' }
let filasPor = { WEST: [], JP: [] }
let totalPor = { WEST: 0, JP: 0 }
let filas = []
let total = 0
let turno = 0
let enganchado = false
let abierta = null // la carta de la ficha abierta
let modoAbierto = 'da'
// Las cartas de la vista desde la que se abrió, en orden: ← y → pasan de una
// a otra sin cerrar la ficha.
let vecinas = []
// Quién busca algo que tú das: user_id → cuántas de tus cartas. `null` = no
// se sabe (sin sesión o sin la migración): entonces no se marca «Cruce», en
// vez de decir que no lo hay.
let buscanLoMio = null
// Y quién tiene algo de lo que buscas tú (para el cruce de la ficha de una
// carta que das): user_id → cuántas.
let tienenLoQueBusco = null

const nombreDe = (c) => nombreDeCarta(c) || ''
const nombreDePersona = (p) => p?.display_name || p?.username || 'Alguien'
export const textoDeGente = (n) => (n === 1 ? 'La da 1' : `La dan ${n}`)
// Con tiendas (1069): «En 2 tiendas», o «La dan 3 · 1 tienda».
export function textoDeQuien(personas = 0, tiendas = 0) {
  const t = tiendas === 1 ? '1 tienda' : `${tiendas} tiendas`
  if (!tiendas) return textoDeGente(personas)
  if (!personas) return `En ${t}`
  return `${textoDeGente(personas)} · ${t}`
}

// `cruces`: los user_id con los que tienes cruce; esos van primero y con aro.
export function avataresHtml(gente = [], max = 4, cruces = null) {
  const conCruce = (p) => Boolean(cruces?.has(p.user_id))
  const orden = [...gente].sort((a, b) => Number(conCruce(b)) - Number(conCruce(a)))
  return `<span class="mc-gente" aria-hidden="true">${orden.slice(0, max).map((p) => `<span class="mc-gente-av${conCruce(p) ? ' cruce' : ''}${p.tienda ? ' tienda' : ''}" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombreDePersona(p)))}</span>`).join('')}</span>`
}

// Lo que dice la baldosa de la CARTA. Pura, para la prueba. El cruce no va
// aquí (939): es de la persona, y va en su avatar y en la ficha.
export function chapaDeBaldosa({ busco }) {
  if (busco) return { clase: 'busca', texto: 'La buscas' }
  return null
}

function deseosDe(cardId) {
  const d = ctx.deseos()
  return Array.isArray(d) ? d.filter((x) => x.card_id === cardId) : []
}

function baldosaHtml(f) {
  const c = ctx.cartas.get(f.card_id)
  const nombre = nombreDe(c) || f.card_id
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const busco = deseosDe(f.card_id).length > 0
  const chapa = chapaDeBaldosa({ busco })
  const precio = ctx.precioDeCarta(f.card_id)
  // Si ya la tienes, su ✓ como en la expansión (943): «la tienes» se ve en
  // todas partes donde sale una carta.
  const tengo = ctx.tengo?.(f.card_id) || 0
  // Quién la da, en la chapa sobre la foto como en «La quiero» y «Las que
  // doy» (1061b); la de «La buscas» sube arriba a la izquierda.
  const personas = Number(f.personas) || 0
  const tiendas = Number(f.tiendas) || 0
  const quien = textoDeQuien(personas, tiendas)
  // En la chapa, el número de quién la tiene; el texto entero va en la etiqueta.
  const corto = tiendas && !personas ? 'Tiendas ' : textoDeGente(personas + tiendas).replace(/\d+$/, '')
  return `<article class="mc-merc${busco ? ' buscada' : ''}${abierta === f.card_id ? ' abierta' : ''}${marcadas.has(f.card_id) ? ' marcada' : ''}" data-merc="${escapeHtml(f.card_id)}">
    <button type="button" class="mc-merc-abrir" data-merc-ficha="${escapeHtml(f.card_id)}" aria-label="${escapeHtml(`Ver quién da ${nombre}: ${quien.toLowerCase()}${tengo ? ` (tienes ${tengo})` : ''}`)}">
      <span class="mc-merc-foto"><span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}${tengo ? ctx.marcaDeTengo?.(tengo) || '' : ''}${personas || tiendas ? `<span class="mc-merc-chapas"><span class="mc-chapa-gente">${avataresHtml(f.gente || [], 3, buscanLoMio)}<span class="mc-merc-texto"><span class="mc-merc-largo">${corto}</span>${personas + tiendas}</span></span></span>` : ''}</span>
      ${chapa ? `<span class="mc-merc-chapa ${chapa.clase}">${chapa.texto}</span>` : ''}
    </button>
    <button type="button" class="mc-merc-corazon${busco ? ' puesto' : ''}" data-merc-quiero="${escapeHtml(f.card_id)}" aria-pressed="${busco}" aria-label="${escapeHtml(`${busco ? 'Ya buscas' : 'La quiero:'} ${nombre}`)}">${ICONOS_COLECCION.corazon(16)}</button>
    <span class="mc-merc-nombre">${escapeHtml(nombre)}</span>
    ${lineaDeSetHtml(c)}
    <span class="mc-merc-fila"><b class="mc-merc-precio">${precio == null ? '' : escapeHtml(euros(precio))}</b><span class="mc-merc-idiomas">${(f.idiomas || []).slice(0, 4).map((i) => banderaHtml(i)).join('')}</span></span>
    ${f.desde != null ? `<span class="mc-merc-desde">En tienda: ${escapeHtml(euros(f.desde))}</span>` : ''}
  </article>`
}

function pintarRejilla() {
  const caja = $('mcMercadoRejilla')
  if (!caja) return
  filas = [...filasPor.WEST, ...filasPor.JP]
  total = totalPor.WEST + totalPor.JP
  if (!filas.length) {
    caja.innerHTML = `<div class="mc-quiero-vacio">
      <span class="mc-quiero-vacio-icono" aria-hidden="true">${icons.refreshCw(28)}</span>
      <p><strong>${estado.texto || estado.idioma || estado.soloMias ? 'Nadie da una carta así ahora mismo' : 'Todavía nadie da nada'}</strong></p>
      <p class="subtext">${estado.soloMias ? 'De las que buscas, ninguna está a cambio. Te avisamos cuando alguien la ponga.' : 'Cuando alguien ponga una carta para cambio, saldrá aquí.'}</p>
    </div>`
  } else {
    // Con los dos catálogos, cada uno con su rótulo y su total; con uno, sin.
    const tramos = porCatalogo(filas, (f) => f.market)
    caja.innerHTML = tramos.length < 2 ? filas.map(baldosaHtml).join('') : tramos.map(([m, l]) => `${rotuloDeCatalogo(m, totalPor[m])}${l.map(baldosaHtml).join('')}`).join('')
  }
  const mas = $('mcMercadoMas')
  mas?.classList.toggle('hidden', !quedanMas())
  const cuenta = $('mcMercadoCuantas')
  if (cuenta) cuenta.textContent = total ? `${total.toLocaleString('es-ES', { useGrouping: 'always' })} ${total === 1 ? 'carta' : 'cartas'} a cambio` : ''
  ctx.alContar?.({ mercado: total })
}

const quedanMas = () => MERCADOS.some((m) => filasPor[m].length < totalPor[m])

// El japonés solo existe en japonés: con otro idioma elegido no se le pide nada.
const pideCatalogo = (m) => m !== 'JP' || !estado.idioma || estado.idioma === 'ja'

async function cargar({ seguir = false } = {}) {
  const mio = ++turno
  const caja = $('mcMercadoRejilla')
  if (!seguir && caja) caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  const todos = await ctx.todosLosSets().catch(() => [])
  const unaVuelta = async (m) => {
    if (!pideCatalogo(m)) return { m, lista: [], total: 0 }
    if (seguir && filasPor[m].length >= totalPor[m]) return { m, lista: null }
    const sets = todos.filter((s) => (s.market || 'WEST') === m)
    const leida = estado.texto ? entenderBusqueda(estado.texto, sets) : { texto: '', setIds: null }
    const lista = (await pedirMercado({
      market: m,
      idioma: m === 'JP' ? null : estado.idioma || null,
      texto: normalizeSearch(leida.texto || ''),
      sets: leida.setIds,
      soloMias: estado.soloMias,
      orden: estado.orden,
      limite: POR_PAGINA,
      desde: seguir ? filasPor[m].length : 0,
      quien: estado.quien,
    })).map((f) => ({ ...f, market: f.market || m }))
    await ctx.completarCartas(lista.map((f) => f.card_id), m)
    return { m, lista, total: Number(lista[0]?.total ?? 0) }
  }
  let vueltas
  try {
    vueltas = await Promise.all(MERCADOS.map(unaVuelta))
  } catch (err) {
    if (mio !== turno) return
    if (caja) caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
    return
  }
  if (mio !== turno) return
  for (const { m, lista, total: t } of vueltas) {
    if (lista === null) continue
    filasPor[m] = seguir ? [...filasPor[m], ...lista] : lista
    totalPor[m] = t || (seguir ? totalPor[m] : 0) || filasPor[m].length
  }
  pintarMandos()
  pintarRejilla()
}

// LA FRANJA DE LAS TIENDAS (1069): las que tienen algo de tu lista, arriba
// del Mercado; cada una lleva a su perfil con «De tu lista» puesto. Solo con
// sesión, si hay alguna y si no se están mirando solo personas.
let franjaPedida = null
async function pintarFranja() {
  let caja = $('mcMercadoTiendas')
  const aviso = $('mcMercadoAviso')
  if (!caja && aviso) {
    aviso.insertAdjacentHTML('beforebegin', '<section class="mc-mercado-tiendas hidden" id="mcMercadoTiendas" aria-label="Tiendas con cartas de tu lista"></section>')
    caja = $('mcMercadoTiendas')
  }
  if (!caja) return
  if (!ctx.sesion || estado.quien === 'personas' || mercadoConTiendas === false) return caja.classList.add('hidden')
  franjaPedida ??= supabase.rpc('tiendas_con_mis_deseos', { p_limite: 12 }).then(({ data, error }) => (error ? [] : data || []), () => [])
  const tiendas = await franjaPedida
  caja.classList.toggle('hidden', !tiendas.length)
  if (!tiendas.length) return
  caja.innerHTML = `<h3 class="mc-mercado-tiendas-titulo">Tiendas con cartas de tu lista</h3>
    <div class="mc-mercado-tiendas-fila">${tiendas.map((t) => {
      const nombre = t.display_name || t.username || 'Tienda'
      return `<a class="mc-tienda-tarjeta" href="/usuario/${encodeURIComponent(t.username || '')}?lista=1">
        <span class="mc-tienda-logo" style="${t.avatar_url ? avatarStyle(t) : ''}">${t.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
        <span class="mc-tienda-datos"><strong>${escapeHtml(nombre)}</strong>${t.ciudad ? `<small>${escapeHtml(t.ciudad)}</small>` : ''}<em>${t.cartas === 1 ? '1 de tu lista' : `${t.cartas} de tu lista`}</em></span>
      </a>`
    }).join('')}</div>`
}

async function pintarAviso() {
  const b = $('mcMercadoAviso')
  if (!b) return
  if (!ctx.sesion || estado.soloMias) return b.classList.add('hidden')
  const tiene = await ctx.quienTiene().catch(() => null)
  const n = new Set((tiene || []).map((f) => f.card_id)).size
  b.classList.toggle('hidden', !n)
  if (n) b.innerHTML = `${ICONOS_COLECCION.corazon(16)}<span>${n === 1 ? '1 de las que buscas está aquí' : `${n} de las que buscas están aquí`}</span><span class="mc-mercado-aviso-ir">Verlas</span>`
}

let hayTiendas = null
function pintarMandos() {
  const mias = $('mcMercadoMias')
  if (mias) {
    mias.classList.toggle('hidden', !ctx.sesion)
    mias.setAttribute('aria-pressed', String(estado.soloMias))
    mias.classList.toggle('activo', estado.soloMias)
  }
  // Todos / Personas / Tiendas (1069), detrás de «Seleccionar». Sin la
  // migración de las tiendas, o sin ninguna tienda dada de alta, no sale: no
  // hay nada que separar, y «Tiendas» saldría siempre vacío.
  if (mercadoConTiendas === true && hayTiendas === null) {
    hayTiendas = false
    void supabase.from('tiendas').select('user_id', { count: 'exact', head: true }).then(({ count }) => {
      hayTiendas = count > 0
      if (hayTiendas) pintarMandos()
    }, () => {})
  }
  let quien = $('mcMercadoQuien')
  if (!quien && $('mcMercadoSeleccionar')) {
    $('mcMercadoSeleccionar').insertAdjacentHTML('afterend', `<span class="seg mc-mercado-quien" id="mcMercadoQuien" role="group" aria-label="Quién">${[['todos', 'Todos'], ['personas', 'Personas'], ['tiendas', 'Tiendas']].map(([v, t]) => `<button type="button" class="seg-btn" data-merc-quien="${v}" aria-pressed="false">${t}</button>`).join('')}</span>`)
    quien = $('mcMercadoQuien')
  }
  if (quien) {
    quien.classList.toggle('hidden', mercadoConTiendas !== true || !hayTiendas)
    for (const b of quien.querySelectorAll('[data-merc-quien]')) {
      const si = b.dataset.mercQuien === estado.quien
      b.classList.toggle('activa', si)
      b.setAttribute('aria-pressed', String(si))
    }
  }
  const sel = $('mcMercadoSeleccionar')
  if (sel) {
    sel.classList.toggle('hidden', !ctx.sesion)
    sel.setAttribute('aria-pressed', String(marcando))
    sel.classList.toggle('activo', marcando)
    sel.setAttribute('aria-label', 'Seleccionar varias')
  }
}

// SELECCIONAR EN EL MERCADO (1057b): marcar varias y, abajo, «Las quiero»
// (en cualquier idioma y versión, como el corazón sin preguntar). La regla
// de la casa: toda lista de cartas lleva Seleccionar.
let marcando = false
const marcadas = new Set()
function pintarSel() {
  let b = $('mcMercadoSel')
  if (!b) {
    b = document.createElement('div')
    b.id = 'mcMercadoSel'
    b.className = 'mc-sel mc-quiero-sel hidden'
    document.body.append(b)
    b.addEventListener('click', (e) => void accionDeSel(e))
  }
  b.classList.toggle('hidden', !marcando || !$('mcPanelMercado') || $('mcPanelMercado').classList.contains('hidden') || $('mcPanelMercado').hidden)
  $('mcMercadoRejilla')?.classList.toggle('mc-merc-marcando', marcando)
  if (!marcando) return
  const k = marcadas.size
  b.style.setProperty('--acciones', '1')
  b.innerHTML = `<div class="mc-sel-arriba">
      <button type="button" class="mc-sel-cerrar" data-sel-merc="salir" aria-label="Salir de la selección">✕</button>
      <p class="mc-sel-cuenta" role="status" aria-live="polite">${k ? `${k} ${k === 1 ? 'marcada' : 'marcadas'}` : 'Toca las cartas'}</p>
      <button type="button" class="mc-sel-todas" data-sel-merc="todas">Seleccionar todas</button>
    </div>
    <div class="mc-sel-abajo"><button type="button" class="mc-sel-accion" data-sel-merc="quiero"${k ? '' : ' disabled'}>${ICONOS_COLECCION.corazon(22)}Las quiero</button></div>`
}
function salirDeSel() {
  marcando = false
  marcadas.clear()
  pintarMandos()
  pintarRejilla()
  pintarSel()
}
async function accionDeSel(e) {
  const b = e.target.closest('[data-sel-merc]')
  if (!b) return
  const que = b.dataset.selMerc
  if (que === 'salir') return salirDeSel()
  if (que === 'todas') {
    for (const f of filas) marcadas.add(f.card_id)
    pintarRejilla()
    return pintarSel()
  }
  if (que === 'quiero') {
    const ids = [...marcadas].filter((id) => !deseosDe(id).length)
    b.disabled = true
    try {
      // El idioma se pregunta una vez para todas (1064); cancelar no apunta nada.
      const n = ids.length ? await ctx.quererVarias(ids) : 0
      if (n === null) {
        b.disabled = false
        return
      }
      showToast(n ? `${n === 1 ? 'Apuntada' : `${n} apuntadas`} en «La quiero».` : 'Ya las tenías todas en «La quiero».', 'success')
      salirDeSel()
    } catch (err) {
      b.disabled = false
      showToast(err.message || 'No se han podido apuntar.', 'error')
    }
  }
}

// ── La ficha ──

// UNA TARJETA POR PERSONA (1056). La consulta da una fila por copia (idioma,
// estado, versión): quien da tres en inglés y una en español eran «dos
// personas» con dos tarjetas iguales. Se juntan por `user_id`, en el orden
// en que llegan (los cruces primero), y cada copia es una línea.
export function porPersona(gente) {
  const m = new Map()
  for (const f of gente || []) {
    if (!m.has(f.user_id)) m.set(f.user_id, { ...f, copias: [] })
    m.get(f.user_id).copias.push(f)
  }
  return [...m.values()]
}

// Cuántas copias da una persona (o la ficha entera): `cambio` es cuántas da
// de esa línea; sin él, una.
export const copiasDe = (filas) => filas.reduce((n, f) => n + (Number(f.cambio) || 1), 0)

export function rotuloDeGente(grupos, modo = 'da') {
  const n = grupos.length
  if (modo === 'busca') return n === 1 ? 'La busca 1 persona' : `La buscan ${n} personas`
  const copias = copiasDe(grupos.flatMap((g) => g.copias))
  return `${n === 1 ? 'La da 1 persona' : `La dan ${n} personas`}${copias > n ? ` · ${copias} copias` : ''}`
}

function personaHtml(p, carta, modo = 'da') {
  const nombre = nombreDePersona(p)
  // El cruce, al revés según lo que se mira: quien DA esta carta tiene cruce
  // si además busca algo tuyo; quien la BUSCA, si además da algo que buscas.
  const suyas = (modo === 'busca' ? tienenLoQueBusco : buscanLoMio)?.get(p.user_id) || 0
  // Reservada toda si lo están todas sus copias; una a una, en su línea.
  const reservada = p.copias.every((f) => f.reservada)
  const lineas = p.copias.map((f) => modo === 'busca'
    ? `<li>Busca ${f.idioma ? `en ${escapeHtml(idiomaDe(f.idioma).nombre.toLowerCase())}` : 'en cualquier idioma'}</li>`
    : `<li>${banderaHtml(f.idioma || 'es')} ${escapeHtml(senasDe(f))}${Number(f.cambio) > 1 ? ` · ${Number(f.cambio)}` : ''}${f.reservada && !reservada ? ' <span class="mc-merf-reservada">Reservada</span>' : ''}</li>`).join('')
  return `<li class="mc-merf-persona${suyas ? ' con-cruce' : ''}">
    <a class="mini-avatar${suyas ? ' cruce' : ''}" href="${escapeHtml(profileUrl(p))}" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>
    <div class="mc-merf-quien">
      <p class="mc-merf-nombre"><a href="${escapeHtml(profileUrl(p))}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>${suyas ? '<span class="mc-merf-cruce">Cruce contigo</span>' : ''}${reservada ? '<span class="mc-merf-reservada">Reservada</span>' : ''}</p>
      <ul class="mc-merf-copias subtext">${lineas}</ul>
      ${suyas ? `<p class="mc-merf-busca">${modo === 'busca' ? `Da ${suyas === 1 ? '1 de las que buscas' : `${suyas} de las que buscas`}` : `Busca ${suyas === 1 ? '1 de las tuyas' : `${suyas} de las tuyas`}`}</p>` : ''}
      <p class="mc-confianza" data-confianza="${escapeHtml(p.user_id)}"></p>
    </div>
    <div class="mc-merf-acciones">
      ${ctx.sesion && !reservada ? `<button type="button" class="btn-primary" data-merf-proponer="${escapeHtml(p.user_id)}" data-carta="${escapeHtml(carta.id)}" data-modo="${modo}">${icons.refreshCw(15)}<span>Proponer cambio</span></button>` : ''}
      <button type="button" class="${ctx.sesion && !reservada ? 'btn-secondary' : 'btn-primary'}" data-merf-escribir="${escapeHtml(p.user_id)}" data-carta="${escapeHtml(carta.id)}" data-modo="${modo}">${icons.mail(15)}<span>Escribir</span></button>
      <a class="btn-secondary" href="${escapeHtml(profileUrl(p))}?ver=cambios">Su perfil</a>
    </div>
  </li>`
}

function botonQuieroHtml(c) {
  const mios = deseosDe(c.id)
  if (!mios.length) return `<button type="button" class="btn-primary mc-merf-quiero" data-merc-quiero="${escapeHtml(c.id)}" aria-pressed="false">${ICONOS_COLECCION.corazon(16)}<span>La quiero</span></button>`
  const idiomas = mios.map((d) => (d.idioma ? idiomaDe(d.idioma).nombre.toLowerCase() : 'cualquier idioma')).join(', ')
  // «Cambiar» (1064): el idioma o la versión de lo que pediste, con la misma
  // ventana que la baldosa de «La quiero». Una por versión pedida.
  const versiones = [...new Set(mios.map((d) => d.variante || ''))]
  return `<button type="button" class="btn-secondary mc-merf-quiero puesto" data-merc-quiero="${escapeHtml(c.id)}" aria-pressed="true">${ICONOS_COLECCION.corazon(16)}<span>La quieres · ${escapeHtml(idiomas)}</span></button>${versiones.map((v) => `<button type="button" class="btn-secondary mc-merf-cambiar" data-merf-cambiar="${escapeHtml(c.id)}" data-variante="${escapeHtml(v)}">${icons.edit(15)}<span>Cambiar${versiones.length > 1 && v ? ` (${escapeHtml(nombreDeVariante(v))})` : ''}</span></button>`).join('')}`
}

// EN QUÉ LISTAS ESTÁ (1059, PINGU: «cuando abres una carta desde tu lista de
// la quiero, que te diga añadir a lista»): las suyas, con ✕ para sacarla, y
// «Añadir a una lista», que abre «Tus listas» (con «+ Nueva lista»). Solo con
// la carta en «La quiero»: una lista es una forma de ordenar lo que quieres.
let listasPedidas = false
function listasHtml(c) {
  if (!ctx.sesion || !deseosDe(c.id).length) return ''
  if (!listasDeseo.hayListas()) {
    if (!listasPedidas) {
      listasPedidas = true
      void listasDeseo.cargarListas(ctx.sesion.user.id).then(() => pintarListasDeFicha(c)).catch(() => {})
    }
    return ''
  }
  const k = listasDeseo.claveDeCarta(c.id, c.market || 'WEST')
  const en = listasDeseo.lasListas().filter((l) => listasDeseo.cartasDe(l.id).has(k))
  return `${en.map((l) => `<span class="mc-merf-lista"><i class="mc-lista-punto" style="--c:${escapeHtml(l.color || 'transparent')}" aria-hidden="true"></i>${escapeHtml(l.nombre)}<button type="button" class="mc-merf-lista-quitar" data-merf-sacar-lista="${escapeHtml(l.id)}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(`Sacar de «${l.nombre}»`)}">✕</button></span>`).join('')}
    <button type="button" class="btn-secondary mc-merf-a-lista" data-merf-a-lista="${escapeHtml(c.id)}">${icons.folder(15)}<span>${en.length ? 'A otra lista' : 'Añadir a una lista'}</span></button>`
}
function pintarListasDeFicha(c) {
  const caja = $('mcMercadoFichaListas')
  if (caja && abierta === c.id) caja.innerHTML = listasHtml(c)
}
async function aUnaLista(cardId) {
  const c = ctx.cartas.get(cardId)
  if (!c) return
  const id = await listasDeseo.elegirLista({ para: 1, cuenta: (l) => listasDeseo.cartasDe(l).size })
  if (!id) return
  try {
    const n = await listasDeseo.meterEnLista(id, [{ card_id: c.id, market: c.market || 'WEST' }])
    const l = listasDeseo.lasListas().find((x) => x.id === id)
    showToast(n ? `En «${l?.nombre}».` : `Ya estaba en «${l?.nombre}».`, 'success')
  } catch (err) {
    showToast(err.message, 'error')
  }
  pintarListasDeFicha(c)
  document.dispatchEvent(new CustomEvent('pd-listas-cambian'))
}
async function sacarDeUnaLista(listaId, cardId) {
  const c = ctx.cartas.get(cardId)
  if (!c) return
  try {
    await listasDeseo.sacarDeLista(listaId, [{ card_id: c.id, market: c.market || 'WEST' }])
  } catch (err) {
    showToast(err.message, 'error')
  }
  pintarListasDeFicha(c)
  document.dispatchEvent(new CustomEvent('pd-listas-cambian'))
}

// Lo que das de ESA carta, en la ficha en modo 'busca'.
function doyHtml(c) {
  const mias = (ctx.loQueDoy?.() || []).filter((l) => l.card_id === c.id)
  if (!mias.length) return ''
  const das = mias.reduce((n, l) => n + (Number(l.cambio) || 0), 0)
  return `<p class="mc-merf-doy">${icons.refreshCw(15)}<span>Das ${das === 1 ? '1 copia' : `${das} copias`} · ${escapeHtml(mias.map((l) => senasDe(l)).join(' / '))}</span></p>`
}

let gentePorCarta = new Map()
const tiendasPorCarta = new Map()
async function pintarFicha(cardId) {
  const c = ctx.cartas.get(cardId)
  const cuerpo = $('mcMercadoFichaCuerpo')
  if (!c || !cuerpo) return
  $('mcMercadoFichaTitulo').textContent = nombreDe(c) || c.id
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const precio = ctx.precioDeCarta(c.id)
  const gente = gentePorCarta.get(cardId)
  cuerpo.innerHTML = `
    <div class="mc-prodf-arriba">
      <a class="mc-prodf-foto mc-merf-foto" href="${escapeHtml(rutaDeCarta(c))}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" />` : ''}</a>
      <div class="mc-prodf-datos">
        <p class="mc-prodf-set">${escapeHtml([nombreDeSet(c.tcg_sets), c.local_id].filter(Boolean).join(' · '))}</p>
        <p class="mc-merf-precio">${precio == null ? 'Sin precio' : escapeHtml(euros(precio))}</p>
        ${precio == null ? '' : '<p class="subtext">Lo más barato en Cardmarket</p>'}
        <a class="link-btn" href="${escapeHtml(rutaDeCarta(c))}">Ver la carta</a>
      </div>
    </div>
    ${modoAbierto === 'busca' ? doyHtml(c) : `<div id="mcMercadoFichaQuiero">${botonQuieroHtml(c)}</div><div class="mc-merf-listas" id="mcMercadoFichaListas">${listasHtml(c)}</div>`}
    ${gente === undefined
      ? '<div class="skeleton" style="height:120px"></div>'
      : gente === null
        ? `<p class="subtext">No se ha podido preguntar quién la ${modoAbierto === 'busca' ? 'busca' : 'da'}.</p>`
        : gente.length
          ? `<h3 class="mc-merf-sub">${rotuloDeGente(porPersona(gente), modoAbierto)}</h3>
             <ul class="mc-merf-gente">${porPersona(gente).map((p) => personaHtml(p, c, modoAbierto)).join('')}</ul>`
          : modoAbierto === 'busca'
            ? '<p class="subtext">Nadie la busca todavía. En cuanto alguien la apunte, saldrá aquí.</p>'
            : '<p class="subtext">Ahora mismo nadie la da. Con el corazón te avisamos cuando alguien la ponga.</p>'}
    ${modoAbierto === 'busca' ? '' : `<div class="mc-merf-tiendas" id="mcMercadoFichaTiendas">${tiendasPorCarta.has(cardId) ? enTiendasHtml(tiendasPorCarta.get(cardId), cardId) : ''}</div>`}`
  // Las tiendas que la tienen (1069), una vez por carta.
  if (modoAbierto !== 'busca' && !tiendasPorCarta.has(cardId)) {
    tiendasQueTienen(cardId).then(async (t) => {
      tiendasPorCarta.set(cardId, t)
      const hueco = $('mcMercadoFichaTiendas')
      if (!t.length || abierta !== cardId || !hueco) return
      const { hojaInyectada } = await import('../hoja.js')
      await hojaInyectada('css/en-tiendas.css')
      hueco.innerHTML = enTiendasHtml(t, cardId)
    })
  }
  import('../cambios-hechos.js').then((m) => m.ponerConfianza(cuerpo)).catch(() => {})
}

// La baldosa de la carta abierta, marcada en la vista de la que sale.
function marcarAbierta() {
  for (const el of document.querySelectorAll('.abierta')) if (el.matches(BALDOSAS)) el.classList.remove('abierta')
  if (!abierta) return
  for (const el of document.querySelectorAll('.mc-merc, .mc-cruce-carta')) if (idDeBaldosa(el) === abierta) el.classList.add('abierta')
}
const BALDOSAS = '.mc-merc, .mc-cruce-carta'
const idDeBaldosa = (el) => el.dataset.merc || el.dataset.deseoCarta || el.dataset.carta || el.querySelector('[data-carta]')?.dataset.carta || null

async function abrirFicha(cardId, { modo = 'da', desde = null } = {}) {
  const d = $('mcMercadoFicha')
  if (!d) return
  abierta = cardId
  modoAbierto = modo
  if (desde) vecinas = [...new Set([...desde.querySelectorAll(BALDOSAS)].map(idDeBaldosa).filter(Boolean))]
  gentePorCarta.delete(cardId)
  void pintarFicha(cardId)
  marcarAbierta()
  // Centrada y modal en el PC (1056, PINGU: «los pop-ups mejoran en el
  // centro»; antes, al lado y sin modal, la 939); en el móvil, la hoja de
  // siempre.
  if (!d.open) d.showModal()
  // Arriba del todo: al abrirse, el navegador baja hasta lo primero que se
  // puede pulsar y la foto se quedaba cortada bajo la cabecera.
  d.scrollTop = 0
  let gente
  try {
    gente = modo === 'busca' ? await quienBuscaEsta(cardId) : await quienDaEsta(cardId, 50)
  } catch {
    gente = null
  }
  // Lo que ya está en un cambio aceptado (942): «Reservada», sin proponer.
  if (gente && modo === 'da' && gente.length) {
    const reservadas = await import('../cambio-propuesta.js').then((m) => m.reservadasDe([cardId])).catch(() => null)
    if (reservadas) gente = gente.map((p) => ({ ...p, reservada: (reservadas.get(`${p.user_id}|${cardId}`) || 0) >= (Number(p.cambio) || 1) }))
  }
  // Ordenadas con los cruces primero: es con quien se cierra antes.
  const cruces = modo === 'busca' ? tienenLoQueBusco : buscanLoMio
  if (gente) gente = [...gente].sort((a, b) => (cruces?.get(b.user_id) || 0) - (cruces?.get(a.user_id) || 0))
  gentePorCarta.set(cardId, gente)
  if (abierta === cardId) void pintarFicha(cardId)
}

// Quién busca una carta tuya: de lo que ya se pidió para los cruces (una
// fila por persona e idioma), sin otra consulta.
async function quienBuscaEsta(cardId) {
  const filas = await ctx.quienBusca()
  const vistas = new Set()
  return (filas || []).filter((f) => f.card_id === cardId && !vistas.has(f.user_id) && vistas.add(f.user_id))
}

function cerrarFicha() {
  const d = $('mcMercadoFicha')
  if (d?.open) d.close()
}

// ← y → con la ficha abierta: la carta de al lado en la vista de origen.
function pasarDeCarta(paso) {
  const i = vecinas.indexOf(abierta)
  if (i < 0) return
  const otra = vecinas[i + paso]
  if (otra) void abrirFicha(otra, { modo: modoAbierto })
}

function escribir(userId, cardId, modo = 'da') {
  if (!ctx.sesion) return void (location.href = ctx.urlDeRegistro())
  const p = (gentePorCarta.get(cardId) || []).find((x) => x.user_id === userId)
  if (!p) return
  const persona = { reciproco: Boolean((modo === 'busca' ? tienenLoQueBusco : buscanLoMio)?.get(userId)) }
  // En 'busca' la copia que se nombra es la TUYA (la que das), no su deseo.
  const mia = modo === 'busca' ? (ctx.loQueDoy?.() || []).find((l) => l.card_id === cardId) : null
  const texto = borradorDe(persona, [{ ...(mia || p), carta: ctx.cartas.get(cardId) }], modo === 'busca' ? 'busca' : 'tiene')
  location.href = `/mensajes.html?with=${encodeURIComponent(userId)}&texto=${encodeURIComponent(texto)}`
}

// «Proponer cambio» desde la ficha (942): con esa carta ya puesta, de su
// lado (la da) o del tuyo (la busca).
async function proponer(userId, cardId, modo = 'da') {
  if (!ctx.sesion) return void (location.href = ctx.urlDeRegistro())
  const p = (gentePorCarta.get(cardId) || []).find((x) => x.user_id === userId)
  if (!p) return
  const c = ctx.cartas.get(cardId)
  const fila = { card_id: cardId, market: c?.market || 'WEST', idioma: p.idioma || null }
  cerrarFicha()
  const m = await import('../cambio-propuesta.js')
  await m.abrirPropuesta({
    sesion: ctx.sesion,
    otro: { id: userId, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
    prefill: modo === 'busca' ? { mias: [{ ...fila, idioma: null }] } : { suyas: [fila] },
  })
}

async function alternarQuiero(cardId, boton) {
  if (!ctx.sesion) return void (location.href = ctx.urlDeRegistro())
  const c = ctx.cartas.get(cardId)
  if (!c) return
  // Las dos funciones repintan la rejilla en el acto (896) y deshacen si
  // falla; apagar la baldosa mientras tanto era lo que se veía (899).
  if (deseosDe(cardId).length) await ctx.quitarDeseos(cardId)
  else await ctx.quererCarta(c)
  repintar()
}

// Lo que cambia fuera (un deseo puesto en otra vista, la ficha) repinta
// las baldosas sin volver a preguntar a la base.
export function repintar() {
  if (!ctx) return
  if (filas.length) pintarRejilla()
  if (abierta && $('mcMercadoFicha')?.open) void pintarFicha(abierta)
  marcarAbierta()
  void pintarAviso()
}

function enganchar() {
  if (enganchado) return
  enganchado = true
  let espera = null
  $('mcMercadoBuscar')?.addEventListener('input', (e) => {
    clearTimeout(espera)
    espera = setTimeout(() => {
      estado.texto = e.target.value.trim()
      void cargar()
    }, 300)
  })
  // La chapa se rellena cuando lo elegido no es lo de siempre (1042): así
  // se ve de un vistazo que hay un filtro puesto.
  const marcar = (sel) => sel.closest('.mc-mercado-opcion')?.classList.toggle('cambiada', sel.value !== sel.options[0]?.value)
  $('mcMercadoIdioma')?.addEventListener('change', (e) => {
    estado.idioma = e.target.value
    marcar(e.target)
    void cargar()
  })
  $('mcMercadoOrden')?.addEventListener('change', (e) => {
    estado.orden = e.target.value
    marcar(e.target)
    void cargar()
  })
  // Con Seleccionar puesto, tocar una baldosa la marca y no abre nada.
  $('mcMercadoRejilla')?.addEventListener('click', (e) => {
    if (!marcando) return
    const el = e.target.closest('.mc-merc[data-merc]')
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    const k = el.dataset.merc
    marcadas.has(k) ? marcadas.delete(k) : marcadas.add(k)
    el.classList.toggle('marcada', marcadas.has(k))
    pintarSel()
  }, true)
  const panel = $('mcPanelMercado')
  panel?.addEventListener('click', (e) => {
    if (e.target.closest('#mcMercadoSeleccionar')) {
      marcando = !marcando
      marcadas.clear()
      pintarMandos()
      pintarRejilla()
      return pintarSel()
    }
    if (e.target.closest('#mcMercadoMias') || e.target.closest('#mcMercadoAviso')) {
      estado.soloMias = e.target.closest('#mcMercadoAviso') ? true : !estado.soloMias
      pintarMandos()
      void pintarAviso()
      return void cargar()
    }
    if (e.target.closest('#mcMercadoMas')) return void cargar({ seguir: true })
    const qn = e.target.closest('[data-merc-quien]')
    if (qn) {
      estado.quien = qn.dataset.mercQuien
      pintarMandos()
      void pintarFranja()
      return void cargar()
    }
    const q = e.target.closest('[data-merc-quiero]')
    if (q) return void alternarQuiero(q.dataset.mercQuiero, q)
    const f = e.target.closest('[data-merc-ficha]')
    // La carta crece desde su hueco hasta la ficha (798, MV12), si no está ya al lado.
    const desde = { modo: 'da', desde: $('mcMercadoRejilla') }
    if (f) return void (window.matchMedia(CONSULTA_AL_LADO).matches || $('mcMercadoFicha')?.open ? abrirFicha(f.dataset.mercFicha, desde) : crecerDesde(f.querySelector('img'), () => abrirFicha(f.dataset.mercFicha, desde), { destino: '#mcMercadoFicha .mc-prodf-foto img' }))
  })
  const d = $('mcMercadoFicha')
  d?.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('#mcMercadoFichaCerrar')) return d.close()
    const q = e.target.closest('[data-merc-quiero]')
    if (q) return void alternarQuiero(q.dataset.mercQuiero, q)
    const cb = e.target.closest('[data-merf-cambiar]')
    if (cb) return void Promise.resolve(ctx.cambiarDeseo(cb.dataset.merfCambiar, cb.dataset.variante || null)).then(() => repintar())
    const al = e.target.closest('[data-merf-a-lista]')
    if (al) return void aUnaLista(al.dataset.merfALista)
    const sl = e.target.closest('[data-merf-sacar-lista]')
    if (sl) return void sacarDeUnaLista(sl.dataset.merfSacarLista, sl.dataset.carta)
    const w = e.target.closest('[data-merf-escribir]')
    if (w) return escribir(w.dataset.merfEscribir, w.dataset.carta, w.dataset.modo)
    const pr = e.target.closest('[data-merf-proponer]')
    if (pr) return void proponer(pr.dataset.merfProponer, pr.dataset.carta, pr.dataset.modo)
  })
  d?.addEventListener('close', () => {
    abierta = null
    marcarAbierta()
  })
  // Las flechas pasan de carta (Esc y el fondo los pone el `<dialog>` modal).
  document.addEventListener('keydown', (e) => {
    if (!d?.open) return
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
    if (e.key === 'ArrowRight') { e.preventDefault(); pasarDeCarta(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); pasarDeCarta(-1) }
  })
}

// Por persona, cuántas cartas DISTINTAS: de las filas de quién busca lo
// tuyo, o de quién tiene lo que buscas.
export function cuentaPorPersona(filas) {
  const m = new Map()
  const vistas = new Set()
  for (const f of filas || []) {
    const k = `${f.user_id}|${f.card_id}`
    if (vistas.has(k)) continue
    vistas.add(k)
    m.set(f.user_id, (m.get(f.user_id) || 0) + 1)
  }
  return m
}

// Quién busca lo tuyo y quién tiene lo que buscas, una vez por visita: es
// lo que marca el cruce de cada persona.
async function preparar(contexto) {
  ctx = contexto
  enganchar()
  if (!ctx.sesion || buscanLoMio !== null) return
  const [busca, tiene] = await Promise.all([ctx.quienBusca().catch(() => null), ctx.quienTiene().catch(() => null)])
  if (busca) buscanLoMio = cuentaPorPersona(busca)
  if (tiene) tienenLoQueBusco = cuentaPorPersona(tiene)
}

// La ficha de una carta desde otra vista: La quiero (quién la da), Las que
// doy (quién la busca) y Cruces. `desde`: la caja con sus baldosas, para ← →.
export async function abrirFichaDe(contexto, cardId, { modo = 'da', desde = null } = {}) {
  await preparar(contexto)
  return abrirFicha(cardId, { modo, desde })
}

// La primera vez se pide; las siguientes se repinta lo que hay (volver de
// otra vista no vuelve a preguntar).
let cargado = false
export async function abrir(contexto) {
  await preparar(contexto)
  pintarMandos()
  void pintarAviso()
  void pintarFranja()
  if (cargado) return pintarRejilla()
  cargado = true
  await cargar()
}
