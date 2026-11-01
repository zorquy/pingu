// Los precios de Cardmarket del catálogo JAPONÉS hecho a mano (tanda 1158).
//
// PINGU, con el pack de McDonald's de 2002 delante (18 cartas que no tienen
// ni TCGGO ni TCGdex): «luego meto los enlaces a Cardmarket, pero ¿cómo
// cogemos los precios?». Con lo mismo que `cardmarket-precios`: la guía
// pública diaria de Cardmarket, por el id de producto que se pone en /admin
// → Colecciones → la carta → «Id de producto en Cardmarket». Solo para lo
// que TCGGO no pone (`origen` mano o relleno): el resto del japonés lleva
// el precio de TCGGO y no se pisan. Estado del día: `cardmarket_guia_jp`.
import { procesar } from './cardmarket-precios.mjs'

export default async function handler() {
  const r = await procesar({ mercado: 'JP' })
  if (!r.ok) console.warn('cardmarket-precios-jp:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, a y 47 (la occidental va a y 23): una vez puesta la guía del
// día, la pasada se sale en una consulta.
export const config = { schedule: '47 * * * *' }
