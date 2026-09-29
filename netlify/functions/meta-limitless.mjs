// El meta, desde Limitless (tanda 364).
//
// Lee los torneos online de Estándar de play.limitlesstcg.com y le pasa
// la clasificación de cada uno a `meta_ingerir_torneo` (ver
// supabase-migration-meta.sql, que cuenta el porqué de todo lo de la
// base). De ahí salen /meta y la ficha de cada arquetipo.
//
// ── LA API ──
//
// Pública y sin clave para leer torneos y clasificaciones (la clave
// solo hace falta para /decks, las reglas de clasificación, que no
// usamos: el arquetipo ya viene puesto en cada jugador). Tiene límite de
// peticiones, así que se va de una en una, con una pausa, y un 429 corta
// la pasada: la siguiente sigue por donde esta lo dejó.
//
// ── EL RELOJ ──
//
// Netlify mata una función programada a los 30 segundos. Una
// clasificación de 200 jugadores pesa ~400 KB y tarda un par de
// segundos, así que caben ~10 torneos por pasada y la primera carga (dos
// meses, ~1.000 torneos) se hace en unas horas de pasadas. Por eso:
//   · Se empieza por lo MÁS RECIENTE: la ventana de 14 días del ranking
//     se llena en la primera hora, y lo viejo (que solo sirve para la
//     flecha de «sube/baja» del periodo anterior) viene detrás.
//   · Cada torneo entra ENTERO o no entra (lo hace la base en una
//     transacción), así que cortar a mitad no deja nada contado dos
//     veces.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const API = 'https://play.limitlesstcg.com/api'

// Un torneo de menos de 16 jugadores son tres o cuatro rondas entre
// amigos: mete ruido y no dice qué se juega.
export const MIN_JUGADORES = 16

// Hasta dónde se lee hacia atrás. La ventana más larga de /meta es de 30
// días y su flecha compara con los 30 anteriores: 60. La base borra lo
// de más de 65.
export const DIAS_ATRAS = 60

// Un torneo online se juega en una tarde. Pedir la clasificación de uno
// que aún no ha acabado la guardaría a medias PARA SIEMPRE (un torneo
// leído no se vuelve a leer), así que se espera a que tenga 12 horas.
export const HORAS_DE_MARGEN = 12

// Por página del listado (el máximo que devuelve la API es de sobra).
const POR_PAGINA = 100
// Tope de páginas por pasada: a ~20 torneos al día, 60 días son ~12.
const MAX_PAGINAS = 15

// El reloj: a partir de aquí no se EMPIEZA ningún torneo nuevo. Deja
// sitio de sobra para acabar el que esté a medias antes de los 30 s.
const PRESUPUESTO_MS = 20000
// Entre petición y petición a Limitless.
const PAUSA_MS = 250

const CABECERAS_LIMITLESS = {
  accept: 'application/json',
  // Que en sus registros se sepa quién pide y desde dónde.
  'user-agent': 'PokeDoc/1.0 (+https://pokedoc.es/meta)',
}

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

// Qué torneos del listado hay que leer: Estándar, con gente, ya acabados
// y dentro de la ventana. El orden del listado (lo más nuevo primero) se
// conserva.
export function torneosALeer(listado, { ahora = new Date(), conocidos = new Set() } = {}) {
  const limite = ahora.getTime() - HORAS_DE_MARGEN * 3600e3
  const desde = ahora.getTime() - DIAS_ATRAS * 864e5
  return (listado || []).filter((t) => {
    const fecha = Date.parse(t?.date)
    return (
      t?.id &&
      !conocidos.has(t.id) &&
      String(t.format || '').toUpperCase() === 'STANDARD' &&
      Number(t.players) >= MIN_JUGADORES &&
      Number.isFinite(fecha) &&
      fecha <= limite &&
      fecha >= desde
    )
  })
}

