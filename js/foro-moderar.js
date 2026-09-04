// Moderar desde la LISTA de temas, sin entrar en cada uno (tanda 256).
//
// Hasta ahora todo lo de moderación vivía dentro del tema: para poner una
// etiqueta a diez hilos había que abrir diez hilos, y para mover uno de
// sitio no había forma ninguna. Ordenar un foro así no lo hace nadie, y
// eso es justo el trabajo que se le va a pedir a los moderadores nuevos.
//
// Lo que hay aquí es lo que hacen los foros de siempre (phpBB, XenForo):
// una casilla por fila, una barra abajo con lo que se puede hacer con lo
// marcado, y un menú por tema para lo de uno solo.
//
// ── El peligro de esta pantalla ──
//
// Un UPDATE o un DELETE que la política de la base RECHAZA **no da
// error**: no toca nada y vuelve como si todo hubiera ido bien. Con un
// botón que dice «Mover», eso significa que la persona lo pulsa, no pasa
// nada, y no hay nada que se lo diga. Por eso TODAS las escrituras de
// este fichero piden de vuelta las filas (`.select('id')`) y comparan
// cuántas esperaban con cuántas llegaron. Si no cuadra, se dice.

import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { ETIQUETAS } from './foro-comun.js'
import { ordenarForos, opcionesDeForos } from './torneos/anuncio-foro.js'

// Los foros del desplegable de destino. Se piden UNA vez por carga y se
// quedan aquí: mover diez temas seguidos no son diez consultas.
let forosCache = null

// Lo marcado. Vive en un Set y no en el DOM porque la barra de abajo
// necesita saber cuántos hay sin recorrer la lista en cada clic.
const marcados = new Set()

// Si el segundo grupo de botones («Más») está desplegado. Se conserva
// entre repintados: la barra se vuelve a pintar cada vez que marcas otro
// tema, y sin esto se cerraría sola en cuanto tocas una casilla.
let masAbierto = false

let ctx = { foro: null, temas: [], soyAdmin: false }

// ── Los trozos de HTML que la lista intercala en cada fila ──
//
// Van aquí y no en foro.js para que la lista no tenga que saber nada de
// moderación: pregunta si toca pintarlo y pega lo que le den.

export function casillaHtml(tema) {
  return `<label class="foro-mod-casilla" title="Seleccionar para moderar">
    <input type="checkbox" data-mod-sel="${escapeHtml(tema.id)}" />
  </label>`
}

export function botonMenuHtml(tema) {
  return `<button type="button" class="foro-mod-menu-btn" data-mod-menu="${escapeHtml(tema.id)}"
    aria-haspopup="true" aria-expanded="false" title="Moderar este tema">${icons.moreHorizontal(18)}</button>`
}

// ── El arranque ──

export function engancharModeracion({ foro, temas, soyAdmin }) {
  ctx = { foro, temas: temas || [], soyAdmin: !!soyAdmin }
  marcados.clear()
  masAbierto = false

  document.querySelectorAll('[data-mod-sel]').forEach((c) =>
    c.addEventListener('change', () => {
      if (c.checked) marcados.add(c.dataset.modSel)
      else marcados.delete(c.dataset.modSel)
      c.closest('.foro-tema-fila')?.classList.toggle('foro-tema-marcado', c.checked)
      pintarBarra()
    })
  )

  document.querySelectorAll('[data-mod-menu]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      abrirMenu(b)
    })
  )

  // Un clic en cualquier otro sitio cierra el menú abierto. Sin esto, la
  // única forma de cerrarlo sería volver a darle al mismo botón, que es
  // lo que nadie prueba.
  document.addEventListener('click', cerrarMenus)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarMenus()
  })

  pintarBarra()
}

// ─────────────────────────────────────────────────────────────
// La barra de abajo
// ─────────────────────────────────────────────────────────────
//
// Se queda pegada al borde inferior mientras haya algo marcado. Va fuera
// de la lista (en el <body>) para que no se la lleve por delante el
// desplazamiento ni el `overflow` de ninguna sección.

