// Confianza en los cambios (tanda 795, NU4): «Cambio hecho» entre dos
// personas que han hablado, y «todo bien» / «hubo un problema» después. Lo
// que se enseña de alguien es «12 cambios · todos bien»; los problemas solo
// los ve la moderación. Todo pasa por las funciones de
// supabase-migration-cambios-hechos.sql: sin ella, nada se pinta.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'

export const FICHERO_MIGRACION = 'supabase-migration-cambios-hechos.sql'
const sinMigracion = (e) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e?.code) || /Could not find|does not exist/i.test(e?.message || '')

// LA REPUTACIÓN (1224, PINGU: «que se vea que has completado trades… y así
// ver que eres confiable»). Cuenta los tratos HECHOS (cambio, venta o compra
// que llegan a «Hecho», y los «Cambio hecho» de Mensajes) y cómo dijo el otro
// que fue. Cuatro niveles (PINGU eligió los recomendados): «Nuevo en los
// cambios» sin ninguno, «N tratos», «De fiar» con 5 o más y ningún problema,
// y «Muy de fiar» con 20 o más y al menos un 95 % «todo bien». Los problemas
// no se cuentan en público: si alguno salió mal se dice el tanto por ciento.
export const NOMBRE_DE_NIVEL = { nuevo: 'Nuevo en los cambios', tratos: '', fiar: 'De fiar', muy: 'Muy de fiar' }

// Puro. `c`: { hechos, bien, problemas? } (sin la migración 1224 no hay
// `problemas`: entonces solo cuenta «bien»).
export function nivelDe(c) {
  const hechos = Number(c?.hechos) || 0
  const bien = Number(c?.bien) || 0
  if (!hechos) return 'nuevo'
  const problemas = c?.problemas == null ? null : Number(c.problemas) || 0
  const valorados = bien + (problemas || 0)
  if (hechos >= 20 && valorados && bien / valorados >= 0.95) return 'muy'
  if (hechos >= 5 && (problemas === null ? bien >= hechos : !problemas)) return 'fiar'
  return 'tratos'
}

// Puro: el rótulo de confianza. Sin tratos, nada (un «0» no ayuda a nadie y
// señala a quien empieza), salvo donde se pide decirlo (`nuevo`: al lado de
// alguien con quien vas a tratar).
export function textoDeConfianza(c, { nuevo = false } = {}) {
  const hechos = Number(c?.hechos) || 0
  const bien = Number(c?.bien) || 0
  if (!hechos) return nuevo && c ? NOMBRE_DE_NIVEL.nuevo : ''
  const cuantos = hechos === 1 ? '1 trato' : `${hechos.toLocaleString('es-ES')} tratos`
  const nivel = nivelDe(c)
  if (nivel === 'muy' || nivel === 'fiar') return `${NOMBRE_DE_NIVEL[nivel]} · ${cuantos}`
  const problemas = c?.problemas == null ? null : Number(c.problemas) || 0
  if (problemas) return `${cuantos} · ${Math.round((bien / (bien + problemas)) * 100)} % bien`
  if (bien >= hechos) return `${cuantos} · todos bien`
  return cuantos
}

export async function cambiosDe(userId) {
  const { data, error } = await supabase.rpc('cambios_de', { p_user: userId })
  if (error) return null
  return Array.isArray(data) ? data[0] || null : data
}

// La reputación entera (1224): con la migración, de `reputacion_de`
// (hechos, bien, problemas, cambios, ventas, compras, primero y último);
// sin ella, lo de `cambios_de` (hechos y bien), que sigue valiendo.
export const FICHERO_REPUTACION = 'supabase-migration-1224-reputacion.sql'
export async function reputacionDe(userId) {
  const { data, error } = await supabase.rpc('reputacion_de', { p_user: userId })
  const fila = error ? null : (Array.isArray(data) ? data[0] : data) || null
  if (fila) return fila
  // Sin la función (o si falla), lo de antes: el sello no se pierde por esto.
  return cambiosDe(userId)
}

// Los cambios con UNA persona, para saber qué botón toca en la conversación.
export async function cambiosCon(yo, otro) {
  const [a, b] = [yo, otro].sort()
  const { data, error } = await supabase.from('trade_confirmations').select('*').eq('user_a', a).eq('user_b', b).order('created_at', { ascending: false }).limit(5)
  if (error) return sinMigracion(error) ? null : []
  return data || []
}

