import webpush from 'web-push'

// El rescate de la racha: por la tarde, a quien tiene la racha VIVA
// (jugó ayer) pero hoy todavía no ha jugado, un push recordándole que
// el reto caduca. Quien jugó hoy ya está a salvo y quien no jugó ayer
// ya la perdió (o la salvará su protector): a ninguno de los dos se le
// molesta.
//
// Los días van en UTC, como toda la racha (gamification.js compara
// last_active_date contra toISOString): el "día" del reto termina a
// medianoche UTC, así que el push de las 18:00 UTC llega con la tarde
// entera por delante.
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

export function diaUTC(desplaza = 0, ahora = new Date()) {
  return new Date(ahora.getTime() + desplaza * 86400_000).toISOString().slice(0, 10)
}

export async function procesar({ env = process.env, rest = restReal, enviar = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  const privada = env.PUSH_VAPID_PRIVATE
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY: no se envía nada' }
  if (!privada) return { ok: true, saltado: 'sin PUSH_VAPID_PRIVATE: no se envía nada' }

  const ajustes = await rest(`site_settings?key=eq.push_vapid_public&select=value`, clave)
  const publica = ajustes?.[0]?.value?.clave
  if (!publica) return { ok: true, saltado: 'sin clave pública: genérala en /admin' }

  const sitio = env.SITE_URL || 'https://pokedoc.es'
  const mandar =
    enviar ||
    ((suscripcion, cuerpo) => {
      webpush.setVapidDetails(`mailto:avisos@pokedoc.es`, publica, privada)
      return webpush.sendNotification(suscripcion, cuerpo)
    })

  const ayer = diaUTC(-1, ahora)
  const enPeligro = await rest(
    `user_profiles?current_streak=gt.0&last_active_date=eq.${ayer}&select=id,current_streak&limit=500`,
    clave
  )
  if (!enPeligro || enPeligro.length === 0) return { ok: true, enPeligro: 0, enviados: 0 }

  const subs = await rest(
    `push_subscriptions?user_id=in.(${enPeligro.map((p) => p.id).join(',')})&select=endpoint,user_id,p256dh,auth`,
    clave
  )
  const porUsuario = {}
  for (const s of subs || []) (porUsuario[s.user_id] ||= []).push(s)

  let enviados = 0
  let caducadas = 0
  for (const perfil of enPeligro) {
    const dias = perfil.current_streak
    for (const s of porUsuario[perfil.id] || []) {
      try {
        await mandar(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: 'Tu racha está en peligro',
            body: `Llevas ${dias} ${dias === 1 ? 'día seguido' : 'días seguidos'}. Juega el reto de hoy antes de que acabe el día y no la pierdas.`,
            link: new URL('/curso?reto=hoy', sitio).href,
            tag: 'racha',
          })
        )
        enviados++
      } catch (e) {
        // La misma limpieza que enviar-push: 404/410 es una suscripción
        // muerta y se borra para no insistirle.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, clave, {
            method: 'DELETE',
          }).catch(() => {})
          caducadas++
        }
      }
    }
  }

  return { ok: true, enPeligro: enPeligro.length, enviados, caducadas }
}

export default async function handler() {
  const resultado = await procesar()
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

// A las 18:00 UTC: quedan 6 horas de "día del reto" (UTC) — en España,
// las 19:00-20:00 de la tarde, la hora de sentarse un rato.
export const config = { schedule: '0 18 * * *' }
