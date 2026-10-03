import { MERCADOS_A_IMPORTAR, idiomaDeMercado } from '../../js/mercados.js'
import { esDelTCG } from '../../js/catalogo-series.js'
import {
  setToRow, cardToRow, sinDuplicados, porImagen,
  loQueFaltaDeUnSet, faltaVisitar, VERSION_CURADO,
  urlDeSet, urlDeCarta, detalleDeCarta,
} from '../lib/carta-detalle.mjs'

// Completa SOLO los catálogos asiáticos (tanda 471).
//
// ── El fallo, y es de los que no dan error ──
//
// PINGU: «seguimos con los problemas del chino y del japonés. No están
// las cartas, no están los logos. ¿De dónde estamos cogiendo? TCGdex
// supuestamente tiene todo el catálogo… no hay nada, o prácticamente
// nada. La única que veo es [una] que viene con logo y viene con las
// cartas, y no veo ninguna otra».
//
// Lo tenía todo escrito, repartido en sitios que nadie iba a juntar:
//
//   1. Las CARTAS de un mercado solo entran por «Importar los que
//      faltan» del panel, que es un bucle en una PESTAÑA DEL NAVEGADOR:
//      una petición por set, ~550 sets entre japonés y los dos chinos.
//      Eso es más de un cuarto de hora con la pestaña abierta y sin
//      tocar nada. Nadie lo ha terminado nunca, y el que lo deja a
//      medias no deja ninguna señal: los sets están ahí, con su nombre,
//      y lo que falta son las cartas.
//
//   2. Los LOGOS y la SERIE los cura `cartas-detalle`, que lleva
//      `const MERCADO = 'WEST'` desde el primer día — con un comentario
//      que lo justifica («engordarlos multiplicaría por cuatro las
//      peticiones sin que hoy los vea nadie»), y que dejó de ser verdad
//      en la tanda 437, cuando el selector de catálogo puso el japonés
//      y el chino DELANTE de la gente. Así que los sets asiáticos nunca
//      han tenido `serie_id`, y sin serie no hay respaldo de imagen:
//      `urlDeLogoPorPartes` devuelve null y el logo no se dibuja.
//      Tampoco `card_count_*`, así que la estantería medía «0 de 0».
//
// O sea: el logo que falta y la carta que falta eran el MISMO agujero
// visto dos veces, y el remedio de los dos es el mismo — pedirle a
// TCGdex el set COMPLETO, que trae sus cartas, su serie, su logo, sus
// cuentas y su fecha de una vez.
//
// ── Por qué una función programada y no un botón ──
//
// Porque un trabajo de ~550 peticiones no se le puede pedir a una
// persona delante de una pestaña. Aquí va por pasadas cortas, se reanuda
// solo y se acaba sin que nadie mire: `imported_at` marca las cartas
// hechas y `curado_v` la visita, así que cuando no quede nada esto
// cuesta UNA consulta que devuelve una lista corta.
//
// Y de VIDA CORTA a propósito: no reimporta cartas de un set ya
// importado. Un set que TCGdex declara con más cartas de las que publica
// volvería en cada pasada para siempre, que es exactamente el cerrojo de
// la tanda 333 — el que dejó el engorde de cartas sin arrancar jamás.
// Rellenar un set corto sigue siendo el botón «Importar los cortos» del
// panel, que es una decisión y no una tarea.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const API = 'https://api.tcgdex.net/v2'

// Los asiáticos son los de la lista de importación menos el occidental.
// Se calcula y no se escribe: añadir el coreano a `MERCADOS_A_IMPORTAR`
// tiene que bastar, sin acordarse de este fichero.
const MERCADOS = MERCADOS_A_IMPORTAR.filter((m) => m !== 'WEST')

// Netlify mata una función programada a los 30 segundos, sin avisar y
// sin dejar terminar la petición en curso. Parar por nuestra cuenta
// antes deja la pasada cerrada en orden y la respuesta dice qué se hizo:
// es la diferencia entre «se acabó el tiempo» y «nos mataron».
const PRESUPUESTO_MS = 22000

// Lo que puede comerse el repaso del LISTADO. Es UNA petición, pero de
// un JSON de ~400 sets: no es gratis y no es lo importante.
const PRESUPUESTO_LISTADO_MS = 5000

// Entre peticiones a TCGdex. No es paranoia: es un catálogo comunitario
// y gratuito que mantiene gente en su tiempo libre, y 500 peticiones
// seguidas es la forma de que te bloqueen el rango.
const PAUSA_MS = 350

