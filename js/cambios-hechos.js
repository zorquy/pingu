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

// Puro: el rótulo de confianza. Sin cambios, nada (un «0 cambios» no ayuda a
// nadie y señala a quien empieza).
export function textoDeConfianza(c) {
  const hechos = Number(c?.hechos) || 0, bien = Number(c?.bien) || 0
  if (!hechos) return ''
  const cuantos = hechos === 1 ? '1 cambio' : `${hechos.toLocaleString('es-ES')} cambios`
  if (bien >= hechos) return `${cuantos} · todos bien`
  if (!bien) return cuantos
  return `${cuantos} · ${bien} ${bien === 1 ? 'dijo' : 'dijeron'} que fue bien`
}

export async function cambiosDe(userId) {
  const { data, error } = await supabase.rpc('cambios_de', { p_user: userId })
  if (error) return null
  return Array.isArray(data) ? data[0] || null : data
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

// El rótulo al lado de cada persona (798, NU4): en Cruces y en el Mercado.
// Quien lo pinta deja un `<span data-confianza="<id>">` vacío y llama aquí;
// una llamada por persona y se recuerda, que una lista de cruces son unas
// pocas caras. Sin cambios hechos o sin la migración, se queda vacío.
const yaPedidos = new Map()
export async function ponerConfianza(raiz) {
  if (!raiz) return
  const huecos = [...raiz.querySelectorAll('[data-confianza]:empty')].slice(0, 30)
  await Promise.all(huecos.map(async (h) => {
    const id = h.dataset.confianza
    if (!yaPedidos.has(id)) yaPedidos.set(id, cambiosDe(id).catch(() => null))
    const t = textoDeConfianza(await yaPedidos.get(id))
    if (t && h.isConnected) h.textContent = t
  }))
}

// ── En el perfil y en el trato (tanda 1105, PINGU: «dale» a lo recomendado) ──

// El sello de confianza debajo del nombre, en los dos perfiles: «12 cambios ·
// todos bien», que abre la pestaña Cambios. Sin cambios, nada.
export async function ponerSello(sitio, userId, { alPulsar = null } = {}) {
  if (!sitio || !userId) return
  hojaInyectada('css/cambios-hechos.css')
  const t = textoDeConfianza(await cambiosDe(userId))
  sitio.querySelector('.perfil-confianza')?.remove()
  if (!t || !sitio.isConnected) return
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'perfil-confianza'
  b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>${escapeHtml(t)}`
  b.title = 'Cambios hechos en PokeDoc'
  if (alPulsar) b.addEventListener('click', alPulsar)
  sitio.appendChild(b)
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
