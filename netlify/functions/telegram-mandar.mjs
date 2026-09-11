// Mandar UNA noticia al canal de Telegram, a mano (tanda 282).
//
// La función programada (telegram-noticias) manda sola lo que se publica,
// pero tiene dos redes que le impiden llegar a todo: solo mira las
// noticias de las últimas 48 horas, y salta las que ya tienen
// `telegram_sent_at`. Las dos son deliberadas —evitan que el canal
// escupa el archivo entero— y las dos dejan fuera el caso de PINGU:
// noticias ya publicadas que nunca salieron porque faltaba una variable
// de entorno.
//
// De ahí este botón. Es una acción de una persona sobre una noticia
// concreta, así que no le aplican las redes: manda esa y punto.
//
// Y hace algo que la programada no puede hacer: CONTAR LO QUE PASA. Una
// función programada no la invoca nadie y su respuesta no la lee nadie;
// si falla, el fallo se queda en el registro de Netlify. Aquí hay alguien
// esperando delante de la pantalla, así que el error de Telegram —o el
// nombre de la variable que falta— sale tal cual en el panel.
import { mandarATelegram, llavesQueFaltan } from '../lib/telegram.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// Escribir en el canal de la comunidad solo puede hacerlo el equipo, así
// que se comprueba el token contra el propio Supabase igual que en
// generate-course: /auth/v1/user valida el JWT y user_profiles.is_admin
// es de lectura pública, sin necesidad de la clave de servicio.
async function esAdmin(token, fetchImpl = fetch) {
  if (!token) return false
  const userRes = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!userRes.ok) return false
  const user = await userRes.json()
  if (!user?.id) return false
  const perfilRes = await fetchImpl(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=is_admin`, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  })
  if (!perfilRes.ok) return false
  const [perfil] = await perfilRes.json()
  return !!perfil?.is_admin
}

async function rest(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      'content-type': 'application/json',
      ...(opciones.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

// El trabajo, sin nada de HTTP alrededor, para poder probarlo entero.
// Devuelve { estado, cuerpo }: el estado es el código que se responderá.
export async function mandarUna({ id, forzar = false, env = process.env, restImpl = rest, fetchImpl = fetch } = {}) {
  if (!id) return { estado: 400, cuerpo: { error: 'Falta la noticia que hay que mandar.' } }

  const faltan = llavesQueFaltan(env)
  if (faltan.length) {
    return {
      estado: 503,
      cuerpo: {
        error: `Falta configurar en Netlify: ${faltan.join(', ')}. Se ponen en Site configuration → Environment variables, y hay que volver a desplegar para que la función las vea.`,
        faltan,
      },
    }
  }

  let noticia
  try {
    const filas = await restImpl(
      `guides?id=eq.${encodeURIComponent(id)}&select=id,slug,title,description,cover_image,kind,published_at,telegram_sent_at&limit=1`,
      env.SUPABASE_SERVICE_ROLE_KEY
    )
    noticia = filas?.[0]
  } catch (e) {
    return { estado: 502, cuerpo: { error: `No se ha podido leer la noticia: ${e?.message || e}` } }
  }
  if (!noticia) return { estado: 404, cuerpo: { error: 'Esa noticia ya no existe.' } }
  if (noticia.kind !== 'news') return { estado: 400, cuerpo: { error: 'Esto no es una noticia.' } }
  // Un borrador no puede salir por el canal: el enlace del mensaje
  // llevaría a una página que no existe.
  if (!noticia.published_at) return { estado: 400, cuerpo: { error: 'Esta noticia todavía es un borrador: publícala antes de mandarla.' } }

  // Ya mandada, sin insistir: se avisa en vez de repetirla. Mandar dos
  // veces la misma noticia a un canal es de las cosas que hacen que la
  // gente lo silencie, así que tiene que ser una decisión, no un descuido.
  if (noticia.telegram_sent_at && !forzar) {
    return { estado: 409, cuerpo: { error: 'Esta noticia ya se mandó al canal.', yaMandada: noticia.telegram_sent_at } }
  }

  const r = await mandarATelegram(noticia, {
    token: env.TELEGRAM_BOT_TOKEN,
    canal: env.TELEGRAM_CANAL_NOTICIAS,
    tema: env.TELEGRAM_TEMA_NOTICIAS || null,
    fetchImpl,
  })
  // El error de Telegram se pasa TAL CUAL: «chat not found» o «bot is not
  // a member of the supergroup chat» dicen exactamente qué arreglar, y
  // traducirlos a un «no se ha podido» sería tirar esa pista.
  if (!r.ok) return { estado: 502, cuerpo: { error: `Telegram no lo ha aceptado: ${r.error}` } }

  const cuando = new Date().toISOString()
  try {
    await restImpl(`guides?id=eq.${encodeURIComponent(noticia.id)}`, env.SUPABASE_SERVICE_ROLE_KEY, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ telegram_sent_at: cuando }),
    })
  } catch (e) {
    // Mandada pero sin apuntar. NO es un error para quien mira —la
    // noticia ya está en el canal—, pero hay que decirlo: si no, la
    // función programada la volvería a mandar dentro de cinco minutos.
    return { estado: 200, cuerpo: { ok: true, sinFoto: !!r.sinFoto, aviso: `Mandada, pero no se ha podido apuntar (${e?.message || e}). Podría repetirse.` } }
  }
  return { estado: 200, cuerpo: { ok: true, sinFoto: !!r.sinFoto, cuando } }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { 'content-type': 'application/json' } })
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!(await esAdmin(token))) {
    return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401, headers: { 'content-type': 'application/json' } })
  }
  let cuerpo = {}
  try {
    cuerpo = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido.' }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
  const { estado, cuerpo: salida } = await mandarUna({ id: cuerpo.id, forzar: !!cuerpo.forzar })
  return new Response(JSON.stringify(salida), { status: estado, headers: { 'content-type': 'application/json' } })
}
