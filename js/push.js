import { supabase } from './supabase.js'

// Notificaciones push: los avisos de la campanita, pero en el
// escritorio o el móvil AUNQUE la web esté cerrada. Tres piezas:
//
//   1. Este módulo: suscribe/desuscribe ESTE navegador y guarda la
//      suscripción en push_subscriptions (una fila por dispositivo).
//   2. sw.js: recibe el push y pinta la notificación.
//   3. netlify/functions/enviar-push.mjs (programada): recorre los
//      avisos nuevos de user_notifications y los empuja cifrados.
//
// La clave pública VAPID vive en site_settings (clave
// `push_vapid_public`): la genera el admin desde /admin y no es
// secreta. La privada solo existe en las variables de entorno de
// Netlify.

function soportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// La clave llega en base64url; el navegador la quiere en bytes.
function aBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const crudo = atob(base64 + relleno)
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}

async function clavePublica() {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'push_vapid_public').maybeSingle()
  if (error || !data?.value) return null
  return String(data.value.clave || data.value || '')
}

async function registrarWorker() {
  return navigator.serviceWorker.register('/sw.js')
}

// ¿Cómo está ESTE navegador? Para pintar el interruptor del perfil.
export async function estadoPush() {
  if (!soportaPush()) return { soportado: false, permiso: 'default', suscrito: false }
  let suscrito = false
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    suscrito = !!(reg && (await reg.pushManager.getSubscription()))
  } catch {}
  return { soportado: true, permiso: Notification.permission, suscrito }
}

export async function activarPush(userId) {
  if (!userId) return { ok: false, motivo: 'Entra con tu cuenta.' }
  if (!soportaPush()) return { ok: false, motivo: 'Este navegador no soporta notificaciones push.' }

  const clave = await clavePublica()
  if (!clave) return { ok: false, motivo: 'El sitio aún no tiene las claves push configuradas.' }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return { ok: false, motivo: 'Sin tu permiso, el navegador no deja avisarte.' }

  try {
    const reg = await registrarWorker()
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) })
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: json.endpoint,
        user_id: userId,
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
      },
      { onConflict: 'endpoint' }
    )
    if (error) {
      // Sin la tabla (migración sin ejecutar) la suscripción no sirve:
      // se deshace para no dejar el navegador suscrito a nada.
      await sub.unsubscribe().catch(() => {})
      return { ok: false, motivo: 'Falta ejecutar supabase-migration-push.sql en la base.' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: 'No se ha podido suscribir: ' + String(e?.message || e).slice(0, 120) }
  }
}

export async function desactivarPush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg && (await reg.pushManager.getSubscription())
    if (!sub) return { ok: true }
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {})
    // La fila se borra por endpoint: la RLS ya limita a las propias.
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: String(e?.message || e).slice(0, 120) }
  }
}
