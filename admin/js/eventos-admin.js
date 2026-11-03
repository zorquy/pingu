// /admin → Eventos (tanda 1192): dar de alta, editar, publicar y borrar los
// eventos de la agenda (/eventos). El equipo escribe directo en `eventos` (la
// política `eventos_equipo` de supabase-migration-1192-eventos.sql deja solo a
// un admin). El logo se sube al cubo del equipo (`guide-images`) y se guarda
// su dirección; sin logo, la agenda pinta las siglas en su color.
//
// Desde la 1193 (PINGU: «el día 7 y 8 de noviembre, de 10 a 8, ambos días»;
// «la entrada normal, la VIP…»): los días se eligen en un calendario y llevan
// su horario (el mismo para todos o uno por día), y las entradas son una lista
// (nombre, precio, nota). Se guardan en `horario` y `entradas`; `empieza` y
// `termina` se siguen escribiendo con el primer y el último día, que es con lo
// que la agenda ordena. Sin la migración 1193 se guarda lo de siempre.
import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession, uploadGuideImage } from '../../js/app.js'
import { icons } from '../../js/icons.js'
import { showToast } from '../../js/toast.js'
import { sinMigracion } from '../../js/sin-migracion.js'
import {
  TIPOS, MESES, slugDeEvento, siglasDe, webSegura, horarioDe, mismoHorario, extremosDeHorario,
  fechaLarga, diaDe, fechaDeDia, entradasDe, resumenEntradas,
} from '../../js/eventos-puro.js'

const CAMPOS = ['nombre', 'tipo', 'sitio', 'direccion', 'ciudad', 'provincia', 'juegos', 'descripcion', 'web', 'instagram', 'tcgmap_url', 'logo_url', 'siglas', 'color']
const MESES_TITULO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const ic = (n, t = 16) => icons[n]?.(t) || ''

let raiz = null
let eventos = []
let editando = null
// ¿Está la migración 1193? Se pregunta una vez al abrir.
let con1193 = true
// Lo que se está editando de los días y las entradas (el resto vive en los campos).
let borr = null

async function cargar() {
  const { data, error } = await supabase.from('eventos').select('*').order('empieza', { ascending: false })
  if (error) {
    raiz.innerHTML = sinMigracion(error)
      ? '<p class="admin-note av-mal">Falta ejecutar <code>supabase-migration-1192-eventos.sql</code> en el SQL Editor. Hasta entonces la agenda dice «llega muy pronto».</p>'
      : `<p class="admin-note av-mal">No se han podido cargar los eventos: ${escapeHtml(error.message || '')}</p>`
    return
  }
  eventos = data || []
  const { error: sinCols } = await supabase.from('eventos').select('id, horario, entradas').limit(1)
  con1193 = !sinCols
  pintar()
}

