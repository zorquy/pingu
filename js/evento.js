// El modo evento (tanda 794 como «feria», 1029): tu QR y tus listas de
// «busco» y «doy» EN CARTAS, guardadas en el móvil con sus fotos. En un
// pabellón no hay cobertura: si no se puede preguntar, se enseña lo último
// que se guardó y cuándo. El QR lleva a /evento/<usuario>: la ficha de esa
// persona abierta por Cambios, que ve cualquiera (1030).
import { supabase } from './supabase.js'
import { getSession, getProfile, escapeHtml, avatarStyle, getInitial } from './app.js'
import { icons } from './icons.js'
import { normalizeSearch } from './texto.js'
import { precioDeFila, valorDe, valorDeLinea } from './cardmarket.js'
import { showToast } from './toast.js'
import { svgQR } from './qr.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'
import { conVariante } from './deseo-version.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'

const $ = (id) => document.getElementById(id)
// Clave nueva (1029): lo guardado por la feria eran nombres sin foto.
const CLAVE = 'pd-evento-v2'
const CACHE_FOTOS = 'pokedoc-evento-fotos'
const TOPE = 500

export function enlaceDeEvento(perfil, origen = 'https://pokedoc.es') {
  return perfil?.username ? `${origen}/evento/${encodeURIComponent(perfil.username)}` : `${origen}/usuario.html?id=${encodeURIComponent(perfil?.id || '')}&cruce=1&ver=cambios`
}
export const enlaceDeFeria = enlaceDeEvento

// El texto que se copia o se comparte: una línea por carta, con su número y
// las copias. Sin HTML: va a un chat o a una nota.
export function textoDeLista(titulo, filas) {
  return [titulo, ...filas.map((f) => `• ${f.nombre}${f.num ? ` (${f.num})` : ''}${f.n > 1 ? ` ×${f.n}` : ''}`)].join('\n')
}

function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null') } catch { return null }
}
function guardar(d) {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch {}
}

// `user_wants` NO tiene columna `market` (la 624: pedirla rompe la consulta
// ENTERA, y así salió la primera 1029 en producción): lo que busca alguien
// se resuelve primero en el occidental y lo que no aparece, en el japonés.
async function fichas(lineas) {
  const { cartasPorClaves, claveDeCarta } = await import('./mi-coleccion/datos.js')
  const mapa = await cartasPorClaves(lineas)
  const sinFicha = lineas.filter((l) => !l.market && !mapa.has(claveDeCarta(l.card_id, null)))
  if (sinFicha.length) for (const [k, c] of await cartasPorClaves(sinFicha.map((l) => ({ ...l, market: 'JP' })))) mapa.set(k, c)
  return (l) => mapa.get(claveDeCarta(l.card_id, l.market)) || mapa.get(claveDeCarta(l.card_id, 'JP')) || null
}

// Cada fila lleva lo justo para pintarse sin red: nombre, número, la
// dirección de la foto (la primera de la cadena, que es la que se guarda) y
// la carta entera para la imagen y el CSV.
// Desde la 1042 también la expansión (para filtrar y ordenar) y el precio,
// calculado AQUÍ y guardado con lo demás: sin cobertura también se ve.
// La versión va con el número (1047): «SVP 205 · Holo». De lo que das, si no
// es la normal; de lo que buscas, la que pides (`deseo`).
function fila(l, carta, precio = null, { deseo = false } = {}) {
  const c = carta || { id: l.card_id, market: l.market, local_id: '' }
  const cadena = c.set_id ? cadenaDeEscaneo(c) : []
  const version = l.variante && (deseo || l.variante !== 'normal') ? nombreDeVariante(l.variante) : ''
  const num = [carta ? `${carta.tcg_sets?.tcg_online_code || carta.set_id} ${carta.local_id}` : '', version].filter(Boolean).join(' · ')
  return { id: l.card_id, market: c.market || l.market || 'WEST', n: l.cambio || l.cantidad || 1, idioma: l.idioma || null, nombre: carta ? nombreDeCarta(carta) : l.card_id, num, set: carta ? nombreDeSet(carta.tcg_sets) || carta.set_id : '', setDia: carta?.tcg_sets?.release_date || '', local: carta?.local_id || '', precio, foto: cadena[0] || '', cadena, carta: c, ruta: rutaDeCarta(c) }
}

