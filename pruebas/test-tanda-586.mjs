// Tanda 586 — los dos mercados (Cardmarket y TCGplayer) y el emparejamiento
// dudoso.
//
// El fixture de Furret es el EJEMPLO de la documentación de TCGdex
// (tcgdex.dev/reference/card), tal cual; el del Groudon lleva las cifras
// de Cardmarket que PINGU vio en pantalla (2,06 € de tendencia, 0,25 €
// desde, 1,34 € a 30 días —que son las del Groudon COMÚN, PRC 84—) y un
// TCGplayer de 150 $ con la forma de la documentación.
import {
  precioDe, tcgplayerDe, emparejamientoDudoso, valorDe, origenDelValor, filaDePrecio, precioDeFila, COLUMNAS_TCGPLAYER,
  enlaceCardmarket, textoDelEnlace, resumenDePrecio, usdAEuros, EUR_POR_USD, valorDeLinea,
} from '/home/user/pingu/js/cardmarket.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const limpio = (t) => String(t).replace(/ /g, ' ')

const FURRET = {
  cardmarket: { updated: '2025-08-05T00:42:15.000Z', unit: 'EUR', avg: 0.08, low: 0.02, trend: 0.08, avg1: 0.03, avg7: 0.08, avg30: 0.08, 'avg-holo': 0.27, 'low-holo': 0.03, 'trend-holo': 0.21, 'avg1-holo': 0.19, 'avg7-holo': 0.19, 'avg30-holo': 0.26 },
  tcgplayer: {
    updated: '2025-08-05T20:07:54.000Z', unit: 'USD',
    normal: { lowPrice: 0.02, midPrice: 0.17, highPrice: 25.09, marketPrice: 0.09, directLowPrice: 0.04 },
    reverse: { lowPrice: 0.09, midPrice: 0.26, highPrice: 5.17, marketPrice: 0.23, directLowPrice: 0.23 },
  },
}
const GROUDON = {
  cardmarket: { updated: '2026-10-05T00:00:00.000Z', unit: 'EUR', idProduct: 272930, avg: 1.34, low: 0.25, trend: 2.06, avg7: 1.55, avg30: 1.34 },
  tcgplayer: { updated: '2026-10-05T20:00:00.000Z', unit: 'USD', holofoil: { lowPrice: 120, midPrice: 160, highPrice: 400, marketPrice: 150 } },
}

console.log('── 1. TCGplayer por versión ──')
{
  check('normal → normal', tcgplayerDe(FURRET.tcgplayer, 'normal')?.mercado === 0.09)
  check('reverse → «reverse» (la llave del ejemplo) ', tcgplayerDe(FURRET.tcgplayer, 'reverse')?.mercado === 0.23)
  check('una ultra rara sin «normal» cae al holofoil', tcgplayerDe(GROUDON.tcgplayer, 'normal')?.mercado === 150 && tcgplayerDe(GROUDON.tcgplayer, 'normal')?.prestado === true)
  check('holo → holofoil, y es la suya', tcgplayerDe(GROUDON.tcgplayer, 'holo')?.mercado === 150 && tcgplayerDe(GROUDON.tcgplayer, 'holo')?.prestado === false)
  check('sin TCGplayer, null', tcgplayerDe(null, 'normal') === null && tcgplayerDe({ updated: 'x', unit: 'USD' }, 'normal') === null)
}

console.log('── 2. Furret: los dos mercados cuadran y Cardmarket manda ──')
{
  const p = precioDe(FURRET, { variante: 'normal' })
  check('Cardmarket como siempre', p.tendencia === 0.08 && p.desde === 0.02 && p.media30 === 0.08)
  check('  …y TCGplayer al lado', p.usd?.mercado === 0.09 && p.usd?.desde === 0.02, JSON.stringify(p.usd))
  check('  …no es dudoso (0,08 € contra 0,09 $)', p.dudoso === false)
  check('  …el valor es el de Cardmarket', valorDe(p) === 0.08 && origenDelValor(p) === 'cardmarket')
  const r = precioDe(FURRET, { reverse: true })
  check('el reverse: el -holo de Cardmarket y el reverse de TCGplayer', r.tendencia === 0.21 && r.usd?.mercado === 0.23, JSON.stringify([r.tendencia, r.usd]))
  check('la frase lleva los dos', /Cardmarket: desde 0,02 € · tendencia 0,08 €/.test(limpio(resumenDePrecio(p))) && /TCGplayer: 0,09/.test(limpio(resumenDePrecio(p))), limpio(resumenDePrecio(p)))
}