// «7 NOV» o, si dura varios días, «7–8 NOV».
function fechaCorta(e) {
  const h = horarioDe(e)
  if (!h.length) return { dia: '', mes: '' }
  const a = fechaDeDia(h[0].dia)
  const b = fechaDeDia(h[h.length - 1].dia)
  const dia = h.length > 1 && a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()}` : String(a.getDate())
  return { dia, mes: `${MESES[a.getMonth()]} ${a.getFullYear()}` }
}

function filaHtml(e) {
  const f = fechaCorta(e)
  const pasado = new Date(e.termina || e.empieza) < new Date(new Date().setHours(0, 0, 0, 0))
  return `<div class="admin-card evadm-fila${pasado ? ' pasado' : ''}">
    <span class="evadm-fecha"><b>${escapeHtml(f.dia)}</b><small>${escapeHtml(f.mes)}</small></span>
    <span class="evadm-cuerpo"><b>${escapeHtml(e.nombre)}</b><small>${escapeHtml([TIPOS[e.tipo], e.sitio, e.ciudad].filter(Boolean).join(' · '))}</small></span>
    ${e.publicado === false ? '<span class="evadm-chapa">Sin publicar</span>' : ''}
    <a class="btn-secondary" href="/eventos/${encodeURIComponent(e.slug)}" target="_blank" rel="noopener">Ver</a>
    <button type="button" class="btn-secondary" data-ev-editar="${escapeHtml(e.id)}">Editar</button>
  </div>`
}

// ── Lo que se edita de los días y las entradas ──
function borradorDe(e) {
  const h = horarioDe(e)
  const dias = new Map(h.map((x) => [x.dia, { desde: x.desde, hasta: x.hasta }]))
  const comun = h.length ? { desde: h[0].desde, hasta: h[0].hasta } : { desde: '10:00', hasta: '20:00' }
  const primero = h.length ? fechaDeDia(h[0].dia) : new Date()
  let entradas = entradasDe(e).map((x) => ({ nombre: x.nombre, precio: x.precio === null ? '' : String(x.precio), nota: x.nota }))
  // Lo escrito antes de la 1193 en el texto de `entrada`: una fila con su
  // precio si se ve uno, y el texto entero de nota para no perder nada.
  if (!entradas.length && e?.entrada) {
    const m = /(\d+(?:[.,]\d+)?)\s*€/.exec(e.entrada)
    entradas = [{ nombre: 'General', precio: m ? m[1].replace(',', '.') : '', nota: e.entrada }]
  }
  if (!entradas.length) entradas = [{ nombre: 'General', precio: '', nota: '' }]
  return { dias, mismo: mismoHorario(h) || h.length <= 1, comun, mes: new Date(primero.getFullYear(), primero.getMonth(), 1), entradas }
}

const horarioDelBorrador = () => [...borr.dias.keys()].sort().map((dia) => {
  const h = borr.mismo ? borr.comun : borr.dias.get(dia)
  return { dia, desde: h.desde || '', hasta: h.hasta || '' }
})

function calendarioHtml() {
  const m = borr.mes
  const hoy = diaDe(new Date())
  const primero = new Date(m.getFullYear(), m.getMonth(), 1)
  const hueco = (primero.getDay() + 6) % 7 // la semana empieza en lunes
  const total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  const celdas = Array.from({ length: hueco }, () => '<span></span>')
  for (let d = 1; d <= total; d++) {
    const dia = diaDe(new Date(m.getFullYear(), m.getMonth(), d))
    const on = borr.dias.has(dia)
    celdas.push(`<button type="button" class="evadm-cal-dia${dia === hoy ? ' hoy' : ''}" data-cal-dia="${dia}" aria-pressed="${on}" aria-label="${d} de ${MESES_TITULO[m.getMonth()].toLowerCase()}">${d}</button>`)
  }
  return `<div class="evadm-cal-cab">
      <button type="button" class="evadm-cal-flecha" data-cal-mes="-1" aria-label="Mes anterior">${ic('chevronLeft', 18)}</button>
      <b>${MESES_TITULO[m.getMonth()]} ${m.getFullYear()}</b>
      <button type="button" class="evadm-cal-flecha" data-cal-mes="1" aria-label="Mes siguiente">${ic('chevronRight', 18)}</button>
    </div>
    <div class="evadm-cal-rejilla">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span class="evadm-cal-sem">${x}</span>`).join('')}${celdas.join('')}</div>`
}

