import { procesar as procesarSets } from './scrydex-sets.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const MERCADO = 'JP'
const CLAVE_ESTADO = 'sets-jp'

// Los logos JAPONESES, que son los que de verdad no existían (tanda 530).
//
// De los 341 sets asiáticos, probando el fichero a mano en TCGdex existe
// **UNO** (M4) y ningún símbolo. O sea que la biblioteca japonesa lleva
// desde que se abrió con los huecos a la vista y no era culpa nuestra: no
// estaban publicados.
//
// La sonda de la 528 contestó que Scrydex SÍ tiene japonés: **231
// expansiones**, y su primera trae esto —copiado de la respuesta de verdad,
// no de lo que yo suponga (norma de la 501)—:
//
//   "id": "mf_ja", "code": "MF", "total": 49, "printed_total": 40,
//   "name": "30th セレブレーション プレミアムデッキセット エーフィ・ブラッキー",
//   "logo": "https://images.scrydex.com/pokemon/mf_ja-logo/logo",
//   "symbol": "https://images.scrydex.com/pokemon/mf_ja-symbol/symbol",
//   "translation": { "en": { "name": "30th Celebration Premium Deck Set: …" } },
//   "language_code": "JA", "release_date": "2026/09/16"
//
// Dos cosas de ahí cambian el emparejamiento y están en `scrydex.mjs`:
// **su id lleva el idioma pegado** (`mf_ja` es nuestro `mf`), y **el nombre
// del set lo publican los dos en japonés**, así que confirmar un par sale
// gratis — sin eso, confirmar 231 sets costaría 231 créditos.
//
// ── LO QUE CUESTA ──
//
// Sus 231 expansiones en páginas de 100 son 3 créditos, y el emparejamiento
// no gasta nada más: los pares se confirman con lo que ya viene en esa misma
// respuesta. Una vez al día, como el occidental: 90 créditos al mes.
//
// ── Y NO PUEDE HACER DAÑO ──
//
// Escribe `logo_scrydex` y `symbol_scrydex`, que son columnas SUYAS, y solo
// de los pares CONFIRMADOS. Lo de TCGdex se queda intacto y por delante como
// respaldo. Un par que no se confirma sale en el informe y no toca la base:
// emparejar propone, verificar dispone (tanda 508).

// ── CADA CUÁNTO SE VUELVE A MIRAR, QUE ES EL FRENO BUENO ──
//
// «¿Queda algún set sin emparejar?» no frena —siempre quedará alguno: de
// los 186 sets japoneses de TCGdex hay 68 que no tienen ni una carta—, así
// que el freno es el TIEMPO, igual que en los logos occidentales. Pero un
// `schedule` diario tiene un problema el primer día: si la hora ya pasó, lo
// que PINGU está esperando ahora llega mañana.
//
// Así que va cada diez minutos y se frena a sí misma por el informe: si ya
// hay uno de hace menos de veinte horas, no se gasta nada. La primera
// pasada entra hoy; a partir de ahí, una al día.
const HORAS_ENTRE_PASADAS = 20

async function informeReciente(clave) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`,
      { headers: { apikey: clave, authorization: `Bearer ${clave}` } },
    )
    if (!res.ok) return null
    const valor = (await res.json())?.[0]?.valor
    const cuando = valor?.cuando
    if (!cuando) return null
    const horas = (Date.now() - Date.parse(cuando)) / 3_600_000
    if (!Number.isFinite(horas) || horas >= HORAS_ENTRE_PASADAS) return null
    // ── UNA PASADA QUE AVANZÓ NO ESPERA VEINTE HORAS (tanda 538) ──
    //
    // La primera pasada de verdad emparejó 120 sets, confirmó 44… y dejó
    // **62 sin tiempo**: una función de Netlify se muere a los 30 segundos
    // y confirmar un par cuesta una petición. Esos 62 no son un fallo, son
    // trabajo a medias — y con el freno de veinte horas se habrían ido
    // repartiendo a lo largo de UNA SEMANA.
    //
    // Así que el freno no es «cuánto hace», es «¿avanzó?»: mientras la
    // última pasada escribiera algo o se quedara sin tiempo, se sigue.
    // Cuando una pasada no escribe nada y no deja nada a medias, el
    // trabajo está hecho y ahí sí se duerme un día.
    const avanzo = Number(valor?.escritas) > 0 || Number(valor?.sinTiempo) > 0
    return avanzo ? null : { cuando, horas }
  } catch {
    // Si no se puede preguntar, se deja pasar: el trabajo de una pasada
    // son 3 créditos, y quedarse sin hacerlo por un fallo de red sería
    // pararlo por el motivo equivocado.
    return null
  }
}

async function quedaAlgoPorEmparejar(clave) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tcg_sets?select=id&market=eq.${MERCADO}&scrydex_id=is.null&limit=1`,
      { headers: { apikey: clave, authorization: `Bearer ${clave}` } },
    )
    if (!res.ok) return true
    return (await res.json()).length > 0
  } catch {
    // Un fallo de red no es un «ya está»: se intenta, que el freno de
    // verdad es la frecuencia.
    return true
  }
}

