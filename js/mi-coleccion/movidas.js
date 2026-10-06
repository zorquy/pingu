// Las cartas de tu colección que más se han movido esta semana (663).
//
// De la foto diaria del histórico (`tcg_card_history`, que desde la 643
// guarda cada noche el precio de las cartas que alguien TIENE) salen, por
// cada carta tuya, el primer y el último precio de la ventana en el idioma
// de tu copia; y de ahí las que más suben y las que más bajan. Puro, sin
// DOM: lo pinta /mi-coleccion en el Panel.
import { valorDeFila } from '../carta-historial.js'

const ms = (dia) => new Date(`${String(dia).slice(0, 10)}T00:00:00Z`).getTime()

// `lineas`: tus líneas (card_id, idioma). `filas`: las del histórico, de
// cualquier carta. `buscaCarta(linea)`: la carta de una línea.
// Devuelve [{ carta, idioma, antes, ahora, cambio, pct }] ordenadas por
// porcentaje, las que suben primero. Una carta con dos idiomas tuyos sale
// una vez por idioma solo si los precios difieren; si no, una.
export function movidasDe(lineas, filas, buscaCarta, { minimoDias = 2, minimoEuros = 0.05 } = {}) {
  const porCarta = new Map()
  for (const f of filas || []) {
    if (!f?.card_id || !/^\d{4}-\d{2}-\d{2}/.test(String(f.dia))) continue
    if (!porCarta.has(f.card_id)) porCarta.set(f.card_id, [])
    porCarta.get(f.card_id).push(f)
  }
  for (const lista of porCarta.values()) lista.sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
  const vistas = new Set()
  const fuera = []
  for (const l of lineas || []) {
    const idioma = l?.idioma || 'es'
    const clave = `${l?.card_id}|${idioma}`
    if (!l?.card_id || vistas.has(clave)) continue
    vistas.add(clave)
    const serie = (porCarta.get(l.card_id) || []).map((f) => ({ dia: f.dia, valor: valorDeFila(f, idioma) })).filter((p) => p.valor !== null)
    if (serie.length < 2) continue
    const primero = serie[0]
    const ultimo = serie[serie.length - 1]
    if ((ms(ultimo.dia) - ms(primero.dia)) / 86_400_000 < minimoDias - 1) continue
    const cambio = ultimo.valor - primero.valor
    if (Math.abs(cambio) < minimoEuros) continue
    const carta = typeof buscaCarta === 'function' ? buscaCarta(l) : null
    if (!carta) continue
    // La misma carta en dos idiomas con el mismo movimiento no se repite.
    if (fuera.some((x) => x.carta === carta && Math.abs(x.cambio - cambio) < 0.005)) continue
    fuera.push({ carta, idioma, antes: primero.valor, ahora: ultimo.valor, cambio, pct: primero.valor > 0 ? (cambio / primero.valor) * 100 : null })
  }
  return fuera.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
}

// Las N que más suben y las N que más bajan, en ese orden.
export function extremos(movidas, n = 3) {
  const suben = movidas.filter((m) => m.cambio > 0).slice(0, n)
  const bajan = [...movidas].reverse().filter((m) => m.cambio < 0).slice(0, n)
  return { suben, bajan }
}
