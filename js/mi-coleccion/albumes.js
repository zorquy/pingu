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
import { migasHtml } from './migas.js'
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
import { archivadorHtml, textoDePaginas, opcionesDeSalto, tapaGuardada, rejillaDe, TAPAS } from './archivador.js'
import { activarArrastre } from './arrastre.js'
import { iniciarAlbumNuevo, abrirAlbumNuevo, esDeLaNumeracion } from './album-nuevo.js'
import { variantesDeCarta, VARIANTE_POR_DEFECTO } from './variantes.js'
import { nombreDeSet, nombreDeCarta } from '../catalogo-series.js'
const $ = (id) => document.getElementById(id)
const nombreDe = (c) => nombreDeCarta(c) || 'Carta'

function traducir(error) {
  if (!error) return null
  const sin = ['PGRST202', 'PGRST205', '42P01'].includes(error.code) || /does not exist|Could not find/i.test(error.message || '')
  return new Error(sin ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message || 'No se ha podido guardar.')
}

// ── La base ──
//
// Con `*` desde la 759: las columnas del tipo (set o binder), los bolsillos,
// las páginas y la tapa llegan con supabase-migration-albumes-tipos.sql, y
// un `select` que nombra una columna que no existe falla ENTERO (la 624).
// Con `*` llegan si están y, si no, el álbum se ve como siempre.
async function misAlbumes(userId) {
  const { data, error } = await supabase.from('user_albums').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw traducir(error)
  return data || []
}
async function cargarAlbum(id) {
  const { data, error } = await supabase.from('user_albums').select('*').eq('id', id).maybeSingle()
  if (error) throw traducir(error)
  return data
}
// Lo que existía antes de la 759. Si la migración nueva no está, se crea
// con esto y nada más: un álbum de set sale como un binder, pero sale.
const BASICAS = ['nombre', 'descripcion', 'cartas', 'is_public', 'icono', 'dex_id', 'emoji', 'color']
const faltaColumna = (e) => e && (e.code === 'PGRST204' || e.code === '42703' || /column .* does not exist|Could not find the '.*' column/i.test(e.message || ''))
async function crearAlbum(fila) {
  let { data, error } = await supabase.from('user_albums').insert(fila).select('*').single()
  if (faltaColumna(error)) {
    const basica = Object.fromEntries(Object.entries(fila).filter(([k]) => BASICAS.includes(k)))
    ;({ data, error } = await supabase.from('user_albums').insert(basica).select('*').single())
  }
  if (error) throw traducir(error)
  // Sin fila no hay álbum, aunque no haya error: la RLS no da error, devuelve
  // vacío (la 510). Y quien pasa una carpeta BORRA después de crear.
  if (!data?.id) throw new Error('No se ha podido crear el álbum.')
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

// ── Meter varias desde fuera (713, C4) ──
// La selección de varias de una expansión las manda a un álbum. Las que
// ya estaban no se repiten, y lo que no cabe se dice (un álbum tiene tope).
export async function albumesParaElegir(userId) {
  return misAlbumes(userId)
}
export async function meterCartas(albumId, ids) {
  const a = await cargarAlbum(albumId)
  if (!a) throw new Error('Ese álbum ya no existe.')
  const ya = new Set((Array.isArray(a.cartas) ? a.cartas : []).map((c) => c.id))
  const nuevas = [...new Set(ids)].filter((id) => !ya.has(id))
  const caben = Math.max(0, MAX_CARTAS - ya.size)
  const entran = nuevas.slice(0, caben)
  if (entran.length) await guardarAlbum(albumId, { cartas: [...(a.cartas || []), ...entran.map((id) => ({ id }))] })
  return { nombre: a.nombre, anadidas: entran.length, yaEstaban: ids.length - nuevas.length, sinSitio: nuevas.length - entran.length }
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
// Un bolsillo con su VERSIÓN (764, Z6: «separar por versión» en un álbum
// de set) se tiene si tienes ESA versión; sin versión, cualquiera.
export function tengoElBolsillo(item, lineas) {
  if (!item?.id) return false
  return lineas.some((l) => l.card_id === item.id && (!item.v || (l.variante || VARIANTE_POR_DEFECTO) === item.v))
}
const tieneItem = (item) => tengoElBolsillo(item, ctx.lineas())
const esMio = () => Boolean(actual && ctx.sesion && actual.user_id === ctx.sesion.user.id)

// ── La lista de álbumes (759, AL1) ──
//
// UNA rejilla, como la de Holonook: «Mi colección» delante (todo lo tuyo),
// luego cada álbum —el de un set con su logo y su barra, el binder con su
// tapa y sus primeras cartas— y al final «Empezar un álbum». Las carpetas
// se fueron (PINGU: «quita la sección de carpetas, es mejor dejar solo
// álbumes») y las que había se pasan a binders solas (`pasarCarpetas`).
export const esDeSet = (a) => a?.tipo === 'set' && Boolean(a.set_id)
const conCartas = (a) => (Array.isArray(a?.cartas) ? a.cartas : []).filter((c) => c?.id)
let setsDeTodos = new Map()
const claveDeSet = (id, market) => `${market || 'WEST'}|${id}`

function cartaMiniHtml(c) {
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  return escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : '<i></i>'
}

function baldosaHtml({ atributo, clase = '', tapa = null, arriba, nombre, pie, pct = null }) {
  return `<button type="button" class="mc-albt ${clase}" ${atributo}>
    <span class="mc-albt-tapa"${tapa ? ` data-tapa="${escapeHtml(tapa)}"` : ''} aria-hidden="true">${arriba}</span>
    <span class="mc-albt-info">
      <span class="mc-albt-nombre">${escapeHtml(nombre)}</span>
      <span class="mc-albt-pie">${escapeHtml(pie)}</span>
      ${pct != null ? `<span class="mc-barra" aria-hidden="true"><i style="--ancho:${pct}%"></i></span>` : ''}
    </span>
  </button>`
}

function tarjetaHtml(a) {
  const items = conCartas(a)
  const ids = items.map((c) => c.id)
  const mias = items.filter(tieneItem).length
  const pct = ids.length ? Math.round((mias / ids.length) * 100) : 0
  if (esDeSet(a)) {
    const set = setsDeTodos.get(claveDeSet(a.set_id, a.set_market))
    const logos = set ? ctx.logosDeSet(set) : []
    const portada = cartaDe(ids[0])
    const arriba = logos.length
      ? `<span class="mc-albt-logo"><img ${atributosDeEscaneo(logos, 'this.remove()')} alt="" width="160" height="80" loading="lazy" /></span>`
      : `<span class="mc-albt-logo">${portada ? cartaMiniHtml(portada) : ''}</span>`
    return baldosaHtml({ atributo: `data-album="${escapeHtml(a.id)}"`, clase: 'mc-albt-set', arriba, nombre: a.nombre, pie: `Tienes ${mias} de ${ids.length}${a.is_public ? ' · público' : ''}`, pct })
  }
  const r = rejillaDe(a.rejilla)
  const primeras = ids.slice(0, 4).map((id) => cartaDe(id))
  // La PORTADA (764, Z4): la carta que elegiste, grande, sobre la tapa; sin
  // portada, la hojita con las cuatro primeras.
  const portada = a.portada ? cartaDe(a.portada) : null
  const arriba = portada
    ? `<span class="mc-albt-portada">${cartaMiniHtml(portada)}</span>`
    : `<span class="mc-albt-hojita">${[0, 1, 2, 3].map((i) => (primeras[i] ? cartaMiniHtml(primeras[i]) : '<i></i>')).join('')}</span>`
  const forma = a.paginas ? ` · ${r.columnas}×${r.filas}, ${a.paginas} págs.` : ''
  return baldosaHtml({
    atributo: `data-album="${escapeHtml(a.id)}"`,
    clase: 'mc-albt-binder',
    tapa: a.tapa || tapaGuardada(),
    arriba,
    nombre: a.nombre,
    pie: `${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'}${ids.length ? ` · tienes ${mias}` : ''}${forma}${a.is_public ? ' · público' : ''}`,
    pct: ids.length ? pct : null,
  })
}

// «Mi colección» como un álbum más: lo que tienes, con las tres últimas
// que has metido en abanico.
function coleccionHtml() {
  const vistas = new Set()
  const ultimas = []
  for (const l of [...ctx.lineas()].sort((x, y) => String(y.created_at || '').localeCompare(String(x.created_at || '')))) {
    if (vistas.has(l.card_id)) continue
    vistas.add(l.card_id)
    const c = ctx.cartas.get(l.card_id)
    if (c && ultimas.length < 3) ultimas.push(c)
  }
  const distintas = new Set(ctx.lineas().map((l) => l.card_id)).size
  return baldosaHtml({
    atributo: 'data-alb-coleccion',
    clase: 'mc-albt-coleccion',
    arriba: `<span class="mc-albt-abanico">${ultimas.map(cartaMiniHtml).join('')}</span>`,
    nombre: 'Mi colección',
    pie: `${distintas} ${distintas === 1 ? 'carta' : 'cartas'}`,
  })
}

function empezarHtml() {
  return `<button type="button" class="mc-albt mc-albt-nuevo" id="mcAlbNuevoAbrir">
    <span class="mc-albt-tapa" aria-hidden="true"><span class="mc-albt-mas">+</span></span>
    <span class="mc-albt-info"><span class="mc-albt-nombre">Empezar un álbum</span><span class="mc-albt-pie">De un set o a tu gusto</span></span>
  </button>`
}

// LAS CARPETAS PASAN A BINDERS (759), solas y una vez. Cada carpeta —y cada
// subcarpeta, con el nombre de su madre delante— es un binder con sus
// cartas (una vez cada una, por colección y número). Se borra la carpeta
// SOLO cuando su binder ya está escrito, y de las más hondas a las de
// arriba: borrar una madre se llevaría a sus hijas por la cascada antes de
// pasarlas. Si algo falla se para ahí y lo que queda sigue siendo carpeta.
let pasando = null
async function pasarCarpetas() {
  if (!pasando) pasando = pasarCarpetasYa().catch((err) => {
    showToast(`No se han podido pasar tus carpetas a álbumes: ${err.message}`, 'error')
    return 0
  })
  return pasando
}
async function pasarCarpetasYa() {
  const carpetas = await import('./carpetas.js')
  const lista = await carpetas.listarCarpetas()
  if (!lista?.length) return 0
  const porId = new Map(lista.map((c) => [c.id, c]))
  const ruta = (c) => {
    const nombres = []
    for (let x = c, n = 0; x && n < 50; x = porId.get(x.parent_id), n++) nombres.unshift(x.nombre)
    return nombres.join(' · ')
  }
  const orden = [...lista].sort((a, b) => carpetas.hondura(lista, b.id) - carpetas.hondura(lista, a.id))
  let hechas = 0
  for (const c of orden) {
    const lineIds = await carpetas.lineasDeCarpeta(c.id)
    let ids = []
    for (let i = 0; i < lineIds.length; i += 150) {
      const { data, error } = await supabase.from('user_collection').select('id,card_id').in('id', lineIds.slice(i, i + 150))
      if (error) throw traducir(error)
      ids.push(...(data || []).map((l) => l.card_id))
    }
    ids = [...new Set(ids)]
    const enMemoria = ids.map((id) => ctx.cartas.get(id)).filter(Boolean)
    if (enMemoria.length === ids.length) ids = enMemoria.sort((a, b) => String(a.set_id).localeCompare(String(b.set_id)) || ctx.porNumero(a, b)).map((x) => x.id)
    await crearAlbum({
      nombre: ruta(c).slice(0, 80) || 'Mi binder',
      icono: c.icono || null, dex_id: c.dex_id || null, emoji: c.emoji || null, color: c.color || null,
      cartas: ids.slice(0, MAX_CARTAS).map((id) => ({ id })),
      tipo: 'binder',
    })
    await carpetas.borrarCarpeta(c.id)
    hechas++
  }
  if (hechas) {
    showToast(hechas === 1 ? 'Tu carpeta ahora es un binder.' : `Tus ${hechas} carpetas ahora son binders.`, 'success')
    ctx.carpetasCambiadas?.()
  }
  return hechas
}

async function pintarLista() {
  $('mcAlbumesDetalle').classList.add('hidden')
  $('mcAlbumesLista').classList.remove('hidden')
  $('mcPanelCarpetas')?.classList.remove('mc-album-abierto')
  await pasarCarpetas()
  try {
    albumes = await misAlbumes(ctx.sesion.user.id)
  } catch (err) {
    $('mcAlbumesRejilla').innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  // Las portadas que no estén en la colección, de una vez: las cuatro
  // primeras de cada binder y la primera de un álbum de set (por si su logo
  // no llega).
  const faltan = albumes.flatMap((a) => [...conCartas(a).slice(0, esDeSet(a) ? 1 : 4).map((c) => c.id), a.portada].filter(Boolean)).filter((id) => !ctx.cartas.has(id) && !cartasDelAlbum.has(id))
  if (faltan.length) for (const [id, c] of await datos.cartasPorIds([...new Set(faltan)], ctx.mercado).catch(() => new Map())) cartasDelAlbum.set(id, c)
  if (albumes.some(esDeSet)) {
    const todos = await ctx.todosLosSets().catch(() => [])
    setsDeTodos = new Map(todos.map((s) => [claveDeSet(s.id, s.market), s]))
  }
  $('mcAlbumesRejilla').innerHTML = coleccionHtml() + albumes.map(tarjetaHtml).join('') + empezarHtml()
}

// Lo que sale del diálogo de «Empezar un álbum» (album-nuevo.js).
async function nuevoAlbum(pedido) {
  try {
    let fila
    if (pedido.tipo === 'set') {
      const { set, modo } = pedido
      const oficial = Number(set.card_count_official) || 0
      let lista = (await datos.cartasDeSet(set.id, set.market || ctx.mercado)).sort(ctx.porNumero)
      if (modo === 'oficial' && oficial) lista = lista.filter((c) => esDeLaNumeracion(c, oficial))
      for (const c of lista) if (!ctx.cartas.has(c.id)) cartasDelAlbum.set(c.id, c)
      fila = {
        nombre: (nombreDeSet(set) || set.id).slice(0, 80),
        cartas: (pedido.porVersion ? bolsillosPorVersion(lista) : lista.map((c) => ({ id: c.id }))).slice(0, MAX_CARTAS),
        tipo: 'set', set_id: set.id, set_market: set.market || ctx.mercado, set_modo: modo,
      }
    } else {
      fila = { nombre: pedido.nombre, cartas: [], tipo: 'binder', rejilla: pedido.rejilla, paginas: pedido.paginas, tapa: pedido.tapa }
    }
    const creada = await crearAlbum(fila)
    showToast(pedido.tipo === 'set' ? 'Álbum creado, con el set entero dentro.' : 'Binder creado.', 'success')
    await abrir(creada.id)
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
  const ids = actual.cartas.map((c) => c?.id).filter(Boolean)
  const faltan = ids.filter((id) => !ctx.cartas.has(id) && !cartasDelAlbum.has(id))
  if (faltan.length) for (const [cid, c] of await datos.cartasPorIds(faltan, ctx.mercado).catch(() => new Map())) cartasDelAlbum.set(cid, c)
  // El logo de la cabecera de un álbum de set (760): sus sets, si no están.
  if (esDeSet(actual) && !setsDeTodos.has(claveDeSet(actual.set_id, actual.set_market))) {
    const todos = await ctx.todosLosSets?.().catch(() => []) || []
    setsDeTodos = new Map(todos.map((x) => [claveDeSet(x.id, x.market), x]))
  }

  $('mcAlbumesLista').classList.add('hidden')
  $('mcAlbumesDetalle').classList.remove('hidden')
  // Dentro de un álbum, las carpetas de encima se esconden (tanda 578):
  // «Nueva carpeta» y su aviso de vacío no pintan nada ahí.
  $('mcPanelCarpetas')?.classList.add('mc-album-abierto')
  const mio = esMio() && !soloVer
  // La miga se pinta aquí porque su botón no existe hasta ahora (tanda
  // 474), y solo si el álbum es TUYO: a quien llega de fuera a ver un
  // álbum compartido, «Tus álbumes» no le lleva a ninguna parte suya.
  $('mcAlbMigas').innerHTML = mio ? migasHtml([{ texto: 'Tus álbumes', id: 'mcAlbVolver' }]) : ''
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
  // Los álbumes soñados viven dentro de «Carpetas» desde la 408, así que
  // el enlace que se copia tiene que apuntar ahí: `ver=albumes` todavía
  // llega (se redirige), pero no se SIGUE escribiendo.
  url.searchParams.set('ver', 'carpetas')
  url.searchParams.set('album', actual.id)
  history.replaceState(null, '', url)
  pintarDetalle()
  calcularLoQueFalta()
  return true
}

const CORTOS = { normal: 'Normal', reverse: 'Reverse', holo: 'Holo' }
const nombreCortoDeVersion = (v) => CORTOS[v] || v

// Un álbum de set con UNA CASILLA POR VERSIÓN (764, Z6): la normal, la
// reverse y la holo de cada carta, seguidas, con su chapa. Es como se
// completa un set «master»: no basta con tener la carta, hay que tener
// cada versión. Lo que no dice sus versiones va con una casilla.
export function bolsillosPorVersion(cartas) {
  const r = []
  for (const c of cartas) {
    const vs = variantesDeCarta(c, null)
    if (!vs || vs.length < 2) r.push({ id: c.id })
    else for (const v of vs) r.push({ id: c.id, v: v.nuestro })
  }
  return r
}

// La forma del archivador de este álbum: 3×3 si no dice otra.
const forma = () => rejillaDe(esDeSet(actual) ? '3x3' : actual?.rejilla)

// LOS HUECOS DE UN BINDER (760, AL5). PINGU, viendo Holonook: tocar un
// bolsillo vacío abre el buscador y la carta va A ESE bolsillo. Un álbum
// era una lista apretada y la carta caía al final; ahora un bolsillo vacío
// en medio es una entrada sin `id` (`{}`), y los del final no se guardan.
const esHueco = (c) => !c?.id
export function sinHuecosAlFinal(cartas) {
  const r = [...cartas]
  while (r.length && esHueco(r[r.length - 1])) r.pop()
  return r
}
// Poner una carta en el bolsillo `i`, rellenando con huecos hasta él.
export function ponerEnBolsillo(cartas, i, id) {
  const r = [...cartas]
  while (r.length < i) r.push({})
  r[i] = { id }
  return r
}
// Intercambiar dos bolsillos, aunque el de destino esté más allá del final.
export function cambiarBolsillos(cartas, de, a) {
  const r = [...cartas]
  while (r.length <= a) r.push({})
  ;[r[de], r[a]] = [r[a], r[de]]
  return sinHuecosAlFinal(r)
}
const esBinder = () => Boolean(actual) && !esDeSet(actual)

function huecoHtml(indice) {
  return `<button type="button" class="mc-bolsillo mc-bolsillo-vacio mc-bolsillo-hueco" data-hueco="${indice}" data-indice="${indice}" aria-label="Bolsillo ${indice + 1}, vacío: elegir una carta"><span aria-hidden="true">+</span></button>`
}

function cartaDe(id) {
  return ctx.cartas.get(id) || cartasDelAlbum.get(id) || null
}

function bolsilloHtml(item, indice) {
  if (esHueco(item)) return esMio() && !editando ? huecoHtml(indice) : `<span class="mc-bolsillo mc-bolsillo-vacio" data-indice="${indice}" aria-hidden="true"></span>`
  const c = cartaDe(item.id)
  const mia = ctx.sesion && actual.user_id === ctx.sesion.user.id && tieneItem(item)
  const marcar = esMio()
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const clase = `mc-bolsillo${!marcar || mia ? ' tengo' : ''}`
  const dentro = `
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" draggable="false" />` : ''}
    <span class="mc-bolsillo-num">${escapeHtml(c?.local_id || '?')}</span>
    ${marcar && mia ? '<span class="mc-tengo-marca" title="La tienes">✓</span>' : ''}
    ${item.v ? `<span class="mc-tengo-version">${escapeHtml(nombreCortoDeVersion(item.v))}</span>` : ''}
    ${actual.portada && actual.portada === item.id && !esDeSet(actual) ? '<span class="mc-alb-es-portada" title="La portada">★</span>' : ''}`
  // `draggable="false"` en la foto y en el enlace, y `data-indice` en los
  // dos modos: la carta se arrastra con el ratón también sin entrar en
  // «Ordenar y quitar» (tanda 578, js/mi-coleccion/arrastre.js).
  if (editando) {
    return `<div class="${clase} mc-bolsillo-editar" data-indice="${indice}" aria-label="${escapeHtml(nombreDe(c))}">${dentro}
      <button type="button" class="mc-bolsillo-quitar" data-quitar aria-label="Quitar del álbum">✕</button>
      ${esBinder() && 'portada' in actual ? `<button type="button" class="mc-bolsillo-portada" data-portada aria-pressed="${actual.portada === item.id}" aria-label="${actual.portada === item.id ? 'Es la portada' : 'Poner de portada'}" title="Portada">★</button>` : ''}
      <span class="mc-bolsillo-controles">
        <button type="button" data-mover="-1" aria-label="Mover antes" ${indice === 0 ? 'disabled' : ''}>←</button>
        <button type="button" data-mover="1" aria-label="Mover después" ${indice === actual.cartas.length - 1 ? 'disabled' : ''}>→</button>
      </span></div>`
  }
  return `<a class="${clase}" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}" data-indice="${indice}" draggable="false" aria-label="${escapeHtml(`${nombreDe(c)}${item.v ? ` (${nombreCortoDeVersion(item.v)})` : ''}${marcar ? (mia ? ', la tienes' : ', te falta') : ''}`)}">${dentro}</a>`
}

function pintarDetalle() {
  const todos = actual.cartas.map((item, i) => ({ item, i }))
  const lista = soloFaltan && esMio() ? todos.filter(({ item }) => !esHueco(item) && !tieneItem(item)) : todos
  const ids = actual.cartas.map((c) => c?.id).filter(Boolean)
  const mias = actual.cartas.filter(tieneItem).length
  $('mcAlbProgreso').innerHTML =
    esMio() && ids.length
      ? `<span><strong>${mias}</strong> de ${ids.length} las tienes · ${Math.round((mias / ids.length) * 100)} %</span><span class="mc-barra" aria-hidden="true"><i style="--ancho:${Math.round((mias / ids.length) * 100)}%"></i></span>`
      : `<span>${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'}</span>`
  const deUnaVez = window.matchMedia('(min-width: 900px)').matches ? 2 : 1
  // Un binder con sus páginas se abre con sus bolsillos aunque esté vacío
  // (759): es donde se meten las cartas. El aviso es para lo demás.
  const conHojas = !soloFaltan && Number(actual.paginas) > 0
  if (!lista.length && !conHojas) {
    $('mcAlbArchivador').innerHTML = `<p class="subtext">${
      ids.length ? '¡Ya las tienes todas!' : 'Este álbum está vacío. Busca cartas arriba para añadirlas.'
    }</p>`
    $('mcAlbPaginas').textContent = ''
    $('mcAlbAnterior').hidden = true
    $('mcAlbSiguiente').hidden = true
    $('mcAlbSalto')?.classList.add('hidden')
    $('mcAlbPuntos').innerHTML = ''
  } else {
    // El mismo archivador que el álbum de una colección (tanda 371): era
    // el mismo dibujo escrito dos veces y ya había empezado a separarse,
    // que es justo de lo que se quejó PINGU («en álbumes está perfecto,
    // pero en álbumes soñados debería ser igual»).
    const armado = archivadorHtml({
      lista,
      pagina,
      deUnaVez,
      // Los bolsillos y las páginas del binder (759); un álbum de set y
      // los de antes, nueve por hoja y las páginas que pidan sus cartas.
      tapa: actual.tapa || tapaGuardada(),
      porPagina: forma().porPagina,
      columnas: forma().columnas,
      paginasMin: soloFaltan ? 1 : Number(actual.paginas) || 1,
      pintarBolsillo: ({ item, i }) => bolsilloHtml(item, i),
      numeroDe: ({ item }) => (esHueco(item) ? '' : cartaDe(item.id)?.local_id ?? ''),
      // Los bolsillos vacíos del final se tocan para meter una carta AHÍ
      // (760), en un binder tuyo y con todo a la vista.
      pintarHueco: esMio() && esBinder() && !soloFaltan && !editando ? huecoHtml : null,
      conEsquinas: true,
    })
    pagina = armado.pagina
    $('mcAlbArchivador').innerHTML = armado.html
    animarPaso()
    pintarPuntos(armado.paginas, deUnaVez)
    $('mcAlbPaginas').textContent = textoDePaginas(pagina, armado.paginas, deUnaVez)
    // Las flechas se APAGAN en los extremos, como las de la tira: una
    // flecha que no lleva a ninguna parte miente (tanda 418).
    $('mcAlbAnterior').hidden = pagina === 0
    $('mcAlbSiguiente').hidden = pagina + deUnaVez >= armado.paginas
    // Y el «Ir a…», que se mudó aquí desde la expansión: en un álbum de
    // 200 cartas son 22 pliegos y pasarlos de dos en dos es media docena
    // de clics para nada. Se esconde si todo cabe en un pliego.
    const salto = $('mcAlbSalto')
    if (salto) {
      salto.innerHTML = opcionesDeSalto(armado.paginas, deUnaVez, pagina)
      salto.classList.toggle('hidden', armado.paginas <= deUnaVez)
    }
  }
  $('mcAlbAnterior').dataset.paso = String(deUnaVez)
  $('mcAlbEditar').textContent = editando ? 'Hecho' : 'Ordenar y quitar'
  $('mcAlbEditar').setAttribute('aria-pressed', String(editando))
  $('mcAlbAyuda')?.classList.toggle('hidden', !editando)
  $('mcAlbArchivador').classList.toggle('mc-ordenando', editando)
  pintarCabecera()
}

// LA CABECERA (760, AL4): el logo del set (o la tapa del binder), cuántas
// te faltan y lo que costaría completarlo, que ya calculaba
// `calcularLoQueFalta` en su línea.
function pintarCabecera() {
  const caja = $('mcAlbCabecera')
  if (!caja) return
  const set = esDeSet(actual) ? setsDeTodos.get(claveDeSet(actual.set_id, actual.set_market)) : null
  const logos = set ? ctx.logosDeSet(set) : []
  caja.classList.toggle('mc-alb-cabecera-set', Boolean(set))
  caja.classList.toggle('mc-alb-cabecera-binder', esBinder())
  if (esBinder()) caja.dataset.tapa = actual.tapa || tapaGuardada()
  else delete caja.dataset.tapa
  $('mcAlbCabeceraLogo').innerHTML = logos.length ? `<img ${atributosDeEscaneo(logos, 'this.remove()')} alt="" width="160" height="80" />` : ''
  $('mcAlbCabeceraLogo').classList.toggle('hidden', !logos.length)
}

// Pasar de página, desde las flechas, las esquinas, el teclado, el dedo y
// el «Ir a…» (760, AL4 y AL6). `paso` es ±1 pliego.
let ultimoPaso = 0
function pasarPagina(paso) {
  const deUnaVez = Number($('mcAlbAnterior').dataset.paso || 1)
  const antes = pagina
  if (paso < 0 && $('mcAlbAnterior').hidden) return
  if (paso > 0 && $('mcAlbSiguiente').hidden) return
  pagina = Math.max(0, pagina + paso * deUnaVez)
  ultimoPaso = Math.sign(pagina - antes)
  pintarDetalle()
}
// La hoja que llega entra por su lado; con «menos movimiento», sin más.
function animarPaso() {
  if (!ultimoPaso) return
  const hojas = $('mcAlbArchivador').querySelector('.mc-archivador')
  hojas?.classList.add(ultimoPaso > 0 ? 'mc-pasa-adelante' : 'mc-pasa-atras')
  ultimoPaso = 0
}
// Los puntos de debajo, uno por pliego: dónde estás de un vistazo (en el
// móvil, que pasa hoja a hoja). Son un indicador, no botones: se pasa
// deslizando o con las flechas.
function pintarPuntos(paginas, deUnaVez) {
  const pliegos = Math.ceil(paginas / deUnaVez)
  const actualP = Math.floor(pagina / deUnaVez)
  $('mcAlbPuntos').innerHTML = pliegos > 1 && pliegos <= 40
    ? Array.from({ length: pliegos }, (_, i) => `<i${i === actualP ? ' class="activo"' : ''}></i>`).join('')
    : ''
}

// La hoja para elegir la carta de un bolsillo vacío (760, AL5).
let huecoDestino = null
function abrirElegir(i) {
  huecoDestino = i
  $('mcAlbElegirTitulo').textContent = `Bolsillo ${i + 1}`
  $('mcAlbElegirBuscar').value = ''
  $('mcAlbElegirResultados').innerHTML = '<p class="mc-nota">Escribe el nombre de la carta.</p>'
  $('mcAlbElegir').showModal()
  $('mcAlbElegirBuscar').focus()
}
function ponerEnElHueco(cardId) {
  const c = ultimas.get(cardId)
  if (!c || huecoDestino == null) return
  cartasDelAlbum.set(c.id, c)
  const i = huecoDestino
  huecoDestino = null
  $('mcAlbElegir').close()
  guardarLuego({ cartas: ponerEnBolsillo(actual.cartas, i, c.id) })
  pagina = Math.floor(i / forma().porPagina)
  pintarDetalle()
  calcularLoQueFalta()
  showToast(`${nombreDe(c)}, en el bolsillo ${i + 1}.`, 'success')
}

// Intercambiar dos bolsillos, o mandar una carta al final (tanda 578).
//
// INTERCAMBIO y no inserción, a propósito: un álbum son huecos, no una
// lista. Si meter una carta en el hueco 5 corriera las cuarenta de detrás,
// cada arrastre desharía el orden que ya tenías puesto en el resto del
// pliego. Es lo mismo que hacen las flechas.
function moverCarta(de, a) {
  let cartas = [...actual.cartas]
  if (de < 0 || de >= cartas.length) return
  if (a === null) cartas.push(...cartas.splice(de, 1))
  else if (a < 0 || a >= MAX_CARTAS) return
  // Un hueco de un binder (760) es un sitio, aunque esté más allá del final.
  else cartas = cambiarBolsillos(cartas, de, a)
  guardarLuego({ cartas })
  pintarDetalle()
  calcularLoQueFalta()
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
  const faltan = [...new Set(actual.cartas.filter((c) => c?.id && !tieneItem(c)).map((c) => c.id))]
  if (!faltan.length) {
    caja.textContent = actual.cartas.some((c) => c?.id) ? 'Lo tienes completo.' : ''
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
  // «0,00 €» de un total que no se sabe es una cifra inventada (la 319):
  // si ninguna de las que faltan tiene precio, se dice eso.
  caja.textContent = total
    ? `Te faltan ${faltan.length}. Completarlo costaría unos ${euros(total)} en Cardmarket (tendencia)${sinPrecio ? `, sin contar ${sinPrecio} sin precio` : ''}.`
    : `Te faltan ${faltan.length}. Todavía no hay precio de ellas para decir cuánto costaría completarlo.`
}

function guardarLuego(cambios) {
  Object.assign(actual, cambios)
  $('mcAlbEstado').textContent = 'Guardando…'
  clearTimeout(temporizador)
  temporizador = setTimeout(async () => {
    try {
      await guardarAlbum(actual.id, { nombre: actual.nombre, descripcion: actual.descripcion || null, cartas: sinHuecosAlFinal(actual.cartas), is_public: actual.is_public, ...('tapa' in actual ? { tapa: actual.tapa } : {}), ...('portada' in actual ? { portada: actual.portada || null } : {}) })
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
// La misma búsqueda para el buscador de arriba y para la hoja de un
// bolsillo vacío (760): cambian el campo y la caja, no la consulta.
async function buscar(campo = 'mcAlbBuscar', caja = 'mcAlbResultados') {
  const texto = normalizeSearch($(campo).value)
  const mio = ++turnoBusqueda
  if (texto.length < 2) {
    $(caja).innerHTML = ''
    return
  }
  let q = supabase.from('tcg_cards').select('id,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,rarity,rarity_en,tcg_sets(id,name,name_en,serie_id,serie_name_en,release_date)').eq('market', 'WEST')
  for (const p of texto.split(/\s+/).filter(Boolean)) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(48)
  if (mio !== turnoBusqueda) return
  if (error) {
    $(caja).innerHTML = `<p class="subtext">${escapeHtml(error.message)}</p>`
    return
  }
  const lista = (data || []).filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }))
  ultimas = new Map(lista.map((c) => [c.id, c]))
  $(caja).innerHTML = lista.length
    ? lista
        .map((c) => {
          const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
          return `<button type="button" class="mc-resultado" data-carta="${escapeHtml(c.id)}" title="Añadir al álbum">
            ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
            <span class="mc-resultado-nombre">${escapeHtml(nombreDe(c))}${tengo(c.id) ? ' <span class="mc-chip">La tienes</span>' : ''}</span>
            <span class="mc-resultado-set">${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} · ${escapeHtml(c.local_id)}</span>
          </button>`
        })
        .join('')
    : '<p class="subtext">No encuentro ninguna carta con ese nombre.</p>'
}

function anadir(cardId) {
  const c = ultimas.get(cardId)
  if (!c) return
  // En un binder, al primer bolsillo vacío (760); si no hay, al final.
  const hueco = esBinder() ? actual.cartas.findIndex(esHueco) : -1
  const sitio = hueco >= 0 ? hueco : actual.cartas.length
  if (sitio >= MAX_CARTAS) return showToast(`Un álbum admite hasta ${MAX_CARTAS} cartas.`, 'error')
  cartasDelAlbum.set(c.id, c)
  guardarLuego({ cartas: ponerEnBolsillo(actual.cartas, sitio, c.id) })
  // Se salta a la página donde ha caído.
  pagina = Math.floor(sitio / forma().porPagina)
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

// La tapa de ESTE álbum (759): con la migración, cada binder lleva la suya;
// sin ella (la fila no trae `tapa`), sigue siendo la del navegador.
export function ponerTapa(id) {
  if (!actual || !esMio() || !('tapa' in actual) || !TAPAS.some((t) => t.id === id)) return false
  guardarLuego({ tapa: id })
  pintarDetalle()
  return true
}
export const tapaDelAbierto = () => (actual && !$('mcAlbumesDetalle')?.classList.contains('hidden') ? actual.tapa || null : null)

export function iniciarAlbumes(contexto) {
  ctx = contexto
  iniciarAlbumNuevo({
    sets: () => ctx.sets(),
    logosDeSet: (set) => ctx.logosDeSet(set),
    tengoDeSet: (set) => ctx.tengoDeSet?.(set) || 0,
    alCrear: nuevoAlbum,
  })
  // DELEGADO: las baldosas se pintan al abrir la pestaña (la lección de
  // la 474: un `addEventListener` sobre algo que aún no está no engancha).
  $('mcAlbumesRejilla')?.addEventListener('click', (e) => {
    if (e.target.closest('#mcAlbNuevoAbrir')) return abrirAlbumNuevo()
    if (e.target.closest('[data-alb-coleccion]')) return ctx.irA?.('cartas')
    const b = e.target.closest('[data-album]')
    if (b) abrir(b.dataset.album)
  })
  // DELEGADO, porque la miga se pinta al abrir un álbum (tanda 474): al
  // arrancar `#mcAlbVolver` todavía no existe, y un `addEventListener` sobre
  // algo que no está no engancha nada — sin dar error, que es lo peor: el
  // botón sale y no hace nada.
  $('mcAlbumesDetalle')?.addEventListener('click', (e) => {
    if (!e.target.closest('#mcAlbVolver')) return
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
  // El enlace PÚBLICO (764, Z2): al menú de compartir del sistema, que en
  // el móvil es como se manda algo; sin él, al portapapeles.
  $('mcAlbCopiar')?.addEventListener('click', async () => {
    const url = `${location.origin}/mi-coleccion?album=${actual.id}`
    try {
      if (navigator.share) await navigator.share({ title: actual.nombre, text: `Mi álbum «${actual.nombre}» en PokeDoc`, url })
      else {
        await navigator.clipboard.writeText(url)
        showToast('Enlace del álbum copiado.', 'success')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('No se ha podido compartir.', 'error')
    }
  })
  // La lista para imprimir (764, Z5): número, nombre y casilla, con lo
  // tuyo marcado. El módulo del lienzo entra al pulsar.
  $('mcAlbChecklist')?.addEventListener('click', async () => {
    const b = $('mcAlbChecklist')
    b.disabled = true
    try {
      const { compartirChecklist } = await import('./imagen-checklist.js')
      const cartas = actual.cartas.filter((c) => c?.id).map((c) => {
        const carta = cartaDe(c.id)
        return { numero: `${carta?.local_id ?? '?'}${c.v ? ` ${c.v === 'reverse' ? 'RH' : c.v === 'holo' ? 'H' : ''}`.trimEnd() : ''}`, nombre: nombreDe(carta), tengo: tieneItem(c) }
      })
      await compartirChecklist({ nombre: actual.nombre, cartas })
    } catch (err) {
      showToast(err.message || 'No se ha podido hacer la lista.', 'error')
    } finally {
      b.disabled = false
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
  $('mcAlbSalto')?.addEventListener('change', (e) => {
    pagina = Number(e.target.value) || 0
    pintarDetalle()
  })
  $('mcAlbAnterior')?.addEventListener('click', () => pasarPagina(-1))
  $('mcAlbSiguiente')?.addEventListener('click', () => pasarPagina(1))
  // Con el teclado (760): ← y →, con el álbum abierto y sin estar
  // escribiendo ni con una ventana encima.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (!actual || $('mcAlbumesDetalle')?.classList.contains('hidden') || $('mcPanelCarpetas')?.classList.contains('hidden')) return
    // `:modal` y no `[open]`: el panel de filtros del ordenador es un
    // `<dialog>` abierto siempre como columna, y no tapa nada.
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog:modal')) return
    if (e.altKey || e.ctrlKey || e.metaKey) return
    e.preventDefault()
    pasarPagina(e.key === 'ArrowLeft' ? -1 : 1)
  })
  // Deslizando con el dedo (760, AL6): un gesto de lado y no de arriba
  // abajo pasa la hoja. Pasivo: el desplazamiento vertical sigue siendo
  // del navegador. Si se está llevando una carta, el dedo es de la carta.
  let toque = null
  $('mcAlbArchivador')?.addEventListener('touchstart', (e) => {
    toque = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }, { passive: true })
  $('mcAlbArchivador')?.addEventListener('touchend', (e) => {
    const t = toque
    toque = null
    if (!t || editando || document.body.classList.contains('mc-arrastrando-carta')) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) >= 48 && Math.abs(dy) < Math.abs(dx) / 2) pasarPagina(dx < 0 ? 1 : -1)
  }, { passive: true })
  // La hoja de un bolsillo vacío.
  $('mcAlbElegirCerrar')?.addEventListener('click', () => $('mcAlbElegir').close())
  let esperaElegir = null
  $('mcAlbElegirBuscar')?.addEventListener('input', () => {
    clearTimeout(esperaElegir)
    esperaElegir = setTimeout(() => buscar('mcAlbElegirBuscar', 'mcAlbElegirResultados'), 250)
  })
  $('mcAlbElegirResultados')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-carta]')
    if (b) ponerEnElHueco(b.dataset.carta)
  })
  $('mcAlbElegir')?.addEventListener('click', (e) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close()
  })
  $('mcAlbArchivador')?.addEventListener('click', (e) => {
    const esquina = e.target.closest('[data-esquina]')
    if (esquina) return pasarPagina(esquina.dataset.esquina === 'antes' ? -1 : 1)
    const hueco = e.target.closest('[data-hueco]')
    if (hueco && esMio()) return abrirElegir(Number(hueco.dataset.hueco))
    const caja = e.target.closest('[data-indice]')
    if (!caja || !editando) return
    const i = Number(caja.dataset.indice)
    if (e.target.closest('[data-quitar]')) {
      let cartas = [...actual.cartas]
      // En un binder, quitar deja el bolsillo vacío y las demás en su
      // sitio (760); en un álbum de set, la lista se cierra.
      if (esBinder()) {
        cartas[i] = {}
        cartas = sinHuecosAlFinal(cartas)
      } else cartas.splice(i, 1)
      guardarLuego({ cartas })
      pintarDetalle()
      calcularLoQueFalta()
    } else if (e.target.closest('[data-portada]')) {
      // La portada (764): la carta de este bolsillo, o ninguna si ya lo era.
      const id = actual.cartas[i]?.id
      guardarLuego({ portada: actual.portada === id ? null : id })
      pintarDetalle()
    } else if (e.target.closest('[data-mover]')) {
      moverCarta(i, i + Number(e.target.closest('[data-mover]').dataset.mover))
    }
  })
  // Con el ratón se arrastra siempre que el álbum sea tuyo; con el dedo,
  // solo en «Ordenar y quitar», que es donde los bolsillos llevan
  // `touch-action: none` — fuera de ahí el dedo tiene que poder
  // desplazar la página (el porqué entero, en arrastre.js).
  if ($('mcAlbArchivador')) {
    activarArrastre($('mcAlbArchivador'), {
      // Un hueco con número no se coge: se suelta encima (760).
      elemento: '.mc-bolsillo[data-indice]:not(.mc-bolsillo-vacio)',
      huecos: '.mc-bolsillo-vacio',
      bordes: '#mcAlbAnterior, #mcAlbSiguiente',
      puede: (e) => esMio() && (editando || e.pointerType === 'mouse'),
      // Con el dedo, manteniendo pulsado (760, AL5).
      pulsacionLarga: 450,
      puedeLargo: () => esMio(),
      alSoltar: moverCarta,
      alBorde: (flecha) => !flecha.hidden && flecha.click(),
    })
  }
  let espera = null
  $('mcAlbBuscar')?.addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(() => buscar(), 250)
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
