// Los ÁLBUMES SOÑADOS de /mi-coleccion (tanda 366).
//
// Un álbum a tu gusto: eliges las cartas (las que tienes o las que
// quieres tener) y su orden, y se ve como un archivador de nueve
// bolsillos con lo que ya es tuyo a color y marcado, lo que te falta en
// gris, y cuánto costaría completarlo según Cardmarket.
//
// Se guarda solo la lista de identificadores en orden (user_albums,
// supabase-migration-albumes.sql). Guarda solo: cada cambio se escribe a
// los pocos cientos de milisegundos, como el borrador del constructor.
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'
import { showToast } from '../toast.js'
import { normalizeSearch } from '../tcgdex.js'
import { rutaDeCarta } from '../carta-ruta.js'
// El escaneo con su respaldo (tanda 370): sin él, una carta de la que
// TCGdex no tiene imagen deja el bolsillo en blanco.
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { esDelTCG } from '../catalogo-series.js'
import { euros, valorDe, precioDe, precioDeFila } from '../cardmarket.js'
import * as datos from './datos.js'

export const FICHERO_MIGRACION = 'supabase-migration-albumes.sql'
const MAX_CARTAS = 1080
// Nueve por hoja: vive en el módulo del archivador desde la 371, que
// es quien lo usa.
import { archivadorHtml, textoDePaginas, tapaGuardada, POR_PAGINA } from './archivador.js'
const $ = (id) => document.getElementById(id)
const nombreDe = (c) => c?.name_es || c?.name || 'Carta'

function traducir(error) {
  if (!error) return null
  const sin = ['PGRST202', 'PGRST205', '42P01'].includes(error.code) || /does not exist|Could not find/i.test(error.message || '')
  return new Error(sin ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message || 'No se ha podido guardar.')
}

// ── La base ──
async function misAlbumes(userId) {
  const { data, error } = await supabase.from('user_albums').select('id,nombre,descripcion,cartas,is_public,updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw traducir(error)
  return data || []
}
async function cargarAlbum(id) {
  const { data, error } = await supabase.from('user_albums').select('id,user_id,nombre,descripcion,cartas,is_public,updated_at').eq('id', id).maybeSingle()
  if (error) throw traducir(error)
  return data
}
async function crearAlbum(fila) {
  const { data, error } = await supabase.from('user_albums').insert(fila).select('id,user_id,nombre,descripcion,cartas,is_public,updated_at').single()
  if (error) throw traducir(error)
  return data
}
async function guardarAlbum(id, cambios) {
  const { data, error } = await supabase.from('user_albums').update(cambios).eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido guardar el álbum.')
}
async function borrarAlbum(id) {
  const { data, error } = await supabase.from('user_albums').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido borrar el álbum.')
}

// ── Estado ──
let ctx = null // lo que pasa /mi-coleccion: sesión, colección, precios…
let albumes = []
let actual = null // { ...fila, cartas: [{ id }] }
let cartasDelAlbum = new Map()
let editando = false
let soloFaltan = false
let pagina = 0
let temporizador = null

function tengo(cardId) {
  return ctx.lineas().some((l) => l.card_id === cardId)
}
const esMio = () => Boolean(actual && ctx.sesion && actual.user_id === ctx.sesion.user.id)

// ── La lista de álbumes ──
function tarjetaHtml(a) {
  const ids = (a.cartas || []).map((c) => c.id)
  const portada = ctx.cartas.get(ids[0]) || cartasDelAlbum.get(ids[0])
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(portada))
  const mias = ids.filter((id) => tengo(id)).length
  const pct = ids.length ? Math.round((mias / ids.length) * 100) : 0
  return `
    <button type="button" class="mc-album-tarjeta" data-album="${escapeHtml(a.id)}">
      <span class="mc-album-portada">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      <span class="mc-album-info">
        <strong>${escapeHtml(a.nombre)}</strong>
        <span class="mc-album-cuenta">${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'} · tienes ${mias} (${pct} %)</span>
        ${a.is_public ? '<span class="mc-chip">Público</span>' : ''}
      </span>
    </button>`
}

