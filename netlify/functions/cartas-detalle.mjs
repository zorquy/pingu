import { detalleEnEspanol, urlDeSet, leFaltaAlgo, loQueFaltaDeUnSet } from '../lib/carta-detalle.mjs'

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
const POR_PASADA = 30

// Cuándo dejar de empezar cartas nuevas. Netlify corta a los 30 s sin
// avisar y sin dejar terminar la petición en curso; parar por nuestra
// cuenta antes deja la pasada cerrada en orden y la respuesta dice
// cuántas se hicieron. Es la diferencia entre «se acabó el tiempo» y
// «nos mataron».
const PRESUPUESTO_MS = 22000

// Cuánto de ese presupuesto puede comerse la cura de sets. Era una fase
// EXCLUYENTE —«primero los sets, y se llevan la pasada entera»— y eso
// tenía sentido cuando faltaban las 220 fechas y la prioridad no podía
// funcionar sin ellas. Pero se convirtió en un cerrojo: bastaba UN set
// que TCGdex no pudiera completar para que la fase no acabara nunca y
// el engorde no arrancara jamás (tanda 333). Ahora los sets van
// primero pero acotados, y las cartas corren SIEMPRE con lo que quede.
const PRESUPUESTO_SETS_MS = 8000

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
    `tcg_sets?select=id,release_date,serie_id,serie_name,tcg_online_code&market=eq.${MERCADO}` +
      '&order=release_date.desc.nullslast',
    clave
  )
  const filas = sets || []
  return {
    orden: filas.map((s) => s.id),
    // Indexadas por id para poder escribir SOLO lo que falte y no gastar
    // un PATCH en un set que ya está completo.
    porId: new Map(filas.map((s) => [s.id, s])),
    incompletos: new Set(filas.filter(leFaltaAlgo).map((s) => s.id)),
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
async function curarSet(clave, fila) {
  try {
    const res = await fetch(urlDeSet(fila.id, MERCADO), { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const cambios = loQueFaltaDeUnSet(fila, await res.json())
    if (!Object.keys(cambios).length) return null
    await rest(`tcg_sets?id=eq.${encodeURIComponent(fila.id)}&market=eq.${MERCADO}`, clave, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(cambios),
    })
    return cambios
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
      // Sin engordar, o engordada ANTES de la tanda 330 —cuando no se
      // pedía en español y no se apuntaba el idioma—. Esas se vuelven a
      // pasar una vez; las que ya se intentaron y salieron en inglés
      // NO, porque repetir lo que ya se sabe que no existe son 23.000
      // peticiones para nada.
      '&or=(detalle_at.is.null,detalle_lang.is.null)' +
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

  const arranque = Date.now()
  const { orden, porId, incompletos } = await setsPorPrioridad(clave)

  // ── Primero, los SETS que quedan por visitar ──
  //
  // Era solo la fecha. Desde la tanda 329 cura también la SERIE y el
  // CÓDIGO DE TCG LIVE, porque los tres se le olvidan por el mismo
  // motivo: `fetchSets` corre sobre el LISTADO, que es un «SetResume»,
  // y allí no viene ninguno de los tres.
  //
  // El código no es cosmético: sin él, una línea de decklist que diga
  // «30C» no encuentra su set, la carta se busca por nombre y el
  // comprobador de reglamento se queda sin poder juzgarla. Y la serie
  // tampoco: sin ella no hay eras en el índice y el filtro de Pocket
  // del importador no funciona.
  //
  // En la 329 esta fase era EXCLUYENTE y devolvía aquí mismo, porque la
  // prioridad por fecha no podía funcionar hasta saber todas las
  // fechas. Ese trabajo ya está hecho (206 de 210), y la exclusividad
  // resultó ser un cerrojo: un set que TCGdex no puede completar —los
  // anteriores a TCG Online no tienen código— se quedaba «incompleto»
  // para siempre, la fase no acababa nunca y el engorde no arrancaba
  // jamás (tanda 333). Ahora `leFaltaAlgo` mira solo la serie, que el
  // set completo trae SIEMPRE —un set con serie es un set ya
  // visitado—, y esta fase corre acotada, con las cartas detrás.
  let setsCurados = 0
  if (incompletos.size) {
    for (const setId of orden) {
      if (!incompletos.has(setId)) continue
      if (Date.now() - arranque > PRESUPUESTO_SETS_MS) break
      if (await curarSet(clave, porId.get(setId))) setsCurados++
      await esperar(PAUSA_MS)
    }
  }

  const pendientes = await siguientes(clave, orden)
  if (!pendientes.length) {
    return Response.json({ setsCurados, hechas: 0, fallidas: 0, mensaje: 'No queda ninguna por engordar' })
  }

  let hechas = 0
  let fallidas = 0
  let sinTiempo = 0

  for (const carta of pendientes) {
    if (Date.now() - arranque > PRESUPUESTO_MS) {
      sinTiempo = pendientes.length - hechas - fallidas
      break
    }
    try {
      // Español primero, inglés si esa carta no está traducida. Son dos
      // peticiones solo para las que NO tienen español, que son las
      // viejas; las modernas se resuelven en la primera.
      const encontrado = await detalleEnEspanol(carta.id, async (url) => {
        const res = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!res.ok) return null
        return res.json()
      })
      if (!encontrado) throw new Error('respuesta vacía')
      const detalle = { ...encontrado.fila, detalle_lang: encontrado.idioma }
      // El nombre traducido se escribe SOLO si vino de verdad: pisarlo
      // con null dejaría la carta sin nombre y sin forma de buscarla.
      if (encontrado.nombre) detalle.name = encontrado.nombre
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

  return Response.json({ setsCurados, hechas, fallidas, sinTiempo, pedidas: pendientes.length })
}

// Cada cinco minutos. Antes era cada hora con tandas de 150, y esa
// cuenta no salía: no caben en los 30 s que da Netlify. Tandas cortas y
// más a menudo dan MÁS cartas al día (40 × 12 = 480 a la hora frente a
// 150) y además ninguna pasada se muere a mitad.
export const config = { schedule: '*/5 * * * *' }