// ¿Hay que mirar la página siguiente? Sí mientras haya trabajo en esta
// (estamos en plena primera carga: lo que falta está más atrás) o
// mientras la página sea reciente. Una página vieja y ya leída entera
// quiere decir que de ahí para atrás está todo.
export function seguirPaginando(pagina, pendientes, { ahora = new Date() } = {}) {
  if (!pagina?.length || pagina.length < POR_PAGINA) return false
  const ultima = Date.parse(pagina[pagina.length - 1]?.date)
  if (!Number.isFinite(ultima) || ultima < ahora.getTime() - DIAS_ATRAS * 864e5) return false
  if (pendientes > 0) return true
  return ultima > ahora.getTime() - 2 * 864e5
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

export async function procesar({ env = process.env, fetchImpl = fetch, ahora = new Date(), reloj = () => Date.now(), pausa = PAUSA_MS } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const empezo = reloj()
  const queda = () => PRESUPUESTO_MS - (reloj() - empezo)

  async function limitless(ruta) {
    const res = await fetchImpl(`${API}${ruta}`, { headers: CABECERAS_LIMITLESS })
    if (res.status === 429) {
      const e = new Error('Limitless: demasiadas peticiones (429)')
      e.limite = true
      throw e
    }
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Limitless ${res.status} en ${ruta}`)
    return res.json()
  }

  async function base(ruta, opciones = {}) {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      ...opciones,
      headers: { ...servicio(clave), ...(opciones.headers || {}) },
    })
    const texto = await res.text()
    if (!res.ok) {
      const e = new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`)
      // PGRST202/205: la función o la tabla no existen — la migración
      // no se ha ejecutado. Se dice con el nombre del fichero.
      e.sinMigracion = /PGRST20[25]|does not exist|Could not find/.test(texto)
      throw e
    }
    return texto ? JSON.parse(texto) : null
  }

  const leidos = []
  const fallos = []
  let paginas = 0
  let cortado = null

  try {
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      if (queda() <= 0) {
        cortado = 'tiempo'
        break
      }
      const listado = await limitless(`/tournaments?game=PTCG&format=STANDARD&limit=${POR_PAGINA}&page=${pagina}`)
      paginas++
      if (!Array.isArray(listado) || !listado.length) break

      const ids = listado.map((t) => t?.id).filter(Boolean)
      const ya = ids.length
        ? await base(`meta_torneos?select=id&id=in.(${ids.map((id) => `"${encodeURIComponent(id)}"`).join(',')})`)
        : []
      const conocidos = new Set((ya || []).map((f) => f.id))
      const pendientes = torneosALeer(listado, { ahora, conocidos })

      for (const t of pendientes) {
        if (queda() <= 0) {
          cortado = 'tiempo'
          break
        }
        await dormir(pausa)
        try {
          // Un 404 (torneo borrado) se ingiere VACÍO: queda apuntado y no
          // se vuelve a pedir en cada pasada.
          const clasificacion = (await limitless(`/tournaments/${encodeURIComponent(t.id)}/standings`)) || []
          const r = await base('rpc/meta_ingerir_torneo', {
            method: 'POST',
            body: JSON.stringify({
              p_torneo: { id: t.id, name: t.name, date: t.date, players: t.players, organizerId: t.organizerId },
              p_clasificacion: Array.isArray(clasificacion) ? clasificacion : [],
            }),
          })
          leidos.push({ id: t.id, jugadores: t.players, con_lista: r?.con_lista ?? 0 })
        } catch (e) {
          if (e.limite || e.sinMigracion) throw e
          // Un torneo que falla no para la pasada: se reintenta en la
          // siguiente, porque sigue sin estar en meta_torneos.
          fallos.push({ id: t.id, error: String(e?.message || e).slice(0, 200) })
        }
      }
      if (cortado) break
      if (!seguirPaginando(listado, pendientes.length, { ahora })) break
    }
  } catch (e) {
    if (e.sinMigracion) return { ok: false, saltado: 'falta ejecutar supabase-migration-meta.sql', error: e.message }
    if (e.limite) cortado = 'limite de Limitless'
    else return { ok: false, error: String(e?.message || e), leidos: leidos.length, fallos }
  }

  return { ok: fallos.length === 0, paginas, leidos: leidos.length, torneos: leidos, fallos, cortado }
}

export default async function handler() {
  const resultado = await procesar()
  if (!resultado.ok) console.warn('meta-limitless:', JSON.stringify(resultado).slice(0, 1000))
  return new Response(JSON.stringify(resultado), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos: en la primera carga es lo que hace falta para
// ponerse al día en unas horas, y después la mayoría de pasadas leen una
// página, ven que no hay nada nuevo y acaban en un segundo.
export const config = { schedule: '*/10 * * * *' }
