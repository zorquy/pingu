// Publicar UNA noticia en X, a mano, desde el panel (tanda 902).
//
// El mismo papel que telegram-mandar (282): la función programada solo
// mira las últimas 48 horas y salta las ya mandadas —las dos redes son
// deliberadas—, y eso deja fuera una noticia que no salió porque faltaba
// una variable. Y, sobre todo, aquí hay alguien delante de la pantalla:
// el error de X («Unauthorized», «Forbidden», lo que sea) sale tal cual
// en el panel, que es lo que permite arreglarlo.
//
// También es el camino para QUITAR la parada (`{ reanudar: true }`): un
// 401/403 de X para la función programada, y la quita una persona cuando
// ha mirado por qué.

import { publicarEnX, textoDeNoticia, llavesQueFaltan, clavesDe } from '../lib/x.mjs'
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { CLAVE_ESTADO } from './x-noticias.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

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

const json = (estado, cuerpo) => ({ estado, cuerpo })

// Quitar la parada: se lee el estado, se le quita `parado` y se guarda.
export async function reanudar({ env = process.env, restImpl = rest, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return json(503, { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.' })
  try {
    const valor = (await restImpl(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`, clave))?.[0]?.valor || {}
    const { parado, ...resto } = valor
    await restImpl('scrydex_estado', clave, {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: { ...resto, reanudadoEl: ahora.toISOString() }, updated_at: ahora.toISOString() }]),
    })
    return json(200, { ok: true, habiaParada: Boolean(parado) })
  } catch (e) {
    return json(502, { error: `No se ha podido quitar la parada: ${e?.message || e}` })
  }
}

// El trabajo, sin nada de HTTP alrededor, para poder probarlo entero.
export async function mandarUna({ id, forzar = false, env = process.env, restImpl = rest, fetchImpl = fetch, ahora = new Date() } = {}) {
  if (!id) return json(400, { error: 'Falta la noticia que hay que publicar.' })

  const faltan = llavesQueFaltan(env)
  if (faltan.length) {
    return json(503, {
      error: `Falta configurar en Netlify: ${faltan.join(', ')}. Se ponen en Site configuration → Environment variables, y hay que volver a desplegar para que las funciones las vean.`,
      faltan,
    })
  }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return json(503, { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.', faltan: ['SUPABASE_SERVICE_ROLE_KEY'] })

  let noticia
  try {
    const filas = await restImpl(
      `guides?id=eq.${encodeURIComponent(id)}&select=id,slug,title,description,kind,published_at,x_sent_at&limit=1`,
      clave
    )
    noticia = filas?.[0]
  } catch (e) {
    const m = String(e?.message || e)
    if (/42703|x_sent_at/.test(m)) return json(503, { error: 'Falta ejecutar supabase-migration-x-noticias.sql en el SQL Editor (la columna x_sent_at).' })
    return json(502, { error: `No se ha podido leer la noticia: ${m}` })
  }
  if (!noticia) return json(404, { error: 'Esa noticia ya no existe.' })
  if (noticia.kind !== 'news') return json(400, { error: 'Esto no es una noticia.' })
  // Un borrador no puede salir: el enlace llevaría a una página que no existe.
  if (!noticia.published_at) return json(400, { error: 'Esta noticia todavía es un borrador: publícala antes de mandarla a X.' })
  // Ya publicada, sin insistir: hay que confirmarlo, no es un descuido.
  if (noticia.x_sent_at && !forzar) return json(409, { error: 'Esta noticia ya se publicó en X.', yaMandada: noticia.x_sent_at })

  const r = await publicarEnX(textoDeNoticia(noticia), { claves: clavesDe(env), fetchImpl })
  // El error de X se pasa TAL CUAL: «Unauthorized» con las cuatro claves
  // puestas dice «el Access Token se generó antes de dar permiso de
  // escritura», y traducirlo a «no se ha podido» sería tirar esa pista.
  if (!r.ok) return json(502, { error: `X no lo ha aceptado (${r.estado}): ${r.error}`, estado: r.estado, definitivo: r.definitivo })

  const cuando = ahora.toISOString()
  try {
    await restImpl(`guides?id=eq.${encodeURIComponent(noticia.id)}`, clave, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ x_sent_at: cuando, x_post_id: r.id }),
    })
  } catch (e) {
    // Publicada pero sin apuntar. No es un error para quien mira, pero hay
    // que decirlo: la función programada la volvería a publicar.
    return json(200, { ok: true, id: r.id, aviso: `Publicada en X, pero no se ha podido apuntar (${e?.message || e}). La función programada podría repetirla: márcala a mano.` })
  }
  return json(200, { ok: true, id: r.id, cuando })
}

export default async (req) => {
  const sinPermiso = (estado, error) => new Response(JSON.stringify({ error }), { status: estado, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return sinPermiso(405, 'Método no permitido')
  if (!(await idDeAdmin(tokenDe(req)))) return sinPermiso(401, 'No autorizado.')
  let cuerpo = {}
  try {
    cuerpo = await req.json()
  } catch {
    return sinPermiso(400, 'JSON inválido.')
  }
  const { estado, cuerpo: salida } = cuerpo.reanudar ? await reanudar() : await mandarUna({ id: cuerpo.id, forzar: !!cuerpo.forzar })
  return new Response(JSON.stringify(salida), { status: estado, headers: { 'content-type': 'application/json' } })
}
