import { detalleDeCarta, urlDeCarta, urlDeSet, fechaDeSet } from '../lib/carta-detalle.mjs'

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

// Cuántos sets se preguntan de una vez al buscar por dónde seguir. Con
// ~220 sets son 9 preguntas en el peor caso, y en la práctica una o dos:
// se avanza por la lista y la frontera está donde se quedó la pasada
// anterior.
const SETS_POR_VENTANA = 25

// Los sets, del más nuevo al más viejo, y los SIN FECHA al final.
//
// Esto era una sola consulta con `order=tcg_sets(release_date).desc.
// nullslast` sobre la tabla embebida, y **PostgREST se comía el
// `nullslast` sin dar error**. Como Postgres pone los NULL PRIMERO en un
// DESC, el catálogo se empezó a engordar por las promos de McDonald's de
// 2014 — lo menos buscado que hay. Salió porque las 206 primeras cartas
// eran todas de sets sin fecha.
//
// Ahora el orden se hace aquí, sobre la tabla de sets directamente
// (ordenar por una columna propia sí funciona), y la elección de qué
// carta toca es NUESTRA y no de una sintaxis que puede ignorarse en
// silencio.
async function setsPorPrioridad(clave) {
  const sets = await rest(
    `tcg_sets?select=id,release_date&market=eq.${MERCADO}&order=release_date.desc.nullslast`,
    clave
  )
  return {
    orden: (sets || []).map((s) => s.id),
    sinFecha: new Set((sets || []).filter((s) => !s.release_date).map((s) => s.id)),
  }
}

// Rellena la fecha de salida de UN set, si le falta.
//
// El importador ya la guarda desde la tanda 322, pero solo al reimportar
// las cartas de un set — y son 220 clics. Esto lo cura solo.
//
// Si falla, no se toca nada y no se corta la pasada: las cartas de ese
// set se engordan igual. La fecha es para ordenar y para la ficha de la
// colección, no para que el engorde funcione.
async function curarFechaDeSet(clave, setId) {
  try {
    const res = await fetch(urlDeSet(setId, MERCADO), { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const fecha = fechaDeSet(await res.json())
    if (!fecha) return null
    await rest(`tcg_sets?id=eq.${encodeURIComponent(setId)}&market=eq.${MERCADO}`, clave, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ release_date: fecha }),
    })
    return fecha
  } catch {
    return null
  }
}

// Las siguientes cartas que tocan, buscando por ventanas de sets hasta
// dar con una que tenga pendientes.
//
// `detalle_error` fuera a propósito: una carta que ya falló no se
// reintenta en cada pasada — si no, cuatro cartas rotas se comerían la
// tanda entera para siempre y el resto del catálogo no avanzaría nunca.
// Para reintentarlas se vacía la columna a mano.
async function siguientes(clave, setsOrdenados) {
  for (let i = 0; i < setsOrdenados.length; i += SETS_POR_VENTANA) {
    const ventana = setsOrdenados.slice(i, i + SETS_POR_VENTANA)
    const ruta =
      'tcg_cards?select=id,set_id' +
      `&market=eq.${MERCADO}` +
      `&set_id=in.(${ventana.map((x) => encodeURIComponent(x)).join(',')})` +
      '&detalle_at=is.null' +
      '&detalle_error=is.null' +
      `&limit=${POR_PASADA}`
    const filas = (await rest(ruta, clave)) || []
    if (filas.length) return filas
  }
  return []
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

  const { orden, sinFecha } = await setsPorPrioridad(clave)

  // ── Primero, TODAS las fechas ──
  //
  // Esto se hacía a la vez que el engorde, curando la del set por el que
  // se iba pasando, y era CIRCULAR: la prioridad se calcula por fecha,
  // casi ningún set tenía, y el set recién curado se ponía por delante
  // de todos los que seguían sin ella. Resultado: la función se quedaba
  // dando vueltas a los sets viejos que ella misma había curado, en vez
  // de saltar a los modernos —que era justo lo que la prioridad existía
  // para evitar—.
  //
  // La prioridad no puede funcionar hasta que se sepan TODAS las fechas,
  // así que van antes y se llevan la pasada entera. Son ~220 sets a una
  // petición cada uno: menos de una hora, y solo la primera vez.
  //
  // Y hay un segundo motivo para que no sea un extra del engorde: la
  // ficha de una colección enseña cuándo salió. Esa fecha hace falta
  // aunque no se engorde ni una carta más.
  if (sinFecha.size) {
    let curadas = 0
    const arranqueFechas = Date.now()
    for (const setId of orden) {
      if (!sinFecha.has(setId)) continue
      if (Date.now() - arranqueFechas > PRESUPUESTO_MS) break
      if (await curarFechaDeSet(clave, setId)) curadas++
      await esperar(PAUSA_MS)
    }
    return Response.json({ fase: 'fechas', curadas, quedaban: sinFecha.size })
  }

  const pendientes = await siguientes(clave, orden)
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

  return Response.json({ fase: 'cartas', hechas, fallidas, sinTiempo, pedidas: pendientes.length })
}

// Cada cinco minutos. Antes era cada hora con tandas de 150, y esa
// cuenta no salía: no caben en los 30 s que da Netlify. Tandas cortas y
// más a menudo dan MÁS cartas al día (40 × 12 = 480 a la hora frente a
// 150) y además ninguna pasada se muere a mitad.
export const config = { schedule: '*/5 * * * *' }
