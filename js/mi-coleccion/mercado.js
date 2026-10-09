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
// algo tuyo, «Cruce». Tocarla abre su ficha con la lista de personas, al
// lado en el PC (como la de un producto, la 769) y desde abajo en el móvil.
//
// Entra por un `import()` al abrir la pestaña, y su CSS va en
// css/mi-coleccion.css (el barrido de la 299 sigue los dinámicos). Lo que es
// de la página —las cartas en memoria, los precios, tus deseos— llega por el
// contexto: este módulo no toca `user_wants` por su cuenta.
import { escapeHtml, avatarStyle, getInitial, profileUrl } from '../app.js'
import { atributosDeRango } from '../rangos.js'
import { icons } from '../icons.js'
import { ICONOS_COLECCION } from './iconos.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from '../catalogo-series.js'
import { normalizeSearch } from '../texto.js'
import { banderaHtml } from '../precio-vista.js'
import { euros, idiomaDe } from '../cardmarket.js'
import { crecerDesde } from './gestos-ficha.js'
import { entenderBusqueda } from './busqueda.js'
import { mercado as pedirMercado, quienDaEsta } from './cambios.js'
import { senasDe, borradorDe } from './tablon.js'

const $ = (id) => document.getElementById(id)
const POR_PAGINA = 60
// Al lado, con ratón y sitio: la misma regla que la ficha de un producto.
export const CONSULTA_AL_LADO = '(min-width: 1400px) and (pointer: fine)'

// Las vistas desde las que se abre la ficha: al lado, le dejan su sitio.
const PANELES = ['mcPanelMercado', 'mcPanelQuiero', 'mcPanelCambios']
let ctx = null
const estado = { market: 'WEST', idioma: '', orden: 'nuevo', soloMias: false, texto: '' }
let filas = []
let total = 0
let turno = 0
let enganchado = false
let abierta = null // la carta de la ficha abierta
// Quién busca algo que tú das: user_id → cuántas de tus cartas. `null` = no
// se sabe (sin sesión o sin la migración): entonces no se marca «Cruce», en
// vez de decir que no lo hay.
let buscanLoMio = null

const nombreDe = (c) => nombreDeCarta(c) || ''
const nombreDePersona = (p) => p?.display_name || p?.username || 'Alguien'
export const textoDeGente = (n) => (n === 1 ? 'La da 1' : `La dan ${n}`)

export function avataresHtml(gente = [], max = 4) {
  return `<span class="mc-gente" aria-hidden="true">${gente.slice(0, max).map((p) => `<span class="mc-gente-av" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombreDePersona(p)))}</span>`).join('')}</span>`
}

// Lo que dice la baldosa debajo del precio. Pura, para la prueba.
export function chapaDeBaldosa({ busco, cruce }) {
  if (cruce) return { clase: 'cruce', texto: 'Cruce' }
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
  const cruce = Boolean(buscanLoMio && (f.dan || []).some((u) => buscanLoMio.has(u)))
  const chapa = chapaDeBaldosa({ busco, cruce })
  const precio = ctx.precioDeCarta(f.card_id)
  return `<article class="mc-merc${busco ? ' buscada' : ''}" data-merc="${escapeHtml(f.card_id)}">
    <button type="button" class="mc-merc-abrir" data-merc-ficha="${escapeHtml(f.card_id)}" aria-label="${escapeHtml(`Ver quién da ${nombre}`)}">
      <span class="mc-merc-foto"><span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      ${chapa ? `<span class="mc-merc-chapa ${chapa.clase}">${chapa.texto}</span>` : ''}
    </button>
    <button type="button" class="mc-merc-corazon${busco ? ' puesto' : ''}" data-merc-quiero="${escapeHtml(f.card_id)}" aria-pressed="${busco}" aria-label="${escapeHtml(`${busco ? 'Ya buscas' : 'La quiero:'} ${nombre}`)}">${ICONOS_COLECCION.corazon(16)}</button>
    <span class="mc-merc-nombre">${escapeHtml(nombre)}</span>
    <span class="mc-merc-set">${escapeHtml([nombreDeSet(c?.tcg_sets), c?.local_id].filter(Boolean).join(' · '))}</span>
    <span class="mc-merc-fila"><b class="mc-merc-precio">${precio == null ? '' : escapeHtml(euros(precio))}</b><span class="mc-merc-idiomas">${(f.idiomas || []).slice(0, 4).map((i) => banderaHtml(i)).join('')}</span></span>
    <span class="mc-merc-fila">${avataresHtml(f.gente || [])}<span class="mc-merc-dan">${textoDeGente(Number(f.personas) || 0)}</span></span>
  </article>`
}