// Techo de sets por pasada. El corte de verdad es el presupuesto de
// tiempo; esto solo evita que una pasada afortunada se desmande.
const POR_PASADA = 20

// Cuánto del presupuesto se lleva traer sets. Lo que sobre se lo queda el
// engorde de cartas (tanda 483), que es una cola de 21.000 y tiene que
// avanzar TAMBIÉN los días en que haya sets nuevos — si no, cualquier set
// que aparezca paraía la Pokédex otra vez.
const PRESUPUESTO_SETS_MS = 12000

// Y cuántas cartas como mucho por pasada. El número no sale de lo que me
// apetece: sale de ser educado. `cartas-detalle` ya hace 30 cada cinco
// minutos contra el mismo catálogo comunitario y gratuito; 25 cada tres
// suman ~860 peticiones a la hora entre las dos, que para un trabajo
// FINITO es defendible y para uno perpetuo no lo sería.
const CARTAS_POR_PASADA = 25

// Cuántas cartas por sentencia. Un set japonés largo pasa de 300 y
// PostgREST tiene un límite de tamaño de petición.
const CARTAS_POR_LOTE = 200

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

// ── Las columnas que puede que no existan todavía ──
//
// Cada migración la ejecuta un humano, y pedirle a PostgREST una columna
// que no está **no devuelve null: devuelve un 400 y tumba la consulta
// entera**. Se prueban de más a menos, quitando UNA cada vez, igual que
// en `cartas-detalle`.
const BASE =
  'id,market,name,imported_at,imported_cards,release_date,serie_id,serie_name,' +
  'tcg_online_code,logo_path,symbol_url,card_count_official,card_count_total'
const CANDIDATAS = [`${BASE},curado_at,curado_v`, `${BASE},curado_at`, BASE]

// Los sets de los mercados asiáticos, del más nuevo al más viejo.
//
// El `nullslast` aquí SÍ funciona: `release_date` es una columna PROPIA
// de `tcg_sets`. Lo que PostgREST se come en silencio es el `nullslast`
// de un `order` sobre una tabla EMBEBIDA (tanda 322), y ese fue el que
// puso las promos de McDonald's de 2014 a la cabeza del engorde.
async function setsAsiaticos(pedir) {
  const filtro = `&market=in.(${MERCADOS.join(',')})&order=release_date.desc.nullslast&limit=2000`
  for (const cols of CANDIDATAS) {
    const filas = await pedir(`tcg_sets?select=${cols}${filtro}`).catch(() => null)
    if (filas) return filas
  }
  return []
}

// ¿Hay algo que ir a buscarle a este set?
//
// Dos motivos, y los dos se arreglan con la MISMA petición: o no tiene
// cartas, o no se le ha visitado nunca (y entonces le faltan la serie,
// el logo y las cuentas). Por eso la visita hace las dos cosas y no se
// pide el set dos veces.
export function hayQueVisitar(fila) {
  return !fila?.imported_at || faltaVisitar(fila)
}

// ── Fase 1: el LISTADO de un mercado ──
//
// Un mercado por pasada, por turnos. Sirve para que un set NUEVO aparezca
// solo, sin que nadie entre en /admin.
//
// Y solo INSERTA los que no tenemos; no es un upsert. Un `merge-
// duplicates` con lo que da el listado escribiría NULL encima del logo,
// la serie, la fecha y las cuentas que la visita acaba de curar — el
// listado es un «SetResume» y no trae ninguna de esas cuatro. Pisar lo
// bueno con lo que no se sabe no daría ningún error: dejaría la
// estantería como estaba el primer día.
export async function repasarListado(pedir, traer, market) {
  const sets = await traer(`${API}/${idiomaDeMercado(market)}/sets`)
  const crudas = (sets || []).filter(esDelTCG).map((s) => setToRow(s, market))
  const { filas } = sinDuplicados(crudas, ['id', 'market'])
  const nuestros = (await pedir(`tcg_sets?select=id&market=eq.${market}&limit=2000`)) || []
  const yaEstan = new Set(nuestros.map((s) => s.id))
  const nuevos = filas.filter((s) => !yaEstan.has(s.id))
  for (let i = 0; i < nuevos.length; i += 100) {
    await pedir('tcg_sets', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(nuevos.slice(i, i + 100)),
    })
  }
  return { vistos: filas.length, nuevos: nuevos.length }
}

