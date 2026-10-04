import { procesar as procesarSets } from './scrydex-sets.mjs'

// Los logos que falten, SOLOS y cada hora (tanda 509).
//
// La 507 dejó el trabajo hecho pero detrás de un botón, y un botón
// necesita a alguien delante. PINGU se fue a la cama pidiendo «todos los
// logos posibles» para por la mañana, así que lo mismo con un reloj.
//
// Se puede escribir sin ensayo porque la primera pasada YA se miró a mano:
// 167 sets, fila a fila, con el valor de antes al lado. Lo que quedaba
// fuera eran 43 sets que no se emparejaban o no se confirmaban, y la 508
// arregló las dos causas (el `ex7` que el código rechazaba mal, y el
// rescate por id de los 37 que la fecha y la cuenta no encontraban).
//
// Y sigue sin poder hacer daño: solo escribe sets con el emparejamiento
// CONFIRMADO, no pisa ninguna columna nuestra, y lo de TCGdex se queda
// detrás como respaldo.
//
// Cada hora y no cada cinco minutos: cuando no queda nada por emparejar
// gasta 3 créditos por pasada y no cambia nada.

export default async () => {
  try {
    const r = await procesarSets({ mercado: 'WEST', idioma: 'en', escribir: true })
    return new Response(JSON.stringify({
      escritas: r.cuerpo?.escritas,
      confirmados: r.cuerpo?.confirmados,
      porQueSeConfirman: r.cuerpo?.porQueSeConfirman,
      sinEmparejar: r.cuerpo?.sinEmparejar,
      porQueNoSeEmparejan: r.cuerpo?.porQueNoSeEmparejan,
      rechazados: r.cuerpo?.rechazados,
      sinConfirmar: r.cuerpo?.sinConfirmar,
    }), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const config = { schedule: '7 * * * *' }
