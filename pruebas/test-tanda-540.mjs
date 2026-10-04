// Tanda 540 — traer SUS sets japoneses, no retocar los nuestros.
//
// PINGU, con las capturas de Scrydex delante: «quiero que calques toda la
// base de datos de sets y de cartas de Scrydex y mostremos eso. Estamos
// pagando Scrydex y Scrydex es lo mandante».
//
// Y el diagnóstico es correcto: el japonés era el catálogo de TCGdex con
// Scrydex retocándolo por encima, y eso llega a medias POR CONSTRUCCIÓN —
// 186 sets nuestros contra 231 suyos, 68 de los nuestros sin una sola
// carta, y el retoque solo toca lo que empareja.
//
// LO QUE MÁS VIGILA ESTA PRUEBA es lo único que aquí se paga caro: DUPLICAR
// una colección. Sale en la cara de la biblioteca y no da ningún error.
import { filaDeSetSuyo, yaLoTenemos, procesar } from '/home/user/pingu/netlify/functions/scrydex-importar-jp.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

// De su listado japonés de verdad (la captura de PINGU del 2026-10-04 y la
// sonda de la 528).
const SUYO = {
  id: 'm6a_ja', name: '30th セレブレーション', code: 'M6a',
  translation: { en: { name: '30th Celebration' } },
  series: 'Mega Evolution',
  logo: 'https://images.scrydex.com/pokemon/m6a_ja-logo/logo',
  symbol: 'https://images.scrydex.com/pokemon/m6a_ja-symbol/symbol',
  release_date: '2026/09/16', total: 176, printed_total: 160,
}

console.log('── 1. Su set, tal cual, como fila nuestra ──')
{
  const f = filaDeSetSuyo(SUYO)
  check('con SU identificador', f.id === 'm6a_ja', f.id)
  check('en el mercado japonés', f.market === 'JP', f.market)
  check('el nombre japonés en `name`, que es el de verdad', f.name === '30th セレブレーション', f.name)
  check('  …y el occidental al lado, que es el que se enseña', f.name_en === '30th Celebration', f.name_en)
  check('la era, en occidental', f.serie_name_en === 'Mega Evolution', f.serie_name_en)
  check('el logo y el símbolo', !!f.logo_scrydex && !!f.symbol_scrydex, JSON.stringify([f.logo_scrydex, f.symbol_scrydex]))
  // Su fecha viene CON BARRAS (la lección de la 501).
  check('la fecha, convertida', f.release_date === '2026-09-16', f.release_date)
  check('las dos cuentas', f.card_count_official === 160 && f.card_count_total === 176, JSON.stringify([f.card_count_official, f.card_count_total]))
  check('y queda dicho de dónde salió', f.scrydex_id === 'm6a_ja' && /importado/.test(f.scrydex_por), f.scrydex_por)
  // `name` es `not null`: un set suyo sin nombre no puede dejar la fila sin
  // formar (la lección de la 526).
  check('un set suyo sin nombre no deja la fila coja', filaDeSetSuyo({ id: 'x_ja' }).name === 'x_ja')
}

console.log('── 2. EL CERROJO: no duplicar una colección ──')
{
  check('si uno nuestro ya lo reclama, no se inserta', yaLoTenemos(SUYO, [{ id: 'M6a', scrydex_id: 'm6a_ja' }]))
  // Y aunque NO lo reclame: su id sin el idioma es el nuestro, sin
  // distinguir mayúsculas (la lección de la 486 — el japonés va en
  // MAYÚSCULAS en TCGdex y en minúsculas en el suyo).
  check('  …y por el id sin el idioma, aunque no esté emparejado', yaLoTenemos(SUYO, [{ id: 'M6a', scrydex_id: null }]))
  check('  …y con el id tal cual', yaLoTenemos({ id: 'SV1a' }, [{ id: 'sv1a' }]))
  check('si no lo tenemos de ninguna forma, se inserta', !yaLoTenemos(SUYO, [{ id: 'SV1a', scrydex_id: 'sv1a_ja' }]))
  check('y con la lista vacía, también', !yaLoTenemos(SUYO, []))
}

console.log('── 3. La pasada entera ──')
{
  const escrito = []
  const estados = []
  let paginas = 0
  const r = await procesar({
    env: ENV,
    restImpl: async (ruta) => {
      if (/scrydex_estado/.test(ruta)) return []
      // Tenemos uno de los tres: el otro y el tercero se insertan.
      return [{ id: 'SV1a', scrydex_id: 'sv1a_ja' }]
    },
    fetchImpl: async () => {
      paginas++
      return {
        ok: true,
        json: async () => ({
          data: paginas === 1
            ? [SUYO, { id: 'sv1a_ja', name: 'トリプレットビート' }, { id: 'm5_ja', name: 'アビスアイ', translation: { en: { name: 'Abyss Eye' } } }]
            : [],
          total_count: 3,
        }),
      }
    },
    escribirImpl: async (filas) => { escrito.push(...filas) },
    guardarEstadoImpl: async (v) => { estados.push(v) },
  })
  const ids = escrito.map((f) => f.id)
  check('inserta los que no tenemos', ids.includes('m6a_ja') && ids.includes('m5_ja'), JSON.stringify(ids))
  check('  …y NO el que ya está emparejado', !ids.includes('sv1a_ja'), JSON.stringify(ids))
  check('lo cuenta en el informe', r.cuerpo.insertados === 2, JSON.stringify(r.cuerpo))
  check('  …y lo deja en el panel', estados.at(-1)?.insertados === 2, JSON.stringify(estados.at(-1)))
  check('con ejemplos que se leen', /30th Celebration/.test(JSON.stringify(estados.at(-1)?.ejemplos)), JSON.stringify(estados.at(-1)?.ejemplos))
  check('y dice lo que costó', r.cuerpo.creditos === 1, r.cuerpo.creditos)
}

console.log('── 4. NO BORRA NADA ──')
{
  // Esto es una afirmación sobre el código, y conviene que esté escrita:
  // la decisión de retirar el catálogo japonés viejo es de PINGU, porque
  // hay gente que puede tener cartas apuntando a esos identificadores.
  const fuente = (await import('node:fs')).readFileSync('/home/user/pingu/netlify/functions/scrydex-importar-jp.mjs', 'utf8')
  check('no hay ni un DELETE', !/method:\s*'DELETE'/.test(fuente) && !/\bdelete\b/i.test(fuente.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')))
  check('y solo escribe en `tcg_sets`', (fuente.match(/rest\('([a-z_]+)'/g) || []).every((x) => /tcg_sets|scrydex_estado/.test(x)))
}

console.log('── 5. Dos de los suyos con el mismo id no rompen la sentencia ──')
{
  // Postgres corta con «ON CONFLICT DO UPDATE command cannot affect row a
  // second time» si la misma clave sale dos veces (la lección del catálogo
  // chino, tanda 333).
  const escrito = []
  await procesar({
    env: ENV,
    restImpl: async (ruta) => (/scrydex_estado/.test(ruta) ? [] : []),
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: [SUYO, { ...SUYO }], total_count: 2 }) }),
    escribirImpl: async (filas) => { escrito.push(...filas) },
    guardarEstadoImpl: async () => {},
  })
  check('el repetido se queda fuera', escrito.length === 1, JSON.stringify(escrito.map((f) => f.id)))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
