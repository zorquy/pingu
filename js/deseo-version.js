// LA VERSIÓN DE UN DESEO (tanda 1047). PINGU, del foro: «cuando doy al
// corazón… no puedo seleccionar si quiero la variante holo o normal». El
// deseo guarda `variante` (null = cualquiera) desde la migración 1047 y casa
// como el idioma: «cualquiera» con todo, una versión solo con esa. Una copia
// sin versión es la «normal», como en el resto de la web.
//
// Puro y sin dependencias: lo usan Mi colección, /carta, el perfil y el
// modo evento, y se prueba en Node.

export const casaVersion = (deseo, copia) => !deseo?.variante || deseo.variante === (copia?.variante || 'normal')

// Una baldosa de «La quiero» por carta Y versión: la Chikorita Holo y la
// Normal son dos cosas que buscas, cada una con su foto. Los idiomas de una
// misma versión siguen siendo una baldosa (771).
export function deseosPorCartaYVersion(lista = []) {
  const m = new Map()
  for (const d of lista) {
    const k = `${d.card_id}|${d.variante || ''}`
    if (!m.has(k)) m.set(k, { card_id: d.card_id, variante: d.variante || null, filas: [] })
    m.get(k).filas.push(d)
  }
  return [...m.values()]
}

// ¿Está la columna? Se sabe al primer `select`: mientras PINGU no ejecute la
// migración, pedir `variante` falla ENTERO (42703, la lección de la 624), así
// que se pide y, si la base dice que no existe, se vuelve a pedir sin ella y
// la web hace lo de antes (no pregunta la versión). null = aún no se sabe.
let hay = null
export const hayVariante = () => hay

// 42703 al leer, PGRST204 al escribir («Could not find the 'variante'
// column»); y que hable de ESTA columna, no de otra que falte.
export const faltaVariante = (e) =>
  !!e && ['42703', 'PGRST204'].includes(e.code) && /variante/i.test(`${e.message || ''} ${e.details || ''}`)

// `pedir(columnas)` devuelve la respuesta de Supabase ({ data, error }). Con
// la columna, `columnas + ',variante'`; sin ella, `columnas` a secas.
export async function conVariante(columnas, pedir) {
  if (hay !== false) {
    const r = await pedir(`${columnas},variante`)
    if (!faltaVariante(r.error)) {
      if (!r.error) hay = true
      return r
    }
    hay = false
  }
  return pedir(columnas)
}

// Para las pruebas.
export const _ponerHay = (v) => { hay = v }
