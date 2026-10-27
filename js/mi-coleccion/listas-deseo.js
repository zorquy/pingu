// LAS LISTAS DE «LA QUIERO» (1057; migración supabase-migration-1057-listas-deseo.sql).
//
// Un usuario pidió carpetas para sus deseos (lo que le falta de un master
// set, cartas a vigilar, la lista de una feria). Son listas dentro de «La
// quiero»: una carta puede estar en varias y solo las ve su dueño. Aquí van
// los datos y las dos hojas («Tus listas» y crear o editar una); la barra y
// la rejilla son de deseos.js.
//
// Sin la migración, `cargarListas` devuelve null y la web no ofrece listas
// (el botón de la barra se queda en «Todas», sin hoja): nada roto entre medias.
import { supabase } from '../supabase.js'
import { escapeHtml } from '../html.js'

// Los colores de una lista: identidad, no tema (como las tapas de un álbum).
export const COLORES_LISTA = ['#e0a526', '#6d4aa8', '#0d7a56', '#c04a7e', '#2b6cb0', '#b9a888']

const $ = (id) => document.getElementById(id)
export const claveDeCarta = (cardId, market) => `${cardId}|${market || 'WEST'}`

let listas = null // null = sin la migración (o sin cargar)
// `cruces` (1058) se pide si existe: una columna que no está tumba la
// consulta entera (la 624), así que sin la 1058 se vuelve a pedir sin ella y
// la hoja no ofrece el interruptor.
let hayCruces = true
const COLUMNAS = () => `id, nombre, color, created_at${hayCruces ? ', cruces' : ''}`
const faltaCruces = (e) => e && (e.code === '42703' || e.code === 'PGRST204') && /cruces/.test(String(e.message || ''))
let items = new Map() // list_id → Set(claveDeCarta)

export const hayListas = () => Array.isArray(listas)
export const lasListas = () => listas || []
export const cartasDe = (id) => items.get(id) || new Set()

export async function cargarListas(userId) {
  if (!userId) return (listas = null)
  const pedir = () => supabase.from('user_want_lists').select(COLUMNAS()).eq('user_id', userId).order('created_at')
  let [l, i] = await Promise.all([
    pedir(),
    supabase.from('user_want_list_items').select('list_id, card_id, market').eq('user_id', userId),
  ])
  if (faltaCruces(l.error)) {
    hayCruces = false
    l = await pedir()
  }
  if (l.error || i.error) return (listas = null)
  listas = l.data || []
  items = new Map(listas.map((x) => [x.id, new Set()]))
  for (const f of i.data || []) items.get(f.list_id)?.add(claveDeCarta(f.card_id, f.market))
  return listas
}

export async function crearLista({ nombre, color, cruces = true }) {
  const fila = { nombre: nombre.trim(), color, ...(hayCruces ? { cruces } : {}) }
  const { data, error } = await supabase.from('user_want_lists').insert(fila).select(COLUMNAS()).single()
  if (error) throw new Error('No se ha podido crear la lista.')
  listas = [...(listas || []), data]
  items.set(data.id, new Set())
  return data
}

export async function editarLista(id, cambios) {
  const { error } = await supabase.from('user_want_lists').update(cambios).eq('id', id)
  if (error) throw new Error('No se ha podido guardar la lista.')
  listas = listas.map((x) => (x.id === id ? { ...x, ...cambios } : x))
}

export async function borrarLista(id) {
  const { error } = await supabase.from('user_want_lists').delete().eq('id', id)
  if (error) throw new Error('No se ha podido borrar la lista.')
  listas = listas.filter((x) => x.id !== id)
  items.delete(id)
}

// `cartas`: [{ card_id, market }]. Lo que ya estaba no se repite.
export async function meterEnLista(id, cartas) {
  const set = items.get(id) || new Set()
  const nuevas = cartas.filter((c) => !set.has(claveDeCarta(c.card_id, c.market)))
  if (!nuevas.length) return 0
  const { error } = await supabase.from('user_want_list_items').insert(nuevas.map((c) => ({ list_id: id, card_id: c.card_id, market: c.market || 'WEST' })))
  if (error) throw new Error('No se han podido meter en la lista.')
  for (const c of nuevas) set.add(claveDeCarta(c.card_id, c.market))
  items.set(id, set)
  return nuevas.length
}

export async function sacarDeLista(id, cartas) {
  for (const c of cartas) {
    const { error } = await supabase.from('user_want_list_items').delete().eq('list_id', id).eq('card_id', c.card_id).eq('market', c.market || 'WEST')
    if (error) throw new Error('No se han podido sacar de la lista.')
    items.get(id)?.delete(claveDeCarta(c.card_id, c.market))
  }
}