// A qué mercado le toca el listado en esta pasada (tanda 479).
//
// Era un turno por el reloj a secas, y eso está bien para ir recogiendo
// los sets NUEVOS — pero no para arrancar. Un mercado con CERO sets es el
// tapón de todo lo demás: sin sus filas en `tcg_sets`, la fase de las
// cartas no tiene a quién visitar y la pasada entera no hace nada. Y con
// el turno por el reloj, llenar el japés dependía de que le tocara.
//
// Así que primero el que esté a cero, y sin prisa; y cuando no quede
// ninguno, el turno de siempre.
export async function aQuienLeToca(pedir, minuto) {
  for (const market of MERCADOS) {
    // `head: true` por la cabecera `Prefer: count=exact` y `limit=1`: no
    // trae filas, solo cuántas hay.
    const filas = await pedir(`tcg_sets?select=id&market=eq.${market}&limit=1`).catch(() => null)
    if (Array.isArray(filas) && filas.length === 0) return { market, bootstrap: true }
  }
  return { market: MERCADOS[minuto % MERCADOS.length], bootstrap: false }
}

// ── Fase 2: la VISITA a un set ──
//
// Una petición, dos trabajos. Devuelve qué se hizo para poder contarlo.
export async function visitarSet(pedir, traer, fila) {
  const market = fila.market
  const completo = await traer(urlDeSet(fila.id, market))

  let cartas = 0
  // Las cartas SOLO la primera vez (ver arriba: el cerrojo de la 333).
  if (!fila.imported_at) {
    const { filas } = sinDuplicados(
      (completo?.cards || []).map((c) => cardToRow(c, fila.id, market)),
      ['id', 'market']
    )
    // EN DOS SENTENCIAS (tanda 487): las que no traen foto NO mencionan
    // `image_path`, porque el null de `cardToRow` pisaría con un
    // `merge-duplicates` la que se hubiera encontrado buscando el fichero
    // a mano. Aquí hoy no reimportamos un set (el cerrojo de la 333), así
    // que es cinturón además de tirantes — pero el cerrojo depende de
    // `imported_at` y esto no depende de nada.
    const { con, sin } = porImagen(filas)
    for (const grupo of [con, sin]) {
      for (let i = 0; i < grupo.length; i += CARTAS_POR_LOTE) {
        await pedir('tcg_cards?on_conflict=id,market', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(grupo.slice(i, i + CARTAS_POR_LOTE)),
        })
      }
    }
    cartas = filas.length
  }

  // Y lo que le falte a la FILA del set: serie, logo, símbolo, fecha y
  // las dos cuentas. `loQueFaltaDeUnSet` nunca escribe null encima de
  // algo que ya estuviera bien.
  const cambios = loQueFaltaDeUnSet(fila, completo)
  if (cartas) {
    // En la MISMA sentencia que las cartas no se puede, pero sí en el
    // mismo PATCH que la cura: si fueran dos, un corte entre ellas
    // dejaría el set con las cartas puestas y sin marcar, y la pasada
    // siguiente las traería otra vez.
    cambios.imported_at = new Date().toISOString()
    cambios.imported_cards = cartas
  }
  // La marca de «ya hemos ido a mirar» se escribe SIEMPRE, aunque no
  // hubiera nada que rellenar: sin ella el set volvería en cada pasada
  // para siempre. Y solo si la columna EXISTE — mandarla sin la
  // migración puesta devuelve un 400 que se llevaría por delante la cura
  // entera, no solo la marca.
  if ('curado_at' in fila) cambios.curado_at = new Date().toISOString()
  if ('curado_v' in fila) cambios.curado_v = VERSION_CURADO
  if (Object.keys(cambios).length) {
    await pedir(`tcg_sets?id=eq.${encodeURIComponent(fila.id)}&market=eq.${market}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(cambios),
    })
  }
  return { cartas, curado: Object.keys(cambios).length > 0 }
}

// ── Fase 3: ENGORDAR las cartas asiáticas (tanda 483) ──
//
// PINGU: «me voy a la Pokédex japonesa y ningún Pokémon tiene cartas. Está
// vacío». Con 13.006 cartas japonesas importadas.
//
// Y no era de TCGdex, era nuestro, y de dos sitios a la vez:
//
//   · `cartas-pokedex` —la función que rellena `dex_ids`— lleva
//     `const MERCADO = 'WEST'`, así que ninguna carta asiática lo tiene.
//   · Y su mecanismo no habría servido igual: deduce la especie del
//     NOMBRE, y 「フシギダネ」 no casa con ninguna lista nuestra. Lo mismo le
//     pasa al respaldo por nombre de la pantalla (`esDeLaEspecie`).
//
// Un número de Pokédex no depende del idioma, y TCGdex lo da en el
// detalle de cada carta (`dexId`) — nunca se lo habíamos pedido. Así que
// esta fase es el mismo engorde que hace `cartas-detalle` con el
// occidental, para los otros tres catálogos: una petición por carta, con
// su pausa, reanudándose sola por `detalle_at`.
//
// De paso trae la rareza, el tipo y el ilustrador, que es lo que hoy deja
// los filtros de una expansión japonesa sin nada que filtrar.
//
// LO QUE NO TOCA, Y ES LA REGLA DE LA CASA: el `name`. En un catálogo
// asiático el nombre japonés ES la clave canónica, no una traducción
// (tandas 334 y 335). `detalleDeCarta` no lo devuelve, y aquí tampoco se
// añade.
export async function engordarCartas(pedir, traer, reloj, hasta) {
  const columnas = 'id,market'
  const filas =
    (await pedir(
      `tcg_cards?select=${columnas}&market=in.(${MERCADOS.join(',')})&detalle_at=is.null&limit=${CARTAS_POR_PASADA}`
    )) || []
  let hechas = 0
  let conEspecie = 0
  for (const carta of filas) {
    if (reloj() > hasta) break
    try {
      const detalle = detalleDeCarta(await traer(urlDeCarta(carta.id, carta.market)))
      // `detalle_at` va en la MISMA sentencia que los datos: si fueran
      // dos, un corte entre ellas dejaría la carta engordada y sin marcar,
      // y la pasada siguiente la repetiría. Con 21.000 por delante eso no
      // es un detalle, es no acabar nunca.
      await pedir(`tcg_cards?id=eq.${encodeURIComponent(carta.id)}&market=eq.${carta.market}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...(detalle || {}), detalle_at: new Date().toISOString(), detalle_error: null }),
      })
      if (detalle?.dex_ids?.length) conEspecie++
      hechas++
    } catch (e) {
      // El fallo se GUARDA en la fila y se marca la carta: una que TCGdex
      // no conoce volvería en cada pasada para siempre, que es el cerrojo
      // de la 333 otra vez. Un log de Netlify caduca; una columna deja
      // preguntar mañana cuáles fallaron y por qué.
      await pedir(`tcg_cards?id=eq.${encodeURIComponent(carta.id)}&market=eq.${carta.market}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ detalle_at: new Date().toISOString(), detalle_error: String(e?.message || e).slice(0, 200) }),
      }).catch(() => {})
    }
    await esperar(PAUSA_MS)
  }
  return { hechas, conEspecie, pedidas: filas.length }
}

export async function procesar({ env = process.env, fetchImpl = null, traerImpl = null, reloj = () => Date.now() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const pedir = fetchImpl ? (ruta, o) => fetchImpl(ruta, o) : (ruta, o) => rest(ruta, clave, o)
  const traer =
    traerImpl ||
    (async (url) => {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`TCGdex ${res.status} en ${url}`)
      return res.json()
    })
  const empezo = reloj()

  const cuenta = { setsNuevos: 0, setsVisitados: 0, setsCurados: 0, cartas: 0, fallos: [] }
  if (!MERCADOS.length) return { ok: true, ...cuenta, nota: 'no hay mercados asiáticos en MERCADOS_A_IMPORTAR' }

  try {
    // Fase 1. El que esté VACÍO primero, y si no hay ninguno, por turnos
    // según el reloj (tanda 479).
    const { market: turno, bootstrap } = await aQuienLeToca(pedir, Math.floor(empezo / 60000))
    cuenta.listado = turno
    if (bootstrap) cuenta.arrancando = turno
    // El corte por tiempo se escribe así y no con un `Promise.race` a
    // secas: una promesa que PIERDE la carrera sigue corriendo, y si
    // falla después nadie recoge su error — eso es un «unhandled
    // rejection», que en Netlify se lleva el proceso por delante. Así el
    // fallo se recoge SIEMPRE, gane o pierda, y el temporizador se
    // cancela para no dejar la función viva cinco segundos de más.
    const trabajo = repasarListado(pedir, traer, turno).then(
      (r) => ({ r }),
      (e) => ({ e })
    )
    // Y al ARRANQUE no se le pone reloj: traer los ~400 sets de un
    // catálogo vacío es una petición gorda y cuatro inserciones, y
    // cortarlo a los cinco segundos dejaba la pasada siguiente
    // empezándolo otra vez desde el principio. Sin sus filas no hay nada
    // más que hacer en esta pasada, así que esperar es justo lo correcto.
    const corte = new Promise((listo) => {
      if (bootstrap) return
      const t = setTimeout(() => listo({ tarde: true }), PRESUPUESTO_LISTADO_MS)
      trabajo.then(() => clearTimeout(t))
    })
    const listado = await Promise.race([trabajo, corte])
    if (listado.e) cuenta.fallos.push(`listado ${turno}: ${String(listado.e?.message || listado.e).slice(0, 120)}`)
    if (listado.r) cuenta.setsNuevos = listado.r.nuevos

    // Fase 2. Lo gordo.
    const pendientes = (await setsAsiaticos(pedir)).filter(hayQueVisitar)
    cuenta.pendientes = pendientes.length
    // Primero los que no tienen NI UNA carta: un set sin cartas es una
    // pantalla vacía, y uno sin serie es un logo que no sale. Lo primero
    // molesta más.
    pendientes.sort((a, b) => (a.imported_at ? 1 : 0) - (b.imported_at ? 1 : 0))

    // Los sets se llevan su trozo del presupuesto y no la pasada entera
    // (tanda 483): detrás va el engorde, que es una cola de 21.000 y tiene
    // que avanzar también los días en que aparezca un set nuevo. Es el
    // mismo reparto que `cartas-detalle` aprendió en la 333, cuando una
    // fase excluyente dejó al engorde sin arrancar jamás.
    const hastaLosSets = empezo + PRESUPUESTO_SETS_MS
    for (const fila of pendientes.slice(0, POR_PASADA)) {
      if (reloj() > hastaLosSets) break
      try {
        const r = await visitarSet(pedir, traer, fila)
        cuenta.setsVisitados++
        cuenta.cartas += r.cartas
        if (r.curado) cuenta.setsCurados++
      } catch (e) {
        // Un set que falle no puede parar los otros 500: se cuenta y se
        // sigue. Volverá en la pasada siguiente, porque no se ha
        // marcado nada.
        cuenta.fallos.push(`${fila.market}/${fila.id}: ${String(e?.message || e).slice(0, 120)}`)
      }
      await esperar(PAUSA_MS)
    }

    // Fase 3. El engorde, con lo que quede de pasada.
    const engorde = await engordarCartas(pedir, traer, reloj, empezo + PRESUPUESTO_MS)
    cuenta.engordadas = engorde.hechas
    cuenta.conEspecie = engorde.conEspecie
  } catch (e) {
    const texto = String(e?.message || e)
    // Sin la migración puesta no es un fallo que haya que gritar cada
    // seis minutos: es «todavía no». Mismo trato que le dan las otras.
    if (/PGRST|does not exist|Could not find/.test(texto)) {
      return { ok: true, saltado: 'falta ejecutar la migración del catálogo', ...cuenta }
    }
    return { ok: false, error: texto, ...cuenta }
  }
  // Los fallos no se guardan enteros en la respuesta: tres bastan para
  // saber si es «TCGdex no conoce ese set» o «la base dice que no».
  return { ok: true, ...cuenta, fallos: cuenta.fallos.slice(0, 3), conFallo: cuenta.fallos.length }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('catalogo-asia:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada TRES minutos (tanda 479; nací con seis). Con ~550 sets entre los
// tres mercados y ~15 por pasada, a seis minutos eran cinco horas largas
// — y eso es mucho tiempo mirando un catálogo vacío sin saber si está
// pasando algo. A tres son unas dos horas.
//
// Y sigue siendo de vida corta: cuando no quede nada que visitar, esto
// cuesta una consulta que devuelve una lista corta y un listado que no
// trae nada nuevo. El gasto contra TCGdex es finito y se acaba solo.
//
// Tres y no cinco para no coincidir SIEMPRE con `cartas-detalle`, que va a
// `*/5`: así coinciden una de cada cinco pasadas en vez de todas.
export const config = { schedule: '*/3 * * * *' }
