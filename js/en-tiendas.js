// «En tiendas» (tanda 1069; tarjetas desde la 1236): las tiendas que tienen
// una carta, la más barata primero, para la ficha de una carta y la del
// Mercado. Lo cuenta la base: solo lo visible y con unidades, nunca el coste,
// y sin precio si la tienda no lo enseña. Sin la migración, o sin ninguna
// tienda, el bloque no sale: «ninguna tienda» no se dice mientras apenas haya
// tiendas.
//
// PINGU (1236): «debería tener en el pop-up de esa carta, igual que sale para
// los usuarios proponer cambio, pues a la tienda contactar, me interesa». Cada
// tienda va en su tarjeta, con el molde de las personas: lo que vende (idioma,
// estado o cápsula, versión, «Ver fotos») y dos botones, «Me interesa» (el del
// escaparate, 1080: la conversación con esa carta dentro) y «Su tienda».
// Tres a la vista y «Ver N más».
import { chapaDeEstadoHtml } from './estado-chapa.js'
import { supabase } from './supabase.js'
import { escapeHtml, urlParaCss } from './html.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { banderaHtml } from './precio-vista.js'
import { chapaDeGradeoHtml } from './gradeo-elegir.js'
import { icons } from './icons.js'
import { ATRIBUTOS_DE_TIENDA } from './rangos.js'