// Lo que se ve de una lista (1042): el texto busca en nombre, número y
// expansión; el orden por defecto, por expansión (la más nueva primero).
export function filtrarLista(filas = [], { texto = '', catalogo = '', set = '', orden = 'set' } = {}) {
  const q = normalizeSearch(texto || '')
  const dentro = filas.filter((f) =>
    (!catalogo || (catalogo === 'JP' ? f.market === 'JP' : f.market !== 'JP')) &&
    (!set || f.set === set) &&
    (!q || normalizeSearch(`${f.nombre} ${f.num} ${f.set}`).includes(q)))
  const porNumero = (a, b) => String(a.local).localeCompare(String(b.local), 'es', { numeric: true })
  const cmp = {
    nombre: (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es') || porNumero(a, b),
    caras: (a, b) => (b.precio ?? -1) - (a.precio ?? -1) || String(a.nombre).localeCompare(String(b.nombre), 'es'),
    set: (a, b) => String(b.setDia).localeCompare(String(a.setDia)) || String(a.set).localeCompare(String(b.set), 'es') || porNumero(a, b),
  }[orden] || (() => 0)
  return [...dentro].sort(cmp)
}

const euros = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

async function pedir(sesion) {
  const perfil = await getProfile(sesion.user.id)
  const [{ data: doy, error: e1 }, { data: busco, error: e2 }] = await Promise.all([
    supabase.from('user_collection').select('card_id,market,cambio,idioma,variante').eq('user_id', sesion.user.id).gt('cambio', 0).limit(TOPE),
    conVariante('card_id,idioma', (cols) => supabase.from('user_wants').select(cols).eq('user_id', sesion.user.id).limit(TOPE)),
  ])
  if (e1 || e2) throw e1 || e2
  const cartaDe = await fichas([...(doy || []), ...(busco || [])])
  // El precio que se enseña es el de la ficha: el de SU idioma (900).
  const { preciosGuardados } = await import('./mi-coleccion/datos.js')
  const precios = await preciosGuardados([...(doy || []), ...(busco || [])].map((l) => l.card_id)).catch(() => new Map())
  const deDoy = (l) => valorDeLinea({ idioma: l.idioma, cantidad: 1 }, precioDeFila(precios.get(l.card_id), { variante: l.variante }))
  const deBusco = (l) => valorDe(precioDeFila(precios.get(l.card_id)), l.idioma || null)
  return {
    cuando: new Date().toISOString(),
    enlace: enlaceDeEvento(perfil),
    nombre: perfil?.display_name || perfil?.username || '',
    usuario: perfil?.username || '',
    perfil: { id: perfil?.id || sesion.user.id, username: perfil?.username || null, display_name: perfil?.display_name || null, avatar_url: perfil?.avatar_url || null },
    doy: (doy || []).map((l) => fila(l, cartaDe(l), deDoy(l))),
    busco: (busco || []).map((l) => fila(l, cartaDe(l), deBusco(l), { deseo: true })),
  }
}

// Las fotos, guardadas en la Cache API «a ciegas» (no-cors): la respuesta es
// opaca pero el navegador la sirve igual al <img>. Se piden en segundo plano
// y de pocas en pocas, para no pelearse con la página.
async function guardarFotos(d) {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(CACHE_FOTOS)
    const urls = [...new Set([...d.busco, ...d.doy].map((f) => f.foto).filter(Boolean))]
    const ya = new Set((await cache.keys()).map((r) => r.url))
    const faltan = urls.filter((u) => !ya.has(u))
    for (let i = 0; i < faltan.length; i += 6) {
      await Promise.all(faltan.slice(i, i + 6).map((u) => fetch(u, { mode: 'no-cors' }).then((r) => cache.put(u, r)).catch(() => {})))
    }
    for (const r of await cache.keys()) if (!urls.includes(r.url)) await cache.delete(r)
  } catch { /* sin caché de fotos, la página sigue */ }
}