async function pintarLista() {
  $('mcAlbumesDetalle').classList.add('hidden')
  $('mcAlbumesLista').classList.remove('hidden')
  try {
    albumes = await misAlbumes(ctx.sesion.user.id)
  } catch (err) {
    $('mcAlbumesRejilla').innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  // Las portadas que no estén en la colección, de una vez.
  const faltan = albumes.map((a) => a.cartas?.[0]?.id).filter((id) => id && !ctx.cartas.has(id) && !cartasDelAlbum.has(id))
  if (faltan.length) for (const [id, c] of await datos.cartasPorIds(faltan).catch(() => new Map())) cartasDelAlbum.set(id, c)
  $('mcAlbumesRejilla').innerHTML = albumes.map(tarjetaHtml).join('')
  $('mcAlbumesVacio').classList.toggle('hidden', albumes.length > 0)
}

async function nuevoAlbum(e) {
  e.preventDefault()
  const nombre = $('mcAlbNombre').value.trim().slice(0, 80) || 'Mi álbum'
  const origen = $('mcAlbOrigen').value
  let ids = []
  try {
    if (origen === 'mias') {
      // Tus cartas, una vez cada una, por colección y número: como las
      // ordenarías en un archivador.
      const vistas = new Set()
      const orden = [...ctx.lineas()]
        .map((l) => ctx.cartas.get(l.card_id))
        .filter(Boolean)
        .sort((a, b) => String(b.tcg_sets?.release_date || '').localeCompare(String(a.tcg_sets?.release_date || '')) || String(a.set_id).localeCompare(String(b.set_id)) || ctx.porNumero(a, b))
      for (const c of orden) if (!vistas.has(c.id)) vistas.add(c.id) && ids.push(c.id)
    } else if (origen === 'set') {
      const setId = $('mcAlbSet').value
      if (setId) ids = (await datos.cartasDeSet(setId)).sort(ctx.porNumero).map((c) => c.id)
    }
    const fila = await crearAlbum({ nombre, cartas: ids.slice(0, MAX_CARTAS).map((id) => ({ id })) })
    $('mcAlbNuevo').classList.add('hidden')
    $('mcAlbNombre').value = ''
    showToast('Álbum creado.', 'success')
    await abrir(fila.id)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// ── Un álbum ──
export async function abrir(id, { soloVer = false } = {}) {
  let fila
  try {
    fila = await cargarAlbum(id)
  } catch (err) {
    showToast(err.message, 'error')
    return false
  }
  if (!fila) return false
  actual = { ...fila, cartas: Array.isArray(fila.cartas) ? fila.cartas : [] }
  editando = false
  soloFaltan = false
  pagina = 0
  const ids = actual.cartas.map((c) => c.id)
  const faltan = ids.filter((id) => !ctx.cartas.has(id) && !cartasDelAlbum.has(id))
  if (faltan.length) for (const [cid, c] of await datos.cartasPorIds(faltan).catch(() => new Map())) cartasDelAlbum.set(cid, c)

  $('mcAlbumesLista').classList.add('hidden')
  $('mcAlbumesDetalle').classList.remove('hidden')
  const mio = esMio() && !soloVer
  $('mcAlbVolver').classList.toggle('hidden', !mio)
  $('mcAlbTitulo').value = actual.nombre
  $('mcAlbTitulo').readOnly = !mio
  $('mcAlbDescripcion').value = actual.descripcion || ''
  $('mcAlbDescripcion').readOnly = !mio
  $('mcAlbDescripcion').classList.toggle('hidden', !mio && !actual.descripcion)
  $('mcAlbHerramientas').classList.toggle('hidden', !mio)
  $('mcAlbBorrar').closest('p').classList.toggle('hidden', !mio)
  $('mcAlbPublico').checked = Boolean(actual.is_public)
  $('mcAlbCopiar').classList.toggle('hidden', !actual.is_public)
  const url = new URL(location.href)
  url.searchParams.set('ver', 'albumes')
  url.searchParams.set('album', actual.id)
  history.replaceState(null, '', url)
  pintarDetalle()
  calcularLoQueFalta()
  return true
}

function cartaDe(id) {
  return ctx.cartas.get(id) || cartasDelAlbum.get(id) || null
}

function bolsilloHtml(item, indice) {
  const c = cartaDe(item.id)
  const mia = ctx.sesion && actual.user_id === ctx.sesion.user.id && tengo(item.id)
  const marcar = esMio()
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const clase = `mc-bolsillo${!marcar || mia ? ' tengo' : ''}`
  const dentro = `
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    <span class="mc-bolsillo-num">${escapeHtml(c?.local_id || '?')}</span>
    ${marcar && mia ? '<span class="mc-tengo-marca" title="La tienes">✓</span>' : ''}`
  if (editando) {
    return `<div class="${clase} mc-bolsillo-editar" data-indice="${indice}" aria-label="${escapeHtml(nombreDe(c))}">${dentro}
      <span class="mc-bolsillo-controles">
        <button type="button" data-mover="-1" aria-label="Mover antes" ${indice === 0 ? 'disabled' : ''}>←</button>
        <button type="button" data-quitar aria-label="Quitar del álbum">✕</button>
        <button type="button" data-mover="1" aria-label="Mover después" ${indice === actual.cartas.length - 1 ? 'disabled' : ''}>→</button>
      </span></div>`
  }
  return `<a class="${clase}" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}" aria-label="${escapeHtml(`${nombreDe(c)}${marcar ? (mia ? ', la tienes' : ', te falta') : ''}`)}">${dentro}</a>`
}

function pintarDetalle() {
  const todos = actual.cartas.map((item, i) => ({ item, i }))
  const lista = soloFaltan && esMio() ? todos.filter(({ item }) => !tengo(item.id)) : todos
  const ids = actual.cartas.map((c) => c.id)
  const mias = ids.filter((id) => tengo(id)).length
  $('mcAlbProgreso').innerHTML =
    esMio() && ids.length
      ? `<span><strong>${mias}</strong> de ${ids.length} las tienes · ${Math.round((mias / ids.length) * 100)} %</span><span class="mc-barra" aria-hidden="true"><i style="--ancho:${Math.round((mias / ids.length) * 100)}%"></i></span>`
      : `<span>${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'}</span>`
  const deUnaVez = window.matchMedia('(min-width: 900px)').matches ? 2 : 1
  if (!lista.length) {
    $('mcAlbArchivador').innerHTML = `<p class="subtext">${
      actual.cartas.length ? '¡Ya las tienes todas!' : 'Este álbum está vacío. Busca cartas arriba para añadirlas.'
    }</p>`
    $('mcAlbPaginas').textContent = ''
    $('mcAlbAnterior').disabled = true
    $('mcAlbSiguiente').disabled = true
  } else {
    // El mismo archivador que el álbum de una colección (tanda 371): era
    // el mismo dibujo escrito dos veces y ya había empezado a separarse,
    // que es justo de lo que se quejó PINGU («en álbumes está perfecto,
    // pero en álbumes soñados debería ser igual»).
    const armado = archivadorHtml({
      lista,
      pagina,
      deUnaVez,
      tapa: tapaGuardada(),
      pintarBolsillo: ({ item, i }) => bolsilloHtml(item, i),
      numeroDe: ({ item }) => cartaDe(item.id)?.local_id ?? '',
    })
    pagina = armado.pagina
    $('mcAlbArchivador').innerHTML = armado.html
    $('mcAlbPaginas').textContent = textoDePaginas(pagina, armado.paginas, deUnaVez)
    $('mcAlbAnterior').disabled = pagina === 0
    $('mcAlbSiguiente').disabled = pagina + deUnaVez >= armado.paginas
  }
  $('mcAlbAnterior').dataset.paso = String(deUnaVez)
  $('mcAlbEditar').textContent = editando ? 'Hecho' : 'Ordenar y quitar'
}

// Cuánto costaría completarlo: la tendencia de Cardmarket de cada carta
// que te falta. Las que están en la colección de alguien tienen precio
// guardado; el resto se pide a TCGdex, con tope (es una petición por
// carta a un servicio gratuito).
const EN_VIVO = 60
let turnoFalta = 0
async function calcularLoQueFalta() {
  const caja = $('mcAlbFalta')
  if (!esMio()) {
    caja.textContent = ''
    return
  }
  const mio = ++turnoFalta
  const faltan = [...new Set(actual.cartas.map((c) => c.id).filter((id) => !tengo(id)))]
  if (!faltan.length) {
    caja.textContent = actual.cartas.length ? 'Lo tienes completo.' : ''
    return
  }
  caja.textContent = `Te faltan ${faltan.length}. Calculando cuánto costaría completarlo…`
  const guardados = await datos.preciosGuardados(faltan).catch(() => new Map())
  let total = 0
  let sinPrecio = 0
  const vivas = faltan.filter((id) => !guardados.has(id)).slice(0, EN_VIVO)
  const vivos = new Map()
  await Promise.all(vivas.map(async (id) => vivos.set(id, await datos.preciosEnVivo(id))))
  if (mio !== turnoFalta) return
  for (const id of faltan) {
    const p = guardados.has(id) ? precioDeFila(guardados.get(id)) : precioDe(vivos.get(id)?.pricing)
    const v = valorDe(p)
    if (v) total += v
    else sinPrecio++
  }
  caja.textContent = `Te faltan ${faltan.length}. Completarlo costaría unos ${euros(total)} en Cardmarket (tendencia)${sinPrecio ? `, sin contar ${sinPrecio} sin precio` : ''}.`
}

function guardarLuego(cambios) {
  Object.assign(actual, cambios)
  $('mcAlbEstado').textContent = 'Guardando…'
  clearTimeout(temporizador)
  temporizador = setTimeout(async () => {
    try {
      await guardarAlbum(actual.id, { nombre: actual.nombre, descripcion: actual.descripcion || null, cartas: actual.cartas, is_public: actual.is_public })
      $('mcAlbEstado').textContent = 'Guardado'
    } catch (err) {
      $('mcAlbEstado').textContent = ''
      showToast(err.message, 'error')
    }
  }, 500)
}

// ── Añadir cartas al álbum ──
let turnoBusqueda = 0
let ultimas = new Map()
async function buscar() {
  const texto = normalizeSearch($('mcAlbBuscar').value)
  const mio = ++turnoBusqueda
  if (texto.length < 2) {
    $('mcAlbResultados').innerHTML = ''
    return
  }
  let q = supabase.from('tcg_cards').select('id,set_id,local_id,name,name_es,image_path,rarity,tcg_sets(id,name,serie_id,release_date)').eq('market', 'WEST')
  for (const p of texto.split(/\s+/).filter(Boolean)) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(48)
  if (mio !== turnoBusqueda) return
  if (error) {
    $('mcAlbResultados').innerHTML = `<p class="subtext">${escapeHtml(error.message)}</p>`
    return
  }
  const lista = (data || []).filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }))
  ultimas = new Map(lista.map((c) => [c.id, c]))
  $('mcAlbResultados').innerHTML = lista.length
    ? lista
        .map((c) => {
          const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
          return `<button type="button" class="mc-resultado" data-carta="${escapeHtml(c.id)}" title="Añadir al álbum">
            ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
            <span class="mc-resultado-nombre">${escapeHtml(nombreDe(c))}${tengo(c.id) ? ' <span class="mc-chip">La tienes</span>' : ''}</span>
            <span class="mc-resultado-set">${escapeHtml(c.tcg_sets?.name || c.set_id)} · ${escapeHtml(c.local_id)}</span>
          </button>`
        })
        .join('')
    : '<p class="subtext">No encuentro ninguna carta con ese nombre.</p>'
}

