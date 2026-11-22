// «TUS ILUSTRADORES» (tanda 1411, la propuesta con imágenes: Panel › Más ›
// Tus ilustradores). Quién te ha dibujado la colección: cada ilustrador con
// cuántas cartas suyas tienes y, para los que más, de cuántas hay en el
// catálogo; su nombre lleva a su página (/ilustrador/…) y «Álbum» te hace un
// binder con las suyas, por orden de salida.
//
// Es una vista del Panel (`?ver=ilustradores`), como Tus colores: entra por
// `import()` con `ctxPanel` y se vuelve con «‹ Panel».
import { escapeHtml } from '../app.js'
import { supabase } from '../supabase.js'
import { rutaDeIlustrador, slugDeIlustrador } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { patronDeSlug, esDelIlustrador, ordenarPorFecha, nombreMasComun } from '../ilustrador.js'
import { showToast } from '../toast.js'
import { hojaInyectada } from '../hoja.js'
import { cabeceraDeVistaHtml, engancharVolver } from './movimientos.js'

const $ = (id) => document.getElementById(id)
// A cuántos se les pregunta el total del catálogo: una consulta por cabeza, y
// los de abajo de la lista no la necesitan para decir algo.
export const CON_TOTAL = 12
const PRIMEROS = 40

// ── Lo puro ──

// Tus cartas por ilustrador: [{ slug, nombre, cartas }] de más a menos. Una
// carta firmada «A & B» cuenta para los dos; sin firma no cuenta.
export function porIlustrador(cartas) {
  const grupos = new Map()
  for (const c of cartas) {
    const firma = String(c?.illustrator || '').trim()
    if (!firma) continue
    const partes = firma.split(/\s+(?:&|and|y|x|,)\s+|\s*,\s*/i).map((s) => s.trim()).filter(Boolean)
    for (const p of new Set(partes.map(slugDeIlustrador))) {
      if (!p) continue
      if (!grupos.has(p)) grupos.set(p, [])
      grupos.get(p).push(c)
    }
  }
  return [...grupos].map(([slug, lista]) => ({ slug, nombre: nombreDeGrupo(lista, slug), cartas: lista }))
    .sort((a, b) => b.cartas.length - a.cartas.length || a.nombre.localeCompare(b.nombre, 'es'))
}

// El nombre que se enseña: la firma más repetida, o la parte suya si solo
// sale en firmas de varios.
function nombreDeGrupo(lista, slug) {
  const solos = lista.filter((c) => slugDeIlustrador(c.illustrator) === slug)
  if (solos.length) return nombreMasComun(solos)
  const parte = String(lista[0].illustrator).split(/\s+(?:&|and|y|x|,)\s+|\s*,\s*/i).find((s) => slugDeIlustrador(s) === slug)
  return (parte || lista[0].illustrator).trim()
}

// El total del catálogo, del que no puede salir menos que lo que tienes (una
// japonesa tuya no está en el catálogo occidental).
export const totalVisto = (tuyas, total) => (Number.isFinite(total) ? Math.max(total, tuyas) : null)

// ── La pantalla ──

let ctx = null
let grupos = []
let mostrar = PRIMEROS
const totales = new Map()

function tusCartas() {
  const lineas = ctx.lineasTodo?.length ? ctx.lineasTodo : ctx.lineas
  const cartaDe = ctx.lineasTodo?.length ? ctx.cartaDeLineaTodo : ctx.cartaDeLinea
  const vistas = new Map()
  for (const l of lineas || []) {
    const c = cartaDe(l)
    if (c?.id && !vistas.has(c.id)) vistas.set(c.id, c)
  }
  return [...vistas.values()]
}

// Cuántas cartas firma en el catálogo: las que casan el patrón, afinadas con
// la firma exacta (el patrón de «ryo-ueda» casa también «Ryota Uedasomething»).
async function totalDe(slug) {
  if (totales.has(slug)) return totales.get(slug)
  const { data, error } = await supabase.from('tcg_cards').select('id,illustrator').eq('market', 'WEST').ilike('illustrator', patronDeSlug(slug)).limit(2000)
  const n = error ? null : (data || []).filter((c) => esDelIlustrador(c, slug)).length
  totales.set(slug, n)
  return n
}

