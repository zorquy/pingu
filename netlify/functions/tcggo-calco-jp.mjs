// EL CALCO JAPONÉS (tanda 674): el catálogo japonés, entero, de TCGGO.
//
// PINGU: «el catálogo japonés está prácticamente vacío; hay expansiones
// sin cartas (Expansion Pack, Jungla, Fossil…); yo lo volcaría todo desde
// TCGGO, con todas las cartas dentro, y copiaría su estructura. Tengo la
// suscripción Ultra». Lo que había venía de TCGdex, que de 68 sets
// japoneses no publica ni una carta, y el catálogo semanal de TCGGO (640)
// solo escribe en los sets que casa por código o nombre —y lo que marcó
// «hecho» antes de que se apuntaran los fallos (655) no se vuelve a
// visitar—. Así que una pasada aparte, programada, que recorre LAS
// EXPANSIONES JAPONESAS DE TCGGO una a una y deja cada una como él la
// tiene:
//
//  1. La lista de sus expansiones japonesas, una vez a la semana.
//  2. Una expansión por pasada (una expansión entera a la API de pago; el
//     presupuesto es ~3 páginas cada una, ~210 expansiones, UNA vez). El
//     set destino es el nuestro que ya lleve su `tcggo_id`; si no, el que
//     case por código o nombre; y si no hay ninguno, se crea con su
//     nombre, logo, fecha y cuentas (`tcggo_crear_sets`).
//  3. Las cartas las escribe `procesar` (el reemplazo de la 654): entran
//     TODAS las suyas, lo nuestro que no es suyo se reapunta si alguien lo
//     tiene y se borra si no, y el set queda apuntado a su expansión.
//  4. Con todas hechas, los CASCARONES: sets japoneses sin `tcggo_id` y
//     sin una carta (lo de TCGdex) se esconden, ocho por pasada.
//
// Y desde la 755, las que TCGGO añade DESPUÉS (PINGU: «ha metido los
// japoneses de 2004 a 2008, que ya tenemos de Scrydex pero sin precio»):
//
//  5. La lista se vuelve a pedir CADA DÍA (son cinco peticiones), y lo
//     nuevo es pendiente como lo demás.
//  6. Si ni el código ni el nombre casan, la HUELLA (`setDeEpisodioPorHuella`:
//     el día de salida y la cuenta) antes de crear nada; un empate que no
//     se deshace queda `dudoso` y no se crea (crear sería duplicar).
//  7. `procesar` conserva por NÚMERO nuestras cartas sin `tcggo_id`, así que
//     las de Scrydex se quedan con su id, su Pokédex y sus ataques, y ganan
//     el id de Cardmarket (el precio llega con la pasada de precios) y el
//     inglés de TCGGO. Elegido por la huella, además se comprueba que es la
//     misma expansión antes de tocar nada.
//  8. Las que ANTES de esto se crearon de nuevo (`por: 'nuevo'`) teniendo ya
//     un set nuestro de esa huella se FUNDEN en él, una por pasada.
//
// Y desde la 806, LA VUELTA ENTERA. PINGU: «TCGGO ha metido TODOS los sets
// japoneses que faltaban, con todas sus cartas, sus precios y todo —hasta
// las Miscellaneous Promos de 1996, Expansion Pack, Jungle, Rocket—;
// sustituye todos los sets que tenemos y coge el japonés siempre de la
// API». Lo de antes conservaba nuestras cartas de Scrydex y les ponía
// encima el id de Cardmarket de TCGGO, pero la RPC no pisa uno que ya
// hubiera (el del espejo occidental, el emparejamiento de la 587), y lo
// que una vez quedó «hecho» no se volvía a mirar. Así que:
//
//  9. `VUELTA` sube a 2: el estado se reinicia (lo de antes se guarda en
//     `vueltas`) y TODAS las expansiones se vuelven a hacer, en el modo
//     ENTERO de `procesar` (666): toda carta entra como la tiene TCGGO
//     —«tcggo-<id>», con su número, su foto, su inglés, su id de
//     Cardmarket y su precio—, y lo nuestro del set se va.
// 10. Lo que la gente tiene se recoloca por `tcggo_id`, por NÚMERO (nuestras
//     cartas de Scrydex se llaman en japonés) y por nombre; una carta con
//     dueño que no tenga pareja se queda, apuntada (`seQuedan`).
// 11. Un empate de la huella no deja la expansión fuera: se crea la de TCGGO
//     (la fuente es él) y los candidatos se quedan como estaban.
// 12. Con todas hechas, se ESCONDEN los sets japoneses sin `tcggo_id`
//     (veinte por pasada, apuntados en `escondidosAlFinal`): el catálogo
//     japonés queda siendo el de TCGGO. Esconder y no borrar: con cartas de
//     alguien dentro, se puede deshacer.
//
// Frenos de la casa: una expansión por pasada, los fallos cuentan y a
// `MAXIMO_INTENTOS` se dejan (el error queda en el estado y /admin lo
// enseña), y con todo hecho una pasada es leer el estado y nada más. Si
// TCGGO contesta que el japonés pide otro plan, la pasada se para y lo
// dice, sin volver a pedir hasta mañana.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY.
import {
  cabeceras, baseDe, baseJpDe, urlEpisodios, hayMasPaginas, resumirEpisodio, esLimiteDelPlan, filaDeSetNuevo, serieDeEpisodio, setDeEpisodio, setDeEpisodioPorHuella,
} from '../lib/tcggo.mjs'
import { procesar } from './tcggo-reemplazar-set.mjs'
import { CLAVE_ESTADO as CLAVE_PRECIOS } from './tcggo-precios.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_calco_jp'
export const MAXIMO_INTENTOS = 3
export const MAXIMO_PROBADOS = 8
export const DIAS_DE_LISTA = 1
export const DIAS_DE_DUDA = 7
// La vuelta en curso (806). Subirla vuelve a hacer el japonés entero.
export const VUELTA = 2
export const ESCONDER_POR_PASADA = 20
const MERCADO = 'JP'

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: opciones?.method || 'GET',
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', Prefer: opciones?.method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal', ...(opciones?.headers || {}) },
    body: opciones?.body,
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  if (!opciones || opciones.method === 'GET') return res.json()
  const texto = await res.text()
  try { return texto ? JSON.parse(texto) : null } catch { return texto }
}