function horasHtml() {
  const h = horarioDelBorrador()
  if (!h.length) return '<p class="av-nota">Toca en el calendario los días que dura. Pueden no ir seguidos.</p>'
  const par = (k, v) => `<span class="evadm-par"><label>De <input type="time" data-hora="${k}" data-lado="desde" value="${escapeHtml(v.desde || '')}"></label><label>a <input type="time" data-hora="${k}" data-lado="hasta" value="${escapeHtml(v.hasta || '')}"></label></span>`
  const filas = borr.mismo
    ? `<div class="evadm-hora-fila"><span>${h.length > 1 ? 'Todos los días' : 'Horario'}</span>${par('comun', borr.comun)}</div>`
    : h.map((x) => { const d = fechaDeDia(x.dia); return `<div class="evadm-hora-fila"><span>${DIAS_CORTOS[d.getDay()]} ${d.getDate()}</span>${par(x.dia, borr.dias.get(x.dia))}</div>` }).join('')
  return `<p class="evadm-resumen" id="evfResumen">${escapeHtml(fechaLarga({ horario: h }))}</p>
    ${h.length > 1 ? `<label class="av-interruptor"><input type="checkbox" id="evfMismo"${borr.mismo ? ' checked' : ''}> <span>Mismo horario todos los días</span></label>` : ''}
    ${filas}`
}

function entradasHtml() {
  return borr.entradas.map((x, i) => `<div class="evadm-entrada" data-entrada="${i}">
      <input type="text" data-campo="nombre" value="${escapeHtml(x.nombre)}" placeholder="General, VIP, Niños…" aria-label="Nombre de la entrada" maxlength="40">
      <span class="evadm-precio"><input type="number" data-campo="precio" value="${escapeHtml(x.precio)}" min="0" step="0.5" inputmode="decimal" placeholder="—" aria-label="Precio en euros"><span aria-hidden="true">€</span></span>
      <input type="text" data-campo="nota" value="${escapeHtml(x.nota)}" placeholder="Nota (opcional): entra a las 9, incluye sobre…" aria-label="Nota" maxlength="120">
      <button type="button" class="evadm-quitar" data-quitar-entrada="${i}" aria-label="Quitar esta entrada"${borr.entradas.length === 1 ? ' disabled' : ''}>${ic('x', 16)}</button>
    </div>`).join('')
}

