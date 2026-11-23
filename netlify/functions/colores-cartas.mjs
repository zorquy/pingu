// El color de cada ilustración del catálogo, en el servidor (tanda 1419,
// PINGU eligió lo recomendado de «Tus colores, bien»).
//
// Recorre las expansiones (las nuevas primero) y, de cada una, las
// ilustraciones que entran en Tus colores (`entraEnColores`: IR, SIR, full
// art… sin energías) que aún no tienen fila en `tcg_card_colores`. A cada una
// le lee la foto GRANDE (la cadena de siempre, `cadenaDeEscaneo(…, 'high')`:
// aquí no hay CORS, así que vale cualquier sitio), la reduce con sharp a 64×90
// y saca su huella con `huellaDePixeles` —la MISMA cuenta que el navegador,
// con el color de Tus colores dentro—. Una carta sin ninguna foto legible
// queda con la huella nula y su número de intentos; a la tercera se deja.
//
// ── LOS FRENOS (normas/servidor.md) ──
//
// No paga a nadie: las fotos son de CDNs públicos y lo demás es nuestra base.
// Aun así, el trabajo pendiente NUNCA llega a cero (siempre hay cartas sin
// foto), así que el freno no es «¿queda algo?» (la 510) sino CADA CUÁNTO:
// cuando acaba la vuelta entera se apunta el día y no vuelve a empezar hasta
// dentro de `DIAS_ENTRE_VUELTAS`; mientras tanto cada pasada es UNA consulta
// (el estado) y se va. Cada pasada trabaja 20 s como mucho.
//   · La primera vuelta: ~15.000 ilustraciones, unas 150 por pasada, cada
//     hora → unos cuatro días. Después, una vuelta a la semana (las
//     expansiones nuevas y los reintentos).
//   · Lo que falla va al ESTADO (`ultimoError`, `fallidas`), no a la
//     respuesta (la 655).
//
// «Calcular ahora» de /admin (una expansión) va por `colores-cartas-ahora`
// con la misma `procesar` y `soloSet`: una función con `schedule` no se
// puede llamar por HTTP.
//
// Sin la tabla (falta la migración 1419), no hace nada y lo dice.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { cadenaDeEscaneo } from '../../js/escaneo-carta.js'
import { huellaDePixeles, ANCHO, ALTO } from '../../js/mi-coleccion/armonia.js'
import { entraEnColores } from '../../js/mi-coleccion/color-de-carta.js'
import { CABECERAS_ORIGEN } from './imagen-carta.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'colores_cartas'
export const DIAS_ENTRE_VUELTAS = 7
export const MAX_INTENTOS = 3
export const A_LA_VEZ = 6
const MS_DE_TRABAJO = 20_000
const DIA = 86_400_000
// Lo que necesita la cadena de fotos y `entraEnColores`.
export const COLUMNAS = 'id,market,set_id,local_id,name,name_en,image_path,image_tcggo,image_scrydex,rarity,rarity_en,category'