function anadir(cardId) {
  const c = ultimas.get(cardId)
  if (!c) return
  if (actual.cartas.length >= MAX_CARTAS) return showToast(`Un álbum admite hasta ${MAX_CARTAS} cartas.`, 'error')
  cartasDelAlbum.set(c.id, c)
  guardarLuego({ cartas: [...actual.cartas, { id: c.id }] })
  // Se salta a la última página, que es donde ha caído.
  pagina = Math.floor((actual.cartas.length - 1) / POR_PAGINA)
  pintarDetalle()
  calcularLoQueFalta()
  showToast(`${nombreDe(c)} añadida al álbum.`, 'success')
}

// ── Enganches ──
// Repintar lo que haya abierto, sin volver a pedir nada. Lo usa el
// color de la tapa (tanda 371), que es una preferencia de pantalla y no
// un dato: cambiarla no tiene por qué recargar el álbum.
export function repintar() {
  if (actual) pintarDetalle()
}

export function iniciarAlbumes(contexto) {
  ctx = contexto
  $('mcAlbNuevoAbrir')?.addEventListener('click', async () => {
    $('mcAlbNuevo').classList.toggle('hidden')
    const sets = await ctx.sets()
    $('mcAlbSet').innerHTML = sets.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')
    $('mcAlbNombre').focus()
  })
  $('mcAlbOrigen')?.addEventListener('change', (e) => $('mcAlbSetCampo').classList.toggle('hidden', e.target.value !== 'set'))
  $('mcAlbNuevo')?.addEventListener('submit', nuevoAlbum)
  $('mcAlbumesRejilla')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-album]')
    if (b) abrir(b.dataset.album)
  })
  $('mcAlbVolver')?.addEventListener('click', () => {
    const url = new URL(location.href)
    url.searchParams.delete('album')
    history.replaceState(null, '', url)
    pintarLista()
  })
  $('mcAlbTitulo')?.addEventListener('input', (e) => esMio() && guardarLuego({ nombre: e.target.value.trim().slice(0, 80) || 'Mi álbum' }))
  $('mcAlbDescripcion')?.addEventListener('input', (e) => esMio() && guardarLuego({ descripcion: e.target.value.slice(0, 500) }))
  $('mcAlbPublico')?.addEventListener('change', (e) => {
    guardarLuego({ is_public: e.target.checked })
    $('mcAlbCopiar').classList.toggle('hidden', !e.target.checked)
  })
  $('mcAlbCopiar')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/mi-coleccion?album=${actual.id}`)
      showToast('Enlace del álbum copiado.', 'success')
    } catch {
      showToast('No se ha podido copiar.', 'error')
    }
  })
  $('mcAlbBorrar')?.addEventListener('click', async () => {
    // confirm() a propósito, como en /mazos: no se puede deshacer.
    if (!window.confirm(`¿Borrar el álbum «${actual.nombre}»? Tus cartas no se tocan.`)) return
    try {
      await borrarAlbum(actual.id)
      showToast('Álbum borrado.', 'success')
      const url = new URL(location.href)
      url.searchParams.delete('album')
      history.replaceState(null, '', url)
      pintarLista()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
  $('mcAlbEditar')?.addEventListener('click', () => {
    editando = !editando
    pintarDetalle()
  })
  $('mcAlbSoloFaltan')?.addEventListener('change', (e) => {
    soloFaltan = e.target.checked
    pagina = 0
    pintarDetalle()
  })
  $('mcAlbAnterior')?.addEventListener('click', () => {
    pagina = Math.max(0, pagina - Number($('mcAlbAnterior').dataset.paso || 1))
    pintarDetalle()
  })
  $('mcAlbSiguiente')?.addEventListener('click', () => {
    pagina += Number($('mcAlbAnterior').dataset.paso || 1)
    pintarDetalle()
  })
  $('mcAlbArchivador')?.addEventListener('click', (e) => {
    const caja = e.target.closest('[data-indice]')
    if (!caja || !editando) return
    const i = Number(caja.dataset.indice)
    const cartas = [...actual.cartas]
    if (e.target.closest('[data-quitar]')) {
      cartas.splice(i, 1)
    } else if (e.target.closest('[data-mover]')) {
      const j = i + Number(e.target.closest('[data-mover]').dataset.mover)
      if (j < 0 || j >= cartas.length) return
      ;[cartas[i], cartas[j]] = [cartas[j], cartas[i]]
    } else return
    guardarLuego({ cartas })
    pintarDetalle()
    calcularLoQueFalta()
  })
  let espera = null
  $('mcAlbBuscar')?.addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 250)
  })
  $('mcAlbResultados')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-carta]')
    if (b) anadir(b.dataset.carta)
  })
  window.addEventListener('resize', () => actual && !$('mcAlbumesDetalle').classList.contains('hidden') && pintarDetalle())
}

// La pestaña al abrirse: la lista, o el álbum que diga la dirección.
export async function entrar(idDeLaUrl) {
  if (idDeLaUrl && (await abrir(idDeLaUrl))) return
  await pintarLista()
}

// Para /mi-coleccion?album=<id> de OTRA persona: el álbum y nada más.
export async function cargarParaVer(id) {
  return cargarAlbum(id).catch(() => null)
}