let datos = null
let lista = 'busco'
const filtro = { texto: '', catalogo: '', set: '', orden: 'set' }

function cartaHtml(f) {
  const foto = f.cadena?.length ? `<img ${atributosDeEscaneo(f.cadena)} alt="" width="245" height="342" loading="lazy" />` : '<span class="evento-sinfoto"></span>'
  return `<li><a class="evento-carta" href="${escapeHtml(f.ruta || '#')}">${foto}${f.n > 1 ? `<span class="evento-cuantas">×${f.n}</span>` : ''}<b>${escapeHtml(f.nombre)}</b>${f.num ? `<small>${escapeHtml(f.num)}</small>` : ''}<em class="evento-precio">${f.precio ? escapeHtml(euros(f.precio)) : 'Sin precio'}</em></a></li>`
}

// Occidental y japonés, cada uno con su rótulo (1033); con uno solo, sin rótulo.
function listaHtml(filas) {
  const jp = filas.filter((f) => f.market === 'JP')
  const occ = filas.filter((f) => f.market !== 'JP')
  if (!jp.length || !occ.length) return filas.map(cartaHtml).join('')
  const rotulo = (m, n) => `<li class="evento-rotulo"><span>${m === 'JP' ? 'Pokémon Japón' : 'Pokémon'}</span><small>${n}</small></li>`
  return `${rotulo('WEST', occ.length)}${occ.map(cartaHtml).join('')}${rotulo('JP', jp.length)}${jp.map(cartaHtml).join('')}`
}

// Los desplegables se rehacen con lo que hay en la lista abierta: una
// expansión que no tiene ninguna carta no se ofrece.
function pintarFiltros(filas) {
  const sets = new Map()
  for (const f of filas) if (f.set) sets.set(f.set, (sets.get(f.set) || 0) + 1)
  if (filtro.set && !sets.has(filtro.set)) filtro.set = ''
  $('eventoSet').innerHTML = `<option value="">Todas</option>${[...sets].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([n, k]) => `<option value="${escapeHtml(n)}"${n === filtro.set ? ' selected' : ''}>${escapeHtml(n)} (${k})</option>`).join('')}`
  const dos = filas.some((f) => f.market === 'JP') && filas.some((f) => f.market !== 'JP')
  $('eventoOpCatalogo').classList.toggle('hidden', !dos)
  if (!dos) filtro.catalogo = ''
  for (const [id, campo] of [['eventoCatalogo', 'catalogo'], ['eventoSet', 'set'], ['eventoOrden', 'orden']]) {
    const sel = $(id)
    sel.value = filtro[campo]
    sel.closest('.evento-op')?.classList.toggle('cambiada', sel.value !== sel.options[0]?.value)
  }
}

function pintarLista() {
  const filas = datos?.[lista] || []
  for (const b of document.querySelectorAll('.evento-pestanas [data-lista]')) b.setAttribute('aria-pressed', String(b.dataset.lista === lista))
  pintarFiltros(filas)
  const vistas = filtrarLista(filas, filtro)
  const filtrando = vistas.length !== filas.length
  $('eventoCuantas').textContent = filas.length && filtrando ? `${vistas.length} de ${filas.length}` : ''
  $('eventoLista').innerHTML = !filas.length
    ? `<li class="evento-vacia">${lista === 'busco' ? 'Nada en La quiero: apunta lo que buscas desde Deseos y cambios.' : 'Nada apuntado para dar: marca «De esas, doy» en tus cartas.'}</li>`
    : vistas.length ? listaHtml(vistas) : '<li class="evento-vacia">Ninguna carta de la lista casa con lo que buscas.</li>'
  for (const b of ['eventoCopiar', 'eventoImagen', 'eventoExportar']) { const el = $(b); if (el) el.disabled = !filas.length }
}

