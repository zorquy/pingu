// «EN TUS ÁLBUMES» EN LA FICHA DE UNA CARTA (tanda 1052, PINGU: «desde el
// pop-up de una carta no puedes añadir a un álbum»). Un bloque con los
// álbumes donde ya está —se tocan y abren el álbum en su página— y «Añadir a
// un álbum», que abre una ventana con tus binders y lo que pasaría en cada
// uno («Va en la pág. 3, hueco 5», «Ya está», «Lleno»), el álbum de su
// expansión aparte y «Nuevo álbum con esta carta».
//
// Lo usan la ficha de Mi colección y /cartas (`#mcEditor`), /carta y el
// pop-up de toda la web (`carta-mercado.js`): por eso vive fuera de
// mi-coleccion/ y trae su hoja (css/en-tus-albumes.css). La cuenta de dónde
// cae cada carta es pura y está en mi-coleccion/album-sitio.js.
//
// Meter la carta CAMBIA YA (896): se escribe, se repinta el bloque y sale el
// aviso con «Ver» y «Deshacer». Deshacer vuelve a leer el álbum y quita la
// carta de SU bolsillo si sigue ahí: fiarse de lo que había en memoria
// borraría lo que se haya movido mientras tanto.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { nombreDeCarta } from './catalogo-series.js'
import { resumenParaCarta, conLaCarta, bolsilloDe, enlaceAAlbum, textoDeOpcion, sitioLibre, lugarDe } from './mi-coleccion/album-sitio.js'
import { tapaGuardada } from './mi-coleccion/album-forma.js'

const $ = (id) => document.getElementById(id)

// Los álbumes, una vez por visita y otra cada vez que se escribe: abrir diez
// cartas seguidas no son diez consultas.
let cache = null
async function misAlbumes(userId) {
  if (cache?.userId === userId) return cache.lista
  const { data, error } = await supabase.from('user_albums').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message || 'No se han podido leer tus álbumes.')
  cache = { userId, lista: data || [] }
  return cache.lista
}
// Al escribir se olvida la lista y se avisa: Mis álbumes, si está en
// pantalla (Mi colección), se repinta con la carta dentro.
const olvidar = () => {
  cache = null
  window.dispatchEvent(new CustomEvent('pokedoc:albumes'))
}

async function guardarCartas(id, cartas) {
  const { data, error } = await supabase.from('user_albums').update({ cartas }).eq('id', id).select('id')
  if (error) throw new Error(error.message || 'No se ha podido guardar el álbum.')
  // La RLS no da error: devuelve vacío (la 510).
  if (!data?.length) throw new Error('No se ha podido guardar el álbum.')
}

const tapaHtml = (a) => `<span class="eta-tapa" data-tapa="${escapeHtml(a.tapa || tapaGuardada())}" aria-hidden="true"></span>`
const nombreDe = (a) => a.nombre || 'Mi álbum'

// El bloque. `caja` es donde va (se rellena entera); `contexto` lleva la
// carta, quién mira y, si se sabe, la versión que se está viendo (la de tu
// copia en Mi colección), que es la que se guarda en el bolsillo.
let turno = 0
export async function pintarEnTusAlbumes(caja, { carta, userId, variante = null }) {
  if (!caja) return
  if (!carta?.id || !userId) {
    caja.innerHTML = ''
    caja.classList.add('hidden')
    return
  }
  const mio = ++turno
  caja.dataset.carta = carta.id
  await hojaInyectada('css/en-tus-albumes.css')
  let albumes
  try {
    albumes = await misAlbumes(userId)
  } catch {
    // Sin poder preguntar no se dice «en ningún álbum» (la 319): el bloque
    // no sale.
    if (mio === turno) caja.classList.add('hidden')
    return
  }
  if (mio !== turno || caja.dataset.carta !== carta.id) return
  const { conElla } = resumenParaCarta(albumes, carta)
  const chips = conElla
    .map((x) => `<a class="eta-chip" href="${escapeHtml(enlaceAAlbum(x.album.id, x.pagina, x.hueco))}">${tapaHtml(x.album)}<span class="eta-chip-nombre">${escapeHtml(nombreDe(x.album))}</span><small>pág. ${x.pagina}</small></a>`)
    .join('')
  caja.innerHTML = `<h3>En tus álbumes</h3><div class="eta-fila">${chips}<button type="button" class="eta-anadir"><span aria-hidden="true">+</span> ${conElla.length ? 'Añadir a otro' : 'Añadir a un álbum'}</button></div>`
  caja.classList.remove('hidden')
  caja.querySelector('.eta-anadir').addEventListener('click', () => abrirEleccion({ carta, userId, variante, alCambiar: () => pintarEnTusAlbumes(caja, { carta, userId, variante }) }))
}

