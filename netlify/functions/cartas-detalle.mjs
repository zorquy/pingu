import { detalleEnEspanol, urlDeSet, leFaltaAlgo, loQueFaltaDeUnSet, nombresPorArreglar, marcaHeredada } from '../lib/carta-detalle.mjs'

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

// Y cuánto puede comerse la reparación de nombres (tanda 335). Es una
// fase de vida corta: acaba cuando no queden sets marcados, y a partir
// de ahí no cuesta nada porque la consulta no devuelve ninguno.
const PRESUPUESTO_NOMBRES_MS = 6000

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
  // `names_fixed_at` la añade una migración que ejecuta un humano, y
  // pedirle a PostgREST una columna que no existe **no devuelve null:
  // devuelve un 400 y tumba la consulta entera**. Sin esta vuelta atrás,
  // subir esto antes de ejecutar la migración pararía el engorde en
  // seco. Se pide con ella y, si no está, sin ella.
  const columnas = 'id,release_date,serie_id,serie_name,tcg_online_code,regulation_mark,regulation_mark_origen'
  const ordenar = '&order=release_date.desc.nullslast'
  const sets = await rest(
    `tcg_sets?select=${columnas},names_fixed_at&market=eq.${MERCADO}${ordenar}`,
    clave
  ).catch(() =>
    // Sin la migración de la 335 no existe `names_fixed_at`; sin la de la
    // 339 tampoco `regulation_mark`. Las dos vueltas atrás son la misma
    // idea: PostgREST devuelve 400 —no null— si le pides una columna que
    // no está, y eso tumbaría la consulta entera y pararía el engorde.
    rest(`tcg_sets?select=${columnas}&market=eq.${MERCADO}${ordenar}`, clave).catch(() =>
      rest(`tcg_sets?select=id,release_date,serie_id,serie_name,tcg_online_code&market=eq.${MERCADO}${ordenar}`, clave)
    )
  )
  const filas = sets || []
  return {
    orden: filas.map((s) => s.id),
    // Indexadas por id para poder escribir SOLO lo que falte y no gastar
    // un PATCH en un set que ya está completo.
    porId: new Map(filas.map((s) => [s.id, s])),
    incompletos: new Set(filas.filter(leFaltaAlgo).map((s) => s.id)),
    // Los que todavía tienen cartas con el nombre pisado (tanda 335).
    // `=== null` y no un `!`: sin la migración la columna no viaja y el
    // valor es `undefined`, que aquí significa «no hay nada que
    // reparar» y deja la fase apagada. Pendiente de verdad es null.
    porReparar: filas.filter((s) => s.names_fixed_at === null).map((s) => s.id),
    // Los que no tienen marca de regulación (tanda 339). Sin la
    // migración la columna no viaja y esto sale vacío: la fase no corre.
    porMarcar: filas.filter((s) => s.regulation_mark === null).map((s) => s.id),
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

// ── Devolverle a un set sus nombres en inglés (tanda 335) ──
//
// Entre la tanda 330 y la 335, el engorde en español escribía el nombre
// traducido ENCIMA de `tcg_cards.name`. Y ese nombre es la CLAVE con la
// que se cruzan el agregado de `tcg_card_play`, el respaldo del
// resolutor de decklists y la huella de las reimpresiones — así que las
// cartas traducidas dejaron de casar con nada, sin dar error.
//
// El español ya está a salvo (la migración lo copió a `name_es`). El
// inglés se había perdido, y se recupera del LISTADO de un set, que sí
// trae el nombre de todas sus cartas: ~220 peticiones en vez de 2.811.
//
// Se escribe en UNA sola sentencia por set, con un upsert que solo
// lleva la clave y el nombre: PATCH carta a carta serían 200 viajes y
// la pasada moriría a los 30 segundos. Y solo se mandan los
// identificadores que YA tenemos en la tabla — un `merge-duplicates`
// con un id que no existe insertaría una fila a medias.
async function repararNombresDeUnSet(clave, setId) {
  const res = await fetch(urlDeSet(setId, MERCADO), { headers: { Accept: 'application/json' } })
  // Un set que TCGdex no conoce no se puede arreglar nunca: se marca
  // como visto para que no vuelva a pedirse en cada pasada. Es la
  // lección del cerrojo de la 333.
  if (res.status === 404) return 0
  if (!res.ok) return null

  const completo = await res.json()

  // `name_es=not.is.null` es la criba que importa: son las que se
  // engordaron en español, que son exactamente las que pueden tener el
  // nombre pisado. Qué filas hay que escribir lo decide
  // `nombresPorArreglar`, que es pura y se prueba sin red.
  const nuestras =
    (await rest(
      `tcg_cards?select=id,name&market=eq.${MERCADO}&set_id=eq.${encodeURIComponent(setId)}` +
        '&name_es=not.is.null&limit=1000',
      clave
    )) || []
  const cambios = nombresPorArreglar(nuestras, completo, MERCADO)
  if (!cambios.length) return 0

  await rest('tcg_cards', clave, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(cambios),
  })
  return cambios.length
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
  const { orden, porId, incompletos, porReparar, porMarcar } = await setsPorPrioridad(clave)

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

  // ── Y los nombres ingleses que el engorde en español se llevó ──
  //
  // Va después de la cura de sets y antes del engorde, y acotada: es
  // trabajo de una sola vez, y mientras dure el bloque «En los torneos
  // de PokeDoc» no sale en las cartas traducidas.
  let nombresArreglados = 0
  for (const setId of porReparar) {
    if (Date.now() - arranque > PRESUPUESTO_SETS_MS + PRESUPUESTO_NOMBRES_MS) break
    const cuantos = await repararNombresDeUnSet(clave, setId).catch(() => null)
    // null es «no se ha podido, que lo intente la pasada siguiente»; un
    // número —incluido el 0— es «visto», y el set se marca.
    if (cuantos !== null) {
      nombresArreglados += cuantos
      await rest(`tcg_sets?id=eq.${encodeURIComponent(setId)}&market=eq.${MERCADO}`, clave, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ names_fixed_at: new Date().toISOString() }),
      }).catch(() => {})
    }
    await esperar(PAUSA_MS)
  }

  // ── Y los sets que llegan sin marca de regulación (tanda 339) ──
  //
  // La marca es del SET, y TCGdex no la trae para algunos. Sin ella la
  // ficha dice «No es legal en Estándar» de una carta que sí lo es. La
  // migración arregló los que había; esto es para los que vengan, que si
  // no habría que repetirla a mano con cada set nuevo.
  //
  // Es barato: solo mira los sets SIN marca, que después de la migración
  // son los recién importados. Cuando no hay ninguno, no cuesta nada.
  let marcasPuestas = 0
  for (const setId of porMarcar) {
    const heredada = marcaHeredada(porId.get(setId), [...porId.values()])
    if (!heredada) continue
    try {
      await rest(`tcg_sets?id=eq.${encodeURIComponent(setId)}&market=eq.${MERCADO}`, clave, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ regulation_mark: heredada, regulation_mark_origen: 'fecha' }),
      })
      // Y a sus cartas, solo donde está vacía: lo que TCGdex haya dicho
      // de una carta concreta no se toca nunca.
      await rest(
        `tcg_cards?set_id=eq.${encodeURIComponent(setId)}&market=eq.${MERCADO}&regulation_mark=is.null`,
        clave,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ regulation_mark: heredada }) }
      )
      porId.get(setId).regulation_mark = heredada
      marcasPuestas++
    } catch {
      // Si falla, la pasada siguiente lo reintenta: el set sigue sin marca.
    }
  }

  const pendientes = await siguientes(clave, orden)
  if (!pendientes.length) {
    return Response.json({ setsCurados, nombresArreglados, marcasPuestas, hechas: 0, fallidas: 0, mensaje: 'No queda ninguna por engordar' })
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
      // El nombre traducido va a `name_es`, NUNCA encima de `name`
      // (tanda 335).
      //
      // `name` es la CLAVE con la que se cruzan tres cosas que vienen en
      // inglés: el agregado de `tcg_card_play` (que se construye con el
      // texto de las decklists), el respaldo por nombre del resolutor y
      // la huella de las reimpresiones. Pisarlo dejaba el bloque «En los
      // torneos de PokeDoc» sin poder casar jamás — y sin dar error.
      //
      // Lo que se guarda como clave es canónico; lo que se enseña va
      // traducido. Misma lección que los enums de la 334.
      if (encontrado.nombre && encontrado.idioma !== 'en') detalle.name_es = encontrado.nombre
      // `detalle_at` se escribe en la MISMA sentencia que los datos. Si
      // fueran dos, un corte entre ellas dejaría la carta engordada y
      // marcada como pendiente, y la siguiente pasada la repetiría — con
      // 23.000 cartas eso no es un detalle, es no terminar nunca.
      // Si TCGdex no manda la marca pero su set sí la tiene, se pone la
      // del set: es la misma para todas sus cartas, y dejarla vacía hace
      // que la ficha diga que no es legal (tanda 339).
      if (!detalle.regulation_mark) {
        const delSet = porId.get(carta.set_id)?.regulation_mark
        if (delSet) detalle.regulation_mark = delSet
      }
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

  return Response.json({ setsCurados, nombresArreglados, marcasPuestas, hechas, fallidas, sinTiempo, pedidas: pendientes.length })
}

// Cada cinco minutos. Antes era cada hora con tandas de 150, y esa
// cuenta no salía: no caben en los 30 s que da Netlify. Tandas cortas y
// más a menudo dan MÁS cartas al día (40 × 12 = 480 a la hora frente a
// 150) y además ninguna pasada se muere a mitad.
export const config = { schedule: '*/5 * * * *' }
