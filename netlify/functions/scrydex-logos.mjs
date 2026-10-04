import { procesar as procesarSets } from './scrydex-sets.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// ── EL FRENO ──
//
// Sin él esto son 3 créditos por hora = 2.160 al mes para no cambiar
// nada, con 5.000 de presupuesto. Así que primero se pregunta a NUESTRA
// base —que es gratis— si queda algún set sin emparejar; si no queda, no
// se le pregunta nada a Scrydex.
//
// Y los que no se emparejan nunca (promos que su catálogo no tiene) no
// bloquean: el repaso se hace de todas formas una vez al día, que son 3
// créditos, por si sale un set nuevo.
async function quedaAlgoPorEmparejar(clave) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tcg_sets?select=id&market=eq.WEST&scrydex_id=is.null&limit=1`,
      { headers: { apikey: clave, authorization: `Bearer ${clave}` } },
    )
    if (!res.ok) return true
    return (await res.json()).length > 0
  } catch {
    return true
  }
}

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
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    // A la hora en punto del repaso diario se mira igual, por si hay un
    // set nuevo. El resto de las horas, solo si falta algo.
    const esElRepaso = new Date().getUTCHours() === 7
    if (clave && !esElRepaso && !(await quedaAlgoPorEmparejar(clave))) {
      return new Response(JSON.stringify({ hecho: true, creditos: 0, porque: 'no queda ningún set sin emparejar' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
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