function barra() {
  let b = document.getElementById('foroModBarra')
  if (!b) {
    b = document.createElement('div')
    b.id = 'foroModBarra'
    b.className = 'foro-mod-barra'
    b.hidden = true
    document.body.appendChild(b)
  }
  return b
}

function pintarBarra() {
  const b = barra()
  const n = marcados.size
  if (!n) {
    b.hidden = true
    b.innerHTML = ''
    return
  }
  b.hidden = false
  // A la vista, lo del día a día: mover y etiquetar, que es el trabajo
  // que se le pide a un moderador —ordenar—. Fijar, cerrar y borrar en
  // LOTE se hacen de uvas a peras, y sacar los siete botones dejaba la
  // barra ocupando media pantalla en el móvil.
  b.innerHTML = `
    <span class="foro-mod-cuenta">${n} ${n === 1 ? 'tema seleccionado' : 'temas seleccionados'}</span>
    <div class="foro-mod-acciones">
      <button type="button" class="btn-secondary" data-lote="mover">${icons.folder(14)} Mover</button>
      <button type="button" class="btn-secondary" data-lote="etiqueta">${icons.hash(14)} Etiqueta</button>
      <button type="button" class="btn-secondary" data-lote="mas" aria-expanded="${masAbierto}">${icons.moreHorizontal(14)} Más</button>
      <button type="button" class="link-btn" data-lote="nada">Quitar selección</button>
    </div>
    <div class="foro-mod-acciones foro-mod-mas" ${masAbierto ? '' : 'hidden'}>
      <button type="button" class="btn-secondary" data-lote="fijar">${icons.pin(14)} Fijar arriba</button>
      <button type="button" class="btn-secondary" data-lote="soltar">${icons.pin(14)} Quitar de arriba</button>
      <button type="button" class="btn-secondary" data-lote="cerrar">${icons.lock(14)} Cerrar</button>
      <button type="button" class="btn-secondary" data-lote="abrir">${icons.lock(14)} Reabrir</button>
      <button type="button" class="btn-secondary foro-mod-peligro" data-lote="borrar">${icons.trash(14)} Borrar</button>
    </div>
    <div class="foro-mod-panel" id="foroModPanel" hidden></div>`

  b.querySelectorAll('[data-lote]').forEach((x) => x.addEventListener('click', () => enLote(x)))
}

async function enLote(boton) {
  const ids = [...marcados]
  const panel = document.getElementById('foroModPanel')
  const accion = boton.dataset.lote

  if (accion === 'nada') {
    document.querySelectorAll('[data-mod-sel]').forEach((c) => {
      c.checked = false
      c.closest('.foro-tema-fila')?.classList.remove('foro-tema-marcado')
    })
    marcados.clear()
    masAbierto = false
    pintarBarra()
    return
  }

  if (accion === 'mas') {
    masAbierto = !masAbierto
    pintarBarra()
    return
  }

  if (accion === 'mover') return abrirPanelMover(panel, ids)
  if (accion === 'etiqueta') return abrirPanelEtiqueta(panel, ids)

  if (accion === 'borrar') {
    // Dos toques, como en la ficha de un tema: borrar diez hilos de golpe
    // no puede estar a un solo clic de distancia.
    if (!boton.dataset.armado) {
      boton.dataset.armado = '1'
      boton.textContent = `¿Seguro? Borrar ${ids.length}`
      return
    }
    return aplicarBorrado(ids)
  }

  const cambios = {
    fijar: { is_pinned: true },
    soltar: { is_pinned: false },
    cerrar: { is_locked: true },
    abrir: { is_locked: false },
  }[accion]
  if (cambios) return aplicarCambio(ids, cambios)
}

// ─────────────────────────────────────────────────────────────
// El menú de un tema
// ─────────────────────────────────────────────────────────────

