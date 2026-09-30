// De qué Pokémon habla cada carta (tanda 381).
//
// Rellena `tcg_cards.dex_ids`, que es por donde entra la Pokédex de «Mi
// colección»: «dame todas las cartas del 25» y salen los 300 Pikachus
// del catálogo, de todas las colecciones.
//
// ── POR QUÉ ESTA FUNCIÓN NO SE PARECE A `cartas-detalle` ──
//
// Aquella pide UNA FICHA POR CARTA a TCGdex: ~21.000 peticiones contra
// un catálogo comunitario y gratuito, y por eso va con tope, pausa de
// 350 ms y presupuesto de tiempo.
//
// Esta **no sale a internet**. La especie está en el nombre, que ya
// tenemos guardado desde la importación, y `especiesDeCarta` la saca con
// el mismo mecanismo que mueve los minisprites y los arquetipos de mazo
// —probado desde la tanda 231—. Así que aquí no hay nada que pedirle a
// nadie: se lee de nuestra base y se escribe en nuestra base.
//
// Eso cambia los números por completo. Sin pausa y por lotes grandes,
// las 21.356 cartas se hacen en unas pocas pasadas en vez de en dos
// días. Lo único que sigue mandando es el reloj: **una función
// programada de Netlify se mata a los 30 segundos** (tanda 322).
//
// ── EL CENTINELA, QUE ES LO QUE HACE QUE LA COLA SE VACÍE ──
//
// `null` es «no lo hemos mirado»; `{}` es «mirado, y no sale ningún
// Pokémon». Un Entrenador y una Energía se quedan en `{}`, no en null.
// Sin esa diferencia, los ~5.000 Entrenadores volverían en cada pasada
// para siempre — la lección de la 333 y de la 380: una cola que no
// distingue «no preguntado» de «no hay» no se vacía nunca.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
import { especiesDeCarta } from '../../js/pokedex-especies.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const MERCADO = 'WEST'

// Por lote. Grande porque no hay red de por medio: son una lectura y una
// escritura a Supabase, no 500 peticiones a un tercero.
const POR_LOTE = 500

// Cuándo dejar de empezar lotes. Netlify corta a los 30 s sin avisar;
// pararse antes deja la pasada cerrada en orden y la respuesta dice
// cuántas se hicieron. Lo que no dé tiempo sigue con `dex_ids` a null y
// lo coge la pasada siguiente.
const PRESUPUESTO_MS = 22000

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

export async function procesar({ env = process.env, fetchImpl = null, reloj = () => Date.now() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const pedir = fetchImpl ? (ruta, o) => fetchImpl(ruta, o) : (ruta, o) => rest(ruta, clave, o)
  const empezo = reloj()

  let miradas = 0
  let conPokemon = 0
  let lotes = 0
  try {
    while (reloj() - empezo < PRESUPUESTO_MS) {
      const filas = await pedir(
        `tcg_cards?select=id,name&market=eq.${MERCADO}&dex_ids=is.null&limit=${POR_LOTE}`
      )
      if (!filas?.length) break
      lotes++

      // Se escriben en UN upsert y no una a una: 500 PATCH serían 500
      // viajes y la pasada no daría para un lote.
      const cambios = filas.map((f) => {
        const dexes = especiesDeCarta(f.name)
        if (dexes.length) conPokemon++
        miradas++
        // El centinela: `{}` para las que no llevan Pokémon. Nunca null,
        // o volverían en la pasada siguiente.
        return { id: f.id, market: MERCADO, dex_ids: dexes }
      })
      await pedir('tcg_cards?on_conflict=id,market', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(cambios),
      })
      if (filas.length < POR_LOTE) break
    }
  } catch (e) {
    const texto = String(e?.message || e)
    // Sin la migración puesta no es un fallo que haya que gritar cada
    // cinco minutos: es «todavía no». Mismo trato que le dan las otras.
    if (/PGRST|does not exist|Could not find/.test(texto)) {
      return { ok: true, saltado: 'falta ejecutar supabase-migration-pokedex.sql', miradas, lotes }
    }
    return { ok: false, error: texto, miradas, lotes }
  }
  return { ok: true, lotes, miradas: miradas, conPokemon, sinPokemon: miradas - conPokemon }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('cartas-pokedex:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos, y de vida corta: cuando la cola se vacíe esto
// cuesta una consulta que no devuelve nada, por un índice parcial que
// para entonces está vacío. Se queda puesto para las cartas que traiga
// cada importación nueva.
export const config = { schedule: '*/10 * * * *' }