console.log('── 3. El Groudon: Cardmarket tiene OTRA carta ──')
{
  const p = precioDe(GROUDON, { variante: 'holo' })
  check('2,06 € contra 150 $ es dudoso', p.dudoso === true)
  check('  …la regla: más de diez veces en cualquier sentido', emparejamientoDudoso(2.06, 150) && emparejamientoDudoso(150, 2.06 / EUR_POR_USD) && !emparejamientoDudoso(2, 5) && !emparejamientoDudoso(2, null))
  check('el valor sale de TCGplayer convertido', valorDe(p) === usdAEuros(150) && origenDelValor(p) === 'tcgplayer', String(valorDe(p)))
  check('  …o sea unos 129 €, no 2', valorDe(p) > 100, String(valorDe(p)))
  check('  …y por copias', valorDeLinea({ cantidad: 2, variante: 'holo' }, p) === usdAEuros(150) * 2)
  check('el enlace NO va al producto equivocado: busca por nombre', /Products\/Search\?searchString=Groudon/.test(enlaceCardmarket({ idProduct: p.idProduct, dudoso: p.dudoso, nombre: 'Groudon EX' })))
  check('  …y el botón lo dice', textoDelEnlace({ idProduct: p.idProduct, dudoso: true }) === 'Buscar en Cardmarket')
  check('  …mientras que sin duda sí va al producto', /idProduct=272930/.test(enlaceCardmarket({ idProduct: 272930, dudoso: false, nombre: 'x' })))
  const frase = limpio(resumenDePrecio(p))
  check('la frase enseña TCGplayer con el ≈ y avisa de Cardmarket', /TCGplayer: 150,00/.test(frase) && /≈/.test(frase) && /OTRA carta/.test(frase), frase)
}

console.log('── 4. Solo TCGplayer, y nada ──')
{
  const solo = precioDe({ tcgplayer: GROUDON.tcgplayer }, { variante: 'holo' })
  check('sin Cardmarket sigue habiendo precio', solo && solo.usd?.mercado === 150 && solo.tendencia === null)
  check('  …del que sale el valor, convertido', valorDe(solo) === usdAEuros(150) && origenDelValor(solo) === 'tcgplayer')
  check('sin ninguno, null', precioDe({}, {}) === null && precioDe(null) === null)
}

console.log('── 5. La fila: ida y vuelta por la base ──')
{
  const f = filaDePrecio('xy5-150', GROUDON, new Date('2026-10-06T00:00:00Z'))
  check('la fila lleva las columnas de TCGplayer', COLUMNAS_TCGPLAYER.every((c) => c in f), JSON.stringify(Object.keys(f)))
  check('  …con el holo donde toca y lo demás a null', f.tp_holo_market === 150 && f.tp_holo_low === 120 && f.tp_normal_market === null && f.tp_reverse_market === null, JSON.stringify(f))
  check('  …y la fecha suya en ISO', f.tp_updated === '2026-10-05T20:00:00.000Z', f.tp_updated)
  const vuelta = precioDeFila(f, { variante: 'holo' })
  check('de vuelta sale lo mismo: dudoso y TCGplayer', vuelta.dudoso === true && vuelta.usd?.mercado === 150 && vuelta.tendencia === 2.06, JSON.stringify(vuelta))
  const f2 = filaDePrecio('swsh3-136', FURRET, new Date())
  check('Furret: normal y reverse en sus columnas', f2.tp_normal_market === 0.09 && f2.tp_reverse_market === 0.23 && f2.tp_holo_market === null)
  check('  …y de vuelta el reverse sigue siendo el reverse', precioDeFila(f2, { reverse: true, variante: 'reverse' }).usd?.mercado === 0.23)
  // Una fila vieja, sin las columnas tp_*, sigue valiendo.
  const vieja = precioDeFila({ card_id: 'x', cm_trend: 3, cm_low: 2, cm_avg30: 2.5 }, {})
  check('una fila sin tp_* es solo Cardmarket, sin dudar', vieja.tendencia === 3 && vieja.usd === null && vieja.dudoso === false)
}