function cerrarMenus() {
  document.querySelectorAll('.foro-mod-menu').forEach((m) => m.remove())
  document.querySelectorAll('[data-mod-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false'))
}

function abrirMenu(boton) {
  const id = boton.dataset.modMenu
  const abierto = boton.getAttribute('aria-expanded') === 'true'
  cerrarMenus()
  if (abierto) return
  const tema = ctx.temas.find((t) => t.id === id)
  if (!tema) return
  // La fila se guarda AHORA, mientras se tiene el botón de la lista: el
  // menú se cuelga del <body> y desde dentro de él ya no hay forma de
  // subir hasta la fila.
  const fila = boton.closest('.foro-tema-fila')

  boton.setAttribute('aria-expanded', 'true')
  const menu = document.createElement('div')
  menu.className = 'foro-mod-menu'
  menu.dataset.tema = tema.id
  menu.innerHTML = `
    <button type="button" data-uno="editar">${icons.edit(14)} Editar título y etiqueta</button>
    <button type="button" data-uno="mover">${icons.folder(14)} Mover a otro foro</button>
    <button type="button" data-uno="mensaje">${icons.messageSquare(14)} Editar el primer mensaje</button>
    <hr />
    <button type="button" data-uno="fijar">${icons.pin(14)} ${tema.is_pinned ? 'Quitar de arriba' : 'Fijar arriba'}</button>
    <button type="button" data-uno="cerrar">${icons.lock(14)} ${tema.is_locked ? 'Reabrir' : 'Cerrar'}</button>
    <hr />
    <button type="button" class="foro-mod-peligro" data-uno="borrar">${icons.trash(14)} Borrar tema</button>`
  // El menú va colgado del <body> y colocado a mano, NO dentro de la
  // fila: la sección de la lista recorta lo que se sale (esquinas
  // redondeadas), y colgándolo de la fila el menú del último tema salía
  // cortado por la mitad. Colocarlo a mano cuesta cuatro líneas y no
  // depende de qué recorte cada contenedor de por medio.
  document.body.appendChild(menu)
  colocarMenu(menu, boton)
  menu.addEventListener('click', (e) => e.stopPropagation())
  menu.querySelectorAll('[data-uno]').forEach((x) =>
    x.addEventListener('click', () => deUnTema(x, tema, fila))
  )
}

// Debajo del botón y alineado a su derecha; si abajo no cabe, encima.
// Se mide DESPUÉS de meterlo en la página, que es cuando tiene altura.
function colocarMenu(menu, boton) {
  const b = boton.getBoundingClientRect()
  const alto = menu.offsetHeight
  const cabeDebajo = b.bottom + alto + 8 < window.innerHeight
  menu.style.top = `${(cabeDebajo ? b.bottom + 4 : b.top - alto - 4) + window.scrollY}px`
  menu.style.left = `${Math.max(8, b.right - menu.offsetWidth) + window.scrollX}px`
}

function deUnTema(boton, tema, fila) {
  const accion = boton.dataset.uno

  if (accion === 'fijar') return aplicarCambio([tema.id], { is_pinned: !tema.is_pinned })
  if (accion === 'cerrar') return aplicarCambio([tema.id], { is_locked: !tema.is_locked })
  if (accion === 'mensaje') {
    // El editor de mensajes vive en la ficha del tema y pesa lo suyo
    // (barra de BBCode, subida de imágenes, emojis). Traerlo a la lista
    // sería cargárselo en la página que abre todo el mundo, así que se
    // va allí con el editor ya abierto.
    window.location.href = `/tema/${encodeURIComponent(tema.id)}?editar=primero`
    return
  }
  if (accion === 'borrar') {
    if (!boton.dataset.armado) {
      boton.dataset.armado = '1'
      const respuestas = Math.max(0, (tema.post_count || 1) - 1)
      boton.textContent = respuestas ? `¿Seguro? Se pierden ${respuestas} respuestas` : '¿Seguro? Borrar'
      return
    }
    return aplicarBorrado([tema.id])
  }

  cerrarMenus()
  if (!fila) return
  if (accion === 'editar') return abrirEdicionEnLaFila(fila, tema)
  if (accion === 'mover') return abrirMovidaEnLaFila(fila, tema)
}

