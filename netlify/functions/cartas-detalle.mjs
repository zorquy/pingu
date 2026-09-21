import { detalleDeCarta, urlDeCarta } from '../lib/carta-detalle.mjs'

// Engorda las cartas de `tcg_cards` poco a poco (tanda 322).
//
// ── Por qué por tandas y no de una ──
//
// El listado de un set trae lo justo (id, localId, name, image) y el
// resto —PS, ataques, rareza, ilustrador— exige UNA PETICIÓN POR CARTA.
// Son ~23.000 contra un catálogo comunitario y gratuito que mantiene
// gente en su tiempo libre. Importar el catálogo entero de golpe son
// ~220 peticiones; engordarlo son 23.000, y lanzarlas seguidas sería
// portarse como un abusón con quien nos regala los datos.
//
// Así que esto va por tandas cortas, con pausa entre peticiones, y se
// reanuda solo: `detalle_at` marca lo hecho y el índice parcial
// `tcg_cards_sin_detalle_idx` hace que buscar lo que falta siga siendo
// barato cuando queden cuatro cartas.
//
// ── El orden ──
//
// Por fecha de salida del set, de más nuevo a más viejo. Los sets
// recientes son los que se juegan y los que la gente busca; las cartas
// de 2003 pueden esperar tres días. Eso también significa que la parte
// ÚTIL del catálogo está engordada el primer día, no el último.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Cuántas por pasada.
//
// El número no sale de lo que me apetece: sale de que **una función
// programada de Netlify se mata a los 30 segundos**. Cada carta cuesta
// una petición a TCGdex, un PATCH a Supabase y la pausa de abajo — unos
// 600-700 ms. Con 150 harían falta ~105 segundos y la pasada moriría a
// mitad en todas y cada una de las veces.
//
// Así que 40, que caben de sobra, y el bucle además se corta solo por
// tiempo (PRESUPUESTO_MS). Lo que no dé tiempo NO se pierde: sigue con
// `detalle_at` a null y lo coge la pasada siguiente.
const POR_PASADA = 40

// Cuándo dejar de empezar cartas nuevas. Netlify corta a los 30 s sin
// avisar y sin dejar terminar la petición en curso; parar por nuestra
// cuenta antes deja la pasada cerrada en orden y la respuesta dice
// cuántas se hicieron. Es la diferencia entre «se acabó el tiempo» y
// «nos mataron».
const PRESUPUESTO_MS = 22000

// Entre peticiones. No es paranoia: 150 peticiones seguidas a una API
// sin clave es la forma de que te bloqueen el rango y te quedes sin
// catálogo, que es peor que tardar una semana.
const PAUSA_MS = 350

// El mercado que se engorda. Solo el occidental por ahora: es el que se
// enseña en la web. Los asiáticos son catálogos APARTE (una Charizard
// japonesa no es la inglesa) y engordarlos multiplicaría por cuatro las
// peticiones sin que hoy los vea nadie.
const MERCADO = 'WEST'

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function rest(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

// Las siguientes que tocan. `detalle_error` fuera a propósito: una carta
// que ya falló no se reintenta en cada pasada — si no, cuatro cartas
// rotas se comerían la tanda entera para siempre y el resto del catálogo
// no avanzaría nunca. Para reintentarlas se vacía la columna a mano.
async function siguientes(clave) {
  const ruta =
    'tcg_cards?select=id,set_id,tcg_sets!inner(release_date)' +
    `&market=eq.${MERCADO}` +
    '&detalle_at=is.null' +
    '&detalle_error=is.null' +
    '&order=tcg_sets(release_date).desc.nullslast' +
    `&limit=${POR_PASADA}`
  return (await rest(ruta, clave)) || []
}

async function guardar(clave, id, fila) {
  await rest(`tcg_cards?id=eq.${encodeURIComponent(id)}&market=eq.${MERCADO}`, clave, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fila),
  })
}

export default async function handler() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return new Response('Falta SUPABASE_SERVICE_ROLE_KEY', { status: 500 })

  const pendientes = await siguientes(clave)
  if (!pendientes.length) {
    return Response.json({ hechas: 0, fallidas: 0, mensaje: 'No queda ninguna por engordar' })
  }

  let hechas = 0
  let fallidas = 0
  let sinTiempo = 0
  const arranque = Date.now()

  for (const carta of pendientes) {
    if (Date.now() - arranque > PRESUPUESTO_MS) {
      sinTiempo = pendientes.length - hechas - fallidas
      break
    }
    try {
      const res = await fetch(urlDeCarta(carta.id, MERCADO), { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`TCGdex ${res.status}`)
      const detalle = detalleDeCarta(await res.json())
      if (!detalle) throw new Error('respuesta vacía')
      // `detalle_at` se escribe en la MISMA sentencia que los datos. Si
      // fueran dos, un corte entre ellas dejaría la carta engordada y
      // marcada como pendiente, y la siguiente pasada la repetiría — con
      // 23.000 cartas eso no es un detalle, es no terminar nunca.
      await guardar(clave, carta.id, { ...detalle, detalle_at: new Date().toISOString(), detalle_error: null })
      hechas++
    } catch (e) {
      // El error se GUARDA en la fila, no solo en el log. Un log de
      // Netlify caduca; una columna te deja preguntar mañana «¿cuáles
      // fallaron y por qué?» con un select.
      fallidas++
      try {
        await guardar(clave, carta.id, { detalle_error: String(e.message || e).slice(0, 200) })
      } catch {
        // Si ni siquiera se puede apuntar el fallo, la base está peor
        // que la carta: se deja y que lo vea la siguiente pasada.
      }
    }
    await esperar(PAUSA_MS)
  }

  return Response.json({ hechas, fallidas, sinTiempo, pedidas: pendientes.length })
}

// Cada cinco minutos. Antes era cada hora con tandas de 150, y esa
// cuenta no salía: no caben en los 30 s que da Netlify. Tandas cortas y
// más a menudo dan MÁS cartas al día (40 × 12 = 480 a la hora frente a
// 150) y además ninguna pasada se muere a mitad.
export const config = { schedule: '*/5 * * * *' }