export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null, procesarImpl = null, crearSetsImpl = null,
  ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)), vuelta = VUELTA, ...resto
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))
  const crearSets = crearSetsImpl || ((filas, mercado) => rest('rpc/tcggo_crear_sets', clave, { method: 'POST', body: JSON.stringify({ p_sets: filas, p_market: mercado }) }))
  const { base, host } = baseDe(env)
  const baseJp = baseJpDe(base)
  const dia = ahora.toISOString().slice(0, 10)

  let estado
  try {
    estado = await leerEstado(CLAVE_ESTADO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (!estado.hechos || typeof estado.hechos !== 'object') estado.hechos = {}
  if (!estado.intentos || typeof estado.intentos !== 'object') estado.intentos = {}
  if (!estado.cascarones || typeof estado.cascarones !== 'object') estado.cascarones = { vistos: {} }
  if (!estado.dudosos || typeof estado.dudosos !== 'object') estado.dudosos = {}
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  // Una vuelta nueva (806): lo de la anterior se resume y se guarda, y se
  // empieza de cero con la lista de HOY (la de ayer no traería lo nuevo).
  if ((Number(estado.vuelta) || 1) < vuelta) {
    const anterior = Number(estado.vuelta) || 1
    estado.vueltas = { ...(estado.vueltas || {}), [anterior]: { hasta: ahora.toISOString(), hechas: Object.keys(estado.hechos).length, dudosas: Object.keys(estado.dudosos).length } }
    estado.vuelta = vuelta
    estado.hechos = {}
    estado.intentos = {}
    estado.dudosos = {}
    estado.cascarones = { vistos: {} }
    estado.escondidosAlFinal = {}
    if (estado.lista) estado.lista.fecha = null
    delete estado.ultimoError
    await persistir()
  }
  const entera = (Number(estado.vuelta) || 1) >= 2
  if (!estado.escondidosAlFinal || typeof estado.escondidosAlFinal !== 'object') estado.escondidosAlFinal = {}
  if (estado.planBloqueado?.dia === dia) return { ok: true, saltado: `el plan no da el japonés hoy: ${estado.planBloqueado.motivo}` }

  // ── 1. La lista de expansiones japonesas, una vez al día (755) ──
  const edad = estado.lista?.fecha ? (ahora.getTime() - new Date(estado.lista.fecha).getTime()) / 86_400_000 : Infinity
  if (!Array.isArray(estado.lista?.episodios) || !estado.lista.episodios.length || edad > DIAS_DE_LISTA) {
    const episodios = []
    let pagina = 1
    for (;;) {
      const res = await fetchImpl(urlEpisodios(pagina, baseJp), { headers: cabeceras(claveTcggo, host) })
      const texto = await res.text()
      if (!res.ok) {
        if (/japanese_catalog|required_plan|Ultra or Mega/i.test(texto)) {
          estado.planBloqueado = { dia, motivo: texto.slice(0, 200) }
          await persistir()
          return { ok: false, error: `TCGGO dice que el catálogo japonés pide otro plan: ${texto.slice(0, 160)}` }
        }
        estado.ultimoError = { fecha: ahora.toISOString(), donde: 'lista', error: esLimiteDelPlan(res.status, texto) ? `RapidAPI ${res.status}: el plan no da más por ahora` : `TCGGO ${res.status}: ${texto.slice(0, 160)}` }
        await persistir()
        return { ok: false, error: estado.ultimoError.error }
      }
      let datos
      try { datos = JSON.parse(texto) } catch { return { ok: false, error: 'TCGGO ha contestado algo que no es JSON' } }
      for (const e of datos.data || []) episodios.push(resumirEpisodio(e))
      if (!hayMasPaginas(datos) || !(datos.data || []).length || pagina >= 40) break
      pagina++
      await pausa(300)
    }
    if (!episodios.length) return { ok: false, error: 'TCGGO no da ninguna expansión japonesa' }
    estado.lista = { fecha: ahora.toISOString(), episodios }
    await persistir()
  }
  const episodios = estado.lista.episodios

  // ── 2. Una expansión por pasada ──
  // Una dudosa que en la vuelta entera ya se creó no espera la semana.
  const dudaReciente = (id) => { const d = estado.dudosos[id]; return d?.fecha && !d.creada && (ahora.getTime() - new Date(d.fecha).getTime()) / 86_400_000 < DIAS_DE_DUDA }
  // Una apuntada VACÍA cuya lista de hoy ya trae cartas es la que acaba de
  // salir (756): vuelve a estar pendiente.
  const hecha = (e) => estado.hechos[e.id] && !(estado.hechos[e.id].nota === 'vacía en TCGGO' && e.cartas > 0)
  const pendiente = episodios.find((e) => !hecha(e) && (Number(estado.intentos[e.id]) || 0) < MAXIMO_INTENTOS && !dudaReciente(e.id))
  const SELECT_SETS = `tcg_sets?select=id,name,name_en,tcg_online_code,serie_id,serie_name,serie_name_en,tcggo_id,oculto,release_date,card_count_total,card_count_official,scrydex_id&market=eq.${MERCADO}&limit=2000`
  // Lo que se borra o se reescribe le quita la expansión a los hechos del
  // día de la pasada de precios (la 697): si ya la hizo hoy, no volvería
  // hasta mañana y las cartas estarían el día entero sin precio.
  const avisarAPrecios = async (idEpisodio) => {
    try {
      const precios = await leerEstado(CLAVE_PRECIOS)
      if (Array.isArray(precios?.hechosJp) && precios.hechosJp.includes(idEpisodio)) {
        await guardarEstado(CLAVE_PRECIOS, { ...precios, hechosJp: precios.hechosJp.filter((e) => e !== idEpisodio) })
      }
    } catch { /* lo peor es esperar a mañana */ }
  }
  // Un destino escondido (un cascarón de la 672) que se llena se enseña.
  const desesconder = async (set) => {
    if (set?.oculto) await pedir(`tcg_sets?market=eq.${MERCADO}&id=eq.${encodeURIComponent(set.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: false }) })
  }
  const resumen = () => ({
    expansiones: episodios.length, hechas: Object.keys(estado.hechos).length, dudosas: Object.keys(estado.dudosos).length,
    paradas: episodios.filter((e) => !hecha(e) && (Number(estado.intentos[e.id]) || 0) >= MAXIMO_INTENTOS).map((e) => e.id),
  })
  if (pendiente) {
    // Las que su lista da con CERO cartas (energías, promos sin sueltas)
    // se apuntan sin pedirlas.
    if (pendiente.cartas === 0) {
      estado.hechos[pendiente.id] = { fecha: ahora.toISOString(), nota: 'vacía en TCGGO' }
      await persistir()
      return { ok: true, ...resumen(), hecha: { episodio: pendiente.id, nombre: pendiente.nombre, nota: 'vacía' } }
    }
    let sets
    try {
      sets = (await pedir(SELECT_SETS)) || []
    } catch (e) {
      return { ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    }
    // El destino: el que ya lleva su expansión, el que casa por código o
    // nombre, o uno nuevo.
    let destino = sets.find((s) => Number(s.tcggo_id) === pendiente.id)?.id || null
    let por = destino ? 'tcggo_id' : null
    if (!destino) {
      const r = setDeEpisodio(pendiente, sets)
      if (r.set) { destino = r.set.id; por = r.por }
    }
    if (!destino) {
      const r = setDeEpisodioPorHuella(pendiente, sets)
      if (r.set) { destino = r.set.id; por = r.por }
      else if (r.dudoso && entera) {
        // En la vuelta entera la fuente es TCGGO: se crea la suya (abajo) y
        // los candidatos se quedan como estaban, apuntados.
        estado.dudosos[pendiente.id] = { fecha: ahora.toISOString(), nombre: pendiente.nombre, candidatos: r.candidatos, porque: r.porque, creada: true }
      } else if (r.dudoso) {
        estado.dudosos[pendiente.id] = { fecha: ahora.toISOString(), nombre: pendiente.nombre, candidatos: r.candidatos, porque: r.porque }
        await persistir()
        return { ok: true, ...resumen(), dudosa: { episodio: pendiente.id, nombre: pendiente.nombre, ...estado.dudosos[pendiente.id] } }
      }
    }
    const porHuella = /^fecha/.test(String(por))
    let setCreado = null
    if (!destino) {
      const fila = filaDeSetNuevo(pendiente, sets.map((s) => s.id), serieDeEpisodio(pendiente, sets))
      try {
        await crearSets([fila], MERCADO)
      } catch (e) {
        const m = String(e?.message || e)
        if (/tcggo_crear_sets|42883|PGRST202/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-tcggo-catalogo.sql (tcggo_crear_sets)' }
        estado.intentos[pendiente.id] = (Number(estado.intentos[pendiente.id]) || 0) + 1
        estado.ultimoError = { fecha: ahora.toISOString(), episodio: pendiente.id, nombre: pendiente.nombre, error: `al crear el set: ${m.slice(0, 160)}` }
        await persistir()
        return { ok: false, ...resumen(), error: estado.ultimoError.error }
      }
      destino = fila.id
      setCreado = fila.id
      por = 'nuevo'
    }
    // Los otros sets nuestros con su MISMO `tcggo_id` (la 646 los pliega)
    // se juntan en el destino: es TCGGO quien dice que son la misma.
    const hermanos = entera ? sets.filter((s) => s.id !== destino && Number(s.tcggo_id) === pendiente.id).map((s) => s.id).slice(0, 4) : []
    const opciones = entera
      ? { sets: [destino, ...hermanos], entero: true, recolocarPorNumero: true, borrarSinDestino: false, mismaExpansion: true, comprobarQueEsLaMisma: porHuella }
      : { sets: [destino], conservarPorNumero: true, comprobarQueEsLaMisma: porHuella }
    const r = await (procesarImpl || procesar)({ env, fetchImpl, restImpl, destino, mercado: MERCADO, episodio: pendiente.id, pausa, ...opciones, ...resto })
    if (r.ok) {
      estado.hechos[pendiente.id] = { fecha: ahora.toISOString(), set: destino, por, suyas: r.suyas, escritas: r.escritas, porNumero: r.porNumero ?? null, recolocadas: r.recolocadasPorNumero ?? null, lineasMovidas: r.lineasMovidas ?? null, borradas: r.borradas, seQuedan: (r.seQuedan || []).length, ...(hermanos.length ? { juntados: hermanos, setsBorrados: r.setsBorrados } : {}), ...(entera ? { entera: true } : {}) }
      delete estado.intentos[pendiente.id]
      if (!estado.dudosos[pendiente.id]?.creada) delete estado.dudosos[pendiente.id]
      try { await desesconder(sets.find((s) => s.id === destino)) } catch { /* se enseña en la pasada de la fusión o a mano */ }
      await avisarAPrecios(pendiente.id)
    } else if (r.noEsLaMisma) {
      // La huella propuso y el número dijo que no (755): no se ha gastado
      // más que la expansión, y reintentar daría lo mismo. Se apunta como
      // dudosa con el motivo y se vuelve a mirar a la semana.
      estado.dudosos[pendiente.id] = { fecha: ahora.toISOString(), nombre: pendiente.nombre, candidatos: [destino], porque: r.error }
    } else {
      estado.intentos[pendiente.id] = (Number(estado.intentos[pendiente.id]) || 0) + 1
      estado.ultimoError = { fecha: ahora.toISOString(), episodio: pendiente.id, nombre: pendiente.nombre, intento: estado.intentos[pendiente.id], error: r.error }
      if (/japanese_catalog|required_plan|Ultra or Mega/i.test(String(r.error))) estado.planBloqueado = { dia, motivo: String(r.error).slice(0, 200) }
    }
    await persistir()
    return { ok: r.ok, ...resumen(), hecha: { episodio: pendiente.id, nombre: pendiente.nombre, set: destino, por, setCreado, suyas: r.suyas, escritas: r.escritas, borradas: r.borradas }, ...(r.ok ? {} : { error: r.error }) }
  }

  // ── 2b. Las creadas de nuevo que ya tenían set nuestro (755) ──
  // Gratis hasta que se encuentra una: la huella se calcula de nuestra
  // tabla. Con una, su expansión entera otra vez (una por pasada) y
  // `procesar` sobre los dos sets: las nuestras se conservan por número,
  // las «tcggo-…» del creado se reapuntan a ellas por su `tcggo_id` y el
  // creado, vacío, se borra.
  // En la vuelta entera no se funde nada: lo creado ES lo de TCGGO, y lo
  // nuestro que no casó se esconde al final (paso 3).
  const porRevisar = entera ? [] : Object.entries(estado.hechos).filter(([, h]) => h?.por === 'nuevo' && h.set && !h.revisado && (Number(h.intentosFusion) || 0) < MAXIMO_INTENTOS)
  if (porRevisar.length) {
    let sets
    try {
      sets = (await pedir(SELECT_SETS)) || []
    } catch (e) {
      return { ok: false, ...resumen(), error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    }
    for (const [id, h] of porRevisar) {
      const episodio = episodios.find((e) => String(e.id) === String(id))
      const otros = sets.filter((s) => s.id !== h.set)
      const r = episodio ? setDeEpisodioPorHuella(episodio, otros) : { set: null }
      let gemelo = r.set
      if (gemelo) {
        try {
          const alguna = (await pedir(`tcg_cards?select=id&market=eq.${MERCADO}&set_id=eq.${encodeURIComponent(gemelo.id)}&limit=1`)) || []
          if (!alguna.length) gemelo = null
        } catch (e) {
          return { ok: false, ...resumen(), error: `nuestra base (${gemelo.id}): ${String(e?.message || e).slice(0, 160)}` }
        }
      }
      if (!gemelo) { h.revisado = { fecha: ahora.toISOString(), gemelo: null }; continue }
      const f = await (procesarImpl || procesar)({ env, fetchImpl, restImpl, sets: [gemelo.id, h.set], destino: gemelo.id, mercado: MERCADO, episodio: episodio.id, pausa, conservarPorNumero: true, comprobarQueEsLaMisma: true, ...resto })
      if (f.ok) {
        estado.hechos[id] = { ...h, set: gemelo.id, por: `fundido (${r.por})`, fundidoDe: h.set, revisado: { fecha: ahora.toISOString(), gemelo: gemelo.id }, suyas: f.suyas, escritas: f.escritas, porNumero: f.porNumero ?? null, borradas: f.borradas }
        try { await desesconder(gemelo) } catch { /* se ve a mano */ }
        await avisarAPrecios(episodio.id)
      } else if (f.noEsLaMisma) {
        h.revisado = { fecha: ahora.toISOString(), gemelo: null, descartado: gemelo.id, porque: f.error }
      } else {
        h.intentosFusion = (Number(h.intentosFusion) || 0) + 1
        estado.ultimoError = { fecha: ahora.toISOString(), episodio: episodio.id, nombre: episodio.nombre, donde: 'fusión', error: f.error }
      }
      await persistir()
      return { ok: f.ok, ...resumen(), fusion: { episodio: episodio.id, nombre: episodio.nombre, de: h.set, en: gemelo.id, por: r.por, porNumero: f.porNumero, borradas: f.borradas }, ...(f.ok ? {} : { error: f.error }) }
    }
    await persistir()
  }

  // ── 3. Con todo hecho: los cascarones, ocho por pasada ──
  if (estado.cascarones.listo) return { ok: true, ...resumen(), hecho: true }
  // En la vuelta entera, TODO set japonés sin `tcggo_id` se esconde, tenga
  // cartas o no (806): el catálogo japonés es el de TCGGO.
  if (entera) {
    let sueltos
    try {
      sueltos = (await pedir(`tcg_sets?select=id,name,name_en&market=eq.${MERCADO}&tcggo_id=is.null&oculto=is.false&order=id&limit=${ESCONDER_POR_PASADA}`)) || []
      for (const s of sueltos) {
        await pedir(`tcg_sets?market=eq.${MERCADO}&id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: true }) })
        estado.escondidosAlFinal[s.id] = { fecha: ahora.toISOString(), nombre: s.name_en || s.name || s.id }
      }
    } catch (e) {
      return { ok: false, ...resumen(), error: `nuestra base al esconder: ${String(e?.message || e).slice(0, 160)}` }
    }
    if (sueltos.length < ESCONDER_POR_PASADA) estado.cascarones.listo = true
    await persistir()
    return { ok: true, ...resumen(), escondidos: sueltos.length, listo: Boolean(estado.cascarones.listo) }
  }
  let sets
  try {
    sets = (await pedir(`tcg_sets?select=id,tcggo_id,oculto&market=eq.${MERCADO}&tcggo_id=is.null&oculto=is.false&order=id&limit=2000`)) || []
  } catch (e) {
    return { ok: false, ...resumen(), error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
  }
  // Un set que ha sido DESTINO de una expansión no es un cascarón aunque
  // la fila siga sin tcggo_id (un PATCH que no llegó): ya lleva sus cartas.
  const destinos = new Set(Object.values(estado.hechos).map((h) => h?.set).filter(Boolean))
  const candidatos = sets.filter((s) => !destinos.has(s.id))
  const porVer = candidatos.filter((s) => !estado.cascarones.vistos[s.id]).slice(0, MAXIMO_PROBADOS)
  let escondidos = 0
  for (const s of porVer) {
    try {
      const alguna = (await pedir(`tcg_cards?select=id&market=eq.${MERCADO}&set_id=eq.${encodeURIComponent(s.id)}&limit=1`)) || []
      if (!alguna.length) {
        await pedir(`tcg_sets?market=eq.${MERCADO}&id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: true }) })
        escondidos++
        estado.cascarones.vistos[s.id] = { fecha: ahora.toISOString(), estado: 'escondido' }
      } else estado.cascarones.vistos[s.id] = { fecha: ahora.toISOString(), estado: 'conCartas' }
    } catch (e) {
      return { ok: false, ...resumen(), error: `nuestra base (${s.id}): ${String(e?.message || e).slice(0, 160)}` }
    }
  }
  if (!candidatos.some((s) => !estado.cascarones.vistos[s.id])) estado.cascarones.listo = true
  await persistir()
  return { ok: true, ...resumen(), cascarones: { probados: porVer.length, escondidos, listo: Boolean(estado.cascarones.listo) } }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('tcggo-calco-jp:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada dos minutos, en los impares (precios a los múltiplos de 5, el
// catálogo a y 2, el reemplazo a y 4): ~210 expansiones en unas siete
// horas, una vez. Con todo hecho, una pasada es leer el estado.
export const config = { schedule: '1-59/2 * * * *' }
