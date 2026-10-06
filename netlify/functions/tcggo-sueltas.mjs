// LAS CARTAS SUELTAS SIN FOTO, BUSCADAS EN TCGGO POR NOMBRE (tanda 693).
//
// PINGU, con el Ancient Mew delante: «sale sin imagen; creo que está en la
// colección incorrecta. Si encuentras dónde está guardada en la API de
// TCGGO, la traes y la metes en la colección correcta». TCGdex tiene esa
// carta en un cajón llamado «Miscellaneous Promos» (`miscp`, una sola
// carta, sin foto), y el catálogo de TCGGO (640) solo escribe en los sets
// que casa por código o nombre: un cajón de una carta no casa con nada y
// la carta se queda sin foto y sin producto para siempre.
//
// Esto va carta a carta: cada pasada coge hasta `MAXIMO_POR_PASADA`
// cartas occidentales SIN NINGUNA foto (ni TCGdex, ni TCGGO, ni Scrydex)
// y sin `tcggo_id`, las busca en TCGGO por su nombre, y si TCGGO da UNA
// sola carta suelta con ese nombre exacto, le escribe la foto, el id y
// los productos — y si la expansión de TCGGO es un set NUESTRO (por
// `tcg_sets.tcggo_id`) distinto del que tiene, la cambia de set, con el
// número de TCGGO. El id de la carta no cambia: es la llave de las
// colecciones y de las URL. Con varias cartas del mismo nombre no se
// escribe nada: «Pikachu» son cientos, y elegir una sería inventarse una
// foto.
//
// Los frenos de la casa: un tope de peticiones al día, para en 429/403
// hasta mañana, cada carta se intenta `MAXIMO_INTENTOS` veces y luego se
// deja (y se vuelve a mirar a los `DIAS_REVISAR` días, por si TCGGO la
// trae), y un fallo de NUESTRA base para la pasada (526). TCGGO tiene dos
// parámetros de búsqueda y no se sabe cuál contesta (la sonda de la 683
// prueba los dos): se prueba `search` y, si no da nada, `name`, y el que
// funcione se apunta para no pagar los dos siempre.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_PAUSA_MS.
import { cabeceras, baseDe, esCartaSuelta, esLimiteDelPlan, nombreComparable, filaDeCartaTcggo } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_sueltas'
export const MAXIMO_POR_PASADA = 10
export const MAXIMO_INTENTOS = 3
export const DIAS_REVISAR = 14
export const TOPE_DIARIO = 300
export const PARAMETROS_DE_BUSQUEDA = ['search', 'name']
const MERCADO = 'WEST'

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

// ── Lo puro ──

// De lo que contesta TCGGO, la ÚNICA carta suelta con ese nombre exacto;
// con cero o con varias, nada y el motivo.
export function laUnica(respuesta, nombre) {
  const lista = Array.isArray(respuesta?.data) ? respuesta.data : []
  const k = nombreComparable(nombre)
  const sueltas = lista.filter((c) => esCartaSuelta(c) && nombreComparable(c?.name) === k)
  if (sueltas.length === 1) return { carta: sueltas[0] }
  return { carta: null, motivo: sueltas.length ? `TCGGO tiene ${sueltas.length} cartas con ese nombre` : lista.length ? 'TCGGO devuelve cartas, pero ninguna con ese nombre exacto' : 'TCGGO no devuelve nada' }
}

// Lo que se le escribe a la carta: la foto, el id y los productos de
// TCGGO; y el set (con el número de TCGGO) solo si su expansión es un set
// nuestro distinto del que tiene. `sets` son los nuestros con `tcggo_id`.
export function parcheDeCarta(nuestra, suya, sets) {
  const fila = filaDeCartaTcggo(suya, { setId: nuestra.set_id, nuestra })
  const parche = {
    tcggo_id: fila.tcggo_id,
    image_tcggo: fila.image_tcggo,
    cm_id_product_propio: fila.cm_id_product,
    tp_id_product_propio: fila.tp_id_product,
    tcggo_at: new Date().toISOString(),
  }
  if (!nuestra.name_en && suya?.name) parche.name_en = suya.name
  const idEpisodio = Number(suya?.episode?.id)
  const destino = Number.isInteger(idEpisodio) ? sets.find((s) => Number(s.tcggo_id) === idEpisodio && s.id !== nuestra.set_id) : null
  if (destino) {
    parche.set_id = destino.id
    const numero = String(suya?.card_number ?? '').trim()
    if (numero) parche.local_id = numero
  }
  return { parche, movida: destino ? { de: nuestra.set_id, a: destino.id } : null }
}