async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      'content-type': 'application/json',
      prefer: opciones.method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=representation',
      ...(opciones.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

// La huella de la primera foto que se deje leer. `fetchImpl` y `sharp`, de
// fuera para la prueba.
export async function huellaDeFotos(urls, { fetchImpl = fetch, sharp = null } = {}) {
  const s = sharp || (await import('sharp')).default
  for (const u of urls || []) {
    try {
      const res = await fetchImpl(u, { headers: CABECERAS_ORIGEN, signal: AbortSignal.timeout(8000) })
      if (!res.ok || !/^image\//.test(res.headers.get('content-type') || '')) continue
      const buf = Buffer.from(await res.arrayBuffer())
      // Estirada a 64×90 como el lienzo del navegador (`drawImage` a ese tamaño).
      const { data } = await s(buf).resize(ANCHO, ALTO, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      return { huella: huellaDePixeles(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)), foto: u }
    } catch {
      // la siguiente
    }
  }
  return null
}

// Lo pendiente de una expansión: sus ilustraciones sin fila, o con la huella
// nula y menos de `MAX_INTENTOS` (una fila con solo la corrección del equipo
// también cuenta como pendiente: le falta la huella). Puro.
export function pendientesDe(cartas, filas) {
  const ya = new Map((filas || []).map((f) => [`${f.card_id}|${f.market || 'WEST'}`, f]))
  return (cartas || []).filter(entraEnColores).filter((c) => {
    const f = ya.get(`${c.id}|${c.market || 'WEST'}`)
    return !f || (!f.huella_ok && (f.intentos || 0) < MAX_INTENTOS)
  }).map((c) => ({ carta: c, intentos: ya.get(`${c.id}|${c.market || 'WEST'}`)?.intentos || 0 }))
}

// ¿Toca vuelta? Si la última acabó hace menos de `DIAS_ENTRE_VUELTAS`, no.
export function tocaVuelta(estado, ahora) {
  if (!estado?.vueltaAcabada) return true
  return ahora.getTime() - new Date(estado.vueltaAcabada).getTime() >= DIAS_ENTRE_VUELTAS * DIA
}

export async function procesar({ env = process.env, rest = restReal, leer = huellaDeFotos, ahora = new Date(), reloj = () => Date.now(), soloSet = null } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const inicio = reloj()
  const queda = () => reloj() - inicio < MS_DE_TRABAJO
  let estado
  try {
    estado = (await rest(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`, clave))?.[0]?.valor || {}
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) }
  }
  const guardar = () => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: estado, updated_at: ahora.toISOString() }]) })
  if (!soloSet && !estado.cola?.length && !tocaVuelta(estado, ahora)) {
    return { ok: true, saltado: `vuelta hecha el ${String(estado.vueltaAcabada).slice(0, 10)}; la siguiente, a los ${DIAS_ENTRE_VUELTAS} días` }
  }
  const leidas = []
  const fallidas = []
  try {
    // La cola: las expansiones, las nuevas primero.
    if (!soloSet && !estado.cola?.length) {
      const sets = (await rest('tcg_sets?select=id,market&order=release_date.desc.nullslast&limit=5000', clave)) || []
      estado.cola = sets.map((s) => `${s.market || 'WEST'}|${s.id}`)
      estado.empezada = ahora.toISOString()
    }
    const cola = soloSet ? [`${soloSet.market || 'WEST'}|${soloSet.id}`] : estado.cola
    let completas = 0
    while (cola.length && queda()) {
      const [market, setId] = cola[0].split('|')
      const cartas = (await rest(`tcg_cards?select=${COLUMNAS}&set_id=eq.${encodeURIComponent(setId)}&market=eq.${encodeURIComponent(market)}&limit=1000`, clave)) || []
      const ids = cartas.filter(entraEnColores).map((c) => c.id)
      const filas = []
      for (let i = 0; i < ids.length; i += 150) {
        const tramo = ids.slice(i, i + 150).map((s) => `"${encodeURIComponent(s)}"`).join(',')
        // `huella_ok` sin pedir la huella entera (que pesa): basta saber si hay.
        filas.push(...((await rest(`tcg_card_colores?select=card_id,market,intentos,huella_ok:huella->labs&market=eq.${encodeURIComponent(market)}&card_id=in.(${tramo})`, clave)) || []))
      }
      const pendientes = pendientesDe(cartas, filas)
      let i = 0
      const escritas = []
      const trabajador = async () => {
        while (i < pendientes.length && queda()) {
          const { carta, intentos } = pendientes[i++]
          const r = await leer(cadenaDeEscaneo(carta, null, 'high'))
          const base = { card_id: carta.id, market: carta.market || market, updated_at: ahora.toISOString() }
          if (r?.huella) {
            escritas.push({ ...base, huella: r.huella, color: r.huella.colores?.color || null, foto: r.foto, intentos })
            leidas.push(carta.id)
          } else {
            escritas.push({ ...base, huella: null, color: null, foto: null, intentos: intentos + 1 })
            fallidas.push(carta.id)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, pendientes.length) }, trabajador))
      if (escritas.length) await rest('tcg_card_colores?on_conflict=card_id,market', clave, { method: 'POST', body: JSON.stringify(escritas) })
      // La expansión sale de la cola solo si se ha hecho ENTERA.
      if (escritas.length < pendientes.length) break
      cola.shift()
      completas++
    }
    if (!soloSet) {
      if (!estado.cola.length) {
        estado.vueltaAcabada = ahora.toISOString()
        estado.vueltas = (estado.vueltas || 0) + 1
      }
      estado.ultimaPasada = { cuando: ahora.toISOString(), leidas: leidas.length, fallidas: fallidas.length, expansiones: completas, quedan: estado.cola.length }
      estado.leidas = (estado.leidas || 0) + leidas.length
      estado.fallidas = (estado.fallidas || 0) + fallidas.length
      estado.ultimoError = null
      await guardar()
    }
    return { ok: true, leidas: leidas.length, fallidas: fallidas.length, expansiones: completas, quedan: soloSet ? cola.length : estado.cola.length }
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|tcg_card_colores/.test(m) && /does not exist|42P01|PGRST205/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-1419-colores-de-cartas.sql (tcg_card_colores)' }
    estado.ultimoError = { cuando: ahora.toISOString(), mensaje: m.slice(0, 300) }
    try { if (!soloSet) await guardar() } catch { /* el estado tampoco: ya se verá en la siguiente */ }
    return { ok: false, error: m.slice(0, 200), leidas: leidas.length }
  }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('colores-cartas:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, a y 41. Con la vuelta hecha, una consulta y fuera.
export const config = { schedule: '41 * * * *' }
