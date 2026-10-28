// Los intercambios: lo que doy, lo que busco y quién encaja (tanda 376).
//
// Módulo aparte de `datos.js` por lo de siempre: la pestaña de cambios
// no la abre casi nadie en su primera visita, y esto entra por un
// `import()` dinámico. Pero OJO con eso y el barrido de la 299 — un
// import dinámico también arrastra el CSS del módulo, y la prueba los
// sigue desde la tanda 307. Por eso aquí no se pinta: solo se consulta.
import { supabase } from '../supabase.js'
import { conVariante, hayVariante, casaVersion } from '../deseo-version.js'

export const FICHERO_MIGRACION = 'supabase-migration-intercambios.sql'

function traducir(error) {
  if (!error) return null
  const sin = ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(error.code) ||
    /does not exist|Could not find/i.test(error.message || '')
  const e = new Error(sin ? `Falta ejecutar ${FICHERO_MIGRACION} en Supabase.` : error.message || 'No se ha podido consultar.')
  e.sinMigracion = sin
  return e
}

// Sin `variante`: esa la añade `conVariante` cuando la base la tiene (1047).
export const COLUMNAS_DESEO = 'id,user_id,card_id,idioma,prioridad,notas,created_at'

// ── Lo que busco ──

export async function deseosDe(userId) {
  const { data, error } = await conVariante(COLUMNAS_DESEO, (cols) => supabase
    .from('user_wants')
    .select(cols)
    .eq('user_id', userId)
    // Lo último primero, y nada más (771): la prioridad ya no se enseña, y
    // ordenar por ella dejaría lo de antes delante de lo que acabas de poner.
    .order('created_at', { ascending: false })
    .limit(2000))
  if (error) throw traducir(error)
  return data || []
}

// Los de UNA carta (751): el corazón de /carta pregunta por la carta que
// enseña, no por la lista entera.
export async function deseosDeCarta(userId, cardId) {
  const { data, error } = await conVariante(COLUMNAS_DESEO, (cols) => supabase.from('user_wants').select(cols).eq('user_id', userId).eq('card_id', cardId))
  if (error) throw traducir(error)
  return data || []
}

// 23505 es el índice único: la misma carta, en el mismo idioma y la misma
// versión, ya está apuntada. No es un fallo que haya que enseñar en rojo.
function yaEstaba(error) {
  if (error?.code !== '23505') return null
  const e = new Error('Esa carta ya está en tu lista de búsqueda.')
  e.yaEstaba = true
  return e
}

// Sin la columna, el deseo se apunta sin versión: es lo que hacía antes.
const sinVersionSiNoHay = (deseo) => {
  if (hayVariante() !== false || !('variante' in deseo)) return deseo
  const { variante, ...resto } = deseo
  return resto
}

export async function anadirDeseo(deseo) {
  const { data, error } = await conVariante(COLUMNAS_DESEO, (cols) =>
    supabase.from('user_wants').insert(sinVersionSiNoHay(deseo)).select(cols).single())
  if (error) throw yaEstaba(error) || traducir(error)
  return data
}

// Cambiar lo que pediste (1047, la C1 de la propuesta): el idioma, la
// versión o las dos. Con `select`: un update que la política rechaza vuelve
// vacío y sin error.
export async function cambiarDeseo(id, cambios) {
  const { data, error } = await conVariante(COLUMNAS_DESEO, (cols) => supabase.from('user_wants').update(sinVersionSiNoHay(cambios)).eq('id', id).select(cols))
  if (error) throw yaEstaba(error) || traducir(error)
  if (!data?.length) throw new Error('No se ha podido cambiar: ese deseo no es tuyo o ya no existe.')
  return data[0]
}

export async function borrarDeseo(id) {
  // Con `select`, como en el resto de la casa: un borrado que la
  // política rechaza vuelve vacío y sin error (CLAUDE.md).
  const { data, error } = await supabase.from('user_wants').delete().eq('id', id).select('id')
  if (error) throw traducir(error)
  if (!data?.length) throw new Error('No se ha podido quitar: ese deseo no es tuyo o ya no existe.')
}

// ── El deseo que se cumple al añadir (1063) ──
//
// PINGU: «cuando consigues una carta que ya querías… debería quitársele el
// corazón». La regla es la de `cambio_mover` (1047), que ya tachaba el deseo
// al cerrar un cambio: lo cumple una copia de esa carta en el idioma pedido
// (o cualquiera, si no se pidió) y en la versión pedida (o cualquiera). Una
// española no tacha la japonesa que buscas, ni la Normal la Holo.
export const cumpleDeseo = (deseo, copia) =>
  !!deseo && !!copia && deseo.card_id === copia.card_id && (!deseo.idioma || deseo.idioma === copia.idioma) && casaVersion(deseo, copia)

// Borra los deseos de `userId` que cumplen estas copias y devuelve las filas
// borradas (para Deshacer). Se lee primero y se borra por id: la columna
// `variante` puede no estar (1047), y la regla vive en un solo sitio.
export async function tacharCumplidos(userId, copias) {
  const ids = [...new Set((copias || []).map((c) => c?.card_id).filter(Boolean))]
  if (!userId || !ids.length) return []
  const { data, error } = await conVariante(COLUMNAS_DESEO, (cols) => supabase.from('user_wants').select(cols).eq('user_id', userId).in('card_id', ids))
  if (error) throw traducir(error)
  const cumplidos = (data || []).filter((d) => copias.some((c) => cumpleDeseo(d, c)))
  if (!cumplidos.length) return []
  // Con `select`: lo que la política no deje borrar vuelve sin fila, y no se
  // anuncia como quitado.
  const { data: fuera, error: fallo } = await supabase.from('user_wants').delete().in('id', cumplidos.map((d) => d.id)).select('id')
  if (fallo) throw traducir(fallo)
  const borrados = new Set((fuera || []).map((f) => f.id))
  return cumplidos.filter((d) => borrados.has(d.id))
}

// Deshacer: los deseos vuelven con su id y su fecha, así que vuelven a su
// sitio en «La quiero» y en sus listas (1057: las listas cuelgan de la carta,
// no del deseo). Uno que ya se hubiera vuelto a apuntar no es un fallo.
export async function devolverDeseos(filas) {
  for (const f of filas || []) {
    const { error } = await supabase.from('user_wants').insert(sinVersionSiNoHay({ ...f }))
    if (error && !yaEstaba(error)) throw traducir(error)
  }
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
// Con las TIENDAS (1069): `mercado_con_tiendas` mezcla su stock con lo que
// da la gente, y `quien` elige «todos», «personas» o «tiendas». Sin esa
// migración se usa la de siempre y `mercadoConTiendas` se queda en false: la
// pantalla esconde el «Personas / Tiendas».
export let mercadoConTiendas = null
export async function mercado({ market = 'WEST', idioma = null, texto = '', sets = null, soloMias = false, orden = 'nuevo', limite = 60, desde = 0, quien = 'todos' } = {}) {
  const args = {
    p_market: market,
    p_idioma: idioma || null,
    p_texto: texto || null,
    p_sets: sets?.length ? sets : null,
    p_solo_mias: Boolean(soloMias),
    p_orden: orden,
    p_limite: limite,
    p_desde: desde,
  }
  if (mercadoConTiendas !== false) {
    const r = await supabase.rpc('mercado_con_tiendas', { ...args, p_quien: quien })
    if (!r.error) {
      mercadoConTiendas = true
      return r.data || []
    }
    if (!traducir(r.error).sinMigracion) throw traducir(r.error)
    mercadoConTiendas = false
  }
  const { data, error } = await supabase.rpc('intercambios_mercado', args)
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
