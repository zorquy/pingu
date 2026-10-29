// LA DIRECCIÓN DE ENVÍO (tanda 1102; propuesta «La dirección en los cambios
// por correo»). Tu dirección guardada (`user_direcciones`, solo tuya) y la de
// cada trato (`cambio_direccion_poner` / `cambio_direcciones`, migración
// supabase-migration-1102-cambio-direccion.sql). Lo usan la propuesta
// (js/cambio-propuesta.js) y Ajustes → Dirección de envío.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { CAMPOS_DIRECCION, validarDireccion, lineasDeDireccion } from './cambio-propuesta-puro.js'

export const MIGRACION_DIRECCION = 'supabase-migration-1102-cambio-direccion.sql'
export const faltaLaMigracion = (e) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e?.code) || /Could not find|does not exist/i.test(e?.message || '')

const COLUMNAS = 'nombre,calle,cp,ciudad,provincia,telefono'
let guardada = { yo: null, fila: undefined }

// Tu dirección guardada: la fila, null si no tienes, undefined si no se sabe
// (sin la migración o sin red). Se recuerda mientras dure la página.
export async function miDireccion(yo) {
  if (!yo) return undefined
  if (guardada.yo === yo && guardada.fila !== undefined) return guardada.fila
  const { data, error } = await supabase.from('user_direcciones').select(COLUMNAS).eq('user_id', yo).maybeSingle()
  if (error) return undefined
  guardada = { yo, fila: data || null }
  return guardada.fila
}

// Guardarla (o cambiarla). Devuelve el error, o null.
export async function guardarMiDireccion(yo, dir) {
  const { error } = await supabase.from('user_direcciones').upsert({ user_id: yo, ...dir, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (!error) guardada = { yo, fila: { ...dir } }
  return error || null
}

export async function borrarMiDireccion(yo) {
  const { error } = await supabase.from('user_direcciones').delete().eq('user_id', yo)
  if (!error) guardada = { yo, fila: null }
  return error || null
}

// Ponerla en un trato. Devuelve el error, o null.
export async function ponerEnTrato(oferta, dir) {
  const { error } = await supabase.rpc('cambio_direccion_poner', { p_oferta: oferta, p_dir: dir })
  return error || null
}

// Las direcciones de unos tratos: { oferta: { quien: dirección } }, o null si
// no se sabe (sin la migración): entonces la web hace como antes.
export async function direccionesDe(ofertas) {
  if (!ofertas.length) return {}
  const { data, error } = await supabase.rpc('cambio_direcciones', { p_ofertas: ofertas })
  if (error) return null
  const por = {}
  for (const d of data || []) (por[d.oferta] ||= {})[d.quien] = d
  return por
}

// La dirección como en un sobre.
export const direccionHtml = (d, clase = 'cp-dir-texto') => `<address class="${clase}">${lineasDeDireccion(d).map((l, i) => (i ? escapeHtml(l) : `<b>${escapeHtml(l)}</b>`)).join('<br>')}</address>`

// Los campos, sin ids (puede haber varios a la vez en una página): cada uno
// dentro de su etiqueta.
export function camposHtml(d = {}) {
  const campo = (c) => `<label class="cp-campo cp-campo-${c.id}"><span>${escapeHtml(c.nombre)}${c.opcional ? ' <small>(opcional)</small>' : ''}</span><input type="${c.id === 'telefono' ? 'tel' : 'text'}" data-dir="${c.id}" maxlength="${c.max}" autocomplete="${c.auto}"${c.id === 'cp' ? ' inputmode="numeric"' : ''} value="${escapeHtml(d?.[c.id] || '')}"></label>`
  return `<div class="cp-campos">${CAMPOS_DIRECCION.map(campo).join('')}</div>`
}

// Elegir la dirección: la guardada con «Cambiar», o el formulario (con
// «Guardarla para los próximos cambios»). Se lee con `leerElegida`.
export function elegirHtml(d) {
  const tiene = Boolean(d?.calle)
  return `<div class="cp-dir" data-cp-dir>
    ${tiene ? `<div class="cp-dir-guardada">${direccionHtml(d)}<button type="button" class="link-btn" data-cp-dir-cambiar>Cambiar</button></div>` : ''}
    <div class="cp-dir-form"${tiene ? ' hidden' : ''}>${camposHtml(d)}
      <label class="cp-dir-guardar"><input type="checkbox" data-dir-guardar checked> Guardarla para los próximos cambios</label></div>
    <p class="cp-dir-error" role="alert" hidden></p>
  </div>`
}

// Lo elegido: { dir, guardar, error }. Si se dejó la guardada, no se vuelve
// a guardar.
export function leerElegida(raiz) {
  const caja = raiz?.matches?.('[data-cp-dir]') ? raiz : raiz?.querySelector('[data-cp-dir]')
  if (!caja) return { dir: null, guardar: false, error: 'Pon tu dirección.' }
  const crudo = {}
  for (const i of caja.querySelectorAll('[data-dir]')) crudo[i.dataset.dir] = i.value
  const { dir, error } = validarDireccion(crudo)
  const form = caja.querySelector('.cp-dir-form')
  const guardar = Boolean(form && !form.hidden && caja.querySelector('[data-dir-guardar]')?.checked)
  const aviso = caja.querySelector('.cp-dir-error')
  if (aviso) { aviso.textContent = error || ''; aviso.hidden = !error }
  if (error && form?.hidden) form.hidden = false
  return { dir, guardar, error }
}

// «Cambiar» enseña el formulario (lo engancha quien pinta).
export function abrirFormulario(boton) {
  const caja = boton.closest('[data-cp-dir]')
  caja.querySelector('.cp-dir-guardada')?.setAttribute('hidden', '')
  caja.querySelector('.cp-dir-form')?.removeAttribute('hidden')
  caja.querySelector('[data-dir]')?.focus()
}
