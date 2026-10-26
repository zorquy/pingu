// El modo evento (tanda 794 como «feria», 1029): tu QR y tus listas de
// «busco» y «doy» EN CARTAS, guardadas en el móvil con sus fotos. En un
// pabellón no hay cobertura: si no se puede preguntar, se enseña lo último
// que se guardó y cuándo. El QR lleva a /evento/<usuario>: la ficha de esa
// persona abierta por Cambios, que ve cualquiera (1030).
import { supabase } from './supabase.js'
import { getSession, getProfile, escapeHtml } from './app.js'
import { showToast } from './toast.js'
import { svgQR } from './qr.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'

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

async function fichas(lineas) {
  const { cartasPorClaves, claveDeCarta } = await import('./mi-coleccion/datos.js')
  const mapa = await cartasPorClaves(lineas)
  return (l) => mapa.get(claveDeCarta(l.card_id, l.market)) || null
}

// Cada fila lleva lo justo para pintarse sin red: nombre, número, la
// dirección de la foto (la primera de la cadena, que es la que se guarda) y
// la carta entera para la imagen y el CSV.
function fila(l, carta) {
  const c = carta || { id: l.card_id, market: l.market, local_id: '' }
  const cadena = c.set_id ? cadenaDeEscaneo(c) : []
  return { id: l.card_id, market: l.market || c.market || 'WEST', n: l.cambio || l.cantidad || 1, idioma: l.idioma || null, nombre: carta ? nombreDeCarta(carta) : l.card_id, num: carta ? `${carta.tcg_sets?.tcg_online_code || carta.set_id} ${carta.local_id}` : '', foto: cadena[0] || '', cadena, carta: c, ruta: rutaDeCarta(c) }
}

async function pedir(sesion) {
  const perfil = await getProfile(sesion.user.id)
  const [{ data: doy, error: e1 }, { data: busco, error: e2 }] = await Promise.all([
    supabase.from('user_collection').select('card_id,market,cambio,idioma').eq('user_id', sesion.user.id).gt('cambio', 0).limit(TOPE),
    supabase.from('user_wants').select('card_id,market,idioma').eq('user_id', sesion.user.id).limit(TOPE),
  ])
  if (e1 || e2) throw e1 || e2
  const cartaDe = await fichas([...(doy || []), ...(busco || [])])
  return { cuando: new Date().toISOString(), enlace: enlaceDeEvento(perfil), nombre: perfil?.display_name || perfil?.username || '', usuario: perfil?.username || '', doy: (doy || []).map((l) => fila(l, cartaDe(l))), busco: (busco || []).map((l) => fila(l, cartaDe(l))) }
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

function cartaHtml(f) {
  const foto = f.cadena?.length ? `<img ${atributosDeEscaneo(f.cadena)} alt="" width="245" height="342" loading="lazy" />` : '<span class="evento-sinfoto"></span>'
  return `<li><a class="evento-carta" href="${escapeHtml(f.ruta || '#')}">${foto}${f.n > 1 ? `<span class="evento-cuantas">×${f.n}</span>` : ''}<b>${escapeHtml(f.nombre)}</b>${f.num ? `<small>${escapeHtml(f.num)}</small>` : ''}</a></li>`
}

function pintarLista() {
  const filas = datos?.[lista] || []
  for (const b of document.querySelectorAll('.evento-pestanas [data-lista]')) b.setAttribute('aria-pressed', String(b.dataset.lista === lista))
  $('eventoLista').innerHTML = filas.length ? filas.map(cartaHtml).join('') : `<li class="evento-vacia">${lista === 'busco' ? 'Nada en La quiero: apunta lo que buscas desde Deseos y cambios.' : 'Nada apuntado para dar: marca «De esas, doy» en tus cartas.'}</li>`
  for (const b of ['eventoCopiar', 'eventoImagen', 'eventoExportar']) { const el = $(b); if (el) el.disabled = !filas.length }
}

function pintar(d, desdeGuardado) {
  datos = d
  $('eventoQr').innerHTML = `${svgQR(d.enlace, { tam: 200 })}<strong>${escapeHtml(d.nombre)}</strong><small>Busca ${d.busco.length} · Da ${d.doy.length}</small>`
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

function enganchar() {
  document.querySelector('.evento-pestanas')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lista]')
    if (!b) return
    lista = b.dataset.lista
    pintarLista()
  })
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
  } catch {
    if (guardado) pintar(guardado, true)
    else $('eventoQr').innerHTML = '<p class="empty-state">No se han podido traer tus listas. Prueba con cobertura.</p>'
  }
}

if (typeof document !== 'undefined' && document.getElementById('eventoQr')) iniciar()
