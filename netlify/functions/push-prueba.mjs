import webpush from 'web-push'
import { tokenDe } from '../lib/admin.mjs'

// «Enviarme un aviso de prueba» (tanda 993), desde /ajustes → Avisos.
//
// PINGU: «tengo la aplicación instalada y nunca me llega una notificación
// push». Los avisos de verdad salen de `enviar-push` cada cinco minutos y,
// si algo falla, no hay quien lo vea desde el móvil. Esto manda UNA al
// momento a los dispositivos de quien la pide y contesta qué ha pasado,
// con el motivo tal cual: sin clave privada, sin clave pública, sin
// ningún dispositivo dado de alta, o el error del servicio de push.
//
// Solo a uno mismo: el token dice quién es (se le pregunta a Supabase, no
// se le cree al cliente), y se envía a SUS suscripciones y a nadie más.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

async function quienEs(token, fetchImpl) {
  if (!token) return null
  try {
    const r = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } })
    if (!r.ok) return null
    return (await r.json())?.id || null
  } catch {
    return null
  }
}

async function restServicio(ruta, clave, fetchImpl, opciones = {}) {
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json', ...(opciones.headers || {}) },
  })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.status === 204 ? null : r.json()
}

export async function probar({ token, env = process.env, fetchImpl = fetch, enviar = null, endpoint = null }) {
  const usuario = await quienEs(token, fetchImpl)
  if (!usuario) return { ok: false, estado: 401, motivo: 'Entra con tu cuenta para probar los avisos.' }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, motivo: 'Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.' }
  const privada = env.PUSH_VAPID_PRIVATE
  if (!privada) return { ok: false, motivo: 'Falta la clave privada (PUSH_VAPID_PRIVATE) en Netlify: sin ella no sale ningún aviso push.' }
  const ajustes = await restServicio('site_settings?key=eq.push_vapid_public&select=value', clave, fetchImpl)
  const publica = ajustes?.[0]?.value?.clave
  if (!publica) return { ok: false, motivo: 'Falta la clave pública: hay que generarla en /admin.' }

  const subs = (await restServicio(`push_subscriptions?user_id=eq.${encodeURIComponent(usuario)}&select=endpoint,p256dh,auth`, clave, fetchImpl)) || []
  if (!subs.length) return { ok: false, motivo: 'No tienes ningún dispositivo dado de alta: activa los avisos en este dispositivo y vuelve a probar.' }
  const deEste = endpoint ? subs.some((s) => s.endpoint === endpoint) : null

  const mandar = enviar || ((sub, cuerpo) => {
    webpush.setVapidDetails('mailto:avisos@pokedoc.es', publica, privada)
    return webpush.sendNotification(sub, cuerpo)
  })
  const cuerpo = JSON.stringify({ title: 'PokeDoc', body: '¡Funciona! Así te llegarán los avisos.', link: `${env.SITE_URL || 'https://pokedoc.es'}/ajustes`, tag: 'prueba' })
  let enviados = 0
  const errores = []
  for (const s of subs) {
    try {
      await mandar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo)
      enviados++
    } catch (e) {
      const codigo = e?.statusCode || null
      // Como en enviar-push: una suscripción muerta se borra.
      if (codigo === 404 || codigo === 410) await restServicio(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, clave, fetchImpl, { method: 'DELETE' }).catch(() => {})
      errores.push(`${codigo || ''} ${String(e?.body || e?.message || e).slice(0, 160)}`.trim())
    }
  }
  if (!enviados) return { ok: false, enviados, dispositivos: subs.length, deEste, motivo: `El servicio de push no lo ha aceptado: ${errores[0] || 'sin motivo'}`, errores }
  return { ok: true, enviados, dispositivos: subs.length, deEste, errores }
}

export default async function handler(req) {
  if (req.method !== 'POST') return Response.json({ ok: false, motivo: 'Solo POST.' }, { status: 405 })
  let endpoint = null
  try { endpoint = (await req.json())?.endpoint || null } catch {}
  try {
    const r = await probar({ token: tokenDe(req), endpoint })
    return Response.json(r, { status: r.estado || 200, headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return Response.json({ ok: false, motivo: String(e?.message || e).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
