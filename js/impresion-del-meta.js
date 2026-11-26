// La impresión de cada carta que llevan los mazos de verdad (tanda 590 para
// las repeticiones; desde la 1460, para todo lo que se resuelve por el
// NOMBRE: el constructor con una lista sin códigos, el laboratorio y las
// repeticiones).
//
// Ibai: «hay cartas del formato estándar que PokeDoc no usa en su forma
// estándar como en Limitless». El resolutor por nombre se quedaba con la
// impresión legal más NUEVA, y desde que las de TCGGO tienen ficha (1281)
// esa era muchas veces la de un Prize Pack o la del 30 aniversario: la
// Boss's Orders, la Ultra Ball o el Fezandipiti de una repetición salían con
// el sello del sobre de premio. Limitless enseña la que más se juega, y eso
// lo sabemos: `meta_cartas_dia` cuenta, por carta, colección y número, en
// cuántos mazos de sus listas sale cada día.
//
// Vivía en repeticiones/impresion.js (las cuentas) y repeticiones/datos.js
// (la consulta); se muda aquí porque ahora lo usa también el constructor, y
// aquellos lo reexportan.
import { supabase } from './supabase.js'

const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
const numeroPlano = (n) => String(n ?? '').trim().toLowerCase().replace(/^0+(?=\w)/, '')

// De cada nombre (plano), la impresión que más mazos suma.
// `filas`: [{ nombre, seccion, set_codigo, numero, mazos }] (el nombre, el
// inglés). Con `seccion`, solo las de esa sección (o las que no la dicen): un
// Pokémon no se cuenta con un Entrenador que se llame igual.
export function masJugadas(filas, { seccion = null } = {}) {
  const suma = new Map()
  for (const f of filas || []) {
    if (seccion && f?.seccion && f.seccion !== seccion) continue
    const set = String(f?.set_codigo || '').trim().toUpperCase()
    const numero = numeroPlano(f?.numero)
    if (!f?.nombre || !set || !numero) continue
    const clave = `${plano(f.nombre)}|${set}|${numero}`
    const x = suma.get(clave) || { nombre: plano(f.nombre), set, numero: String(f.numero).trim(), mazos: 0 }
    x.mazos += Number(f.mazos) || 0
    suma.set(clave, x)
  }
  const mejor = new Map()
  for (const x of suma.values()) {
    const ya = mejor.get(x.nombre)
    if (!ya || x.mazos > ya.mazos) mejor.set(x.nombre, x)
  }
  return mejor
}

// La sección del meta de una carta del catálogo (null si no se sabe).
export const seccionDeCarta = (c) => ({ pokemon: 'pokemon', trainer: 'trainer', energy: 'energy' })[String(c?.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || null

// La de un nombre, con la misma normalización que `masJugadas`.
export const laMasJugada = (mejor, nombre) => (nombre ? mejor?.get(plano(nombre)) || null : null)

// ¿Es esta carta (su código de colección y su número) ESA impresión?
export const esLaImpresion = (codigo, numero, buena) =>
  Boolean(codigo && buena) && String(codigo).toUpperCase() === buena.set && numeroPlano(numero) === numeroPlano(buena.numero)

// Las filas de los últimos `dias` para unos nombres: UNA consulta por
// nombre, todas a la vez. Las filas vuelven de la más grande a la más
// pequeña y Supabase corta a 1.000 (la 808): juntando nombres, la Boss's
// Orders —que va en casi todos los mazos, cada día— se comía el sitio de las
// demás y el Iono se quedaba con la de su Prize Pack. 300 filas de un nombre
// bastan para saber cuál es la suya. De todas las secciones desde la 1460
// (antes, solo Pokémon): los Entrenadores también tienen su impresión de
// Prize Pack. Si la tabla no está o falla, ninguna: se queda la que eligió el
// resolutor.
export async function impresionesDelMeta(nombres, { dias = 60 } = {}) {
  const lista = [...new Set((nombres || []).filter(Boolean))]
  if (!lista.length) return []
  const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10)
  const filas = await Promise.all(
    lista.map((nombre) =>
      supabase
        .from('meta_cartas_dia')
        .select('nombre,seccion,set_codigo,numero,mazos')
        .eq('nombre', nombre)
        .gte('dia', desde)
        .order('mazos', { ascending: false })
        .limit(300)
        .then(({ data, error }) => (error ? [] : data || []))
        .catch(() => [])
    )
  )
  return filas.flat()
}
