// Las noticias, a la cuenta de X de PokeDoc (tanda 902).
//
// La misma forma que telegram-noticias (280): cada cinco minutos mira las
// noticias publicadas y sin mandar, publica, y marca cada una ANTES de
// seguir con la siguiente. Lo que difiere está aquí abajo:
//
//   · Lo que falla se apunta en el ESTADO (`scrydex_estado`, clave
//     `x_noticias`), que es lo que lee el semáforo de /admin. Una función
//     programada no la invoca nadie y su respuesta no la lee nadie (655):
//     con Telegram se vio que una variable mal puesta podía pasar semanas
//     sin que nadie se enterara.
//   · Un fallo DEFINITIVO (401/403: las claves; 402: el plan) PARA la
//     función: se escribe `parado` y la pasada siguiente se sale antes de
//     llamar a X. Lo quita una persona desde /admin, porque reintentar
//     cada cinco minutos con las mismas claves es insistir en lo mismo —
//     y con pago por uso, pagar por insistir.
//
// Las llaves (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET) y
// la firma viven en netlify/lib/x.mjs, compartido con x-mandar.

import { publicarEnX, textoDeNoticia, llavesQueFaltan, clavesDe } from '../lib/x.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

export const CLAVE_ESTADO = 'x_noticias'

// Cada cuánto mira: lo mismo que Telegram. Una noticia sale casi al
// momento y no son 1.440 consultas al día por nada.
const CADA = '*/5 * * * *'

// Cuántas publica de una pasada. Cinco noticias seguidas en una cuenta
// ya es mucho; si hay más pendientes, salen en la siguiente.
const POR_PASADA = 3

// Una noticia más vieja que esto no se publica aunque esté pendiente: si
// alguien republica algo antiguo, o la columna se queda a null por un
// despiste, la cuenta no escupe noticias de hace meses.
const DEMASIADO_VIEJA_HORAS = 48

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

export async function procesar({ env = process.env, restImpl = rest, fetchImpl = fetch, ahora = new Date() } = {}) {
  const faltan = llavesQueFaltan(env)
  if (faltan.length) return { ok: true, saltado: `faltan variables de entorno en Netlify: ${faltan.join(', ')}`, faltan }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'faltan variables de entorno en Netlify: SUPABASE_SERVICE_ROLE_KEY', faltan: ['SUPABASE_SERVICE_ROLE_KEY'] }

  const leerEstado = async () => (await restImpl(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`, clave))?.[0]?.valor || {}
  const guardarEstado = (valor) =>
    restImpl('scrydex_estado', clave, {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: ahora.toISOString() }]),
    })

  let estado = {}
  try {
    estado = await leerEstado()
  } catch (e) {
    // Sin tabla de estado se sigue igual: el estado es para mirar, no
    // para publicar. Pero sin ella tampoco hay freno, así que se dice.
    estado = { sinEstado: String(e?.message || e).slice(0, 120) }
  }
  if (estado.parado) return { ok: true, saltado: `parada: ${estado.parado.motivo || estado.parado}`, parado: estado.parado }

  const desde = new Date(ahora.getTime() - DEMASIADO_VIEJA_HORAS * 3600e3).toISOString()
  let pendientes
  try {
    pendientes = await restImpl(
      `guides?kind=eq.news&published_at=not.is.null&x_sent_at=is.null` +
        `&published_at=gte.${encodeURIComponent(desde)}` +
        `&select=id,slug,title,description,published_at&order=published_at.asc&limit=${POR_PASADA}`,
      clave
    )
  } catch (e) {
    const m = String(e?.message || e)
    // La columna la trae la migración, que se ejecuta a mano DESPUÉS de
    // desplegar (624): mientras no esté, se dice cuál falta y no se
    // apunta como error.
    if (/42703|x_sent_at/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-x-noticias.sql (x_sent_at)' }
    return { ok: false, error: `no se ha podido consultar: ${m}` }
  }
  if (!pendientes?.length) return { ok: true, mandadas: 0 }

  const claves = clavesDe(env)
  const mandadas = []
  const fallos = []
  for (const noticia of pendientes) {
    const r = await publicarEnX(textoDeNoticia(noticia), { claves, fetchImpl })
    if (!r.ok) {
      fallos.push({ slug: noticia.slug, estado: r.estado, error: r.error })
      const valor = { ...estado, ultimoError: { fecha: ahora.toISOString(), motivo: `${noticia.slug}: ${r.error}`, estado: r.estado } }
      // Un fallo definitivo para TODO hasta que alguien mire: no tiene
      // sentido probar con la siguiente noticia con las mismas claves.
      if (r.definitivo) valor.parado = { fecha: ahora.toISOString(), motivo: `X contestó ${r.estado}: ${r.error}` }
      try {
        await guardarEstado(valor)
      } catch {
        // Sin estado que escribir: el fallo vuelve en la respuesta igual.
      }
      if (r.definitivo) break
      continue
    }
    // Se marca ANTES de seguir con la siguiente: si la función se corta a
    // mitad, lo ya publicado queda apuntado y no se repite.
    try {
      await restImpl(`guides?id=eq.${encodeURIComponent(noticia.id)}`, clave, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ x_sent_at: ahora.toISOString(), x_post_id: r.id }),
      })
      mandadas.push({ slug: noticia.slug, id: r.id })
    } catch (e) {
      // Publicada pero sin apuntar: la próxima pasada la repetiría. Es el
      // único caso que duplica, así que se canta bien claro y se para.
      fallos.push({ slug: noticia.slug, error: `PUBLICADA PERO NO APUNTADA: ${e?.message || e}` })
      try {
        await guardarEstado({ ...estado, parado: { fecha: ahora.toISOString(), motivo: `«${noticia.slug}» se publicó en X pero no se pudo apuntar: ${String(e?.message || e).slice(0, 120)}. Márcala a mano antes de quitar la parada.` } })
      } catch {
        // idem
      }
      break
    }
  }
  if (mandadas.length) {
    try {
      await guardarEstado({ ...estado, ultimaPublicacion: { fecha: ahora.toISOString(), slug: mandadas[mandadas.length - 1].slug, id: mandadas[mandadas.length - 1].id }, ultimoError: fallos.length ? estado.ultimoError : null })
    } catch {
      // idem
    }
  }
  return { ok: fallos.length === 0, mandadas: mandadas.length, slugs: mandadas.map((m) => m.slug), fallos }
}

export default async function handler() {
  const resultado = await procesar()
  if (resultado.saltado) console.warn('x-noticias:', resultado.saltado)
  if (resultado.fallos?.length) console.warn('x-noticias:', JSON.stringify(resultado.fallos))
  return new Response(JSON.stringify(resultado), { status: 200, headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: CADA }