// ── Editar el título y la etiqueta, en la propia fila ──
function abrirEdicionEnLaFila(fila, tema) {
  if (fila.querySelector('.foro-mod-form')) return
  // Si el tema trae una etiqueta que ya no está en la lista, se conserva
  // como opción: guardar no puede ser la forma de perderla sin querer.
  const lista = ETIQUETAS.includes(tema.prefix) || !tema.prefix ? ETIQUETAS : [tema.prefix, ...ETIQUETAS]
  const form = document.createElement('form')
  form.className = 'foro-mod-form'
  form.innerHTML = `
    <select name="etiqueta">
      <option value="">Sin etiqueta</option>
      ${lista
        .map((e) => `<option value="${escapeHtml(e)}"${e === tema.prefix ? ' selected' : ''}>${escapeHtml(e)}</option>`)
        .join('')}
    </select>
    <input type="text" name="titulo" maxlength="160" value="${escapeHtml(tema.title)}" required />
    <button type="submit" class="btn-primary">Guardar</button>
    <button type="button" class="link-btn" data-cerrar>Cancelar</button>`
  fila.appendChild(form)
  form.querySelector('input')?.focus()
  form.querySelector('[data-cerrar]').addEventListener('click', () => form.remove())
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const titulo = form.titulo.value.trim()
    if (!titulo) return showToast('El tema no puede quedarse sin título.')
    await aplicarCambio([tema.id], { title: titulo, prefix: form.etiqueta.value || null })
  })
}

// ── Mover, en la propia fila ──
async function abrirMovidaEnLaFila(fila, tema) {
  if (fila.querySelector('.foro-mod-form')) return
  const form = document.createElement('form')
  form.className = 'foro-mod-form'
  form.innerHTML = '<p class="subtext">Cargando los foros…</p>'
  fila.appendChild(form)
  const foros = await cargarForos()
  form.innerHTML = `
    <select name="destino">${opcionesDeForos(foros, ctx.foro)}</select>
    <button type="submit" class="btn-primary">Mover</button>
    <button type="button" class="link-btn" data-cerrar>Cancelar</button>`
  form.querySelector('[data-cerrar]').addEventListener('click', () => form.remove())
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    await mover([tema.id], form.destino.value)
  })
}

// ── Los paneles de la barra (lo mismo, pero para lo marcado) ──

async function abrirPanelMover(panel, ids) {
  panel.hidden = false
  panel.innerHTML = '<p class="subtext">Cargando los foros…</p>'
  const foros = await cargarForos()
  panel.innerHTML = `
    <form class="foro-mod-form">
      <label>Mover ${ids.length} ${ids.length === 1 ? 'tema' : 'temas'} a:</label>
      <select name="destino">${opcionesDeForos(foros, ctx.foro)}</select>
      <button type="submit" class="btn-primary">Mover</button>
    </form>`
  panel.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    await mover(ids, e.target.destino.value)
  })
}

function abrirPanelEtiqueta(panel, ids) {
  panel.hidden = false
  panel.innerHTML = `
    <form class="foro-mod-form">
      <label>Poner a ${ids.length} ${ids.length === 1 ? 'tema' : 'temas'} la etiqueta:</label>
      <select name="etiqueta">
        <option value="">Sin etiqueta</option>
        ${ETIQUETAS.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('')}
      </select>
      <button type="submit" class="btn-primary">Poner</button>
    </form>`
  panel.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    await aplicarCambio(ids, { prefix: e.target.etiqueta.value || null })
  })
}