// Qué le toca hacer a `yo` con el último cambio con esa persona. Puro.
export function estadoDelCambio(filas, yo) {
  const f = (filas || [])[0]
  if (!f) return { paso: 'marcar' }
  const soyA = f.user_a === yo
  const mio = soyA ? f.hecho_a_at : f.hecho_b_at, suyo = soyA ? f.hecho_b_at : f.hecho_a_at
  const valoracion = soyA ? f.valoracion_a : f.valoracion_b
  if (mio && suyo) return valoracion ? { paso: 'hecho', fila: f, valoracion } : { paso: 'valorar', fila: f }
  if (mio) return { paso: 'esperando', fila: f }
  return { paso: suyo ? 'confirmar' : 'marcar', fila: f }
}

export async function marcarCambio(otro) {
  const { data, error } = await supabase.rpc('cambio_marcar', { p_otro: otro })
  if (error) throw new Error(sinMigracion(error) ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message)
  return data
}

export async function valorarCambio(id, valor, nota = null) {
  const { error } = await supabase.rpc('cambio_valorar', { p_id: id, p_valor: valor, p_nota: nota })
  if (error) throw new Error(sinMigracion(error) ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message)
}

// El rótulo al lado de cada persona (798, NU4): en Cruces, el Mercado, la
// propuesta, el trato y Mensajes. Con `data-confianza-nuevo`, quien aún no ha
// cerrado ninguno sale «Nuevo en los cambios» (1224). Su color, por nivel
// (`data-nivel`, css/cambios-hechos.css).
// Quien lo pinta deja un `<span data-confianza="<id>">` vacío y llama aquí;
// una llamada por persona y se recuerda, que una lista de cruces son unas
// pocas caras. Sin cambios hechos o sin la migración, se queda vacío.
const yaPedidos = new Map()
export async function ponerConfianza(raiz) {
  if (!raiz) return
  hojaInyectada('css/cambios-hechos.css')
  const huecos = [...raiz.querySelectorAll('[data-confianza]:empty')].slice(0, 30)
  await Promise.all(huecos.map(async (h) => {
    const id = h.dataset.confianza
    if (!yaPedidos.has(id)) yaPedidos.set(id, reputacionDe(id).catch(() => null))
    const r = await yaPedidos.get(id)
    const t = textoDeConfianza(r, { nuevo: h.hasAttribute('data-confianza-nuevo') })
    if (t && h.isConnected) {
      h.textContent = t
      h.dataset.nivel = nivelDe(r)
    }
  }))
}

// ── En el perfil y en el trato (tanda 1105, PINGU: «dale» a lo recomendado) ──

