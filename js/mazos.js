// /mazos: los mazos guardados de quien ha entrado. Abrir, elegir su
// portada, duplicar y borrar. Montar uno nuevo es cosa de /constructor.
//
// La portada (tanda 413). PINGU: «que al mazo que te guardes le puedas
// poner la portada que quieras, y mejorar un poco los estilos». Antes era
// una miniatura de 72 px al lado del nombre, y la elegía el constructor
// —el Pokémon con más copias— sin preguntar. Ahora la tarjeta es la
// ilustración de la carta en grande, y la carta se elige: cualquiera del
// mazo, o cualquier otra buscándola.
import { requireAuth, escapeHtml } from './app.js'
import { showToast } from './toast.js'
import { cardImageUrl } from './tcgdex.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { misMazos, cartasPorIds, borrarMazo, guardarMazo, cambiarPortada, buscarCartas, cargarSets } from './constructor/datos.js'
import { nombreVisible, esEnergiaBasica, imagenDeEnergiaBasica, seccionesDelMazo } from './constructor/nucleo.js'

const $ = (id) => document.getElementById(id)
const FORMATOS = { standard: 'Estándar', expanded: 'Expandido', libre: 'Libre' }

function haceCuanto(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

let mazos = []
let cartas = new Map() // id → carta (las portadas, y las de un mazo al elegir)
let codigos = new Map() // set_id → código de TCG Live, para la imagen de respaldo

// La imagen de una carta con su cadena de respaldos: el espejo, y si no
// tiene (las promos de Mega Evolución, las energías), la CDN de Limitless.
function imagenDe(carta, calidad = 'low') {
  if (!carta) return ''
  let cadena
  if (!carta.image_path && esEnergiaBasica(carta)) {
    const e = imagenDeEnergiaBasica(carta, calidad === 'high' ? 'LG' : 'SM')
    cadena = e ? [e.url, e.respaldo].filter(Boolean) : []
  } else {
    cadena = cadenaDeEscaneo(carta, codigos.get(carta.set_id) || null, calidad, cardImageUrl)
  }
  const attrs = atributosDeEscaneo(cadena)
  return attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''
}

const portadaDe = (m) => cartas.get(m.cover_card) || cartas.get(m.cards?.[0]?.id) || null

function tarjetaHtml(m) {
  const total = (m.cards || []).reduce((s, c) => s + (c.n || 0), 0)
  const portada = portadaDe(m)
  const enlace = `/constructor?mazo=${escapeHtml(m.id)}`
  return `
    <article class="cm-mazo-tarjeta" data-id="${escapeHtml(m.id)}">
      <a class="cm-mazo-portada" href="${enlace}" aria-hidden="true" tabindex="-1">
        ${imagenDe(portada, 'high')}
        <span class="cm-mazo-portada-nombre">${portada ? escapeHtml(nombreVisible(portada)) : ''}</span>
      </a>
      <div class="cm-mazo-info">
        <a class="cm-mazo-nombre" href="${enlace}">${escapeHtml(m.name)}</a>
        <p class="cm-mazo-chapas">
          <span class="cm-chapa${total === 60 ? ' cm-chapa-completo' : ''}">${total}/60</span>
          <span class="cm-chapa">${escapeHtml(FORMATOS[m.format] || m.format)}</span>
          ${m.is_public ? '<span class="cm-chapa cm-chapa-publico">Público</span>' : '<span class="cm-chapa cm-chapa-privado">Privado</span>'}
        </p>
        <p class="cm-mazo-meta subtext">Editado ${haceCuanto(m.updated_at)}</p>
        <div class="cm-mazo-acciones">
          <a class="btn-primary cm-btn" href="${enlace}">Abrir</a>
          <a class="btn-secondary cm-btn" href="/laboratorio?mazo=${escapeHtml(m.id)}">Probar</a>
          <button type="button" class="btn-secondary cm-btn" data-portada>Portada</button>
          <button type="button" class="link-btn" data-duplicar>Duplicar</button>
          <button type="button" class="link-btn cm-mazo-borrar" data-borrar>Borrar</button>
        </div>
      </div>
    </article>`
}

function pintar() {
  $('mzCargando').classList.add('hidden')
  $('mzVacio').classList.toggle('hidden', mazos.length > 0)
  $('mzCuenta').textContent = mazos.length ? `${mazos.length} ${mazos.length === 1 ? 'mazo' : 'mazos'}` : ''
  $('mzLista').innerHTML = mazos.map(tarjetaHtml).join('')
}

// ── Elegir la portada ──
let mazoEnPortada = null
let focoAntes = null

function cerrarPortada() {
  $('mzModalPortada').classList.add('hidden')
  mazoEnPortada = null
  if (focoAntes?.isConnected) focoAntes.focus()
}

function opcionHtml(carta, actual) {
  return `<button type="button" class="cm-portada-opcion${carta.id === actual ? ' elegida' : ''}" data-elegir="${escapeHtml(carta.id)}"
    aria-pressed="${carta.id === actual}" aria-label="${escapeHtml(nombreVisible(carta))}">${imagenDe(carta)}<span class="cm-sin-imagen">${escapeHtml(nombreVisible(carta))}</span></button>`
}

async function abrirPortada(mazo, boton) {
  mazoEnPortada = mazo
  focoAntes = boton
  $('mzPortadaTitulo').textContent = `Portada de «${mazo.name}»`
  $('mzPortadaBuscar').value = ''
  $('mzPortadaResultados').innerHTML = ''
  $('mzPortadaDelMazo').innerHTML = '<p class="subtext">Cargando las cartas del mazo…</p>'
  $('mzModalPortada').classList.remove('hidden')
  $('mzPortadaCerrar').focus()
  const ids = (mazo.cards || []).map((c) => c.id)
  const faltan = ids.filter((id) => !cartas.has(id))
  if (faltan.length) for (const [id, c] of await cartasPorIds(faltan).catch(() => new Map())) cartas.set(id, c)
  if (mazoEnPortada !== mazo) return
  // Los Pokémon primero, que es casi siempre lo que se quiere de portada;
  // después entrenadores y energías.
  const entradas = (mazo.cards || []).map((c) => ({ carta: cartas.get(c.id), n: c.n })).filter((e) => e.carta)
  const s = seccionesDelMazo(entradas)
  const orden = [...s.P, ...s.T, ...s.E, ...(s.X || [])].map((e) => e.carta)
  const actual = portadaDe(mazo)?.id
  $('mzPortadaDelMazo').innerHTML = orden.length
    ? orden.map((c) => opcionHtml(c, actual)).join('')
    : '<p class="subtext">Este mazo no tiene cartas.</p>'
}

async function elegirPortada(cartaId) {
  const mazo = mazoEnPortada
  if (!mazo) return
  try {
    const fila = await cambiarPortada(mazo.id, cartaId)
    Object.assign(mazo, fila)
    if (!cartas.has(cartaId)) {
      const [c] = [...(await cartasPorIds([cartaId]).catch(() => new Map())).values()]
      if (c) cartas.set(c.id, c)
    }
    cerrarPortada()
    pintar()
    // El botón que abrió la ventana se ha repintado con la tarjeta: el
    // foco va al nuevo, que si no se queda en el aire (al principio de la
    // página para quien va con teclado).
    $('mzLista').querySelector(`[data-id="${CSS.escape(mazo.id)}"] [data-portada]`)?.focus()
    showToast('Portada cambiada.', 'success')
  } catch (err) {
    showToast(err.message || 'No se ha podido cambiar la portada.', 'error')
  }
}

let busqueda = 0
async function buscarPortada() {
  const texto = $('mzPortadaBuscar').value.trim()
  const caja = $('mzPortadaResultados')
  if (texto.length < 2) {
    caja.innerHTML = ''
    return
  }
  const yo = ++busqueda
  caja.innerHTML = '<p class="subtext">Buscando…</p>'
  try {
    const { cartas: halladas } = await buscarCartas({ texto, formato: 'libre', limite: 24 })
    if (yo !== busqueda) return
    for (const c of halladas) cartas.set(c.id, c)
    caja.innerHTML = halladas.length
      ? halladas.map((c) => opcionHtml(c, portadaDe(mazoEnPortada || {})?.id)).join('')
      : '<p class="subtext">No he encontrado cartas con ese nombre.</p>'
  } catch {
    caja.innerHTML = '<p class="subtext">No se ha podido buscar ahora mismo.</p>'
  }
}

async function iniciar() {
  const sesion = await requireAuth()
  if (!sesion) return
  try {
    const [lista, sets] = await Promise.all([misMazos(sesion.user.id), cargarSets().catch(() => null)])
    mazos = lista
    codigos = sets?.codigoDeId || new Map()
    const ids = mazos.map((m) => m.cover_card || m.cards?.[0]?.id).filter(Boolean)
    cartas = await cartasPorIds(ids).catch(() => new Map())
    pintar()
  } catch (err) {
    $('mzCargando').classList.add('hidden')
    const aviso = $('cmAviso')
    aviso.textContent = err.message || 'No se han podido cargar tus mazos.'
    aviso.classList.remove('hidden')
  }

  $('mzLista').addEventListener('click', async (e) => {
    const tarjeta = e.target.closest('[data-id]')
    if (!tarjeta) return
    const mazo = mazos.find((m) => m.id === tarjeta.dataset.id)
    if (!mazo) return
    if (e.target.closest('[data-portada]')) {
      abrirPortada(mazo, e.target.closest('[data-portada]'))
    } else if (e.target.closest('[data-borrar]')) {
      // confirm() a propósito: borrar no se puede deshacer.
      if (!window.confirm(`¿Borrar «${mazo.name}»? No se puede deshacer.`)) return
      try {
        await borrarMazo(mazo.id)
        mazos = mazos.filter((m) => m.id !== mazo.id)
        pintar()
        showToast('Mazo borrado.', 'success')
      } catch (err) {
        showToast(err.message, 'error')
      }
    } else if (e.target.closest('[data-duplicar]')) {
      try {
        const copia = await guardarMazo({ name: `${mazo.name} (copia)`.slice(0, 80), format: mazo.format, cards: mazo.cards, cover_card: mazo.cover_card, is_public: false })
        mazos.unshift(copia)
        pintar()
        showToast('Mazo duplicado.', 'success')
      } catch (err) {
        showToast(err.message, 'error')
      }
    }
  })

  const modal = $('mzModalPortada')
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-cerrar]')) return cerrarPortada()
    const opcion = e.target.closest('[data-elegir]')
    if (opcion) elegirPortada(opcion.dataset.elegir)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrarPortada()
  })
  let espera = null
  $('mzPortadaBuscar').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscarPortada, 300)
  })
}

iniciar()