// El pase (1042): el QR en su recuadro blanco —el blanco es lo que hace que
// se lea—, con quién eres y la marca encima, nunca dentro del código.
function paseHtml(d) {
  const p = d.perfil || { username: d.usuario, display_name: d.nombre }
  return `<div class="evento-pase-cab">
      <span class="evento-pase-av" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(d.nombre || d.usuario || '?'))}</span>
      <span class="evento-pase-quien"><strong>${escapeHtml(d.nombre)}</strong>${d.usuario ? `<small>@${escapeHtml(d.usuario)}</small>` : ''}</span>
      <span class="evento-pase-marca" aria-hidden="true">Poke<span>Doc</span></span>
    </div>
    <div class="evento-pase-qr">${svgQR(d.enlace, { tam: 220 })}</div>
    <p class="evento-pase-lema">Escanéame para ver mis cartas</p>
    <p class="evento-pase-cifras"><span><b>${d.busco.length}</b> busco</span><span><b>${d.doy.length}</b> doy</span></p>`
}

function pintar(d, desdeGuardado) {
  datos = d
  $('eventoQr').innerHTML = paseHtml(d)
  $('eventoAmpliar').classList.remove('hidden')
  $('eventoNBusco').textContent = String(d.busco.length)
  $('eventoNDoy').textContent = String(d.doy.length)
  const cuando = new Date(d.cuando).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  $('eventoGuardado').textContent = desdeGuardado ? `Sin conexión: tus listas tal como estaban el ${cuando}.` : `Guardado en este móvil (${cuando}).`
  $('eventoListas').classList.remove('hidden')
  pintarLista()
}

const titulo = () => (lista === 'busco' ? 'Las que busco' : 'Las que doy')

async function copiar() {
  const texto = textoDeLista(`${titulo()} · ${datos.nombre}`, datos[lista]) + `\n${datos.enlace}`
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: titulo(), text: texto })
    else { await navigator.clipboard.writeText(texto); showToast('Lista copiada: pégala donde quieras.', 'success') }
  } catch (err) {
    if (err?.name !== 'AbortError') showToast('No se ha podido copiar.', 'error')
  }
}

async function imagen() {
  const b = $('eventoImagen')
  b.disabled = true
  try {
    const { compartirLaQuiero } = await import('./mi-coleccion/imagen-quiero.js')
    const busco = lista === 'busco'
    await compartirLaQuiero({ cartas: datos[lista].map((f) => ({ carta: f.carta, idioma: f.idioma })), nombre: datos.usuario, titulo: busco ? 'Las que quiero' : 'Las que doy', fichero: busco ? 'la-quiero' : 'las-doy', texto: `${busco ? 'Las cartas que busco. ¿Tienes alguna?' : 'Las cartas que doy. ¿Te interesa alguna?'} Mis listas: ${datos.enlace}` })
  } catch (err) {
    showToast(err.message || 'No se ha podido hacer la imagen.', 'error')
  } finally { b.disabled = false }
}

