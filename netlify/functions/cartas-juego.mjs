import { agregarJuego } from '../lib/juego-agregado.mjs'

// Qué cartas se juegan de verdad en los torneos de PokeDoc (tanda 325).
//
// Recorre las decklists visibles, deduce el arquetipo de cada mazo con
// el mismo código que los pinta en un torneo, y deja el recuento en
// `tcg_card_play` para que la ficha de una carta lo lea de una fila.
//
// ── LA CLAVE PÚBLICA NO ES UN DESCUIDO ──
//
// Las decklists se leen con la clave PUBLICABLE, no con la de servicio,
// y eso es lo más importante de este fichero.
//
// La casa tiene una regla: los arquetipos no se guardan, se deducen al
// pintarlos, y por eso la visibilidad no se puede equivocar — ves el
// mazo de alguien exactamente cuando la base te deja ver su lista. Un
// agregado guardado se lleva esa garantía por delante en cuanto se
// calcula con una clave que se salta la RLS: bastaría un torneo con las
// listas en «nunca» para que sus mazos acabaran contados aquí y, desde
// aquí, en una página pública.
//
// Leyendo como el público, la política `decklists_ver` decide igual que
// para cualquier visitante. Lo que entra en el agregado es, por
// construcción, lo que ya puede ver todo el mundo. La clave de servicio
// se usa SOLO para escribir el resultado.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// La misma que viaja en js/supabase.js y que cualquiera puede leer desde
// el navegador. Aquí es una decisión, no una comodidad.
const CLAVE_PUBLICA = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// Cuántas decklists se leen por vuelta. Con paginación, porque el día
// que haya tres mil listas una sola petición devolvería megas de jsonb.
const POR_PAGINA = 500

// El tope. No es por rendimiento: es para que una pasada no se eternice
// si algún día el sitio crece de golpe. Si se llega, la pasada avisa en
// su respuesta y toca mover esto a una consulta de Postgres.
const MAXIMO = 5000

// Cuántas filas se escriben de una vez.
const POR_LOTE = 500

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function leerPublico(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: CLAVE_PUBLICA, authorization: `Bearer ${CLAVE_PUBLICA}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const filas = await res.json()
  return Array.isArray(filas) ? filas : []
}

async function escribir(clave, ruta, cuerpo, cabeceras = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: 'POST',
    headers: { ...servicio(clave), Prefer: 'return=minimal', ...cabeceras },
    body: JSON.stringify(cuerpo),
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

export default async function handler() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return new Response('Falta SUPABASE_SERVICE_ROLE_KEY', { status: 500 })

  // El catálogo de arquetipos curados. Si la tabla no existe todavía o
  // está vacía, la deducción automática se apaña sola — que es lo que
  // pasa hoy en producción y es justo lo que hace la ficha de un torneo.
  let catalogo = []
  try {
    catalogo = await leerPublico('tcg_archetypes?select=id,nombre,requiere,activo')
  } catch {
    catalogo = []
  }

  // ── Las listas, leídas COMO EL PÚBLICO ──
  const listas = []
  let desde = 0
  let truncado = false
  for (;;) {
    const pagina = await leerPublico(
      `tournament_decklists?select=tournament_id,parsed_cards` +
        `&order=submitted_at.desc&offset=${desde}&limit=${POR_PAGINA}`
    )
    listas.push(...pagina)
    if (pagina.length < POR_PAGINA) break
    desde += POR_PAGINA
    if (listas.length >= MAXIMO) {
      truncado = true
      break
    }
  }

  const filas = agregarJuego(listas, catalogo)
  const ahora = new Date().toISOString()

  // ── Se sustituye entero, no se va sumando ──
  //
  // Un torneo puede cambiar de visibilidad, una lista puede borrarse y
  // un mazo puede corregirse. Si esto sumara sobre lo que ya había, una
  // lista que deja de ser pública seguiría contada para siempre — y eso
  // es exactamente la garantía que este fichero existe para no romper.
  //
  // Primero se escribe lo nuevo y DESPUÉS se borra lo viejo: si la
  // pasada se cae a mitad, las fichas enseñan datos de ayer, que es
  // mucho mejor que enseñar una tabla vacía.
  for (let i = 0; i < filas.length; i += POR_LOTE) {
    await escribir(
      clave,
      'tcg_card_play',
      filas.slice(i, i + POR_LOTE).map((f) => ({ ...f, updated_at: ahora })),
      { Prefer: 'resolution=merge-duplicates,return=minimal' }
    )
  }

  // Lo que ya no sale en ninguna lista visible se va. `updated_at` hace
  // de marca de esta pasada: lo que no se ha tocado, sobra.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tcg_card_play?updated_at=lt.${encodeURIComponent(ahora)}`,
    { method: 'DELETE', headers: { ...servicio(clave), Prefer: 'return=minimal' } }
  )
  const borradas = res.ok

  return Response.json({
    listas: listas.length,
    cartas: filas.length,
    arquetiposCurados: catalogo.length,
    limpieza: borradas,
    truncado,
  })
}

// Cada media hora. No hace falta más: una decklist nueva es visible
// cuando termina su torneo, y un torneo no termina cada cinco minutos.
export const config = { schedule: '*/30 * * * *' }
