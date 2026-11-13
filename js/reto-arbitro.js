// Jugar un reto con el ÁRBITRO (tanda 1268). PINGU: «que ningún listillo
// haga trampa». La respuesta ya no está en la página: cada jugada se le
// manda a la base (`retos_jugar`, supabase-migration-1268-retos-arbitro.sql),
// que la corrige y devuelve solo lo que esa jugada destapa. Al acabar, si
// tienes cuenta, la base apunta el resultado y da la XP ella sola; la página
// solo lo celebra.
//
// Sin cuenta (o en una partida libre), la partida viaja en una FICHA cifrada
// que guarda el navegador y se manda con cada jugada: la abre solo la base,
// así que no se puede leer ni retocar.
import { supabase } from './supabase.js'
import { avisarExito } from './exito.js'
import { getSession } from './app.js'
import { celebrarGuardado, puestoEnLiga } from './retos-datos.js'

const claveFicha = (juego, libre) => `pokedoc-ficha-${juego}${libre ? '-libre' : ''}`

function leerFicha(juego, libre, dia) {
  try {
    const g = JSON.parse(localStorage.getItem(claveFicha(juego, libre)) || 'null')
    return g && g.dia === dia && (g.libre ?? null) === (libre ?? null) ? g.ficha : null
  } catch {
    return null
  }
}

function escribirFicha(juego, libre, dia, ficha) {
  try { localStorage.setItem(claveFicha(juego, libre), JSON.stringify({ dia, libre: libre ?? null, ficha })) } catch {}
}

export const TEXTO_SIN_ARBITRO = 'Este reto se está actualizando. Vuelve en un rato.'
const faltaFuncion = (e) => /PGRST202|42883|Could not find the function|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`)

// Una partida: `abrir()` la trae (la de la base si tienes cuenta, la de la
// ficha si no) y `jugar(jugada)` manda una jugada. Las dos devuelven lo que
// contesta la base: { estado, eco, guardado, cuenta }. Si al acabar se ha
// apuntado algo nuevo, se celebra aquí (nivel, día perfecto, liga).
export function partida(juego, { dia, libre = null } = {}) {
  let ligaAntes = null
  let enCurso = Promise.resolve()
  const pedir = async (jugada) => {
    const { data, error } = await supabase.rpc('retos_jugar', {
      p_juego: juego,
      p_dia: dia,
      p_libre: libre,
      p_jugada: jugada,
      p_ficha: leerFicha(juego, libre, dia),
    })
    if (error) {
      const e = new Error(faltaFuncion(error) ? TEXTO_SIN_ARBITRO : String(error.message || '').replace(/^reto:\s*/, ''))
      e.sinArbitro = faltaFuncion(error)
      throw e
    }
    if (data?.ficha) escribirFicha(juego, libre, dia, data.ficha)
    if (data?.guardado?.nuevo) data.guardado = await celebrarGuardado(data.guardado, { antes: ligaAntes })
    // Un reto acabado con esta jugada (no al volver a abrir uno ya hecho).
    if (jugada != null && data?.estado?.terminada) avisarExito('reto')
    return data
  }
  return {
    async abrir() {
      const r = await pedir(null)
      // El puesto en la liga ANTES de acabar, para decir luego si subes (989).
      if (r?.cuenta && !r.estado?.terminada && !libre) puestoEnLiga().then((p) => { ligaAntes = p }).catch(() => {})
      return r
    },
    // Las jugadas van en fila: dos toques seguidos no se cruzan por el camino.
    jugar(jugada) {
      const r = enCurso.then(() => pedir(jugada))
      enCurso = r.catch(() => {})
      return r
    },
  }
}

// ¿Hay sesión? (para «Con cuenta, ahora vale…»).
export const haySesion = () => getSession().then(Boolean).catch(() => false)
