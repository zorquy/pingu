// Los torneos OFICIALES de Pokémon en /meta (tanda 366): regionales,
// internacionales, especiales y el Mundial, desde limitlesstcg.com.
//
// Cada pasada lee el listado, busca el oficial más reciente que aún no
// esté en `meta_torneos` y lo mete ENTERO: su clasificación (con el
// arquetipo de cada jugador) y las listas de los mejores puestos. Un
// torneo por pasada: son una página de clasificación más una por lista,
// y a Limitless no se le piden cientos de páginas de golpe.
//
// ── EL RELOJ ──
// Netlify mata una función programada a los 30 s. Se piden como mucho
// las listas de los 64 primeros, de cuatro en cuatro; si el reloj se
// acaba antes, el torneo entra igual con las que haya dado tiempo (el
// arquetipo de cada jugador viene en la clasificación, así que el % de
// uso sale entero; solo faltan listas de referencia). Lo que NO puede
// pasar es meterlo dos veces, y eso lo impide la base.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
import { WEB, leerListado, esOficial, tipoDeOficial, leerClasificacion, leerLista, clasificacionParaIngerir } from '../lib/limitless-oficial.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const LISTAS_POR_TORNEO = 64
const PRESUPUESTO_MS = 20000
const A_LA_VEZ = 4
// Cuánto hacia atrás se busca (la base guarda 400 días de oficiales).
const DIAS_ATRAS = 365
const CABECERAS = { accept: 'text/html', 'user-agent': 'PokeDoc/1.0 (+https://pokedoc.es/meta)' }

export async function procesar({ env = process.env, fetchImpl = fetch, ahora = new Date(), reloj = () => Date.now() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const cab = { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
  const empezo = reloj()

  async function web(ruta) {
    const res = await fetchImpl(`${WEB}${ruta}`, { headers: CABECERAS })
    if (!res.ok) throw new Error(`Limitless ${res.status} en ${ruta}`)
    return res.text()
  }
  async function base(ruta, opciones = {}) {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${ruta}`, { ...opciones, headers: { ...cab, ...(opciones.headers || {}) } })
    const texto = await res.text()
    if (!res.ok) {
      const e = new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`)
      e.sinMigracion = /PGRST20[25]|column .* does not exist|Could not find/.test(texto)
      throw e
    }
    return texto ? JSON.parse(texto) : null
  }

  try {
    // 1. Qué oficiales hay y cuáles faltan.
    const listado = leerListado(await web('/tournaments'))
    if (!listado.length) return { ok: false, error: 'El listado de Limitless no trae torneos: ¿ha cambiado su HTML?' }
    const limite = ahora.getTime() - DIAS_ATRAS * 864e5
    // Un día de margen: la clasificación de un torneo de fin de semana no
    // es definitiva hasta el lunes.
    const hecho = ahora.getTime() - 864e5
    const candidatos = listado.filter((t) => esOficial(t) && Date.parse(t.fecha) >= limite && Date.parse(t.fecha) <= hecho)
    if (!candidatos.length) return { ok: true, leido: null, motivo: 'ningún oficial en el listado' }
    const ids = candidatos.map((t) => `"oficial-${t.id}"`).join(',')
    const ya = new Set(((await base(`meta_torneos?select=id&id=in.(${ids})`)) || []).map((f) => f.id))
    const t = candidatos.find((c) => !ya.has(`oficial-${c.id}`))
    if (!t) return { ok: true, leido: null, motivo: 'todos los oficiales del listado ya están' }

    // 2. Su clasificación.
    const filas = leerClasificacion(await web(`/tournaments/${t.id}`))
    if (!filas.length) return { ok: false, error: `La clasificación de ${t.nombre} viene vacía: ¿ha cambiado el HTML?` }

    // 3. Las listas de los mejores puestos, de cuatro en cuatro y con reloj.
    const pedir = filas.filter((f) => f.lista).slice(0, LISTAS_POR_TORNEO).map((f) => f.lista)
    const unicas = [...new Set(pedir)]
    const listas = new Map()
    let i = 0
    let cortado = false
    const trabajador = async () => {
      while (i < unicas.length) {
        if (reloj() - empezo > PRESUPUESTO_MS) {
          cortado = true
          return
        }
        const id = unicas[i++]
        try {
          const lista = leerLista(await web(`/decks/list/${id}`))
          if (lista) listas.set(id, lista)
        } catch {
          // Una lista que falla se queda sin lista; el jugador cuenta igual.
        }
      }
    }
    await Promise.all(Array.from({ length: A_LA_VEZ }, trabajador))

    // 4. Los nombres de arquetipo que ya conocemos, para usar SU id.
    const conocidos = (await base('meta_arquetipos?select=id,nombre')) || []
    const idDeNombre = new Map(conocidos.map((a) => [String(a.nombre).toLowerCase(), a.id]))

    const r = await base('rpc/meta_ingerir_torneo', {
      method: 'POST',
      body: JSON.stringify({
        p_torneo: {
          id: `oficial-${t.id}`,
          name: t.nombre,
          date: `${t.fecha}T12:00:00Z`,
          players: t.jugadores,
          fuente: 'oficial',
          tipo: tipoDeOficial(t.nombre),
          enlace: `${WEB}/tournaments/${t.id}`,
        },
        p_clasificacion: clasificacionParaIngerir(filas, listas, idDeNombre),
        // De un oficial se guardan las listas de los 32 primeros: son las
        // que más se copian.
        p_top: 32,
      }),
    })
    return { ok: true, leido: t.nombre, jugadores: filas.length, listas: listas.size, cortado, resultado: r }
  } catch (e) {
    if (e.sinMigracion) return { ok: false, saltado: 'falta ejecutar supabase-migration-meta-fuentes.sql', error: e.message }
    return { ok: false, error: String(e?.message || e) }
  }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('meta-oficiales:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada 20 minutos. Un regional grande son 65 páginas: con uno por pasada,
// la primera carga (los oficiales que salen en la primera página del
// listado, unos cinco meses) se hace en unas horas, y después cada
// oficial nuevo entra en la primera pasada tras el lunes.
export const config = { schedule: '*/20 * * * *' }
