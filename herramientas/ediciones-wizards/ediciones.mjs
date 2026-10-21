// Las ediciones de cada carta de Wizards, de las variantes de
// tcgdex/cards-database (`variants` como lista: tipo, subtipo, sellos y los
// ids de Cardmarket y TCGplayer). Una carta con una sola impresión no lleva
// ediciones: no hay nada que elegir.
import { cartas } from './leer.mjs'

const titulo = (s) => String(s).split('-').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(' ')
const SUBTIPOS = {
  unlimited: 'Unlimited',
  shadowless: 'Shadowless',
  '1999-2000-copyright': 'Unlimited (1999-2000)',
  '1999-copyright': 'Unlimited (1999)',
  'shadowless-red-cheek': 'Shadowless Red Cheeks',
  'missing-expansion-symbol': 'No Set Symbol',
  'gold-border': 'Gold Border',
}
const SELLOS = {
  'pre-release': 'Prerelease',
  winner: 'Winner',
  wotc: 'WotC Stamp',
  'w-promo': 'W Stamp',
  '25th-celebration': '25th Celebration',
  'poketour-99': "PokéTour '99",
  pikachu: 'Pikachu Stamp',
}
// Los que son un fallo de imprenta y no un sello.
const ERRORES_DE_SELLO = { '1st-edition-scratch-error': '1st Edition Scratch Error', 'd-edition-error': 'D Edition Error', 'pikachu-tail': 'Pikachu Tail Error' }

export function edicionDe(v) {
  if (v.type === 'reverse') return { etiqueta: 'Reverse Holo', clase: 'impresion' }
  const sellos = v.stamp || []
  const sub = v.subtype || null
  const base = sub ? (SUBTIPOS[sub] || titulo(sub)) : 'Unlimited'
  const primera = sellos.includes('1st-edition')
  const otro = sellos.find((s) => s !== '1st-edition')
  if (otro) {
    if (ERRORES_DE_SELLO[otro]) return { etiqueta: ERRORES_DE_SELLO[otro], clase: 'adicional' }
    return { etiqueta: SELLOS[otro] || titulo(otro), clase: 'sello' }
  }
  if (primera) {
    // En Base Set la 1.ª edición es siempre Shadowless: «1st Edition» basta.
    if (base === 'Unlimited' || base === 'Shadowless') return { etiqueta: '1st Edition', clase: 'impresion' }
    return { etiqueta: `1st Edition ${base.replace(/^Shadowless /, '')}`, clase: 'adicional' }
  }
  if (base === 'Unlimited' || base === 'Shadowless') return { etiqueta: base, clase: 'impresion' }
  return { etiqueta: base, clase: 'adicional' }
}

const RANGO = { '1st Edition': 0, Shadowless: 1, Unlimited: 2 }

export function edicionesDe(c) {
  const vistas = new Map()
  for (const v of c.variants || []) {
    const e = edicionDe(v)
    const cm = Number(v.thirdParty?.cardmarket) || null
    const tp = Number(v.thirdParty?.tcgplayer) || null
    const ya = vistas.get(e.etiqueta)
    if (ya) { ya.cm ||= cm; ya.tp ||= tp; continue }
    vistas.set(e.etiqueta, { ...e, cm, tp })
  }
  const lista = [...vistas.values()]
  // La Unlimited sin producto de Cardmarket toma el de la primera que no es
  // la 1.ª edición: en Jungle el producto cuelga de la «sin símbolo» y en
  // Fossil de la de 1999-2000, pero es el de la Unlimited de siempre.
  const ilimitada = lista.find((e) => e.etiqueta === 'Unlimited')
  if (ilimitada && !ilimitada.cm) ilimitada.cm = lista.find((e) => e.cm && e.etiqueta !== '1st Edition' && e.clase !== 'sello')?.cm || null
  return lista
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => (RANGO[a.etiqueta] ?? 9) - (RANGO[b.etiqueta] ?? 9) || a.i - b.i)
    .map(({ i, ...e }) => e)
}

export function todas() {
  return cartas()
    .map((c) => ({ s: c.set, n: c.numero, e: edicionesDe(c) }))
    .filter((c) => c.e.length >= 2)
}

if (process.argv[2] === 'json') {
  const t = todas()
  process.stdout.write(JSON.stringify(t.map((c) => ({ s: c.s, n: c.n, e: c.e.map((e) => [e.etiqueta, e.clase, e.cm, e.tp]) }))))
}
if (process.argv[2] === 'resumen') {
  const t = todas()
  const por = new Map()
  for (const c of t) for (const e of c.e) por.set(`${e.clase} ${e.etiqueta}`, (por.get(`${e.clase} ${e.etiqueta}`) || 0) + 1)
  console.log('cartas con ediciones', t.length, 'filas', t.reduce((n, c) => n + c.e.length, 0))
  for (const [k, n] of [...por].sort((a, b) => b[1] - a[1])) console.log(n, k)
  for (const id of ['base1-4', 'base1-3', 'base1-58', 'base2-1', 'base3-16', 'gym2-1', 'neo1-9']) {
    const c = t.find((x) => `${x.s}-${x.n}` === id)
    console.log(id, JSON.stringify(c?.e))
  }
}
