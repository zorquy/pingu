// ── Lo que te costó contra lo que vale (tanda 428) ──
//
// La cabecera lleva desde la 374 una cifra de «Pagado» al lado de «Valor
// estimado», y esa pareja MIENTE: lo pagado solo se sabe de las cartas en
// las que lo has apuntado —puede que tres de cuatrocientas— y el valor es
// el de TODAS. Leídas juntas parecen un balance y dicen «has ganado 280 €»
// cuando lo único cierto es que te costaron 20.
//
// Un balance solo se puede hacer sobre las MISMAS cartas en los dos
// lados. Eso es lo que calcula esto, y por eso devuelve además cuántas
// son: una ganancia sin saber sobre cuántas cartas es un número suelto.
//
// Va en su propio fichero y sin DOM para poder probarlo en Node: son
// cuentas de dinero, y una cuenta mal hecha no da error nunca.

// `valorDe(linea)` devuelve lo que vale esa línea ENTERA (copias
// incluidas) o algo que no es un número si no se sabe. Se recibe de fuera
// porque mezcla el precio manual, el de Cardmarket y el del momento, y
// nada de eso es cosa de un balance.
export function balanceDeCompra(lineas, valorDe) {
  const conPrecio = (lineas || []).filter((l) => Number(l?.precio_compra) > 0)
  let pagado = 0
  let valor = 0
  let copias = 0
  // De las que SÍ tienen precio de compra, puede que alguna no tenga
  // precio de mercado. Esas no se pueden poner en el otro lado de la
  // balanza, así que se cuentan aparte en vez de valer cero: un cero
  // diría que no valen nada, y lo que pasa es que no se sabe.
  let sinValorar = 0
  for (const l of conPrecio) {
    const cuantas = Number(l.cantidad) || 1
    const v = Number(valorDe ? valorDe(l) : NaN)
    if (!Number.isFinite(v) || v <= 0) {
      sinValorar += cuantas
      continue
    }
    pagado += Number(l.precio_compra) * cuantas
    valor += v
    copias += cuantas
  }
  return {
    copias,
    lineas: conPrecio.length - 0,
    pagado,
    valor,
    diferencia: valor - pagado,
    sinValorar,
    // Sin ninguna carta comparable no hay balance que enseñar. Es la
    // regla de los tres estados (tanda 319): «no se sabe» no es «cero».
    hayBalance: copias > 0,
  }
}
