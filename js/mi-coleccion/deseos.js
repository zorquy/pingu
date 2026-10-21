// LOS DESEOS Y LOS CAMBIOS DE MI COLECCIÓN, aparte (tanda 895, R4).
//
// «La quiero», «Las que doy», Cambios y el Mercado: solo los abre quien
// tiene cuenta y entra en esas pestañas, y /cartas (el catálogo público,
// la misma pantalla) los bajaba enteros. Entran por import() la primera
// vez. El estado de la pantalla llega en `ctx` (getters y setters de
// mi-coleccion.js: cambia mientras se usa) y se lee siempre a través de él.
import { escapeHtml, avatarStyle, getInitial } from '../app.js'
import { showToast } from '../toast.js'
import { supabase } from '../supabase.js'
import { normalizeSearch } from '../tcgdex.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeSet } from '../catalogo-series.js'
import { idiomaDe, estadoDe, euros, valorDeLinea } from '../cardmarket.js'
import { banderaHtml } from '../precio-vista.js'
import { icons } from '../icons.js'
import * as datos from './datos.js'
import { abrirAviso } from '../avisos-precio.js'
import * as laQuiero from '../la-quiero.js'
import { preguntarIdioma } from '../idioma-deseo.js'
import { porNumero, rangoDeRareza } from './orden.js'
import { ordenarCartas } from './filtros.js'
import { OTRA } from './gradeo.js'
import { entenderBusqueda, partirBusqueda } from './busqueda.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxDeseos` allí).
let ctx = null
export function montar(c) {
  ctx = c
}
// Una carta o un precio traído de fuera de tu colección va también a su
// sitio aparte (939), que la carga de la colección no borra.
function ponerCarta(k, v) {
  ctx.cartas.set(k, v)
  ctx.cartasDeFuera?.set(k, v)
}
function ponerPrecio(k, v) {
  ctx.guardados.set(k, v)
  ctx.preciosDeFuera?.set(k, v)
}

let tablon = null
let cambiosCargados = false
let tablonTiene = []
let tablonBusca = []

export async function abrirCambios() {
  const caja = $('mcCambiosPanel')
  if (!caja) return
  if (cambiosCargados) return pintarCambios()
  caja.innerHTML = '<div class="skeleton" style="height:180px"></div>'
  try {
    tablon = await import('./tablon.js')
    await cargarDeseos()
    cambiosCargados = true
    await pintarCambios()
  } catch (err) {
    // Sin la migración no se enseña un tablón vacío, que parecería que
    // no hay nadie: se dice qué falta. Es el mismo trato que le da el
    // resto de la página a `sinMigracion`.
    caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
  }
}

// LOS CRUCES (773): una tarjeta por persona con lo que te da y lo que le
// das, lado a lado y con lo que vale cada lado. Filtros: todos, solo los
// perfectos y la gente que sigues (con quien más fácil sale un cambio).
let crucesFiltro = 'todos'
let seguidosIds = null // Set de a quién sigues · null = no se sabe
async function pedirSeguidos() {
  if (seguidosIds || !ctx.sesion) return seguidosIds
  // sin rango: solo se piden ids, para filtrar.
  const { data, error } = await supabase.from('user_follows').select('following_id').eq('follower_id', ctx.sesion.user.id).limit(2000)
  if (!error) seguidosIds = new Set((data || []).map((f) => f.following_id))
  return seguidosIds
}

async function pintarCambios() {
  const caja = $('mcCambiosPanel')
  const doy = ctx.loQueDoy()
  let tiene = []
  let busca = []
  try {
    // Las dos direcciones a la vez: son independientes y la pantalla
    // las enseña juntas.
    ;[tiene, busca] = await Promise.all([
      ctx.deseos.length ? pedirQuienTiene() : Promise.resolve([]),
      doy.length ? pedirQuienBusca() : Promise.resolve([]),
    ])
  } catch (err) {
    caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
    return
  }
  tablonTiene = tiene
  tablonBusca = busca
  // Las cartas del tablón pueden no estar en el mapa: son de OTRA gente
  // y esta página solo cargó las tuyas.
  const faltan = [...tiene, ...busca, ...ctx.deseos].map((f) => f.card_id).filter((id) => !ctx.cartas.has(id))
  if (faltan.length) await completarCartasDeFuera(faltan, ctx.mercado)
  const precios = [...new Set([...tiene, ...busca].map((f) => f.card_id))].filter((id) => !ctx.guardados.has(id))
  if (precios.length) for (const [k, v] of await datos.preciosGuardados(precios).catch(() => new Map())) ponerPrecio(k, v)
  const seguidos = await pedirSeguidos().catch(() => null)
  const vacio = !doy.length && !ctx.deseos.length
  const gente = tablon.cruzarPorPersona(tiene, busca)
  const perfectos = gente.filter((p) => p.perfecto).length
  const deSeguidos = seguidos ? gente.filter((p) => seguidos.has(p.user_id)).length : null
  const visibles = gente.filter((p) => crucesFiltro === 'perfectos' ? p.perfecto : crucesFiltro === 'seguidos' ? seguidos?.has(p.user_id) : true)
  const valor = (f) => ctx.precioDeDeseo({ card_id: f.card_id, idioma: f.idioma })
  caja.innerHTML = vacio
    // Sin nada apuntado no se enseña un tablón vacío: se enseña CÓMO
    // funciona, que es lo que hace falta la primera vez.
    ? `<ol class="mc-cambio-pasos">
         <li><span class="mc-cambio-paso">1</span><div><strong>Apunta lo que buscas</strong><p class="subtext">Con el corazón, en <button type="button" class="link-btn" data-deseos-vista="mercado">el Mercado</button> o en <button type="button" class="link-btn" data-ir-quiero>La quiero</button>.</p></div></li>
         <li><span class="mc-cambio-paso">2</span><div><strong>Pon para cambio lo que te sobra</strong><p class="subtext">Tus repetidas, con cuántas copias das, en <button type="button" class="link-btn" data-deseos-vista="doy">Las que doy</button>.</p></div></li>
         <li><span class="mc-cambio-paso">3</span><div><strong>Aquí sale con quién encajas</strong><p class="subtext">Y le escribes desde aquí, sin salir de PokeDoc.</p></div></li>
       </ol>`
    : `<div class="mc-quiero-cabeza">
         <p class="mc-quiero-cifra"><b>${gente.length}</b> ${gente.length === 1 ? 'persona encaja' : 'personas encajan'} contigo${perfectos ? ` · <b>${perfectos}</b> ${perfectos === 1 ? 'cruce perfecto' : 'cruces perfectos'}` : ''}</p>
         ${gente.length ? `<span class="seg" role="group" aria-label="Quién">
           <button type="button" class="seg-btn" data-cruces-filtro="todos" aria-pressed="${crucesFiltro === 'todos'}">Todos</button>
           <button type="button" class="seg-btn" data-cruces-filtro="perfectos" aria-pressed="${crucesFiltro === 'perfectos'}">Solo perfectos <span class="mc-deseos-n">${perfectos}</span></button>
           ${deSeguidos === null ? '' : `<button type="button" class="seg-btn" data-cruces-filtro="seguidos" aria-pressed="${crucesFiltro === 'seguidos'}">Gente que sigo <span class="mc-deseos-n">${deSeguidos}</span></button>`}
         </span>` : ''}
       </div>
       ${gente.length
         ? visibles.length
           ? `<div class="mc-cruces">${visibles.map((p) => tablon.cruceHtml(p, { cartas: ctx.cartas, valor, euros })).join('')}</div>`
           : `<p class="empty-state">${crucesFiltro === 'perfectos' ? 'Ningún cruce perfecto todavía.' : 'Nadie de la gente que sigues encaja ahora mismo.'}</p>`
         : `<p class="empty-state">${!ctx.deseos.length
           ? 'Apunta lo que buscas y aquí saldrá quién lo da.'
           : !doy.length
             ? 'Todavía nadie da lo que buscas. Pon algo para cambio y saldrá también quién busca lo tuyo.'
             : 'Todavía nadie encaja contigo. Mira el Mercado: ahí está todo lo que se da.'}</p>`}`
  engancharCambios()
  void pintarMisCambiosArriba()
  // «12 cambios · todos bien» al lado de cada persona (798, NU4).
  import('../cambios-hechos.js').then((m) => m.ponerConfianza(document.querySelector('.mc-cruces'))).catch(() => {})
}