function formHtml(e) {
  const v = (k) => escapeHtml(e?.[k] ?? '')
  const campo = (k, eti, extra = '') => `<label class="av-campo"><span class="av-eti">${eti}</span><input type="text" id="evf-${k}" value="${v(k)}" ${extra}></label>`
  return `<form class="admin-card evadm-form" id="evForm" novalidate>
    <h2>${e?.id ? 'Editar evento' : 'Nuevo evento'}</h2>
    ${con1193 ? '' : '<p class="admin-note av-mal">Falta ejecutar <code>supabase-migration-1193-eventos-dias-entradas.sql</code>: hasta entonces se guardan solo el primer y el último día y las entradas como texto, y no se puede elegir «Trade night».</p>'}
    <div class="evadm-rejilla">
      ${campo('nombre', 'Nombre *', 'maxlength="120" required placeholder="Iberian Card Show"')}
      <label class="av-campo"><span class="av-eti">Tipo</span><select id="evf-tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}"${(e?.tipo || 'card_show') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <fieldset class="evadm-grupo">
      <legend class="av-eti">Cuándo *</legend>
      <div class="evadm-cuando">
        <div class="evadm-cal" id="evfCal">${calendarioHtml()}</div>
        <div class="evadm-horas" id="evfHoras">${horasHtml()}</div>
      </div>
    </fieldset>
    <fieldset class="evadm-grupo">
      <legend class="av-eti">Entradas</legend>
      <div class="evadm-entradas" id="evfEntradas">${entradasHtml()}</div>
      <div class="evadm-entradas-pie">
        <button type="button" class="btn-secondary" id="evfMasEntrada">+ Añadir entrada</button>
        <span class="av-nota">Precio 0 = gratis; sin precio, «consultar».</span>
      </div>
    </fieldset>
    <div class="evadm-rejilla">
      ${campo('sitio', 'Sitio', 'placeholder="Pabellón Cristal"')}
      ${campo('direccion', 'Dirección', 'placeholder="Casa de Campo"')}
      ${campo('ciudad', 'Ciudad', 'placeholder="Madrid"')}
      ${campo('provincia', 'Provincia', 'placeholder="Madrid"')}
      ${campo('juegos', 'Juegos', 'placeholder="Pokémon · One Piece · Magic"')}
      ${campo('web', 'Web', 'placeholder="iberiancardshow.es"')}
      ${campo('instagram', 'Instagram', 'placeholder="@iberiancardshow"')}
      ${campo('tcgmap_url', 'Enlace a TCG Map Spain', 'placeholder="https://…"')}
      <label class="av-campo"><span class="av-eti">Dirección en PokeDoc</span><input type="text" id="evf-slug" value="${v('slug')}" placeholder="se pone sola con el nombre y el año" pattern="[a-z0-9-]+"></label>
    </div>
    <label class="av-campo"><span class="av-eti">Descripción</span><textarea id="evf-descripcion" rows="3" maxlength="1500">${v('descripcion')}</textarea></label>
    <div class="evadm-logo">
      <span class="ev-logo grande" id="evfLogoVista"></span>
      <div class="evadm-logo-mandos">
        <label class="av-campo"><span class="av-eti">Logo</span><input type="file" id="evf-logo" accept="image/*"></label>
        <input type="hidden" id="evf-logo_url" value="${v('logo_url')}">
        ${e?.logo_url ? '<button type="button" class="btn-secondary" id="evfQuitarLogo">Quitar el logo</button>' : ''}
        <div class="av-dos">
          ${campo('siglas', 'Siglas (sin logo)', 'maxlength="8" placeholder="IBE"')}
          <label class="av-campo"><span class="av-eti">Color</span><input type="color" id="evf-color" value="${/^#[0-9a-f]{6}$/i.test(e?.color || '') ? e.color : '#1f5175'}"></label>
        </div>
      </div>
    </div>
    <label class="av-interruptor"><input type="checkbox" id="evf-publicado" ${e?.publicado === false ? '' : 'checked'}> <span>Publicado (sale en la agenda)</span></label>
    <p class="av-nota av-mal" id="evfError" role="alert"></p>
    <div class="av-acciones">
      <button type="submit" class="btn-primary" id="evfGuardar">${e?.id ? 'Guardar' : 'Publicar el evento'}</button>
      <button type="button" class="btn-secondary" id="evfCancelar">Cancelar</button>
      ${e?.id ? `<button type="button" class="btn-secondary evadm-borrar" id="evfBorrar" data-paso="1">Borrar el evento</button>` : ''}
    </div>
  </form>`
}

function pintarLogo() {
  const vista = raiz.querySelector('#evfLogoVista')
  if (!vista) return
  const url = webSegura(raiz.querySelector('#evf-logo_url').value)
  const color = raiz.querySelector('#evf-color').value
  vista.style.setProperty('--ev-color', color)
  vista.innerHTML = `${url ? `<img src="${escapeHtml(url)}" alt="">` : ''}<b>${escapeHtml(siglasDe({ siglas: raiz.querySelector('#evf-siglas').value, nombre: raiz.querySelector('#evf-nombre').value }))}</b>`
}

const repintarCal = () => { raiz.querySelector('#evfCal').innerHTML = calendarioHtml() }
const repintarHoras = () => { raiz.querySelector('#evfHoras').innerHTML = horasHtml() }
// Lo escrito en las filas de entradas, al borrador (antes de repintarlas).
function leerEntradas() {
  raiz.querySelectorAll('[data-entrada]').forEach((fila) => {
    const x = borr.entradas[Number(fila.dataset.entrada)]
    if (!x) return
    fila.querySelectorAll('[data-campo]').forEach((inp) => { x[inp.dataset.campo] = inp.value })
  })
}
const repintarEntradas = () => { raiz.querySelector('#evfEntradas').innerHTML = entradasHtml() }

