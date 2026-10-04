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
// ── UNA VEZ AL DÍA, Y EL PORQUÉ IMPORTA (tanda 510) ──
//
// Estaba cada hora con un freno que preguntaba «¿queda algún set sin
// emparejar?». Y ese freno NO FRENA NUNCA, por el mismo motivo que el del
// relleno: **siempre quedan sets que no se pueden emparejar** —las promos,
// que ningún catálogo cuenta igual—, así que la respuesta es «sí» para
// siempre. 3 créditos por hora × 24 × 30 = **2.160 al mes**, de 5.000, para
// no cambiar nada.
//
// Es la tercera vez esta noche con la misma forma: un freno que pregunta
// «¿queda trabajo?» no frena si parte del trabajo es IMPOSIBLE. O se cuenta
// cuántas veces se ha intentado, o se baja la frecuencia. Aquí basta con lo
// segundo: los sets nuevos salen cada pocas semanas, así que mirarlo una vez
// al día sobra — 90 créditos al mes en vez de 2.160.
//
// El emparejamiento inicial (167 sets) ya se hizo la noche del 2026-10-04.

// El INFORME de la pasada, donde lo lee el panel (tanda 531). Sin esto, el
// occidental lleva desde anoche con 24 sets sin emparejar y ninguna forma
// de saber por qué sin entrar en los registros de Netlify — que es tanto
// como no tenerla.
const CLAVE_ESTADO = 'sets-west'

async function guardarInforme(clave, valor) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/scrydex_estado`, {
      method: 'POST',
      headers: {
        apikey: clave,
        authorization: `Bearer ${clave}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]),
    })
  } catch {
    // Que no se pueda apuntar el informe no tira la pasada: el trabajo ya
    // está hecho y escrito donde importa.
  }
}

export default async () => {
  try {
    // Si no queda ni un set sin emparejar, ni se le pregunta a Scrydex.
    // Es gratis comprobarlo —es nuestra base— y evita la pasada entera el
    // día que todo esté hecho.
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (clave && !(await quedaAlgoPorEmparejar(clave))) {
      return new Response(JSON.stringify({ hecho: true, creditos: 0, porque: 'no queda ningún set sin emparejar' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
    const r = await procesarSets({ mercado: 'WEST', idioma: 'en', escribir: true })
    const resumen = {
      escritas: r.cuerpo?.escritas,
      confirmados: r.cuerpo?.confirmados,
      porQueSeConfirman: r.cuerpo?.porQueSeConfirman,
      sinEmparejar: r.cuerpo?.sinEmparejar,
      porQueNoSeEmparejan: r.cuerpo?.porQueNoSeEmparejan,
      // LOS EJEMPLOS SON LO ÚNICO QUE SE PUEDE ARREGLAR: «sin emparejar:
      // 24» no dice nada; «svp — ninguno suyo con esa fecha y esa cuenta»
      // dice por dónde se empieza.
      ejemplosSinEmparejar: r.cuerpo?.ejemplosSinEmparejar,
      rechazados: r.cuerpo?.rechazados,
      sinConfirmar: r.cuerpo?.sinConfirmar,
      cuadraLaCuenta: r.cuerpo?.cuadraLaCuenta,
      cuando: new Date().toISOString(),
    }
    if (clave) await guardarInforme(clave, resumen)
    return new Response(JSON.stringify(resumen), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    const fallo = String(e?.message || e)
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (clave) await guardarInforme(clave, { error: fallo.slice(0, 300), cuando: new Date().toISOString() })
    return new Response(JSON.stringify({ error: fallo }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const config = { schedule: '7 7 * * *' }