// El buscador de la lista de búsqueda, con su propio turno: dos
// buscadores en la misma página compartiendo contador se pisarían.
let turnoDeseo = 0

// EL BUSCADOR DE «LA QUIERO» (768). PINGU: «no funciona, solo busca unas
// pocas cartas, y no puedes escoger si son japonesas». Pedía 24 por orden
// alfabético en el catálogo que tuvieras puesto. Ahora es el motor de
// Buscar —nombre, número, «151/165», «MEW 151» y, si no sale nada, el
// ilustrador— con su propio catálogo (`deseoMercado`, sin cambiar el de la
// página) y los resultados por expansión, con su logo.
let deseoMercado = null
const TOPE_DESEO = 120
async function buscarParaDesear() {
  const caja = $('mcDeseoResultados')
  const cuenta = $('mcDeseoCuantas')
  const crudo = $('mcDeseoBuscar').value
  const market = deseoMercado || ctx.mercado
  const mio = ++turnoDeseo
  const { soloNumero } = partirBusqueda(normalizeSearch(crudo))
  if (normalizeSearch(crudo).trim().length < 2 && !soloNumero) {
    caja.classList.add('hidden')
    caja.innerHTML = ''
    if (cuenta) cuenta.textContent = ''
    return
  }
  caja.classList.remove('hidden')
  caja.innerHTML = '<div class="skeleton" style="height:160px"></div>'
  let lista
  let sets = []
  try {
    sets = (await ctx.cargarSetsDeTodos().catch(() => [])).filter((x) => (x.market || 'WEST') === market)
    const leida = entenderBusqueda(crudo, sets)
    lista = await ctx.buscarCartas(normalizeSearch(leida.texto), TOPE_DESEO, { setIds: leida.setIds, market, sets })
    if (!lista.length && leida.codigo) lista = await ctx.buscarCartas(normalizeSearch(crudo), TOPE_DESEO, { market, sets })
    if (!lista.length) lista = await ctx.buscarPorIlustrador(normalizeSearch(crudo), TOPE_DESEO, { market })
  } catch (err) {
    if (mio !== turnoDeseo) return
    caja.innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  if (mio !== turnoDeseo) return
  // Las que ya están apuntadas se enseñan, pero desactivadas: quitarlas
  // de la lista haría pensar que el buscador no las encuentra.
  const yaEstan = new Set(ctx.deseos.map((d) => d.card_id))
  if (cuenta) cuenta.textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'carta' : 'cartas'}${lista.length >= TOPE_DESEO ? ' · hay más, afina la búsqueda' : ''}` : ''
  const filas = new Map(sets.map((x) => [x.id, x]))
  caja.innerHTML = lista.length
    ? ctx.gruposPorExpansion(lista).map((g) => {
        const set = filas.get(g.set.id) || g.set
        const logos = ctx.contexto.logosDeSet({ ...set, market })
        return `<div class="mc-bus-grupo">
            <span class="mc-bus-grupo-logo">${logos.length ? `<img ${atributosDeEscaneo(logos, 'this.remove()')} alt="" width="96" height="48" loading="lazy" />` : ''}</span>
            <span class="mc-bus-grupo-texto"><b>${escapeHtml(nombreDeSet(set) || g.set.id)}</b><small>${g.cartas.length} ${g.cartas.length === 1 ? 'resultado' : 'resultados'}</small></span>
          </div>${ordenarCartas(g.cartas, 'numero', 'asc', { nombre: (c) => ctx.nombreDe(c), valor: () => null, rango: rangoDeRareza, porNumero }).map((c) => {
            const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
            const ya = yaEstan.has(c.id)
            return `<button type="button" class="mc-resultado mc-deseo-resultado" data-desear="${escapeHtml(c.id)}"${ya ? ' disabled' : ''} aria-label="${escapeHtml(`${ya ? 'Ya buscas' : 'Apuntar'} ${ctx.nombreDe(c)} (${c.local_id})`)}">
              <span class="mc-resultado-foto"><span class="mc-carta-sinfoto">${escapeHtml(ctx.nombreDe(c))}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}<span class="mc-deseo-corazon${ya ? ' puesto' : ''}" aria-hidden="true">${laQuiero.corazon(16)}</span></span>
              <span class="mc-resultado-nombre">${escapeHtml(ctx.nombreDe(c))}</span>
              <span class="mc-resultado-set">${ya ? 'Ya la buscas' : `${escapeHtml(c.local_id)}`}</span>
            </button>`
          }).join('')}`
      }).join('')
    : '<p class="subtext">Ninguna carta así en este catálogo. Prueba con menos letras, o en el otro catálogo.</p>'
  // Y al mapa, que es de donde lo saca la lista al repintarse.
  for (const c of lista) if (!ctx.cartas.has(c.id)) ponerCarta(c.id, { ...c, market: c.market || market })
}
function pintarCatalogoDeDeseo() {
  const market = deseoMercado || ctx.mercado
  for (const b of document.querySelectorAll('[data-deseo-mercado]')) b.setAttribute('aria-pressed', String(b.dataset.deseoMercado === market))
}

// El panel se repinta entero en cada cambio, así que los oyentes van
// UNA vez y sobre la caja de fuera —que no se repinta— y no sobre lo de
// dentro. Sin esto, apuntar tres deseos deja tres oyentes y el cuarto
// clic hace la misma cosa cuatro veces.
let cambiosEnganchados = false

function engancharCambios() {
  const caja = $('mcCambiosPanel')
  if (cambiosEnganchados) return
  cambiosEnganchados = true
  caja.addEventListener('click', async (e) => {
    const escribir = e.target.closest('[data-escribir]')
    if (escribir) return abrirMensaje(escribir.dataset.escribir, escribir.dataset.direccion)
    // «Proponer cambio» (942): la propuesta ya rellena con lo que os cruzáis.
    const proponer = e.target.closest('[data-proponer]')
    if (proponer) return void proponerA(proponer.dataset.proponer)
    const filtro = e.target.closest('[data-cruces-filtro]')
    if (filtro) {
      crucesFiltro = filtro.dataset.crucesFiltro
      return void pintarCambios()
    }

    const alResumen = e.target.closest('[data-ir-resumen]')
    if (alResumen) return ctx.cambiarPestania('resumen')

    // UN CAMINO ESCRITO EN PROSA ES UN ENLACE QUE NADIE COMPRUEBA (tanda
    // 524, y es la tercera vez). Estos dos textos decían «en la pestaña
    // “Cartas”», y esa pestaña SALIÓ DEL MENÚ en la 447 — la pantalla
    // sigue, pero se llega por el panel. O sea que llevaba desde entonces
    // mandando a buscar una pestaña que no está, en la primera pantalla de
    // Cambios. Un botón se rompe si su destino se borra; una frase, no.
    const aCartas = e.target.closest('[data-ir-cartas]')
    if (aCartas) return ctx.cambiarPestania('cartas')

    // Lo que buscas vive en «La quiero» desde la 751.
    if (e.target.closest('[data-ir-quiero]')) return ctx.cambiarPestania('quiero')
  })
}

async function proponerA(userId) {
  const p = tablon.cruzarPorPersona(tablonTiene.filter((f) => f.user_id === userId), tablonBusca.filter((f) => f.user_id === userId))[0]
  const otro = { id: userId, username: p?.username, display_name: p?.display_name, avatar_url: p?.avatar_url }
  const fila = (f) => ({ card_id: f.card_id, market: f.market || ctx.cartas.get(f.card_id)?.market || 'WEST', idioma: f.idioma || null })
  try {
    const m = await import('../cambio-propuesta.js')
    await m.abrirPropuesta({ sesion: ctx.sesion, otro, prefill: { suyas: (p?.teDa || []).map(fila), mias: (p?.leDas || []).map(fila) }, alEnviar: () => void pintarMisCambiosArriba() })
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// «Tus cambios» (942), arriba de los cruces: lo que está en curso.
async function pintarMisCambiosArriba() {
  const caja = $('mcMisCambios')
  if (!caja || !ctx.sesion) return
  try {
    const m = await import('../cambio-propuesta.js')
    await m.pintarMisCambios(caja, { sesion: ctx.sesion })
  } catch { caja.hidden = true }
}

// El mensaje se deja ESCRITO, no enviado: quien lo manda lo lee antes.
// Un botón que manda un mensaje a un desconocido sin enseñárselo es una
// forma rápida de quedar mal, y encima con el nombre de la casa.
function abrirMensaje(userId, direccion) {
  if (direccion === 'cruce') {
    const conCarta = (filas) => filas.filter((f) => f.user_id === userId).map((f) => ({ ...f, carta: ctx.cartas.get(f.card_id) }))
    const p = tablon.cruzarPorPersona(conCarta(tablonTiene), conCarta(tablonBusca))[0]
    const texto = tablon.borradorDeCruce(p?.teDa || [], p?.leDas || [])
    location.href = `/mensajes.html?with=${encodeURIComponent(userId)}&texto=${encodeURIComponent(texto)}`
    return
  }
  const filas = (direccion === 'tiene' ? tablonTiene : tablonBusca).filter((f) => f.user_id === userId)
  const persona = { reciproco: filas.some((f) => f.reciproco) }
  const texto = tablon.borradorDe(persona, filas.map((f) => ({ ...f, carta: ctx.cartas.get(f.card_id) })), direccion)
  location.href = `/mensajes.html?with=${encodeURIComponent(userId)}&texto=${encodeURIComponent(texto)}`
}

// ── EL MERCADO (tanda 770) ──
//
// Lo pinta js/mi-coleccion/mercado.js, que entra al abrir la pestaña; aquí
// queda lo que es de la página: las cartas de otra gente (que no están en
// memoria), tus deseos y las dos consultas de los cruces, que comparten el
// Mercado, las cuentas del selector y las tres listas.

export async function abrirMercado() {
  try {
    ctx.mercadoMod = ctx.mercadoMod || (await import('./mercado.js'))
    if (ctx.sesion) await cargarDeseos().catch(() => null)
    await ctx.mercadoMod.abrir(ctx.contexto)
  } catch (err) {
    if ($('mcMercadoRejilla')) $('mcMercadoRejilla').innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
  }
}

export async function completarCartasDeFuera(ids, market) {
  const sinCarta = [...new Set(ids)].filter((id) => !ctx.cartas.has(id))
  const sinPrecio = [...new Set(ids)].filter((id) => !ctx.guardados.has(id))
  const [nuevas, precios] = await Promise.all([
    sinCarta.length ? datos.cartasPorIds(sinCarta, market).catch(() => new Map()) : new Map(),
    sinPrecio.length ? datos.preciosGuardados(sinPrecio).catch(() => new Map()) : new Map(),
  ])
  for (const [k, v] of nuevas) ponerCarta(k, { ...v, market: v.market || market })
  for (const [k, v] of precios) ponerPrecio(k, v)
  // Los cruces y las listas no dicen de qué catálogo es cada carta (777):
  // la que no está en el elegido se busca en el otro, o sale sin foto.
  const otro = market === 'JP' ? 'WEST' : 'JP'
  const siguen = sinCarta.filter((id) => !ctx.cartas.has(id))
  if (siguen.length) for (const [k, v] of await datos.cartasPorIds(siguen, otro).catch(() => new Map())) ponerCarta(k, { ...v, market: v.market || otro })
}

// Las dos direcciones del cambio, pedidas UNA vez y compartidas. Se olvidan
// cuando cambia lo que las decide: tus deseos (quién tiene) o lo que das
// (quién busca).
let pidiendoTiene = null
let pidiendoBusca = null
export async function pedirQuienTiene() {
  if (!ctx.sesion) return []
  ctx.cambios = ctx.cambios || (await import('./cambios.js'))
  pidiendoTiene = pidiendoTiene || ctx.cambios.quienTiene().catch((err) => { pidiendoTiene = null; throw err })
  return pidiendoTiene
}
export async function pedirQuienBusca() {
  if (!ctx.sesion) return []
  ctx.cambios = ctx.cambios || (await import('./cambios.js'))
  pidiendoBusca = pidiendoBusca || ctx.cambios.quienBusca().catch((err) => { pidiendoBusca = null; throw err })
  return pidiendoBusca
}

// Apuntar una carta: SIEMPRE preguntando el idioma (771). Vale para el
// buscador de «La quiero», el Mercado y su ficha.
export async function quererCarta(c) {
  if (!ctx.sesion) return false
  await cargarDeseos()
  const idioma = await preguntarIdioma({ nombre: ctx.nombreDe(c), market: c.market || ctx.mercado, setId: c.set_id })
  if (idioma === undefined) return false
  // CAMBIA YA, CONFIRMA DESPUÉS, DESHAZ SI FALLA (896, R6): la carta entra
  // en la lista como fila provisional y se repinta todo; la de verdad la
  // sustituye cuando llega, y si la base dice que no, se quita.
  const provisional = { id: `provisional-${Date.now()}`, user_id: ctx.sesion.user.id, card_id: c.id, idioma, created_at: new Date().toISOString(), provisional: true }
  ctx.deseos = [provisional, ...ctx.deseos]
  alCambiarDeseos()
  try {
    const d = await ctx.cambios.anadirDeseo({ user_id: ctx.sesion.user.id, card_id: c.id, idioma })
    ctx.deseos = [d, ...ctx.deseos.filter((x) => x !== provisional)]
    showToast(`${ctx.nombreDe(c) || 'Apuntada'}, en «La quiero»${idioma ? ` (en ${idiomaDe(idioma).nombre.toLowerCase()})` : ''}. Si alguien la da, saldrá en Cruces.`, 'success')
  } catch (err) {
    ctx.deseos = ctx.deseos.filter((x) => x !== provisional)
    alCambiarDeseos()
    showToast(err.message, err.yaEstaba ? 'info' : 'error')
    return false
  }
  alCambiarDeseos()
  return true
}
// Quitar el corazón quita la carta en TODOS sus idiomas, como en la ficha
// (la 751): si ya no la quieres, no la quieres en ninguno.
export async function quitarDeseosDe(cardId) {
  await cargarDeseos()
  // Primero sale de la lista (896); si la base no la borra, vuelve.
  const quitadas = ctx.deseos.filter((x) => x.card_id === cardId)
  ctx.deseos = ctx.deseos.filter((x) => x.card_id !== cardId)
  alCambiarDeseos()
  try {
    for (const d of quitadas.filter((x) => !x.provisional)) await ctx.cambios.borrarDeseo(d.id)
    showToast('Quitada de «La quiero».', 'success')
  } catch (err) {
    ctx.deseos = [...quitadas, ...ctx.deseos]
    alCambiarDeseos()
    showToast(err.message, 'error')
  }
}
function alCambiarDeseos() {
  pidiendoTiene = null
  pintarCuentasDeDeseos()
  pintarLoseta()
  if (ctx.pestania === 'quiero') pintarQuiero()
  if (ctx.pestania === 'mercado') ctx.mercadoMod?.repintar()
  void contarDeseosYCambios()
}
function alCambiarLoQueDoy() {
  pidiendoBusca = null
  pidiendoTiene = null
  void contarDeseosYCambios()
}

// LAS CUENTAS DEL SELECTOR (770): cuántas da la gente, cuántas quieres,
// cuántas das y con cuánta gente cruzas. `null` = no se sabe, y entonces el
// botón no lleva número (un «0» diría que no hay).
const cuentasDeDeseos = { mercado: null, cruces: null, perfectos: false }
export function pintarCuentasDeDeseos(n = {}) {
  Object.assign(cuentasDeDeseos, n)
  const valores = {
    mercado: cuentasDeDeseos.mercado,
    quiero: ctx.sesion && Array.isArray(ctx.deseos) ? ctx.deseos.length : null,
    doy: ctx.sesion && ctx.esMia ? new Set(ctx.loQueDoy().map((l) => l.card_id)).size : null,
    cruces: ctx.sesion ? cuentasDeDeseos.cruces : null,
  }
  for (const el of document.querySelectorAll('[data-deseos-n]')) {
    const v = valores[el.dataset.deseosN]
    el.textContent = v == null ? '' : v.toLocaleString('es-ES', { useGrouping: 'always' })
    el.classList.toggle('hidden', v == null)
  }
  for (const el of document.querySelectorAll('[data-deseos-punto]')) el.classList.toggle('hidden', !(ctx.sesion && cuentasDeDeseos.perfectos))
  // Sin cuenta solo hay Mercado: las otras tres son TUS listas.
  for (const b of document.querySelectorAll('.mc-deseos-seg [data-deseos-vista]')) b.classList.toggle('hidden', !ctx.sesion && b.dataset.deseosVista !== 'mercado')
  // Los tres pasos, hasta que tengas algo que buscas Y algo que das.
  const sabe = Array.isArray(ctx.deseos)
  const completo = ctx.sesion && sabe && ctx.deseos.length > 0 && ctx.loQueDoy().length > 0
  $('mcDeseosPasos')?.classList.toggle('hidden', Boolean(completo) || (ctx.sesion && !sabe))
}
export async function contarDeseosYCambios() {
  if (!ctx.sesion) return pintarCuentasDeDeseos()
  await cargarDeseos().catch(() => null)
  pintarCuentasDeDeseos()
  const [tiene, busca] = await Promise.all([pedirQuienTiene().catch(() => null), pedirQuienBusca().catch(() => null)])
  if (tiene && busca) {
    const todas = [...tiene, ...busca]
    pintarCuentasDeDeseos({ cruces: new Set(todas.map((f) => f.user_id)).size, perfectos: todas.some((f) => f.reciproco) })
  }
}

// /mi-coleccion?ver=mercado SIN CUENTA (770): el escaparate. Sin colección
// detrás no hay menú (las demás pestañas son tuyas), y el corazón y
// «Escribir» llevan a crear la cuenta con la vuelta puesta.


// ── «LA QUIERO» (tanda 751) ──
//
// Es «Lo que buscas» de los cambios en su propia pantalla, con lo que le
// faltaba para usarla a diario: el precio de cada carta y lo que suma
// (K1), su aviso de precio (K2, los avisos de la 665) y compartirla como
// imagen (Y3). Quién te las da sigue en Cambios: es la misma lista
// cruzada con la de los demás.

// La lista se pide UNA vez y la comparten el Panel, Cambios, «La quiero»
// y el corazón de la ficha. Si dos piden a la vez, esperan a la misma.
let cargandoDeseos = null
export function cargarDeseos() {
  if (Array.isArray(ctx.deseos)) return Promise.resolve(ctx.deseos)
  if (!cargandoDeseos) {
    cargandoDeseos = (async () => {
      ctx.cambios = ctx.cambios || (await import('./cambios.js'))
      ctx.deseos = await ctx.cambios.deseosDe(ctx.sesion.user.id)
      return ctx.deseos
    })().catch((err) => {
      cargandoDeseos = null
      throw err
    })
  }
  return cargandoDeseos
}

// El precio de lo que quieres es el de su idioma; «cualquier idioma»,
// el de la carta en español, que es el que se pinta en el resto de la
// pantalla.


// Tus avisos de precio de estas cartas: id → avisos encendidos. null = no
// se sabe (sin la migración de la 665), y entonces la fila no dice si hay
// aviso, en vez de decir que no lo hay.
let avisosDeQuiero = null
async function pedirAvisosDeQuiero(ids) {
  if (!ids.length) return new Map()
  const { data, error } = await supabase.from('user_price_alerts').select('id,card_id,tipo,umbral,activo').eq('user_id', ctx.sesion.user.id).eq('activo', true).in('card_id', ids.slice(0, 300))
  if (error) return null
  const mapa = new Map()
  for (const a of data || []) mapa.set(a.card_id, [...(mapa.get(a.card_id) || []), a])
  return mapa
}

export async function abrirQuiero() {
  const caja = $('mcQuieroPanel')
  if (!caja) return
  pintarCatalogoDeDeseo()
  if (!Array.isArray(ctx.deseos)) caja.innerHTML = '<div class="skeleton" style="height:180px"></div>'
  try {
    await cargarDeseos()
  } catch (err) {
    caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
    return
  }
  pintarQuiero()
  // La carta, su precio y tus avisos llegan después y repintan: lo que
  // quieres casi nunca lo tienes, así que no está en memoria.
  await completarQuiero()
  if (ctx.pestania === 'quiero') pintarQuiero()
}

// QUIÉN DE LOS QUE SIGUES LA TIENE (766, DC1): por cada carta de tu lista,
// la gente a la que sigues que la tiene en su colección pública. Una
// llamada para toda la lista (`coleccion_seguidos_y_mis_deseos`, migración
// 766); sin ella, la de la ficha (la 403) carta a carta, solo para las
// primeras veinte. `null` = no se sabe (la fila no dice nada).
let seguidosDeQuiero = null
async function pedirSeguidosQueLaTienen(ids) {
  if (!ids.length) return new Map()
  const mapa = new Map()
  const { data, error } = await supabase.rpc('coleccion_seguidos_y_mis_deseos')
  if (!error) {
    for (const f of data || []) mapa.set(f.card_id, [...(mapa.get(f.card_id) || []), f])
    return mapa
  }
  const primeras = ids.slice(0, 20)
  for (let i = 0; i < primeras.length; i += 4) {
    const trozo = await Promise.all(primeras.slice(i, i + 4).map((id) => datos.quienLaTiene(id).then((g) => [id, g]).catch(() => [id, null])))
    for (const [id, g] of trozo) if (g?.length) mapa.set(id, g)
  }
  return mapa
}
// «La tiene @ana» / «La tienen @ana y 2 más» (de los que sigues).
export function textoDeSeguidos(gente) {
  if (!gente?.length) return ''
  const primero = `@${gente[0].username}`
  if (gente.length === 1) return `La tiene ${primero}, a quien sigues`
  return `La tienen ${primero} y ${gente.length - 1} más de los que sigues`
}

async function completarQuiero() {
  const ids = [...new Set(ctx.deseos.map((d) => d.card_id))]
  void pedirQuienTiene().then((tiene) => {
    dantesDeQuiero = dantesPorCarta(tiene)
    if (ctx.pestania === 'quiero') pintarQuiero()
  }).catch(() => null)
  void pedirSeguidosQueLaTienen(ids).then((m) => {
    seguidosDeQuiero = m
    if (ctx.pestania === 'quiero') pintarQuiero()
  }).catch(() => null)
  const sinCarta = ids.filter((id) => !ctx.cartas.has(id))
  const sinPrecio = ids.filter((id) => !ctx.guardados.has(id))
  const [nuevas, precios, avisos] = await Promise.all([
    sinCarta.length ? datos.cartasPorIds(sinCarta, ctx.mercado).catch(() => new Map()) : new Map(),
    sinPrecio.length ? datos.preciosGuardados(sinPrecio).catch(() => new Map()) : new Map(),
    pedirAvisosDeQuiero(ids).catch(() => null),
  ])
  for (const [k, v] of nuevas) ponerCarta(k, v)
  // Lo que no está en el catálogo que miras puede ser del otro (768): la
  // lista mezcla occidentales y japonesas.
  const deOtro = sinCarta.filter((id) => !ctx.cartas.has(id))
  if (deOtro.length) for (const [k, v] of await datos.cartasPorIds(deOtro, ctx.mercado === 'JP' ? 'WEST' : 'JP').catch(() => new Map())) ponerCarta(k, v)
  for (const [k, v] of precios) ponerPrecio(k, v)
  avisosDeQuiero = avisos
}

// «La quiero» en REJILLA (771). PINGU: «que aparezcan las cartas de la
// gente». Una baldosa por carta (dos idiomas apuntados son una carta), con
// en qué idioma la quieres, lo que cuesta, su aviso y QUIÉN LA DA, que sale
// de los cruces (`intercambios_quien_tiene`). La prioridad se fue: «con que
// esté en favoritos ya está» —la columna sigue en la base, sin enseñarse—.
let quieroFiltro = 'todas'
let dantesDeQuiero = null // card_id → [personas] · null = no se sabe
export function deseosPorCarta(lista = []) {
  const m = new Map()
  for (const d of lista) m.set(d.card_id, [...(m.get(d.card_id) || []), d])
  return [...m.entries()].map(([card_id, filas]) => ({ card_id, filas }))
}
// Quién da cada carta de tu lista, una persona una vez.
export function dantesPorCarta(tiene = []) {
  const m = new Map()
  for (const f of tiene) {
    const lista = m.get(f.card_id) || []
    if (!lista.some((p) => p.user_id === f.user_id)) lista.push(f)
    m.set(f.card_id, lista)
  }
  return m
}
function pintarQuiero() {
  const caja = $('mcQuieroPanel')
  if (!caja || !Array.isArray(ctx.deseos)) return
  const grupos = deseosPorCarta(ctx.deseos)
  const precios = grupos.map((g) => ctx.precioDeDeseo(g.filas[0]))
  const conPrecio = precios.filter((v) => v != null)
  const suma = conPrecio.reduce((a, v) => a + v, 0)
  const n = grupos.length
  const sinPrecio = n - conPrecio.length
  const dan = (g) => dantesDeQuiero?.get(g.card_id)?.length || 0
  const conAlguien = dantesDeQuiero ? grupos.filter((g) => dan(g) > 0).length : null
  const visibles = grupos.map((g, i) => ({ g, precio: precios[i] })).filter(({ g }) =>
    quieroFiltro === 'todas' || !dantesDeQuiero || (quieroFiltro === 'dan' ? dan(g) > 0 : dan(g) === 0))
  caja.innerHTML = `
    ${n
      ? `<div class="mc-quiero-cabeza">
          <p class="mc-quiero-cifra" id="mcQuieroCifra"><b>${n.toLocaleString('es-ES', { useGrouping: 'always' })}</b> ${n === 1 ? 'carta' : 'cartas'}${conPrecio.length ? ` · unos <b>${escapeHtml(euros(suma))}</b>` : ''}${conPrecio.length && sinPrecio ? ` <small>(${sinPrecio} sin precio)</small>` : ''}</p>
          <span class="mc-quiero-botones">
            <button type="button" class="btn-secondary mc-quiero-compartir" id="mcQuieroTexto">${icons.share(16)}<span>Compartir lista</span></button>
            <button type="button" class="btn-secondary mc-quiero-compartir" id="mcQuieroCompartir">${icons.image(16)}<span>Imagen</span></button>
          </span>
        </div>
        ${conAlguien === null ? '' : `<div class="mc-quiero-filtro">
          <span class="seg" role="group" aria-label="Cuáles">
            <button type="button" class="seg-btn" data-quiero-filtro="todas" aria-pressed="${quieroFiltro === 'todas'}">Todas</button>
            <button type="button" class="seg-btn" data-quiero-filtro="dan" aria-pressed="${quieroFiltro === 'dan'}">Las da alguien <span class="mc-deseos-n">${conAlguien}</span></button>
            <button type="button" class="seg-btn" data-quiero-filtro="nadie" aria-pressed="${quieroFiltro === 'nadie'}">Nadie aún <span class="mc-deseos-n">${n - conAlguien}</span></button>
          </span>
        </div>`}`
      : ''}
    ${n
      ? `<div class="mc-mercado-rejilla mc-deseos-rejilla" id="mcQuieroRejilla">${visibles.map(({ g, precio }) => deseoHtml(g, precio)).join('')}</div>
         ${visibles.length ? '' : `<p class="subtext">${quieroFiltro === 'dan' ? 'Nadie da todavía ninguna de tu lista.' : 'Todas las de tu lista las da alguien.'}</p>`}
         <p class="subtext">Tu lista la ve todo el mundo: es lo que hace que alguien te escriba. Quítala tocando el corazón.</p>`
      : `<div class="mc-quiero-vacio">
           <span class="mc-quiero-vacio-icono" aria-hidden="true">${laQuiero.corazon(28)}</span>
           <p><strong>Apunta las cartas que te faltan</strong></p>
           <p class="subtext">Con el buscador de arriba, con el corazón de cada carta o en el <button type="button" class="link-btn" data-deseos-vista="mercado">Mercado</button>. Te diremos lo que cuestan, te avisamos si bajan y quién las da.</p>
         </div>`}`
  engancharQuiero()
}

let quieroEnganchado = false
function engancharQuiero() {
  const caja = $('mcQuieroPanel')
  if (quieroEnganchado) return
  quieroEnganchado = true
  // El buscador vive fuera de lo que se repinta (768): lo que escribes no
  // se borra cuando llega el precio o quién la tiene.
  let esperaDeseo = null
  $('mcDeseoBuscar')?.addEventListener('input', () => {
    clearTimeout(esperaDeseo)
    esperaDeseo = setTimeout(buscarParaDesear, 250)
  })
  $('mcDeseoAlta')?.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-deseo-mercado]')
    if (m) {
      deseoMercado = m.dataset.deseoMercado
      pintarCatalogoDeDeseo()
      return void buscarParaDesear()
    }
    const desear = e.target.closest('[data-desear]')
    if (!desear) return
    desear.disabled = true
    // Se pregunta el idioma (771); la japonesa, en japonés.
    const c = ctx.cartas.get(desear.dataset.desear)
    const puesta = c ? await quererCarta(c) : false
    if (!puesta) {
      desear.disabled = false
      return
    }
    // Se queda la búsqueda: lo normal es apuntar varias seguidas.
    void buscarParaDesear()
    await completarQuiero()
    pintarQuiero()
  })
  caja.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ir-cambios]')) return ctx.cambiarPestania('cambios')
    if (e.target.closest('#mcQuieroCompartir')) return compartirLaQuiero()
    if (e.target.closest('#mcQuieroTexto')) return compartirMisListas()

    // El aviso de precio de la fila (K2) es el «Avísame» de la ficha, con
    // el idioma que buscas y su precio de ahora para proponer el umbral.
    const avisar = e.target.closest('[data-avisar-deseo]')
    if (avisar) {
      const d = ctx.deseos.find((x) => x.id === avisar.dataset.avisarDeseo)
      if (!d) return
      return abrirAviso({ cardId: d.card_id, market: ctx.cartas.get(d.card_id)?.market || ctx.mercado, idioma: d.idioma || 'es', precio: ctx.precioDeDeseo(d) })
    }

    const filtro = e.target.closest('[data-quiero-filtro]')
    if (filtro) {
      quieroFiltro = filtro.dataset.quieroFiltro
      return pintarQuiero()
    }
    const quien = e.target.closest('[data-ver-quien]')
    if (quien) return void verQuienDa(quien.dataset.verQuien)
    // El corazón quita la carta (en todos sus idiomas), como en la ficha.
    const quitar = e.target.closest('[data-quitar-deseo-carta]')
    if (quitar) {
      quitar.disabled = true
      await quitarDeseosDe(quitar.dataset.quitarDeseoCarta)
    }
  })
  // Al cerrar el diálogo de aviso, la fila dice el aviso que acabas de
  // poner (o quitar). El diálogo lo crea avisos-precio.js al abrirlo por
  // primera vez, así que se escucha en el documento: `close` no sube, pero
  // se ve en la captura.
  document.addEventListener('close', async (e) => {
    if (e.target?.id !== 'pvAvisoDialogo' || ctx.pestania !== 'quiero' || !Array.isArray(ctx.deseos)) return
    avisosDeQuiero = await pedirAvisosDeQuiero([...new Set(ctx.deseos.map((d) => d.card_id))]).catch(() => null)
    pintarQuiero()
  }, true)
}

// Tu lista en una imagen (Y3), para pegarla en un grupo de cambios. El
// dibujo entra al pulsar.
// ── DESEOS Y CAMBIOS (763, DC1) ──
//
// Las tres vistas van con el mismo selector arriba: «La quiero» y «Las que
// doy» son dos listas de la misma pestaña, y «Cruces» es la de Cambios
// (quién encaja contigo). Así se llega a las tres desde cualquiera, sin un
// menú más.
let vistaDeseos = 'quiero'
export function ponerVistaDeseos(v) {
  if (v === 'cruces') return ctx.cambiarPestania('cambios')
  if (v === 'mercado') return ctx.cambiarPestania('mercado')
  vistaDeseos = v
  if (ctx.pestania !== 'quiero') ctx.cambiarPestania('quiero')
  for (const b of document.querySelectorAll('#mcPanelQuiero .mc-deseos-seg [data-deseos-vista]')) b.setAttribute('aria-pressed', String(b.dataset.deseosVista === v))
  $('mcQuieroPanel')?.classList.toggle('hidden', v !== 'quiero')
  $('mcDeseoAlta')?.classList.toggle('hidden', v !== 'quiero')
  $('mcDoyPanel')?.classList.toggle('hidden', v !== 'doy')
  if (v === 'doy') void pintarDoy()
}

// «LAS QUE DOY» EN REJILLA (772): tus copias puestas a cambio, cada una con
// cuántas das de las que tienes (− y +, sin abrir el editor) y QUIÉN LA
// BUSCA, que es lo que hace que merezca la pena darla. «Poner más para
// cambio» abre Buscar en modo elegir: tocas una que tengas y se pone una
// copia más para cambio.
async function pintarDoy() {
  const caja = $('mcDoyPanel')
  if (!caja) return
  const doy = ctx.loQueDoy()
  const poner = `<button type="button" class="btn-primary mc-doy-poner" id="mcDoyPoner"><span aria-hidden="true">+</span><span>Poner más para cambio</span></button>`
  if (!doy.length) {
    caja.innerHTML = `<div class="mc-quiero-vacio">
        <span class="mc-quiero-vacio-icono" aria-hidden="true">${icons.package(28)}</span>
        <p><strong>Todavía no das ninguna</strong></p>
        <p class="subtext">Lo que pongas para cambio sale en el Mercado, con tu nombre, y te decimos quién lo busca.${ctx.repetidas(...ctx.pTodo()).length ? ` Te sobran copias de ${ctx.repetidas(...ctx.pTodo()).length} ${ctx.repetidas(...ctx.pTodo()).length === 1 ? 'carta' : 'cartas'}.` : ''}</p>
        ${poner}
      </div>`
    return
  }
  const ids = [...new Set(doy.map((l) => l.card_id))]
  const sinPrecio = ids.filter((id) => !ctx.guardados.has(id))
  let buscan = null
  try {
    const [precios, quien] = await Promise.all([
      sinPrecio.length ? datos.preciosGuardados(sinPrecio).catch(() => new Map()) : new Map(),
      pedirQuienBusca().catch(() => null),
    ])
    for (const [k, v] of precios) ponerPrecio(k, v)
    // `null` = no se sabe (sin la migración): la baldosa no dice «nadie».
    if (quien) buscan = dantesPorCarta(quien)
  } catch {
    buscan = null
  }
  if (vistaDeseos !== 'doy') return
  const filas = doy.map((l) => ({ l, c: ctx.cartaDeDoy(l), precio: valorDeLinea({ ...l, cantidad: 1 }, ctx.precioDe(l)) ?? null }))
  const suma = filas.reduce((a, f) => a + (f.precio || 0) * Number(f.l.cambio), 0)
  const copias = filas.reduce((a, f) => a + Number(f.l.cambio), 0)
  caja.innerHTML = `<div class="mc-quiero-cabeza">
      <p class="mc-quiero-cifra"><b>${copias.toLocaleString('es-ES', { useGrouping: 'always' })}</b> ${copias === 1 ? 'copia' : 'copias'} que das${suma ? ` · unos <b>${escapeHtml(euros(suma))}</b>` : ''}</p>
      <span class="mc-quiero-botones">
        ${poner}
        <button type="button" class="btn-secondary mc-quiero-compartir" id="mcDoyCompartir">${icons.share(16)}<span>Compartir lista</span></button>
      </span>
    </div>
    <p class="subtext mc-doy-nota">Lo que das sale en el Mercado, con tu nombre.</p>
    <div class="mc-mercado-rejilla mc-doy-rejilla" id="mcDoyRejilla">${filas.map(({ l, c, precio }) => {
      const nombre = ctx.nombreDe(c) || l.card_id
      const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
      const gente = buscan?.get(l.card_id) || []
      const das = Number(l.cambio)
      const tienes = Number(l.cantidad)
      return `<article class="mc-merc mc-doy-baldosa" data-doy-linea="${escapeHtml(l.id)}">
        <a class="mc-merc-abrir" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(`Ver ${nombre}`)}">
          <span class="mc-merc-foto"><span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
          ${gente.length ? `<span class="mc-merc-chapa busca">${gente.length === 1 ? 'La busca 1' : `La buscan ${gente.length}`}</span>` : ''}
        </a>
        <span class="mc-merc-nombre">${escapeHtml(nombre)}</span>
        <span class="mc-merc-set">${escapeHtml([nombreDeSet(c?.tcg_sets), c?.local_id].filter(Boolean).join(' · '))}</span>
        <span class="mc-merc-fila">${banderaHtml(l.idioma || 'es')}<span class="mc-merc-texto">${escapeHtml(estadoDe(l.estado).nombre)}</span><b class="mc-quiero-precio${precio == null ? ' sin' : ''}">${precio == null ? 'sin precio' : escapeHtml(euros(precio))}</b></span>
        <span class="mc-merc-fila mc-doy-paso">
          <button type="button" class="mc-doy-boton" data-doy-menos="${escapeHtml(l.id)}" aria-label="Dar una menos de ${escapeHtml(nombre)}">−</button>
          <span class="mc-doy-cuantas">Doy ${das} de ${tienes}</span>
          <button type="button" class="mc-doy-boton" data-doy-mas="${escapeHtml(l.id)}"${das >= tienes ? ' disabled' : ''} aria-label="Dar una más de ${escapeHtml(nombre)}">+</button>
        </span>
        ${buscan === null
          ? ''
          : gente.length
            ? `<button type="button" class="mc-merc-fila mc-deseo-quien" data-deseos-vista="cruces">${mercadoAvatares(gente)}<span class="mc-merc-texto">Ver en Cruces</span></button>`
            : '<span class="mc-merc-fila mc-merc-nadie">Nadie la busca aún</span>'}
        <button type="button" class="mc-quiero-aviso mc-doy-aviso" data-avisar-doy="${escapeHtml(l.card_id)}" data-idioma="${escapeHtml(l.idioma || 'es')}" aria-label="Avísame si ${escapeHtml(nombre)} cambia de precio">${icons.bell(14)}</button>
      </article>`
    }).join('')}</div>`
}

// − y + de una baldosa: cuántas copias de esa línea das. Al llegar a 0 la
// carta sale de la lista (sigue en tu colección).
export async function cambiarLoQueDoy(id, delta) {
  const l = ctx.lineasDeTodas().find((x) => x.id === id)
  if (!l) return
  const cambio = Math.max(0, Math.min(Number(l.cantidad) || 0, (Number(l.cambio) || 0) + delta))
  if (cambio === Number(l.cambio)) return
  try {
    const nueva = await datos.actualizar(id, { cambio })
    ctx.cambiarLinea(id, nueva)
    if (!cambio) showToast('Ya no la das. Sigue en tu colección.', 'success')
  } catch (err) {
    showToast(err.message, 'error')
  }
  alCambiarLoQueDoy()
  void pintarDoy()
}

// «Poner más para cambio»: Buscar en modo elegir. Una que tienes pasa a dar
// una copia más (la línea con más copias libres); una que no tienes no se
// puede dar, y se dice.
export function ponerMasParaCambio() {
  ctx.elegirCarta({
    titulo: 'Toca una carta tuya para ponerla a cambio',
    alElegir: async (c, variante = null) => {
      const deEsa = ctx.lineasDeTodas().filter((l) => l.card_id === c.id && (!c.market || !l.market || l.market === c.market) && (!variante || (l.variante || 'normal') === variante))
      const mias = deEsa.filter((l) => Number(l.cambio || 0) < Number(l.cantidad || 0))
        .sort((a, b) => (b.cantidad - (b.cambio || 0)) - (a.cantidad - (a.cambio || 0)))
      ctx.cambiarPestania('quiero')
      ponerVistaDeseos('doy')
      if (!mias.length) {
        showToast(deEsa.length ? 'Ya das todas las copias que tienes de esa.' : 'Esa no la tienes: añádela a tu colección primero.', 'info')
        return
      }
      await cambiarLoQueDoy(mias[0].id, 1)
      showToast(`${ctx.nombreDe(c)}: das ${Number(ctx.lineasDeTodas().find((l) => l.id === mias[0].id)?.cambio || 0)}.`, 'success')
    },
    alCancelar: () => {
      ctx.cambiarPestania('quiero')
      ponerVistaDeseos('doy')
    },
  })
}

// La lista en TEXTO (763): para pegarla en un grupo o en una red, que es
// donde se hacen los cambios de verdad. Sirve para las dos listas.
export function textoDeLista(titulo, filas) {
  return [titulo, ...filas.map((f) => `• ${f.nombre}${f.detalle ? ` (${f.detalle})` : ''}${f.cuantas > 1 ? ` ×${f.cuantas}` : ''}`)].join('\n')
}
async function compartirTexto(texto, titulo) {
  try {
    if (navigator.share) await navigator.share({ title: titulo, text: texto })
    else {
      await navigator.clipboard.writeText(texto)
      showToast('Lista copiada: pégala donde quieras.', 'success')
    }
  } catch (err) {
    if (err?.name !== 'AbortError') showToast('No se ha podido compartir.', 'error')
  }
}
// «Compartir lista» (766, DC1): UN texto con las dos listas —«Busco…» y
// «Doy…»— y el enlace a tu perfil, que es donde te escriben. Es lo que se
// pega en un grupo de cambios: quien lo lee ve las dos mitades del trato.
export function textoDeCambio({ busco = [], doy = [], enlace = '' }) {
  const partes = []
  if (busco.length) partes.push(textoDeLista('Busco:', busco))
  if (doy.length) partes.push(textoDeLista('Doy:', doy))
  if (enlace) partes.push(`Escríbeme en PokeDoc: ${enlace}`)
  return partes.join('\n\n')
}
function filaDeTexto(c, id, cuantas = 1) {
  return { nombre: ctx.nombreDe(c) || id, detalle: [nombreDeSet(c?.tcg_sets), c?.local_id].filter(Boolean).join(' · '), cuantas }
}
function compartirMisListas() {
  const busco = (Array.isArray(ctx.deseos) ? ctx.deseos : []).map((d) => filaDeTexto(ctx.cartas.get(d.card_id), d.card_id))
  const doy = ctx.loQueDoy().map((l) => filaDeTexto(ctx.cartaDeDoy(l), l.card_id, Number(l.cambio)))
  if (!busco.length && !doy.length) return showToast('Apunta primero lo que buscas o lo que das.', 'info')
  const enlace = ctx.dueno?.username ? `${location.origin}/usuario/${encodeURIComponent(ctx.dueno.username)}` : location.origin
  return compartirTexto(textoDeCambio({ busco, doy, enlace }), 'Busco y doy')
}
export const compartirLoQueDoy = compartirMisListas

async function compartirLaQuiero() {
  const b = $('mcQuieroCompartir')
  if (b) b.disabled = true
  try {
    const { compartirLaQuiero: compartir } = await import('./imagen-quiero.js')
    await compartir({ cartas: ctx.deseos.map((d) => ({ carta: ctx.cartas.get(d.card_id), idioma: d.idioma })), nombre: ctx.dueno?.username || '' })
  } catch (err) {
    showToast(err.message || 'No se ha podido hacer la imagen.', 'error')
  } finally {
    if (b) b.disabled = false
  }
}

// El corazón de la ficha (K1): la carta abierta, pulsado si la quieres.
export function pintarLoseta(id = $('mcEdQuiero')?.dataset.quiero || null) {
  const b = $('mcEdQuiero')
  if (!b) return
  laQuiero.pintarLoseta(b, id, ctx.esMia && ctx.sesion ? ctx.deseos : null)
}

// La baldosa de lo que quieres (771): la del Mercado, con tu idioma, el
// precio, el aviso y quién la da. La foto abre la ficha de la carta; «Ver
// quién» abre la del Mercado, con la lista de personas.
function deseoHtml(g, precio = ctx.precioDeDeseo(g.filas[0])) {
  const c = ctx.cartas.get(g.card_id)
  const nombre = ctx.nombreDe(c) || g.card_id
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const d = g.filas[0]
  const baja = (avisosDeQuiero?.get(g.card_id) || []).find((a) => a.tipo === 'baja')
  // Si ya está por debajo de lo que pusiste, se dice (la maqueta K1): el
  // aviso llegará en la pasada siguiente, pero lo estás mirando ahora.
  const cumple = baja && precio != null && precio <= Number(baja.umbral)
  const idiomas = g.filas.map((x) => x.idioma).filter(Boolean)
  const idioma = g.filas.some((x) => !x.idioma)
    ? '<span class="mc-merc-texto">Cualquier idioma</span>'
    : `${idiomas.slice(0, 3).map((i) => banderaHtml(i)).join('')}<span class="mc-merc-texto">${escapeHtml(idiomas.map((i) => idiomaDe(i).nombre).join(', '))}</span>`
  const dan = dantesDeQuiero?.get(g.card_id) || []
  const seguidos = textoDeSeguidos(seguidosDeQuiero?.get(g.card_id))
  return `<article class="mc-merc mc-deseo-baldosa" data-deseo-carta="${escapeHtml(g.card_id)}">
    <a class="mc-merc-abrir" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(`Ver ${nombre}`)}">
      <span class="mc-merc-foto"><span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      ${dan.length ? `<span class="mc-merc-chapa cruce">${dan.length === 1 ? 'La da 1' : `La dan ${dan.length}`}</span>` : ''}
    </a>
    <button type="button" class="mc-merc-corazon puesto" data-quitar-deseo-carta="${escapeHtml(g.card_id)}" aria-pressed="true" aria-label="Quitar ${escapeHtml(nombre)} de tu lista">${laQuiero.corazon(16)}</button>
    <span class="mc-merc-nombre">${escapeHtml(nombre)}</span>
    <span class="mc-merc-set">${escapeHtml([nombreDeSet(c?.tcg_sets), c?.local_id].filter(Boolean).join(' · '))}</span>
    <span class="mc-merc-fila mc-deseo-idioma">${idioma}</span>
    <span class="mc-merc-fila">
      <b class="mc-quiero-precio${precio == null ? ' sin' : ''}">${precio == null ? 'sin precio' : escapeHtml(euros(precio))}</b>
      <button type="button" class="mc-quiero-aviso${baja ? ' puesto' : ''}${cumple ? ' cumple' : ''}" data-avisar-deseo="${escapeHtml(d.id)}" aria-label="${baja ? `Te aviso si ${escapeHtml(nombre)} baja de ${escapeHtml(euros(Number(baja.umbral)))}` : `Avísame si ${escapeHtml(nombre)} baja de precio`}">${icons.bell(14)}${baja ? `<span>${cumple ? '¡Ya! ' : '&lt; '}${escapeHtml(euros(Number(baja.umbral)))}</span>` : ''}</button>
    </span>
    ${dantesDeQuiero === null
      ? ''
      : dan.length
        ? `<button type="button" class="mc-merc-fila mc-deseo-quien" data-ver-quien="${escapeHtml(g.card_id)}">${mercadoAvatares(dan)}<span class="mc-merc-texto">Ver quién</span></button>`
        : '<span class="mc-merc-fila mc-merc-nadie">Nadie la da aún · te avisamos</span>'}
    ${seguidos ? `<small class="mc-deseo-seguidos">${icons.users(12)} ${escapeHtml(seguidos)}</small>` : ''}
  </article>`
}

// Los avatares de la gente, con el mismo dibujo que el Mercado (el módulo
// del Mercado entra por `import()`, así que esto no puede pedírselo).
function mercadoAvatares(gente = [], max = 4) {
  return `<span class="mc-gente" aria-hidden="true">${gente.slice(0, max).map((p) => `<span class="mc-gente-av" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(p.display_name || p.username || '?'))}</span>`).join('')}</span>`
}

// «Ver quién»: la ficha del Mercado de esa carta, desde cualquier vista.
async function verQuienDa(cardId) {
  try {
    ctx.mercadoMod = ctx.mercadoMod || (await import('./mercado.js'))
    await ctx.mercadoMod.abrirFichaDe(ctx.contexto, cardId)
  } catch (err) {
    showToast(err.message, 'error')
  }
}