function pintarRejilla() {
  const caja = $('mcMercadoRejilla')
  if (!caja) return
  if (!filas.length) {
    caja.innerHTML = `<div class="mc-quiero-vacio">
      <span class="mc-quiero-vacio-icono" aria-hidden="true">${icons.refreshCw(28)}</span>
      <p><strong>${estado.texto || estado.idioma || estado.soloMias ? 'Nadie da una carta así ahora mismo' : 'Todavía nadie da nada en este catálogo'}</strong></p>
      <p class="subtext">${estado.soloMias ? 'De las que buscas, ninguna está a cambio. Te avisamos cuando alguien la ponga.' : 'Cuando alguien ponga una carta para cambio, saldrá aquí.'}</p>
    </div>`
  } else caja.innerHTML = filas.map(baldosaHtml).join('')
  const mas = $('mcMercadoMas')
  mas?.classList.toggle('hidden', filas.length >= total)
  const cuenta = $('mcMercadoCuantas')
  if (cuenta) cuenta.textContent = total ? `${total.toLocaleString('es-ES', { useGrouping: 'always' })} ${total === 1 ? 'carta' : 'cartas'} a cambio` : ''
  ctx.alContar?.({ mercado: total })
}

async function cargar({ seguir = false } = {}) {
  const mio = ++turno
  const caja = $('mcMercadoRejilla')
  if (!seguir && caja) caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  let lista
  try {
    const sets = (await ctx.todosLosSets().catch(() => [])).filter((s) => (s.market || 'WEST') === estado.market)
    const leida = estado.texto ? entenderBusqueda(estado.texto, sets) : { texto: '', setIds: null }
    lista = await pedirMercado({
      market: estado.market,
      idioma: estado.idioma || null,
      texto: normalizeSearch(leida.texto || ''),
      sets: leida.setIds,
      soloMias: estado.soloMias,
      orden: estado.orden,
      limite: POR_PAGINA,
      desde: seguir ? filas.length : 0,
    })
  } catch (err) {
    if (mio !== turno) return
    if (caja) caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
    return
  }
  if (mio !== turno) return
  await ctx.completarCartas(lista.map((f) => f.card_id), estado.market)
  if (mio !== turno) return
  filas = seguir ? [...filas, ...lista] : lista
  total = Number(lista[0]?.total ?? (seguir ? total : 0)) || filas.length
  pintarRejilla()
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

function pintarMandos() {
  for (const b of document.querySelectorAll('[data-mercado-catalogo]')) b.setAttribute('aria-pressed', String(b.dataset.mercadoCatalogo === estado.market))
  const mias = $('mcMercadoMias')
  if (mias) {
    mias.classList.toggle('hidden', !ctx.sesion)
    mias.setAttribute('aria-pressed', String(estado.soloMias))
    mias.classList.toggle('activo', estado.soloMias)
  }
  // El japonés solo existe en japonés: en ese catálogo el idioma no filtra.
  const idioma = $('mcMercadoIdioma')
  if (idioma) {
    idioma.disabled = estado.market === 'JP'
    if (estado.market === 'JP') idioma.value = ''
  }
}

// ── La ficha ──

function personaHtml(p, carta) {
  const nombre = nombreDePersona(p)
  const suyas = buscanLoMio?.get(p.user_id) || 0
  return `<li class="mc-merf-persona">
    <a class="mini-avatar" href="${escapeHtml(profileUrl(p))}" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>
    <div class="mc-merf-quien">
      <p class="mc-merf-nombre"><a href="${escapeHtml(profileUrl(p))}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>${suyas ? '<span class="mc-merf-cruce">Cruce</span>' : ''}</p>
      <p class="subtext">${banderaHtml(p.idioma || 'es')} ${escapeHtml(senasDe(p))}${Number(p.cambio) > 1 ? ` · da ${Number(p.cambio)}` : ''}</p>
      ${suyas ? `<p class="mc-merf-busca">Busca ${suyas === 1 ? '1 de las tuyas' : `${suyas} de las tuyas`}</p>` : ''}
      <p class="mc-confianza" data-confianza="${escapeHtml(p.user_id)}"></p>
    </div>
    <div class="mc-merf-acciones">
      <button type="button" class="btn-primary" data-merf-escribir="${escapeHtml(p.user_id)}" data-carta="${escapeHtml(carta.id)}">${icons.mail(15)}<span>Escribir</span></button>
      <a class="btn-secondary" href="${escapeHtml(profileUrl(p))}">Su perfil</a>
    </div>
  </li>`
}

function botonQuieroHtml(c) {
  const mios = deseosDe(c.id)
  if (!mios.length) return `<button type="button" class="btn-primary mc-merf-quiero" data-merc-quiero="${escapeHtml(c.id)}" aria-pressed="false">${ICONOS_COLECCION.corazon(16)}<span>La quiero</span></button>`
  const idiomas = mios.map((d) => (d.idioma ? idiomaDe(d.idioma).nombre.toLowerCase() : 'cualquier idioma')).join(', ')
  return `<button type="button" class="btn-secondary mc-merf-quiero puesto" data-merc-quiero="${escapeHtml(c.id)}" aria-pressed="true">${ICONOS_COLECCION.corazon(16)}<span>La quieres · ${escapeHtml(idiomas)}</span></button>`
}

let gentePorCarta = new Map()
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
    <div id="mcMercadoFichaQuiero">${botonQuieroHtml(c)}</div>
    ${gente === undefined
      ? '<div class="skeleton" style="height:120px"></div>'
      : gente === null
        ? '<p class="subtext">No se ha podido preguntar quién la da.</p>'
        : `<h3 class="mc-merf-sub">${gente.length === 1 ? 'La da 1 persona' : `La dan ${gente.length} personas`}</h3>
           <ul class="mc-merf-gente">${gente.map((p) => personaHtml(p, c)).join('')}</ul>`}`
  import('../cambios-hechos.js').then((m) => m.ponerConfianza(cuerpo)).catch(() => {})
}

async function abrirFicha(cardId) {
  const d = $('mcMercadoFicha')
  if (!d) return
  abierta = cardId
  gentePorCarta.delete(cardId)
  void pintarFicha(cardId)
  const alLado = window.matchMedia(CONSULTA_AL_LADO).matches
  d.classList.toggle('mc-prodf-al-lado', alLado)
  for (const id of PANELES) $(id)?.classList.toggle('con-ficha-al-lado', alLado)
  if (!d.open) {
    if (alLado) d.show()
    else d.showModal()
  }
  let gente
  try {
    gente = await quienDaEsta(cardId, 50)
  } catch {
    gente = null
  }
  // Ordenadas con los cruces primero: es con quien se cierra antes.
  if (gente) gente = [...gente].sort((a, b) => (buscanLoMio?.get(b.user_id) || 0) - (buscanLoMio?.get(a.user_id) || 0))
  gentePorCarta.set(cardId, gente)
  if (abierta === cardId) void pintarFicha(cardId)
}

function escribir(userId, cardId) {
  if (!ctx.sesion) return void (location.href = ctx.urlDeRegistro())
  const p = (gentePorCarta.get(cardId) || []).find((x) => x.user_id === userId)
  if (!p) return
  const persona = { reciproco: Boolean(buscanLoMio?.get(userId)) }
  const texto = borradorDe(persona, [{ ...p, carta: ctx.cartas.get(cardId) }], 'tiene')
  location.href = `/mensajes.html?with=${encodeURIComponent(userId)}&texto=${encodeURIComponent(texto)}`
}

async function alternarQuiero(cardId, boton) {
  if (!ctx.sesion) return void (location.href = ctx.urlDeRegistro())
  const c = ctx.cartas.get(cardId)
  if (!c) return
  if (boton) boton.disabled = true
  try {
    if (deseosDe(cardId).length) await ctx.quitarDeseos(cardId)
    else await ctx.quererCarta(c)
  } finally {
    if (boton) boton.disabled = false
  }
  repintar()
}

// Lo que cambia fuera (un deseo puesto en otra vista, la ficha) repinta
// las baldosas sin volver a preguntar a la base.
export function repintar() {
  if (!ctx) return
  if (filas.length) pintarRejilla()
  if (abierta && $('mcMercadoFicha')?.open) void pintarFicha(abierta)
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
  $('mcMercadoIdioma')?.addEventListener('change', (e) => {
    estado.idioma = e.target.value
    void cargar()
  })
  $('mcMercadoOrden')?.addEventListener('change', (e) => {
    estado.orden = e.target.value
    void cargar()
  })
  const panel = $('mcPanelMercado')
  panel?.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-mercado-catalogo]')
    if (cat) {
      estado.market = cat.dataset.mercadoCatalogo
      pintarMandos()
      return void cargar()
    }
    if (e.target.closest('#mcMercadoMias') || e.target.closest('#mcMercadoAviso')) {
      estado.soloMias = e.target.closest('#mcMercadoAviso') ? true : !estado.soloMias
      pintarMandos()
      void pintarAviso()
      return void cargar()
    }
    if (e.target.closest('#mcMercadoMas')) return void cargar({ seguir: true })
    const q = e.target.closest('[data-merc-quiero]')
    if (q) return void alternarQuiero(q.dataset.mercQuiero, q)
    const f = e.target.closest('[data-merc-ficha]')
    // La carta crece desde su hueco hasta la ficha (798, MV12), si no está ya al lado.
    if (f) return void (window.matchMedia(CONSULTA_AL_LADO).matches || $('mcMercadoFicha')?.open ? abrirFicha(f.dataset.mercFicha) : crecerDesde(f.querySelector('img'), () => abrirFicha(f.dataset.mercFicha), { destino: '#mcMercadoFicha .mc-prodf-foto img' }))
  })
  const d = $('mcMercadoFicha')
  d?.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('#mcMercadoFichaCerrar')) return d.close()
    const q = e.target.closest('[data-merc-quiero]')
    if (q) return void alternarQuiero(q.dataset.mercQuiero, q)
    const w = e.target.closest('[data-merf-escribir]')
    if (w) return escribir(w.dataset.merfEscribir, w.dataset.carta)
  })
  d?.addEventListener('close', () => {
    abierta = null
    for (const id of PANELES) $(id)?.classList.remove('con-ficha-al-lado')
  })
}

// Quién busca lo tuyo, una vez por visita: es lo que marca «Cruce».
async function preparar(contexto) {
  ctx = contexto
  enganchar()
  if (!ctx.sesion || buscanLoMio !== null) return
  const busca = await ctx.quienBusca().catch(() => null)
  if (!busca) return
  buscanLoMio = new Map()
  const vistas = new Set()
  for (const f of busca) {
    const k = `${f.user_id}|${f.card_id}`
    if (vistas.has(k)) continue
    vistas.add(k)
    buscanLoMio.set(f.user_id, (buscanLoMio.get(f.user_id) || 0) + 1)
  }
}

// La ficha de una carta desde otra vista («Ver quién» de «La quiero»).
export async function abrirFichaDe(contexto, cardId) {
  await preparar(contexto)
  return abrirFicha(cardId)
}

// La primera vez se pide; las siguientes se repinta lo que hay (volver de
// otra vista no vuelve a preguntar).
let cargado = false
export async function abrir(contexto) {
  await preparar(contexto)
  if (!cargado) estado.market = ctx.mercado === 'JP' ? 'JP' : 'WEST'
  pintarMandos()
  void pintarAviso()
  if (cargado) return pintarRejilla()
  cargado = true
  await cargar()
}
