import webpush from 'web-push'

// Empuja a los navegadores suscritos los avisos NUEVOS de
// user_notifications (los mismos de la campanita). Corre sola cada 5
// minutos, como la de correo, y por el mismo motivo: nada que
// configurar en el panel de Supabase, y si un envío falla la siguiente
// pasada lo tiene en cuenta.
//
// VARIABLES DE ENTORNO (Netlify → Site settings → Environment variables)
//
//   SUPABASE_SERVICE_ROLE_KEY  obligatoria (se salta la RLS para leer
//                              los avisos y las suscripciones de todos).
//   PUSH_VAPID_PRIVATE         la clave privada que enseña /admin al
//                              generar las claves push. NO va en ningún
//                              fichero del repositorio.
//   SITE_URL                   opcional, por defecto https://pokedoc.es
//
// La clave PÚBLICA no es variable de entorno: vive en site_settings
// (la guarda /admin), así esta función y js/push.js leen la misma.
//
// Si falta algo, la función NO falla: no hace nada y lo dice — igual
// que la de correo, para poder desplegar antes de tener las claves.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const POR_PASADA = 100

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

// El trabajo de verdad, con sus dos puertas al mundo (la base y el
// servicio de push) inyectables: así la prueba lo ejecuta entero sin
// red, con dobles, igual que se probó la función de correo.
export async function procesar({ env = process.env, rest = restReal, enviar = null } = {}) {
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

  // Los avisos sin empujar. Solo los recientes: un aviso de hace días ya
  // se vio en la campanita, y empujarlo tarde molesta más que ayuda.
  const desde = new Date(Date.now() - 24 * 3600e3).toISOString()
  const avisos = await rest(
    `user_notifications?pushed_at=is.null&created_at=gte.${encodeURIComponent(desde)}` +
      `&select=id,recipient_id,type,title,body,link&order=created_at.asc&limit=${POR_PASADA}`,
    clave
  )
  if (!avisos || avisos.length === 0) return { ok: true, enviados: 0, revisados: 0 }

  const destinatarios = [...new Set(avisos.map((a) => a.recipient_id).filter(Boolean))]
  const subs = destinatarios.length
    ? await rest(
        `push_subscriptions?user_id=in.(${destinatarios.join(',')})&select=endpoint,user_id,p256dh,auth`,
        clave
      )
    : []
  const porUsuario = {}
  for (const s of subs || []) (porUsuario[s.user_id] ||= []).push(s)

  let enviados = 0
  let caducadas = 0
  for (const aviso of avisos) {
    for (const s of porUsuario[aviso.recipient_id] || []) {
      try {
        await mandar(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: aviso.title || 'PokeDoc',
            body: aviso.body || '',
            link: new URL(aviso.link || '/', sitio).href,
            tag: aviso.type || 'pokedoc',
          })
        )
        enviados++
      } catch (e) {
        // 404/410: esa suscripción murió (permiso retirado, navegador
        // reinstalado). Se limpia para no insistirle a un muerto.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, clave, {
            method: 'DELETE',
          }).catch(() => {})
          caducadas++
        }
        // Otros fallos (el servicio de push caído) se dejan estar: el
        // aviso se marca revisado igualmente — reintentar push viejos
        // en bucle sería spam en diferido.
      }
    }
  }

  // TODOS los revisados quedan marcados, tuvieran o no suscripciones:
  // si no, los avisos de quien nunca activó push se re-escanearían en
  // cada pasada para siempre.
  await rest(`user_notifications?id=in.(${avisos.map((a) => a.id).join(',')})`, clave, {
    method: 'PATCH',
    body: JSON.stringify({ pushed_at: new Date().toISOString() }),
  })

  return { ok: true, enviados, caducadas, revisados: avisos.length }
}

export default async function handler() {
  const resultado = await procesar()
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export const config = { schedule: '*/5 * * * *' }
