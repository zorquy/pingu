// Tanda 528 — la pregunta japonesa la hace el servidor, no PINGU.
//
// PINGU: «ya te dije anoche que trajeses todas las cartas japonesas». Y lo
// que yo le contesté fue que pulsara un botón de /admin para averiguar si
// Scrydex sirve japonés. Mal: ese botón lo tiene que pulsar una persona, y
// una persona no está delante a las cuatro de la mañana — que es
// exactamente el motivo por el que el relleno es una función programada.
//
// Lo que esto NO hace, y es la mitad de la tanda: emparejar ni escribir.
// Eso sería inventarme su respuesta, y la 501 ya costó un emparejamiento
// entero escrito contra un formato de fecha que yo supuse.
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-japones.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

// Su expansión japonesa, SI la hubiera, con la forma que tiene la inglesa
// —que esa sí la hemos visto de verdad (tanda 500)—.
const UNA_JAPONESA = {
  id: 'sv1a', name: 'トリプレットビート', series: 'Scarlet & Violet', code: 'SV1a',
  total: 73, language: 'Japanese', language_code: 'JA', release_date: '2023/03/10',
}

const doble = ({ ok = true, status = 200, cuerpo = null, estadoInicial = {} } = {}) => {
  const guardado = []
  let peticiones = 0
  return {
    guardado,
    cuantasPeticiones: () => peticiones,
    estadoImpl: async () => estadoInicial,
    guardarEstadoImpl: async (v) => { guardado.push(v) },
    fetchImpl: async (url) => {
      peticiones++
      return {
        ok, status,
        text: async () => JSON.stringify(cuerpo ?? { data: [UNA_JAPONESA], total_count: 60 }),
        url,
      }
    },
  }
}

console.log('── 1. Si contesta con expansiones japonesas ──')
{
  const d = doble()
  const r = await procesar({ env: ENV, ...d })
  check('lo dice', r.cuerpo.hayJapones === true, JSON.stringify(r.cuerpo.hayJapones))
  check('y cuántas', r.cuerpo.cuantas === 60, r.cuerpo.cuantas)
  check('cuesta UN crédito', r.cuerpo.creditos === 1, r.cuerpo.creditos)
  // EL FIXTURE DE MAÑANA: su respuesta, entera y sin tocar. Sin esto, el
  // emparejamiento se escribiría contra lo que yo me imagine (norma 501).
  check('guarda su primera expansión TAL CUAL', d.guardado.at(-1)?.primera?.name === 'トリプレットビート', JSON.stringify(d.guardado.at(-1)?.primera))
  check('  …con su código y su fecha, que es por donde se empareja',
    d.guardado.at(-1)?.primera?.code === 'SV1a' && d.guardado.at(-1)?.primera?.release_date === '2023/03/10',
    JSON.stringify(d.guardado.at(-1)?.primera))
  check('y deja fecha de cuándo se preguntó', !!d.guardado.at(-1)?.preguntadoEn)
  // LO QUE NO HACE: tocar la base. Ni un set, ni una carta.
  check('NO empareja ni escribe nada más que su propio estado', d.guardado.length === 1, JSON.stringify(d.guardado))
}

console.log('── 2. Si NO lo sirve, también es una respuesta ──')
{
  const d = doble({ ok: false, status: 404, cuerpo: { error: 'not found' } })
  const r = await procesar({ env: ENV, ...d })
  check('lo dice sin adornos', r.cuerpo.hayJapones === false, JSON.stringify(r.cuerpo))
  check('y guarda el 404', d.guardado.at(-1)?.estadoHttp === 404, d.guardado.at(-1)?.estadoHttp)
  check('  …con su cuerpo, para poder leerlo', /not found/.test(String(d.guardado.at(-1)?.cuerpo)))
  check('y explica qué significa', /se queda en TCGdex/.test(r.cuerpo.queSignifica), r.cuerpo.queSignifica)
}

console.log('── 3. UN 200 CON LA LISTA VACÍA NO ES UN SÍ ──')
{
  // Es la familia de siempre: un vacío que se lee como una respuesta. Aquí
  // sí es una respuesta —«no tengo»— pero no es la misma que «sí tengo», y
  // confundirlas haría que el emparejamiento de mañana corriera contra
  // cero sets y no escribiera nada, sin dar error.
  const d = doble({ cuerpo: { data: [], total_count: 0 } })
  const r = await procesar({ env: ENV, ...d })
  check('200 con lista vacía NO es «sí hay»', r.cuerpo.hayJapones === false, JSON.stringify(r.cuerpo))
  check('  …y queda escrito que se preguntó', !!d.guardado.at(-1)?.preguntadoEn)
}

console.log('── 4. El freno: se pregunta UNA vez ──')
{
  const d = doble({ estadoInicial: { preguntadoEn: '2026-10-04T10:00:00.000Z', hayJapones: true, cuantas: 60 } })
  const r = await procesar({ env: ENV, ...d })
  check('no se le pide NADA a Scrydex', d.cuantasPeticiones() === 0, d.cuantasPeticiones())
  check('creditos: 0', r.cuerpo.creditos === 0, r.cuerpo.creditos)
  check('y contesta con lo que ya se sabía', r.cuerpo.hayJapones === true && r.cuerpo.yaSeSabe === true, JSON.stringify(r.cuerpo))
  check('  …sin reescribir el estado', d.guardado.length === 0, JSON.stringify(d.guardado))
  // Y UN «NO» TAMBIÉN ES SABER: si solo frenara con el sí, un 404 se
  // repreguntaría cada cinco minutos para siempre.
  const n = doble({ estadoInicial: { preguntadoEn: '2026-10-04T10:00:00.000Z', hayJapones: false, estadoHttp: 404 } })
  const r2 = await procesar({ env: ENV, ...n })
  check('un «no» también frena', n.cuantasPeticiones() === 0 && r2.cuerpo.creditos === 0, JSON.stringify(r2.cuerpo))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
