// La foto diaria del valor de cada colección (tanda 377).
//
// Hasta ahora sabíamos lo que vale una colección AHORA, y solo ahora: se
// sumaba al pintar la página y no se guardaba. Así que «¿ha subido este
// mes?» no se podía contestar, y es la pregunta que se hace cualquiera
// que colecciona.
//
// ── POR QUÉ ESTO NO SE PARECE A `precios-coleccion` ──
//
// Aquella pide una ficha POR CARTA a TCGdex, así que va con tope por
// pasada, pausa entre peticiones y presupuesto de tiempo propio. Esta no
// pide nada a nadie: la cuenta entera la hace Postgres en una sentencia
// (`coleccion_foto_diaria`), para TODO el mundo a la vez. Una llamada y
// se acabó.
//
// Y eso NO es una comodidad, es la única forma que cabe: Netlify mata
// una función programada a los 30 segundos (tanda 322), y una consulta
// por coleccionista se come el presupuesto en cuanto haya unos cuantos.
//
// UNA VEZ AL DÍA, y de madrugada: los precios los refresca
// `precios-coleccion` a lo largo del día, así que la foto de las 4 de la
// mañana es la del día ENTERO de ayer y no la de media mañana.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

export async function procesar({ env = process.env, fetchImpl = fetch } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  try {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/coleccion_foto_diaria`, {
      method: 'POST',
      headers: { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: '{}',
    })
    const texto = await res.text()
    if (!res.ok) {
      // Mientras la migración no esté ejecutada esto NO es un fallo que
      // haya que gritar cada noche: es «todavía no». Mismo trato que le
      // da `precios-coleccion` a la suya.
      if (/PGRST202|Could not find/.test(texto)) {
        return { ok: true, saltado: 'falta ejecutar supabase-migration-valor-historico.sql' }
      }
      return { ok: false, error: `Supabase ${res.status}: ${texto.slice(0, 200)}` }
    }
    // La función devuelve cuántas colecciones ha fotografiado.
    const n = Number(JSON.parse(texto))
    return { ok: true, colecciones: Number.isFinite(n) ? n : 0 }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('valor-coleccion:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// A las 4:07. El minuto no es redondo a propósito: casi todo el mundo
// programa en punto y las tareas de las cuatro se pelean por la misma
// ventana.
export const config = { schedule: '7 4 * * *' }
