// Tanda 671 — las japonesas sin precio, el enlace japonés y el coreano y el chino.
//
// PINGU: «las japonesas no tienen precio; algunas sí, algunas no. El
// enlace no te lleva al filtro correcto en Cardmarket. Y lo de traernos
// los precios coreanos y chinos de los prints japoneses». Y pegó la
// respuesta de TCGGO a su clave BASIC: «Japanese catalog requires an
// Ultra or Mega plan».
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { filaDePreciosTcggo } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const { IDIOMAS, IDIOMAS_CON_PRECIO, idiomaDe, enlaceCardmarket, columnaDeIdioma } = await import(`${RAIZ}/js/cardmarket.js`)

console.log('── 1. La fila de precios de una carta japonesa: japonés, coreano y chino; el inglés no se inventa ──')
{
  const carta = { id: 63456, cardmarket_id: 900105, prices: { cardmarket: { lowest_near_mint: 9, lowest_near_mint_KR: 8, lowest_near_mint_CN: 8.5 }, tcg_player: {} } }
  const f = filaDePreciosTcggo('M6-080', carta, { mercado: 'JP' })
  check('el general es el japonés; el coreano y el chino, los suyos', f.cm_low_ja === 9 && f.cm_low_ko === 8 && f.cm_low_zh === 8.5 && f.cm_low === 9, JSON.stringify(f))
  check('  …y NO se escribe como inglés (antes el general iba a cm_low_en)', f.cm_low_en === null)
  check('  …otras grafías valen igual (_KO, _ZH, _TW)', filaDePreciosTcggo('x', { prices: { cardmarket: { lowest_near_mint_KO: 3, lowest_near_mint_TW: 4 } } }, { mercado: 'JP' }).cm_low_ko === 3 && filaDePreciosTcggo('x', { prices: { cardmarket: { lowest_near_mint_ZH: 5 } } }, { mercado: 'JP' }).cm_low_zh === 5)
  const w = filaDePreciosTcggo('sv1-1', { prices: { cardmarket: { lowest_near_mint: 2, lowest_near_mint_ES: 3 } } })
  check('una occidental sigue igual: el general es el inglés, y sin coreano ni chino', w.cm_low_en === 2 && w.cm_low_es === 3 && w.cm_low_ko === null && w.cm_low_zh === null)
}

console.log('\n── 2. Los idiomas: el japonés con su filtro de Cardmarket, y el coreano y el chino con precio ──')
{
  check('japonés 7, coreano 10, chino 11 (los filtros `language` de Cardmarket)', idiomaDe('ja').cm === 7 && idiomaDe('ko').cm === 10 && idiomaDe('zh').cm === 11 && IDIOMAS.some((i) => i.id === 'ko'))
  check('el enlace de una japonesa lleva su producto Y su idioma', /idProduct=900105/.test(enlaceCardmarket({ idProduct: 900105, idioma: 'ja' })) && /language=7/.test(enlaceCardmarket({ idProduct: 900105, idioma: 'ja' })))
  check('coreano y chino tienen columna de precio', columnaDeIdioma('ko') === 'cm_low_ko' && columnaDeIdioma('zh') === 'cm_low_zh' && IDIOMAS_CON_PRECIO.includes('ko'))
  const js = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('…pero no se ofrecen al AÑADIR en los catálogos de ahora (no hay carta coreana a la que ponérselo)', /i\.id !== 'zh' && i\.id !== 'ko'/.test(js))
  const css = readFileSync(`${RAIZ}/css/cardmarket.css`, 'utf8')
  check('las dos banderas', /pv-bandera\[data-idioma='ko'\]/.test(css) && /pv-bandera\[data-idioma='zh'\]/.test(css))
  check('la migración añade las dos columnas', /add column if not exists cm_low_ko/.test(readFileSync(`${RAIZ}/supabase-migration-tcggo-corea-china.sql`, 'utf8')) && /add column if not exists cm_low_zh/.test(readFileSync(`${RAIZ}/supabase-migration-tcggo-corea-china.sql`, 'utf8')))
}