// ── La pasada ──
export async function pasada({ env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null, ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: false, error: 'Falta TCGGO_API_KEY en Netlify' }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))
  const { base, host } = baseDe(env)
  const cab = cabeceras(claveTcggo, host)
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : 250
  const dia = ahora.toISOString().slice(0, 10)

  const estado = { hechas: {}, sinPar: {}, ...(await leerEstado(CLAVE_ESTADO)) }
  if (estado.dia !== dia) { estado.dia = dia; estado.peticionesHoy = 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  const resumen = () => ({ hechas: Object.keys(estado.hechas).length, sinPar: Object.keys(estado.sinPar).length, peticionesHoy: estado.peticionesHoy || 0, parametro: estado.parametro || null })
  if (estado.parado?.dia === dia) return { ok: true, ...resumen(), saltado: `parado hoy: ${estado.parado.motivo}` }
  if ((estado.peticionesHoy || 0) >= TOPE_DIARIO) return { ok: true, ...resumen(), saltado: 'tope diario' }

  // Las candidatas: sin ninguna foto y sin id de TCGGO. Se piden más de las
  // que se van a mirar porque las ya hechas o agotadas se descartan aquí.
  let candidatas
  let sets
  try {
    candidatas = (await pedir(`tcg_cards?select=id,set_id,local_id,name,name_en&market=eq.${MERCADO}&image_path=is.null&image_tcggo=is.null&image_scrydex=is.null&tcggo_id=is.null&order=id&limit=200`)) || []
    sets = (await pedir(`tcg_sets?select=id,tcggo_id&market=eq.${MERCADO}&tcggo_id=not.is.null&limit=2000`)) || []
  } catch (e) {
    estado.ultimoError = { fecha: ahora.toISOString(), error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    await persistir()
    return { ok: false, ...resumen(), error: estado.ultimoError.error }
  }
  const caducado = (v) => !v?.fecha || (ahora.getTime() - new Date(v.fecha).getTime()) / 86_400_000 >= DIAS_REVISAR
  const pendientes = candidatas.filter((c) => !estado.hechas[c.id] && ((estado.sinPar[c.id]?.intentos || 0) < MAXIMO_INTENTOS || caducado(estado.sinPar[c.id]))).slice(0, MAXIMO_POR_PASADA)
  const hechasAhora = []
  const sinParAhora = []
  for (const c of pendientes) {
    if ((estado.peticionesHoy || 0) >= TOPE_DIARIO) break
    const nombre = c.name_en || c.name
    const previo = estado.sinPar[c.id] || { intentos: 0 }
    const intentos = caducado(previo) ? 1 : previo.intentos + 1
    // Los dos parámetros, el que funcionó la última vez primero.
    const orden = estado.parametro ? [estado.parametro, ...PARAMETROS_DE_BUSQUEDA.filter((p) => p !== estado.parametro)] : PARAMETROS_DE_BUSQUEDA
    let resultado = null
    let fallo = null
    for (const param of orden) {
      if (pausaMs) await pausa(pausaMs)
      estado.peticionesHoy = (estado.peticionesHoy || 0) + 1
      let res
      try {
        res = await fetchImpl(`${base}/cards?${param}=${encodeURIComponent(nombre)}&per_page=50`, { headers: cab })
      } catch (e) { fallo = `TCGGO no contesta: ${String(e?.message || e).slice(0, 100)}`; continue }
      const texto = await res.text()
      if (!res.ok) {
        if (esLimiteDelPlan(res.status, texto)) {
          estado.parado = { dia, motivo: `RapidAPI ${res.status}: el plan no da más por hoy` }
          await persistir()
          return { ok: true, ...resumen(), hechasAhora, sinParAhora, parado: estado.parado }
        }
        fallo = `TCGGO ${res.status}`
        continue
      }
      let datos
      try { datos = JSON.parse(texto) } catch { fallo = 'TCGGO ha contestado algo que no es JSON'; continue }
      const lista = Array.isArray(datos?.data) ? datos.data : []
      if (!lista.length) { fallo = `TCGGO no devuelve nada con ${param}`; continue }
      estado.parametro = param
      resultado = laUnica(datos, nombre)
      break
    }
    if (!resultado?.carta) {
      const motivo = resultado?.motivo || fallo || 'sin respuesta'
      estado.sinPar[c.id] = { fecha: ahora.toISOString(), intentos, motivo, nombre }
      sinParAhora.push({ id: c.id, motivo })
      continue
    }
    const { parche, movida } = parcheDeCarta(c, resultado.carta, sets)
    try {
      await pedir(`tcg_cards?market=eq.${MERCADO}&id=eq.${encodeURIComponent(c.id)}`, { method: 'PATCH', body: JSON.stringify(parche) })
    } catch (e) {
      // Lo nuestro falla: se para la pasada entera, que seguir sería pagar
      // peticiones para no escribir nada (la 526).
      estado.ultimoError = { fecha: ahora.toISOString(), carta: c.id, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
      await persistir()
      return { ok: false, ...resumen(), hechasAhora, sinParAhora, error: estado.ultimoError.error }
    }
    delete estado.sinPar[c.id]
    estado.hechas[c.id] = { fecha: ahora.toISOString(), nombre, tcggo: resultado.carta.id, episodio: resultado.carta.episode?.name || null, foto: Boolean(parche.image_tcggo), movida }
    hechasAhora.push({ id: c.id, tcggo: resultado.carta.id, movida })
  }
  await persistir()
  return { ok: true, ...resumen(), miradas: pendientes.length, hechasAhora, sinParAhora }
}

export default async () => {
  const r = await pasada()
  return new Response(JSON.stringify(r), { status: r.ok ? 200 : 500, headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: '9-59/12 * * * *' }
