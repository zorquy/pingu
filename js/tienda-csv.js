// Lo puro de importar el stock de una tienda (tanda 1068): lo que el
// importador de la colección no lee y el paso a filas de `tienda_stock`.
// Sin base, para usarlo en /tienda y probarlo en Node.
import { dineroDe } from './mi-coleccion/importar-csv.js'

// Lo que el importador de la colección no lee: el precio de venta, dónde
// está y si se ve. Por la línea del fichero (`entrada.fila`).
export function extrasDeFila(filas, columnas) {
  const celda = (fila, campo) => (columnas[campo] === undefined ? '' : String(fila[columnas[campo]] ?? ''))
  return new Map(filas.map((fila, i) => {
    const visible = celda(fila, 'visible').trim().toLowerCase()
    return [i + 2, {
      precio: dineroDe(celda(fila, 'precioVenta')),
      ubicacion: celda(fila, 'ubicacion').trim().slice(0, 60) || null,
      visible: !['no', 'n', 'false', '0', 'oculta', 'oculto'].includes(visible),
    }]
  }))
}

// De lo emparejado a filas de `tienda_stock`.
export function filasDeStock(listas, extras, tiendaId) {
  return listas.map(({ entrada, linea }) => {
    const x = extras.get(entrada.fila) || {}
    return {
      tienda_id: tiendaId,
      card_id: linea.card_id,
      market: linea.market === 'JP' ? 'JP' : 'WEST',
      idioma: linea.idioma,
      estado: linea.estado,
      variante: linea.variante || 'normal',
      gradeo: linea.gradeo || null,
      unidades: linea.cantidad,
      coste: linea.precio_compra ?? null,
      precio: x.precio ?? null,
      ubicacion: x.ubicacion ?? null,
      visible: x.visible !== false,
      notas: linea.notas || null,
    }
  })
}