console.log('\n── 3. La pasada: el mapa japonés sale de NUESTROS sets, y el error de plan bloquea solo lo japonés ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
  const AHORA = new Date('2026-10-06T08:00:00Z')
  const PLAN = { message: 'Japanese catalog (singles, products, expansions) requires an Ultra or Mega plan.', feature: 'japanese_catalog', required_plan: 'ULTRA', current_plan: 'BASIC', upgrade: 'https://rapidapi.com/tcggopro/api/cardmarket-api-tcg/pricing' }
  const montar = ({ jpContesta = true, sinMigracionKoZh = false } = {}) => {
    const estados = {
      [CLAVE_PARES]: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'Scarlet & Violet', logo: 'https://x/l.png', cartas: 258, valorCm: 100 }] } },
      // El catálogo NO tiene el mapa japonés (las expansiones de antes de la 642): el set lo lleva.
      tcggo_catalogo: { setsPorEpisodio: { JP: {} }, episodiosJp: { lista: [{ id: 552, nombre: 'Storm Emerald', cartas: 113 }] } },
      [CLAVE_ESTADO]: {},
    }
    const escritas = []
    const urls = []
    const guardadas = []
    const fetchImpl = async (url) => {
      urls.push(url)
      const u = new URL(url)
      const ep = Number(u.searchParams.get('episode_id'))
      if (/pokemon-jp/.test(u.pathname)) {
        if (!jpContesta) return { ok: false, status: 403, text: async () => JSON.stringify(PLAN) }
        if (ep === 552) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 63456, card_number: '080', cardmarket_id: 900105, prices: { cardmarket: { lowest_near_mint: 9, lowest_near_mint_KR: 8, lowest_near_mint_CN: 8.5 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
      }
      if (ep === 10) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, card_number: '1', cardmarket_id: 500, prices: { cardmarket: { lowest_near_mint: 2 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
      return { ok: false, status: 404, text: async () => 'no' }
    }
    const restImpl = async (ruta) => {
      if (/^tcg_sets\?select=id,tcggo_id&market=eq\.JP/.test(ruta)) return [{ id: 'M6', tcggo_id: 552 }]
      if (/market=eq\.JP/.test(ruta)) return /"M6"/.test(decodeURIComponent(ruta)) ? [{ id: 'M6-080', cm_id_product_propio: 900105 }] : []
      return [{ id: 'sv1-1', cm_id_product_propio: 500 }]
    }
    return {
      estados, escritas, urls, guardadas, fetchImpl, restImpl,
      guardarImpl: async (filas) => {
        guardadas.push(filas)
        if (sinMigracionKoZh && filas.some((f) => 'cm_low_ko' in f)) throw new Error(`PGRST204: Could not find the 'cm_low_ko' column of 'tcg_card_prices' in the schema cache`)
        escritas.push(...filas)
      },
      guardarSetsImpl: async (f) => f.length,
      fotoImpl: async () => 0,
      estadoImpl: async (clave) => estados[clave],
      guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
    }
  }
  const sinPausa = async () => {}
  // a) El japonés contesta: la carta de M6 tiene precio aunque el catálogo no tenga el mapa.
  const b = montar()
  const r = await procesar({ env: ENV, ...b, pausa: sinPausa, ahora: AHORA })
  const jp = b.escritas.find((f) => f.card_id === 'M6-080')
  check('la japonesa de un set con tcggo_id (sin mapa en el catálogo) recibe su precio: japonés 9, coreano 8, chino 8,50', r.ok && jp && jp.cm_low_ja === 9 && jp.cm_low_ko === 8 && jp.cm_low_zh === 8.5 && jp.cm_low_en === null, JSON.stringify({ r: JSON.stringify(r).slice(0, 200), jp }))
  check('  …y la occidental también', b.escritas.some((f) => f.card_id === 'sv1-1' && f.cm_low_en === 2))
  // b) El plan no da el japonés: queda apuntado, bloqueado el día, y lo occidental escrito.
  const b2 = montar({ jpContesta: false })
  const r2 = await procesar({ env: ENV, ...b2, pausa: sinPausa, ahora: AHORA })
  const e2 = b2.estados[CLAVE_ESTADO]
  check('con «requires an Ultra plan» la occidental se escribe igual y la pasada no queda parada', r2.ok && b2.escritas.some((f) => f.card_id === 'sv1-1') && !r2.parado, JSON.stringify(r2).slice(0, 300))
  check('  …el japonés queda BLOQUEADO el día, con el motivo, y el parón apuntado para /admin', e2.jpBloqueado?.dia === '2026-10-06' && /Ultra/.test(e2.jpBloqueado.motivo) && /403/.test(e2.ultimoParado?.motivo || ''), JSON.stringify({ jp: e2.jpBloqueado, u: e2.ultimoParado }))
  const antes = b2.urls.length
  const r3 = await procesar({ env: ENV, ...b2, pausa: sinPausa, ahora: AHORA })
  check('  …y la pasada siguiente del mismo día no le pide nada japonés a TCGGO', !b2.urls.slice(antes).some((u) => /pokemon-jp/.test(u)) && r3.ok, JSON.stringify(b2.urls.slice(antes)))
  // c) Sin la migración del coreano/chino, se escribe lo demás y se apunta.
  const b4 = montar({ sinMigracionKoZh: true })
  const r4 = await procesar({ env: ENV, ...b4, pausa: sinPausa, ahora: AHORA })
  const jp4 = b4.escritas.find((f) => f.card_id === 'M6-080')
  check('sin la migración, la base rechaza y se reintenta SIN las dos columnas: el japonés se escribe igual', r4.ok && !r4.saltado && jp4 && jp4.cm_low_ja === 9 && !('cm_low_ko' in jp4) && b4.estados[CLAVE_ESTADO].faltaMigracionKoZh === '2026-10-06', JSON.stringify({ r4: JSON.stringify(r4).slice(0, 160), jp4 }))
  // 687: la marca vale UN DÍA. Al día siguiente se vuelven a mandar las dos
  // columnas (PINGU ejecutó la migración y se seguían tirando).
  b4.estados[CLAVE_ESTADO] = { ...b4.estados[CLAVE_ESTADO], hechos: [], dia: undefined }
  const escritasAntes = b4.escritas.length
  const r5 = await procesar({ env: ENV, ...b4, pausa: sinPausa, ahora: new Date('2026-10-07T08:00:00Z') })
  const jp5 = b4.escritas.slice(escritasAntes).find((f) => f.card_id === 'M6-080')
  check('al día siguiente se prueba otra vez CON las dos columnas (y la base, que sigue sin migración, vuelve a apuntarlo para ese día)', r5.ok && jp5 && !('cm_low_ko' in jp5) && b4.estados[CLAVE_ESTADO].faltaMigracionKoZh === '2026-10-07', JSON.stringify({ r5: JSON.stringify(r5).slice(0, 120), marca: b4.estados[CLAVE_ESTADO].faltaMigracionKoZh }))
  const js = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('/admin enseña el estado de los precios: hecho, hechas, parón, japonés bloqueado, migración', /ÚLTIMO PARÓN/.test(js) && /JAPONÉS BLOQUEADO/.test(js) && /corea-china/.test(js))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
