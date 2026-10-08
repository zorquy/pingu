// Los intercambios: lo que doy, lo que busco y quién encaja (tanda 376).
//
// Módulo aparte de `datos.js` por lo de siempre: la pestaña de cambios
// no la abre casi nadie en su primera visita, y esto entra por un
// `import()` dinámico. Pero OJO con eso y el barrido de la 299 — un
// import dinámico también arrastra el CSS del módulo, y la prueba los
// sigue desde la tanda 307. Por eso aquí no se pinta: solo se consulta.
import { supabase } from '../supabase.js'

export const FICHERO_MIGRACION = 'supabase-migration-intercambios.sql'

function traducir(error) {
  if (!error) return null
  const sin = ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(error.code) ||
    /does not exist|Could not find/i.test(error.message || '')
  const e = new Error(sin ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message || 'No se ha podido consultar.')
  e.sinMigracion = sin
  return e
}

export const COLUMNAS_DESEO = 'id,user_id,card_id,idioma,prioridad,notas,created_at'

// ── Lo que busco ──

export async function deseosDe(userId) {
  const { data, error } = await supabase
    .from('user_wants')
    .select(COLUMNAS_DESEO)
    .eq('user_id', userId)
    // Lo último primero, y nada más (771): la prioridad ya no se enseña, y
    // ordenar por ella dejaría lo de antes delante de lo que acabas de poner.
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw traducir(error)
  return data || []
}

// Los de UNA carta (751): el corazón de /carta pregunta por la carta que
// enseña, no por la lista entera.
export async function deseosDeCarta(userId, cardId) {
  const { data, error } = await supabase.from('user_wants').select(COLUMNAS_DESEO).eq('user_id', userId).eq('card_id', cardId)
  if (error) throw traducir(error)
  return data || []
}

export async function anadirDeseo(deseo) {
  const { data, error } = await supabase.from('user_wants').insert(deseo).select(COLUMNAS_DESEO).single()
  if (error) {
    // 23505 es el índice único: la misma carta, en el mismo idioma, ya
    // está apuntada. No es un fallo que haya que enseñar en rojo.
    if (error.code === '23505') {
      const e = new Error('Esa carta ya está en tu lista de búsqueda.')
      e.yaEstaba = true
      throw e
    }
    throw traducir(error)
  }
  return data
}

export async function borrarDeseo(id) {
  // Con `select`, como en el resto de la casa: un borrado que la
  // política rechaza vuelve vacío y sin error (CLAUDE.md).
  const { data, error } = await supabase.from('user_wants').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido quitar: ese deseo no es tuyo o ya no existe.')
}

// ── El tablón ──
//
// Las dos direcciones del cambio, con la MISMA forma: quien las pinta
// no tiene que saber cuál está mirando.
export async function quienTiene(limite = 200) {
  const { data, error } = await supabase.rpc('intercambios_quien_tiene', { p_limite: limite })
  if (error) throw traducir(error)
  return data || []
}

export async function quienBusca(limite = 200) {
  const { data, error } = await supabase.rpc('intercambios_quien_busca', { p_limite: limite })
  if (error) throw traducir(error)
  return data || []
}

// Quién da ESTA carta. Sin sesión también: es el escaparate de la ficha
// de una carta, que se ve sin cuenta (misma regla que los torneos).
export async function quienDaEsta(cardId, limite = 20) {
  const { data, error } = await supabase.rpc('intercambios_de_carta', { p_card_id: cardId, p_limite: limite })
  if (error) throw traducir(error)
  return data || []
}

// El Mercado (770): todo lo que se da, por carta. Sin sesión también: es el
// escaparate. Su migración es otra (`supabase-migration-mercado.sql`), y si
// falta se dice ESA, no la de los intercambios.
export const FICHERO_MERCADO = 'supabase-migration-mercado.sql'
export async function mercado({ market = 'WEST', idioma = null, texto = '', sets = null, soloMias = false, orden = 'nuevo', limite = 60, desde = 0 } = {}) {
  const { data, error } = await supabase.rpc('intercambios_mercado', {
    p_market: market,
    p_idioma: idioma || null,
    p_texto: texto || null,
    p_sets: sets?.length ? sets : null,
    p_solo_mias: Boolean(soloMias),
    p_orden: orden,
    p_limite: limite,
    p_desde: desde,
  })
  if (error) {
    const e = traducir(error)
    if (e.sinMigracion) e.message = `Falta ejecutar ${FICHERO_MERCADO} en Supabase.`
    throw e
  }
  return data || []
}

// ── Agrupar por persona ──
//
// La RPC devuelve una fila por CARTA, que es lo que sabe la base. Pero
// un cambio se habla con una PERSONA, no con una carta: si alguien tiene
// seis cosas que buscas, eso es un mensaje, no seis. Agrupar aquí y no
// en SQL deja la función devolviendo filas planas, que es lo que se
// puede probar sin montar el tablón entero.
export function porPersona(filas) {
  const gente = new Map()
  for (const f of filas || []) {
    if (!gente.has(f.user_id)) {
      gente.set(f.user_id, {
        user_id: f.user_id,
        username: f.username,
        display_name: f.display_name,
        avatar_url: f.avatar_url,
        reciproco: false,
        cartas: [],
      })
    }
    const g = gente.get(f.user_id)
    // `reciproco` viene igual en todas las filas de una persona, pero se
    // toma con un OR por si algún día deja de venir igual: es mejor
    // marcar de más que perder una doble coincidencia.
    g.reciproco = g.reciproco || Boolean(f.reciproco)
    g.cartas.push(f)
  }
  // Las dobles coincidencias primero y, dentro, quien más cosas tenga:
  // es el orden en el que se escriben los mensajes.
  return [...gente.values()].sort(
    (a, b) => Number(b.reciproco) - Number(a.reciproco) || b.cartas.length - a.cartas.length ||
      String(a.username || '').localeCompare(String(b.username || ''), 'es')
  )
}
