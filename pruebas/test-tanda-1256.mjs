// Tandas 1254–1256 — las cuentas del Mostrador, sin navegador: lo que se
// cobra de una línea de Vender («Vendido por» vacío es su precio, no cero),
// la suma de abajo (a tu precio, rebaja solo por debajo, cobras, ganas), lo
// que pagas por un tanto por ciento (a los 10 céntimos) y la caja del día por
// forma de pago con el efectivo que debería haber.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { precioCobrado, cuentaDeMostrador, pagasPorPct, cuentaDeCaja, PAGOS_VENTA, PAGOS_COMPRA, NOMBRE_DE_PAGO } = await import(`${RAIZ}/js/tiendas-puro.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Vender ──')
check('«Vendido por» vacío es el precio de la línea', precioCobrado({ lista: 250, cobrar: null }) === 250 && precioCobrado({ lista: 250, cobrar: '' }) === 250)
check('  …lo escrito manda, también el cero', precioCobrado({ lista: 250, cobrar: 240 }) === 240 && precioCobrado({ lista: 250, cobrar: 0 }) === 0)
check('  …sin precio ni escrito, no se sabe (null, no 0)', precioCobrado({ lista: null, cobrar: null }) === null)
const c = cuentaDeMostrador([
  { vender: 2, lista: 250, cobrar: 240, coste: 125 },
  { vender: 1, lista: 30, cobrar: 35, coste: null },
])
check('la suma: a tu precio 530, rebaja 20 (lo de encima no resta), cobras 515', c.aTuPrecio === 530 && c.rebaja === 20 && c.cobras === 515, JSON.stringify(c))
check('  …y ganas solo de lo que tiene coste (2 × 115)', c.beneficio === 230, JSON.stringify(c))
check('cuatro formas de pago al vender, con tarjeta; al comprar, «Otro» y sin tarjeta', PAGOS_VENTA.map(([v]) => v).join() === 'efectivo,tarjeta,bizum,paypal' && PAGOS_COMPRA.map(([v]) => v).join() === 'efectivo,bizum,paypal,otro' && NOMBRE_DE_PAGO.paypal === 'PayPal')

console.log('── Comprar ──')
check('pagas el 60 % de 41,20: 24,70 (a los 10 céntimos)', pagasPorPct(41.2, 60) === 24.7, pagasPorPct(41.2, 60))
check('  …el 50 % de 72: 36', pagasPorPct(72, 50) === 36)
check('  …sin lo que vale, no se sabe', pagasPorPct(null, 60) === null && pagasPorPct('', 60) === null && pagasPorPct(0, 60) === null)

console.log('── La caja de hoy ──')
const k = cuentaDeCaja(
  [
    { ticket: 'a', unidades: 1, precio: 240, coste: 125, pago: 'efectivo', precio_lista: 250 },
    { ticket: 'a', unidades: 1, precio: 10, coste: 4, pago: 'efectivo', precio_lista: 10 },
    { ticket: 'b', unidades: 2, precio: 30, coste: null, pago: 'tarjeta', precio_lista: 30 },
    { ticket: 'c', unidades: 1, precio: 5, coste: 1, pago: null },
  ],
  [
    { ticket: 'x', unidades: 2, coste: 20, pago: 'efectivo' },
    { ticket: 'y', unidades: 1, coste: 15, pago: 'bizum' },
  ],
)
check('vendido 315 en 3 ventas (las líneas de un ticket son una venta)', k.vendido === 315 && k.ventas === 3, JSON.stringify(k))
check('  …comprado 55 en 2 compras', k.comprado === 55 && k.compras === 2)
check('  …ganado 125 con una sin coste fuera, y 10 rebajados', k.ganado === 125 && k.sinCoste === 1 && k.rebajas === 10, JSON.stringify(k))
check('  …por forma de pago, y lo que no lo dice en «sin»', k.metodos.efectivo.entra === 250 && k.metodos.efectivo.sale === 40 && k.metodos.tarjeta.entra === 60 && k.metodos.bizum.sale === 15 && k.metodos.sin.entra === 5, JSON.stringify(k.metodos))
check('  …y el efectivo que debería haber: 250 − 40 = 210', k.efectivo === 210)
const vacia = cuentaDeCaja([], [])
check('sin nada, todo a cero y sin formas de pago', vacia.vendido === 0 && vacia.efectivo === 0 && Object.keys(vacia.metodos).length === 0)

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
