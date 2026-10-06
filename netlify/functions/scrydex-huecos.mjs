// LOS HUECOS, DESDE SCRYDEX (tanda 684): los sets nuestros que están vacíos
// y que TCGGO no tiene se rellenan con el catálogo de Scrydex.
//
// PINGU: «TCGGO no tiene los primeros sets… lo cogemos de Scrydex;
// móntamelo, que necesito esos sets antiguos rellenados de cartas». Scrydex
// declara 231 expansiones japonesas con 22.272 cartas y ficha completa
// (ataques, debilidades, Pokédex, escaneos), y es lo único que cubre el
// japonés anterior a 2008 —el Expansion Pack, Jungle, Fossil, Rocket—.
// Sus precios son dólares y yenes y no se tocan: el precio sigue siendo
// de TCGGO (para una copia japonesa de una carta occidental, el `_JP` del
// producto de Cardmarket). Aquí entra CATÁLOGO e IMÁGENES.
//
// Qué hace, en cada pasada programada:
//
//  1. La lista de expansiones de Scrydex del mercado (`ja` para JP, `en`
//     para WEST), una vez a la semana (3 créditos por mercado).
//  2. Mira hasta MAXIMO_PROBADOS sets nuestros que no haya mirado, o que
//     mirara hace más de DIAS_REVISAR —también los ESCONDIDOS por la 672 y
//     la 674, que son justo estos—, y a cada uno le pregunta a NUESTRA base
//     si tiene alguna carta (gratis). Con cartas: `lleno`.
//  3. Al primero vacío le busca su expansión de Scrydex: por `scrydex_id`
//     si ya lo lleva, por el nombre inglés exacto, y si no por la huella
//     de la 505 (fecha + cuenta, `emparejarSets`). Sin expansión: `sinPar`
//     (se vuelve a mirar a la semana). Con una de cero cartas: `vacioEnScrydex`.
//  4. Pide sus cartas (un crédito por 100), las convierte a NUESTRAS
//     columnas (`filaDeCartaScrydex`: ataques, habilidades, debilidades,
//     fase, tipos, Pokédex, rareza, ilustrador, escaneo) y las escribe por
//     REST con la clave de servicio (upsert por `(id, market)`, ids
//     `scrydex-<id suyo>`); apunta el set (`scrydex_id`, logo, cuentas y
//     fecha si estaban vacías) y lo DESESCONDE. UNA expansión por pasada.
//
// Frenos de la casa: un set por pasada; los fallos de Scrydex cuentan y a
// MAXIMO_INTENTOS se deja (el error queda en el estado y /admin lo enseña);
// un 401/403 suyo —sin suscripción— para hasta mañana (`parado`), que
// volver a pedir sin suscripción es pagar nada por nada; un fallo de
// NUESTRA base para la pasada sin contar intento (la 526: saltar vale para
// el fallo del otro). Con todo mirado, una pasada es leer el estado.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, SCRYDEX_API_KEY,
// SCRYDEX_TEAM_ID.
import { cabecerasDe, urlDeSonda, faseDe, idNuestro, baseDeFoto, nombreInglesDe, filaDeCartaScrydex, precioDeScrydex, igualarClaves, expansionDelSet, parcheDeSet } from '../lib/scrydex.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'scrydex_huecos'
export const MAXIMO_INTENTOS = 3
export const MAXIMO_PROBADOS = 8
export const DIAS_DE_LISTA = 7
export const DIAS_REVISAR = 7
export const MAXIMO_PAGINAS_CARTAS = 8
export const IDIOMA_DE_MERCADO = { JP: 'ja', WEST: 'en' }
// La versión del código. Un fallo de NUESTRA base deja la función parada
// hasta que se despliega otra versión (684.1): la primera pasada real
// gastó un crédito cada cuatro minutos pidiendo las mismas cartas para
// estrellarse contra la misma columna que no existía. «Saltar vale para el
// fallo del otro; para el tuyo, parar» (la 526) — y lo quita un humano
// desplegando el arreglo, que es lo que cambia esta cadena.
export const VERSION = '685.4'
// Cómo se montan los nombres ingleses; si cambia, los sets ya rellenados
// se vuelven a pasar (una expansión por pasada, un crédito por 100).
export const VERSION_NOMBRES = 4

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