export async function abrir(c) {
  ctx = c
  const panel = $('mcPanelIlustradores')
  if (!panel || !ctx.esMia) return
  await hojaInyectada('css/vistas-coleccion.css')
  panel.innerHTML = `${cabeceraDeVistaHtml('Tus ilustradores')}
    <div class="vc-cuerpo" id="viCuerpo"></div>`
  engancharVolver(panel, ctx)
  grupos = porIlustrador(tusCartas())
  mostrar = PRIMEROS
  if (!grupos.length) {
    $('viCuerpo').innerHTML = '<p class="empty-state">Aquí sale quién ha dibujado tus cartas. Todavía no tienes ninguna con su ilustrador apuntado.</p>'
    return
  }
  if (!panel.dataset.enganchado) {
    panel.dataset.enganchado = '1'
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-album-de]')
      if (b) return void hacerAlbum(b.dataset.albumDe, b)
      if (e.target.closest('#viMas')) { mostrar += PRIMEROS; pintar() }
    })
  }
  pintar()
  // Los totales llegan después y repintan: la lista sale al momento.
  await Promise.all(grupos.slice(0, CON_TOTAL).map((g) => totalDe(g.slug)))
  if ($('viCuerpo')) pintar()
}

function fila(g) {
  const n = g.cartas.length
  const total = totalVisto(n, totales.get(g.slug))
  const pct = total ? Math.round((n / total) * 100) : 0
  const cara = g.cartas.find((c) => cadenaDeEscaneo(c).length) || g.cartas[0]
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(cara, null, 'low'))
  return `<li class="vi-fila">
    <span class="vi-cara" aria-hidden="true">${escaneo ? `<img ${escaneo} alt="" loading="lazy" />` : ''}</span>
    <span class="vi-nombre">
      <a href="${escapeHtml(rutaDeIlustrador(g.nombre))}">${escapeHtml(g.nombre)}</a>
      ${total ? `<span class="vi-barra" role="img" aria-label="${pct} % de sus cartas"><i style="width:${Math.max(2, pct)}%"></i></span>` : ''}
    </span>
    <span class="vi-cifra">
      <b>${n}${total ? ` <small>de ${total}</small>` : ''}</b>
      <button type="button" class="btn-secondary" data-album-de="${escapeHtml(g.slug)}" aria-label="Hazme un álbum con tus cartas de ${escapeHtml(g.nombre)}">Álbum</button>
    </span>
  </li>`
}

function pintar() {
  const caja = $('viCuerpo')
  if (!caja) return
  const total = grupos.reduce((s, g) => s + g.cartas.length, 0)
  const top = grupos[0]
  caja.innerHTML = `
    <p class="mc-vista-resumen">Tus cartas las firman <b>${grupos.length}</b> ${grupos.length === 1 ? 'ilustrador' : 'ilustradores'}.</p>
    <div class="vc-cifras">
      <div><span>Tu ilustrador</span><b>${escapeHtml(top.nombre)}</b></div>
      <div><span>Cartas suyas</span><b>${top.cartas.length} de ${total}</b></div>
    </div>
    <ul class="vi-lista">${grupos.slice(0, mostrar).map(fila).join('')}</ul>
    ${grupos.length > mostrar ? `<div class="vc-acciones"><button type="button" class="btn-secondary" id="viMas">Ver ${Math.min(PRIMEROS, grupos.length - mostrar)} más</button></div>` : ''}`
}

async function hacerAlbum(slug, boton) {
  const g = grupos.find((x) => x.slug === slug)
  if (!g) return
  boton.disabled = true
  try {
    const { crearBinderCon } = await import('./albumes.js')
    const nombre = `Ilustrado por ${g.nombre}`.slice(0, 60)
    const ids = ordenarPorFecha(g.cartas).map((c) => c.id)
    const creada = await crearBinderCon({ nombre, descripcion: `Mis cartas de ${g.nombre}.`, ids, abrirlo: false })
    showToast(`Binder «${nombre}» creado con ${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'}.`, 'success')
    location.assign(`/mi-coleccion?ver=carpetas&album=${encodeURIComponent(creada.id)}`)
  } catch (err) {
    showToast(err.message || 'No se ha podido crear el álbum.', 'error')
    boton.disabled = false
  }
}
