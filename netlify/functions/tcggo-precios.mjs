// Los precios por idioma, desde TCGGO, cada día (tanda 589).
//
// Por cada expansión suya con la que ya hay sets emparejados (lo que dejó
// `tcggo-emparejar` en `scrydex_estado` → `tcggo_pares`), se piden sus
// cartas (100 por página) y a cada carta nuestra con ese `cardmarket_id`
// se le escribe la fila de `tcg_card_prices`: el mínimo Near Mint de
// Cardmarket en cada idioma, las medias, cuántas hay a la venta,
// TCGplayer en euros y las gradeadas. Y el primer día que pasa por cada
// expansión apunta en `tcg_sets` su logo, su id y —si los nuestros
// estaban vacíos— la fecha y el total.
//
// ── UNA VEZ AL DÍA, EN VARIAS PASADAS ──
//
// Cada cinco minutos mira qué expansiones faltan hoy y hace las que le
// quepan en 20 s (con la pausa del plan entre peticiones). El estado
// (`tcggo_precios`: { dia, hechos: [idExpansion…], gasto }) dice por
// dónde va; al acabar todas, marca el día y no pide nada más hasta
// mañana. ~300 peticiones al día en total.
//
// Los frenos son los de `tcggo-emparejar`: tope diario propio (de serie
// el del plan gratis; `TCGGO_TOPE_DIARIO` lo sube), pausa, y parar en
// 429/403. Y si TCGGO contesta una expansión sin un solo `cardmarket_id`,
// se para y lo dice: un vacío no es una respuesta.
//
// A mano desde /admin la lanza `tcggo-precios-ahora` (misma `procesar`):
// una función con `schedule` no admite llamadas por HTTP (Netlify da 403).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_DIARIO, TCGGO_PAUSA_MS.
import {
  cabeceras, baseDe, baseJpDe, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, esLimiteDelPlan, POR_PAGINA_CARTAS, filaDePreciosTcggo, filaDeSetTcggo, esMasPrincipal, filasDeVariantes, filaDeLaCarta, sinSetsRepetidos, sinVersionesRepetidas, preciosDeEdiciones,
} from '../lib/tcggo.mjs'
import { numeroComparable } from '../lib/scrydex.mjs'
import { setsHermanos } from '../../js/catalogo-series.js'
import { CLAVE_ESTADO as CLAVE_PARES, TOPE_DIARIO, PAUSA_MS } from './tcggo-emparejar.mjs'
// Solo la clave: importar la función sería un ciclo.
const CLAVE_CATALOGO = 'tcggo_catalogo'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_precios'
// Sube cuando cambia cómo se escribe el japonés: la pasada lo rehace ese día.
export const VERSION_JP = 832
// Sube cuando las páginas traen algo nuevo que hay que tener hoy (932). La
// 937 escribe además la fila «Standard» de cada carta: se rehace el día.
export const VERSION_VARIANTES = 937
const MS_DE_MARGEN = 20_000

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json' } : {}),
      ...(opciones && !ruta.startsWith('rpc/') ? { prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

export const hoyUTC = () => new Date().toISOString().slice(0, 10)

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, corregirImpl = null, guardarSetsImpl = null, fotoImpl = null, estadoImpl = null, guardarEstadoImpl = null, guardarVersionesImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
  peticiones = 60,
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const topeDiario = Math.max(1, Number(env.TCGGO_TOPE_DIARIO) || TOPE_DIARIO)
  const tope = Math.max(1, Math.min(60, Number(peticiones) || 60))
  const { base, host } = baseDe(env)
  const bases = { WEST: base, JP: baseJpDe(base) }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_prices', clave, { method: 'POST', body: JSON.stringify(filas) }))
  // LAS VERSIONES, EN LA MISMA PETICIÓN (929). Con `include_variants=1`
  // cada carta trae su Reverse, su Poké Ball y su Master Ball con su id y
  // un precio (el de todos los idiomas): se guardan en `tcg_card_versions`
  // sin gastar una petición más. Es lo que hacía, recorriendo ids a ciegas,
  // `tcggo-versiones` (hasta 5.000 peticiones al día).
  const guardarVersiones = guardarVersionesImpl || ((filas) => rest('tcg_card_versions', clave, { method: 'POST', body: JSON.stringify(filas) }))
  // Las cartas japonesas con el id de Cardmarket de antes (830): upsert con
  // las columnas obligatorias repetidas (la 526: tiene que poder formar la fila).
  const corregirCartas = corregirImpl || ((filas) => rest('tcg_cards?on_conflict=id,market', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const guardarSets = guardarSetsImpl || ((sets, mercado = 'WEST') => rest('rpc/tcggo_guardar_sets', clave, { method: 'POST', body: JSON.stringify({ p_sets: sets, p_market: mercado }) }))
  // La foto del histórico (643): una fila de hoy por carta que alguien tiene.
  const foto = fotoImpl || ((d) => rest('rpc/historial_foto_diaria', clave, { method: 'POST', body: JSON.stringify({ p_dia: d }) }))
  const leerEstado = estadoImpl || (async (claveEstado) => (await pedir(`scrydex_estado?select=valor&clave=eq.${claveEstado}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((claveEstado, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: claveEstado, valor, updated_at: new Date().toISOString() }]) }))
  const dia = ahora.toISOString().slice(0, 10)

  // ── Los dos estados: los pares (qué set es qué expansión) y el nuestro ──
  let pares
  let catalogo
  let estado
  try {
    pares = await leerEstado(CLAVE_PARES)
    catalogo = await leerEstado(CLAVE_CATALOGO)
    estado = await leerEstado(CLAVE_ESTADO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  const hechosPares = pares?.hechos && typeof pares.hechos === 'object' ? pares.hechos : {}
  const episodios = Array.isArray(pares?.episodios?.lista) ? pares.episodios.lista : []
  if (!Object.keys(hechosPares).length) return { ok: true, saltado: 'todavía no hay sets emparejados con TCGGO (/admin → Cartas → Emparejar con TCGGO)' }

  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.dia !== dia) estado = { ...estado, dia, hechos: [], hechosJp: [], setsApuntados: false, resumenJp: {}, enCurso: null }
  if (!Array.isArray(estado.hechos)) estado.hechos = []
  if (!Array.isArray(estado.hechosJp)) estado.hechosJp = []
  // Una regla nueva del japonés (830, el id de Cardmarket por `tcggo_id`) se
  // aplica HOY y no mañana: lo japonés hecho hoy se vuelve a hacer una vez.
  if (estado.versionJp !== VERSION_JP) {
    estado.hechosJp = []
    estado.resumenJp = {}
    if (estado.enCurso?.mercado === 'JP') estado.enCurso = null
    estado.versionJp = VERSION_JP
  }
  // Las versiones (929, 932) se piden con la página desde la 929, pero lo
  // que ya se había hecho HOY antes no se volvía a mirar hasta mañana: en
  // Ascended Heroes seguían faltando la Poké Ball y el patrón de energía
  // (PINGU, con el Oddish de Erika). Lo hecho hoy se repite UNA vez, con
  // versiones. Cuesta una vuelta más y la frena el tope diario de siempre.
  if (estado.versionVariantes !== VERSION_VARIANTES) {
    estado.hechos = []
    estado.hechosJp = []
    estado.enCurso = null
    estado.versionVariantes = VERSION_VARIANTES
  }
  if (estado.gasto?.dia !== dia) estado.gasto = { dia, peticiones: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)

  // Qué sets nuestros cuelgan de cada expansión suya (varios pueden: Crown
  // Zenith y su Galarian Gallery). Los sospechosos, fuera.
  const setsPorEpisodio = new Map()
  for (const [setId, h] of Object.entries(hechosPares)) {
    if (!h || h.sospechoso || !Number.isInteger(h.episodio)) continue
    if (!setsPorEpisodio.has(h.episodio)) setsPorEpisodio.set(h.episodio, [])
    setsPorEpisodio.get(h.episodio).push(setId)
  }
  // Y los sets HERMANOS de cada uno (853): la Trainer Gallery de Lost
  // Origin es `swsh11tg`, sin par propio con TCGGO, y sus cartas llevan el
  // id de Cardmarket de la expansión de TCGGO (el catálogo las casa desde
  // la 853). Sin esto, no entraban en `enSets` y se quedaban sin precio.
  try {
    const idsWest = ((await pedir('tcg_sets?select=id&market=eq.WEST&limit=2000')) || []).map((s) => s.id)
    for (const lista of setsPorEpisodio.values()) {
      for (const setId of [...lista]) for (const h of setsHermanos(setId, idsWest)) if (!lista.includes(h)) lista.push(h)
    }
  } catch { /* sin la consulta, los sets de los pares y ya */ }
  // Y las japonesas (642): las que `tcggo-catalogo` ha casado con un set…
  const setsPorEpisodioJp = new Map()
  for (const [id, sets] of Object.entries(catalogo?.setsPorEpisodio?.JP || {})) {
    if (Array.isArray(sets) && sets.length) setsPorEpisodioJp.set(Number(id), sets)
  }
  // …Y TAMBIÉN nuestros sets japoneses con `tcggo_id` (671). El mapa del
  // catálogo solo tiene las expansiones que escribió DESPUÉS de existir el
  // mapa: las de antes están hechas y no se vuelven a visitar, así que sus
  // sets no entraban aquí y sus cartas no tenían precio — «las japonesas
  // no tienen precio; algunas sí, algunas no» (PINGU). La fila del set es
  // la fuente que no se queda vieja (y es una consulta a lo nuestro).
  // De paso, los VISIBLES de cada expansión (831): es adonde se lleva una
  // carta suya que vive en otro set. Sin la consulta no se mueve nada.
  const visiblesJp = new Map()
  try {
    const filasJp = (await pedir('tcg_sets?select=id,tcggo_id,oculto&market=eq.JP&tcggo_id=not.is.null&limit=2000')) || []
    for (const s of filasJp) {
      const id = Number(s.tcggo_id)
      if (!Number.isInteger(id) || id <= 0 || !s.id) continue
      const lista = setsPorEpisodioJp.get(id) || []
      if (!lista.includes(s.id)) setsPorEpisodioJp.set(id, lista.concat([s.id]))
      if (!s.oculto) visiblesJp.set(id, [...(visiblesJp.get(id) || []), s.id])
    }
    // El primero, el que el catálogo apuntó para esa expansión (si se ve).
    for (const [id, lista] of visiblesJp) {
      const delCatalogo = (catalogo?.setsPorEpisodio?.JP?.[id] || []).find((x) => lista.includes(x))
      if (delCatalogo) visiblesJp.set(id, [delCatalogo, ...lista.filter((x) => x !== delCatalogo)])
    }
  } catch { /* sin la consulta se sigue con el mapa del catálogo */ }
  // El japonés bloqueado por el PLAN (671): si TCGGO contesta que el
  // catálogo japonés pide Ultra, no se le vuelve a pedir en todo el día.
  const jpBloqueado = estado.jpBloqueado?.dia === dia
  const pendientes = [...setsPorEpisodio.keys()].filter((id) => !estado.hechos.includes(id))
  const pendientesJp = jpBloqueado ? [] : [...setsPorEpisodioJp.keys()].filter((id) => !estado.hechosJp.includes(id))
  if (!pendientes.length && !pendientesJp.length) {
    if (!estado.hecho) { estado.hecho = true; await persistir() }
    return { ok: true, dia, hecho: true, saltado: `los precios de ${dia} ya están puestos`, episodios: setsPorEpisodio.size + setsPorEpisodioJp.size }
  }
  estado.hecho = false

  // ── Pedir a TCGGO, contando ──
  let gastadas = 0
  let parado = null
  const pedirTcggo = async (url) => {
    if (gastadas >= tope) return { fin: 'tope' }
    if (estado.gasto.peticiones >= topeDiario) {
      parado = `tope diario: hoy ya van ${estado.gasto.peticiones} peticiones de ${topeDiario}`
      return { fin: 'dia' }
    }
    if (!quedaTiempo()) return { fin: 'tiempo' }
    if (gastadas && pausaMs) await pausa(pausaMs)
    gastadas++
    estado.gasto.peticiones++
    const res = await fetchImpl(url, { headers: cabeceras(claveTcggo, host) })
    const texto = await res.text()
    if (!res.ok) {
      parado = esLimiteDelPlan(res.status, texto) ? `RapidAPI ${res.status}: el plan no da más por ahora` : `TCGGO ${res.status}: ${texto.slice(0, 160)}`
      // Lo que para se apunta (671): hasta ahora volvía en la respuesta de
      // la función, que no lee nadie (la lección de la 655).
      estado.ultimoParado = { fecha: ahora.toISOString(), motivo: parado, url: String(url).replace(/\?.*$/, '') }
      if (/japanese_catalog|required_plan|Ultra or Mega/i.test(texto)) {
        estado.jpBloqueado = { dia, motivo: texto.slice(0, 200) }
        return { fin: 'plan-jp' }
      }
      return { fin: 'error' }
    }
    try {
      return { datos: JSON.parse(texto) }
    } catch {
      parado = 'TCGGO ha contestado algo que no es JSON'
      return { fin: 'error' }
    }
  }

  // ── Los sets: logo, fecha y total, una vez al día ──
  // La lista de expansiones en el estado de los pares puede no traer el
  // logo (se guardó antes de la 589): entonces se vuelve a pedir, que son
  // nueve peticiones una vez a la semana.
  // Y desde la 646 también si lo que hay guardado no trae el VALOR de la
  // expansión (una lista de antes), y entonces se vuelve a escribir aunque
  // los sets de hoy ya estuvieran apuntados: así el valor entra en la
  // pasada siguiente y no mañana.
  let setsApuntados = 0
  const listaSinValor = episodios.length > 0 && !episodios.some((e) => e.valorCm != null)
  // Y también si los sets JAPONESES no se han apuntado hoy (672): el mapa
  // japonés creció con la 671 y sus valores no podían esperar a mañana.
  if (!estado.setsApuntados || (listaSinValor && !estado.setsConValor) || (!estado.setsJpApuntados && setsPorEpisodioJp.size)) {
    let lista = episodios
    if (lista.length && (!lista.some((e) => e.logo) || listaSinValor)) {
      const nueva = []
      let pagina = 1
      let completa = false
      for (;;) {
        const r = await pedirTcggo(urlEpisodios(pagina, base))
        if (!r.datos) break
        for (const e of r.datos.data || []) nueva.push(resumirEpisodio(e))
        if (!hayMasPaginas(r.datos) || !(r.datos.data || []).length) { completa = true; break }
        pagina++
      }
      if (completa) {
        lista = nueva
        pares.episodios = { fecha: ahora.toISOString(), lista }
        try { await guardarEstado(CLAVE_PARES, pares) } catch { /* se vuelve a pedir la próxima */ }
      } else lista = []
    }
    if (lista.length) {
      const porId = new Map(lista.map((e) => [e.id, e]))
      const filas = []
      for (const [idEpisodio, sets] of setsPorEpisodio) {
        const e = porId.get(idEpisodio)
        if (!e) continue
        for (const setId of sets) filas.push(filaDeSetTcggo(setId, e))
      }
      if (filas.length) {
        try {
          setsApuntados = Number(await guardarSets(sinSetsRepetidos(filas, hechosPares), 'WEST')) || 0
          estado.setsApuntados = true
          delete estado.errorSets
          if (lista.some((e) => e.valorCm != null)) estado.setsConValor = true
        } catch (e) {
          const m = String(e?.message || e)
          if (/tcggo_guardar_sets|42883|PGRST202/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-tcggo-precios.sql (tcggo_guardar_sets)' }
          // El logo, la fecha y el total de los sets NO paran los precios
          // (938): antes un fallo aquí devolvía el error y la pasada no
          // llegaba a ninguna expansión, todo el día. Se apunta para /admin
          // y se da por intentado hoy (sin eso, si la lista hay que pedirla,
          // serían nueve peticiones a TCGGO en cada pasada).
          estado.setsApuntados = true
          estado.errorSets = { dia, error: m.slice(0, 200) }
        }
      }
    }
    // Y los sets JAPONESES (646), con la lista que guarda el catálogo: su
    // valor sale igual, y si la lista es de antes de la 646 va sin él.
    const listaJp = Array.isArray(catalogo?.episodiosJp?.lista) ? catalogo.episodiosJp.lista : []
    if (listaJp.length && setsPorEpisodioJp.size) {
      const porIdJp = new Map(listaJp.map((e) => [e.id, e]))
      const filasJp = []
      for (const [idEpisodio, sets] of setsPorEpisodioJp) {
        const e = porIdJp.get(idEpisodio)
        if (!e) continue
        for (const setId of sets) filasJp.push(filaDeSetTcggo(setId, e))
      }
      if (filasJp.length) {
        try {
          setsApuntados += Number(await guardarSets(sinSetsRepetidos(filasJp), 'JP')) || 0
          estado.setsJpApuntados = true
        } catch { /* los japoneses no paran la pasada de precios */ }
      }
    }
    await persistir()
  }

  // ── Expansión a expansión: primero las occidentales, luego las japonesas ──
  let escritas = 0
  // Nuestras cartas sin carta suya: desde la 826 se piden por producto, así
  // que esa cuenta ya no se sabe (null, no 0: la 319).
  const sinPar = null
  const hechasAhora = []
  const tandas = [
    { mercado: 'WEST', pendientes, mapa: setsPorEpisodio, hechos: estado.hechos },
    { mercado: 'JP', pendientes: pendientesJp, mapa: setsPorEpisodioJp, hechos: estado.hechosJp },
  ]
  // Sin la migración del coreano y el chino (671) la base rechaza la fila
  // ENTERA (la lección de la 624): se quitan esas dos columnas, se apunta
  // para /admin y se escribe lo demás. La marca vale UN DÍA (687): con
  // `true` para siempre, PINGU ejecutó la migración y las dos columnas se
  // siguieron tirando, sin error.
  const sinKoZh = (f) => { const { cm_low_ko, cm_low_zh, ...resto } = f; return resto }
  const escribir = async (lote) => {
    try {
      await guardar(estado.faltaMigracionKoZh === dia ? lote.map(sinKoZh) : lote)
    } catch (e) {
      const m = String(e?.message || e)
      if (/cm_low_ko|cm_low_zh/.test(m) && estado.faltaMigracionKoZh !== dia) {
        estado.faltaMigracionKoZh = dia
        await guardar(lote.map(sinKoZh))
        return
      }
      throw e
    }
  }
  // LA EXPANSIÓN EN CURSO SE GUARDA PÁGINA A PÁGINA (826). Antes se pedían
  // todas sus páginas en la MISMA pasada y, si se acababa el tiempo (20 s) a
  // mitad, se tiraba lo pedido y la pasada siguiente empezaba por la página 1
  // otra vez. Una expansión grande (las promos japonesas son miles de
  // cartas) no cabía nunca: la pasada se quedó clavada en «JP 81» gastando
  // peticiones cada cinco minutos, y ninguna japonesa de detrás tuvo precio
  // (el Charizard de Expansion Pack, PINGU). Es la factura de la 509 —una
  // pasada que vuelve a empezar— dentro de una expansión. Ahora cada página
  // escribe sus precios al llegar y `enCurso` dice por cuál se sigue.
  //
  // Las VERSIONES (806) se deciden entre páginas: `elegidas` guarda, por
  // producto de Cardmarket, la entrada principal vista hasta ahora (lo que
  // `esMasPrincipal` mira: foto, ataques, id). Si una página posterior trae
  // una más principal, su precio pisa al de antes; si trae una versión, no.
  // Las que se saltan en esta pasada por no traer ids (no vuelven a entrar
  // en la misma pasada).
  const saltadasSinCm = []
  const comoCarta = (e) => ({ id: e.id, image: e.foto ? 'x' : '', attacks: e.juego ? [1] : [] })
  for (const { mercado, pendientes: lista0, mapa, hechos } of tandas) {
    const enCursoAqui = estado.enCurso?.mercado === mercado ? estado.enCurso.episodio : null
    const lista = enCursoAqui != null && lista0.includes(enCursoAqui) ? [enCursoAqui, ...lista0.filter((x) => x !== enCursoAqui)] : lista0
    for (const idEpisodio of lista) {
    if (parado || gastadas >= tope || !quedaTiempo()) break
    const sigue = estado.enCurso?.mercado === mercado && estado.enCurso?.episodio === idEpisodio
    const enCurso = sigue ? estado.enCurso : { mercado, episodio: idEpisodio, pagina: 1, elegidas: {}, suyas: 0, nuestras: 0, escritas: 0 }
    estado.enCurso = enCurso
    const sets = mapa.get(idEpisodio) || []
    let terminada = false
    let planJp = false
    let fallo = null
    for (;;) {
      const r = await pedirTcggo(urlCartasDeEpisodio(idEpisodio, enCurso.pagina, bases[mercado], { versiones: true }))
      if (r.fin === 'plan-jp') { planJp = true; break }
      if (!r.datos) break
      const pagina = r.datos.data || []
      const ahoraVan = new Map()
      for (const s of pagina) {
        enCurso.suyas++
        const id = Number(s.cardmarket_id)
        const conCm = Number.isInteger(id) && id > 0
        // SIN ID DE CARDMARKET, EN EL JAPONÉS (832). TCGGO da precio a las
        // japonesas antiguas (el Gengar de Lost Link, 1.300 €) pero muchas
        // vienen sin `cardmarket_id`, y aquí se saltaban: de la #610 hacia
        // atrás, «0 de 0 nuestras» con la 830 y la 831 puestas. En el
        // japonés se casan por su `tcggo_id`, así que van con su propia
        // clave (no comparten producto con nadie).
        if (!conCm && !(mercado === 'JP' && Number.isInteger(Number(s.id)) && Number(s.id) > 0)) continue
        const clave = conCm ? id : `t${s.id}`
        const ya = enCurso.elegidas[clave]
        if (!ya || esMasPrincipal(s, comoCarta(ya))) {
          enCurso.elegidas[clave] = { id: s.id, cm: conCm, foto: Boolean(typeof s.image === 'string' && s.image), juego: Boolean((Array.isArray(s.attacks) && s.attacks.length) || (Array.isArray(s.abilities) && s.abilities.length)), p: tienePrecio(s) }
          if (conCm) ahoraVan.set(id, s)
        }
      }
      // Nuestras cartas de ESOS productos (por producto y no el set entero:
      // así una expansión de más de mil cartas no choca con el tope de
      // Supabase, la 808).
      // EN EL JAPONÉS, TAMBIÉN POR SU `tcggo_id` (830). PINGU, con el Gengar
      // de Lost Link: TCGGO le da 1.300 € y nosotros nada. La carta es suya
      // (lleva su `tcggo_id`), pero su id de Cardmarket es uno de ANTES —el
      // de Scrydex o el que copió el espejo occidental (686)— y
      // `tcggo_guardar_cartas` no pisa un id que ya está: por producto no casa
      // nunca, ni precio ni enlace. Se busca también por `tcggo_id`, y si su
      // id de Cardmarket no es el de TCGGO se cambia por el de TCGGO (el
      // japonés sale entero de TCGGO, 806). En el occidental no: ahí los ids
      // son los de nuestro emparejamiento (587).
      const porTcggo = new Map()
      if (mercado === 'JP') for (const s of pagina) if (Number.isInteger(Number(s.id)) && Number(s.id) > 0) porTcggo.set(Number(s.id), s)
      if ((ahoraVan.size || porTcggo.size) && sets.length) {
        let cartas
        const enSets = `set_id=in.(${sets.map((x) => `"${encodeURIComponent(x)}"`).join(',')})`
        const porProducto = `cm_id_product_propio.in.(${[...ahoraVan.keys()].join(',') || '0'})`
        try {
          cartas = (await pedir(mercado === 'JP'
            ? `tcg_cards?select=id,set_id,local_id,name,cm_id_product_propio,tcggo_id&market=eq.JP&${enSets}&or=(${porProducto},tcggo_id.in.(${[...porTcggo.keys()].join(',') || '0'}))&limit=1000`
            : `tcg_cards?select=id,set_id,cm_id_product_propio&market=eq.${mercado}&${enSets}&cm_id_product_propio=in.(${[...ahoraVan.keys()].join(',')})&limit=1000`)) || []
        } catch (e) {
          fallo = `nuestra base: ${String(e?.message || e).slice(0, 160)}`
          break
        }
        // LAS QUE VIVEN EN OTRO SET (831). PINGU pegó la pasada: de la #610
        // hacia atrás, «0 nuestras» en todas, y Lost Link 10 de 40. El calco
        // escribe con `tcggo_guardar_cartas`, que no cambia el `set_id` de
        // una «tcggo-…» que ya existía, y solo la recoloca si estaba en uno
        // de los sets que reemplaza: una que quedó en el set de otra vuelta
        // (escondido después) se quedó allí, y aquí se buscaba en el set de
        // su expansión. Así que:
        //  · las que faltan se buscan por `tcggo_id` en TODO el japonés, y
        //    la que no está en un set VISIBLE de su expansión se lleva al
        //    primero de ellos (`mover`);
        //  · la que no está en ninguna parte se busca por NÚMERO entre las
        //    nuestras del set visible que no llevan `tcggo_id` (las de
        //    Scrydex que alguien tenía y se quedaron): si casa una y solo
        //    una, se queda con su `tcggo_id` y su id de Cardmarket;
        //  · y lo que queda se cuenta (`sinCarta`): eso lo tiene que
        //    escribir el calco.
        if (mercado === 'JP' && porTcggo.size) {
          const visibles = visiblesJp.get(idEpisodio) || []
          const destino = visibles[0] || null
          const vistas = new Set(cartas.map((c) => Number(c.tcggo_id)).filter(Boolean))
          const faltan = [...porTcggo.keys()].filter((id) => !vistas.has(id))
          let sueltas = []
          try {
            if (faltan.length) {
              const fuera = (await pedir(`tcg_cards?select=id,set_id,local_id,name,cm_id_product_propio,tcggo_id&market=eq.JP&tcggo_id=in.(${faltan.join(',')})&limit=1000`)) || []
              const ya = new Set(cartas.map((c) => c.id))
              for (const c of fuera) if (!ya.has(c.id)) cartas.push(c)
            }
            if (destino) {
              for (const c of cartas) {
                if (!porTcggo.has(Number(c.tcggo_id)) || visibles.includes(c.set_id)) continue
                c.mover = destino
                enCurso.deDonde = [...new Set([...(enCurso.deDonde || []), c.set_id])].slice(0, 5)
              }
            }
            // Por número: un grupo es un número de TCGGO (las versiones
            // comparten número); si ninguna de sus entradas tiene carta
            // nuestra, se busca la del número en el destino.
            const halladas = new Set(cartas.map((c) => Number(c.tcggo_id)).filter(Boolean))
            const grupos = new Map()
            for (const [id, s] of porTcggo) {
              const n = numeroComparable(s.card_number)
              if (!n) continue
              if (!grupos.has(n)) grupos.set(n, [])
              grupos.get(n).push(s)
            }
            const huerfanos = [...grupos].filter(([, ss]) => !ss.some((s) => halladas.has(Number(s.id))))
            const movidasAqui = cartas.filter((c) => c.mover)
            if (destino && (huerfanos.length || movidasAqui.length)) {
              sueltas = (await pedir(`tcg_cards?select=id,set_id,local_id,name,cm_id_product_propio,tcggo_id&market=eq.JP&set_id=eq.${encodeURIComponent(destino)}&tcggo_id=is.null&limit=1000`)) || []
            }
            const porNumero = new Map()
            for (const c of sueltas) {
              const n = numeroComparable(c.local_id)
              if (n) porNumero.set(n, porNumero.has(n) ? null : c)
            }
            let sinCarta = 0
            for (const [n, ss] of huerfanos) {
              const c = porNumero.get(n)
              if (!c) { sinCarta++; continue }
              // La principal del producto, si ya se ha visto; si no, la primera.
              const principal = ss.reduce((a, b) => (esMasPrincipal(b, a) ? b : a))
              const enLista = cartas.find((x) => x.id === c.id) || (cartas.push(c), c)
              enLista.tcggo_id = Number(principal.id)
              enLista.adoptar = true
              porNumero.delete(n)
            }
            // Una que se trae y que ya tiene una nuestra con su número en el
            // destino: no se borra nada (la otra puede tener dueño), se cuenta.
            const repetidas = movidasAqui.filter((c) => porNumero.get(numeroComparable(c.local_id))).length
            enCurso.sinCarta = (enCurso.sinCarta || 0) + sinCarta
            if (repetidas) enCurso.repetidas = (enCurso.repetidas || 0) + repetidas
          } catch (e) {
            fallo = `nuestra base: ${String(e?.message || e).slice(0, 160)}`
            break
          }
        }
        const filas = []
        const versiones = []
        const corregir = []
        const yaVan = new Set()
        for (const c of cartas) {
          if (yaVan.has(c.id)) continue
          const suya = porTcggo.get(Number(c.tcggo_id))
          let s = ahoraVan.get(Number(c.cm_id_product_propio))
          if (suya) {
            const bueno = Number(suya.cardmarket_id)
            const conCm = Number.isInteger(bueno) && bueno > 0
            if ((conCm && Number(c.cm_id_product_propio) !== bueno) || c.mover || c.adoptar) {
              // Sin id de Cardmarket de TCGGO (832) no se toca el nuestro:
              // esas filas van sin sus tres columnas (y en su propio lote).
              corregir.push({ id: c.id, market: mercado, set_id: c.mover || c.set_id, local_id: c.local_id, name: c.name, tcggo_id: Number(c.tcggo_id), ...(conCm ? { cm_id_product_propio: bueno, cm_por: 'tcggo', cm_emparejado_at: ahora.toISOString() } : {}) })
              if (c.mover) enCurso.movidas = (enCurso.movidas || 0) + 1
              if (c.adoptar) enCurso.adoptadas = (enCurso.adoptadas || 0) + 1
            }
            // El precio, el de la principal de ese producto si ha salido en
            // esta página; si no, el de su propia entrada.
            s = ahoraVan.get(bueno) || suya
          }
          if (!s) continue
          yaVan.add(c.id)
          const fila = filaDePreciosTcggo(c.id, s, { ahora, mercado })
          // Sin id de Cardmarket de TCGGO (832), el de la fila se VACÍA en el
          // japonés: el que quedaba era el de antes —a veces el de la carta
          // occidental (el espejo, 686)—, y un enlace a otra carta es peor
          // que una búsqueda.
          if (mercado === 'JP' && !('cm_id_product' in fila)) fila.cm_id_product = null
          filas.push(fila)
          versiones.push(...filaDeLaCarta(s, c, { ahora, mercado }), ...filasDeVariantes(s, c, { ahora, mercado }))
        }
        // Las ediciones de Wizards (935), por su producto: la Shadowless del
        // Charizard ya no es una carta nuestra, es una edición. Sin la
        // migración la columna `origen` no existe y no hay ediciones.
        // Y las versiones de TCGdex (945): la Poké Ball de Black Bolt es otro
        // producto de Cardmarket, y TCGGO a veces la da como otra carta.
        // Con el `in.(…)`, sin la 945 simplemente no hay filas `tcgdex`.
        // Y las repetidas convertidas en versión desde /admin (987, la Staff
        // del Darmanitan): `fundida`, con el producto de la carta que eran.
        let deEdiciones = []
        if (mercado === 'WEST' && ahoraVan.size) {
          let ediciones = []
          try {
            ediciones = (await pedir(`tcg_card_versions?select=tcggo_id,card_id,set_id,etiqueta,clase,cm_id_product&market=eq.WEST&origen=in.(edicion,tcgdex,fundida)&cm_id_product=in.(${[...ahoraVan.keys()].join(',')})&limit=1000`)) || []
          } catch {
            ediciones = []
          }
          const ed = preciosDeEdiciones(Array.isArray(ediciones) ? ediciones : [], ahoraVan, { ahora, mercado })
          deEdiciones = ed.filas
          versiones.push(...ed.variantes)
        }
        if (corregir.length) {
          try {
            for (const lote of porColumnas(corregir)) await corregirCartas(lote)
          } catch (e) {
            fallo = `nuestra base al corregir el id de Cardmarket: ${String(e?.message || e).slice(0, 160)}`
            break
          }
          enCurso.corregidas = (enCurso.corregidas || 0) + corregir.length
        }
        if (filas.length) {
          try {
            for (const grupo of porColumnas(filas)) for (let k = 0; k < grupo.length; k += 500) await escribir(grupo.slice(k, k + 500))
          } catch (e) {
            const m = String(e?.message || e)
            if (/cm_low_es|PGRST204|42703/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-tcggo-precios.sql', dia }
            fallo = `nuestra base al escribir: ${m.slice(0, 160)}`
            break
          }
        }
        // Las versiones, después del precio y SIN parar la pasada si fallan:
        // el precio de la carta es lo de siempre y no puede quedarse sin
        // escribir por lo nuevo. El fallo queda en el estado para /admin.
        if (versiones.length || deEdiciones.length) {
          const v = estado.versiones?.dia === dia ? estado.versiones : { dia, vistas: 0, escritas: 0 }
          v.vistas += versiones.length
          try {
            const unicas = sinVersionesRepetidas(versiones)
            for (let k = 0; k < unicas.length; k += 500) await guardarVersiones(unicas.slice(k, k + 500))
            v.escritas += unicas.length
            // Las ediciones, en su propio lote: llevan otras columnas.
            for (let k = 0; k < deEdiciones.length; k += 500) await guardarVersiones(deEdiciones.slice(k, k + 500))
            if (deEdiciones.length) v.ediciones = (v.ediciones || 0) + deEdiciones.length
            // Fuera del día: `tcggo-versiones` lo mira para no recorrer ids.
            estado.versionesUltimaVista = ahora.toISOString()
            delete v.error
          } catch (e) {
            v.error = String(e?.message || e).slice(0, 200)
          }
          estado.versiones = v
        }
        enCurso.nuestras += cartas.length
        enCurso.escritas += filas.length
        escritas += filas.length
      }
      if (!hayMasPaginas(r.datos) || pagina.length < POR_PAGINA_CARTAS) { terminada = true; break }
      enCurso.pagina++
      await persistir()
    }
    // Lo NUESTRO falla: se para y lo que se lleva se queda (la 526).
    if (fallo) { await persistir(); return { ok: false, error: fallo, dia, enCurso: { episodio: idEpisodio, pagina: enCurso.pagina } } }
    // El plan no da el japonés: se deja apuntado y lo occidental no se
    // entera (lo occidental ya ha ido antes, y `parado` no se queda).
    if (planJp) { parado = null; estado.enCurso = null; break }
    // Sin tiempo o sin peticiones: la pasada siguiente sigue por esta página.
    if (!terminada) { await persistir(); break }
    const elegidas = Object.values(enCurso.elegidas)
    // Una expansión sin NINGÚN id de Cardmarket puede ser un tropiezo suyo
    // (la 589: no se da por hecha a la primera). Pero no PARA la pasada: se
    // salta y se sigue con las demás (PINGU: «no quiero estar apretando un
    // botón; hazlo tú automáticamente»), se vuelve a mirar en la pasada
    // siguiente y a la tercera vez del día se da por hecha (`sinCm`). Antes
    // paraba la pasada entera, y con la 526 y la 610 delante, las de detrás
    // esperaban quince minutos por cada una.
    if (enCurso.suyas && !elegidas.length) {
      const clave = `${mercado}:${idEpisodio}`
      const veces = (estado.sinCmIntentos?.dia === dia ? Number(estado.sinCmIntentos[clave]) || 0 : 0) + 1
      estado.sinCmIntentos = { ...(estado.sinCmIntentos?.dia === dia ? estado.sinCmIntentos : { dia }), [clave]: veces }
      estado.enCurso = null
      if (veces < 3) {
        estado.ultimoParado = { fecha: ahora.toISOString(), motivo: `TCGGO devuelve la expansión ${idEpisodio} sin cardmarket_id: se salta y se vuelve a mirar (vez ${veces} de 3 hoy)` }
        saltadasSinCm.push(idEpisodio)
        await persistir()
        continue
      }
      estado.sinCm = { ...(estado.sinCm || {}), [clave]: dia }
    }
    // Lo de cada expansión japonesa, apuntado (825): «Expansion Pack no
    // tiene precios» no se podía contestar sin saber si TCGGO no los da, si
    // nuestras cartas no tienen su id de Cardmarket o si no se escribió nada.
    if (mercado === 'JP') {
      estado.resumenJp = { ...(estado.resumenJp || {}), [idEpisodio]: { suyas: enCurso.suyas, conCm: elegidas.filter((e) => e.cm !== false).length, conPrecio: elegidas.filter((e) => e.p).length, nuestras: enCurso.nuestras, escritas: enCurso.escritas, corregidas: enCurso.corregidas || 0, movidas: enCurso.movidas || 0, deDonde: enCurso.deDonde || [], adoptadas: enCurso.adoptadas || 0, repetidas: enCurso.repetidas || 0, sinCarta: enCurso.sinCarta || 0, sets, paginas: enCurso.pagina } }
    }
    hechos.push(idEpisodio)
    hechasAhora.push({ mercado, episodio: idEpisodio, sets, suyas: enCurso.suyas, nuestras: enCurso.nuestras, escritas: enCurso.escritas, paginas: enCurso.pagina })
    estado.enCurso = null
    await persistir()
    }
  }
  const quedan = [...setsPorEpisodio.keys()].filter((id) => !estado.hechos.includes(id)).length + [...setsPorEpisodioJp.keys()].filter((id) => !estado.hechosJp.includes(id)).length
  let fotoHistorial = null
  if (!quedan && !parado) {
    estado.hecho = true
    // Con el día entero escrito, la foto del histórico: cero peticiones.
    // Si falta su migración, se dice y no pasa nada más.
    try {
      fotoHistorial = Number(await foto(dia)) || 0
    } catch (e) {
      fotoHistorial = /historial_foto_diaria|42883|PGRST202/.test(String(e?.message || e)) ? 'falta ejecutar supabase-migration-tcggo-historial.sql' : String(e?.message || e).slice(0, 120)
    }
  }
  await persistir()
  return {
    ok: true, dia, hecho: !quedan && !parado, fotoHistorial, peticionesEstaPasada: gastadas, peticionesHoy: estado.gasto.peticiones, topeDiario, pausaMs, puerta: base,
    episodios: setsPorEpisodio.size + setsPorEpisodioJp.size, hechasHoy: estado.hechos.length + estado.hechosJp.length, quedan, escritas, sinPar, setsApuntados, hechasAhora, parado, ...(saltadasSinCm.length ? { saltadasSinCm } : {}), ...(estado.errorSets?.dia === dia ? { errorSets: estado.errorSets.error } : {}),
    ...(quedan && !parado ? { nota: 'sin tiempo o sin peticiones: sigue en la próxima pasada' } : {}),
  }
}

// Un POST de PostgREST con varias filas pide las MISMAS columnas en todas
// (si no, rechaza el lote entero). Una carta japonesa sin id de Cardmarket
// (832) da una fila de precio sin `cm_id_product`: se manda en su lote.
export function porColumnas(filas) {
  const grupos = new Map()
  for (const f of filas) {
    const k = Object.keys(f).sort().join()
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(f)
  }
  return [...grupos.values()]
}

// Una carta suya trae ALGUNA cifra: un mínimo de Cardmarket en cualquier
// idioma, una media o TCGplayer.
export function tienePrecio(carta) {
  const cm = carta?.prices?.cardmarket || {}
  const tp = carta?.prices?.tcg_player || {}
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
  return Object.entries(cm).some(([k, v]) => /^(lowest_near_mint|30d_average|7d_average)/.test(k) && num(v)) || num(tp.market_price) || num(tp.mid_price)
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('tcggo-precios:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada DOS minutos (828; antes cinco). PINGU: «no quiero estar apretando un
// botón cada x; hazlo tú y que se rellene todo». Una pasada hace unas 25
// expansiones (pausa de 250 ms en Netlify), así que las ~424 del día son ~17
// pasadas: media hora y no hora y media. No gasta más: las peticiones del
// día son las mismas, y con el día hecho una pasada es leer el estado.
// En los pares, como `tcggo-versiones`; el calco va en los impares.
export const config = { schedule: '*/2 * * * *' }
