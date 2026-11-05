// Tanda 1245 — Una tienda DE PRUEBAS (`tiendas.de_pruebas`, PINGU: «que sea un
// perfil como fantasma de pruebas») no sale en ninguna lista de gente. Lo de
// sus cartas lo esconde la base (`tienda_publica`); las listas que leen
// `user_profiles` a pelo (Gente, el buscador) preguntan aquí UNA vez por visita
// quiénes son. Sin la migración, la columna no existe y no se esconde nadie.
import { supabase } from './supabase.js'
import { sinFantasmas } from './tiendas-puro.js'

let pedidas = null
export function tiendasDePruebas() {
  if (!pedidas) {
    pedidas = Promise.resolve(supabase.from('tiendas').select('user_id').eq('de_pruebas', true))
      .then(({ data, error }) => new Set(error || !Array.isArray(data) ? [] : data.map((f) => f.user_id)))
      .catch(() => new Set())
  }
  return pedidas
}

export async function quitarFantasmas(perfiles, yo = null) {
  return sinFantasmas(perfiles, await tiendasDePruebas(), yo)
}