// ── La hoja ──
// Una sola ventana para las tres cosas: elegir lista, crear una y editarla.
// Centrada en el PC y desde abajo en el móvil (la 1045).
function hoja() {
  let d = $('mcListasHoja')
  if (d) return d
  d = document.createElement('dialog')
  d.id = 'mcListasHoja'
  d.className = 'mc-listas-hoja'
  d.setAttribute('aria-labelledby', 'mcListasTitulo')
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-listas-cerrar]')) d.close()
  })
  document.body.append(d)
  return d
}

const punto = (color) => `<i class="mc-lista-punto" style="--c:${escapeHtml(color || 'transparent')}" aria-hidden="true"></i>`

// «Tus listas». `cuenta(id)` dice cuántas cartas QUE SIGUES QUERIENDO hay en
// cada una (null = Todas). Con `para` (al meter cartas marcadas) el título
// cambia y no sale «Todas».
// Devuelve el id elegido, null para Todas, o undefined si se cierra.
export function elegirLista({ abierta = null, cuenta, para = 0 } = {}) {
  const d = hoja()
  return new Promise((resuelve) => {
    let hecho = false
    const fin = (v) => { if (!hecho) { hecho = true; resuelve(v) } }
    const pintar = () => {
      d.innerHTML = `<div class="mc-listas-cab"><h2 id="mcListasTitulo">${para ? `Meter ${para === 1 ? '1 carta' : `${para} cartas`} en…` : 'Tus listas'}</h2><button type="button" class="mc-listas-cerrar" data-listas-cerrar aria-label="Cerrar">✕</button></div>
        <div class="mc-listas-cuerpo">
          ${para ? '' : `<button type="button" class="mc-lista-opcion${abierta == null ? ' puesta' : ''}" data-lista="">${punto(null)}<span>Todas<small>todo lo que quieres</small></span><b>${cuenta(null)}</b></button>`}
          ${lasListas().map((l) => `<button type="button" class="mc-lista-opcion${abierta === l.id ? ' puesta' : ''}" data-lista="${escapeHtml(l.id)}">${punto(l.color)}<span>${escapeHtml(l.nombre)}${l.cruces === false ? '<small>solo para ti: no sale en cruces</small>' : ''}</span><b>${cuenta(l.id)}</b></button>`).join('')}
          <button type="button" class="mc-lista-opcion mc-lista-nueva" data-lista-nueva><span aria-hidden="true">+</span><span>Nueva lista</span></button>
        </div>`
    }
    d.onclick = async (e) => {
      const nueva = e.target.closest('[data-lista-nueva]')
      // Crear una la deja elegida; cancelar cierra sin elegir.
      if (nueva) {
        const l = await editarHoja({})
        return fin(l && l !== 'borrada' ? l.id : undefined)
      }
      const b = e.target.closest('[data-lista]')
      if (b) {
        fin(b.dataset.lista || null)
        d.close()
      }
    }
    d.onclose = () => fin(undefined)
    pintar()
    if (!d.open) d.showModal()
  })
}