export const A_LA_VISTA = 3
const IDIOMA_CORTO = { es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán', it: 'Italiano', pt: 'Portugués', ja: 'Japonés', ko: 'Coreano', 'zh-tw': 'Chino', 'zh-cn': 'Chino' }

// Con la 1236, `tiendas_con_la_carta` trae la línea del stock (para «Me
// interesa» y las fotos) y si tiene local; sin ella, la de la 1069/1079.
let conLaCarta = true
export async function tiendasQueTienen(cardId) {
  if (!cardId) return []
  if (conLaCarta) {
    const { data, error } = await supabase.rpc('tiendas_con_la_carta', { p_card_id: cardId, p_limite: 24 })
    if (!error) return data || []
    conLaCarta = false
  }
  const { data, error } = await supabase.rpc('tiendas_que_tienen', { p_card_id: cardId, p_limite: 24 })
  return error ? [] : data || []
}

// La URL del perfil de la tienda, con la carta a la vista.
// Con una carta, la tienda ENTERA con el pop-up de esa carta encima (1249);
// con su línea (`stockId`), esa copia elegida en el pop-up.
export const enlaceDeTienda = (t, cardId = null, stockId = null) => {
  const q = new URLSearchParams()
  if (cardId) q.set('carta', cardId)
  if (cardId && stockId) q.set('linea', stockId)
  return `/tiendas/${encodeURIComponent(t.username || '')}${q.size ? `?${q}` : ''}`
}

// «Me interesa» (1249, PINGU: «debería abrirte la tienda en general… con el
// pop-up de esa carta»): su escaparate con esa copia abierta, que se ve sin
// cuenta; escribir o comprar desde el pop-up ya la pide.
export function enlaceMeInteresa(t, cardId) {
  return enlaceDeTienda(t, cardId, t.stock_id || null)
}

// Lo que se dice de dónde está: la ciudad y si tiene local.
const dondeDe = (t) => [t.ciudad, t.con_local === true ? 'Con local' : null].filter(Boolean).join(' · ')

export function enTiendasHtml(tiendas, cardId, { conSesion = false, fotos = null, abierto = false } = {}) {
  if (!tiendas?.length) return ''
  const conPrecio = tiendas.filter((t) => t.precio != null)
  const minimo = conPrecio.length ? Math.min(...conPrecio.map((t) => Number(t.precio))) : null
  // «La más barata» solo si hay con quién comparar, y solo la primera.
  let barataPuesta = false
  const tarjeta = (t, i) => {
    const nombre = t.display_name || t.username || 'Tienda'
    const barata = !barataPuesta && conPrecio.length > 1 && t.precio != null && Number(t.precio) === minimo
    if (barata) barataPuesta = true
    const n = fotos?.get?.(t.stock_id)
    const nFotos = n ? Number(Boolean(n.frente)) + Number(Boolean(n.dorso)) : 0
    const chips = [
      t.idioma ? `<span class="ent-chip">${banderaHtml(t.idioma)}${escapeHtml(IDIOMA_CORTO[t.idioma] || String(t.idioma).toUpperCase())}</span>` : '',
      t.gradeo ? chapaDeGradeoHtml(t.gradeo) : t.estado ? chapaDeEstadoHtml(t.estado) || `<span class="ent-chip">${escapeHtml(t.estado)}</span>` : '',
      t.variante && t.variante !== 'normal' ? `<span class="ent-chip">${escapeHtml(nombreDeVariante(t.variante))}</span>` : '',
      Number(t.unidades) > 1 ? `<span class="ent-chip">${Number(t.unidades)} uds.</span>` : '',
      t.de_tu_lista ? '<span class="ent-chip ent-tuya">De tu lista</span>' : '',
      nFotos ? `<button type="button" class="ent-chip ent-fotos" data-ent-fotos="${escapeHtml(t.stock_id)}">${icons.camera(13)}Ver ${nFotos === 2 ? 'fotos' : 'la foto'}</button>` : '',
    ].join('')
    const urlLogo = t.avatar_url ? urlParaCss(t.avatar_url) : ''
    const logo = urlLogo ? ` style="background-image:url('${urlLogo}')"` : ''
    return `<article class="ent-tarjeta${barata ? ' ent-barata' : ''}${i >= A_LA_VISTA && !abierto ? ' ent-oculta' : ''}" data-ent-tienda="${escapeHtml(t.tienda_id || '')}">
      <div class="ent-arriba">
        <a class="ent-logo${urlLogo ? ' con-foto' : ''}" href="${escapeHtml(enlaceDeTienda(t))}"${logo} aria-label="${escapeHtml(`${nombre}: su tienda`)}">${urlLogo ? '' : escapeHtml(nombre.slice(0, 1).toUpperCase())}</a>
        <span class="ent-quien"><strong${ATRIBUTOS_DE_TIENDA}>${escapeHtml(nombre)}</strong>${dondeDe(t) ? `<small>${escapeHtml(dondeDe(t))}</small>` : ''}</span>
        <span class="ent-precio">${t.precio == null ? '<small>Pregunta el precio</small>' : `${t.precio_antes != null ? `<s class="ent-antes">${escapeHtml(euros(t.precio_antes))}</s>` : ''}<b>${escapeHtml(euros(t.precio))}</b>`}${barata ? '<small class="ent-barata-txt">La más barata</small>' : ''}</span>
      </div>
      ${chips ? `<div class="ent-chips">${chips}</div>` : ''}
      <div class="ent-botones">
        <a class="btn-primary" href="${escapeHtml(enlaceMeInteresa(t, cardId, conSesion))}">${icons.mail(15)}<span>Me interesa</span></a>
        <a class="btn-secondary" href="${escapeHtml(enlaceDeTienda(t))}">Su tienda</a>
      </div>
    </article>`
  }
  const ocultas = abierto ? 0 : Math.max(0, tiendas.length - A_LA_VISTA)
  return `<h3 class="ent-titulo">En ${tiendas.length === 1 ? '1 tienda' : `${tiendas.length} tiendas`}</h3>
    <div class="ent-lista">${tiendas.map(tarjeta).join('')}</div>
    ${ocultas ? `<button type="button" class="btn-secondary ent-mas" data-ent-mas>Ver ${ocultas === 1 ? '1 tienda más' : `${ocultas} tiendas más`}</button>` : ''}`
}

// Las fotos de las copias (1235), si las hay; sin la migración, ninguna.
export async function fotosDeTiendas(tiendas) {
  const ids = (tiendas || []).map((t) => t.stock_id).filter(Boolean)
  if (!ids.length) return null
  const { fotosDeStock } = await import('./tienda-fotos.js')
  return fotosDeStock(ids).catch(() => null)
}

// «Ver N más» y «Ver fotos», una vez por caja.
export function engancharEnTiendas(caja, { tiendas = () => [], fotos = () => null, nombre = () => '' } = {}) {
  if (!caja || caja.dataset.entEnganchada) return
  caja.dataset.entEnganchada = '1'
  caja.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ent-mas]')) {
      caja.querySelectorAll('.ent-oculta').forEach((x) => x.classList.remove('ent-oculta'))
      e.target.closest('[data-ent-mas]').remove()
      return
    }
    const b = e.target.closest('[data-ent-fotos]')
    if (!b) return
    const t = (tiendas() || []).find((x) => x.stock_id === b.dataset.entFotos)
    const f = fotos()?.get?.(b.dataset.entFotos)
    if (!t || !f) return
    const { verFotosDeStock } = await import('./tienda-fotos.js')
    verFotosDeStock({ nombre: nombre(), detalle: [t.display_name || t.username, String(t.idioma || '').toUpperCase(), t.gradeo || t.estado].filter(Boolean).join(' · '), fotos: f })
  })
}

// Pinta el bloque en `caja` si hay alguna tienda; `sigue()` dice si la ficha
// sigue siendo la de esa carta cuando llega la respuesta (la 663).
export async function pintarEnTiendas(caja, cardId, { sigue = () => true, nombre = () => '' } = {}) {
  if (!caja) return
  caja.hidden = true
  const [tiendas, sesion] = await Promise.all([tiendasQueTienen(cardId), supabase.auth.getSession().then((r) => r?.data?.session || null, () => null)])
  if (!sigue() || !tiendas.length) return
  await hojaInyectada('css/en-tiendas.css')
  const fotos = await fotosDeTiendas(tiendas)
  if (!sigue()) return
  caja.innerHTML = enTiendasHtml(tiendas, cardId, { conSesion: Boolean(sesion), fotos })
  caja.hidden = false
  caja._entDatos = { tiendas, fotos }
  engancharEnTiendas(caja, { tiendas: () => caja._entDatos?.tiendas, fotos: () => caja._entDatos?.fotos, nombre })
}