// El informe de la pasada, donde lo lee el panel (tanda 530). El relleno y
// la sonda ya dejan el suyo ahí, así que «¿Cómo va el relleno?» lo enseña
// sin tocar /admin.
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
    // Que no se pueda apuntar el informe no puede tirar la pasada: el
    // trabajo ya está hecho y escrito donde importa.
  }
}

export default async () => {
  try {
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    const reciente = clave ? await informeReciente(clave) : null
    if (reciente) {
      return new Response(JSON.stringify({
        creditos: 0,
        porque: `ya se miró hace ${reciente.horas.toFixed(1)} h; se vuelve a mirar cada ${HORAS_ENTRE_PASADAS}`,
        ultimaPasada: reciente.cuando,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (clave && !(await quedaAlgoPorEmparejar(clave))) {
      return new Response(JSON.stringify({ hecho: true, creditos: 0, porque: 'no queda ningún set japonés sin emparejar' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
    const r = await procesarSets({ mercado: MERCADO, idioma: 'ja', escribir: true })
    const resumen = {
      escritas: r.cuerpo?.escritas,
      confirmados: r.cuerpo?.confirmados,
      porQueSeConfirman: r.cuerpo?.porQueSeConfirman,
      sinEmparejar: r.cuerpo?.sinEmparejar,
      porQueNoSeEmparejan: r.cuerpo?.porQueNoSeEmparejan,
      rechazados: r.cuerpo?.rechazados,
      sinConfirmar: r.cuerpo?.sinConfirmar,
      // LO QUE QUEDÓ A MEDIAS, que es lo que decide si se vuelve a pasar
      // ya o dentro de un día (tanda 538). Sin este número, el informe
      // enseña 44 escritas de 120 emparejadas y no dice que falten 62 por
      // tiempo — que es información distinta de «no se han podido».
      sinTiempo: r.cuerpo?.sinTiempo,
      susExpansiones: r.cuerpo?.susExpansiones,
      suListadoTraeLogos: r.cuerpo?.suListadoTraeLogos,
      emparejados: r.cuerpo?.emparejados,
      porQueSeEmparejan: r.cuerpo?.porQueSeEmparejan,
      ejemplosSinEmparejar: r.cuerpo?.ejemplosSinEmparejar,
      cuadraLaCuenta: r.cuerpo?.cuadraLaCuenta,
      cuando: new Date().toISOString(),
    }
    if (clave) await guardarInforme(clave, resumen)
    return new Response(JSON.stringify(resumen), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    // ── UN FALLO QUE NO DEJA RASTRO ES UN SILENCIO (tanda 531) ──
    //
    // Esto se vio en el panel de PINGU: la fila `sets-jp` no estaba, y eso
    // puede querer decir tres cosas distintas —todavía no ha corrido, ha
    // corrido y ha fallado, o ha corrido y no ha podido escribir el
    // informe— que desde fuera se ven EXACTAMENTE IGUAL. Es la familia de
    // la 510 otra vez: un hueco que se lee como una respuesta.
    //
    // Así que el fallo también se apunta, con su hora. Y va con
    // `cuando` como todos, lo que además hace que el freno de las veinte
    // horas cuente igual para un fallo: una pasada que revienta siempre no
    // puede volver a intentarlo cada diez minutos.
    const fallo = String(e?.message || e)
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (clave) await guardarInforme(clave, { error: fallo.slice(0, 300), cuando: new Date().toISOString() })
    return new Response(JSON.stringify({ error: fallo }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

// Cada diez minutos, y el freno de arriba hace que eso signifique «una al
// día» en cuanto haya corrido la primera vez. Lo que se gana es que la
// primera entra HOY y no mañana a las siete.
export const config = { schedule: '*/10 * * * *' }
