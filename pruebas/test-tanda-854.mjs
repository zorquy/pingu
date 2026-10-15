// Tandas 854 y 855 — Celebrations, un solo set con las 50 de TCGGO.
//
// La 854 quiso sacar la Classic Collection a su set con un SQL y lo dejó al
// revés (Celebrations vacío, la Classic con las 50). PINGU: «hazme un solo
// set que sea Celebrations y mete todas, pero déjate de líos. Y no quiero
// ejecutar SQLs, hazlo tú». La 855 lo hace por el camino de la 687: una
// entrada nueva en REEMPLAZOS (`cel25-junto`), que `tcggo-reemplazar-set`
// ejecuta sola en su pasada con la clave de servicio: la expansión 35 de
// TCGGO entera en `cel25`, la Classic se vacía y se borra, y lo apuntado
// pasa a la carta de TCGGO. Nada de hermanos de catálogo para Celebrations
// y el SQL de la 854 fuera del repo.
import { existsSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const series = await import(`${RAIZ}/js/catalogo-series.js`)
const { REEMPLAZOS } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El reemplazo que lo junta ──')
{
  const c = REEMPLAZOS.find((x) => x.clave === 'cel25-junto')
  check('cel25-junto: cel25, cel25cc y cel25c al cel25, expansión 35, entero', c && c.sets.join() === 'cel25,cel25cc,cel25c' && c.destino === 'cel25' && c.episodio === 35 && c.mercado === 'WEST' && c.entero === true, JSON.stringify(c))
  check('  …y va DESPUÉS del de la 687 (una clave nueva: la hecha no se repite)', REEMPLAZOS.findIndex((x) => x.clave === 'cel25-junto') > REEMPLAZOS.findIndex((x) => x.clave === 'cel25-entero'))
  check('  …las claves no se repiten', new Set(REEMPLAZOS.map((x) => x.clave)).size === REEMPLAZOS.length)
}

console.log('── 2. Sin líos: ni hermanos de catálogo ni SQL ──')
{
  check('no hay lista de hermanos solo de catálogo', !('HERMANOS_SOLO_DE_CATALOGO' in series))
  check('cel25 no tiene hermanos (la Classic va dentro)', series.setsHermanos('cel25', ['cel25', 'cel25cc', 'cel25c']).length === 0)
  check('el SQL de la 854 ya no está en el repo', !existsSync(`${RAIZ}/supabase-migration-celebrations-classic.sql`))
  check('los de siempre siguen igual (Lost Origin → su Trainer Gallery)', series.setsHermanos('swsh11', ['swsh11', 'swsh11tg']).join() === 'swsh11tg')
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