// ─────────────────────────────────────────────────────────────
// Las escrituras
// ─────────────────────────────────────────────────────────────
//
// Las tres pasan por el mismo sitio a propósito: pedir de vuelta lo
// tocado y comprobar la cuenta es lo único que distingue «hecho» de «la
// política ha dicho que no», que sin esto se ven exactamente igual.

async function aplicarCambio(ids, cambios) {
  const { data, error } = await supabase.from('forum_threads').update(cambios).in('id', ids).select('id')
  if (!seHizo(data, error, ids.length, 'No se ha podido cambiar')) return
  recargar(ids.length === 1 ? 'Tema actualizado.' : `${ids.length} temas actualizados.`)
}

async function mover(ids, destino) {
  if (!destino) return showToast('Elige un foro de destino.')
  if (destino === ctx.foro?.id) return showToast('Ese tema ya está en este foro.')
  const { data, error } = await supabase
    .from('forum_threads')
    .update({ board_id: destino })
    .in('id', ids)
    .select('id')
  if (!seHizo(data, error, ids.length, 'No se ha podido mover')) return
  recargar(ids.length === 1 ? 'Tema movido.' : `${ids.length} temas movidos.`)
}

async function aplicarBorrado(ids) {
  const { data, error } = await supabase.from('forum_threads').delete().in('id', ids).select('id')
  if (!seHizo(data, error, ids.length, 'No se ha podido borrar')) return
  recargar(ids.length === 1 ? 'Tema borrado.' : `${ids.length} temas borrados.`)
}

// La comprobación que hace que un «no» de la base no pase por un «sí».
function seHizo(data, error, esperadas, queNo) {
  if (error) {
    showToast(`${queNo}: ${error.message}`)
    return false
  }
  const hechas = data?.length || 0
  if (hechas === 0) {
    showToast(`${queNo}: la base no te deja hacerlo. ¿Sigues siendo del equipo?`)
    return false
  }
  if (hechas < esperadas) {
    // Puede pasar de verdad: alguien borró un tema mientras esta lista
    // estaba abierta. Decirlo es mejor que recargar y que la persona
    // cuente los que faltan.
    showToast(`Hecho en ${hechas} de ${esperadas}. Los demás ya no estaban.`, 'success')
  }
  return true
}

function recargar(mensaje) {
  showToast(mensaje, 'success')
  // Recargar y no repintar: fijar cambia el ORDEN de la lista, mover saca
  // el tema de este foro y borrar lo quita. Repintar a mano cada uno de
  // esos casos es más código del que merece la pena y más sitios donde
  // equivocarse.
  setTimeout(() => window.location.reload(), 600)
}

// ── Los foros de destino ──
//
// Los ESCONDIDOS solo se le ofrecen a administración: un foro sin abrir
// es una decisión de producto, no de moderación (el mismo criterio que
// usan las políticas del foro). Van marcados, que si no un foro oculto
// en el desplegable parece uno normal y el tema desaparece de la vista
// sin que quien lo movió sepa por qué.
async function cargarForos() {
  if (forosCache) return forosCache
  const [{ data: secciones }, { data: foros }] = await Promise.all([
    supabase.from('forum_sections').select('id, name, position').order('position', { ascending: true }),
    supabase
      .from('forum_boards')
      .select('id, name, section_id, parent_id, position, is_hidden')
      .order('position', { ascending: true }),
  ])
  const nombreSeccion = new Map((secciones || []).map((s) => [s.id, s.name]))
  const visibles = (foros || []).filter((f) => ctx.soyAdmin || !f.is_hidden)
  const conSeccion = visibles.map((f) => ({
    ...f,
    name: f.is_hidden ? `${f.name} (oculto)` : f.name,
    seccion: nombreSeccion.get(f.section_id) || 'Foro',
  }))
  forosCache = ordenarForos(conSeccion, secciones)
  return forosCache
}
