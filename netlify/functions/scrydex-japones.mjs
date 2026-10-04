import { cabecerasDe, urlDeSonda } from '../lib/scrydex.mjs'

// ¿Tiene Scrydex catálogo JAPONÉS? Que lo pregunte el servidor, no PINGU
// (tanda 528).
//
// PINGU, esta mañana: «ya te dije anoche que trajeses todas las cartas
// japonesas y todas las occidentales». Y tiene razón. Lo que le contesté
// fue que pulsara un botón de /admin para averiguar si Scrydex sirve
// japonés, y eso está mal planteado por dos motivos:
//
//   1. Ese botón lo tiene que pulsar una persona, y una persona no está
//      delante a las cuatro de la mañana. Es exactamente el motivo por el
//      que el relleno es una función programada y no un botón.
//   2. Y la pregunta es de UNA petición. Pedirle a alguien que haga un
//      trabajo de un crédito es pedirle que haga mi trabajo.
//
// ── POR QUÉ ESTO NO EMPAREJA NI ESCRIBE NADA TODAVÍA ──
//
// Porque sería inventarme su respuesta. La norma de la 501 está escrita
// con sangre: escribí el emparejamiento de los sets ANTES de tener una
// respuesta suya delante, con las fechas en el formato que yo suponía, y
// las suyas venían con barras — no habría casado ni un set, sin un solo
// error. **En cuanto haya una respuesta real, el fixture ES esa
// respuesta.** Así que esto la trae, la guarda entera y se calla.
//
// Lo que deja en `scrydex_estado` bajo la clave `japones` es lo que hace
// falta para escribir el emparejamiento sin suponer nada: cuántas
// expansiones dice que tiene, y la primera tal cual vino.
//
// ── Y CUESTA UN CRÉDITO, UNA VEZ ──
//
// En cuanto hay respuesta —la que sea, incluido un 404— no se vuelve a
// preguntar: se queda escrita. Un freno que pregunta «¿ya lo sé?» sí
// frena, porque esa respuesta SÍ llega a cero (la lección de la 510 era
// sobre los frenos cuyo trabajo pendiente no llega nunca a cero; este no
// es de esos).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const CLAVE_ESTADO = 'japones'

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return opciones ? null : res.json()
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null,
  estadoImpl = null, guardarEstadoImpl = null,
} = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }

  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const leerEstado = estadoImpl || (async () => {
    const f = await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`)
    return f?.[0]?.valor || {}
  })
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, {
    method: 'POST',
    body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]),
  }))

  // ── El freno: si ya se preguntó, no se vuelve a preguntar ──
  const estado = await leerEstado()
  if (estado?.preguntadoEn) {
    return {
      estado: 200,
      cuerpo: {
        creditos: 0,
        yaSeSabe: true,
        hayJapones: !!estado.hayJapones,
        cuantas: estado.cuantas ?? null,
        preguntadoEn: estado.preguntadoEn,
      },
    }
  }

  const url = urlDeSonda('ja/expansions', { page_size: 1 })
  const res = await fetchImpl(url, { headers: cabeceras })
  const texto = await res.text()
  let j = null
  try { j = JSON.parse(texto) } catch { /* una respuesta que no es JSON también es una respuesta */ }

  // Su `data` es un OBJETO cuando se pide una sola cosa y un ARRAY cuando
  // es una lista (lo aprendimos en la 505). Las dos formas valen.
  const datos = Array.isArray(j?.data) ? j.data : (j?.data ? [j.data] : [])
  const primera = datos[0] || null
  // Y no basta con que conteste 200: puede contestar 200 con una lista
  // VACÍA, que es «no tengo» y no «no te entiendo». Son dos respuestas
  // distintas y las dos son respuestas.
  const hayJapones = res.ok && datos.length > 0

  const valor = {
    preguntadoEn: new Date().toISOString(),
    estadoHttp: res.status,
    hayJapones,
    cuantas: Number(j?.total_count) || datos.length || 0,
    // La primera expansión TAL CUAL vino, recortada para no llenar la
    // fila: es el fixture con el que se escribirá el emparejamiento.
    primera: primera ? JSON.parse(JSON.stringify(primera)) : null,
    ...(res.ok ? {} : { cuerpo: texto.slice(0, 400) }),
  }
  await guardarEstado(valor)

  return {
    estado: 200,
    cuerpo: {
      creditos: 1,
      ...valor,
      queSignifica: hayJapones
        ? 'Scrydex SÍ sirve japonés: el siguiente paso es emparejar sus sets con los nuestros, con su respuesta de verdad delante.'
        : `Scrydex NO ha devuelto expansiones japonesas (HTTP ${res.status}). El japonés se queda en TCGdex y no se vuelve a preguntar.`,
    },
  }
}

export default async () => {
  try {
    const r = await procesar()
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

// Cada cinco minutos, pero gasta UNA vez: en cuanto hay respuesta, el
// freno de arriba la devuelve sin tocar la API. Va tan seguido a propósito
// —la respuesta la quiere PINGU ahora, no mañana—.
export const config = { schedule: '*/5 * * * *' }
