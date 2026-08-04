import { plegarTexto } from './texto.js'

// Consultas de búsqueda contra la columna plegada (`search_norm`), con
// vuelta atrás si esa columna todavía no existe.
//
// POR QUÉ LA VUELTA ATRÁS: la columna la crea
// supabase-migration-busqueda-acentos.sql, y las migraciones se ejecutan
// a mano en el SQL Editor de Supabase. Entre que se despliega este código
// y se ejecuta la migración, la columna no está. Sin esto, el buscador
// devolvería "no se encontraron resultados" para todo — un fallo mudo,
// que es el peor tipo. Con esto, sigue buscando como antes (sin plegar
// acentos) hasta que la migración esté puesta.
//
// Cuando la migración lleve tiempo hecha, esto se puede quitar; mientras
// tanto cuesta una consulta fallida por búsqueda solo en ese hueco.

// PostgREST devuelve 42703 (undefined_column) de Postgres cuando se filtra
// por una columna que no existe.
export function faltaLaColumna(error) {
  if (!error) return false
  return error.code === '42703' || /search_norm/.test(`${error.message || ''} ${error.details || ''}`)
}

export async function conVueltaAtras(consultaPlegada, consultaAntigua) {
  const resultado = await consultaPlegada()
  if (!faltaLaColumna(resultado.error)) return resultado
  console.warn(
    '[busqueda] Falta la columna search_norm: se busca sin plegar acentos. ' +
      'Ejecuta supabase-migration-busqueda-acentos.sql en Supabase.'
  )
  return consultaAntigua()
}

// Lo que se manda a la base: plegado y sin los caracteres que PostgREST
// interpreta (el % es comodín; la coma y los paréntesis separan filtros).
export function terminoParaFiltro(consulta) {
  return plegarTexto(consulta).replace(/[,()%]/g, ' ').trim()
}