// Los mapeadores puros (la fila de una carta suya, el parche del set, la
// expansión de un set) viven en `netlify/lib/scrydex.mjs`: la guarda de la
// 391 sigue a los mapeadores que escriben en `tcg_cards` y los busca en
// los módulos puros, no en la función que hace el upsert. Se importan Y se
// reexportan (un reexport no es un import, la 624): la prueba los pide de
// aquí.
export { faseDe, idNuestro, baseDeFoto, nombreInglesDe, filaDeCartaScrydex, precioDeScrydex, igualarClaves, expansionDelSet, parcheDeSet }

const esDeSuscripcion = (status) => status === 401 || status === 403 || status === 402

// ── La pasada ──
export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)), mercados = ['JP', 'WEST'],
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const sc = cabecerasDe(env)
  if (sc.faltan) return { ok: true, saltado: `faltan ${sc.faltan.join(' y ')} en Netlify` }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))
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
  for (const k of ['listas', 'vistos', 'intentos']) if (!estado[k] || typeof estado[k] !== 'object') estado[k] = {}
  if (!estado.gasto || typeof estado.gasto !== 'object') estado.gasto = { creditos: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  // Parado por Scrydex (401/403): hasta mañana. Parado por NUESTRA base:
  // hasta que se despliegue otra versión.
  if (estado.parado?.version ? estado.parado.version === VERSION : estado.parado?.dia === dia) return { ok: true, saltado: `parado${estado.parado.version ? ` desde la versión ${estado.parado.version}` : ' hoy'}: ${estado.parado.motivo}` }
  if (estado.parado) delete estado.parado
  // Una vez por versión se olvidan los `lleno` (gratis volver a mirarlos):
  // la 685.2 llega con dos sets a MEDIAS —cartas escritas y el set sin
  // apuntar ni desesconder, porque el PATCH falló— que estaban como llenos.
  if (estado.llenosOlvidados !== VERSION) {
    for (const [k, v] of Object.entries(estado.vistos)) if (v.estado === 'lleno') delete estado.vistos[k]
    estado.llenosOlvidados = VERSION
  }

  // Una petición a Scrydex, contada. Un 401/403 para hasta mañana.
  const scrydex = async (ruta, params) => {
    estado.gasto.creditos = (Number(estado.gasto.creditos) || 0) + 1
    const res = await fetchImpl(urlDeSonda(ruta, params), { headers: sc.cabeceras })
    const texto = await res.text()
    if (!res.ok) {
      const error = `Scrydex ${res.status}: ${texto.slice(0, 160)}`
      if (esDeSuscripcion(res.status)) estado.parado = { dia, motivo: error }
      return { error, status: res.status }
    }
    try { return { datos: JSON.parse(texto) } } catch { return { error: 'Scrydex ha contestado algo que no es JSON', status: res.status } }
  }
  const resumen = () => {
    const v = Object.values(estado.vistos)
    const cuenta = (e) => v.filter((x) => x.estado === e).length
    return { mirados: v.length, rellenados: cuenta('rellenado'), llenos: cuenta('lleno'), sinPar: cuenta('sinPar'), vaciosEnScrydex: cuenta('vacioEnScrydex'), parados: cuenta('parado'), creditos: estado.gasto.creditos }
  }

  // Los precios de TCGplayer que traen sus fichas (685.3), en dólares.
  const escribirPrecios = async (cartas, filas) => {
    const porId = new Map(filas.map((f) => [f.id, f]))
    const precios = cartas.map((c) => { const f = porId.get(idNuestro(c.id)); return f ? precioDeScrydex(f.id, c, ahora) : null }).filter(Boolean)
    for (let i = 0; i < precios.length; i += 200) await pedir('tcg_card_prices?on_conflict=card_id', { method: 'POST', body: JSON.stringify(igualarClaves(precios.slice(i, i + 200))) })
    return precios.length
  }

  // ── 0. Los ya rellenados con nombres de una versión anterior (685) ──
  // Se vuelven a pedir y a escribir (el upsert es idempotente), uno por
  // pasada, para ponerles `name_en`. Un crédito por 100 cartas.
  const pendienteDeNombres = Object.entries(estado.vistos).find(([, v]) => v.estado === 'rellenado' && (Number(v.nombres) || 0) < VERSION_NOMBRES)
  if (pendienteDeNombres) {
    const [k, v] = pendienteDeNombres
    const [mercado, setId] = k.split('|')
    const idioma = IDIOMA_DE_MERCADO[mercado]
    const cartas = []
    let fallo = null
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_CARTAS; pagina++) {
      const r = await scrydex(`${idioma}/cards`, { q: `expansion.id:${v.expansion}`, page_size: 100, page: pagina })
      if (r.error) { fallo = r.error; break }
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      cartas.push(...datos)
      if (datos.length < 100) break
      await pausa(200)
    }
    if (fallo) {
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: setId, expansion: v.expansion, donde: 'nombres', error: fallo }
      await persistir()
      return { ok: false, ...resumen(), error: fallo }
    }
    const filas = igualarClaves(cartas.map((c) => filaDeCartaScrydex(c, { setId, mercado, idioma, ahora })).filter(Boolean))
    let conPrecio = 0
    try {
      for (let i = 0; i < filas.length; i += 200) await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(filas.slice(i, i + 200)) })
      conPrecio = await escribirPrecios(cartas, filas)
    } catch (e) {
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: setId, expansion: v.expansion, donde: 'nombres', error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
      estado.parado = { dia, motivo: estado.ultimoError.error, version: VERSION }
      await persistir()
      return { ok: false, ...resumen(), error: estado.ultimoError.error }
    }
    v.nombres = VERSION_NOMBRES
    v.conNombreIngles = filas.filter((f) => f.name_en).length
    v.conPrecio = conPrecio
    await persistir()
    return { ok: true, ...resumen(), nombres: { mercado, set: setId, expansion: v.expansion, cartas: filas.length, conNombreIngles: v.conNombreIngles, conPrecio } }
  }

  for (const mercado of mercados) {
    const idioma = IDIOMA_DE_MERCADO[mercado]
    if (!idioma) continue
    // ── 1. Sus expansiones, una vez a la semana ──
    const lista = estado.listas[mercado]
    const edad = lista?.fecha ? (ahora.getTime() - new Date(lista.fecha).getTime()) / 86_400_000 : Infinity
    if (!Array.isArray(lista?.expansiones) || !lista.expansiones.length || edad > DIAS_DE_LISTA) {
      const expansiones = []
      for (let pagina = 1; pagina <= 6; pagina++) {
        const r = await scrydex(`${idioma}/expansions`, { page_size: 100, page: pagina })
        if (r.error) {
          estado.ultimoError = { fecha: ahora.toISOString(), mercado, donde: 'lista', error: r.error }
          await persistir()
          return { ok: false, ...resumen(), error: r.error }
        }
        const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
        for (const e of datos) expansiones.push({ id: e.id, name: e.name, name_en: e.translation?.en?.name || null, code: e.code || null, total: e.total ?? null, printed_total: e.printed_total ?? null, release_date: e.release_date || null, logo: e.logo || null, symbol: e.symbol || null, language_code: e.language_code || null })
        if (datos.length < 100) break
        await pausa(200)
      }
      // Una lista vacía no es un error de la pasada: se apunta (con su
      // fecha, para no volver a pedirla hasta la semana que viene) y se
      // pasa al otro mercado.
      estado.listas[mercado] = { fecha: ahora.toISOString(), expansiones }
      await persistir()
    }
    const expansiones = estado.listas[mercado].expansiones
    if (!expansiones.length) continue

    // ── 2. Nuestros sets, y cuáles están vacíos ──
    let sets
    try {
      sets = (await pedir(`tcg_sets?select=id,name,name_en,release_date,card_count_official,card_count_total,tcg_online_code,tcggo_id,scrydex_id,scrydex_por,oculto&market=eq.${mercado}&order=id&limit=2000`)) || []
    } catch (e) {
      return { ok: false, ...resumen(), error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    }
    const k = (s) => `${mercado}|${s.id}`
    const caducado = (v) => !v?.fecha || (ahora.getTime() - new Date(v.fecha).getTime()) / 86_400_000 > DIAS_REVISAR
    // Lo rellenado y lo parado no se vuelven a mirar; lo demás, a la semana.
    const porMirar = sets.filter((s) => {
      const v = estado.vistos[k(s)]
      if (!v) return true
      if (v.estado === 'rellenado' || v.estado === 'parado') return false
      return caducado(v)
    }).slice(0, MAXIMO_PROBADOS)
    let vacio = null
    for (const s of porMirar) {
      let alguna
      try {
        alguna = (await pedir(`tcg_cards?select=id&market=eq.${mercado}&set_id=eq.${encodeURIComponent(s.id)}&limit=1`)) || []
      } catch (e) {
        await persistir()
        return { ok: false, ...resumen(), error: `nuestra base (${s.id}): ${String(e?.message || e).slice(0, 160)}` }
      }
      if (alguna.length) {
        // ¿Lleno A MEDIAS? Cartas de Scrydex dentro y el set sin apuntar
        // por ESTA función (`scrydex_por !== 'huecos'`): el PATCH de una
        // pasada anterior no llegó. Se remata aquí, sin pedirle nada a
        // Scrydex, y queda `rellenado` con `nombres: 0` para que la fase 0
        // le ponga los nombres. La 685.2 miraba «sin `scrydex_por`», y el
        // Expansion Pack y Jungle lo traían de la época antigua de Scrydex
        // (547): se quedaron con cartas, escondidos y fuera de la lista.
        if (s.scrydex_por !== 'huecos') {
          let deScrydex
          try {
            deScrydex = (await pedir(`tcg_cards?select=id&market=eq.${mercado}&set_id=eq.${encodeURIComponent(s.id)}&origen=eq.scrydex&limit=2000`)) || []
          } catch (e) {
            await persistir()
            return { ok: false, ...resumen(), error: `nuestra base (${s.id}): ${String(e?.message || e).slice(0, 160)}` }
          }
          if (deScrydex.length) {
            const { por, expansion } = expansionDelSet(s, expansiones)
            if (expansion) {
              try {
                await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify(parcheDeSet(s, expansion)) })
              } catch (e) {
                estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: s.id, expansion: expansion.id, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
                estado.parado = { dia, motivo: estado.ultimoError.error, version: VERSION }
                await persistir()
                return { ok: false, ...resumen(), error: estado.ultimoError.error }
              }
              estado.vistos[k(s)] = { fecha: ahora.toISOString(), estado: 'rellenado', expansion: expansion.id, por, nombre: expansion.name, cartas: deScrydex.length, nombres: 0, rematado: true }
              await persistir()
              return { ok: true, ...resumen(), rematado: { mercado, set: s.id, expansion: expansion.id, por } }
            }
          }
        }
        estado.vistos[k(s)] = { fecha: ahora.toISOString(), estado: 'lleno' }
        continue
      }
      vacio = s
      break
    }
    if (!vacio) continue

    // ── 3. Su expansión ──
    const { por, expansion, candidatas } = expansionDelSet(vacio, expansiones)
    if (!expansion) {
      estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'sinPar', nombre: vacio.name_en || vacio.name || '', candidatas: candidatas || [] }
      await persistir()
      return { ok: true, ...resumen(), mirado: { mercado, set: vacio.id, estado: 'sinPar' } }
    }
    if (Number(expansion.total) === 0) {
      estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'vacioEnScrydex', nombre: vacio.name_en || vacio.name || '', expansion: expansion.id }
      await persistir()
      return { ok: true, ...resumen(), mirado: { mercado, set: vacio.id, estado: 'vacioEnScrydex', expansion: expansion.id } }
    }

    // ── 4. Sus cartas, y a nuestra base ──
    const cartas = []
    let fallo = null
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_CARTAS; pagina++) {
      const r = await scrydex(`${idioma}/cards`, { q: `expansion.id:${expansion.id}`, page_size: 100, page: pagina })
      if (r.error) { fallo = r.error; break }
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      cartas.push(...datos)
      if (datos.length < 100) break
      await pausa(200)
    }
    if (fallo) {
      // Un fallo SUYO cuenta; un 401/403 ya ha parado el día entero.
      const n = (Number(estado.intentos[k(vacio)]) || 0) + 1
      estado.intentos[k(vacio)] = n
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: vacio.id, expansion: expansion.id, intento: n, error: fallo }
      if (n >= MAXIMO_INTENTOS) estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'parado', expansion: expansion.id, error: fallo }
      await persistir()
      return { ok: false, ...resumen(), error: fallo, mirado: { mercado, set: vacio.id, expansion: expansion.id, intento: n } }
    }
    const filas = igualarClaves(cartas.map((c) => filaDeCartaScrydex(c, { setId: vacio.id, mercado, idioma, ahora })).filter(Boolean))
    if (!filas.length) {
      estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'vacioEnScrydex', expansion: expansion.id, nota: 'la lista de cartas vino vacía' }
      await persistir()
      return { ok: true, ...resumen(), mirado: { mercado, set: vacio.id, estado: 'vacioEnScrydex', expansion: expansion.id } }
    }
    let conPrecio = 0
    try {
      for (let i = 0; i < filas.length; i += 200) {
        await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(filas.slice(i, i + 200)) })
      }
      await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(vacio.id)}`, { method: 'PATCH', body: JSON.stringify(parcheDeSet(vacio, expansion)) })
      conPrecio = await escribirPrecios(cartas, filas)
    } catch (e) {
      // Fallo NUESTRO: se para sin contar intento, se apunta, y NO se vuelve
      // a pedir nada a Scrydex hasta que se despliegue un arreglo.
      estado.ultimoError = { fecha: ahora.toISOString(), mercado, set: vacio.id, expansion: expansion.id, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
      estado.parado = { dia, motivo: estado.ultimoError.error, version: VERSION }
      await persistir()
      return { ok: false, ...resumen(), error: estado.ultimoError.error }
    }
    delete estado.intentos[k(vacio)]
    estado.vistos[k(vacio)] = { fecha: ahora.toISOString(), estado: 'rellenado', expansion: expansion.id, por, cartas: filas.length, nombre: expansion.name_en || expansion.name, nombres: VERSION_NOMBRES, conNombreIngles: filas.filter((f) => f.name_en).length, conPrecio }
    await persistir()
    return { ok: true, ...resumen(), rellenado: { mercado, set: vacio.id, expansion: expansion.id, nombre: expansion.name, por, cartas: filas.length } }
  }
  await persistir()
  return { ok: true, ...resumen(), hecho: true }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('scrydex-huecos:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada cuatro minutos, a y 3 (precios a los múltiplos de 5, el catálogo a
// y 2, el reemplazo a y 4, el calco en los impares): un set por pasada, ~70
// sets japoneses vacíos en unas cinco horas, una vez. Con todo mirado, una
// pasada es leer el estado.
export const config = { schedule: '3-59/4 * * * *' }
