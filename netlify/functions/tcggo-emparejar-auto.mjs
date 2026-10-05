// El emparejador, solo (tanda 640). PINGU: «todo esto no puedes hacerlo tú
// en vez de darme botones». Cada hora corre la misma `procesar` de
// `tcggo-emparejar` sin que nadie pulse nada: hace los sets que aún no
// tienen expansión decidida (los nuevos que vayan saliendo) y nada más —
// un set hecho no se vuelve a pedir—. El botón de /admin sigue ahí para
// rehacer uno a mano («solo estos sets»).
//
// VARIABLES DE ENTORNO: las de tcggo-emparejar.
import { procesar } from './tcggo-emparejar.mjs'

export default async () => {
  const r = await procesar({ peticiones: 60 })
  if (r.estado !== 200) console.warn('tcggo-emparejar-auto:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r.cuerpo), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, a y 41: lo normal es que no quede ningún set y cueste cero
// peticiones; cuando sale un set nuevo, lo coge en una hora.
export const config = { schedule: '41 * * * *' }
