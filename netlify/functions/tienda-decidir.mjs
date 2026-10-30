import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { renderEmail } from '../lib/email.mjs'
import { enviarCorreoSuelto } from '../lib/correo-suelto.mjs'

// Aceptar o rechazar una tienda (tanda 1067), desde /admin → Tiendas.
//
// La decisión la toma la BASE (`tienda_decidir`, con el token del admin:
// si no es del equipo, dice que no). Aquí solo se manda el correo que va
// con ella, a un email que aún no tiene cuenta y por eso no pasa por la
// cola. Si el correo no sale, la solicitud queda decidida igual y el panel
// enseña el motivo y el enlace, para mandarlo a mano.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

export function enlaceDeAlta(siteUrl, token) {
  return `${String(siteUrl || 'https://pokedoc.es').replace(/\/+$/, '')}/alta-tienda?i=${encodeURIComponent(token)}`
}

// El correo de cada decisión, con la plantilla de siempre.
// `propio`: lo que el equipo haya cambiado de este correo en /admin →
// Correos (1122), o nada.
export function correoDeDecision({ estado, nombre, contacto, token }, siteUrl = 'https://pokedoc.es', propio = null) {
  const hola = contacto ? `Hola, ${contacto}: ` : 'Hola: '
  if (estado === 'aceptada') {
    return renderEmail({
      subject: `${nombre} ya puede entrar en PokeDoc`,
      preview: `${hola}hemos aceptado a ${nombre}. Crea la cuenta de la tienda desde el botón: sirve una vez, con este email, durante 14 días.`,
      link: `/alta-tienda?i=${encodeURIComponent(token)}`,
      siteUrl,
      tipo: 'tienda_aceptada',
      propio,
    })
  }
  return renderEmail({
    subject: 'Tu solicitud de tienda en PokeDoc',
    preview: `${hola}gracias por querer traer ${nombre} a PokeDoc. De momento no podemos abrir más tiendas; te escribiremos cuando abramos.`,
    link: '/',
    siteUrl,
    tipo: 'tienda_rechazada',
    propio,
  })
}

export async function decidir({ token, id, aceptar, env = process.env, fetchImpl = fetch, enviar = enviarCorreoSuelto }) {
  if (!(await idDeAdmin(token, fetchImpl))) return { ok: false, estado: 403, motivo: 'Solo el equipo puede decidir las tiendas.' }
  if (!id) return { ok: false, estado: 400, motivo: 'Falta la solicitud.' }
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/tienda_decidir`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_id: id, p_aceptar: !!aceptar }),
  })
  if (!r.ok) {
    let motivo = `Supabase ${r.status}`
    try { motivo = (await r.json())?.message || motivo } catch {}
    return { ok: false, estado: 400, motivo }
  }
  const fila = await r.json()
  const siteUrl = env.SITE_URL || 'https://pokedoc.es'
  // Los textos propios de este correo, con el token del admin (la tabla la
  // lee el equipo). Sin ellos, o si falla, los de siempre.
  const tipo = fila.estado === 'aceptada' ? 'tienda_aceptada' : 'tienda_rechazada'
  const propio = await fetchImpl(`${SUPABASE_URL}/rest/v1/correo_textos?tipo=eq.${tipo}&select=asunto,intro,cta,pie`, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((f) => (Array.isArray(f) ? f[0] || null : null))
    .catch(() => null)
  const correo = correoDeDecision(fila, siteUrl, propio)
  const envio = await enviar({ to: fila.email, ...correo }, env)
  return {
    ok: true,
    estado: fila.estado,
    email: fila.email,
    enlace: fila.estado === 'aceptada' ? enlaceDeAlta(siteUrl, fila.token) : null,
    correo: envio.enviado ? 'enviado' : 'no_salio',
    motivo: envio.motivo,
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return Response.json({ ok: false, motivo: 'Solo POST.' }, { status: 405 })
  let cuerpo = {}
  try { cuerpo = (await req.json()) || {} } catch {}
  try {
    const r = await decidir({ token: tokenDe(req), id: cuerpo.id, aceptar: cuerpo.aceptar })
    return Response.json(r, { status: r.ok ? 200 : r.estado || 400, headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return Response.json({ ok: false, motivo: String(e?.message || e).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
