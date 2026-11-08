// La mesa de «¿Quién es ese Pokémon?» (tanda 1268). Hasta la 1267 el
// Pokémon del día salía de la fecha EN LA PÁGINA (js/quien-es.js), así que
// con F12 se sabía sin jugar, y el dibujo se pedía a PokeAPI por su número
// de la Pokédex. Ahora lo elige el servidor con su semilla secreta, la
// silueta la sirve /reto-foto ya en negro (y borrosa), y la buena se queda
// en `retos_arbitro`, que corrige `retos_jugar`.
//
// Patrón inyectable, como las demás: `escribir` se cambia en las pruebas.
import { pokemonDelDia, opcionesDelDia, numeroDelDia } from '../../js/quien-es.js'
import { diaLibre } from '../../js/retos-libre.js'
import { hoyUTC, segundosHastaManana, rest, libreDePeticion, CABECERAS_LIBRE } from './mas-caro.mjs'
import { semillaDelDia, urlDeFoto } from '../lib/reto-secreto.mjs'
import { partirSilueta, mesaDelReto } from '../lib/reto-mesa.mjs'

export const JUEGO = 'silueta'

export async function mesaQuienEs({ dia, libre = null, secreto = 0, foto, pedir, escribir }) {
  if (libre) dia = diaLibre(libre)
  return mesaDelReto({
    juego: JUEGO, dia, pedir, escribir,
    elegir: () => ({ dia, numero: libre ? null : numeroDelDia(dia), libre, buena: pokemonDelDia(dia, secreto), opciones: opcionesDelDia(dia, secreto) }),
    partir: (r) => partirSilueta(r, foto),
  })
}

export default async (req) => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const libre = libreDePeticion(req)
  const dia = libre ? diaLibre(libre) : hoyUTC()
  try {
    const mesa = await mesaQuienEs({
      dia,
      libre,
      secreto: semillaDelDia(dia, clave),
      foto: (spec) => urlDeFoto(spec, clave),
      pedir: (ruta, o = {}) => rest(ruta, clave, o),
      escribir: (ruta, filas) => rest(ruta, clave, { metodo: 'POST', cuerpo: filas, cabeceras: { prefer: 'resolution=merge-duplicates,return=minimal' } }),
    })
    const hasta = segundosHastaManana()
    return Response.json(mesa, { headers: libre ? CABECERAS_LIBRE : { 'cache-control': `public, max-age=${hasta}`, 'netlify-cdn-cache-control': `public, durable, max-age=${hasta}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
