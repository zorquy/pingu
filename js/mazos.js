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
import { icons } from './icons.js'
import { supabase } from './supabase.js'
import { cardImageUrl } from './tcgdex.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { misMazos, cartasPorIds, borrarMazo, guardarMazo, cambiarPortada, buscarCartas, cargarSets } from './constructor/datos.js'
import { nombreVisible, esEnergiaBasica, imagenDeEnergiaBasica, seccionesDelMazo, validarMazo } from './constructor/nucleo.js'
import { marcasLegales, nombresConReimpresionLegal } from './carta-legalidad.js'
import { tipoDelMazo, reparto, estadoDelMazo, textoDeRecord, ordenarMazos } from './mazos-nucleo.js'

const $ = (id) => document.getElementById(id)
const FORMATOS = { standard: 'Estándar', expanded: 'Expandido', libre: 'Libre' }
const icono = (nombre, t = 16) => icons[nombre]?.(t) || ''

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
let legales = ['H', 'I', 'J']
let reimpresion = new Set()
// Lo de cada mazo que se calcula aparte (836): su récord en Mis partidas
// (`match_log.user_deck_id`) y lo que te falta de tu colección.
let records = new Map() // id de mazo → { win, loss, draw }
let costes = new Map() // id de mazo → resumen de coste-mazo.js, o null si no se pudo
// Tu mazo predeterminado de Mis partidas (1070): el que sale ya puesto al
// apuntar un torneo o una partida. `ajustesEnBase` dice si la base tiene
// dónde guardarlo (supabase-migration-1070-torneos-mazo-y-puesto.sql).
let predeterminado = null
let ajustesEnBase = false
let usuario = null

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
const entradasDe = (m) => (m.cards || []).map((c) => ({ carta: cartas.get(c.id), n: c.n || 0 })).filter((e) => e.carta)
const totalDe = (m) => (m.cards || []).reduce((s, c) => s + (c.n || 0), 0)

function costeHtml(m) {
  if (!costes.has(m.id)) return '<span class="subtext">Mirando tu colección…</span>'
  const r = costes.get(m.id)
  if (!r) return ''
  if (!r.total) return 'Solo energías básicas'
  if (!r.faltan) return '<b>Lo tienes entero</b>'
  const euros = r.euros ? ` · ${r.euros.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}` : ''
  return `Faltan <b>${r.faltan}${euros}</b>`
}

function tarjetaHtml(m) {
  const entradas = entradasDe(m)
  const total = totalDe(m)
  const portada = portadaDe(m)
  const enlace = `/constructor?mazo=${escapeHtml(m.id)}`
  const v = validarMazo(entradas, { formato: m.format, legales, reimpresionLegal: reimpresion })
  const estado = estadoDelMazo(total, v.problemas.filter((p) => p.tipo !== 'total'), m.format)
  const rep = reparto(entradas)
  const ancho = (n) => (total ? Math.round((n / Math.max(total, 60)) * 1000) / 10 : 0)
  const rec = records.get(m.id)
  const tipo = tipoDelMazo(entradas, portada)
  const r = costes.get(m.id)
  return `
    <article class="cm-mazo-tarjeta" data-id="${escapeHtml(m.id)}"${tipo ? ` data-tipo="${escapeHtml(tipo)}"` : ''}>
      <a class="cm-mazo-portada" href="${enlace}" aria-hidden="true" tabindex="-1">
        ${imagenDe(portada, 'high')}
        <span class="cm-mazo-portada-chip">${escapeHtml(FORMATOS[m.format] || m.format)}</span>
        <span class="cm-mazo-portada-nombre">${portada ? escapeHtml(nombreVisible(portada)) : ''}</span>
      </a>
      <div class="cm-mazo-info">
        <a class="cm-mazo-nombre" href="${enlace}">${escapeHtml(m.name)}</a>
        <p class="cm-mazo-chapas">
          <span class="mz-chip mz-chip-${estado.clase}">${icono(estado.clase === 'ok' ? 'checkCircle' : 'triangleAlert', 12)} ${escapeHtml(estado.texto)}</span>
          <span class="mz-chip">${m.is_public ? 'Público' : 'Privado'}</span>
          ${rec ? `<span class="mz-record"><b>${textoDeRecord(rec)}</b> en tus partidas</span>` : ''}
          ${predeterminado?.user_deck_id === m.id ? `<span class="mz-chip mz-chip-predet" title="Sale ya puesto al apuntar un torneo o una partida">${icono('star', 12)} Predeterminado</span>` : ''}
        </p>
        ${total ? `<div class="mz-barra" aria-hidden="true"><i class="mz-p" style="width:${ancho(rep.P)}%"></i><i class="mz-t" style="width:${ancho(rep.T)}%"></i><i class="mz-e" style="width:${ancho(rep.E)}%"></i></div>
        <p class="mz-leyenda"><span class="mz-p">${rep.P} Pokémon</span><span class="mz-t">${rep.T} Entrenadores</span><span class="mz-e">${rep.E} Energías</span></p>` : '<p class="mz-leyenda">Todavía sin cartas</p>'}
        <p class="cm-mazo-meta subtext">Editado ${haceCuanto(m.updated_at)}</p>
      </div>
      <div class="cm-mazo-pie">
        <p class="cm-mazo-coste${r && r.total && !r.faltan ? ' entero' : ''}" data-coste-caja aria-live="polite">${costeHtml(m)}</p>
        <a class="btn-secondary cm-btn" href="/laboratorio?mazo=${escapeHtml(m.id)}">Probar</a>
        <details class="cm-mazo-mas">
          <summary class="btn-secondary cm-btn" aria-label="Más opciones de ${escapeHtml(m.name)}">${icono('moreHorizontal', 18)}</summary>
          <div class="cm-mazo-menu">
            <a href="${enlace}">${icono('edit')} Abrir</a>
            <button type="button" data-portada>${icono('image')} Portada</button>
            <button type="button" data-duplicar>${icono('layers')} Duplicar</button>
            ${ajustesEnBase ? `<button type="button" data-predeterminado>${icono('star')} ${predeterminado?.user_deck_id === m.id ? 'Quitar de predeterminado' : 'Mi mazo predeterminado'}</button>` : ''}
            <button type="button" class="cm-mazo-borrar" data-borrar>${icono('trash')} Borrar</button>
          </div>
        </details>
      </div>
    </article>`
}