async function exportar() {
  try {
    // El mismo CSV que exporta Mi colección (580); el fichero se baja aquí
    // porque `importar.js` arrastra la pantalla de importar entera (299).
    const { exportarCsv } = await import('./mi-coleccion/importar-csv.js')
    const filas = datos[lista]
    const csv = exportarCsv(filas.map((f) => ({ card_id: f.id, market: f.market, idioma: f.idioma || '', cantidad: f.n })), (l) => filas.find((f) => f.id === l.card_id)?.carta || {})
    // El BOM es para Excel: sin él abre las tildes como basura.
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `pokedoc-${lista === 'busco' ? 'busco' : 'doy'}${datos.usuario ? `-${datos.usuario}` : ''}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    showToast(err.message || 'No se ha podido exportar.', 'error')
  }
}

function ampliar() {
  if (!datos) return
  $('eventoGrandeQr').innerHTML = svgQR(datos.enlace, { tam: 320 })
  $('eventoGrandeNombre').textContent = datos.usuario ? `@${datos.usuario}` : datos.nombre
  $('eventoGrande').showModal()
  // Que no se apague la pantalla mientras lo enseñas, si el navegador deja.
  navigator.wakeLock?.request?.('screen').then((l) => $('eventoGrande').addEventListener('close', () => l.release().catch(() => {}), { once: true })).catch(() => {})
}

// «Con precio» se recuerda en este navegador: es cómo te gusta mirarla tú.
const CLAVE_PRECIO = 'pd-evento-precio'
function ponerConPrecio(si) {
  $('eventoConPrecio').setAttribute('aria-pressed', String(si))
  $('eventoLista').classList.toggle('con-precio', si)
  try { localStorage.setItem(CLAVE_PRECIO, si ? '1' : '0') } catch {}
}

// Los iconos que solo usa esta página van aquí y no en icons.js, que baja
// la portada (651: el de descargar no cabía).
const trazo = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ICONOS_EVENTO = {
  copy: trazo('<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path>'),
  download: trazo('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"></path>'),
  maximize: trazo('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"></path>'),
}

function enganchar() {
  for (const el of document.querySelectorAll('.evento [data-icono]')) el.innerHTML = ICONOS_EVENTO[el.dataset.icono] || icons[el.dataset.icono]?.(18) || ''
  document.querySelector('.evento-pestanas')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lista]')
    if (!b) return
    lista = b.dataset.lista
    filtro.set = ''
    pintarLista()
  })
  let espera = null
  $('eventoBuscar')?.addEventListener('input', (e) => {
    clearTimeout(espera)
    espera = setTimeout(() => { filtro.texto = e.target.value; pintarLista() }, 150)
  })
  for (const [id, campo] of [['eventoCatalogo', 'catalogo'], ['eventoSet', 'set'], ['eventoOrden', 'orden']]) {
    $(id)?.addEventListener('change', (e) => { filtro[campo] = e.target.value; pintarLista() })
  }
  let conPrecio = false
  try { conPrecio = localStorage.getItem(CLAVE_PRECIO) === '1' } catch {}
  ponerConPrecio(conPrecio)
  $('eventoConPrecio')?.addEventListener('click', () => ponerConPrecio($('eventoConPrecio').getAttribute('aria-pressed') !== 'true'))
  $('eventoAmpliar')?.addEventListener('click', ampliar)
  $('eventoGrandeCerrar')?.addEventListener('click', () => $('eventoGrande').close())
  $('eventoGrande')?.addEventListener('click', (e) => { if (e.target === $('eventoGrande')) $('eventoGrande').close() })
  $('eventoCopiar')?.addEventListener('click', copiar)
  $('eventoImagen')?.addEventListener('click', imagen)
  $('eventoExportar')?.addEventListener('click', exportar)
}

async function iniciar() {
  enganchar()
  const guardado = leerGuardado()
  const sesion = await getSession().catch(() => null)
  if (!sesion) {
    if (guardado) return pintar(guardado, true)
    $('eventoQr').innerHTML = `<p class="empty-state"><a href="/auth.html?volver=/evento">Entra</a> para tener tu QR y tus listas.</p>`
    return
  }
  try {
    const d = await pedir(sesion)
    guardar(d)
    pintar(d, false)
    void guardarFotos(d)
  } catch (err) {
    // Sin cobertura, lo guardado; y si es otra cosa, se dice cuál (la 510:
    // un «prueba con cobertura» escondía un 42703 de la base).
    if (guardado) pintar(guardado, true)
    else $('eventoQr').innerHTML = `<p class="empty-state">No se han podido traer tus listas${navigator.onLine === false ? '. Prueba con cobertura.' : `: ${escapeHtml(err?.message || 'inténtalo en un momento')}`}</p>`
  }
}

if (typeof document !== 'undefined' && document.getElementById('eventoQr')) iniciar()