function pintar() {
  const proximos = eventos.filter((e) => new Date(e.termina || e.empieza) >= new Date(new Date().setHours(0, 0, 0, 0))).reverse()
  const pasados = eventos.filter((e) => !proximos.includes(e))
  raiz.innerHTML = `
    ${editando ? formHtml(editando) : '<button type="button" class="btn-primary" id="evNuevo">+ Nuevo evento</button>'}
    <h2 class="evadm-titulo">Próximos <span class="subtext">${proximos.length}</span></h2>
    ${proximos.length ? proximos.map(filaHtml).join('') : '<p class="admin-note">No hay eventos próximos.</p>'}
    ${pasados.length ? `<h2 class="evadm-titulo">Pasados <span class="subtext">${pasados.length}</span></h2>${pasados.map(filaHtml).join('')}` : ''}`
  if (editando) pintarLogo()
}

function abrirFormulario(e) {
  editando = e
  borr = editando ? borradorDe(editando) : null
  pintar()
}

async function guardar() {
  const val = (k) => raiz.querySelector(`#evf-${k}`)?.value.trim() || ''
  const err = raiz.querySelector('#evfError')
  leerEntradas()
  const fila = Object.fromEntries(CAMPOS.map((k) => [k, val(k) || null]))
  fila.color = val('color') || null
  fila.siglas = fila.siglas ? fila.siglas.toUpperCase() : null
  fila.publicado = raiz.querySelector('#evf-publicado').checked
  if (!fila.nombre || fila.nombre.length < 2) return (err.textContent = 'Ponle un nombre.')

  const horario = horarioDelBorrador()
  if (!horario.length) return (err.textContent = 'Elige en el calendario qué días es.')
  const malHora = horario.find((x) => x.desde && x.hasta && x.hasta <= x.desde)
  if (malHora) return (err.textContent = 'La hora de acabar va después de la de empezar.')
  const { empieza, termina } = extremosDeHorario(horario)
  fila.empieza = empieza
  fila.termina = termina

  const entradas = []
  for (const x of borr.entradas) {
    const nombre = x.nombre.trim()
    const precioTxt = String(x.precio ?? '').trim().replace(',', '.')
    if (!nombre && !precioTxt && !x.nota.trim()) continue
    const precio = precioTxt === '' ? null : Number(precioTxt)
    if (precio !== null && (Number.isNaN(precio) || precio < 0)) return (err.textContent = `El precio de «${nombre || 'la entrada'}» no es un número.`)
    entradas.push({ nombre: nombre || 'General', precio, nota: x.nota.trim() })
  }
  fila.entrada = resumenEntradas(entradas) || null
  if (con1193) { fila.horario = horario; fila.entradas = entradas }

  fila.slug = val('slug') || slugDeEvento(fila.nombre, fila.empieza)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fila.slug)) return (err.textContent = 'La dirección solo lleva minúsculas, números y guiones.')
  const boton = raiz.querySelector('#evfGuardar')
  boton.disabled = true
  fila.updated_at = new Date().toISOString()
  const consulta = editando.id
    ? supabase.from('eventos').update(fila).eq('id', editando.id).select().single()
    : supabase.from('eventos').insert({ ...fila, creado_por: (await getSession())?.user?.id || null }).select().single()
  const { error } = await consulta
  boton.disabled = false
  if (error) {
    const m = error.message || ''
    err.textContent = /duplicate|unique/i.test(m) ? 'Ya hay un evento con esa dirección: cámbiala.'
      : /tipo_check/.test(m) ? '«Trade night» necesita la migración 1193 (supabase-migration-1193-eventos-dias-entradas.sql).'
        : `No se ha podido guardar: ${m}`
    return
  }
  showToast(editando.id ? 'Evento guardado.' : 'Evento publicado.', 'success')
  abrirFormulario(null)
  await cargar()
}

