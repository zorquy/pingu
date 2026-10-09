// El modo feria (tanda 794, NU5): tu QR en grande y tus listas de «doy» y
// «busco», guardadas en el móvil. En un pabellón no hay cobertura: si no se
// puede preguntar, se enseña lo último que se guardó y cuándo.
import { supabase } from './supabase.js'
import { getSession, getProfile, escapeHtml } from './app.js'
import { svgQR } from './qr.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pd-feria-v1'

export function enlaceDeFeria(perfil, origen = 'https://pokedoc.es') {
  return perfil?.username ? `${origen}/usuario/${encodeURIComponent(perfil.username)}?cruce=1` : `${origen}/usuario.html?id=${encodeURIComponent(perfil?.id || '')}&cruce=1`
}

function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null') } catch { return null }
}
function guardar(d) {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)) } catch {}
}

async function nombres(ids) {
  const fuera = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from('tcg_cards').select('id,name,name_es,name_en,local_id,set_id').in('id', ids.slice(i, i + 150))
    if (error) throw error
    for (const c of data || []) fuera.set(c.id, c)
  }
  return fuera
}

async function pedir(sesion) {
  const perfil = await getProfile(sesion.user.id)
  const [{ data: doy, error: e1 }, { data: busco, error: e2 }] = await Promise.all([
    supabase.from('user_collection').select('card_id,cambio').eq('user_id', sesion.user.id).gt('cambio', 0).limit(500),
    supabase.from('user_wants').select('card_id').eq('user_id', sesion.user.id).limit(500),
  ])
  if (e1 || e2) throw e1 || e2
  const { nombreDeCarta } = await import('./catalogo-series.js')
  const cartas = await nombres([...new Set([...(doy || []), ...(busco || [])].map((f) => f.card_id))])
  const fila = (f) => { const c = cartas.get(f.card_id); return { n: f.cambio || 1, nombre: c ? nombreDeCarta(c) : f.card_id, num: c ? `${c.set_id} ${c.local_id}` : '' } }
  return { cuando: new Date().toISOString(), enlace: enlaceDeFeria(perfil), nombre: perfil?.display_name || perfil?.username || '', doy: (doy || []).map(fila), busco: (busco || []).map(fila) }
}

function pintar(d, desdeGuardado) {
  $('feriaQr').innerHTML = `${svgQR(d.enlace, { tam: 280 })}<strong>${escapeHtml(d.nombre)}</strong>`
  const li = (f) => `<li>${f.n > 1 ? `<b>${f.n}×</b> ` : ''}${escapeHtml(f.nombre)}${f.num ? ` <small>${escapeHtml(f.num)}</small>` : ''}</li>`
  $('feriaDoy').innerHTML = d.doy.length ? d.doy.map(li).join('') : '<li class="subtext">Nada apuntado para dar.</li>'
  $('feriaBusco').innerHTML = d.busco.length ? d.busco.map(li).join('') : '<li class="subtext">Nada en La quiero.</li>'
  const cuando = new Date(d.cuando).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  $('feriaGuardado').textContent = desdeGuardado ? `Sin conexión: tus listas tal como estaban el ${cuando}.` : `Guardado en este móvil (${cuando}).`
}

async function iniciar() {
  const guardado = leerGuardado()
  const sesion = await getSession().catch(() => null)
  if (!sesion) {
    if (guardado) return pintar(guardado, true)
    $('feriaQr').innerHTML = `<p class="empty-state"><a href="/auth.html?volver=/feria">Entra</a> para tener tu QR y tus listas.</p>`
    return
  }
  try {
    const d = await pedir(sesion)
    guardar(d)
    pintar(d, false)
  } catch {
    if (guardado) pintar(guardado, true)
    else $('feriaQr').innerHTML = '<p class="empty-state">No se han podido traer tus listas. Prueba con cobertura.</p>'
  }
}

if (typeof document !== 'undefined' && document.getElementById('feriaQr')) iniciar()
