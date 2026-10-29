// LOS DATOS DE UN TRATO: la dirección de envío (tanda 1102; propuesta «La
// dirección en los cambios por correo») y el Bizum o PayPal de quien cobra
// (1107, al final). Tu dirección guardada (`user_direcciones`, solo tuya) y la de
// cada trato (`cambio_direccion_poner` / `cambio_direcciones`, migración
// supabase-migration-1102-cambio-direccion.sql). Lo usan la propuesta
// (js/cambio-propuesta.js) y Ajustes → Dirección de envío.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { CAMPOS_DIRECCION, validarDireccion, lineasDeDireccion, COMOS_CON_DATO, validarCobro } from './cambio-propuesta-puro.js'

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

// ── EL COBRO (1107): el Bizum o el PayPal de quien cobra ──
// Migración supabase-migration-1107-cambio-cobro.sql. Las mismas formas que la
// dirección: lo tuyo guardado (`user_cobros`), lo de cada trato por sus dos
// funciones.
export const MIGRACION_COBRO = 'supabase-migration-1107-cambio-cobro.sql'
let cobroGuardado = { yo: null, fila: undefined }

// Tu Bizum y tu PayPal guardados: { bizum, paypal }, null si no tienes,
// undefined si no se sabe.
export async function miCobro(yo) {
  if (!yo) return undefined
  if (cobroGuardado.yo === yo && cobroGuardado.fila !== undefined) return cobroGuardado.fila
  const { data, error } = await supabase.from('user_cobros').select('bizum,paypal').eq('user_id', yo).maybeSingle()
  if (error) return undefined
  cobroGuardado = { yo, fila: data || null }
  return cobroGuardado.fila
}

// Guardar uno o los dos (lo que no va en `campos` no se toca).
export async function guardarMiCobro(yo, campos) {
  const { error } = await supabase.from('user_cobros').upsert({ user_id: yo, ...campos, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (!error) cobroGuardado = { yo, fila: { ...(cobroGuardado.yo === yo ? cobroGuardado.fila || {} : {}), ...campos } }
  return error || null
}

export async function ponerCobroEnTrato(oferta, dato) {
  const { error } = await supabase.rpc('cambio_cobro_poner', { p_oferta: oferta, p_dato: dato })
  return error || null
}

// { oferta: { quien: { como, dato } } }, o null si no se sabe.
export async function cobrosDe(ofertas) {
  if (!ofertas.length) return {}
  const { data, error } = await supabase.rpc('cambio_cobros', { p_ofertas: ofertas })
  if (error) return null
  const por = {}
  for (const c of data || []) (por[c.oferta] ||= {})[c.quien] = c
  return por
}

// El campo para el Bizum o el PayPal, con «Guardarlo para los próximos».
export function cobroElegirHtml(como, dato = '') {
  const c = COMOS_CON_DATO[como]
  if (!c) return ''
  return `<div class="cp-dir" data-cp-cobro="${como}">
    <label class="cp-campo"><span>${escapeHtml(c.campo)}</span><input type="${c.tipo}" data-cobro maxlength="120" autocomplete="${c.auto}"${como === 'bizum' ? ' inputmode="tel"' : ''} placeholder="${escapeHtml(c.ejemplo)}" value="${escapeHtml(dato || '')}"></label>
    <label class="cp-dir-guardar"><input type="checkbox" data-cobro-guardar checked> Guardarlo para los próximos</label>
    <p class="cp-dir-error" role="alert" hidden></p>
  </div>`
}

// Lo escrito: { como, dato, guardar, error }; el error se pinta en la caja.
export function leerCobro(raiz) {
  const caja = raiz?.matches?.('[data-cp-cobro]') ? raiz : raiz?.querySelector('[data-cp-cobro]')
  if (!caja) return { error: 'Falta el dato.' }
  const como = caja.dataset.cpCobro
  const { dato, error } = validarCobro(como, caja.querySelector('[data-cobro]')?.value)
  const aviso = caja.querySelector('.cp-dir-error')
  if (aviso) { aviso.textContent = error || ''; aviso.hidden = !error }
  return { como, dato, guardar: Boolean(caja.querySelector('[data-cobro-guardar]')?.checked), error }
}