// Crear (sin `lista`) o editar una lista: nombre y color, y borrar.
// Devuelve la lista creada o editada, 'borrada', o null si se cancela.
export function editarHoja({ lista = null } = {}) {
  const d = hoja()
  return new Promise((resuelve) => {
    let color = lista?.color || COLORES_LISTA[lasListas().length % COLORES_LISTA.length]
    let hecho = false
    const fin = (v) => { if (!hecho) { hecho = true; resuelve(v) } }
    d.innerHTML = `<div class="mc-listas-cab"><h2 id="mcListasTitulo">${lista ? 'Editar la lista' : 'Nueva lista'}</h2><button type="button" class="mc-listas-cerrar" data-listas-cerrar aria-label="Cerrar">✕</button></div>
      <form class="mc-listas-cuerpo mc-lista-form" id="mcListaForm">
        <label class="mc-lista-campo"><span>Nombre</span><input type="text" id="mcListaNombre" maxlength="60" required placeholder="Master set, Feria de Madrid…" value="${escapeHtml(lista?.nombre || '')}" /></label>
        <div class="mc-lista-colores" role="radiogroup" aria-label="Color">${COLORES_LISTA.map((c) => `<button type="button" role="radio" class="mc-lista-color" style="--c:${c}" data-color="${c}" aria-checked="${c === color}" aria-label="Color ${c}"></button>`).join('')}</div>
        ${hayCruces ? `<label class="mc-lista-cruces"><input type="checkbox" id="mcListaCruces"${lista?.cruces === false ? '' : ' checked'} /><span><b>Cuenta para los cruces</b><small>Si la quitas, sus cartas solo las ves tú: no salen en tu perfil, en el Mercado ni en Cruces, y nadie te avisa de ellas. Para las que solo vigilas.</small></span></label>` : ''}
        <p class="subtext">La lista la ves solo tú. Las cartas siguen en «La quiero».</p>
        <div class="mc-lista-pie">
          ${lista ? '<button type="button" class="btn-secondary mc-lista-borrar" data-lista-borrar>Borrar la lista</button>' : '<button type="button" class="btn-secondary" data-listas-cerrar>Cancelar</button>'}
          <button type="submit" class="btn-primary">${lista ? 'Guardar' : 'Crear lista'}</button>
        </div>
      </form>`
    d.onclick = async (e) => {
      if (e.target === d || e.target.closest('[data-listas-cerrar]')) return d.close()
      const c = e.target.closest('[data-color]')
      if (c) {
        color = c.dataset.color
        for (const b of d.querySelectorAll('[data-color]')) b.setAttribute('aria-checked', String(b.dataset.color === color))
      }
      const borrar = e.target.closest('[data-lista-borrar]')
      if (borrar) {
        if (borrar.dataset.seguro !== '1') {
          borrar.dataset.seguro = '1'
          borrar.textContent = 'Toca otra vez para borrarla'
          return
        }
        try {
          await borrarLista(lista.id)
          fin('borrada')
          d.close()
        } catch (err) {
          borrar.textContent = err.message
        }
      }
    }
    d.querySelector('#mcListaForm').onsubmit = async (e) => {
      e.preventDefault()
      const nombre = d.querySelector('#mcListaNombre').value.trim()
      if (!nombre) return
      const caja = d.querySelector('#mcListaCruces')
      const cruces = caja ? caja.checked : undefined
      const boton = d.querySelector('[type="submit"]')
      boton.disabled = true
      try {
        if (lista) {
          const cambios = { nombre, color, ...(cruces === undefined ? {} : { cruces }) }
          await editarLista(lista.id, cambios)
          fin({ ...lista, ...cambios })
        } else {
          fin(await crearLista({ nombre, color, ...(cruces === undefined ? {} : { cruces }) }))
        }
        d.close()
      } catch (err) {
        boton.disabled = false
        boton.textContent = err.message
      }
    }
    d.onclose = () => fin(null)
    if (!d.open) d.showModal()
    setTimeout(() => d.querySelector('#mcListaNombre')?.focus(), 50)
  })
}

// Un menú ⋯ en la misma ventana: `opciones` = [[id, texto, nota]]. Devuelve
// la elegida o undefined. Lo usan «La quiero» y «Las que doy».
export function menuDe({ titulo, opciones }) {
  const d = hoja()
  return new Promise((resuelve) => {
    let hecho = false
    const fin = (v) => { if (!hecho) { hecho = true; resuelve(v) } }
    d.innerHTML = `<div class="mc-listas-cab"><h2 id="mcListasTitulo">${escapeHtml(titulo)}</h2><button type="button" class="mc-listas-cerrar" data-listas-cerrar aria-label="Cerrar">✕</button></div>
      <div class="mc-listas-cuerpo">${opciones.map(([id, texto, nota]) => `<button type="button" class="mc-lista-opcion mc-lista-menu" data-accion="${id}"><span>${texto}${nota ? `<small>${nota}</small>` : ''}</span></button>`).join('')}</div>`
    d.onclick = (e) => {
      if (e.target === d || e.target.closest('[data-listas-cerrar]')) return d.close()
      const b = e.target.closest('[data-accion]')
      if (b) {
        fin(b.dataset.accion)
        d.close()
      }
    }
    d.onclose = () => fin(undefined)
    if (!d.open) d.showModal()
  })
}

// El ⋯ de «La quiero»: lo que antes eran botones sueltos.
export function menuDeLaQuiero({ lista = null } = {}) {
  return menuDe({
    titulo: lista ? lista.nombre : 'Todas las que quieres',
    opciones: [
      ['compartir', 'Compartir la lista', 'en texto, para pegarla en un grupo'],
      ['imagen', 'Hacer una imagen'],
      ['album', 'Hacer un álbum con ellas'],
      ['evento', 'Modo evento', lista ? 'con esta lista' : 'tu QR para una feria'],
      ...(lista ? [['editar', 'Editar la lista', 'nombre, color o borrarla']] : []),
    ],
  })
}