function pintar() {
  $('mzCargando').classList.add('hidden')
  $('mzVacio').classList.toggle('hidden', mazos.length > 0)
  const conPartidas = mazos.some((m) => records.has(m.id))
  $('mzCuenta').textContent = mazos.length ? `${mazos.length} ${mazos.length === 1 ? 'mazo' : 'mazos'}${conPartidas && mazos.length > 1 ? ' · el que más juegas va primero' : ''}` : ''
  $('mzLista').innerHTML = ordenarMazos(mazos, records).map(tarjetaHtml).join('')
}

// El récord de cada mazo: solo las partidas que se apuntaron con ese mazo
// guardado. Sin la migración de la 627 no hay columna y no se pinta nada.
async function cargarRecords(userId) {
  const { data, error } = await supabase.from('match_log').select('user_deck_id,resultado').eq('user_id', userId).not('user_deck_id', 'is', null)
  if (error) return new Map()
  const r = new Map()
  for (const f of data || []) {
    if (!f.user_deck_id || !['win', 'loss', 'draw'].includes(f.resultado)) continue
    const x = r.get(f.user_deck_id) || { win: 0, loss: 0, draw: 0 }
    x[f.resultado]++
    r.set(f.user_deck_id, x)
  }
  return r
}

// Tu predeterminado. Si la tabla no existe todavía, no se ofrece.
async function cargarPredeterminado(userId) {
  const { data, error } = await supabase.from('match_log_ajustes').select('user_deck_id,mi_mazo,mi_mazo_nombre').eq('user_id', userId).maybeSingle()
  ajustesEnBase = !error
  predeterminado = error ? null : data || null
}