// El sello de confianza debajo del nombre, en los dos perfiles: «12 cambios ·
// todos bien», que abre la pestaña Cambios. Sin cambios, nada.
export async function ponerSello(sitio, userId, { alPulsar = null } = {}) {
  if (!sitio || !userId) return
  hojaInyectada('css/cambios-hechos.css')
  const r = await reputacionDe(userId)
  const t = textoDeConfianza(r)
  sitio.querySelector('.perfil-confianza')?.remove()
  if (!t || !sitio.isConnected) return
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'perfil-confianza'
  b.dataset.nivel = nivelDe(r)
  b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>${escapeHtml(t)}`
  b.title = 'Tratos hechos en PokeDoc'
  if (alPulsar) b.addEventListener('click', alPulsar)
  sitio.appendChild(b)
}

// La tarjeta de reputación (1224), arriba de la pestaña Cambios del perfil:
// el nivel con su escudo, cuántos tratos de cada tipo, el último y desde
// cuándo. Con quién no sale nunca. Sin tratos, nada.
const mesYAnio = (iso) => new Date(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
export function tarjetaDeReputacionHtml(r, { ahora = Date.now() } = {}) {
  const hechos = Number(r?.hechos) || 0
  if (!hechos) return ''
  const nivel = nivelDe(r)
  const titulo = NOMBRE_DE_NIVEL[nivel] || (hechos === 1 ? '1 trato hecho' : `${hechos.toLocaleString('es-ES')} tratos hechos`)
  const sub = textoDeConfianza(r).split(' · ').slice(1).join(' · ') || (NOMBRE_DE_NIVEL[nivel] ? `${hechos} tratos hechos` : '')
  const falta = nivel === 'fiar' ? Math.max(0, 20 - hechos) : nivel === 'tratos' ? Math.max(0, 5 - hechos) : 0
  const siguiente = nivel === 'fiar' ? 'Muy de fiar' : 'De fiar'
  const porTipo = r?.cambios == null ? '' : `<div class="rep-cifras">${[['cambios', 'Cambios'], ['ventas', 'Ventas'], ['compras', 'Compras']].map(([k, t]) => `<div><b>${(Number(r[k]) || 0).toLocaleString('es-ES')}</b><small>${t}</small></div>`).join('')}</div>`
  const dias = r?.ultimo ? Math.floor((ahora - new Date(r.ultimo).getTime()) / 864e5) : null
  const ultimo = dias == null ? '' : `<span>Último trato: ${dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`}</span>`
  const desde = r?.primero ? `<span>Cambiando en PokeDoc desde ${escapeHtml(mesYAnio(r.primero))}</span>` : ''
  return `<section class="rep-tarjeta" data-nivel="${nivel}" aria-label="Reputación en los cambios">
    <div class="rep-cab"><svg class="rep-escudo" viewBox="0 0 44 48" aria-hidden="true"><path d="M22 2 4 9v13c0 12 8 21 18 24 10-3 18-12 18-24V9L22 2Z"/><path class="rep-ok" d="m14 24 6 6 11-12"/></svg><span class="rep-t"><b>${escapeHtml(titulo)}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</span>${falta ? `<span class="rep-falta">${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para «${siguiente}»</span>` : ''}</div>
    ${porTipo}
    ${ultimo || desde ? `<div class="rep-datos">${ultimo}${desde}</div>` : ''}
  </section>`
}

export async function ponerTarjetaDeReputacion(caja, userId) {
  if (!caja || !userId) return
  hojaInyectada('css/cambios-hechos.css')
  const html = tarjetaDeReputacionHtml(await reputacionDe(userId))
  caja.querySelector(':scope > .rep-tarjeta')?.remove()
  if (html && caja.isConnected) caja.insertAdjacentHTML('afterbegin', html)
}

// Tus últimos cambios hechos (los dos lo confirmaron), o null si no se sabe.
export async function ultimosHechos(yo, limite = 5) {
  const { data, error } = await supabase.from('trade_confirmations').select('*')
    .or(`user_a.eq.${yo},user_b.eq.${yo}`).not('hecho_a_at', 'is', null).not('hecho_b_at', 'is', null)
    .order('created_at', { ascending: false }).limit(limite)
  if (error) return null
  return data || []
}

// Unas filas por id (las de los tratos hechos), o un mapa vacío.
export async function confirmacionesPorId(ids) {
  if (!ids.length) return new Map()
  const { data, error } = await supabase.from('trade_confirmations').select('*').in('id', ids)
  return new Map(error ? [] : (data || []).map((f) => [f.id, f]))
}

// Puro: lo que dijo `yo` de ese cambio, y quién era el otro.
export const miValoracion = (fila, yo) => (fila?.user_a === yo ? fila?.valoracion_a : fila?.valoracion_b) || null
export const elOtroDe = (fila, yo) => (fila?.user_a === yo ? fila?.user_b : fila?.user_a)

// «¿Qué tal fue?» con sus dos botones. Lo engancha `engancharValorar`.
export const valorarHtml = (id, nombre = '') => `<div class="cv-valorar" data-cv-conf="${escapeHtml(id)}">
    <span class="cv-pregunta">¿Qué tal fue${nombre ? ` con ${escapeHtml(nombre)}` : ''}?</span>
    <span class="cv-botones"><button type="button" class="btn-secondary" data-cv="bien">Todo bien</button><button type="button" class="btn-secondary" data-cv="problema">Hubo un problema</button></span>
  </div>`

// Un oyente por caja. Cambia ya y, si la base dice que no, vuelve (896).
export function engancharValorar(caja, alAcabar = null) {
  if (!caja) return
  hojaInyectada('css/cambios-hechos.css')
  if (caja.dataset.cvEnganchado) return
  caja.dataset.cvEnganchado = '1'
  caja.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-cv]')
    const bloque = b?.closest('[data-cv-conf]')
    if (!bloque) return
    const valor = b.dataset.cv
    const nota = valor === 'problema' ? window.prompt('Cuéntale a la moderación qué pasó (no lo verá nadie más):', '') : null
    if (valor === 'problema' && nota === null) return
    const antes = bloque.innerHTML
    bloque.innerHTML = `<span class="cv-pregunta">${valor === 'bien' ? 'Dijiste que fue bien. ¡Gracias!' : 'Lo verá la moderación.'}</span>`
    try {
      await valorarCambio(bloque.dataset.cvConf, valor, nota)
      alAcabar?.()
    } catch (err) {
      bloque.innerHTML = `${antes}<span class="cv-error" role="alert">${escapeHtml(err.message)}</span>`
    }
  })
}
