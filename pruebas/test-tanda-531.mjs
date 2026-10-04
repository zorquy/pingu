// Tanda 531 — una fila que no está puede querer decir tres cosas.
//
// En el panel de PINGU, a los diez minutos de empujar el emparejamiento
// japonés, la fila `sets-jp` NO ESTABA. Y eso, desde fuera, es idéntico en
// tres casos que no se parecen en nada: todavía no ha corrido, ha corrido y
// ha reventado, o ha corrido bien y no ha podido escribir el informe.
//
// Es la familia de la 510 —un hueco que se lee como una respuesta— y aquí
// venía de algo muy tonto: el `catch` devolvía el error en la respuesta
// HTTP, y una respuesta HTTP de una función programada **no la lee nadie**.
// Va a los registros de Netlify, que es tanto como no tenerla.
//
// Y de paso el occidental tampoco dejaba informe: lleva desde anoche con 24
// sets sin emparejar y ninguna forma de saber por qué desde el panel.
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const fetchDeVerdad = globalThis.fetch
const envDeVerdad = { ...process.env }

// Un doble de TODO lo que sale por la red: nuestra base y la suya.
function montar({ reventar = false, sinEmparejar = true } = {}) {
  const escrituras = []
  globalThis.fetch = async (url, o = {}) => {
    const u = String(url)
    const cuerpo = o.body ? JSON.parse(o.body) : null
    if (/scrydex_estado/.test(u) && o.method === 'POST') {
      escrituras.push(cuerpo[0])
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
    }
    if (/scrydex_estado/.test(u)) return { ok: true, status: 200, json: async () => [] }
    if (/tcg_sets/.test(u) && /scrydex_id=is\.null/.test(u)) {
      return { ok: true, status: 200, json: async () => (sinEmparejar ? [{ id: 'mf' }] : []) }
    }
    if (/tcg_sets/.test(u)) {
      if (reventar) return { ok: false, status: 500, text: async () => 'todo mal' }
      return { ok: true, status: 200, json: async () => [{ id: 'mf', market: 'JP', name: 'セット' }] }
    }
    // NUESTRA BASE CONTESTA LISTAS, LA SUYA OBJETOS, y el doble tiene que
    // distinguirlo: con todo contestando lo mismo, la función reventaba
    // con «(filas || []).find is not a function» y el informe guardaba ese
    // error como si fuera de producción. Un doble más simple que la base
    // esconde fallos que la base no puede tener (tanda 437) — y aquí,
    // además, se inventa uno.
    if (/tcg_cards/.test(u)) return { ok: true, status: 200, json: async () => [] }
    // Su API.
    return {
      ok: true, status: 200,
      json: async () => ({ data: [{ id: 'mf_ja', name: 'セット', code: 'MF', logo: 'https://x/l', symbol: 'https://x/s', release_date: '2026/09/16', total: 49, printed_total: 40 }], total_count: 1 }),
      text: async () => '',
    }
  }
  return { escrituras }
}

const restaurar = () => { globalThis.fetch = fetchDeVerdad; process.env = { ...envDeVerdad } }

process.env.SCRYDEX_API_KEY = 'k'
process.env.SCRYDEX_TEAM_ID = 't'
process.env.SUPABASE_SERVICE_ROLE_KEY = 's'

console.log('── 1. La pasada japonesa deja su informe ──')
{
  const { escrituras } = montar()
  const { default: handler } = await import('/home/user/pingu/netlify/functions/scrydex-logos-jp.mjs')
  const res = await handler()
  const cuerpo = await res.json()
  const informe = escrituras.find((e) => e.clave === 'sets-jp')
  check('escribe la fila `sets-jp`', !!informe, JSON.stringify(escrituras.map((e) => e.clave)))
  check('  …con la hora, que es lo que frena la pasada siguiente', !!informe?.valor?.cuando, JSON.stringify(informe?.valor))
  check('  …y con lo que hizo', informe?.valor?.emparejados === 1, JSON.stringify(informe?.valor))
  check('y lo devuelve también', cuerpo.emparejados === 1, JSON.stringify(cuerpo))
  restaurar()
}

console.log('── 2. Y SI REVIENTA, también ──')
{
  process.env.SCRYDEX_API_KEY = 'k'
  process.env.SCRYDEX_TEAM_ID = 't'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 's'
  const { escrituras } = montar({ reventar: true })
  const { default: handler } = await import('/home/user/pingu/netlify/functions/scrydex-logos-jp.mjs')
  const res = await handler()
  check('contesta 500', res.status === 500, res.status)
  const informe = escrituras.find((e) => e.clave === 'sets-jp')
  check('pero el fallo QUEDA ESCRITO', !!informe?.valor?.error, JSON.stringify(informe?.valor))
  check('  …con su hora', !!informe?.valor?.cuando, JSON.stringify(informe?.valor))
  // Y eso hace que el freno de las veinte horas cuente para un fallo: una
  // pasada que revienta siempre no puede reintentarlo cada diez minutos.
  check('  …que es lo que impide reintentarlo cada diez minutos', !!informe?.valor?.cuando)
  restaurar()
}

