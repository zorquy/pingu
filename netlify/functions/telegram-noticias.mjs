// Las noticias, al canal de Telegram (tanda 280).
//
// PINGU tiene una comunidad de Telegram con varios canales. Los torneos
// los anuncia a mano; las noticias quería que se escribieran solas.
//
// ── POR QUÉ NO CON EL RSS ──
//
// Parecía lo obvio, porque el canal ya existe (/rss.xml, tanda 271). Y
// se puede, con un bot de terceros que lo lea. Pero:
//
//   · Esos bots SONDEAN, y tardan entre quince minutos y una hora. En una
//     noticia, llegar el primero es toda la gracia.
//   · La imagen casi nunca sale: RSS 2.0 la lleva en `enclosure`, y la
//     mitad de esos bots la ignoran o la pegan como enlace suelto.
//   · El formato lo decide el bot, no nosotros.
//   · Y mete a un tercero entre PokeDoc y el canal, para leer algo que
//     está en NUESTRA base de datos.
//
// El RSS sigue estando, y es lo correcto para quien nos lea DESDE FUERA.
// Para nuestro propio canal se lee la base y se manda a Telegram: la
// noticia sale en minutos, con su foto y con el formato que queremos.
//
// ── LAS LLAVES ──
//
// TELEGRAM_BOT_TOKEN y TELEGRAM_CANAL_NOTICIAS son variables de entorno
// de Netlify. NO van en el repo, nunca. Sin ellas esta función no hace
// nada y lo dice — igual que resumen-semanal con su clave de servicio.
//
// TELEGRAM_TEMA_NOTICIAS es opcional y solo hace falta si el destino es
// un TEMA dentro de un grupo (lo que en una comunidad parecen «canales»
// pero no lo son). Sin él, el mensaje cae en el tema General.
//
// SUPABASE_SERVICE_ROLE_KEY hace falta para marcar la noticia como
// mandada: la clave pública puede leer, pero no escribir esa columna.
//
// El envío en sí (el texto, la foto, el tema) vive en
// netlify/lib/telegram.mjs: lo comparte con telegram-mandar, que es el
// botón del panel para empujar una noticia a mano. Por los dos caminos
// tiene que salir exactamente el mismo mensaje.

import { mandarATelegram, llavesQueFaltan } from '../lib/telegram.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Cada cuánto mira. Cinco minutos es el equilibrio: una noticia sale casi
// al momento y no son 1.440 consultas al día por nada.
const CADA = '*/5 * * * *'

// Cuántas manda de una pasada. Si por lo que sea hay diez pendientes, se
// sueltan de cinco en cinco: diez mensajes seguidos en un canal es lo que
// hace que la gente lo silencie.
const POR_PASADA = 5

// Una noticia más vieja que esto no se manda aunque esté pendiente. Es la
// red por si alguien republica algo antiguo, o por si la columna se queda
// a null por un despiste: un canal escupiendo noticias de hace meses es
// peor que un canal callado.
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
  const token = env.TELEGRAM_BOT_TOKEN
  const canal = env.TELEGRAM_CANAL_NOTICIAS
  // Opcional: solo si el destino es un TEMA dentro de un grupo.
  const tema = env.TELEGRAM_TEMA_NOTICIAS || null
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  // Faltando una variable esto no manda nada, y antes se iba en silencio:
  // se publicaba una noticia, no salía por el canal y no había forma de
  // saber por qué. Ahora se dicen los nombres de las que faltan.
  const faltan = llavesQueFaltan(env)
  if (faltan.length) return { ok: true, saltado: `faltan variables de entorno en Netlify: ${faltan.join(', ')}`, faltan }

  const desde = new Date(ahora.getTime() - DEMASIADO_VIEJA_HORAS * 3600e3).toISOString()
  let pendientes
  try {
    pendientes = await restImpl(
      `guides?kind=eq.news&published_at=not.is.null&telegram_sent_at=is.null` +
        `&published_at=gte.${encodeURIComponent(desde)}` +
        `&select=id,slug,title,description,cover_image,published_at&order=published_at.asc&limit=${POR_PASADA}`,
      clave
    )
  } catch (e) {
    return { ok: false, error: `no se ha podido consultar: ${e?.message || e}` }
  }
  if (!pendientes?.length) return { ok: true, mandadas: 0 }

  const mandadas = []
  const fallos = []
  for (const noticia of pendientes) {
    const r = await mandarATelegram(noticia, { token, canal, tema, fetchImpl })
    if (!r.ok) {
      // No se marca: se volverá a intentar en la siguiente pasada. Si el
      // fallo es permanente se verá en el registro, pero una caída de red
      // no puede hacer que una noticia se pierda para siempre.
      fallos.push({ slug: noticia.slug, error: r.error })
      continue
    }
    // Se marca ANTES de seguir con la siguiente: si la función se corta a
    // mitad, lo ya mandado queda apuntado y no se repite.
    try {
      await restImpl(`guides?id=eq.${encodeURIComponent(noticia.id)}`, clave, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ telegram_sent_at: new Date().toISOString() }),
      })
      mandadas.push(noticia.slug)
    } catch (e) {
      // Mandada pero sin apuntar: la próxima pasada la repetiría. Se
      // canta bien claro, porque es el único caso que duplica mensajes.
      fallos.push({ slug: noticia.slug, error: `MANDADA PERO NO APUNTADA: ${e?.message || e}` })
    }
  }
  return { ok: fallos.length === 0, mandadas: mandadas.length, slugs: mandadas, fallos }
}

export default async function handler() {
  const resultado = await procesar()
  if (resultado.saltado) console.warn('telegram-noticias:', resultado.saltado)
  if (resultado.fallos?.length) console.warn('telegram-noticias:', JSON.stringify(resultado.fallos))
  return new Response(JSON.stringify(resultado), { status: 200, headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: CADA }
