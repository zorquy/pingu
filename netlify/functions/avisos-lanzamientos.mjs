// Los avisos de lanzamientos (tanda 753, P2): «avísame cuando salga».
//
// Una vez al día, por la mañana: lee los avisos (`user_release_alerts`),
// busca la fecha de cada set —en `tcg_sets`, o en la lista a mano de
// /admin (`site_settings.lanzamientos`) para los anunciados— y, si toca,
// apunta el aviso como enviado y DESPUÉS deja la notificación (la
// campanita; `enviar-push` la empuja al móvil). Apuntar primero es la
// regla de la 665: si lo de después falla, se pierde un aviso; al revés,
// se repetiría cada mañana.
//
// Cuándo toca, con margen por si un día no corre:
//   · semana   — faltan entre 5 y 7 días;
//   · día      — sale hoy o salió ayer;
//   · preventa — abre hoy o abrió ayer (solo si se sabe la fecha).
//
// Cero peticiones de pago: todo sale de nuestra base. Sin la tabla (falta
// la migración), no hace nada y lo dice.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { normalizeSearch } from '../../js/texto.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const TOPE_AVISOS = 5000
export const TIPO_NOTIFICACION = 'lanzamiento'

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}
async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), prefer: 'return=minimal', ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}
const lista = (ids) => ids.map((s) => `"${encodeURIComponent(s)}"`).join(',')

// Hoy en España, como «2026-10-07»: el día que sale un set es el de aquí.
export function hoyEnEspana(ahora = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora)
}
export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000)
}
// La clave de un set de la lista a mano: la misma que pone la web.
export const claveManual = (nombre) => `manual:${normalizeSearch(nombre)}`

// Qué avisos tocan hoy para una fila. Puro.
export function avisosDeHoy(aviso, { fecha, preventa = null } = {}, hoy) {
  const ya = new Set(aviso.enviados || [])
  const fuera = []
  if (fecha) {
    const d = diasEntre(hoy, fecha)
    if (aviso.semana && !ya.has('semana') && d >= 5 && d <= 7) fuera.push({ tipo: 'semana', dias: d })
    if (aviso.dia && !ya.has('dia') && d <= 0 && d >= -1) fuera.push({ tipo: 'dia', dias: d })
  }
  if (preventa && aviso.preventa && !ya.has('preventa')) {
    const p = diasEntre(hoy, preventa)
    if (p <= 0 && p >= -1) fuera.push({ tipo: 'preventa', dias: p })
  }
  return fuera
}

export function textoDelAviso(aviso, { tipo, dias }, href) {
  const n = aviso.nombre
  if (tipo === 'semana') return { title: `${n} sale en ${dias} días`, body: 'Lo pediste en Lanzamientos: te avisamos una semana antes.', link: href || '/lanzamientos.html' }
  if (tipo === 'dia') return { title: dias === 0 ? `Hoy sale ${n}` : `${n} ya ha salido`, body: 'Ya puedes apuntar sus cartas en tu colección.', link: href || '/lanzamientos.html' }
  return { title: `Abre la preventa de ${n}`, body: dias === 0 ? 'Hoy empieza la preventa.' : 'La preventa empezó ayer.', link: '/lanzamientos.html' }
}

export async function procesar({ env = process.env, rest = restReal, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  let avisos
  try {
    avisos = (await rest(`user_release_alerts?select=id,user_id,clave,market,nombre,semana,dia,preventa,enviados&order=created_at&limit=${TOPE_AVISOS}`, clave)) || []
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|user_release_alerts/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-avisos-lanzamientos.sql (user_release_alerts)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  if (!avisos.length) return { ok: true, avisos: 0, enviados: 0 }
  const hoy = hoyEnEspana(ahora)
  // Las fechas: del catálogo para los que tienen id, de la lista a mano
  // para los anunciados. La preventa solo la da la lista a mano, y se casa
  // por nombre también con los del catálogo.
  const fechas = new Map()
  const delCatalogo = avisos.filter((a) => !a.clave.startsWith('manual:'))
  for (let i = 0; i < delCatalogo.length; i += 150) {
    const tramo = [...new Set(delCatalogo.slice(i, i + 150).map((a) => a.clave))]
    for (const s of (await rest(`tcg_sets?select=id,market,name,release_date&id=in.(${lista(tramo)})`, clave)) || []) {
      fechas.set(`${s.id}|${s.market}`, { fecha: String(s.release_date || '').slice(0, 10) || null, nombre: s.name })
    }
  }
  const aMano = ((await rest('site_settings?select=value&key=eq.lanzamientos', clave).catch(() => [])) || [])[0]?.value?.sets || []
  const porNombre = new Map(aMano.filter((m) => m?.nombre).map((m) => [normalizeSearch(m.nombre), m]))
  const enviados = []
  for (const a of avisos) {
    const mano = a.clave.startsWith('manual:') ? porNombre.get(a.clave.slice(7)) : porNombre.get(normalizeSearch(a.nombre))
    const delSet = fechas.get(`${a.clave}|${a.market || 'WEST'}`)
    const datos = { fecha: delSet?.fecha || (a.clave.startsWith('manual:') ? mano?.fecha : null) || null, preventa: mano?.preventa || null }
    const tocan = avisosDeHoy(a, datos, hoy)
    if (!tocan.length) continue
    const href = a.clave.startsWith('manual:') ? null : `/cartas.html?ver=album&set=${encodeURIComponent(a.clave)}&catalogo=${encodeURIComponent(a.market || 'WEST')}`
    await rest(`user_release_alerts?id=eq.${encodeURIComponent(a.id)}`, clave, { method: 'PATCH', body: JSON.stringify({ enviados: [...new Set([...(a.enviados || []), ...tocan.map((t) => t.tipo)])] }) })
    await rest('user_notifications', clave, { method: 'POST', body: JSON.stringify(tocan.map((t) => ({ recipient_id: a.user_id, type: TIPO_NOTIFICACION, ...textoDelAviso(a, t, href) }))) })
    enviados.push(...tocan.map((t) => ({ id: a.id, clave: a.clave, tipo: t.tipo })))
  }
  return { ok: true, hoy, avisos: avisos.length, enviados: enviados.length, detalle: enviados.slice(0, 50) }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('avisos-lanzamientos:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Una vez al día, a las 6:17 UTC (las 8 de la mañana en España en verano,
// las 7 en invierno): un lanzamiento se avisa por días, no por horas.
export const config = { schedule: '17 6 * * *' }