console.log('── 3. Si ya se miró hace poco Y NO AVANZÓ, no se gasta nada ──')
{
  process.env.SCRYDEX_API_KEY = 'k'
  process.env.SCRYDEX_TEAM_ID = 't'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 's'
  let aSuApi = 0
  globalThis.fetch = async (url, o = {}) => {
    const u = String(url)
    if (/scrydex_estado/.test(u) && o.method !== 'POST') {
      // Sin nada escrito y sin nada a medias: el trabajo está hecho.
      return { ok: true, status: 200, json: async () => [{ valor: { cuando: new Date().toISOString(), emparejados: 180, escritas: 0, sinTiempo: 0 } }] }
    }
    if (/scrydex\.com/.test(u)) aSuApi++
    return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '' }
  }
  const { default: handler } = await import('/home/user/pingu/netlify/functions/scrydex-logos-jp.mjs')
  const cuerpo = await (await handler()).json()
  check('cero créditos', cuerpo.creditos === 0, JSON.stringify(cuerpo))
  check('  …y ni una petición a su API', aSuApi === 0, aSuApi)
  check('  …diciendo cuándo fue la última', !!cuerpo.ultimaPasada, JSON.stringify(cuerpo))
  restaurar()
}

console.log('── 3b. PERO SI QUEDÓ TRABAJO A MEDIAS, SE SIGUE ──')
{
  // La primera pasada japonesa de verdad emparejó 120 sets y dejó 62 SIN
  // TIEMPO: una función de Netlify se muere a los 30 segundos. Con el
  // freno de las veinte horas, esos 62 se habrían repartido a lo largo de
  // una semana. El freno es «¿avanzó?», no «¿cuánto hace?».
  process.env.SCRYDEX_API_KEY = 'k'
  process.env.SCRYDEX_TEAM_ID = 't'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 's'
  for (const [etiqueta, valor] of [
    ['quedaron pares sin tiempo', { cuando: new Date().toISOString(), escritas: 0, sinTiempo: 62 }],
    ['o se escribió algo', { cuando: new Date().toISOString(), escritas: 44, sinTiempo: 0 }],
  ]) {
    const escrituras = []
    globalThis.fetch = async (url, o = {}) => {
      const u = String(url)
      const cuerpo = o.body ? JSON.parse(o.body) : null
      if (/scrydex_estado/.test(u) && o.method === 'POST') { escrituras.push(cuerpo[0]); return { ok: true, status: 200, json: async () => ({}), text: async () => '' } }
      if (/scrydex_estado/.test(u)) return { ok: true, status: 200, json: async () => [{ valor }] }
      if (/tcg_sets/.test(u) && /scrydex_id=is\.null/.test(u)) return { ok: true, status: 200, json: async () => [{ id: 'mf' }] }
      if (/tcg_sets/.test(u)) return { ok: true, status: 200, json: async () => [{ id: 'mf', market: 'JP', name: 'セット' }] }
      if (/tcg_cards/.test(u)) return { ok: true, status: 200, json: async () => [] }
      return {
        ok: true, status: 200,
        json: async () => ({ data: [{ id: 'mf_ja', name: 'セット', code: 'MF', logo: 'https://x/l', release_date: '2026/09/16', total: 49, printed_total: 40 }], total_count: 1 }),
        text: async () => '',
      }
    }
    const { default: handler } = await import('/home/user/pingu/netlify/functions/scrydex-logos-jp.mjs')
    const cuerpo = await (await handler()).json()
    check(`si ${etiqueta}, se vuelve a pasar`, cuerpo.creditos !== 0 && !cuerpo.ultimaPasada, JSON.stringify(cuerpo).slice(0, 120))
    restaurar()
  }
}

console.log('── 4. El occidental, lo mismo ──')
{
  process.env.SCRYDEX_API_KEY = 'k'
  process.env.SCRYDEX_TEAM_ID = 't'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 's'
  const { escrituras } = montar()
  const { default: handler } = await import('/home/user/pingu/netlify/functions/scrydex-logos.mjs')
  await handler()
  const informe = escrituras.find((e) => e.clave === 'sets-west')
  check('escribe la fila `sets-west`', !!informe, JSON.stringify(escrituras.map((e) => e.clave)))
  // LO ÚNICO QUE SE PUEDE ARREGLAR SON LOS EJEMPLOS: «sin emparejar: 24»
  // no dice nada; «svp — ninguno suyo con esa fecha y esa cuenta» sí.
  check('  …con ejemplos de los que no casan', 'ejemplosSinEmparejar' in (informe?.valor || {}), JSON.stringify(Object.keys(informe?.valor || {})))
  restaurar()
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
