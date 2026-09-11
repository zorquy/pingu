// Los torneos, al canal de Telegram (tanda 287).
//
// El porte de telegram-noticias a la sección «Jugar». Misma pieza, misma
// forma de mensaje y el mismo canal — lo que cambia es el TEMA y cuándo
// se dispara.
//
// ── CUÁNDO ──
//
// No al CREAR el torneo: uno recién creado está en `draft`, no lo ve
// nadie todavía y puede cambiar de fecha tres veces antes de salir.
// Anunciarlo entonces sería anunciar algo que no existe.
//
// Se manda cuando ABREN LAS INSCRIPCIONES (`registration_open`), que es
// el momento en el que hay algo que hacer: apuntarse. Es el mismo momento
// en el que torneos-barredor manda la campanita y el push, así que el
// canal cuenta lo mismo que la web, a la vez.
//
// ── LAS LLAVES ──
//
// TELEGRAM_TEMA_TORNEOS es el tema del grupo donde van los torneos. El
// chat es el mismo que el de las noticias (en una comunidad de Telegram
// los «canales» son temas de un solo grupo), así que TELEGRAM_CANAL_TORNEOS
// es opcional: sin él se usa TELEGRAM_CANAL_NOTICIAS.
import { mandarATelegram, mensajeDeTorneo, llavesQueFaltan, canalDe } from '../lib/telegram.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

const CADA = '*/5 * * * *'

// Un torneo abre las inscripciones y ya está: no hay ráfagas. Tres por
// pasada es de sobra y deja la red puesta por si alguna vez se abren diez
// de golpe.
const POR_PASADA = 3

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
  const canal = canalDe(env, 'TELEGRAM_CANAL_TORNEOS')
  const tema = env.TELEGRAM_TEMA_TORNEOS || null
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  const faltan = llavesQueFaltan(env, { canal: 'TELEGRAM_CANAL_TORNEOS' })
  if (faltan.length) return { ok: true, saltado: `faltan variables de entorno en Netlify: ${faltan.join(', ')}`, faltan }

  // La red: un torneo que YA HA EMPEZADO no se anuncia aunque esté
  // pendiente. Es el equivalente a las 48 horas de las noticias, pero
  // aquí hay una fecha de verdad con la que medirlo — anunciar un torneo
  // al que ya no te puedes apuntar es peor que no anunciarlo.
  let pendientes
  try {
    pendientes = await restImpl(
      `tournaments?status=eq.registration_open&telegram_sent_at=is.null` +
        `&start_at=gte.${encodeURIComponent(ahora.toISOString())}` +
        `&select=id,slug,name,description,banner_url,start_at,format,swiss_rounds,top_cut_size,max_players` +
        `&order=start_at.asc&limit=${POR_PASADA}`,
      clave
    )
  } catch (e) {
    return { ok: false, error: `no se ha podido consultar: ${e?.message || e}` }
  }
  if (!pendientes?.length) return { ok: true, mandados: 0 }

  const mandados = []
  const fallos = []
  for (const torneo of pendientes) {
    const r = await mandarATelegram(
      { texto: mensajeDeTorneo(torneo, { ahora }), portada: torneo.banner_url },
      { token, canal, tema, fetchImpl }
    )
    if (!r.ok) {
      // No se marca: se reintenta en la siguiente pasada.
      fallos.push({ slug: torneo.slug, error: r.error })
      continue
    }
    try {
      await restImpl(`tournaments?id=eq.${encodeURIComponent(torneo.id)}`, clave, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ telegram_sent_at: new Date().toISOString() }),
      })
      mandados.push(torneo.slug)
    } catch (e) {
      fallos.push({ slug: torneo.slug, error: `MANDADO PERO NO APUNTADO: ${e?.message || e}` })
    }
  }
  return { ok: fallos.length === 0, mandados: mandados.length, slugs: mandados, fallos }
}

export default async function handler() {
  const resultado = await procesar()
  if (resultado.saltado) console.warn('telegram-torneos:', resultado.saltado)
  if (resultado.fallos?.length) console.warn('telegram-torneos:', JSON.stringify(resultado.fallos))
  return new Response(JSON.stringify(resultado), { status: 200, headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: CADA }
