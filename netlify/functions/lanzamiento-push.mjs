import webpush from 'web-push'

// El aviso de «¡sale hoy!»: por la mañana mira el calendario de
// lanzamientos (site_settings, clave `lanzamientos`) y, si algún set
// sale HOY, se lo cuenta por push a todo el que tenga los avisos
// activados. Cada set se avisa UNA vez: los ya avisados quedan
// apuntados en site_settings (clave `lanzamientos_avisados`), así que
// aunque la función corriera dos veces no habría push repetido.
//
// VARIABLES DE ENTORNO: las mismas de enviar-push.mjs
// (SUPABASE_SERVICE_ROLE_KEY y PUSH_VAPID_PRIVATE; la clave pública
// vive en site_settings). Sin ellas, no hace nada y lo dice.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

export const claveDeSet = (s) => `${s.fecha}|${s.nombre}`

export async function procesar({ env = process.env, rest = restReal, enviar = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  const privada = env.PUSH_VAPID_PRIVATE
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY: no se envía nada' }
  if (!privada) return { ok: true, saltado: 'sin PUSH_VAPID_PRIVATE: no se envía nada' }

  const ajustes = await rest(
    `site_settings?key=in.(push_vapid_public,lanzamientos,lanzamientos_avisados)&select=key,value`,
    clave
  )
  const valor = (k) => ajustes?.find((a) => a.key === k)?.value
  const publica = valor('push_vapid_public')?.clave
  if (!publica) return { ok: true, saltado: 'sin clave pública: genérala en /admin' }

  const hoy = ahora.toISOString().slice(0, 10)
  const avisados = new Set(valor('lanzamientos_avisados')?.claves || [])
  const deHoy = (valor('lanzamientos')?.sets || []).filter(
    (s) => s && s.nombre && s.fecha === hoy && !avisados.has(claveDeSet(s))
  )
  if (deHoy.length === 0) return { ok: true, sets: 0, enviados: 0 }

  const sitio = env.SITE_URL || 'https://pokedoc.es'
  const mandar =
    enviar ||
    ((suscripcion, cuerpo) => {
      webpush.setVapidDetails(`mailto:avisos@pokedoc.es`, publica, privada)
      return webpush.sendNotification(suscripcion, cuerpo)
    })

  const subs = (await rest(`push_subscriptions?select=endpoint,p256dh,auth&limit=1000`, clave)) || []

  let enviados = 0
  let caducadas = 0
  for (const set of deHoy) {
    for (const s of subs) {
      try {
        await mandar(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: `¡${set.nombre} ya está aquí!`,
            body: `El set sale hoy${set.notas ? ` — ${set.notas}` : ''}. Mira el calendario de lanzamientos.`,
            link: new URL('/lanzamientos.html', sitio).href,
            tag: 'lanzamiento',
          })
        )
        enviados++
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, clave, {
            method: 'DELETE',
          }).catch(() => {})
          caducadas++
        }
      }
    }
  }

  // Apuntar los avisados ANTES de terminar, recortando la lista a los
  // últimos 20: los sets viejos ya nunca volverán a ser "de hoy".
  const claves = [...avisados, ...deHoy.map(claveDeSet)].slice(-20)
  await rest(`site_settings?on_conflict=key`, clave, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key: 'lanzamientos_avisados', value: { claves }, updated_at: ahora.toISOString() }]),
  })

  return { ok: true, sets: deHoy.length, enviados, caducadas }
}

export default async function handler() {
  const resultado = await procesar()
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

// A las 7:15 UTC: media mañana en España, con el día por delante para
// pasarse por la tienda.
export const config = { schedule: '15 7 * * *' }