// Ponerlo o quitarlo desde el «⋯» de un mazo. Cambia YA y se deshace si la
// base dice que no (896). Desde aquí se guarda solo el mazo: su arquetipo lo
// deduce Mis partidas al abrir el formulario, de la lista que tenga entonces.
async function cambiarPredeterminado(mazo) {
  const antes = predeterminado
  const quitar = antes?.user_deck_id === mazo.id
  predeterminado = quitar ? null : { user_deck_id: mazo.id, mi_mazo: null, mi_mazo_nombre: null }
  pintar()
  const { error } = quitar
    ? await supabase.from('match_log_ajustes').delete().eq('user_id', usuario)
    : await supabase.from('match_log_ajustes').upsert({ user_id: usuario, ...predeterminado, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    predeterminado = antes
    pintar()
    showToast('No se ha podido cambiar tu mazo predeterminado: ' + error.message, 'error')
    return
  }
  showToast(quitar ? 'Ya no tienes mazo predeterminado.' : `«${mazo.name}» saldrá ya puesto al apuntar un torneo o una partida.`, 'success')
}

async function cargarCostes(userId) {
  try {
    const { costeDeVarias } = await import('./coste-mazo.js')
    const res = await costeDeVarias(mazos.map((m) => entradasDe(m).map((e) => ({ linea: { n: e.n }, carta: e.carta }))), userId)
    mazos.forEach((m, i) => costes.set(m.id, res[i]))
  } catch {
    mazos.forEach((m) => costes.set(m.id, null))
  }
  pintar()
}

// Sin mazos: los tres que más se juegan ahora, en el abanico y al lado de
// «Copiar uno del meta». Si el meta no contesta, el abanico va sin dibujos.
async function pintarVacio() {
  const cartaVacia = (tipo = '', img = '') => `<span class="mz-abanico-carta"${tipo ? ` data-tipo="${tipo}"` : ''}><span>${img || icono('cards', 40)}</span></span>`
  $('mzAbanico').innerHTML = cartaVacia() + cartaVacia() + cartaVacia()
  try {
    const [{ resumen, tiposDeEspecies }, { urlDeIcono }, { CDN_SPRITES, cadenaDeRespaldos, SALTO_DE_RESPALDO }] = await Promise.all([import('./meta/datos.js'), import('./meta/nucleo.js'), import('./torneos/sprites-pokemon.js')])
    const filas = ((await resumen(14)) || []).filter((f) => f.iconos?.length).slice(0, 3)
    if (!filas.length) return
    const tipos = tiposDeEspecies(filas)
    const img = (f, t) => {
      const url = urlDeIcono(f.iconos[0], CDN_SPRITES)
      if (!url) return ''
      const cadena = cadenaDeRespaldos(url)
      return `<img src="${url}" alt="" width="${t}" height="${t}" loading="lazy"${cadena.length ? ` data-respaldos="${cadena.join(' ')}"` : ''} onerror="${SALTO_DE_RESPALDO}" />`
    }
    const orden = [filas[1], filas[0], filas[2]].filter(Boolean)
    $('mzAbanico').innerHTML = orden.map((f) => cartaVacia(escapeHtml(tipos.get(f.arquetipo) || ''), img(f, 84))).join('')
    $('mzSpritesMeta').innerHTML = filas.map((f) => img(f, 40)).join('')
  } catch {}
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
    $('mzLista').querySelector(`[data-id="${CSS.escape(mazo.id)}"] .cm-mazo-mas summary`)?.focus()
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
  for (const el of document.querySelectorAll('[data-icono]')) el.innerHTML = icono(el.dataset.icono, el.classList.contains('mz-camino-icono') ? 20 : 16)
  const sesion = await requireAuth()
  if (!sesion) return
  try {
    usuario = sesion.user.id
    const [lista, sets, marcas, recs] = await Promise.all([misMazos(sesion.user.id), cargarSets().catch(() => null), marcasLegales().catch(() => null), cargarRecords(sesion.user.id).catch(() => new Map()), cargarPredeterminado(sesion.user.id).catch(() => {})])
    mazos = lista
    codigos = sets?.codigoDeId || new Map()
    if (Array.isArray(marcas) && marcas.length) legales = marcas
    records = recs
    const ids = mazos.flatMap((m) => [m.cover_card, ...(m.cards || []).map((c) => c.id)]).filter(Boolean)
    cartas = await cartasPorIds(ids).catch(() => new Map())
    // Una carta vieja con reimpresión legal no hace «revisar» a su mazo.
    const viejas = [...cartas.values()].filter((c) => c.regulation_mark && !legales.includes(c.regulation_mark) && !esEnergiaBasica(c))
    if (viejas.length) reimpresion = await nombresConReimpresionLegal(viejas).catch(() => new Set())
    pintar()
    if (mazos.length) cargarCostes(sesion.user.id)
    else pintarVacio()
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
    if (e.target.closest('.cm-mazo-menu button')) tarjeta.querySelector('.cm-mazo-mas')?.removeAttribute('open')
    if (e.target.closest('[data-portada]')) {
      abrirPortada(mazo, tarjeta.querySelector('.cm-mazo-mas summary'))
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
    } else if (e.target.closest('[data-predeterminado]')) {
      cambiarPredeterminado(mazo)
    } else if (e.target.closest('[data-duplicar]')) {
      try {
        const copia = await guardarMazo({ name: `${mazo.name} (copia)`.slice(0, 80), format: mazo.format, cards: mazo.cards, cover_card: mazo.cover_card, is_public: false })
        mazos.unshift(copia)
        costes.set(copia.id, costes.get(mazo.id))
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
    if (e.key !== 'Escape') return
    if (!modal.classList.contains('hidden')) return cerrarPortada()
    const abierto = document.querySelector('.cm-mazo-mas[open]')
    if (abierto) {
      abierto.removeAttribute('open')
      abierto.querySelector('summary')?.focus()
    }
  })
  // El «⋯» se cierra al tocar fuera, y solo hay uno abierto a la vez.
  document.addEventListener('click', (e) => {
    for (const d of document.querySelectorAll('.cm-mazo-mas[open]')) if (!d.contains(e.target)) d.removeAttribute('open')
  })
  let espera = null
  $('mzPortadaBuscar').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscarPortada, 300)
  })
}

iniciar()