// ── La ventana para elegir ──
function dialogo() {
  let d = $('etaDialogo')
  if (d) return d
  // `data-sin-arrastre`: en el móvil, el arrastre de hojas (804) no la cierra
  // como si fuera la ficha.
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="eta-dialogo" id="etaDialogo" aria-labelledby="etaTitulo" data-sin-arrastre>
      <div class="eta-cab">
        <div class="eta-cab-texto"><h2 id="etaTitulo">Añadir a un álbum</h2><p id="etaCarta"></p></div>
        <button type="button" class="eta-cerrar" id="etaCerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="eta-cuerpo" id="etaCuerpo"></div>
    </dialog>`)
  d = $('etaDialogo')
  $('etaCerrar').addEventListener('click', () => d.close())
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  return d
}

export async function abrirEleccion({ carta, userId, variante = null, alCambiar = () => {} }) {
  await hojaInyectada('css/en-tus-albumes.css')
  const d = dialogo()
  $('etaCarta').textContent = nombreDeCarta(carta) || 'Carta'
  const cuerpo = $('etaCuerpo')
  cuerpo.innerHTML = '<p class="eta-nota">Cargando tus álbumes…</p>'
  if (!d.open) d.showModal()
  let albumes
  try {
    albumes = await misAlbumes(userId)
  } catch (err) {
    cuerpo.innerHTML = `<p class="eta-nota">${escapeHtml(err.message)}</p>`
    return
  }
  const { opciones, suSet } = resumenParaCarta(albumes, carta)
  const fila = (o) => {
    const ya = o.estado === 'ya'
    const lleno = o.estado === 'lleno'
    const marca = ya ? '<span class="eta-hecho" aria-hidden="true">✓</span>' : ''
    return `<li><button type="button" class="eta-opcion${ya ? ' eta-ya' : ''}" data-album="${escapeHtml(o.album.id)}" data-estado="${o.estado}"${ya ? ` data-pagina="${o.pagina}" data-hueco="${o.hueco}"` : ''}${lleno ? ' disabled' : ''}>${tapaHtml(o.album)}<span class="eta-opcion-texto"><b>${escapeHtml(nombreDe(o.album))}</b><small>${escapeHtml(textoDeOpcion(o))}</small></span>${marca}</button></li>`
  }
  const deSet = suSet
    ? `<p class="eta-rotulo">El de su expansión</p><a class="eta-opcion eta-set" href="${escapeHtml(enlaceAAlbum(suSet.album.id, suSet.pagina, suSet.hueco))}">${tapaHtml(suSet.album)}<span class="eta-opcion-texto"><b>${escapeHtml(nombreDe(suSet.album))}</b><small>${suSet.dentro ? 'Ya la tiene: es su expansión' : 'Es su expansión, pero esta carta no entra'}</small></span></a>`
    : ''
  cuerpo.innerHTML = `${opciones.length ? `<p class="eta-rotulo">Tus binders</p><ul class="eta-lista">${opciones.map(fila).join('')}</ul>` : '<p class="eta-nota">Todavía no tienes ningún binder.</p>'}
    ${deSet}
    <form class="eta-nuevo" id="etaNuevo">
      <label for="etaNuevoNombre">Nuevo álbum con esta carta</label>
      <div class="eta-nuevo-fila"><input id="etaNuevoNombre" maxlength="80" placeholder="Mi binder" autocomplete="off"><button type="submit" class="btn-secondary">Crear</button></div>
    </form>`
  cuerpo.querySelectorAll('.eta-opcion[data-album]').forEach((b) => b.addEventListener('click', () => {
    const a = albumes.find((x) => x.id === b.dataset.album)
    if (!a) return
    if (b.dataset.estado === 'ya') {
      location.href = enlaceAAlbum(a.id, b.dataset.pagina, b.dataset.hueco)
      return
    }
    d.close()
    void meter(a, { carta, variante, alCambiar })
  }))
  $('etaNuevo').addEventListener('submit', (e) => {
    e.preventDefault()
    const nombre = $('etaNuevoNombre').value.trim().slice(0, 80) || 'Mi binder'
    d.close()
    void crearCon(nombre, { carta, userId, variante, alCambiar })
  })
}

// Meter la carta en el primer hueco libre de un binder.
async function meter(a, { carta, variante, alCambiar }) {
  const sitio = sitioLibre(a)
  const { pagina, hueco } = lugarDe(a, sitio)
  const cartas = conLaCarta(a, bolsilloDe(carta, variante))
  try {
    await guardarCartas(a.id, cartas)
  } catch (err) {
    showToast(err.message, 'error')
    return
  }
  olvidar()
  alCambiar()
  const { avisoConDeshacer } = await import('./mi-coleccion/deshacer.js')
  avisoConDeshacer({
    html: `Dentro de «${escapeHtml(nombreDe(a))}» · pág. ${pagina}, hueco ${hueco} · <a class="eta-ver" href="${escapeHtml(enlaceAAlbum(a.id, pagina, hueco))}">Ver</a>`,
    alDeshacer: async () => {
      try {
        const { data, error } = await supabase.from('user_albums').select('cartas').eq('id', a.id).maybeSingle()
        if (error || !data) throw new Error('No se ha podido deshacer.')
        const ahora = Array.isArray(data.cartas) ? [...data.cartas] : []
        if (ahora[sitio]?.id !== carta.id) throw new Error('La carta ya no está en ese bolsillo.')
        ahora[sitio] = {}
        while (ahora.length && !ahora[ahora.length - 1]?.id) ahora.pop()
        await guardarCartas(a.id, ahora)
        olvidar()
        alCambiar()
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
  })
}

// Un binder nuevo con esta carta dentro: 3×3 y 20 páginas, como el de
// «Empezar un álbum» por defecto, con el color de tapa de la última vez.
async function crearCon(nombre, { carta, userId, variante, alCambiar }) {
  const fila = { user_id: userId, nombre, cartas: [bolsilloDe(carta, variante)], tipo: 'binder', rejilla: '3x3', paginas: 20, tapa: tapaGuardada() }
  const { data, error } = await supabase.from('user_albums').insert(fila).select('id,nombre').single()
  if (error || !data?.id) {
    showToast(error?.message || 'No se ha podido crear el álbum.', 'error')
    return
  }
  olvidar()
  alCambiar()
  const { avisoConDeshacer } = await import('./mi-coleccion/deshacer.js')
  avisoConDeshacer({
    html: `Álbum «${escapeHtml(data.nombre)}» creado con esta carta · <a class="eta-ver" href="${escapeHtml(enlaceAAlbum(data.id, 1, 1))}">Ver</a>`,
    alDeshacer: async () => {
      const { data: borrado, error: e } = await supabase.from('user_albums').delete().eq('id', data.id).select('id')
      if (e || !borrado?.length) showToast('No se ha podido deshacer.', 'error')
      olvidar()
      alCambiar()
    },
  })
}