export async function montarEventos(panel) {
  raiz = panel
  raiz.addEventListener('click', async (ev) => {
    if (ev.target.closest('#evNuevo')) { abrirFormulario({}); raiz.querySelector('#evf-nombre')?.focus(); return }
    const ed = ev.target.closest('[data-ev-editar]')
    if (ed) { abrirFormulario(eventos.find((e) => e.id === ed.dataset.evEditar) || null); raiz.scrollIntoView({ behavior: 'smooth' }); return }
    if (ev.target.closest('#evfCancelar')) { abrirFormulario(null); return }
    if (ev.target.closest('#evfQuitarLogo')) { raiz.querySelector('#evf-logo_url').value = ''; ev.target.closest('#evfQuitarLogo').remove(); pintarLogo(); return }
    const dia = ev.target.closest('[data-cal-dia]')
    if (dia) {
      const k = dia.dataset.calDia
      if (borr.dias.has(k)) borr.dias.delete(k)
      else borr.dias.set(k, { ...borr.comun })
      if (borr.dias.size <= 1) borr.mismo = true
      repintarCal(); repintarHoras()
      return
    }
    const mes = ev.target.closest('[data-cal-mes]')
    if (mes) { borr.mes = new Date(borr.mes.getFullYear(), borr.mes.getMonth() + Number(mes.dataset.calMes), 1); repintarCal(); return }
    if (ev.target.closest('#evfMasEntrada')) {
      leerEntradas()
      borr.entradas.push({ nombre: '', precio: '', nota: '' })
      repintarEntradas()
      raiz.querySelector(`[data-entrada="${borr.entradas.length - 1}"] [data-campo="nombre"]`)?.focus()
      return
    }
    const quitar = ev.target.closest('[data-quitar-entrada]')
    if (quitar) { leerEntradas(); borr.entradas.splice(Number(quitar.dataset.quitarEntrada), 1); repintarEntradas(); return }
    const borrar = ev.target.closest('#evfBorrar')
    if (borrar) {
      // Dos pasos y en la página (confirm() no sale en todas partes).
      if (borrar.dataset.paso === '1') { borrar.dataset.paso = '2'; borrar.textContent = '¿Seguro? Se borra con quién iba'; return }
      const { error } = await supabase.from('eventos').delete().eq('id', editando.id)
      if (error) return showToast(`No se ha podido borrar: ${error.message || ''}`)
      showToast('Evento borrado.', 'success')
      abrirFormulario(null)
      await cargar()
    }
  })
  raiz.addEventListener('submit', (ev) => { ev.preventDefault(); guardar() })
  raiz.addEventListener('input', (ev) => {
    if (/^evf-(siglas|nombre|color)$/.test(ev.target.id)) pintarLogo()
    const h = ev.target.closest('[data-hora]')
    if (h) {
      const destino = h.dataset.hora === 'comun' ? borr.comun : borr.dias.get(h.dataset.hora)
      if (destino) destino[h.dataset.lado] = h.value
      const r = raiz.querySelector('#evfResumen')
      if (r) r.textContent = fechaLarga({ horario: horarioDelBorrador() })
    }
  })
  raiz.addEventListener('change', async (ev) => {
    if (ev.target.id === 'evfMismo') {
      // Al separar, cada día empieza con el horario común; al juntar, manda el del primero.
      if (!ev.target.checked) for (const d of borr.dias.values()) Object.assign(d, borr.comun)
      else { const pri = borr.dias.get([...borr.dias.keys()].sort()[0]); if (pri) borr.comun = { ...pri } }
      borr.mismo = ev.target.checked
      repintarHoras()
      return
    }
    if (ev.target.id !== 'evf-logo' || !ev.target.files?.[0]) return
    const err = raiz.querySelector('#evfError')
    try {
      const sesion = await getSession()
      const url = await uploadGuideImage(sesion.user.id, ev.target.files[0])
      raiz.querySelector('#evf-logo_url').value = url
      err.textContent = ''
      pintarLogo()
    } catch (e) {
      err.textContent = `No se ha podido subir el logo: ${e.message || ''}`
    }
  })
  await cargar()
}
