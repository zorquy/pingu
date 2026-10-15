// Compartir «Mi día» (870): junta los seis retos de hoy y abre la hoja.
//
// Lo que sabe el navegador (la partida de cada juego, en localStorage) va
// primero, porque trae la tira en orden; lo de la base (`retos_mis_numeros`)
// completa lo jugado en otro aparato y pone la racha. Entra por `import()`
// desde el botón «Compartir mi día»: el que no lo pulsa no lo baja.
import { RETOS } from './retos-xp.js'
import { misNumeros } from './retos-datos.js'
import { textoDeMiDia, textoDeMiMes, filasDeMiDia, tiraDeBase, tiraLocal, numeroDelDia, ENLACE_RETOS, TAMANO, CLAVE_RETO_LOCAL } from './mi-dia.js'

const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') } catch { return null } }

// { juego: tira | null } de hoy. `extra` manda: la pantalla que acaba de
// terminar un reto lo pasa tal cual, sin esperar a que se guarde.
export function resultadosDeHoy(dia, numeros = null, extra = {}) {
  const resultados = {}
  for (const r of RETOS) {
    const clave = r.juego === 'reto' ? CLAVE_RETO_LOCAL : r.local
    const local = clave ? tiraLocal(r.juego, leer(clave), dia) : null
    resultados[r.juego] = extra[r.juego] || local || tiraDeBase(r.juego, numeros?.hoy?.[r.juego]) || null
  }
  return resultados
}

export async function compartirMiDia({ dia, extra = {} }) {
  const [{ abrirHojaCompartir }, numeros] = await Promise.all([import('./compartir-hoja.js'), misNumeros(1).catch(() => null)])
  const resultados = resultadosDeHoy(dia, numeros, extra)
  const rachaDias = Number(numeros?.racha) || 0
  const numero = numeroDelDia(dia)
  const filas = filasDeMiDia(resultados).map((f) => ({ ...f, vacios: TAMANO[f.juego] || 3 }))
  return abrirHojaCompartir({
    titulo: 'Mi día en PokeDoc',
    texto: textoDeMiDia({ dia, resultados, rachaDias }),
    nombre: `mi-dia-${numero}`,
    imagen: async (formato) => {
      const { pintarMiDia } = await import('./reto-imagen.js')
      return pintarMiDia(document.createElement('canvas'), { numero, filas, racha: rachaDias, enlace: ENLACE_RETOS, formato })
    },
  })
}

// «Mi mes» (873): desde el calendario de /retos, con los números que ya
// tiene la pantalla (`misNumeros(60)`), sin volver a pedirlos.
export async function compartirMiMes({ hoy, numeros, n = 30 }) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const datos = { dias: numeros?.dias || {}, hoy, n, jugados: numeros?.jugados || 0, mejorRacha: numeros?.mejorRacha || 0, perfectos: numeros?.diasPerfectos || 0 }
  return abrirHojaCompartir({
    titulo: 'Mi mes en PokeDoc',
    texto: textoDeMiMes(datos),
    nombre: `mi-mes-${hoy}`,
    imagen: async (formato) => {
      const { pintarMiMes } = await import('./reto-imagen.js')
      return pintarMiMes(document.createElement('canvas'), {
        dias: datos.dias, hoy, n, enlace: ENLACE_RETOS, formato,
        cifras: [[datos.jugados, 'retos jugados'], [datos.mejorRacha, 'tu mejor racha'], [datos.perfectos, 'días perfectos']],
      })
    },
  })
}