console.log('── 6. La migración ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-precios-tcgplayer.sql', 'utf8')
  check('añade las nueve columnas', COLUMNAS_TCGPLAYER.every((c) => sql.includes(`add column if not exists ${c}`)))
  check('la misma conversión que el cliente', new RegExp(`select ${EUR_POR_USD}::numeric`).test(sql))
  check('la regla de las diez veces, en la base', /emparejamiento_dudoso/.test(sql) && /> 10/.test(sql))
  check('valor_de_linea cae a TCGplayer', /round\(usd \* public\.eur_por_usd\(\), 2\)/.test(sql))
  check('  …y la foto diaria le pasa las columnas', /pr\.tp_normal_market, pr\.tp_normal_low/.test(sql) && /group by c\.user_id/.test(sql))
  check('el manual sigue mandando', sql.indexOf('nullif(p_valor_manual, 0)') < sql.indexOf('emparejamiento_dudoso(eur, usd)'))
}

console.log('── 7. La función programada guarda los dos y no llama a nadie más ──')
{
  const { procesar, COLUMNAS_NUEVAS } = await import('/home/user/pingu/netlify/functions/precios-coleccion.mjs')
  const fuente = readFileSync('/home/user/pingu/netlify/functions/precios-coleccion.mjs', 'utf8')
  check('pokemontcg.io (API muerta) ya no se llama', !/precioDePokemontcg|api\.pokemontcg\.io/.test(fuente))
  const cuerpos = []
  let fallarPorColumna = false
  const fetchImpl = async (url, opciones = {}) => {
    const json = (datos, status = 200) => ({ ok: status < 300, status, json: async () => datos, text: async () => JSON.stringify(datos) })
    if (/rpc\/precios_pendientes/.test(url)) return json([{ card_id: 'xy5-150' }, { card_id: 'swsh3-136' }])
    if (/cards\/xy5-150/.test(url)) return json({ id: 'xy5-150', pricing: GROUDON })
    if (/cards\/swsh3-136/.test(url)) return json({ id: 'swsh3-136', pricing: FURRET })
    if (/rest\/v1\/tcg_card_prices$/.test(url)) {
      cuerpos.push(JSON.parse(opciones.body))
      if (fallarPorColumna && cuerpos.length === 1) return { ok: false, status: 400, text: async () => "Could not find the 'tp_holo_market' column of 'tcg_card_prices' in the schema cache (PGRST204)" }
      return { ok: true, status: 201, text: async () => '' }
    }
    return json({ error: `inesperada ${url}` }, 500)
  }
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's' }, fetchImpl, pausa: 0 })
  check('la pasada guarda las dos', r.ok === true && r.guardados === 2, JSON.stringify(r))
  const groudon = cuerpos[0].find((f) => f.card_id === 'xy5-150')
  check('  …con Cardmarket Y TCGplayer en la misma fila', groudon.cm_trend === 2.06 && groudon.tp_holo_market === 150, JSON.stringify(groudon))
  check('  …y las dos filas con las mismas claves', JSON.stringify(Object.keys(cuerpos[0][0]).sort()) === JSON.stringify(Object.keys(cuerpos[0][1]).sort()))
  cuerpos.length = 0
  fallarPorColumna = true
  const r2 = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's' }, fetchImpl, pausa: 0 })
  check('sin la migración, se reintenta sin las columnas nuevas', r2.ok === true && cuerpos.length === 2 && !COLUMNAS_NUEVAS.some((c) => c in cuerpos[1][0]), JSON.stringify(Object.keys(cuerpos[1]?.[0] || {})))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
